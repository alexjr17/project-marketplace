<?php

namespace Tests\Feature\Security;

use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\ActsAsRoles;
use Tests\TestCase;

/** Un cliente solo puede ver sus propios pedidos en /orders/my. */
class OrdersOwnershipTest extends TestCase
{
    use ActsAsRoles, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRolesAndUsers();
    }

    private function orderFor(User $user, string $number): Order
    {
        return Order::create([
            'orderNumber' => $number,
            'userId' => $user->id,
            'subtotal' => 10000,
            'total' => 10000,
            'paymentMethod' => 'transfer',
            'statusHistory' => [],
        ]);
    }

    public function test_mis_pedidos_solo_devuelve_los_del_usuario_autenticado(): void
    {
        $otro = $this->otroCliente();
        $this->orderFor($otro, 'ORD-AJENO-1');
        $cliente = $this->actingAsCliente();
        $this->orderFor($cliente, 'ORD-PROPIO-1');

        $this->getJson('/api/orders/my')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.orderNumber', 'ORD-PROPIO-1');
    }

    public function test_no_se_puede_pedir_los_pedidos_de_otro_usuario_por_query(): void
    {
        $otro = $this->otroCliente();
        $this->orderFor($otro, 'ORD-AJENO-1');
        $this->actingAsCliente();

        $this->getJson('/api/orders/my?userId=' . $otro->id)
            ->assertOk()
            ->assertJsonCount(0, 'data');
    }

    public function test_userId_cero_no_quita_el_filtro(): void
    {
        $otro = $this->otroCliente();
        $this->orderFor($otro, 'ORD-AJENO-1');
        $this->actingAsCliente();

        $this->getJson('/api/orders/my?userId=0')
            ->assertOk()
            ->assertJsonCount(0, 'data');
    }

    public function test_el_limite_de_la_pagina_tiene_tope(): void
    {
        $this->actingAsCliente();

        $this->getJson('/api/orders/my?limit=100000')
            ->assertOk()
            ->assertJsonPath('meta.limit', 100);
    }

    public function test_detalle_de_pedido_ajeno_no_se_entrega(): void
    {
        $otro = $this->otroCliente();
        $ajeno = $this->orderFor($otro, 'ORD-AJENO-1');
        $this->actingAsCliente();

        $this->getJson('/api/orders/my/' . $ajeno->id)->assertStatus(404);
    }
}
