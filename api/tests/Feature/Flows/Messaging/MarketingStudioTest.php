<?php

namespace Tests\Feature\Flows\Messaging;

use App\Models\Channel;
use App\Models\Discount;
use App\Models\MarketingCreative;
use App\Models\SocialPost;
use App\Models\TemplateZone;
use App\Models\ZoneType;
use App\Services\Social\SocialPostService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Tests\Concerns\ActsAsRoles;
use Tests\Feature\Flows\Store\Concerns\StoreFixtures;
use Tests\TestCase;

/**
 * App Social → Estudio de contenido: permisos, fuentes, textos con IA (Groq simulado), ficha de la
 * marca, biblioteca de piezas, publicar en Facebook e Instagram (Meta simulado), programar y calendario.
 */
class MarketingStudioTest extends TestCase
{
    use ActsAsRoles, RefreshDatabase, StoreFixtures;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRolesAndUsers();
        $this->seedStoreCatalog();
        config(['services.groq.key' => 'gsk_test']);
    }

    protected function tearDown(): void
    {
        foreach (MarketingCreative::all() as $c) {
            @unlink(public_path($c->mediaPath));
        }
        parent::tearDown();
    }

    private function channel(): Channel
    {
        return Channel::create(['type' => 'messenger', 'name' => 'Facebook', 'isActive' => true, 'aiAutoReply' => false, 'config' => ['pageId' => '111', 'pageAccessToken' => 'tok']]);
    }

    private function creative(string $kind = 'post', string $mime = 'image/png'): array
    {
        $file = $mime === 'image/png'
            ? UploadedFile::fake()->image('pieza.png', 100, 100)
            : UploadedFile::fake()->create('reel.mp4', 200, 'video/mp4');

        return $this->post('/api/messaging/marketing/creatives', [
            'title' => 'Suéter oferta', 'kind' => $kind, 'source' => 'producto', 'sourceIds' => '[1]', 'template' => 'destacado',
            'data' => '{"title":"x"}', 'caption' => 'Texto del post', 'hashtags' => '["toclex","moda"]', 'media' => $file,
        ], ['Accept' => 'application/json'])->assertCreated()->json('data');
    }

    public function test_solo_quien_publica_en_social_entra_al_estudio(): void
    {
        $this->getJson('/api/messaging/marketing/creatives')->assertUnauthorized();
        $this->actingAsCliente();
        $this->getJson('/api/messaging/marketing/creatives')->assertForbidden();
        $this->actingAsVendedor();
        $this->getJson('/api/messaging/marketing/sources?type=producto')->assertForbidden();
        $this->actingAsAdmin();
        $this->getJson('/api/messaging/marketing/creatives')->assertOk()->assertJsonPath('data', []);
    }

    public function test_fuentes_con_precio_oferta_y_promociones(): void
    {
        $this->actingAsAdmin();
        $p = $this->makeProduct('Suéter Negro', 50000, [['negro', 'M', 3]], ['tags' => ['anime']]);
        Discount::create(['name' => 'Oferta 20', 'type' => 'percent', 'value' => 20, 'isAuto' => true, 'isActive' => true, 'appliesTo' => 'product', 'targetIds' => [$p->id], 'channel' => 'all']);
        Discount::create(['code' => 'HOLA10', 'name' => 'Hola', 'type' => 'percent', 'value' => 10, 'isAuto' => false, 'isActive' => true, 'appliesTo' => 'all', 'channel' => 'all']);

        $row = collect($this->getJson('/api/messaging/marketing/sources?type=producto')->assertOk()->json('data'))->firstWhere('id', $p->id);
        $this->assertEquals([40000, 50000, 20], [$row['price'], $row['listPrice'], $row['discountPercent']]);
        $col = collect($this->getJson('/api/messaging/marketing/sources?type=coleccion')->json('data'))->firstWhere('id', 'anime');
        $this->assertSame('Anime', $col['name']);
        $promos = collect($this->getJson('/api/messaging/marketing/sources?type=promocion')->json('data'));
        $this->assertSame('-10%', $promos->firstWhere('code', 'HOLA10')['label']);
        $this->getJson('/api/messaging/marketing/sources?type=otro')->assertUnprocessable();

        // Plantillas personalizables: con sus zonas de diseño (sin las bloqueadas) para los videos 3D.
        $tpl = $this->makeProduct('Suéter Personalizable', 70000, [['negro', 'M', 2]], ['isTemplate' => true, 'model3d' => 'basica']);
        $zone = fn (string $slug, array $a = []) => TemplateZone::create(array_merge([
            'templateId' => $tpl->id, 'zoneTypeId' => ZoneType::where('slug', $slug)->value('id'), 'zoneId' => 'z-'.uniqid(),
            'name' => ucfirst($slug), 'shape' => 'rect', 'positionX' => 30, 'positionY' => 24, 'maxWidth' => 40, 'maxHeight' => 42,
            'isEditable' => true, 'isRequired' => false, 'isBlocked' => false, 'price' => 0, 'sortOrder' => 1, 'isActive' => true,
        ], $a));
        $zone('frente');
        $zone('espalda', ['shape' => 'circle', 'sortOrder' => 2]);
        $zone('frente', ['isBlocked' => true, 'name' => 'Bloqueada']);
        $row = collect($this->getJson('/api/messaging/marketing/sources?type=plantilla')->assertOk()->json('data'))->firstWhere('id', $tpl->id);
        $this->assertSame(['Frente', 'Espalda'], array_column($row['zones'], 'name'));
        $this->assertSame(['frente', 30, 24, 40, 42, false], [$row['zones'][0]['view'], $row['zones'][0]['x'], $row['zones'][0]['y'], $row['zones'][0]['w'], $row['zones'][0]['h'], $row['zones'][0]['circle']]);
        $this->assertTrue($row['zones'][1]['circle']);
    }

    public function test_textos_con_ia_y_respaldo_sin_ia(): void
    {
        $this->actingAsAdmin();
        Http::fake(['api.groq.com/*' => Http::sequence()
            ->push(['choices' => [['message' => ['content' => json_encode([
                'title' => 'Estilo que destaca', 'subtitle' => 'Nuevo', 'cta' => 'Compra ya', 'caption' => 'Lleva el tuyo.', 'hashtags' => ['#moda', 'toclex', 'ropa nueva'],
            ])]]]])
            ->push('caído', 500)]);
        $items = [['name' => 'Suéter', 'price' => 50000, 'image' => 'data:image/png;base64,'.str_repeat('A', 5000)]];
        $r = $this->postJson('/api/messaging/marketing/copy', ['kind' => 'post', 'source' => 'producto', 'items' => $items])->assertOk()->json('data');
        $this->assertTrue($r['ai']);
        $this->assertSame('Estilo que destaca', $r['title']);
        // Hashtags de la marca primero, limpios y sin repetir.
        $this->assertSame(['toclex', 'madewithintention', 'moda', 'ropanueva'], $r['hashtags']);
        // A la IA no se le mandan fotos.
        Http::assertSent(fn ($req) => ! str_contains($req->body(), 'data:image'));

        $r = $this->postJson('/api/messaging/marketing/copy', ['kind' => 'reel', 'source' => 'producto', 'items' => $items])->assertOk()->json('data');
        $this->assertFalse($r['ai']);
        $this->assertNotEmpty($r['caption']);
    }

    public function test_ficha_de_la_marca(): void
    {
        $this->actingAsAdmin();
        $k = $this->getJson('/api/messaging/marketing/brand')->assertOk()->json('data');
        $this->assertSame('Elegant Lime', collect($k['colors'])->firstWhere('key', 'accent')['name']);
        $this->putJson('/api/messaging/marketing/brand', ['colors' => [['key' => 'accent', 'name' => 'Lima', 'hex' => 'verde']]])->assertUnprocessable();
        $r = $this->putJson('/api/messaging/marketing/brand', [
            'slogan' => 'Hecho con intención',
            'colors' => [['key' => 'primary', 'name' => 'Carbón', 'hex' => '#111111'], ['key' => 'accent', 'name' => 'Lima', 'hex' => '#abd04c']],
            'fonts' => ['heading' => 'Bebas Neue', 'body' => 'Comic Sans', 'headingUppercase' => false],
            'voice' => ['tone' => 'elegante', 'hashtags' => ['#toclex', 'hecho con'], 'personality' => 'Sobria'],
        ])->assertOk()->json('data');
        $this->assertSame('Hecho con intención', $r['slogan']);
        $this->assertSame('#ABD04C', $r['colors'][1]['hex']);
        $this->assertSame(['Bebas Neue', 'Inter', false], [$r['fonts']['heading'], $r['fonts']['body'], $r['fonts']['headingUppercase']]);
        $this->assertSame(['toclex', 'hechocon'], $r['voice']['hashtags']);
    }

    public function test_biblioteca_publicar_programar_y_calendario(): void
    {
        $this->actingAsAdmin();
        // Un reel debe ser video.
        $this->post('/api/messaging/marketing/creatives', [
            'title' => 'x', 'kind' => 'reel', 'media' => UploadedFile::fake()->image('a.png'),
        ], ['Accept' => 'application/json'])->assertUnprocessable();
        $img = $this->creative();
        $this->assertFileExists(public_path(ltrim($img['media'], '/')));
        $video = $this->creative('reel', 'video/mp4');
        $this->assertSame('video', $video['mediaType']);

        // Sin página de Facebook conectada no se publica.
        $this->postJson('/api/messaging/marketing/publish', ['creativeIds' => [$img['id']], 'platforms' => ['facebook']])->assertUnprocessable();
        $this->channel();

        // Un video no va en carrusel.
        $this->postJson('/api/messaging/marketing/publish', ['creativeIds' => [$img['id'], $video['id']], 'platforms' => ['facebook']])->assertUnprocessable();

        // Ahora: Facebook (foto) e Instagram (reel), con Meta simulado.
        Http::fake([
            'graph.facebook.com/*/111/photos' => Http::response(['id' => 'p1', 'post_id' => '111_p1']),
            'graph.facebook.com/*/111?fields=instagram_business_account*' => Http::response(['instagram_business_account' => ['id' => 'ig9']]),
            'graph.facebook.com/*/111?*' => Http::response(['instagram_business_account' => ['id' => 'ig9']]),
            'graph.facebook.com/*/ig9/media_publish' => Http::response(['id' => 'm77']),
            'graph.facebook.com/*/ig9/media' => Http::response(['id' => 'c55']),
            'graph.facebook.com/*/c55*' => Http::response(['status_code' => 'FINISHED']),
            'graph.facebook.com/*' => Http::response(['permalink_url' => 'https://fb.com/x', 'permalink' => 'https://ig.com/x']),
        ]);
        config(['services.meta.public_domain' => 'tienda.test']);
        $fb = $this->postJson('/api/messaging/marketing/publish', ['creativeIds' => [$img['id']], 'platforms' => ['facebook']])->assertOk()->json('data.0');
        $this->assertSame(['published', 'photo'], [$fb['status'], $fb['type']]);
        $ig = $this->postJson('/api/messaging/marketing/publish', ['creativeIds' => [$video['id']], 'platforms' => ['instagram'], 'caption' => 'Reel'])->assertOk()->json('data.0');
        $this->assertSame(['published', 'video'], [$ig['status'], $ig['type']], (string) ($ig['error'] ?? ''));
        Http::assertSent(fn ($req) => str_contains($req->url(), '/ig9/media') && ($req['media_type'] ?? null) === 'REELS');

        // Programar: queda programada y la publica el comando cuando llega la hora.
        $this->postJson('/api/messaging/marketing/publish', ['creativeIds' => [$img['id']], 'platforms' => ['facebook'], 'scheduledAt' => now()->subDay()->toIso8601String()])->assertUnprocessable();
        $when = now()->addHour();
        $s = $this->postJson('/api/messaging/marketing/publish', ['creativeIds' => [$img['id']], 'platforms' => ['facebook'], 'scheduledAt' => $when->toIso8601String()])->assertOk()->json('data.0');
        $this->assertSame('scheduled', $s['status']);
        // Con programadas pendientes la pieza no se borra.
        $this->deleteJson("/api/messaging/marketing/creatives/{$img['id']}")->assertStatus(409);
        $this->patchJson("/api/messaging/marketing/posts/{$s['id']}/schedule", ['scheduledAt' => now()->addHours(2)->toIso8601String()])->assertOk();

        $cal = collect($this->getJson('/api/messaging/marketing/calendar?month='.now()->format('Y-m'))->assertOk()->json('data'));
        $this->assertTrue($cal->contains(fn ($p) => $p['id'] === $s['id'] && $p['thumb'] === $img['media']));

        $this->assertSame(0, app(SocialPostService::class)->publishDue()); // todavía no es la hora
        SocialPost::where('id', $s['id'])->update(['scheduledAt' => now()->subMinute()]);
        $this->artisan('social:publish-scheduled')->assertSuccessful();
        $this->assertSame('published', SocialPost::find($s['id'])->status);

        // Ya publicada: la pieza se puede borrar de la biblioteca.
        $this->deleteJson("/api/messaging/marketing/creatives/{$img['id']}")->assertOk();
        $this->assertNull(MarketingCreative::find($img['id']));
    }
}
