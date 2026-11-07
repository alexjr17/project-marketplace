<?php

namespace Tests\Feature\Services;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\Concerns\ActsAsRoles;
use Tests\TestCase;

/**
 * La sincronización de tarifas llama a la URL de cotización que configura el admin: solo
 * puede ir a hosts públicos (nada de la red interna, localhost ni metadatos de la nube) y sin
 * seguir redirecciones. Si la URL no es pública, esa zona queda con tarifa simulada y el error.
 */
class ShippingRateSyncSsrfTest extends TestCase
{
    use ActsAsRoles, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRolesAndUsers();
    }

    private function sync(string $url)
    {
        return $this->postJson('/api/shipping/sync-rates', [
            'zones' => [['id' => 'z1', 'name' => 'Medellín', 'cities' => ['Medellín']]],
            'apiConfig' => [
                'quoteUrl' => $url,
                'method' => 'POST',
                'responseMapping' => ['costPath' => 'cost'],
            ],
        ]);
    }

    public function test_no_llama_a_direcciones_internas(): void
    {
        Http::fake();
        $this->actingAsAdmin();

        foreach (['http://127.0.0.1/quote', 'http://169.254.169.254/latest/meta-data', 'http://10.0.0.5/q', 'file:///etc/passwd'] as $url) {
            $res = $this->sync($url)->assertOk();
            $this->assertSame('simulated', $res->json('data.source'), $url);
            $this->assertStringContainsString('URL no permitida', $res->json('data.errors.0'), $url);
        }

        Http::assertNothingSent();
    }

    public function test_un_host_publico_si_se_consulta(): void
    {
        Http::fake(['93.184.216.34/*' => Http::response(['cost' => 12345], 200)]);
        $this->actingAsAdmin();

        $res = $this->sync('http://93.184.216.34/quote')->assertOk();
        $this->assertSame('api', $res->json('data.source'));
        $this->assertSame(12345, (int) $res->json('data.rates.0.baseCost'));
        Http::assertSentCount(1);
    }
}
