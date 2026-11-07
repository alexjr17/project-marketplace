<?php

namespace Tests\Feature\Services;

use App\Models\CartItem;
use App\Models\Input;
use App\Models\InputBatch;
use App\Models\Order;
use App\Services\Inventory\InputBatchService;
use App\Services\Orders\CartService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\ActsAsRoles;
use Tests\Feature\Flows\Store\Concerns\StoreFixtures;
use Tests\TestCase;

/**
 * Servicios de la ola 3 (inventario, carrito y pedidos): products.stock al día con los
 * movimientos de pedidos, sincronización tolerante del carrito, pago con Wompi solo de
 * pedidos pendientes propios y stock del insumo = suma de sus lotes.
 */
class InventoryAndOrdersServicesTest extends TestCase
{
    use ActsAsRoles, RefreshDatabase, StoreFixtures;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRolesAndUsers();
        $this->seedStoreCatalog();
    }

    public function test_crear_y_cancelar_un_pedido_mantiene_products_stock_con_la_suma_de_variantes(): void
    {
        $this->actingAsCliente();
        $p = $this->makeProduct('Suéter', 50000, [['negro', 'M', 5], ['negro', 'L', 2]], ['stock' => 7]);

        $order = $this->postJson('/api/orders', $this->orderPayload([$this->item($p, 'negro', 'M', 3)]))
            ->assertCreated()->json('data');
        $this->assertSame(4, (int) $p->fresh()->stock); // 2 + 2

        $this->postJson("/api/orders/my/{$order['id']}/cancel")->assertOk();
        $this->assertSame(7, (int) $p->fresh()->stock);
        $this->assertSame(5, $this->variantOf($p, 'negro', 'M')->stock);
    }

    public function test_checkout_de_wompi_solo_para_pedidos_propios_pendientes_de_wompi(): void
    {
        $this->actingAsCliente();
        $p = $this->makeProduct('Gorra', 30000, [['negro', 'M', 5]]);
        $transfer = $this->postJson('/api/orders', $this->orderPayload([$this->item($p, 'negro', 'M', 1)]))->json('data');

        $this->postJson("/api/orders/my/{$transfer['id']}/wompi-checkout")
            ->assertStatus(409)->assertJsonPath('message', 'El pedido no es de pago con Wompi');
        $this->postJson('/api/orders/my/99999/wompi-checkout')
            ->assertStatus(404)->assertJsonPath('message', 'Orden no encontrada');

        Order::whereKey($transfer['id'])->update(['paymentMethod' => 'wompi', 'status' => 'CANCELLED']);
        $this->postJson("/api/orders/my/{$transfer['id']}/wompi-checkout")
            ->assertStatus(409)->assertJsonPath('message', 'El pedido no está pendiente de pago');

        // Pedido de otro usuario: 404, como si no existiera.
        $this->actingAs($this->otroCliente(), 'sanctum');
        $this->postJson("/api/orders/my/{$transfer['id']}/wompi-checkout")->assertStatus(404);
        $this->getJson("/api/payments/order/{$transfer['id']}")->assertStatus(404)
            ->assertJsonPath('message', 'Pedido no encontrado');
    }

    public function test_sincronizar_omite_productos_que_ya_no_existen_y_no_valida_stock(): void
    {
        $this->actingAsCliente();
        $p = $this->makeProduct('Suéter', 58000, [['negro', 'M', 1]]);
        $v = $this->variantOf($p, 'negro', 'M');

        $items = app(CartService::class)->sync($this->userByEmail('cliente@vexa.com')->id, [
            ['productId' => $p->id, 'variantId' => $v->id, 'quantity' => 4, 'price' => 1],
            ['productId' => 99999, 'quantity' => 1, 'price' => 1],
        ]);

        $this->assertCount(1, $items);
        $this->assertSame(1, CartItem::count());
        // La línea queda guardada aunque supere el stock: se muestra marcada sin stock.
        $this->assertSame([4, 1, false], [$items[0]['quantity'], $items[0]['availableStock'], $items[0]['hasStock']]);
    }

    public function test_el_stock_del_insumo_es_la_suma_de_sus_lotes_activos(): void
    {
        $this->actingAsAdmin();
        $type = \App\Models\InputType::create(['name' => 'Tela', 'slug' => 'tela-svc', 'hasVariants' => false]);
        $input = Input::create(['code' => 'TELA-1', 'name' => 'Tela', 'inputTypeId' => $type->id, 'unitOfMeasure' => 'm', 'unitCost' => 1000, 'currentStock' => 0]);
        $batches = app(InputBatchService::class);
        $userId = $this->userByEmail('admin@vexa.com')->id;

        $a = $batches->create($input->id, ['batchNumber' => 'A', 'initialQuantity' => 10, 'unitCost' => 1000], $userId);
        $batches->create($input->id, ['batchNumber' => 'B', 'initialQuantity' => 5, 'unitCost' => 1200], $userId);
        $this->assertEquals(15, $input->fresh()->currentStock);

        $batches->reserve($a->id, 4, 1, $userId);
        $this->assertEquals(11, $input->fresh()->currentStock);
        $batches->output($a->id, 4, 9, $userId);
        $this->assertEquals(11, $input->fresh()->currentStock);
        $this->assertEquals(0, InputBatch::find($a->id)->reservedQuantity);

        $batches->update($a->id, ['isActive' => false]);
        $this->assertEquals(5, $input->fresh()->currentStock);
    }
}
