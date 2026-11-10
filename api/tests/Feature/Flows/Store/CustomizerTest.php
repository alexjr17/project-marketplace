<?php

namespace Tests\Feature\Flows\Store;

use App\Models\Color;
use App\Models\InputVariantMovement;
use App\Models\Product;
use App\Models\Size;
use App\Models\TemplateZone;
use App\Models\VariantMovement;
use App\Models\ZoneType;
use App\Support\TemplateImages;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\Concerns\ActsAsRoles;
use Tests\Feature\Flows\Store\Concerns\StoreFixtures;
use Tests\TestCase;

/**
 * Personalizador: precio = base (con oferta) + precio de cada zona diseñada, el mismo en la
 * cotización, el carrito y el pedido; stock de la plantilla por receta o, sin receta, de la
 * variante; imágenes de plantilla normalizadas y zonas en porcentaje.
 */
class CustomizerTest extends TestCase
{
    use ActsAsRoles, RefreshDatabase, StoreFixtures;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRolesAndUsers();
        $this->seedStoreCatalog();
    }

    private function zone(Product $tpl, string $slug, float $price, array $attrs = []): TemplateZone
    {
        return TemplateZone::create(array_merge([
            'templateId' => $tpl->id,
            'zoneTypeId' => ZoneType::where('slug', $slug)->value('id'),
            'zoneId' => 'zone-'.$slug.'-'.uniqid(),
            'name' => ucfirst($slug),
            'shape' => 'rect',
            'positionX' => 30, 'positionY' => 24, 'maxWidth' => 40, 'maxHeight' => 42,
            'isEditable' => true, 'isRequired' => false, 'isBlocked' => false,
            'price' => $price, 'sortOrder' => 1, 'isActive' => true,
        ], $attrs));
    }

    /** Plantilla Negro/M sin receta (vende del stock de la variante) con zonas frente y espalda. */
    private function template(int $variantStock = 5): array
    {
        $tpl = $this->makeProduct('Suéter Personalizable', 70000, [['negro', 'M', $variantStock]], ['isTemplate' => true]);

        return [$tpl, $this->zone($tpl, 'frente', 8000), $this->zone($tpl, 'espalda', 6000)];
    }

    private function customization(Product $tpl, array $zoneIds, array $extra = []): array
    {
        return array_merge([
            'version' => 2,
            'templateId' => $tpl->id,
            'colorId' => Color::where('slug', 'negro')->value('id'),
            'sizeId' => Size::where('abbreviation', 'M')->value('id'),
            'designs' => array_map(fn ($id) => [
                'id' => 'd'.$id, 'viewSlug' => 'frente', 'templateZoneId' => $id, 'zoneName' => 'Zona',
                'imageData' => 'data:image/png;base64,AAAA', 'position' => ['x' => 50, 'y' => 40],
                'size' => ['width' => 30, 'height' => 30], 'rotation' => 0, 'opacity' => 1,
            ], $zoneIds),
            'previews' => ['frente' => 'data:image/png;base64,BBBB'],
            'customizationPrice' => 1, 'totalPrice' => 1, // lo que mande el cliente no cuenta
        ], $extra);
    }

    // ==================== Cotización ====================

    public function test_la_cotizacion_suma_el_precio_de_cada_zona_una_vez(): void
    {
        [$tpl, $front, $back] = $this->template();

        $res = $this->postJson('/api/customizer/quote', ['templateId' => $tpl->id, 'templateZoneIds' => [$front->id, $back->id, $front->id]])
            ->assertOk()->json('data');

        $this->assertEquals([70000, 14000, 84000], [$res['basePrice'], $res['customizationPrice'], $res['total']]);
        $this->assertSame([$front->id, $back->id], array_column($res['zones'], 'id'));
        $this->assertSame('frente', $res['zones'][0]['zoneTypeSlug']);

        // Sin zonas: solo el precio base.
        $this->postJson('/api/customizer/quote', ['templateId' => $tpl->id, 'templateZoneIds' => []])
            ->assertOk()->assertJsonPath('data.total', 70000);
    }

    public function test_la_cotizacion_rechaza_zonas_ajenas_bloqueadas_o_inactivas(): void
    {
        [$tpl, $front] = $this->template();
        [$otra] = $this->template();
        $ajena = $this->zone($otra, 'frente', 5000);
        $bloqueada = $this->zone($tpl, 'manga-izquierda', 3000, ['isBlocked' => true]);
        $inactiva = $this->zone($tpl, 'manga-derecha', 3000, ['isActive' => false]);

        foreach ([$ajena, $bloqueada, $inactiva] as $z) {
            $this->postJson('/api/customizer/quote', ['templateId' => $tpl->id, 'templateZoneIds' => [$front->id, $z->id]])
                ->assertStatus(422)->assertJsonValidationErrors('templateZoneIds');
        }

        // Producto que no es plantilla, o plantilla inactiva: 404.
        $normal = $this->makeProduct('Camiseta', 30000);
        $this->postJson('/api/customizer/quote', ['templateId' => $normal->id, 'templateZoneIds' => []])->assertNotFound();
        $tpl->update(['isActive' => false]);
        $this->postJson('/api/customizer/quote', ['templateId' => $tpl->id, 'templateZoneIds' => []])->assertNotFound();
    }

    public function test_la_cotizacion_solo_aplica_ofertas_hechas_para_la_plantilla(): void
    {
        [$tpl, $front] = $this->template();
        $body = ['templateId' => $tpl->id, 'templateZoneIds' => [$front->id]];
        // Ofertas de toda la tienda o de la categoría: el producto personalizado no es de catálogo, no aplican.
        \App\Models\Discount::create([
            'name' => 'Oferta 10%', 'type' => 'percent', 'value' => 10, 'isAuto' => true, 'isActive' => true,
            'appliesTo' => 'all', 'channel' => 'online',
        ]);
        \App\Models\Discount::create([
            'name' => 'Oferta categoría 15%', 'type' => 'percent', 'value' => 15, 'isAuto' => true, 'isActive' => true,
            'appliesTo' => 'category', 'targetIds' => [$tpl->categoryId], 'channel' => 'online',
        ]);
        $res = $this->postJson('/api/customizer/quote', $body)->json('data');
        $this->assertEquals([70000, 70000, 8000, 78000], [$res['basePrice'], $res['listPrice'], $res['customizationPrice'], $res['total']]);

        // Una oferta hecha para esa plantilla sí aplica, y la cotización trae el precio de lista para mostrarla.
        \App\Models\Discount::create([
            'name' => 'Oferta plantilla 10%', 'type' => 'percent', 'value' => 10, 'isAuto' => true, 'isActive' => true,
            'appliesTo' => 'product', 'targetIds' => [$tpl->id], 'channel' => 'online',
        ]);
        $res = $this->postJson('/api/customizer/quote', $body)->json('data');
        $this->assertEquals([63000, 70000, 8000, 71000], [$res['basePrice'], $res['listPrice'], $res['customizationPrice'], $res['total']]);
    }

    public function test_la_cotizacion_es_publica_para_todos_los_roles(): void
    {
        [$tpl, $front] = $this->template();
        $body = ['templateId' => $tpl->id, 'templateZoneIds' => [$front->id]];

        $this->postJson('/api/customizer/quote', $body)->assertOk();
        foreach (['actingAsAdmin', 'actingAsVendedor', 'actingAsCajero', 'actingAsCliente'] as $as) {
            $this->{$as}();
            $this->postJson('/api/customizer/quote', $body)->assertOk()->assertJsonPath('data.total', 78000);
        }
    }

    // ==================== Pedido ====================

    public function test_el_pedido_cobra_base_mas_zonas_e_ignora_el_precio_del_cliente(): void
    {
        $this->actingAsCliente();
        [$tpl, $front, $back] = $this->template(5);
        $custom = $this->customization($tpl, [$front->id, $back->id]);

        $o = $this->postJson('/api/orders', $this->orderPayload([[
            'productId' => $tpl->id, 'color' => $this->hex('negro'), 'size' => 'M', 'quantity' => 2,
            'unitPrice' => 1, 'customization' => $custom,
        ]]))->assertCreated()->json('data');

        $this->assertEquals(84000, $o['items'][0]['unitPrice']);
        $this->assertEquals(168000, $o['subtotal']);
        // El ítem guarda la personalización con el precio del servidor.
        $this->assertEquals([14000, 84000], [$o['items'][0]['customization']['customizationPrice'], $o['items'][0]['customization']['totalPrice']]);
        $this->assertSame(2, count($o['items'][0]['customization']['designs']));
    }

    public function test_el_pedido_rechaza_zonas_no_validas_y_variantes_inexistentes(): void
    {
        $this->actingAsCliente();
        [$tpl, $front] = $this->template();
        $bloqueada = $this->zone($tpl, 'bolsillo', 2000, ['isBlocked' => true]);

        $this->postJson('/api/orders', $this->orderPayload([[
            'productId' => $tpl->id, 'color' => $this->hex('negro'), 'size' => 'M', 'quantity' => 1,
            'customization' => $this->customization($tpl, [$bloqueada->id]),
        ]]))->assertStatus(422);

        // Diseño sin zona.
        $sinZona = $this->customization($tpl, [$front->id]);
        unset($sinZona['designs'][0]['templateZoneId']);
        $this->postJson('/api/orders', $this->orderPayload([[
            'productId' => $tpl->id, 'color' => $this->hex('negro'), 'size' => 'M', 'quantity' => 1, 'customization' => $sinZona,
        ]]))->assertStatus(422);

        // Color/talla (por id) que no son una variante de la plantilla.
        $this->postJson('/api/orders', $this->orderPayload([[
            'productId' => $tpl->id, 'color' => $this->hex('negro'), 'size' => 'M', 'quantity' => 1,
            'customization' => $this->customization($tpl, [$front->id], ['sizeId' => Size::where('abbreviation', 'XL')->value('id')]),
        ]]))->assertStatus(422);
        $this->assertSame(0, \App\Models\Order::count());
    }

    public function test_personalizacion_vieja_sin_designs_se_cobra_al_precio_base(): void
    {
        $this->actingAsCliente();
        [$tpl] = $this->template();

        $o = $this->postJson('/api/orders', $this->orderPayload([[
            'productId' => $tpl->id, 'color' => $this->hex('negro'), 'size' => 'M', 'quantity' => 1,
            'customization' => ['designFront' => 'data:image/png;base64,AAAA'],
        ]]))->assertCreated()->json('data');

        $this->assertEquals(70000, $o['items'][0]['unitPrice']);
        $this->assertSame(['designFront' => 'data:image/png;base64,AAAA'], $o['items'][0]['customization']);
    }

    public function test_item_viejo_con_designs_sin_zona_no_es_v2_y_se_cobra_al_precio_base(): void
    {
        $this->actingAsCliente();
        [$tpl] = $this->template();
        $vieja = ['designs' => [['id' => 'd1', 'zoneId' => 'view-frente', 'imageData' => 'data:image/png;base64,AAAA']]];

        $o = $this->postJson('/api/orders', $this->orderPayload([[
            'productId' => $tpl->id, 'color' => $this->hex('negro'), 'size' => 'M', 'quantity' => 1, 'customization' => $vieja,
        ]]))->assertCreated()->json('data');

        $this->assertEquals(70000, $o['items'][0]['unitPrice']);
    }

    // ==================== Stock ====================

    public function test_sin_receta_la_plantilla_vende_del_stock_de_la_variante(): void
    {
        $this->actingAsCliente();
        [$tpl, $front] = $this->template(3);
        $v = $this->variantOf($tpl, 'negro', 'M');

        $this->getJson("/api/template-recipes/variant-stock/{$tpl->id}?colorId={$v->colorId}&sizeId={$v->sizeId}")
            ->assertOk()->assertJsonPath('data.availableStock', 3);

        $line = fn (int $qty) => [
            'productId' => $tpl->id, 'color' => $this->hex('negro'), 'size' => 'M', 'quantity' => $qty,
            'customization' => $this->customization($tpl, [$front->id]),
        ];
        $this->postJson('/api/orders', $this->orderPayload([$line(4)]))->assertStatus(400);

        // Se descuenta de la variante al crear (como un producto normal) …
        $o = $this->postJson('/api/orders', $this->orderPayload([$line(2)]))->assertCreated()->json('data');
        $this->assertSame(1, $v->fresh()->stock);
        $this->assertSame('SALE', VariantMovement::where('variantId', $v->id)->sole()->movementType);

        // … al pagar no se consume ningún insumo ni se vuelve a descontar …
        $this->actingAsVendedor();
        $this->patchJson("/api/orders/{$o['id']}/status", ['status' => 'PAID'])->assertOk();
        $this->assertSame(1, $v->fresh()->stock);
        $this->assertSame(0, InputVariantMovement::count());

        // … y al cancelar vuelve a la variante.
        $this->patchJson("/api/orders/{$o['id']}/status", ['status' => 'CANCELLED'])->assertOk();
        $this->assertSame(3, $v->fresh()->stock);
        $this->assertSame('RETURN', VariantMovement::where('variantId', $v->id)->latest('id')->first()->movementType);
    }

    public function test_con_receta_manda_la_receta_y_no_el_stock_de_la_variante(): void
    {
        $this->actingAsCliente();
        [$tpl, $iv] = $this->makeTemplateWithRecipe(inputStock: 10, recipeQty: 2);
        $v = $this->variantOf($tpl, 'negro', 'M');
        $v->update(['stock' => 50]);

        $this->getJson("/api/template-recipes/variant-stock/{$tpl->id}?colorId={$v->colorId}&sizeId={$v->sizeId}")
            ->assertOk()->assertJsonPath('data.availableStock', 5);

        $o = $this->postJson('/api/orders', $this->orderPayload([$this->item($tpl, 'negro', 'M', 2)]))->assertCreated()->json('data');
        $this->assertSame(50, $v->fresh()->stock); // la variante no se toca
        $this->actingAsVendedor();
        $this->patchJson("/api/orders/{$o['id']}/status", ['status' => 'PAID'])->assertOk();
        $this->assertEquals(6, $iv->fresh()->currentStock);
    }

    // ==================== Carrito ====================

    public function test_el_carrito_usa_el_precio_del_servidor_para_personalizados_v2(): void
    {
        $this->actingAsCliente();
        [$tpl, $front, $back] = $this->template(4);
        $custom = $this->customization($tpl, [$front->id, $back->id]);

        $this->postJson('/api/cart/items', [
            'productId' => $tpl->id, 'isCustomized' => true, 'customization' => $custom, 'quantity' => 1, 'unitPrice' => 1,
        ])->assertCreated()->assertJsonPath('item.unitPrice', 84000);

        $item = $this->getJson('/api/cart')->json('items.0');
        $this->assertEquals(84000, $item['unitPrice']);
        $this->assertSame(4, (int) $item['availableStock']); // variante por colorId/sizeId

        // Editar el diseño a una sola zona recalcula el precio.
        $this->patchJson("/api/cart/items/{$item['id']}/customization", [
            'customization' => $this->customization($tpl, [$front->id]), 'unitPrice' => 1,
        ])->assertOk()->assertJsonPath('item.unitPrice', 78000);
    }

    public function test_el_carrito_aplica_o_quita_la_oferta_al_activarla_o_desactivarla(): void
    {
        $this->actingAsCliente();
        [$tpl, $front] = $this->template();
        $this->postJson('/api/cart/items', [
            'productId' => $tpl->id, 'isCustomized' => true, 'customization' => $this->customization($tpl, [$front->id]), 'quantity' => 1, 'unitPrice' => 1,
        ])->assertCreated();
        $item = $this->getJson('/api/cart')->json('items.0');
        $this->assertEquals(78000, $item['unitPrice']);
        $this->assertEquals(['basePrice' => 70000, 'listPrice' => 70000, 'customizationPrice' => 8000, 'total' => 78000], $item['pricing']);

        // Se activa una oferta para la plantilla: el ítem que ya estaba en el carrito la toma.
        $offer = \App\Models\Discount::create([
            'name' => 'Oferta plantilla 10%', 'type' => 'percent', 'value' => 10, 'isAuto' => true, 'isActive' => true,
            'appliesTo' => 'product', 'targetIds' => [$tpl->id], 'channel' => 'online',
        ]);
        $item = $this->getJson('/api/cart')->json('items.0');
        $this->assertEquals(71000, $item['unitPrice']);
        $this->assertEquals(['basePrice' => 63000, 'listPrice' => 70000, 'customizationPrice' => 8000, 'total' => 71000], $item['pricing']);

        // Se desactiva: vuelve al precio normal.
        $offer->update(['isActive' => false]);
        $item = $this->getJson('/api/cart')->json('items.0');
        $this->assertEquals(78000, $item['unitPrice']);
        $this->assertEquals(70000, $item['pricing']['basePrice']);
    }

    public function test_el_cupon_del_checkout_cuenta_prenda_y_estampado_como_el_pedido(): void
    {
        $this->actingAsCliente();
        [$tpl, $front] = $this->template();
        \App\Models\Discount::create([
            'code' => 'DIEZ', 'name' => 'Diez', 'type' => 'percent', 'value' => 10, 'isAuto' => false, 'isActive' => true,
            'appliesTo' => 'all', 'channel' => 'all',
        ]);
        $custom = $this->customization($tpl, [$front->id]);
        // Vista previa: 10% de 78.000 (prenda 70.000 + frente 8.000), no solo de la prenda.
        $this->postJson('/api/discounts/validate', [
            'code' => 'DIEZ', 'channel' => 'online',
            'items' => [['productId' => $tpl->id, 'price' => 1, 'quantity' => 1, 'customization' => $custom]],
        ])->assertOk()->assertJsonPath('data.amount', 7800);
    }

    // ==================== Plantillas ====================

    public function test_las_imagenes_de_la_plantilla_siempre_llegan_como_objeto(): void
    {
        $this->assertSame(['front' => 'a.png', 'back' => 'b.png', 'side' => ''], TemplateImages::normalize(['a.png', 'b.png']));
        $this->assertSame(['front' => 'f', 'back' => '', 'side' => 's'], TemplateImages::normalize(['front' => 'f', 'side' => 's']));
        $this->assertSame(['front' => '', 'back' => '', 'side' => ''], TemplateImages::normalize(null));

        $tpl = $this->makeProduct('Plantilla Lista', 50000, [['negro', 'M', 0]], ['isTemplate' => true, 'images' => ['x.png', 'y.png']]);
        $this->getJson("/api/templates/{$tpl->id}")->assertOk()
            ->assertJsonPath('data.images', ['front' => 'x.png', 'back' => 'y.png', 'side' => '']);

        // El admin guarda en lista (formato viejo): queda como objeto.
        $this->actingAsAdmin();
        $this->putJson("/api/templates/{$tpl->id}", ['images' => ['n.png']])->assertOk();
        $this->assertSame(['front' => 'n.png', 'back' => '', 'side' => ''], $tpl->fresh()->images);
    }

    public function test_el_maniqui_3d_se_configura_desde_el_admin_y_llega_a_la_tienda(): void
    {
        $tpl = $this->makeProduct('Plantilla 3D', 50000, [['negro', 'M', 0]], ['isTemplate' => true]);

        // Solo quien administra plantillas lo cambia.
        $this->actingAsCliente();
        $this->putJson("/api/templates/{$tpl->id}", ['model3d' => 'basica'])->assertForbidden();

        $this->actingAsAdmin();
        $this->putJson("/api/templates/{$tpl->id}", ['model3d' => 'maniqui-raro'])->assertUnprocessable();
        // Las claves v2 ya no existen: los maniquíes con patrón son ahora 'basica' y 'oversize'.
        $this->putJson("/api/templates/{$tpl->id}", ['model3d' => 'basica_v2'])->assertUnprocessable();
        $this->putJson("/api/templates/{$tpl->id}", ['model3d' => 'oversize'])->assertOk()->assertJsonPath('data.model3d', 'oversize');

        // La tienda (sin sesión) lo recibe en la plantilla y en la lista pública.
        $this->app['auth']->forgetGuards();
        $this->getJson("/api/templates/{$tpl->id}")->assertOk()->assertJsonPath('data.model3d', 'oversize');
        $this->assertContains('oversize', collect($this->getJson('/api/templates/public')->assertOk()->json('data'))->where('id', $tpl->id)->pluck('model3d')->all());

        // Null = editor con fotos.
        $this->actingAsAdmin();
        $this->putJson("/api/templates/{$tpl->id}", ['model3d' => null])->assertOk()->assertJsonPath('data.model3d', null);
    }

    public function test_una_plantilla_inactiva_solo_la_ve_quien_administra_plantillas(): void
    {
        $tpl = $this->makeProduct('Plantilla Oculta', 50000, [['negro', 'M', 0]], ['isTemplate' => true, 'isActive' => false]);

        $this->getJson("/api/templates/{$tpl->id}")->assertNotFound();
        $this->actingAsCliente();
        $this->getJson("/api/templates/{$tpl->id}")->assertNotFound();
        $this->actingAsAdmin();
        $this->getJson("/api/templates/{$tpl->id}")->assertOk();
    }

    public function test_las_escrituras_de_plantillas_y_zonas_siguen_protegidas(): void
    {
        [$tpl, $front] = $this->template();

        $this->putJson("/api/template-zones/{$front->id}", ['price' => 1])->assertUnauthorized();
        $this->actingAsCliente();
        $this->putJson("/api/template-zones/{$front->id}", ['price' => 1])->assertForbidden();
        $this->putJson("/api/templates/{$tpl->id}", ['name' => 'x'])->assertForbidden();
        $this->actingAsCajero();
        $this->putJson("/api/template-zones/{$front->id}", ['price' => 1])->assertForbidden();
        $this->assertEquals(8000, $front->fresh()->price);
    }

    public function test_las_zonas_se_guardan_en_porcentaje_con_decimales(): void
    {
        [$tpl, $front] = $this->template();
        $this->actingAsAdmin();

        $this->putJson("/api/template-zones/{$front->id}", ['positionX' => 12.5, 'maxWidth' => 33.75])->assertOk();
        $fresh = $front->fresh();
        $this->assertSame([12.5, 33.75], [$fresh->positionX, $fresh->maxWidth]);

        $this->putJson("/api/template-zones/{$front->id}", ['positionX' => 250])->assertStatus(422);
    }

    public function test_la_migracion_pasa_las_zonas_en_pixeles_a_porcentaje(): void
    {
        [$tpl, $front, $back] = $this->template();
        DB::table('template_zones')->where('id', $front->id)->update(['positionX' => 110, 'positionY' => 90, 'maxWidth' => 280, 'maxHeight' => 360]);
        DB::table('template_zones')->where('id', $back->id)->update(['positionX' => 20, 'positionY' => 10, 'maxWidth' => 50, 'maxHeight' => 60]);

        $migration = require database_path('migrations/2026_11_02_000004_template_zones_percent_decimals.php');
        $migration->up();
        $migration->up(); // idempotente

        $f = $front->fresh();
        $this->assertSame([22.0, 18.0, 56.0, 72.0], [$f->positionX, $f->positionY, $f->maxWidth, $f->maxHeight]);
        $b = $back->fresh(); // ya estaba en porcentaje: no cambia
        $this->assertSame([20.0, 10.0, 50.0, 60.0], [$b->positionX, $b->positionY, $b->maxWidth, $b->maxHeight]);
        $this->assertTrue(Schema::hasColumn('template_zones', 'positionX'));
    }

    public function test_las_zonas_por_defecto_quedan_dentro_de_la_prenda_y_las_mangas_espejadas(): void
    {
        if (! ZoneType::where('slug', 'manga-izquierda')->exists()) {
            $this->markTestSkipped('Sin tipos de zona de manga en la semilla.');
        }
        $tpl = $this->makeProduct('Plantilla 3D zonas', 50000, [['negro', 'M', 0]], ['isTemplate' => true]);
        DB::table('products')->where('id', $tpl->id)->update(['model3d' => 'basica']);
        $front = $this->zone($tpl, 'frente', 8000, ['positionX' => 36, 'positionY' => 28, 'maxWidth' => 28, 'maxHeight' => 30]);
        $left = $this->zone($tpl, 'manga-izquierda', 4000, ['positionX' => 41, 'positionY' => 29, 'maxWidth' => 9, 'maxHeight' => 9]);
        // Ajustada a mano en el admin: no se toca.
        $back = $this->zone($tpl, 'espalda', 8000, ['positionX' => 30, 'positionY' => 30, 'maxWidth' => 25, 'maxHeight' => 30]);

        $migration = require database_path('migrations/2026_11_09_000001_template_zones_print_defaults.php');
        $migration->up();
        $migration->up(); // idempotente

        $f = $front->fresh();
        $this->assertSame([41.0, 32.0, 18.0, 24.0], [$f->positionX, $f->positionY, $f->maxWidth, $f->maxHeight]);
        $l = $left->fresh(); // espejada respecto a la manga derecha (41 + 10 → 100 - 51 = 49)
        $this->assertSame([49.0, 29.0, 10.0, 10.0], [$l->positionX, $l->positionY, $l->maxWidth, $l->maxHeight]);
        $b = $back->fresh();
        $this->assertSame([30.0, 30.0, 25.0, 30.0], [$b->positionX, $b->positionY, $b->maxWidth, $b->maxHeight]);
    }

    public function test_las_plantillas_con_maniqui_v2_pasan_a_la_clave_original(): void
    {
        $a = $this->makeProduct('Plantilla v2 a', 50000, [['negro', 'M', 0]], ['isTemplate' => true]);
        $b = $this->makeProduct('Plantilla v2 b', 50000, [['negro', 'M', 0]], ['isTemplate' => true]);
        DB::table('products')->where('id', $a->id)->update(['model3d' => 'basica_v2']);
        DB::table('products')->where('id', $b->id)->update(['model3d' => 'oversize_v2']);

        $migration = require database_path('migrations/2026_11_09_000004_templates_model3d_patron_oficial.php');
        $migration->up();
        $migration->up(); // idempotente

        $this->assertSame('basica', DB::table('products')->where('id', $a->id)->value('model3d'));
        $this->assertSame('oversize', DB::table('products')->where('id', $b->id)->value('model3d'));
    }

    public function test_las_zonas_por_defecto_de_los_maniquies_v2_caben_en_su_pieza(): void
    {
        $tpl = $this->makeProduct('Plantilla v2 zonas', 50000, [['negro', 'M', 0]], ['isTemplate' => true]);
        DB::table('products')->where('id', $tpl->id)->update(['model3d' => 'oversize']);
        // Con el valor por defecto anterior (cruzaba la costura de la manga): se actualiza.
        $sleeve = $this->zone($tpl, 'manga-derecha', 4000, ['positionX' => 39.5, 'positionY' => 32, 'maxWidth' => 11, 'maxHeight' => 12]);
        // Ajustada a mano: no se toca.
        $front = $this->zone($tpl, 'frente', 8000, ['positionX' => 30, 'positionY' => 30, 'maxWidth' => 25, 'maxHeight' => 30]);

        $migration = require database_path('migrations/2026_11_09_000003_template_zones_v2_defaults.php');
        $migration->up();
        $migration->up(); // idempotente

        $s = $sleeve->fresh();
        $this->assertSame([43.5, 38.0, 8.5, 8.5], [$s->positionX, $s->positionY, $s->maxWidth, $s->maxHeight]);
        $f = $front->fresh();
        $this->assertSame([30.0, 30.0, 25.0, 30.0], [$f->positionX, $f->positionY, $f->maxWidth, $f->maxHeight]);
    }
}
