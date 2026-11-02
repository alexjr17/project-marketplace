<?php

namespace Tests\Feature\Flows\Manufacturing;

use App\Models\MfgExchangeRate;
use App\Models\MfgReference;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\ActsAsRoles;
use Tests\Feature\Flows\Manufacturing\Concerns\MfgFixtures;
use Tests\TestCase;

/**
 * Caracterización de las referencias (ficha técnica + costos + listas de precio) y de la
 * tasa de cambio COP→USD.
 */
class ReferencesTest extends TestCase
{
    use ActsAsRoles, MfgFixtures, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->registerMysqlShims();
        $this->seedRolesAndUsers();
        $this->actingAsAdmin();
        $this->seedMfgCatalog();
    }

    // ---------------- Costos ----------------

    public function test_calcula_costo_variable_unitario_y_precio_base(): void
    {
        $ref = $this->createReference();

        // 1.5 × 4000 + 0.1 × 500 = 6050; + fijo 1000 = 7050; × factor 2 = 14100.
        $this->assertSame('6050.00', $ref['costVariable']);
        $this->assertSame('7050.00', $ref['costUnit']);
        $this->assertSame('14100.00', $ref['basePrice']);
        $this->assertSame('1000.00', $ref['fixedCost']);
        $this->assertSame('2.0000', $ref['factor']);
        // La marca se copia del tipo de prenda.
        $this->assertSame($this->mfg['brand']->id, $ref['brandId']);
        $this->assertSame('Vexa', $ref['brand']['name']);
    }

    public function test_sin_costo_fijo_ni_factor_no_usa_los_del_tipo_de_prenda(): void
    {
        // El tipo CAM tiene fixedCost 1000 y factor 2, pero la referencia usa los suyos (0 y 1).
        $ref = $this->createReference(['fixedCost' => null, 'factor' => null]);

        $this->assertSame('6050.00', $ref['costVariable']);
        $this->assertSame('6050.00', $ref['costUnit']);
        $this->assertSame('6050.00', $ref['basePrice']);
        $this->assertSame('0.00', $ref['fixedCost']);
        $this->assertSame('1.0000', $ref['factor']);
    }

    public function test_forma_del_json_de_la_referencia(): void
    {
        $ref = $this->createReference(['components' => [['position' => 'SUPERIOR', 'description' => 'Torso']]]);
        $show = $this->getJson("/api/manufacturing/references/{$ref['id']}")->assertOk()
            ->assertJsonStructure(['success', 'data' => [
                'id', 'code', 'name', 'garmentTypeId', 'brandId', 'collectionId', 'description', 'isActive', 'imagePath',
                'fixedCost', 'factor', 'costVariable', 'costUnit', 'basePrice', 'createdAt', 'updatedAt',
                'garmentType' => ['id', 'code', 'name', 'brandId', 'fixedCost', 'factor', 'factorExport', 'brand'],
                'brand', 'collection',
                'colors' => [['id', 'referenceId', 'colorId', 'colorType', 'color' => ['id', 'name', 'hexCode', 'code']]],
                'sizes' => [['id', 'referenceId', 'sizeId', 'size' => ['id', 'name', 'abbreviation', 'sortOrder', 'market']]],
                'components' => [['id', 'position', 'description']],
                'materials' => [['id', 'inputId', 'colorId', 'componentId', 'consumption', 'unitValue', 'input' => ['id', 'code', 'inputType']]],
                'sizeGroups',
            ]])->json('data');

        $this->assertTrue($show['isActive']);
        $this->assertSame('PRIMARY', $show['colors'][0]['colorType']);
        $this->assertSame('SECONDARY', $show['colors'][1]['colorType']); // por defecto
        $this->assertSame('1.5000', $show['materials'][0]['consumption']);
        $this->assertSame('4000.0000', $show['materials'][0]['unitValue']);

        $this->getJson('/api/manufacturing/references/999')->assertNotFound()
            ->assertExactJson(['success' => false, 'message' => 'Referencia no encontrada']);
    }

    public function test_materiales_ligados_a_componentes_por_indice_y_colores_deduplicados(): void
    {
        $ref = $this->createReference([
            'colors' => [['colorId' => $this->mfg['blanco']->id], ['colorId' => $this->mfg['blanco']->id, 'type' => 'PRIMARY']],
            'components' => [['position' => 'SUPERIOR'], ['position' => 'INFERIOR', 'description' => 'Pantalón']],
            'materials' => [
                ['inputId' => $this->mfg['tela']->id, 'consumption' => 1, 'unitValue' => 100, 'componentIndex' => 1],
                ['inputId' => $this->mfg['hilo']->id, 'consumption' => 1, 'unitValue' => 100, 'componentIndex' => 5],
            ],
        ]);

        $this->assertCount(1, $ref['colors']);
        $this->assertSame('SECONDARY', $ref['colors'][0]['colorType']); // gana el primero
        $inferior = collect($ref['components'])->firstWhere('position', 'INFERIOR');
        $this->assertSame($inferior['id'], $ref['materials'][0]['componentId']);
        $this->assertNull($ref['materials'][1]['componentId']); // índice inexistente
    }

    // ---------------- Códigos ----------------

    public function test_codigo_consecutivo_por_tipo_de_prenda_y_sufijo_editable(): void
    {
        $this->postJson('/api/manufacturing/references/generate-code', ['garmentTypeId' => $this->mfg['cam']->id])
            ->assertOk()->assertExactJson(['success' => true, 'data' => ['code' => 'CAM-0001']]);

        $a = $this->createReference();
        $this->assertSame('CAM-0001', $a['code']);
        $this->assertSame('CAM-0002', $this->createReference()['code']);

        // El prefijo lo fuerza el tipo; el sufijo se limpia y pasa a mayúsculas.
        $this->assertSame('CAM-AB1', $this->createReference(['code' => 'xyz-ab 1'])['code']);
        $this->assertSame('CAM-77', $this->createReference(['code' => '77'])['code']);
        // Un sufijo no numérico no afecta al consecutivo.
        $this->assertSame('CAM-0078', $this->createReference()['code']);

        $this->postJson('/api/manufacturing/references', [
            'name' => 'Dup', 'garmentTypeId' => $this->mfg['cam']->id, 'code' => 'CAM-0001',
        ])->assertStatus(422)->assertExactJson([
            'success' => false, 'message' => 'El código ya existe', 'errors' => ['code' => ['El código ya existe']],
        ]);
    }

    public function test_al_editar_sin_codigo_conserva_el_existente(): void
    {
        $ref = $this->createReference();
        $this->putJson("/api/manufacturing/references/{$ref['id']}", [
            'name' => 'Renombrada', 'garmentTypeId' => $this->mfg['cam']->id, 'fixedCost' => 1000, 'factor' => 2,
            'materials' => [['inputId' => $this->mfg['tela']->id, 'consumption' => 2, 'unitValue' => 4000]],
        ])->assertOk()
            ->assertJsonPath('message', 'Referencia actualizada')
            ->assertJsonPath('data.code', 'CAM-0001')
            ->assertJsonPath('data.costVariable', '8000.00')
            ->assertJsonPath('data.basePrice', '18000.00')
            // Colores y tallas no enviados: se conservan.
            ->assertJsonCount(2, 'data.colors')
            ->assertJsonCount(2, 'data.sizes')
            ->assertJsonCount(1, 'data.materials');
    }

    public function test_editar_sin_materiales_pone_el_costo_en_cero_pero_conserva_el_bom(): void
    {
        $ref = $this->createReference();
        $res = $this->putJson("/api/manufacturing/references/{$ref['id']}", [
            'name' => 'Solo nombre', 'garmentTypeId' => $this->mfg['cam']->id, 'fixedCost' => 1000, 'factor' => 2,
        ])->assertOk();

        // ACTUAL (posible bug): sin 'materials' en el PUT el BOM se conserva (2 materiales),
        // pero computeCosts() lo trata como vacío y deja costVariable = 0 (costUnit = solo el fijo).
        $res->assertJsonCount(2, 'data.materials')
            ->assertJsonPath('data.costVariable', '0.00')
            ->assertJsonPath('data.costUnit', '1000.00')
            ->assertJsonPath('data.basePrice', '2000.00');
    }

    public function test_listado_con_busqueda_y_filtro_activo(): void
    {
        $this->createReference(['name' => 'Polo clásico']);
        $this->createReference(['name' => 'Camiseta cuello V', 'isActive' => false]);

        $this->getJson('/api/manufacturing/references?search=polo')->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'Polo clásico');
        $this->getJson('/api/manufacturing/references?search=CAM-0002')->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/manufacturing/references?isActive=0')->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.isActive', false);
        $this->getJson('/api/manufacturing/references')->assertOk()->assertJsonCount(2, 'data');
    }

    public function test_eliminar_referencia(): void
    {
        $ref = $this->createReference();
        $this->deleteJson("/api/manufacturing/references/{$ref['id']}")->assertOk()
            ->assertExactJson(['success' => true, 'message' => 'Referencia eliminada']);
        $this->assertNull(MfgReference::find($ref['id']));
        $this->deleteJson("/api/manufacturing/references/{$ref['id']}")->assertNotFound();
    }

    // ---------------- Grupos de tallas (listas de precio) ----------------

    private function sizeGroupsPayload(): array
    {
        return [
            [
                'name' => 'Nacional S-M', 'market' => 'NATIONAL', 'fixedCostExtra' => 950, 'factor' => 1.5,
                'sizeIds' => [$this->mfg['s']->id, $this->mfg['m']->id, $this->mfg['s']->id],
                'surcharges' => [
                    ['colorId' => $this->mfg['negro']->id, 'amount' => 500],
                    ['colorId' => $this->mfg['negro']->id, 'amount' => 900], // duplicado: se ignora
                    ['colorId' => $this->mfg['blanco']->id, 'amount' => 0],  // 0: se ignora
                ],
            ],
            ['name' => 'Exportación', 'market' => 'EXPORT', 'factor' => 2, 'sizeIds' => [$this->mfg['t10']->id]],
            ['name' => 'Export manual', 'market' => 'EXPORT', 'listPrice' => 25, 'isWholesale' => true],
            ['name' => 'Sin mercado'],
        ];
    }

    public function test_grupos_de_tallas_nacional_y_exportacion_con_tasa_activa(): void
    {
        MfgExchangeRate::create(['rate' => 4100, 'currency' => 'USD', 'effectiveDate' => '2026-01-01', 'isActive' => true]);

        $ref = $this->createReference(['sizeGroups' => $this->sizeGroupsPayload()]);
        $g = $ref['sizeGroups'];

        $this->assertCount(4, $g);
        // Nacional: (costUnit 7050 + extra 950) × 1.5 = 12000 (en pesos).
        $this->assertSame(['NATIONAL', '12000.00', '950.00', '1.5000', 0, false], [
            $g[0]['market'], $g[0]['listPrice'], $g[0]['fixedCostExtra'], $g[0]['factor'], $g[0]['sortOrder'], $g[0]['isWholesale'],
        ]);
        $this->assertCount(2, $g[0]['sizes']);           // tallas deduplicadas
        $this->assertCount(1, $g[0]['surcharges']);      // solo Negro 500
        $this->assertSame('500.00', $g[0]['surcharges'][0]['amount']);
        $this->assertSame('Negro', $g[0]['surcharges'][0]['color']['name']);
        // Exportación: 7050 × 2 = 14100 pesos ÷ 4100 = 3.44 USD.
        $this->assertSame(['EXPORT', '3.44'], [$g[1]['market'], $g[1]['listPrice']]);
        // Precio enviado: se guarda tal cual (no se convierte).
        $this->assertSame(['25.00', true], [$g[2]['listPrice'], $g[2]['isWholesale']]);
        // Sin mercado: nacional, factor 1 → costUnit.
        $this->assertSame(['NATIONAL', '7050.00', 3], [$g[3]['market'], $g[3]['listPrice'], $g[3]['sortOrder']]);
    }

    public function test_exportacion_sin_tasa_queda_en_cero(): void
    {
        $ref = $this->createReference(['sizeGroups' => [['name' => 'Exportación', 'market' => 'EXPORT', 'factor' => 2]]]);

        $this->assertSame('0.00', $ref['sizeGroups'][0]['listPrice']);
    }

    public function test_cambiar_la_tasa_no_recalcula_las_referencias_existentes(): void
    {
        MfgExchangeRate::create(['rate' => 4100, 'currency' => 'USD', 'effectiveDate' => '2026-01-01', 'isActive' => true]);
        $ref = $this->createReference(['sizeGroups' => [['name' => 'Exp', 'market' => 'EXPORT', 'factor' => 2]]]);

        $this->postJson('/api/manufacturing/exchange-rates', ['rate' => 5000])->assertCreated();

        $this->getJson("/api/manufacturing/references/{$ref['id']}")->assertOk()
            ->assertJsonPath('data.sizeGroups.0.listPrice', '3.44');
    }

    // ---------------- Tasa de cambio ----------------

    public function test_tasa_de_cambio_solo_una_activa(): void
    {
        $this->getJson('/api/manufacturing/exchange-rates/active')->assertOk()->assertExactJson(['success' => true]);

        $first = $this->postJson('/api/manufacturing/exchange-rates', ['rate' => 4100, 'currency' => 'usd', 'effectiveDate' => '2026-01-15'])
            ->assertCreated()
            ->assertJsonPath('message', 'Tasa de cambio registrada')
            ->assertJsonPath('data.rate', '4100.0000')
            ->assertJsonPath('data.currency', 'USD')
            ->assertJsonPath('data.effectiveDate', '2026-01-15')
            ->assertJsonPath('data.isActive', true)
            ->json('data.id');

        // Sin fecha: hoy en Bogotá; sin moneda: USD.
        $second = $this->postJson('/api/manufacturing/exchange-rates', ['rate' => 4200.5])->assertCreated()
            ->assertJsonPath('data.currency', 'USD')
            ->assertJsonPath('data.effectiveDate', now('America/Bogota')->toDateString())
            ->json('data.id');

        $this->assertFalse(MfgExchangeRate::find($first)->isActive);
        $this->getJson('/api/manufacturing/exchange-rates/active')->assertOk()
            ->assertJsonPath('data.id', $second)->assertJsonPath('data.rate', '4200.5000');

        // Lista: más reciente primero.
        $this->getJson('/api/manufacturing/exchange-rates')->assertOk()
            ->assertJsonPath('data.0.id', $second)->assertJsonPath('data.1.id', $first);

        // Borrar la activa: la más reciente que queda pasa a activa.
        $this->deleteJson("/api/manufacturing/exchange-rates/{$second}")->assertOk()
            ->assertExactJson(['success' => true, 'message' => 'Tasa eliminada']);
        $this->assertTrue(MfgExchangeRate::find($first)->isActive);

        $this->deleteJson('/api/manufacturing/exchange-rates/999')->assertNotFound();
    }

    public function test_borrar_una_tasa_inactiva_no_cambia_la_activa(): void
    {
        $old = $this->postJson('/api/manufacturing/exchange-rates', ['rate' => 4000])->json('data.id');
        $active = $this->postJson('/api/manufacturing/exchange-rates', ['rate' => 4100])->json('data.id');

        $this->deleteJson("/api/manufacturing/exchange-rates/{$old}")->assertOk();
        $this->assertTrue(MfgExchangeRate::find($active)->isActive);
        $this->assertSame(1, MfgExchangeRate::count());
    }

    public function test_validacion_de_la_tasa(): void
    {
        $this->postJson('/api/manufacturing/exchange-rates', ['rate' => 0])->assertStatus(422);
        $this->postJson('/api/manufacturing/exchange-rates', ['rate' => 100000000])->assertStatus(422);
        $this->postJson('/api/manufacturing/exchange-rates', ['rate' => 4000, 'currency' => 'US'])->assertStatus(422);
        $this->postJson('/api/manufacturing/exchange-rates', ['rate' => 4000, 'currency' => 'U1D'])->assertStatus(422);
        $this->assertSame(0, MfgExchangeRate::count());
    }
}
