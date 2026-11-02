<?php

namespace Tests\Feature\Services;

use App\Models\Order;
use App\Models\PurchaseOrderItem;
use App\Models\VariantMovement;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\ActsAsRoles;
use Tests\Feature\Flows\Inventory\Concerns\BuildsInventoryData;
use Tests\Feature\Flows\Store\Concerns\StoreFixtures;
use Tests\TestCase;

/** StockService aplicado en el pedido online y en la recepción de compras. */
class StockInFlowsTest extends TestCase
{
    use ActsAsRoles, BuildsInventoryData, RefreshDatabase, StoreFixtures {
        StoreFixtures::makeProduct insteadof BuildsInventoryData;
        BuildsInventoryData::makeProduct as makeInventoryProduct;
    }

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRolesAndUsers();
    }

    public function test_pedido_online_valida_el_total_de_lineas_repetidas(): void
    {
        $this->seedStoreCatalog();
        $this->actingAsCliente();
        $p = $this->makeProduct('Suéter', 58000, [['negro', 'M', 3]]);
        $v = $this->variantOf($p, 'negro', 'M');

        // 2 + 2 con stock 3: antes pasaba y dejaba -1.
        $this->postJson('/api/orders', $this->orderPayload([
            $this->item($p, 'negro', 'M', 2), $this->item($p, 'negro', 'M', 2),
        ]))->assertStatus(400);
        $this->assertSame(3, $v->fresh()->stock);
        $this->assertSame(0, Order::count());

        $this->postJson('/api/orders', $this->orderPayload([
            $this->item($p, 'negro', 'M', 2), $this->item($p, 'negro', 'M', 1),
        ]))->assertCreated();
        $this->assertSame(0, $v->fresh()->stock);
        $this->assertSame(2, VariantMovement::where('variantId', $v->id)->count());
    }

    public function test_recepcion_con_lineas_repetidas_del_mismo_item_valida_lo_pendiente(): void
    {
        $this->actingAsAdmin();
        $variant = $this->makeProductVariant($this->makeInventoryProduct(), 0);
        $supplier = $this->makeSupplier();
        $id = $this->postJson('/api/purchase-orders', [
            'supplierId' => $supplier->id,
            'items' => [['variantId' => $variant->id, 'quantity' => 5, 'unitCost' => 100]],
        ])->json('data.id');
        $this->patchJson("/api/purchase-orders/{$id}/status", ['status' => 'SENT'])->assertOk();
        $this->patchJson("/api/purchase-orders/{$id}/status", ['status' => 'CONFIRMED'])->assertOk();
        $itemId = PurchaseOrderItem::where('purchaseOrderId', $id)->value('id');

        // 3 + 3 de un ítem de 5: se rechaza entero.
        $this->postJson("/api/purchase-orders/{$id}/receive", ['items' => [
            ['itemId' => $itemId, 'quantityReceived' => 3], ['itemId' => $itemId, 'quantityReceived' => 3],
        ]])->assertStatus(400)->assertJsonPath('message', "No se puede recibir más de 5 unidades para el item {$itemId}");
        $this->assertSame(0, $variant->fresh()->stock);

        $this->postJson("/api/purchase-orders/{$id}/receive", ['items' => [
            ['itemId' => $itemId, 'quantityReceived' => 3], ['itemId' => $itemId, 'quantityReceived' => 2],
        ]])->assertOk()->assertJsonPath('data.status', 'RECEIVED');
        $this->assertSame(5, $variant->fresh()->stock);
        $mv = VariantMovement::where('variantId', $variant->id)->orderBy('id')->get();
        $this->assertSame([[3, 0, 3], [2, 3, 5]], $mv->map(fn ($m) => [(int) $m->quantity, (int) $m->previousStock, (int) $m->newStock])->all());
    }
}
