<?php

namespace Tests\Feature\Flows\Inventory;

use App\Models\Input;
use App\Models\InputColor;
use App\Models\InputType;
use App\Models\InputTypeSize;
use App\Models\InputVariant;
use App\Models\InputVariantMovement;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\ActsAsRoles;
use Tests\Feature\Flows\Inventory\Concerns\BuildsInventoryData;
use Tests\TestCase;

/**
 * Caracterización: tipos de insumo, insumos simples y con variantes
 * (InputTypeController / InputController).
 */
class InputFlowTest extends TestCase
{
    use ActsAsRoles, BuildsInventoryData, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRolesAndUsers();
        $this->actingAsAdmin();
    }

    // ==================== TIPOS DE INSUMO ====================

    public function test_crear_tipo_de_insumo_genera_slug_y_tallas(): void
    {
        $s = $this->makeSize('S', 1);
        $m = $this->makeSize('M', 2);

        $res = $this->postJson('/api/input-types', [
            'name' => 'Prenda Base Nueva',
            'hasVariants' => true,
            'sizeIds' => [$s->id, $m->id],
        ]);

        $res->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('message', 'Tipo de insumo creado')
            ->assertJsonPath('data.slug', 'prenda-base-nueva')
            ->assertJsonPath('data.hasVariants', true)
            ->assertJsonPath('data.isActive', true)
            ->assertJsonCount(2, 'data.inputTypeSizes')
            ->assertJsonStructure(['data' => ['id', 'name', 'slug', 'sortOrder', 'hasVariants', 'inputTypeSizes' => [['sizeId', 'size']]]]);
    }

    public function test_actualizar_tipo_reemplaza_las_tallas_y_borrar_es_logico(): void
    {
        $s = $this->makeSize('S', 1);
        $m = $this->makeSize('M', 2);
        $type = $this->makeInputType(true, [$s]);

        $this->putJson("/api/input-types/{$type->id}", ['sizeIds' => [$m->id]])
            ->assertOk()->assertJsonCount(1, 'data.inputTypeSizes')
            ->assertJsonPath('data.inputTypeSizes.0.sizeId', $m->id);

        $this->deleteJson("/api/input-types/{$type->id}")->assertOk();
        $this->assertFalse((bool) InputType::find($type->id)->isActive);
        $ids = collect($this->getJson('/api/input-types')->json('data'))->pluck('id');
        $this->assertNotContains($type->id, $ids);
        // El registro y sus tallas siguen en la base.
        $this->assertSame(1, InputTypeSize::where('inputTypeId', $type->id)->count());
    }

    public function test_tipo_inexistente_responde_404(): void
    {
        $this->getJson('/api/input-types/9999')->assertStatus(404)
            ->assertJson(['success' => false, 'message' => 'Tipo de insumo no encontrado']);
    }

    // ==================== INSUMO SIMPLE ====================

    public function test_crear_insumo_simple_nace_con_stock_cero_y_forma_json(): void
    {
        $type = $this->makeInputType();

        $res = $this->postJson('/api/inputs', [
            'code' => 'INS-100',
            'name' => 'Cinta térmica',
            'inputTypeId' => $type->id,
            'unitOfMeasure' => 'metro',
            'unitCost' => 350,
            'minStock' => 10,
        ]);

        $res->assertStatus(201)
            ->assertJsonPath('message', 'Insumo creado')
            ->assertJsonPath('data.code', 'INS-100')
            ->assertJsonPath('data.isActive', true)
            ->assertJsonPath('data._count', ['batches' => 0, 'movements' => 0, 'zoneInputs' => 0, 'variants' => 0])
            ->assertJsonStructure(['success', 'message', 'data' => [
                'id', 'code', 'name', 'description', 'inputTypeId', 'unitOfMeasure', 'unitCost',
                'currentStock', 'minStock', 'maxStock', 'supplier', 'supplierCode', 'notes', 'isActive',
                'inputType', 'inputColors', 'inputSizes', 'variants', 'batches', '_count',
            ]]);

        $input = Input::where('code', 'INS-100')->first();
        $this->assertEquals(0, $input->currentStock);
        $this->assertEquals(350, $input->unitCost);
        $this->assertEquals(10, $input->minStock);
        $this->assertEquals(0, $input->maxStock);
        $this->assertSame(0, InputVariant::where('inputId', $input->id)->count());
    }

    public function test_crear_insumo_valida_campos_y_codigo_duplicado(): void
    {
        $this->postJson('/api/inputs', [])->assertStatus(422)
            ->assertJsonValidationErrors(['code', 'name', 'inputTypeId', 'unitOfMeasure', 'unitCost']);

        $type = $this->makeInputType();
        $this->postJson('/api/inputs', [
            'code' => 'X', 'name' => 'X', 'inputTypeId' => $type->id, 'unitOfMeasure' => 'u', 'unitCost' => -1,
        ])->assertStatus(422)->assertJsonValidationErrors(['unitCost']);

        $this->makeInput(['code' => 'DUP-1']);
        $this->postJson('/api/inputs', [
            'code' => 'DUP-1', 'name' => 'X', 'inputTypeId' => $type->id, 'unitOfMeasure' => 'u', 'unitCost' => 1,
        ])->assertStatus(400)->assertJson(['success' => false, 'message' => 'Ya existe un insumo con este código']);
    }

    public function test_actualizar_insumo_ignora_nulos_y_borrar_es_logico(): void
    {
        $input = $this->makeInput(['code' => 'UPD-1', 'name' => 'Original', 'unitCost' => 100]);

        $this->putJson("/api/inputs/{$input->id}", ['name' => 'Nuevo', 'unitCost' => null])
            ->assertOk()->assertJsonPath('data.name', 'Nuevo');
        $this->assertEquals(100, $input->fresh()->unitCost);

        $this->deleteJson("/api/inputs/{$input->id}")->assertOk()->assertJsonPath('message', 'Insumo eliminado');
        $this->assertFalse((bool) $input->fresh()->isActive);
        $this->assertNotContains($input->id, collect($this->getJson('/api/inputs')->json('data'))->pluck('id'));
        // show sigue devolviendo el insumo inactivo.
        $this->getJson("/api/inputs/{$input->id}")->assertOk()->assertJsonPath('data.isActive', false);
    }

    public function test_listado_filtra_por_tipo_busqueda_y_bajo_stock(): void
    {
        $t1 = $this->makeInputType();
        $t2 = $this->makeInputType();
        $a = $this->makeInput(['code' => 'AAA-1', 'name' => 'Bolsa', 'inputTypeId' => $t1->id, 'currentStock' => 5, 'minStock' => 10]);
        $b = $this->makeInput(['code' => 'BBB-1', 'name' => 'Caja', 'inputTypeId' => $t2->id, 'currentStock' => 50, 'minStock' => 10]);

        $this->assertEquals([$a->id], collect($this->getJson("/api/inputs?inputTypeId={$t1->id}")->json('data'))->pluck('id')->all());
        $this->assertEquals([$b->id], collect($this->getJson('/api/inputs?search=Caja')->json('data'))->pluck('id')->all());
        $this->assertEquals([$a->id], collect($this->getJson('/api/inputs?lowStock=true')->json('data'))->pluck('id')->all());
        $this->assertEquals([$a->id], collect($this->getJson('/api/inputs/low-stock')->json('data'))->pluck('id')->all());
    }

    public function test_recalcular_stock_suma_solo_lotes_activos(): void
    {
        $input = $this->makeInput(['currentStock' => 999]);
        $this->makeBatch($input, 10, 100, 'L-1');
        $this->makeBatch($input, 5.5, 100, 'L-2');
        $this->makeBatch($input, 100, 100, 'L-3')->update(['isActive' => false]);

        $this->postJson("/api/inputs/{$input->id}/recalculate-stock")->assertOk()
            ->assertJsonPath('message', 'Stock recalculado');
        $this->assertEquals(15.5, $input->fresh()->currentStock);
    }

    // ==================== INSUMO CON VARIANTES ====================

    public function test_crear_insumo_con_colores_y_tallas_genera_matriz_de_variantes(): void
    {
        $negro = $this->makeColor('Negro', '#000');
        $blanco = $this->makeColor('Blanco', '#fff');
        $s = $this->makeSize('S', 1);
        $m = $this->makeSize('M', 2);
        $type = $this->makeInputType(true, [$s, $m], 'Prenda');

        $res = $this->postJson('/api/inputs', [
            'code' => 'CAM', 'name' => 'Camiseta', 'inputTypeId' => $type->id,
            'unitOfMeasure' => 'unidad', 'unitCost' => 8000,
            'colorIds' => [$negro->id, $blanco->id], 'sizeIds' => [$s->id, $m->id],
        ]);

        $res->assertStatus(201)
            ->assertJsonCount(4, 'data.variants')
            ->assertJsonCount(2, 'data.inputColors')
            ->assertJsonPath('data._count.variants', 4)
            ->assertJsonStructure(['data' => ['variants' => [['id', 'sku', 'colorId', 'sizeId', 'unitCost', 'currentStock', 'color', 'size']]]]);

        $input = Input::where('code', 'CAM')->first();
        // SKU = {code}-{colorId}-{abreviatura de talla}
        $this->assertEqualsCanonicalizing([
            "CAM-{$negro->id}-M", "CAM-{$negro->id}-S", "CAM-{$blanco->id}-M", "CAM-{$blanco->id}-S",
        ], InputVariant::where('inputId', $input->id)->pluck('sku')->all());
        foreach (InputVariant::where('inputId', $input->id)->get() as $v) {
            $this->assertEquals(8000, $v->unitCost);
            $this->assertEquals(0, $v->currentStock);
        }
        // ACTUAL (posible bug): store() crea InputColor pero NO crea InputSize aunque reciba sizeIds
        // (InputController.php:152-171), así que inputSizes queda vacío.
        $res->assertJsonCount(0, 'data.inputSizes');
    }

    public function test_crear_insumo_solo_con_colores_no_genera_variantes(): void
    {
        $c = $this->makeColor('Rojo', '#f00');
        $type = $this->makeInputType(true);

        $this->postJson('/api/inputs', [
            'code' => 'SOLO-COLOR', 'name' => 'X', 'inputTypeId' => $type->id,
            'unitOfMeasure' => 'u', 'unitCost' => 1, 'colorIds' => [$c->id],
        ])->assertStatus(201)->assertJsonCount(0, 'data.variants')->assertJsonCount(1, 'data.inputColors');
    }

    public function test_agregar_color_genera_variantes_por_las_tallas_del_tipo(): void
    {
        $s = $this->makeSize('S', 1);
        $m = $this->makeSize('M', 2);
        $type = $this->makeInputType(true, [$s, $m]);
        $input = $this->makeInput(['code' => 'AC', 'inputTypeId' => $type->id, 'unitCost' => 700]);
        $c = $this->makeColor('Azul', '#00f');

        $this->postJson("/api/inputs/{$input->id}/colors", ['colorId' => $c->id])
            ->assertOk()->assertJsonPath('message', 'Color agregado')->assertJsonCount(2, 'data.variants');
        $this->assertEqualsCanonicalizing(
            ["AC-{$c->id}-S", "AC-{$c->id}-M"],
            InputVariant::where('inputId', $input->id)->pluck('sku')->all()
        );

        $this->postJson("/api/inputs/{$input->id}/colors", ['colorId' => $c->id])
            ->assertStatus(400)->assertJsonPath('message', 'El color ya está asignado a este insumo');
    }

    public function test_agregar_color_o_talla_a_tipo_sin_variantes_responde_400(): void
    {
        $input = $this->makeInput();
        $c = $this->makeColor();
        $s = $this->makeSize();

        $this->postJson("/api/inputs/{$input->id}/colors", ['colorId' => $c->id])
            ->assertStatus(400)->assertJsonPath('message', 'Este tipo de insumo no soporta variantes');
        $this->postJson("/api/inputs/{$input->id}/sizes", ['sizeId' => $s->id])
            ->assertStatus(400)->assertJsonPath('message', 'Este tipo de insumo no soporta variantes');
    }

    public function test_agregar_talla_genera_una_variante_por_color_del_insumo(): void
    {
        $type = $this->makeInputType(true);
        $input = $this->makeInput(['code' => 'AT', 'inputTypeId' => $type->id]);
        $c1 = $this->makeColor('C1', '#111');
        $c2 = $this->makeColor('C2', '#222');
        InputColor::create(['inputId' => $input->id, 'colorId' => $c1->id]);
        InputColor::create(['inputId' => $input->id, 'colorId' => $c2->id]);
        $xl = $this->makeSize('XL', 5);

        $this->postJson("/api/inputs/{$input->id}/sizes", ['sizeId' => $xl->id])
            ->assertOk()->assertJsonCount(2, 'data.variants')->assertJsonCount(1, 'data.inputSizes');

        $this->postJson("/api/inputs/{$input->id}/sizes", ['sizeId' => $xl->id])
            ->assertStatus(400)->assertJsonPath('message', 'La talla ya está asignada a este insumo');
        $this->postJson("/api/inputs/{$input->id}/sizes", ['sizeId' => 9999])
            ->assertStatus(404)->assertJsonPath('message', 'Talla no encontrada');
    }

    public function test_quitar_color_o_talla_con_stock_lo_impide_y_sin_stock_borra_variantes(): void
    {
        ['input' => $input, 'variant' => $variant, 'color' => $color, 'size' => $size] = $this->makeVariantInput(3);

        $this->deleteJson("/api/inputs/{$input->id}/colors/{$color->id}")
            ->assertStatus(400)->assertJsonPath('message', 'No se puede eliminar el color porque hay variantes con stock');
        $this->deleteJson("/api/inputs/{$input->id}/sizes/{$size->id}")
            ->assertStatus(400)->assertJsonPath('message', 'No se puede eliminar la talla porque hay variantes con stock');

        $variant->update(['currentStock' => 0]);
        $this->deleteJson("/api/inputs/{$input->id}/colors/{$color->id}")->assertOk();
        $this->assertNull(InputVariant::find($variant->id));
        $this->assertSame(0, InputColor::where('inputId', $input->id)->count());
    }

    public function test_regenerar_variantes_crea_solo_las_que_faltan(): void
    {
        $s = $this->makeSize('S', 1);
        $m = $this->makeSize('M', 2);
        $type = $this->makeInputType(true, [$s, $m]);
        $input = $this->makeInput(['code' => 'RG', 'inputTypeId' => $type->id]);
        $c = $this->makeColor('Verde', '#0f0');
        InputColor::create(['inputId' => $input->id, 'colorId' => $c->id]);
        InputVariant::create(['inputId' => $input->id, 'colorId' => $c->id, 'sizeId' => $s->id, 'sku' => 'RG-EXISTE', 'unitCost' => 1]);

        $this->postJson("/api/inputs/{$input->id}/regenerate-variants")->assertOk()
            ->assertJsonPath('message', 'Variantes regeneradas');
        $this->assertEqualsCanonicalizing(['RG-EXISTE', "RG-{$c->id}-M"], InputVariant::where('inputId', $input->id)->pluck('sku')->all());

        $simple = $this->makeInput();
        $this->postJson("/api/inputs/{$simple->id}/regenerate-variants")->assertStatus(400);
    }

    public function test_stock_de_variante_suma_y_resta_sin_movimiento_ni_recalculo_del_insumo(): void
    {
        ['input' => $input, 'variant' => $variant] = $this->makeVariantInput(0);

        $this->postJson("/api/inputs/variants/{$variant->id}/stock", ['quantity' => 10, 'operation' => 'add'])
            ->assertOk()->assertJsonPath('message', 'Stock actualizado');
        $this->assertEquals(10, $variant->fresh()->currentStock);

        $this->postJson("/api/inputs/variants/{$variant->id}/stock", ['quantity' => 4, 'operation' => 'subtract'])->assertOk();
        $this->assertEquals(6, $variant->fresh()->currentStock);

        $this->postJson("/api/inputs/variants/{$variant->id}/stock", ['quantity' => 7, 'operation' => 'subtract'])
            ->assertStatus(400)->assertJsonPath('message', 'Stock insuficiente');
        $this->assertEquals(6, $variant->fresh()->currentStock);

        $this->postJson("/api/inputs/variants/{$variant->id}/stock", ['quantity' => 1, 'operation' => 'otra'])
            ->assertStatus(422);

        // ACTUAL (posible bug): el cambio manual de stock de variante no deja movimiento
        // ni recalcula inputs.currentStock (InputController.php:374-394).
        $this->assertSame(0, InputVariantMovement::count());
        $this->assertEquals(0, $input->fresh()->currentStock);
        $this->getJson("/api/inputs/variants/{$variant->id}/movements")->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_actualizar_variante_y_consultas_de_variantes(): void
    {
        ['input' => $input, 'variant' => $variant] = $this->makeVariantInput(2);

        $this->putJson("/api/inputs/variants/{$variant->id}", ['unitCost' => 1234, 'minStock' => 3])
            ->assertOk()->assertJsonPath('message', 'Variante actualizada')
            ->assertJsonStructure(['data' => ['id', 'sku', 'unitCost', 'minStock', 'color', 'size']]);
        $this->assertEquals(1234, $variant->fresh()->unitCost);
        // El costo del insumo padre no cambia.
        $this->assertEquals(5000, $input->fresh()->unitCost);

        $this->getJson("/api/inputs/{$input->id}/variants")->assertOk()->assertJsonCount(1, 'data');
        $this->getJson("/api/inputs/variants/{$variant->id}")->assertOk()
            ->assertJsonStructure(['data' => ['id', 'sku', 'input' => ['id', 'inputType'], 'color', 'size']]);
        $this->getJson('/api/inputs/variants/9999')->assertStatus(404);
        $this->getJson('/api/inputs/all-variants')->assertOk()
            ->assertJsonStructure(['data' => [['id', 'sku', 'input' => ['id', 'code', 'name', 'unitOfMeasure', 'isActive'], 'color', 'size']]]);
    }

    public function test_el_cliente_no_entra_a_insumos(): void
    {
        $this->actingAsCliente();
        $this->getJson('/api/inputs')->assertStatus(403);
        $this->postJson('/api/inputs', [])->assertStatus(403);
    }
}
