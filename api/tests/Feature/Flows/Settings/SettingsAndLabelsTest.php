<?php

namespace Tests\Feature\Flows\Settings;

use App\Models\Announcement;
use App\Models\Discount;
use App\Models\LabelTemplate;
use App\Models\LabelZone;
use App\Models\Setting;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\ActsAsRoles;
use Tests\TestCase;

/**
 * Ajustes y marketing después de pasar la lógica a servicios: configuración por tipo,
 * plantillas de etiquetas y sus zonas, subida de imágenes, anuncios vigentes y descuentos.
 */
class SettingsAndLabelsTest extends TestCase
{
    use ActsAsRoles, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRolesAndUsers();
    }

    // ---------------- Configuración ----------------

    public function test_config_por_tipo_se_guarda_y_sale_en_la_publica_sin_secretos(): void
    {
        $this->actingAsAdmin();
        $this->putJson('/api/settings/home/config', ['showFeatures' => true])->assertOk()
            ->assertJsonPath('message', 'Configuración actualizada')->assertJsonPath('data.showFeatures', true);
        $this->getJson('/api/settings/home/config')->assertOk()->assertJsonPath('data.showFeatures', true);
        $this->getJson('/api/settings/nada/config')->assertNotFound();

        $this->putJson('/api/settings/payments/config', ['methods' => [
            ['type' => 'wompi', 'wompiConfig' => ['publicKey' => 'pub_1', 'privateKey' => 'prv_secreta']],
        ]])->assertOk();
        $public = $this->getJson('/api/settings/public')->assertOk()->json('data');
        $this->assertTrue($public['home']['showFeatures']);
        $this->assertSame('pub_1', $public['payment']['methods'][0]['wompiConfig']['publicKey']);
        $this->assertStringNotContainsString('prv_secreta', json_encode($public));
    }

    // ---------------- Plantillas de etiquetas ----------------

    private function template(array $attrs = []): array
    {
        return $this->postJson('/api/label-templates', $attrs + ['name' => 'Base'])->assertCreated()->json('data');
    }

    public function test_el_cajero_lee_la_impresion_pero_no_la_edita(): void
    {
        Setting::updateOrCreate(['key' => 'printing_settings'], ['value' => ['ticketWidth' => 58]]);

        // El POS necesita el formato del recibo: el cajero (pos.access) lo puede leer…
        $this->actingAsCajero();
        $this->getJson('/api/settings/printing/config')->assertOk()->assertJsonPath('data.ticketWidth', 58);
        // …pero no editarlo, ni leer otros ajustes.
        $this->putJson('/api/settings/printing/config', ['ticketWidth' => 80])->assertForbidden();
        $this->getJson('/api/settings/general/config')->assertForbidden();

        // El cliente no lee la impresión.
        $this->actingAsCliente();
        $this->getJson('/api/settings/printing/config')->assertForbidden();
    }

    public function test_solo_una_plantilla_por_defecto_y_no_se_borra_la_unica(): void
    {
        $this->actingAsAdmin();
        $a = $this->template(['name' => 'A', 'isDefault' => true]);
        $this->assertSame('A4', $a['pageType']);

        $this->deleteJson("/api/label-templates/{$a['id']}")->assertStatus(400)
            ->assertJsonPath('message', 'No se puede eliminar la única plantilla por defecto');

        $b = $this->template(['name' => 'B', 'isDefault' => true]);
        $this->assertFalse(LabelTemplate::find($a['id'])->isDefault);
        $this->assertTrue(LabelTemplate::find($b['id'])->isDefault);

        $this->patchJson("/api/label-templates/{$a['id']}", ['isDefault' => true])->assertOk()->assertJsonPath('data.isDefault', true);
        $this->assertFalse(LabelTemplate::find($b['id'])->isDefault);
        $this->deleteJson("/api/label-templates/{$a['id']}")->assertOk();
    }

    public function test_zonas_unicas_por_tipo_duplicado_y_edicion_en_lote(): void
    {
        $this->actingAsAdmin();
        $t = $this->template();
        $zone = ['zoneType' => 'BARCODE', 'x' => 1, 'y' => 2, 'width' => 30, 'height' => 10];
        $z = $this->postJson("/api/label-templates/{$t['id']}/zones", $zone)->assertCreated()
            ->assertJsonPath('data.fontSize', 10)->json('data');
        $this->postJson("/api/label-templates/{$t['id']}/zones", $zone)->assertStatus(400)
            ->assertJsonPath('message', 'Ya existe una zona de tipo BARCODE en esta plantilla');

        // En lote: las zonas de otra plantilla se ignoran y los campos no editables también.
        $otra = $this->template(['name' => 'Otra']);
        $ajena = LabelZone::create(['labelTemplateId' => $otra['id'], 'zoneType' => 'SKU', 'x' => 0, 'y' => 0, 'width' => 1, 'height' => 1]);
        $res = $this->patchJson("/api/label-templates/{$t['id']}/zones/batch", ['zones' => [
            ['id' => $z['id'], 'data' => ['x' => 50, 'labelTemplateId' => $otra['id']]],
            ['id' => $ajena->id, 'data' => ['x' => 99]],
        ]])->assertOk()->json('data');
        $this->assertCount(1, $res);
        $this->assertEquals(50, LabelZone::find($z['id'])->x);
        $this->assertSame($t['id'], LabelZone::find($z['id'])->labelTemplateId);
        $this->assertEquals(0, $ajena->fresh()->x);

        $copy = $this->postJson("/api/label-templates/{$t['id']}/duplicate", ['name' => 'Copia'])->assertCreated()->json('data');
        $this->assertSame('Copia', $copy['name']);
        $this->assertFalse($copy['isDefault']);
        $this->assertCount(1, $copy['zones']);
        $this->assertEquals(50, $copy['zones'][0]['x']);
    }

    // ---------------- Subidas ----------------

    public function test_subida_base64_valida_formato_y_se_puede_borrar(): void
    {
        $this->actingAsAdmin();
        $png = base64_encode(base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='));

        $this->postJson('/api/uploads/base64', ['image' => 'no-es-base64!!'])->assertStatus(400)
            ->assertJsonPath('message', 'La imagen base64 no es válida');
        $this->postJson('/api/uploads/base64', ['image' => base64_encode('texto')])->assertStatus(400)
            ->assertJsonPath('message', 'El archivo no es una imagen válida');

        $up = $this->postJson('/api/uploads/base64', ['image' => 'data:image/png;base64,'.$png, 'folder' => 'carpeta-rara'])
            ->assertCreated()->assertJsonPath('data.format', 'png')->assertJsonPath('data.width', 1)->json('data');
        $this->assertStringStartsWith('uploads/general/', $up['publicId']);
        $this->assertFileExists(public_path($up['publicId']));

        $this->deleteJson('/api/uploads/'.$up['publicId'])->assertOk();
        $this->assertFileDoesNotExist(public_path($up['publicId']));
        $this->deleteJson('/api/uploads/'.$up['publicId'])->assertNotFound();
        $this->deleteJson('/api/uploads/otra/cosa.png')->assertStatus(400)->assertJsonPath('message', 'Public ID inválido');
    }

    // ---------------- Marketing ----------------

    public function test_anuncios_vigentes_y_codigo_de_descuento_en_mayusculas(): void
    {
        Announcement::create(['title' => 'Vigente', 'message' => 'a', 'isActive' => true, 'priority' => 1]);
        Announcement::create(['title' => 'Prioritario', 'message' => 'b', 'isActive' => true, 'priority' => 5]);
        Announcement::create(['title' => 'Vencido', 'message' => 'c', 'isActive' => true, 'endsAt' => now()->subDay()]);
        Announcement::create(['title' => 'Futuro', 'message' => 'd', 'isActive' => true, 'startsAt' => now()->addDay()]);
        Announcement::create(['title' => 'Inactivo', 'message' => 'e', 'isActive' => false]);

        $this->getJson('/api/announcements/active')->assertOk()
            ->assertJsonPath('data.*.title', ['Prioritario', 'Vigente']);

        $this->actingAsAdmin();
        $d = $this->postJson('/api/discounts', ['code' => ' bienvenida ', 'type' => 'percent', 'value' => 10])
            ->assertCreated()->assertJsonPath('data.code', 'BIENVENIDA')->json('data');
        $this->putJson("/api/discounts/{$d['id']}", ['isAuto' => true, 'code' => '', 'type' => 'percent', 'value' => 5, 'appliesTo' => 'product'])
            ->assertOk()->assertJsonPath('data.code', null);
        $this->assertNull(Discount::find($d['id'])->code);
    }
}
