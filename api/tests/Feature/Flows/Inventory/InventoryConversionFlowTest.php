<?php

namespace Tests\Feature\Flows\Inventory;

use App\Models\InputVariantMovement;
use App\Models\InventoryConversion;
use App\Models\TemplateRecipe;
use App\Models\VariantMovement;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\ActsAsRoles;
use Tests\Feature\Flows\Inventory\Concerns\BuildsInventoryData;
use Tests\TestCase;

/**
 * Caracterización: conversiones de insumos a productos
 * (InventoryConversionController). DRAFT → PENDING → APPROVED (o CANCELLED).
 */
class InventoryConversionFlowTest extends TestCase
{
    use ActsAsRoles, BuildsInventoryData, RefreshDatabase;

    private const CONVERSION_STRUCTURE = [
        'id', 'conversionNumber', 'conversionType', 'templateId', 'templateVariantId', 'status',
        'conversionDate', 'createdById', 'createdByName', 'approvedById', 'approvedByName', 'approvedAt',
        'description', 'notes',
        'inputItems' => [[
            'id', 'inputVariantId', 'inputCode', 'inputName', 'variantSku', 'colorName', 'sizeName',
            'unitOfMeasure', 'unitCost', 'quantity', 'totalCost', 'availableStock', 'notes',
        ]],
        'outputItems' => [[
            'id', 'variantId', 'productName', 'variantSku', 'colorName', 'sizeName', 'unitPrice',
            'quantity', 'totalValue', 'notes',
        ]],
        'totalInputCost', 'totalOutputCost', 'createdAt', 'updatedAt',
    ];

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRolesAndUsers();
        $this->actingAsAdmin();
    }

    public function test_conversion_manual_completa_consumo_y_produccion(): void
    {
        $admin = $this->userByEmail('admin@vexa.com');
        $year = date('Y');
        ['input' => $input, 'variant' => $iv] = $this->makeVariantInput(10, 5000);
        $product = $this->makeProduct(['name' => 'Camiseta estampada', 'basePrice' => 30000, 'stock' => 0]);
        $pv = $this->makeProductVariant($product, 2, ['priceAdjustment' => 2000]);
        $other = $this->makeProductVariant($product, 3);

        $res = $this->postJson('/api/inventory-conversions', ['description' => 'Lote junio']);
        $res->assertStatus(201)
            ->assertJsonPath('data.conversionNumber', "CONV-{$year}-0001")
            ->assertJsonPath('data.conversionType', 'MANUAL')
            ->assertJsonPath('data.status', 'DRAFT')
            ->assertJsonPath('data.createdById', $admin->id)
            ->assertJsonPath('data.totalInputCost', 0);
        $id = $res->json('data.id');

        $this->postJson("/api/inventory-conversions/{$id}/input-items", ['inputVariantId' => $iv->id, 'quantity' => 11])
            ->assertStatus(400)->assertJsonPath('message', "Stock insuficiente de Camiseta base ({$iv->sku}). Disponible: 10 unidad");

        $this->postJson("/api/inventory-conversions/{$id}/input-items", ['inputVariantId' => $iv->id, 'quantity' => 4])
            ->assertStatus(201)
            ->assertJsonPath('data.inputItems.0.totalCost', 20000)
            ->assertJsonPath('data.inputItems.0.availableStock', 10)
            ->assertJsonPath('data.totalInputCost', 20000);
        $this->postJson("/api/inventory-conversions/{$id}/input-items", ['inputVariantId' => $iv->id, 'quantity' => 1])
            ->assertStatus(400)->assertJsonPath('message', 'Esta variante de insumo ya está agregada a la conversión');

        $this->postJson("/api/inventory-conversions/{$id}/output-items", ['variantId' => $pv->id, 'quantity' => 4])
            ->assertStatus(201)
            // unitPrice = basePrice + priceAdjustment
            ->assertJsonPath('data.outputItems.0.unitPrice', 32000)
            ->assertJsonPath('data.totalOutputCost', 128000)
            ->assertJsonStructure(['data' => array_merge(self::CONVERSION_STRUCTURE, ['template'])]);

        $this->postJson("/api/inventory-conversions/{$id}/submit")->assertOk()->assertJsonPath('data.status', 'PENDING');
        // En PENDING ya no se puede editar.
        $this->postJson("/api/inventory-conversions/{$id}/output-items", ['variantId' => $other->id, 'quantity' => 1])
            ->assertStatus(400)->assertJsonPath('message', 'Solo se pueden modificar conversiones en borrador');

        $this->postJson("/api/inventory-conversions/{$id}/approve")->assertOk()
            ->assertJsonPath('data.status', 'APPROVED')
            ->assertJsonPath('data.approvedById', $admin->id);

        // Consumo de insumo: variante baja 4, movimiento SALIDA con cantidad negativa.
        $this->assertEquals(6, $iv->fresh()->currentStock);
        $mi = InputVariantMovement::sole();
        $this->assertSame('SALIDA', $mi->movementType);
        $this->assertEquals(-4, $mi->quantity);
        $this->assertEquals(10, $mi->previousStock);
        $this->assertEquals(6, $mi->newStock);
        $this->assertSame('conversion', $mi->referenceType);
        $this->assertEquals($id, $mi->referenceId);
        $this->assertSame("Conversión a producto CONV-{$year}-0001", $mi->reason);
        // ACTUAL (posible bug): inputs.currentStock (total del insumo) no se recalcula al
        // consumir la variante (InventoryConversionController.php:572-594).
        $this->assertEquals(10, $input->fresh()->currentStock);
        // El costo del insumo no cambia.
        $this->assertEquals(5000, $iv->fresh()->unitCost);

        // Producción: variante de producto sube 4, movimiento PURCHASE, products.stock = suma de variantes.
        $this->assertSame(6, (int) $pv->fresh()->stock);
        $mo = VariantMovement::sole();
        $this->assertSame('PURCHASE', $mo->movementType);
        $this->assertEquals(4, $mo->quantity);
        $this->assertEquals(2, $mo->previousStock);
        $this->assertEquals(6, $mo->newStock);
        $this->assertSame('conversion', $mo->referenceType);
        $this->assertSame(9, (int) $product->fresh()->stock);
    }

    public function test_doble_aprobacion_responde_400_y_no_duplica_movimientos(): void
    {
        ['variant' => $iv] = $this->makeVariantInput(10);
        $pv = $this->makeProductVariant($this->makeProduct(), 0);
        $id = $this->postJson('/api/inventory-conversions')->json('data.id');
        $this->postJson("/api/inventory-conversions/{$id}/input-items", ['inputVariantId' => $iv->id, 'quantity' => 3])->assertStatus(201);
        $this->postJson("/api/inventory-conversions/{$id}/output-items", ['variantId' => $pv->id, 'quantity' => 3])->assertStatus(201);
        $this->postJson("/api/inventory-conversions/{$id}/submit")->assertOk();

        $this->postJson("/api/inventory-conversions/{$id}/approve")->assertOk();
        $this->postJson("/api/inventory-conversions/{$id}/approve")->assertStatus(400)
            ->assertJsonPath('message', 'Solo se pueden aprobar conversiones pendientes');

        $this->assertEquals(7, $iv->fresh()->currentStock);
        $this->assertSame(3, (int) $pv->fresh()->stock);
        $this->assertSame(1, InputVariantMovement::count());
        $this->assertSame(1, VariantMovement::count());
        $this->postJson("/api/inventory-conversions/{$id}/cancel")->assertStatus(400)
            ->assertJsonPath('message', 'No se pueden cancelar conversiones aprobadas');
    }

    public function test_aprobar_revalida_stock_si_bajo_despues_de_enviar(): void
    {
        ['variant' => $iv] = $this->makeVariantInput(10);
        $pv = $this->makeProductVariant($this->makeProduct(), 0);
        $id = $this->postJson('/api/inventory-conversions')->json('data.id');
        $this->postJson("/api/inventory-conversions/{$id}/input-items", ['inputVariantId' => $iv->id, 'quantity' => 8])->assertStatus(201);
        $this->postJson("/api/inventory-conversions/{$id}/output-items", ['variantId' => $pv->id, 'quantity' => 1])->assertStatus(201);
        $this->postJson("/api/inventory-conversions/{$id}/submit")->assertOk();

        $iv->update(['currentStock' => 5]);
        $this->postJson("/api/inventory-conversions/{$id}/approve")->assertStatus(400);
        $this->assertSame('PENDING', InventoryConversion::find($id)->status);
        $this->assertEquals(5, $iv->fresh()->currentStock);
        $this->assertSame(0, VariantMovement::count());
    }

    public function test_enviar_exige_insumos_y_productos(): void
    {
        ['variant' => $iv] = $this->makeVariantInput(10);
        $id = $this->postJson('/api/inventory-conversions')->json('data.id');
        $this->postJson("/api/inventory-conversions/{$id}/submit")->assertStatus(400)
            ->assertJsonPath('message', 'Debe agregar al menos un insumo a consumir');
        $this->postJson("/api/inventory-conversions/{$id}/input-items", ['inputVariantId' => $iv->id, 'quantity' => 1])->assertStatus(201);
        $this->postJson("/api/inventory-conversions/{$id}/submit")->assertStatus(400)
            ->assertJsonPath('message', 'Debe agregar al menos un producto a generar');
        $this->postJson("/api/inventory-conversions/{$id}/approve")->assertStatus(400);
    }

    public function test_editar_y_quitar_items_recalcula_totales(): void
    {
        ['variant' => $iv] = $this->makeVariantInput(10, 1000);
        $pv = $this->makeProductVariant($this->makeProduct(['basePrice' => 500]), 0);
        $id = $this->postJson('/api/inventory-conversions')->json('data.id');
        $inItem = $this->postJson("/api/inventory-conversions/{$id}/input-items", ['inputVariantId' => $iv->id, 'quantity' => 2])
            ->json('data.inputItems.0.id');
        $outItem = $this->postJson("/api/inventory-conversions/{$id}/output-items", ['variantId' => $pv->id, 'quantity' => 2])
            ->json('data.outputItems.0.id');

        $this->patchJson("/api/inventory-conversions/{$id}/input-items/{$inItem}", ['quantity' => 5])
            ->assertOk()->assertJsonPath('data.totalInputCost', 5000);
        $this->patchJson("/api/inventory-conversions/{$id}/input-items/{$inItem}", ['quantity' => 50])->assertStatus(400);
        $this->patchJson("/api/inventory-conversions/{$id}/output-items/{$outItem}", ['quantity' => 3])
            ->assertOk()->assertJsonPath('data.totalOutputCost', 1500);

        $this->deleteJson("/api/inventory-conversions/{$id}/input-items/{$inItem}")->assertOk()
            ->assertJsonPath('data.totalInputCost', 0)->assertJsonCount(0, 'data.inputItems');
        $this->deleteJson("/api/inventory-conversions/{$id}/output-items/{$outItem}")->assertOk()
            ->assertJsonPath('data.totalOutputCost', 0);
    }

    public function test_conversion_desde_plantilla_y_aprobacion(): void
    {
        $year = date('Y');
        ['input' => $input, 'variant' => $iv] = $this->makeVariantInput(20, 4000, 'BASE');
        $template = $this->makeProduct(['name' => 'Plantilla Camiseta', 'isTemplate' => true]);
        $tv = $this->makeProductVariant($template, 0, ['sku' => 'TPL-1']);
        TemplateRecipe::create(['variantId' => $tv->id, 'inputVariantId' => $iv->id, 'quantity' => 2]);
        $product = $this->makeProduct(['name' => 'Camiseta Final', 'basePrice' => 25000]);
        $out = $this->makeProductVariant($product, 1);

        // Requiere 3 × 2 = 6 del insumo.
        $res = $this->postJson('/api/inventory-conversions/from-template', [
            'templateVariantId' => $tv->id, 'outputVariantId' => $out->id, 'quantity' => 3,
        ]);
        $res->assertStatus(201)
            ->assertJsonStructure(['data' => self::CONVERSION_STRUCTURE + ['template' => ['id', 'name', 'sku']]])
            ->assertJsonPath('data.conversionNumber', "CONV-{$year}-0001")
            ->assertJsonPath('data.conversionType', 'TEMPLATE')
            ->assertJsonPath('data.status', 'DRAFT')
            ->assertJsonPath('data.templateId', $template->id)
            ->assertJsonPath('data.templateVariantId', $tv->id)
            ->assertJsonPath('data.description', 'Conversión de plantilla: Plantilla Camiseta')
            ->assertJsonPath('data.inputItems.0.quantity', 6)
            ->assertJsonPath('data.inputItems.0.totalCost', 24000)
            ->assertJsonPath('data.inputItems.0.notes', 'Insumo para 3 unidades de Plantilla Camiseta')
            ->assertJsonPath('data.outputItems.0.quantity', 3)
            ->assertJsonPath('data.outputItems.0.unitPrice', 25000)
            ->assertJsonPath('data.outputItems.0.notes', 'Generado desde plantilla TPL-1')
            ->assertJsonPath('data.totalInputCost', 24000)
            ->assertJsonPath('data.totalOutputCost', 75000);
        $id = $res->json('data.id');

        // Nace en DRAFT: hay que enviarla y aprobarla para mover stock.
        $this->assertEquals(20, $iv->fresh()->currentStock);
        $this->postJson("/api/inventory-conversions/{$id}/submit")->assertOk();
        $this->postJson("/api/inventory-conversions/{$id}/approve")->assertOk();

        $this->assertEquals(14, $iv->fresh()->currentStock);
        $this->assertSame(4, (int) $out->fresh()->stock);
        $this->assertSame(4, (int) $product->fresh()->stock);
        // ACTUAL: el stock de la plantilla no cambia y el total del insumo tampoco.
        $this->assertSame(0, (int) $tv->fresh()->stock);
        $this->assertEquals(20, $input->fresh()->currentStock);
    }

    public function test_desde_plantilla_valida_plantilla_receta_y_stock(): void
    {
        ['variant' => $iv] = $this->makeVariantInput(5);
        $noTemplate = $this->makeProductVariant($this->makeProduct(['isTemplate' => false]), 0);
        $template = $this->makeProduct(['isTemplate' => true]);
        $tvSinReceta = $this->makeProductVariant($template, 0);
        $tv = $this->makeProductVariant($template, 0);
        TemplateRecipe::create(['variantId' => $tv->id, 'inputVariantId' => $iv->id, 'quantity' => 2]);
        $out = $this->makeProductVariant($this->makeProduct(), 0);

        $this->postJson('/api/inventory-conversions/from-template', [])->assertStatus(422)
            ->assertJsonValidationErrors(['templateVariantId', 'outputVariantId', 'quantity']);
        $this->postJson('/api/inventory-conversions/from-template', ['templateVariantId' => 9999, 'outputVariantId' => $out->id, 'quantity' => 1])
            ->assertStatus(404)->assertJsonPath('message', 'Variante de plantilla no encontrada');
        $this->postJson('/api/inventory-conversions/from-template', ['templateVariantId' => $noTemplate->id, 'outputVariantId' => $out->id, 'quantity' => 1])
            ->assertStatus(400)->assertJsonPath('message', 'La variante no pertenece a una plantilla');
        $this->postJson('/api/inventory-conversions/from-template', ['templateVariantId' => $tvSinReceta->id, 'outputVariantId' => $out->id, 'quantity' => 1])
            ->assertStatus(400)->assertJsonPath('message', 'La variante de plantilla no tiene recetas asociadas');
        $this->postJson('/api/inventory-conversions/from-template', ['templateVariantId' => $tv->id, 'outputVariantId' => 9999, 'quantity' => 1])
            ->assertStatus(404)->assertJsonPath('message', 'Variante de producto no encontrada');
        $this->postJson('/api/inventory-conversions/from-template', ['templateVariantId' => $tv->id, 'outputVariantId' => $out->id, 'quantity' => 3])
            ->assertStatus(400)->assertJsonPath('message', "Stock insuficiente de Camiseta base ({$iv->sku}). Disponible: 5, Requerido: 6");
        $this->assertSame(0, InventoryConversion::count());
    }

    public function test_cancelar_borrar_listado_y_estadisticas(): void
    {
        $id1 = $this->postJson('/api/inventory-conversions')->json('data.id');
        $id2 = $this->postJson('/api/inventory-conversions', ['conversionType' => 'TEMPLATE'])
            ->assertJsonPath('data.conversionNumber', 'CONV-'.date('Y').'-0002')->json('data.id');

        $this->postJson("/api/inventory-conversions/{$id2}/cancel")->assertOk()->assertJsonPath('data.status', 'CANCELLED');
        $this->getJson('/api/inventory-conversions')->assertOk()->assertJsonCount(2, 'data');
        $this->getJson('/api/inventory-conversions?status=DRAFT')->assertOk()->assertJsonCount(1, 'data');
        $this->getJson("/api/inventory-conversions/{$id1}")->assertOk()->assertJsonPath('data.template', null);
        $this->getJson('/api/inventory-conversions/9999')->assertStatus(404);
        $this->getJson('/api/inventory-conversions/stats')->assertOk()->assertJsonPath('data', [
            'total' => 2,
            'byStatus' => ['DRAFT' => 1, 'PENDING' => 0, 'APPROVED' => 0, 'CANCELLED' => 1],
            'lastConversion' => null,
            'totalInputCost' => 0,
            'totalOutputValue' => 0,
        ]);

        $this->deleteJson("/api/inventory-conversions/{$id1}")->assertOk()->assertJsonPath('message', 'Conversión eliminada exitosamente');
        $this->deleteJson("/api/inventory-conversions/{$id2}")->assertOk();
        $this->assertSame(0, InventoryConversion::count());
    }

    public function test_el_cliente_no_entra_a_conversiones(): void
    {
        $this->actingAsCliente();
        $this->getJson('/api/inventory-conversions')->assertStatus(403);
    }
}
