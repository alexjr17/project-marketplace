<?php

namespace Tests\Feature\Flows\Pos;

use App\Models\Category;
use App\Models\Discount;

/**
 * Caracterización de las consultas del POS: scan, search, products,
 * product/{id}/variants y calculate.
 */
class CatalogLookupFlowTest extends PosFlowTestCase
{
    public function test_scan_devuelve_la_variante_con_su_precio_y_stock(): void
    {
        $this->actingAsCajero();
        $a = $this->makeVariant('Camiseta', 50000, 4, [], ['priceAdjustment' => 2500]);

        $this->postJson('/api/pos/scan', ['barcode' => '  '.$a->barcode.' '])
            ->assertOk()
            ->assertJsonStructure(['success', 'data' => [
                'variantId', 'product' => ['id', 'name', 'image'], 'color', 'size', 'sku', 'barcode', 'price', 'stock', 'available',
            ]])
            ->assertJsonPath('data.variantId', $a->id)
            ->assertJsonPath('data.product.name', 'Camiseta')
            ->assertJsonPath('data.product.image', null)
            ->assertJsonPath('data.color', 'N/A')
            ->assertJsonPath('data.size', 'N/A')
            ->assertJsonPath('data.stock', 4)
            ->assertJsonPath('data.available', true);

        $this->assertSame(52500.0, (float) $this->postJson('/api/pos/scan', ['barcode' => $a->barcode])->json('data.price'));
    }

    public function test_scan_errores(): void
    {
        $this->actingAsCajero();
        $empty = $this->makeVariant('Agotado', 1000, 0);

        $this->postJson('/api/pos/scan', ['barcode' => ' '])
            ->assertStatus(400)->assertJsonPath('message', 'El código de barras es requerido');
        $this->postJson('/api/pos/scan', ['barcode' => 'NOEXISTE'])
            ->assertNotFound()->assertJsonPath('message', 'Producto no encontrado');
        $this->postJson('/api/pos/scan', ['barcode' => $empty->barcode])
            ->assertStatus(400)->assertJsonPath('message', 'Producto sin stock disponible');
    }

    public function test_search_por_codigo_exacto_devuelve_single(): void
    {
        $this->actingAsCajero();
        $a = $this->makeVariant('Camiseta', 50000, 0);

        // A diferencia de scan, search no rechaza el stock 0.
        $this->postJson('/api/pos/search', ['query' => $a->barcode])
            ->assertOk()
            ->assertJsonPath('data.type', 'single')
            ->assertJsonPath('data.result.type', 'product')
            ->assertJsonPath('data.result.variantId', $a->id)
            ->assertJsonPath('data.result.stock', 0)
            ->assertJsonPath('data.result.available', false)
            ->assertJsonStructure(['data' => ['type', 'result' => [
                'type', 'variantId', 'productId', 'name', 'image', 'color', 'size', 'sku', 'barcode', 'price', 'stock', 'available',
            ]]]);
    }

