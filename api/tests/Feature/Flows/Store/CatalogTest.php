<?php

namespace Tests\Feature\Flows\Store;

use App\Models\Category;
use App\Models\Discount;
use App\Models\ProductVariant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\ActsAsRoles;
use Tests\Feature\Flows\Store\Concerns\StoreFixtures;
use Tests\TestCase;

/**
 * Catálogo público de la tienda: listado con filtros y paginación, detalle, destacados,
 * por categoría, ofertas, categorías con conteo y los catálogos de atributos.
 * El público (y el cliente) solo ve productos activos que no son plantillas; el equipo con
 * products.view/products.manage sigue viendo los inactivos.
 */
class CatalogTest extends TestCase
{
    use ActsAsRoles, RefreshDatabase, StoreFixtures;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedStoreCatalog();
    }

    private function seedProducts(): array
    {
        return [
            'sueter' => $this->makeProduct('Suéter Rojo', 58000, [['rojo', 'S', 3], ['rojo', 'M', 2], ['negro', 'M', 5]], ['featured' => true]),
            'hoodie' => $this->makeProduct('Hoodie Azul', 90000, [['azul-rey', 'L', 1]], ['category' => 'busos', 'type' => 'hoodie']),
            'tote' => $this->makeProduct('Tote Bag', 25000, [], ['category' => 'accesorios']),
            'inactivo' => $this->makeProduct('Gorra vieja', 15000, [], ['category' => 'accesorios', 'isActive' => false, 'featured' => true]),
            'plantilla' => $this->makeProduct('Plantilla', 70000, [['negro', 'M', 0]], ['isTemplate' => true]),
        ];
    }

    public function test_listado_publico_con_paginacion_y_forma_del_producto(): void
    {
        $p = $this->seedProducts();

        $res = $this->getJson('/api/products?limit=2&sortBy=basePrice&sortOrder=asc')->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('pagination', ['page' => 1, 'limit' => 2, 'total' => 3, 'totalPages' => 2]);

        // El listado público excluye plantillas e inactivos (la gorra inactiva, más barata, no sale).
        $this->assertSame(['Tote Bag', 'Suéter Rojo'], array_column($res->json('data'), 'name'));

        $sueter = collect($this->getJson('/api/products?limit=100')->json('data'))->firstWhere('id', $p['sueter']->id);
        $this->assertSame([
            'id', 'sku', 'slug', 'name', 'description', 'categoryId', 'categorySlug', 'categoryName', 'typeId', 'typeSlug',
            'typeName', 'basePrice', 'discountType', 'discountValue', 'salePrice', 'hasDiscount', 'stock', 'featured',
            'isActive', 'images', 'colors', 'sizes', 'tags', 'rating', 'reviewsCount', 'createdAt', 'updatedAt',
        ], array_keys($sueter));
        $this->assertSame(10, $sueter['stock']); // suma de variantes activas
        $this->assertSame(['none', 0, 58000, false], [$sueter['discountType'], $sueter['discountValue'], $sueter['salePrice'], $sueter['hasDiscount']]);
        $this->assertSame('sueteres', $sueter['categorySlug']);
        $this->assertSame(['front', 'back', 'side', 'extra1', 'extra2'], array_keys($sueter['images']));
        $this->assertCount(2, $sueter['colors']);
        $this->assertSame(['id', 'name', 'slug', 'hexCode', 'image'], array_keys($sueter['colors'][0]));
        $this->assertSame(['id', 'name', 'abbreviation'], array_keys($sueter['sizes'][0]));
        $this->assertNull($sueter['rating']);
    }

    public function test_filtros_del_listado(): void
    {
        $p = $this->seedProducts();
        $names = fn (string $qs) => array_column($this->getJson("/api/products?{$qs}")->assertOk()->json('data'), 'name');

        $this->assertSame(['Hoodie Azul'], $names('category=busos'));
        $this->assertSame(['Hoodie Azul'], $names('type=hoodie'));
        $this->assertSame(['Suéter Rojo'], $names('search=SUÉTER'));
        $this->assertSame(['Tote Bag'], $names('search='.strtolower($p['tote']->sku)));
        $this->assertSame(['Hoodie Azul', 'Suéter Rojo'], $names('minPrice=50000&sortBy=name&sortOrder=asc'));
        $this->assertSame([], $names('maxPrice=20000')); // la única era la gorra inactiva
        $this->assertSame(['Suéter Rojo'], $names('color=negro'));
        $this->assertSame(['Hoodie Azul'], $names('size=L'));
        $this->assertSame(['Suéter Rojo'], $names('featured=true&sortBy=name&sortOrder=asc'));
        // El público no puede pedir inactivos: ?isActive=false devuelve vacío.
        $this->assertSame([], $names('isActive=false'));
        $this->assertCount(3, $names('isActive=true'));
        // Categoría o tipo inexistente → lista vacía (antes filtraba por categoryId NULL y
        // devolvía los productos sin categoría).
        $this->makeProduct('Sin categoría', 10000, [], ['categoryId' => null]);
        $this->assertSame([], $names('category=no-existe'));
        $this->assertSame([], $names('type=no-existe'));

        $this->getJson('/api/products?sortBy=precio')->assertStatus(422);
        $this->getJson('/api/products?limit=101')->assertStatus(422);
    }

    public function test_detalle_del_producto(): void
    {
        $p = $this->seedProducts();
        ProductVariant::where('productId', $p['sueter']->id)->where('stock', 5)->update(['isActive' => false]);

        $this->getJson("/api/products/{$p['sueter']->id}")->assertOk()
            ->assertJsonPath('data.name', 'Suéter Rojo')
            ->assertJsonPath('data.stock', 5) // la variante inactiva no suma
            ->assertJsonPath('data.basePrice', 58000);

        // El detalle público no muestra productos inactivos ni plantillas.
        $this->getJson("/api/products/{$p['inactivo']->id}")->assertNotFound()
            ->assertExactJson(['success' => false, 'message' => 'Producto no encontrado']);
        $this->getJson("/api/products/{$p['plantilla']->id}")->assertNotFound();

        $this->getJson('/api/products/99999')->assertNotFound()
            ->assertExactJson(['success' => false, 'message' => 'Producto no encontrado']);
    }

    public function test_descuento_automatico_en_el_precio_de_venta(): void
    {
        $p = $this->seedProducts();
        Discount::create(['isAuto' => true, 'name' => 'Promo suéter', 'type' => 'percent', 'value' => 10, 'appliesTo' => 'product', 'targetIds' => [$p['sueter']->id]]);
        Discount::create(['isAuto' => true, 'name' => 'Promo busos', 'type' => 'fixed', 'value' => 100000, 'appliesTo' => 'category', 'targetIds' => [$p['hoodie']->categoryId]]);
        Discount::create(['isAuto' => true, 'name' => 'Solo POS', 'type' => 'percent', 'value' => 50, 'channel' => 'pos']);
        Discount::create(['isAuto' => true, 'name' => 'Vencida', 'type' => 'percent', 'value' => 50, 'endsAt' => now()->subDay()]);

        $this->getJson("/api/products/{$p['sueter']->id}")->assertOk()
            ->assertJsonPath('data.discountType', 'percent')
            ->assertJsonPath('data.discountValue', 10)
            ->assertJsonPath('data.salePrice', 52200)
            ->assertJsonPath('data.hasDiscount', true);
        // Fijo mayor que el precio: queda en 0 (tope en el precio base).
        $this->getJson("/api/products/{$p['hoodie']->id}")->assertOk()
            ->assertJsonPath('data.salePrice', 0)
            ->assertJsonPath('data.discountType', 'fixed');
        $this->getJson("/api/products/{$p['tote']->id}")->assertOk()->assertJsonPath('data.hasDiscount', false);
    }

    public function test_destacados_por_categoria_categorias_y_tipos(): void
    {
        $this->seedProducts();

        // Destacados: solo activos.
        $this->assertSame(['Suéter Rojo'], array_column($this->getJson('/api/products/featured')->assertOk()->json('data'), 'name'));

        // Por categoría: solo activos; categoría inexistente → lista vacía.
        $this->assertSame(['Tote Bag'], array_column($this->getJson('/api/products/category/accesorios')->assertOk()->json('data'), 'name'));
        // Por categoría tampoco incluye plantillas.
        $this->assertSame(['Suéter Rojo'], collect($this->getJson('/api/products/category/sueteres')->json('data'))->pluck('name')->sort()->values()->all());
        $this->getJson('/api/products/category/no-existe')->assertOk()->assertExactJson(['success' => true, 'data' => []]);

        Category::where('slug', 'blusas')->update(['isActive' => false]);
        $cats = $this->getJson('/api/products/categories')->assertOk()->json('data');
        $this->assertSame(['id', 'name', 'slug'], array_keys($cats[0]));
        $this->assertNotContains('blusas', array_column($cats, 'slug'));
        $this->assertCount(4, $cats);

        $types = $this->getJson('/api/products/types')->assertOk()->json('data');
        $this->assertCount(8, $types);
        $this->assertSame(['id', 'name', 'slug', 'categoryId', 'categorySlug'], array_keys($types[0]));
    }

    public function test_el_panel_sigue_viendo_inactivos_y_el_cliente_no(): void
    {
        $p = $this->seedProducts();
        $this->seedRolesAndUsers();
        $names = fn (string $qs = '') => collect($this->getJson("/api/products?limit=100{$qs}")->assertOk()->json('data'))
            ->pluck('name')->sort()->values()->all();

        // Cliente con sesión (sin products.view): igual que el público.
        $this->actingAsCliente();
        $this->assertSame(['Hoodie Azul', 'Suéter Rojo', 'Tote Bag'], $names());
        $this->getJson("/api/products/{$p['inactivo']->id}")->assertNotFound();

        // Admin (products.view): ve inactivos en la lista y abre su detalle; las plantillas
        // siguen fuera del listado, pero su detalle se puede abrir, como antes.
        $this->actingAsAdmin();
        $this->assertSame(['Gorra vieja', 'Hoodie Azul', 'Suéter Rojo', 'Tote Bag'], $names());
        $this->assertSame(['Gorra vieja'], $names('&isActive=false'));
        $this->getJson("/api/products/{$p['inactivo']->id}")->assertOk()->assertJsonPath('data.isActive', false);
        $this->getJson("/api/products/{$p['plantilla']->id}")->assertOk();
    }

    public function test_filtro_de_ofertas_con_descuentos_automaticos(): void
    {
        $p = $this->seedProducts();
        $names = fn () => collect($this->getJson('/api/products?onSale=1&limit=100')->assertOk()->json('data'))
            ->pluck('name')->sort()->values()->all();

        // Sin descuentos automáticos no hay ofertas.
        $this->assertSame([], $names());

        // Por producto y por categoría; los vencidos, apagados o solo de POS no cuentan.
        Discount::create(['isAuto' => true, 'name' => 'Promo tote', 'type' => 'percent', 'value' => 10, 'appliesTo' => 'product', 'targetIds' => [$p['tote']->id]]);
        Discount::create(['isAuto' => true, 'name' => 'Promo busos', 'type' => 'fixed', 'value' => 5000, 'appliesTo' => 'category', 'targetIds' => [$p['hoodie']->categoryId]]);
        Discount::create(['isAuto' => true, 'name' => 'Vencida', 'type' => 'percent', 'value' => 50, 'appliesTo' => 'product', 'targetIds' => [$p['sueter']->id], 'endsAt' => now()->subDay()]);
        Discount::create(['isAuto' => true, 'name' => 'Solo POS', 'type' => 'percent', 'value' => 50, 'appliesTo' => 'product', 'targetIds' => [$p['sueter']->id], 'channel' => 'pos']);
        Discount::create(['isAuto' => true, 'isActive' => false, 'name' => 'Apagada', 'type' => 'percent', 'value' => 50, 'appliesTo' => 'product', 'targetIds' => [$p['sueter']->id]]);
        $this->assertSame(['Hoodie Azul', 'Tote Bag'], $names());
        $this->assertTrue(collect($this->getJson('/api/products?onSale=1')->json('data'))->every(fn ($x) => $x['hasDiscount'] === true));

        // Un descuento a toda la tienda pone en oferta todo el catálogo visible.
        Discount::create(['isAuto' => true, 'name' => 'Black Friday', 'type' => 'percent', 'value' => 5, 'appliesTo' => 'all']);
        $this->assertSame(['Hoodie Azul', 'Suéter Rojo', 'Tote Bag'], $names());
    }

    public function test_categorias_con_conteo_e_imagen_para_la_portada(): void
    {
        $this->seedProducts();
        $this->makeProduct('Suéter sin foto', 40000, [], ['images' => []]);
        Category::where('slug', 'blusas')->update(['isActive' => false]);

        $cats = collect($this->getJson('/api/catalogs/categories/stats')->assertOk()->json('data'))->keyBy('slug');

        $this->assertSame(['id', 'name', 'slug', 'description', 'productCount', 'image'], array_keys($cats->first()));
        $this->assertFalse($cats->has('blusas')); // solo categorías activas
        // Suéteres: Suéter Rojo + Suéter sin foto (la plantilla no cuenta).
        $this->assertSame(2, $cats['sueteres']['productCount']);
        // Accesorios: Tote Bag (la gorra inactiva no cuenta).
        $this->assertSame(1, $cats['accesorios']['productCount']);
        $this->assertStringStartsWith('https://img.test/', $cats['accesorios']['image']);
        // La imagen sale del primer producto activo con foto (los destacados primero).
        $this->assertSame($this->getJson('/api/products?category=sueteres&featured=true')->json('data.0.images.front'), $cats['sueteres']['image']);
        // Categoría sin productos: conteo 0 e imagen nula.
        $vacia = $cats->first(fn ($c) => $c['productCount'] === 0);
        $this->assertNotNull($vacia);
        $this->assertNull($vacia['image']);
    }

    public function test_catalogos_publicos_de_atributos(): void
    {
        $this->getJson('/api/catalogs/sizes')->assertOk()->assertJsonCount(7, 'data')->assertJsonPath('data.0.abbreviation', 'U');
        $this->getJson('/api/catalogs/colors')->assertOk()->assertJsonCount(16, 'data')->assertJsonPath('data.0.name', 'Azul Marino');
        $this->getJson('/api/catalogs/categories')->assertOk()->assertJsonCount(5, 'data');
        $this->getJson('/api/catalogs/sizes/99999')->assertNotFound()->assertJsonPath('message', 'Talla no encontrada');
        $this->getJson('/api/catalogs/colors/99999')->assertNotFound()->assertJsonPath('message', 'Color no encontrado');
    }
}
