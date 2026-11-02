<?php

namespace Tests\Feature\Flows\Manufacturing;

use App\Models\MfgPurchaseOrder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\Concerns\ActsAsRoles;
use Tests\Feature\Flows\Manufacturing\Concerns\MfgFixtures;
use Tests\TestCase;

/**
 * Caracterización de los catálogos de Fábrica: lo que hoy guardan, cómo normalizan y la
 * forma del JSON ({success, message?, data}).
 */
class CatalogsTest extends TestCase
{
    use ActsAsRoles, MfgFixtures, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->registerMysqlShims();
        $this->seedRolesAndUsers();
    }

    public function test_los_catalogos_exigen_sesion_y_permiso_de_fabrica(): void
    {
        $this->getJson('/api/manufacturing/brands')->assertUnauthorized();

        $this->actingAsCliente();
        $this->getJson('/api/manufacturing/brands')->assertForbidden();

        // El Administrador de la tienda (rol 3) no tiene permisos de Fábrica.
        $this->actingAsVendedor();
        $this->getJson('/api/manufacturing/colors')->assertForbidden();
        $this->getJson('/api/manufacturing/references')->assertForbidden();
        $this->getJson('/api/manufacturing/purchase-orders')->assertForbidden();
    }

    public function test_marcas_crud_y_forma_del_json(): void
    {
        $this->actingAsAdmin();

        $res = $this->postJson('/api/manufacturing/brands', ['name' => 'Zeta', 'code' => 'ZT'])
            ->assertCreated()
            ->assertJsonPath('success', true)
            ->assertJsonPath('message', 'Marca creada')
            ->assertJsonPath('data.name', 'Zeta')
            ->assertJsonPath('data.code', 'ZT');
        $id = $res->json('data.id');
        $this->postJson('/api/manufacturing/brands', ['name' => 'Alfa'])->assertCreated();

        // Lista ordenada por nombre.
        $this->getJson('/api/manufacturing/brands')->assertOk()
            ->assertJsonPath('data.0.name', 'Alfa')
            ->assertJsonPath('data.1.name', 'Zeta');

        $this->putJson("/api/manufacturing/brands/{$id}", ['name' => 'Zeta 2'])
            ->assertOk()->assertJsonPath('message', 'Marca actualizada')->assertJsonPath('data.name', 'Zeta 2');

        $this->putJson('/api/manufacturing/brands/999', ['name' => 'X'])
            ->assertNotFound()->assertExactJson(['success' => false, 'message' => 'Marca no encontrada']);

        $this->deleteJson("/api/manufacturing/brands/{$id}")
            ->assertOk()->assertExactJson(['success' => true, 'message' => 'Marca eliminada']);

        $this->postJson('/api/manufacturing/brands', [])
            ->assertStatus(422)->assertJsonPath('success', false)->assertJsonPath('message', 'Error de validación')
            ->assertJsonStructure(['errors' => ['name']]);
    }

    public function test_colecciones_se_ordenan_por_anio_descendente(): void
    {
        $this->actingAsAdmin();
        $this->postJson('/api/manufacturing/collections', ['name' => '2025-II', 'year' => 2025, 'semester' => 'II'])->assertCreated();
        $this->postJson('/api/manufacturing/collections', ['name' => '2026-I', 'year' => 2026, 'semester' => 'I'])
            ->assertCreated()->assertJsonPath('message', 'Colección creada');
        $this->postJson('/api/manufacturing/collections', ['name' => 'X', 'semester' => 'III'])->assertStatus(422);

        $this->getJson('/api/manufacturing/collections')->assertOk()
            ->assertJsonPath('data.0.name', '2026-I')
            ->assertJsonPath('data.1.name', '2025-II');
    }

    public function test_colores_y_tallas_por_mercado(): void
    {
        $this->actingAsAdmin();
        $this->postJson('/api/manufacturing/colors', ['name' => 'Rojo', 'hexCode' => '#FF0000', 'code' => '03'])
            ->assertCreated()->assertJsonPath('data.hexCode', '#FF0000');
        // Sin hexCode: la columna toma el default #000000.
        $sin = $this->postJson('/api/manufacturing/colors', ['name' => 'Azul'])->assertCreated()->json('data.id');
        $this->assertSame('#000000', DB::table('mfg_colors')->where('id', $sin)->value('hexCode'));

        $this->postJson('/api/manufacturing/sizes', ['name' => 'Talla 8', 'abbreviation' => '8', 'market' => 'EXPORT', 'sortOrder' => 11])
            ->assertCreated()->assertJsonPath('data.market', 'EXPORT')->assertJsonPath('data.sortOrder', 11);
        $this->postJson('/api/manufacturing/sizes', ['name' => 'Small', 'abbreviation' => 'S', 'sortOrder' => 1])
            ->assertCreated()->assertJsonPath('message', 'Talla creada');
        $this->postJson('/api/manufacturing/sizes', ['name' => 'X', 'abbreviation' => 'X', 'market' => 'OTRO'])->assertStatus(422);
        $this->postJson('/api/manufacturing/sizes', ['name' => 'X'])->assertStatus(422)->assertJsonStructure(['errors' => ['abbreviation']]);

        // Ordenadas por sortOrder.
        $this->getJson('/api/manufacturing/sizes')->assertOk()
            ->assertJsonPath('data.0.abbreviation', 'S')
            ->assertJsonPath('data.1.abbreviation', '8');
    }

    public function test_tipos_de_prenda_normalizan_el_codigo_y_guardan_tallas_por_mercado(): void
    {
        $this->actingAsAdmin();
        $c = $this->seedMfgCatalog();

        $res = $this->postJson('/api/manufacturing/garment-types', [
            'code' => '  hoo ', 'name' => 'Hoodie', 'composition' => 'SUPERIOR', 'brandId' => $c['brand']->id,
            'fixedCost' => 2500, 'factor' => 1.8, 'factorExport' => 2.2,
            'nationalSizeIds' => [$c['s']->id, $c['m']->id, $c['s']->id],
            'exportSizeIds' => [$c['t10']->id],
        ])->assertCreated()->assertJsonPath('message', 'Tipo de prenda creado');

        $res->assertJsonPath('data.code', 'HOO')
            ->assertJsonPath('data.fixedCost', '2500.00')
            ->assertJsonPath('data.factor', '1.8000')
            ->assertJsonPath('data.factorExport', '2.2000')
            ->assertJsonPath('data.brand.name', 'Vexa');
        $id = $res->json('data.id');
        $this->assertCount(3, $res->json('data.sizes')); // S y M (deduplicadas) + 10
        $markets = collect($res->json('data.sizes'))->mapWithKeys(fn ($s) => [$s['abbreviation'] => $s['pivot']['market']])->all();
        $this->assertSame(['S' => 'NATIONAL', 'M' => 'NATIONAL', '10' => 'EXPORT'], $markets);

        // Código único.
        $this->postJson('/api/manufacturing/garment-types', ['code' => 'CAM', 'name' => 'Otra'])->assertStatus(422)
            ->assertJsonStructure(['errors' => ['code']]);

        // Update sin listas de tallas: no toca las tallas.
        $this->putJson("/api/manufacturing/garment-types/{$id}", ['code' => 'HOO', 'name' => 'Hoodie 2'])->assertOk()
            ->assertJsonPath('data.name', 'Hoodie 2');
        $this->assertSame(3, DB::table('mfg_garment_type_sizes')->where('garmentTypeId', $id)->count());

        // Update con solo nacional: reescribe todo (la exportación se pierde).
        $this->putJson("/api/manufacturing/garment-types/{$id}", ['code' => 'HOO', 'name' => 'Hoodie', 'nationalSizeIds' => [$c['m']->id]])->assertOk();
        $this->assertSame(
            [['sizeId' => $c['m']->id, 'market' => 'NATIONAL']],
            DB::table('mfg_garment_type_sizes')->where('garmentTypeId', $id)->get(['sizeId', 'market'])->map(fn ($r) => (array) $r)->all()
        );

        $this->deleteJson("/api/manufacturing/garment-types/{$id}")->assertOk()->assertJsonPath('message', 'Tipo de prenda eliminado');
        $this->deleteJson("/api/manufacturing/garment-types/{$id}")->assertNotFound();
    }

    public function test_bodegas_talleres_y_procesos(): void
    {
        $this->actingAsAdmin();
        $c = $this->seedMfgCatalog();

        $this->postJson('/api/manufacturing/warehouses', ['name' => 'Bodega 2', 'code' => 'BP'])->assertStatus(422); // código único
        $this->postJson('/api/manufacturing/warehouses', ['name' => 'Bodega 2', 'code' => 'B2', 'address' => 'Cra 1'])
            ->assertCreated()->assertJsonPath('message', 'Bodega creada')->assertJsonPath('data.address', 'Cra 1');

        // Taller con procesos (sync); sin processIds en el update se conservan.
        $w = $this->postJson('/api/manufacturing/workshops', [
            'name' => 'Satélite', 'type' => 'EXTERNAL', 'processIds' => [$c['corte']->id, $c['confeccion']->id],
        ])->assertCreated()->json('data');
        $this->assertCount(2, $w['processes']);
        $this->putJson("/api/manufacturing/workshops/{$w['id']}", ['name' => 'Satélite 2'])->assertOk()
            ->assertJsonCount(2, 'data.processes');
        $this->putJson("/api/manufacturing/workshops/{$w['id']}", ['name' => 'Satélite 2', 'processIds' => []])->assertOk()
            ->assertJsonCount(0, 'data.processes');
        // Sin type: default de la columna EXTERNAL.
        $w2 = $this->postJson('/api/manufacturing/workshops', ['name' => 'Otro'])->assertCreated()->json('data.id');
        $this->assertSame('EXTERNAL', DB::table('mfg_workshops')->where('id', $w2)->value('type'));

        // Proceso con consumos: TYPE ignora inputId y viceversa.
        $p = $this->postJson('/api/manufacturing/processes', [
            'name' => 'Estampado', 'code' => 'EST', 'sequence' => 4, 'type' => 'EXTERNAL',
            'consumptions' => [
                ['kind' => 'TYPE', 'inputTypeId' => $c['telas']->id, 'inputId' => $c['hilo']->id],
                ['kind' => 'INPUT', 'inputId' => $c['hilo']->id, 'inputTypeId' => $c['telas']->id],
            ],
        ])->assertCreated()->assertJsonPath('message', 'Proceso creado')->json('data');
        $this->assertSame('TYPE', $p['consumptions'][0]['kind']);
        $this->assertNull($p['consumptions'][0]['inputId']);
        $this->assertSame('Telas', $p['consumptions'][0]['inputType']['name']);
        $this->assertNull($p['consumptions'][1]['inputTypeId']);
        $this->assertSame('HIL-01', $p['consumptions'][1]['input']['code']);

        // Lista ordenada por secuencia.
        $codes = collect($this->getJson('/api/manufacturing/processes')->assertOk()->json('data'))->pluck('code')->all();
        $this->assertSame(['CRT', 'CNF', 'EMP', 'EST'], $codes);
    }

    public function test_clientes_no_se_eliminan_si_tienen_pedidos(): void
    {
        $this->actingAsAdmin();
        $c = $this->seedMfgCatalog();

        $this->postJson('/api/manufacturing/clients', ['name' => 'X', 'documentType' => 'RUT'])->assertStatus(422);
        $this->postJson('/api/manufacturing/clients', ['name' => 'X', 'creditDays' => 400])->assertStatus(422);
        $nuevo = $this->postJson('/api/manufacturing/clients', [
            'name' => 'Tiendas D1', 'documentType' => 'NIT', 'documentId' => '900', 'creditDays' => 30, 'email' => 'd1@x.co',
        ])->assertCreated()->assertJsonPath('message', 'Cliente creado')->assertJsonPath('data.creditDays', 30)->json('data.id');

        MfgPurchaseOrder::create(['code' => 'PED-X', 'clientId' => $c['cliente']->id, 'status' => 'DRAFT']);
        $this->deleteJson("/api/manufacturing/clients/{$c['cliente']->id}")
            ->assertStatus(422)->assertJsonPath('message', 'No se puede eliminar: el cliente tiene pedidos.');
        $this->deleteJson("/api/manufacturing/clients/{$nuevo}")->assertOk()->assertJsonPath('message', 'Cliente eliminado');
    }

    public function test_tipos_de_insumo_e_insumos(): void
    {
        $this->actingAsAdmin();
        $c = $this->seedMfgCatalog();

        $this->postJson('/api/manufacturing/input-types', ['name' => 'Servicios', 'classification' => 'SERVICIO'])
            ->assertCreated()->assertJsonPath('message', 'Tipo de insumo creado')->assertJsonPath('data.classification', 'SERVICIO');
        $this->postJson('/api/manufacturing/input-types', ['name' => 'X', 'classification' => 'OTRO'])->assertStatus(422);

        $this->postJson('/api/manufacturing/inputs', ['code' => 'TEL-01', 'name' => 'Dup'])->assertStatus(422);
        $i = $this->postJson('/api/manufacturing/inputs', [
            'code' => 'BOT-01', 'name' => 'Botón', 'inputTypeId' => $c['hilos']->id, 'unitOfMeasure' => 'und', 'scope' => 'EXTERNAL',
        ])->assertCreated()->assertJsonPath('message', 'Insumo creado')->json('data');
        // El update de su propio código no choca con la regla unique.
        $this->putJson("/api/manufacturing/inputs/{$i['id']}", ['code' => 'BOT-01', 'name' => 'Botón 2'])->assertOk()
            ->assertJsonPath('data.name', 'Botón 2');

        // Lista con el tipo embebido (id, name, classification), por nombre.
        $list = $this->getJson('/api/manufacturing/inputs')->assertOk()->json('data');
        $this->assertSame(['Botón 2', 'Hilo', 'Tela algodón'], array_column($list, 'name'));
        $this->assertSame(['id', 'name', 'classification'], array_keys($list[1]['inputType']));
    }

    public function test_lotes_de_insumo_y_precio_promedio(): void
    {
        $this->actingAsAdmin();
        $c = $this->seedMfgCatalog();
        $tela = $c['tela']->id;

        $this->getJson("/api/manufacturing/inputs/{$tela}/batches")->assertOk()
            ->assertExactJson(['success' => true, 'data' => ['batches' => [], 'average' => 0]]);

        $b1 = $this->postJson("/api/manufacturing/inputs/{$tela}/batches", [
            'unitCost' => 4000, 'quantity' => 100, 'purchasedAt' => '2026-01-10', 'colorId' => $c['blanco']->id, 'reference' => 'FAC-1',
        ])->assertCreated()->assertJsonPath('message', 'Lote registrado')
            ->assertJsonPath('data.unitCost', '4000.00')
            ->assertJsonPath('data.quantity', '100.0000')
            ->assertJsonPath('data.color.name', 'Blanco')
            ->json('data.id');
        $this->postJson("/api/manufacturing/inputs/{$tela}/batches", ['unitCost' => 4333.33, 'purchasedAt' => '2026-02-10'])->assertCreated();

        $res = $this->getJson("/api/manufacturing/inputs/{$tela}/batches")->assertOk();
        // Promedio simple de unitCost (no ponderado por cantidad), redondeado a 2.
        $res->assertJsonPath('data.average', 4166.67);
        $this->assertSame('2026-02-10', substr($res->json('data.batches.0.purchasedAt'), 0, 10)); // más reciente primero

        $this->postJson('/api/manufacturing/inputs/999/batches', ['unitCost' => 1])->assertNotFound();
        $this->deleteJson("/api/manufacturing/inputs/{$c['hilo']->id}/batches/{$b1}")->assertNotFound(); // de otro insumo
        $this->deleteJson("/api/manufacturing/inputs/{$tela}/batches/{$b1}")->assertOk()->assertJsonPath('message', 'Lote eliminado');
    }
}