    public function test_search_por_nombre_devuelve_lista_de_productos_y_plantillas(): void
    {
        $this->actingAsCajero();
        $this->makeVariant('Camiseta Roja', 50000, 3);
        $this->makeVariant('Camiseta Azul', 40000, 2);
        $this->makeVariant('Pantalón', 90000, 1);
        $this->makeTemplateWithRecipe(70000, 10, 1); // "Plantilla POS"

        $res = $this->postJson('/api/pos/search', ['query' => 'Camiseta'])->assertOk();
        $res->assertJsonPath('data.type', 'list')->assertJsonCount(2, 'data.results')
            ->assertJsonStructure(['data' => ['type', 'results' => [[
                'type', 'variantId', 'productId', 'name', 'image', 'color', 'size', 'sku', 'barcode',
                'price', 'basePrice', 'hasDiscount', 'stock', 'available', 'hasOptions',
            ]]]]);
        $this->assertSame(['product', 'product'], array_column($res->json('data.results'), 'type'));

        $tpl = $this->postJson('/api/pos/search', ['query' => 'Plantilla'])->assertOk();
        $tpl->assertJsonPath('data.type', 'list')
            ->assertJsonPath('data.results.0.type', 'template')
            ->assertJsonStructure(['data' => ['results' => [[
                'type', 'productId', 'templateId', 'name', 'image', 'sku', 'barcode', 'basePrice',
                'zoneTypeImages', 'colors', 'sizes', 'zones',
            ]]]]);

        // El código exacto de una variante de plantilla devuelve la plantilla con scannedVariant.
        [$tv] = $this->makeTemplateWithRecipe(70000, 10, 1);
        $this->postJson('/api/pos/search', ['query' => $tv->barcode])
            ->assertOk()
            ->assertJsonPath('data.type', 'single')
            ->assertJsonPath('data.result.type', 'template')
            ->assertJsonPath('data.result.scannedVariant.variantId', $tv->id);

        $this->postJson('/api/pos/search', ['query' => ''])
            ->assertStatus(400)->assertJsonPath('message', 'El parámetro query es requerido');
        $this->postJson('/api/pos/search', ['query' => 'zzz'])->assertOk()->assertJsonPath('data.results', []);
    }

    public function test_search_y_listado_aplican_oferta_automatica_pos(): void
    {
        $this->actingAsCajero();
        $a = $this->makeVariant('Camiseta Oferta', 50000, 3);
        Discount::create([
            'isAuto' => true, 'name' => 'Todo 10%', 'type' => 'percent', 'value' => 10,
            'appliesTo' => 'all', 'targetIds' => [], 'channel' => 'pos', 'isActive' => true,
        ]);

        $row = $this->postJson('/api/pos/search', ['query' => 'Oferta'])->json('data.results.0');
        $this->assertSame(45000.0, (float) $row['price']);
        $this->assertSame(50000.0, (float) $row['basePrice']);
        $this->assertTrue($row['hasDiscount']);

        // Corregido (fase 3): el código exacto (single) y el escaneo aplican la misma oferta que
        // el listado (antes mostraban 50.000 y la venta cobraba otro precio).
        $single = $this->postJson('/api/pos/search', ['query' => $a->barcode])->json('data.result');
        $this->assertSame(45000.0, (float) $single['price']);
        $this->assertSame(50000.0, (float) $single['basePrice']);
        $this->assertTrue($single['hasDiscount']);
        $this->assertSame(45000.0, (float) $this->postJson('/api/pos/scan', ['barcode' => $a->barcode])->json('data.price'));

        $variants = $this->getJson("/api/pos/product/{$a->productId}/variants")->assertOk();
        $this->assertSame(45000.0, (float) $variants->json('data.0.price'));
    }

