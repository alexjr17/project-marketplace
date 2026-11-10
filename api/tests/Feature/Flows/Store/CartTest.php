<?php

namespace Tests\Feature\Flows\Store;

use App\Models\CartItem;
use App\Models\Discount;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\ActsAsRoles;
use Tests\Feature\Flows\Store\Concerns\StoreFixtures;
use Tests\TestCase;

/**
 * Caracterización del carrito del usuario: agregar (suma la misma combinación),
 * actualizar, quitar, vaciar, sincronizar y la forma del JSON con stock.
 */
class CartTest extends TestCase
{
    use ActsAsRoles, RefreshDatabase, StoreFixtures;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRolesAndUsers();
        $this->seedStoreCatalog();
    }

    public function test_el_carrito_exige_sesion(): void
    {
        $this->getJson('/api/cart')->assertUnauthorized();
    }

    public function test_carrito_vacio(): void
    {
        $this->actingAsCliente();
        $this->getJson('/api/cart')->assertOk()->assertExactJson(['success' => true, 'items' => []]);
    }

    public function test_agregar_suma_la_misma_combinacion_y_muestra_stock(): void
    {
        $this->actingAsCliente();
        $p = $this->makeProduct('Suéter', 58000, [['negro', 'M', 3]]);
        $v = $this->variantOf($p, 'negro', 'M');

        $first = $this->postJson('/api/cart/items', ['productId' => $p->id, 'variantId' => $v->id, 'quantity' => 2, 'unitPrice' => 1])
            ->assertCreated()->assertJsonPath('success', true)->json('item');
        // Misma combinación: suma cantidad (sigue respondiendo 201).
        $this->postJson('/api/cart/items', ['productId' => $p->id, 'variantId' => $v->id, 'quantity' => 1, 'unitPrice' => 1])
            ->assertCreated()->assertJsonPath('item.id', $first['id'])->assertJsonPath('item.quantity', 3);
        $this->assertSame(1, CartItem::count());
        // Corregido: la línea no puede superar el stock (3); antes se aceptaba cualquier cantidad.
        $this->postJson('/api/cart/items', ['productId' => $p->id, 'variantId' => $v->id, 'quantity' => 1, 'unitPrice' => 1])
            ->assertStatus(400)->assertJsonPath('message', 'Stock insuficiente. Disponible: 3');
        $this->assertSame(3, CartItem::sole()->quantity);

        $item = $this->getJson('/api/cart')->assertOk()->json('items.0');
        $this->assertSame([
            'id', 'productId', 'variantId', 'isCustomized', 'customization', 'quantity', 'unitPrice', 'pricing',
            'availableStock', 'hasStock', 'product', 'variant',
        ], array_keys($item));
        // El precio mostrado es el del producto (no el que mandó el cliente).
        $this->assertEquals(58000, $item['unitPrice']);
        $this->assertSame([3, 3, true], [$item['quantity'], $item['availableStock'], $item['hasStock']]);
        $this->assertSame(['id', 'name', 'description', 'images', 'basePrice', 'salePrice', 'hasDiscount'], array_keys($item['product']));
        $this->assertSame(['id', 'colorName', 'colorHex', 'sizeName', 'sizeAbbreviation'], array_keys($item['variant']));
        $this->assertSame(['Negro', 'M'], [$item['variant']['colorName'], $item['variant']['sizeAbbreviation']]);

        // Corregido: un producto que no existe (o inactivo) o una variante ajena responden 404.
        $this->postJson('/api/cart/items', ['productId' => 99999, 'quantity' => 1, 'unitPrice' => 0])
            ->assertStatus(404)->assertJsonPath('message', 'Producto no encontrado');
        $otro = $this->makeProduct('Otro', 1000, [['negro', 'M', 5]]);
        $this->postJson('/api/cart/items', ['productId' => $p->id, 'variantId' => $this->variantOf($otro, 'negro', 'M')->id, 'quantity' => 1, 'unitPrice' => 0])
            ->assertStatus(404)->assertJsonPath('message', 'Variante no encontrada');
        $sinStock = $this->makeProduct('Agotado', 1000, [['negro', 'M', 0]]);
        $this->postJson('/api/cart/items', ['productId' => $sinStock->id, 'variantId' => $this->variantOf($sinStock, 'negro', 'M')->id, 'quantity' => 1, 'unitPrice' => 0])
            ->assertStatus(400)->assertJsonPath('message', 'Producto sin stock');
        $this->assertSame(1, CartItem::count());
    }

    public function test_el_carrito_refleja_la_oferta_automatica_vigente(): void
    {
        $this->actingAsCliente();
        $p = $this->makeProduct('Suéter', 50000, [['negro', 'M', 3]]);
        Discount::create(['isAuto' => true, 'type' => 'percent', 'value' => 20, 'appliesTo' => 'all']);
        $this->postJson('/api/cart/items', ['productId' => $p->id, 'variantId' => $this->variantOf($p, 'negro', 'M')->id, 'quantity' => 1, 'unitPrice' => 50000]);

        $item = $this->getJson('/api/cart')->json('items.0');
        $this->assertEquals(40000, $item['unitPrice']);
        $this->assertEquals(40000, $item['product']['salePrice']);
        $this->assertTrue($item['product']['hasDiscount']);
    }

    public function test_personalizados_siempre_se_agregan_como_item_nuevo(): void
    {
        $this->actingAsCliente();
        $custom = ['templateId' => 1, 'selectedColor' => '#1A1A1A', 'selectedSize' => 'M', 'design' => 'logo.png'];

        $this->postJson('/api/cart/items', ['isCustomized' => true, 'customization' => $custom, 'quantity' => 1, 'unitPrice' => 80000])->assertCreated();
        $this->postJson('/api/cart/items', ['isCustomized' => true, 'customization' => $custom, 'quantity' => 1, 'unitPrice' => 80000])->assertCreated();

        $items = $this->getJson('/api/cart')->json('items');
        $this->assertCount(2, $items);
        $this->assertTrue($items[0]['isCustomized']);
        $this->assertSame($custom, $items[0]['customization']);
        $this->assertEquals(80000, $items[0]['unitPrice']); // el personalizado conserva su precio
        $this->assertNull($items[0]['product']);
        $this->assertSame(0, $items[0]['availableStock']); // la plantilla 1 no existe

        $this->patchJson("/api/cart/items/{$items[0]['id']}/customization", ['customization' => ['templateId' => 1, 'design' => 'otro.png'], 'unitPrice' => 85000])
            ->assertOk()->assertJsonPath('item.customization.design', 'otro.png');
    }

    public function test_actualizar_quitar_y_vaciar(): void
    {
        $this->actingAsCliente();
        $p = $this->makeProduct('Tote', 25000, [[null, null, 10]], ['category' => 'accesorios', 'stock' => 10]);
        $id = $this->postJson('/api/cart/items', ['productId' => $p->id, 'variantId' => $this->variantOf($p)->id, 'quantity' => 1, 'unitPrice' => 25000])->json('item.id');
        $id2 = $this->postJson('/api/cart/items', ['productId' => $p->id, 'quantity' => 1, 'unitPrice' => 25000])->json('item.id');
        $this->assertNotSame($id, $id2); // sin variantId es otra combinación

        $this->putJson("/api/cart/items/{$id}", ['quantity' => 5])->assertOk()->assertJsonPath('item.quantity', 5);
        // Cantidad 0 → elimina el ítem.
        $this->putJson("/api/cart/items/{$id2}", ['quantity' => 0])->assertOk()->assertExactJson(['success' => true, 'item' => null]);
        $this->assertSame(1, CartItem::count());

        // Corregido: un ítem inexistente (o de otro carrito) responde 404 (antes 500).
        $this->putJson('/api/cart/items/99999', ['quantity' => 1])->assertStatus(404)
            ->assertExactJson(['success' => false, 'message' => 'Item no encontrado en el carrito']);
        $this->deleteJson('/api/cart/items/99999')->assertStatus(404);
        // Subir la cantidad por encima del stock (10) no se permite.
        $this->putJson("/api/cart/items/{$id}", ['quantity' => 11])->assertStatus(400)
            ->assertJsonPath('message', 'Stock insuficiente. Disponible: 10');

        $this->deleteJson("/api/cart/items/{$id}")->assertOk()->assertExactJson(['success' => true, 'message' => 'Item eliminado']);
        $this->postJson('/api/cart/items', ['productId' => $p->id, 'quantity' => 1, 'unitPrice' => 1]);
        $this->deleteJson('/api/cart')->assertOk()->assertExactJson(['success' => true, 'message' => 'Carrito vaciado']);
        $this->getJson('/api/cart')->assertExactJson(['success' => true, 'items' => []]);
    }

    public function test_el_carrito_de_otro_usuario_no_se_toca(): void
    {
        $this->actingAsCliente();
        $p = $this->makeProduct('Tote', 25000, [[null, null, 10]], ['category' => 'accesorios', 'stock' => 10]);
        $id = $this->postJson('/api/cart/items', ['productId' => $p->id, 'quantity' => 1, 'unitPrice' => 1])->json('item.id');

        $this->actingAs($this->otroCliente(), 'sanctum');
        $this->putJson("/api/cart/items/{$id}", ['quantity' => 9])->assertStatus(404);
        $this->getJson('/api/cart')->assertExactJson(['success' => true, 'items' => []]);
        $this->assertSame(1, CartItem::find($id)->quantity);
    }

    public function test_sincronizar_el_carrito_local(): void
    {
        $this->actingAsCliente();
        $p = $this->makeProduct('Suéter', 58000, [['negro', 'M', 3]]);
        $v = $this->variantOf($p, 'negro', 'M');
        $this->postJson('/api/cart/items', ['productId' => $p->id, 'variantId' => $v->id, 'quantity' => 1, 'unitPrice' => 58000]);

        $items = $this->postJson('/api/cart/sync', ['items' => [
            ['productId' => $p->id, 'variantId' => $v->id, 'quantity' => 2, 'price' => 1],
            ['customization' => ['templateId' => $p->id, 'price' => 99000]],
        ]])->assertOk()->json('items');

        $this->assertCount(2, $items);
        $this->assertSame(3, $items[0]['quantity']); // se sumó al existente
        $this->assertTrue($items[1]['isCustomized']);
        $this->assertSame(1, $items[1]['quantity']);
        $this->assertEquals(99000, $items[1]['unitPrice']);
        $this->assertSame($p->id, $items[1]['productId']); // tomado de customization.templateId

        $this->postJson('/api/cart/sync', [])->assertStatus(422);
    }
}