    public function test_products_paginado_filtrado_por_tipo_y_por_categorias_de_la_caja(): void
    {
        $user = $this->actingAsCajero();
        $catA = Category::create(['name' => 'Cat A', 'slug' => 'cat-a']);
        $catB = Category::create(['name' => 'Cat B', 'slug' => 'cat-b']);
        $this->makeVariant('Alfa', 1000, 1, ['categoryId' => $catA->id]);
        $this->makeVariant('Beta', 1000, 1, ['categoryId' => $catB->id]);
        $this->makeVariant('Gamma', 1000, 1, ['categoryId' => $catA->id]);
        $this->makeVariant('Inactivo', 1000, 1, ['isActive' => false]);
        $this->makeTemplateWithRecipe(1000, 1, 1);

        $res = $this->getJson('/api/pos/products?perPage=2')->assertOk();
        $res->assertJsonStructure(['data' => ['results', 'page', 'perPage', 'total', 'totalPages']])
            ->assertJsonPath('data.total', 4)
            ->assertJsonPath('data.totalPages', 2)
            ->assertJsonPath('data.perPage', 2)
            ->assertJsonCount(2, 'data.results');
        // Orden por nombre.
        $this->assertSame(['Alfa', 'Beta'], array_column($res->json('data.results'), 'name'));

        $this->getJson('/api/pos/products?type=template')->assertJsonPath('data.total', 1)
            ->assertJsonPath('data.results.0.type', 'template');
        $this->getJson('/api/pos/products?type=product&search=AM')->assertJsonPath('data.total', 1)
            ->assertJsonPath('data.results.0.name', 'Gamma');
        $this->getJson("/api/pos/products?categoryId={$catB->id}")->assertJsonPath('data.total', 1);
        // perPage tiene tope 50 y page mínimo 1.
        $this->getJson('/api/pos/products?perPage=500&page=0')->assertJsonPath('data.perPage', 50)->assertJsonPath('data.page', 1);

        // Con sesión en una caja limitada a la categoría A, solo se ven esos productos.
        $register = $this->makeRegister('CAJA-A', ['categoryIds' => [$catA->id]]);
        $this->openSessionFor($user, $register);
        $this->getJson('/api/pos/products')->assertJsonPath('data.total', 2);
        $names = array_column($this->postJson('/api/pos/search', ['query' => 'a'])->json('data.results'), 'name');
        sort($names);
        $this->assertSame(['Alfa', 'Gamma'], $names);
    }

    public function test_variantes_de_un_producto(): void
    {
        $this->actingAsCajero();
        $a = $this->makeVariant('Camiseta', 50000, 3);

        $this->getJson("/api/pos/product/{$a->productId}/variants")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonStructure(['data' => [[
                'variantId', 'productId', 'name', 'colorName', 'colorHex', 'size', 'sizeName', 'sku',
                'barcode', 'image', 'price', 'basePrice', 'hasDiscount', 'stock', 'available',
            ]]])
            ->assertJsonPath('data.0.stock', 3);

        // Producto inexistente: lista vacía (200), no 404.
        $this->getJson('/api/pos/product/999999/variants')->assertOk()->assertJsonPath('data', []);
    }

    public function test_calculate_totales(): void
    {
        $this->actingAsCajero();
        $a = $this->makeVariant('Camiseta', 50000, 0);
        $b = $this->makeVariant('Gorra', 30000, 0);

        $res = $this->postJson('/api/pos/calculate', [
            'discount' => 1000,
            'items' => [
                ['variantId' => $a->id, 'quantity' => 2, 'price' => 50000, 'discount' => 4000],
                ['variantId' => $b->id, 'quantity' => 1, 'price' => 25000],
            ],
        ])->assertOk();

        $res->assertJsonStructure(['data' => ['subtotal', 'discount', 'tax', 'total', 'items' => [[
            'variantId', 'productName', 'color', 'size', 'quantity', 'unitPrice', 'discount', 'subtotal',
        ]]]]);
        // Corregido (fase 3): el precio unitario lo pone el servidor; los 25.000 enviados para la
        // gorra se ignoran y vale 30.000. El descuento por ítem sí se respeta.
        $this->assertSame(126000.0, (float) $res->json('data.subtotal'));
        $this->assertSame(1000.0, (float) $res->json('data.discount'));
        $this->assertSame(0.0, (float) $res->json('data.tax'));
        $this->assertSame(125000.0, (float) $res->json('data.total'));
        $this->assertSame(96000.0, (float) $res->json('data.items.0.subtotal'));
        // calculate no verifica stock (las variantes tienen 0).
        $this->assertSame(30000.0, (float) $res->json('data.items.1.unitPrice'));

        $this->postJson('/api/pos/calculate', ['items' => [['variantId' => 999999, 'quantity' => 1, 'price' => 1]]])
            ->assertStatus(400)->assertJsonPath('message', 'Variante 999999 no encontrada');
        $this->postJson('/api/pos/calculate', ['discount' => -1, 'items' => []])
            ->assertStatus(422)->assertJsonValidationErrors(['items', 'discount']);
    }
}
