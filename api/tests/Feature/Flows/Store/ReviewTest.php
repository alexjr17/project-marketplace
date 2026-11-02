<?php

namespace Tests\Feature\Flows\Store;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\Review;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\ActsAsRoles;
use Tests\Feature\Flows\Store\Concerns\StoreFixtures;
use Tests\TestCase;

/**
 * Caracterización de las reseñas: quién puede reseñar (compra válida), crear, editar,
 * votar útil, resumen del producto y la forma del JSON.
 */
class ReviewTest extends TestCase
{
    use ActsAsRoles, RefreshDatabase, StoreFixtures;

    private Product $product;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRolesAndUsers();
        $this->seedStoreCatalog();
        $this->product = $this->makeProduct('Suéter', 58000, [['negro', 'M', 5]]);
    }

    private function purchase(User $user, string $status, ?Product $product = null): Order
    {
        $product ??= $this->product;
        $order = Order::create([
            'orderNumber' => 'ORD-R-'.uniqid(), 'userId' => $user->id, 'subtotal' => 58000, 'total' => 58000,
            'status' => $status, 'paymentMethod' => 'transfer', 'statusHistory' => [],
        ]);
        OrderItem::create([
            'orderId' => $order->id, 'productId' => $product->id, 'productName' => $product->name, 'productImage' => 'img.jpg',
            'size' => 'M', 'color' => '#1A1A1A', 'quantity' => 1, 'unitPrice' => 58000,
        ]);

        return $order;
    }

    private function review(int $rating = 5, string $comment = 'Excelente'): \Illuminate\Testing\TestResponse
    {
        return $this->postJson('/api/reviews', ['productId' => $this->product->id, 'rating' => $rating, 'title' => 'Bueno', 'comment' => $comment]);
    }

    public function test_sin_compra_valida_no_puede_resenar(): void
    {
        $cliente = $this->actingAsCliente();
        $this->purchase($cliente, 'PENDING');
        $this->purchase($cliente, 'CANCELLED');

        $this->getJson("/api/reviews/can-review/{$this->product->id}")->assertOk()->assertExactJson(['success' => true, 'data' => [
            'canReview' => false, 'reason' => 'Debes comprar este producto para poder dejar una reseña',
        ]]);
        $this->review()->assertStatus(400)->assertExactJson([
            'success' => false, 'message' => 'Debes comprar este producto para poder dejar una reseña',
        ]);
    }

    public function test_un_pedido_pagado_ya_permite_resenar(): void
    {
        $cliente = $this->actingAsCliente();
        // ACTUAL: no hace falta que esté entregado; PAID / PROCESSING / SHIPPED también cuentan como compra.
        $this->purchase($cliente, 'PAID');

        $this->getJson("/api/reviews/can-review/{$this->product->id}")->assertOk()->assertExactJson(['success' => true, 'data' => ['canReview' => true]]);
        $this->review()->assertCreated();
    }

    public function test_crear_resena_tras_la_entrega_actualiza_el_rating_del_producto(): void
    {
        $cliente = $this->actingAsCliente();
        $this->purchase($cliente, 'DELIVERED');

        $r = $this->review(4)->assertCreated()->assertJsonPath('message', 'Reseña publicada exitosamente')->json('data');
        $this->assertSame([
            'id', 'userId', 'productId', 'rating', 'title', 'comment', 'verifiedPurchase', 'helpfulCount', 'status',
            'createdAt', 'updatedAt', 'user', 'userVote',
        ], array_keys($r));
        $this->assertSame([4, true, 'APPROVED', 'Cliente Demo', null], [$r['rating'], $r['verifiedPurchase'], $r['status'], $r['user']['name'], $r['userVote']]);
        $this->assertSame(['id', 'name', 'avatar'], array_keys($r['user']));

        $p = $this->product->fresh();
        $this->assertEquals(4.0, $p->rating);
        $this->assertSame(1, $p->reviewsCount);

        // Ya reseñó: no puede repetir.
        $can = $this->getJson("/api/reviews/can-review/{$this->product->id}")->json('data');
        $this->assertSame([false, 'Ya has dejado una reseña para este producto', $r['id']], [$can['canReview'], $can['reason'], $can['existingReview']['id']]);
        $this->review()->assertStatus(400)->assertJsonPath('message', 'Ya has dejado una reseña para este producto');

        // Validación.
        $this->postJson('/api/reviews', ['productId' => $this->product->id, 'rating' => 6, 'comment' => 'x'])->assertStatus(422);
        $this->postJson('/api/reviews', ['productId' => $this->product->id, 'rating' => 3])->assertStatus(422);
    }

    public function test_resumen_y_listado_publico(): void
    {
        $users = [$this->actingAsCliente(), $this->otroCliente('a@vexa.test'), $this->otroCliente('b@vexa.test')];
        foreach ([[$users[0], 5], [$users[1], 4], [$users[2], 2]] as [$u, $rating]) {
            $this->purchase($u, 'DELIVERED');
            $this->actingAs($u, 'sanctum');
            $this->review($rating)->assertCreated();
        }
        Review::where('rating', 2)->update(['status' => 'REJECTED']);

        $this->getJson("/api/reviews/product/{$this->product->id}/summary")->assertOk()->assertExactJson(['success' => true, 'data' => [
            'averageRating' => 4.5, 'totalReviews' => 2, 'ratingDistribution' => ['1' => 0, '2' => 0, '3' => 0, '4' => 1, '5' => 1],
        ]]);

        $res = $this->getJson("/api/reviews/product/{$this->product->id}?sortBy=lowest&limit=1")->assertOk();
        $res->assertJsonPath('meta', ['total' => 2, 'page' => 1, 'limit' => 1, 'totalPages' => 2])
            ->assertJsonPath('pagination.total', 2)
            ->assertJsonPath('summary.totalReviews', 2)
            ->assertJsonPath('data.0.rating', 4);
        $this->getJson("/api/reviews/product/{$this->product->id}?rating=5")->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/reviews/product/99999')->assertNotFound()->assertJsonPath('message', 'Producto no encontrado');

        // ACTUAL (posible bug): el detalle público por id devuelve también reseñas rechazadas.
        $rejected = Review::where('status', 'REJECTED')->value('id');
        $this->getJson("/api/reviews/{$rejected}")->assertOk()->assertJsonPath('data.status', 'REJECTED');
    }

    public function test_votar_util(): void
    {
        $autor = $this->actingAsCliente();
        $this->purchase($autor, 'DELIVERED');
        $id = $this->review()->json('data.id');

        $this->postJson("/api/reviews/{$id}/vote", ['isHelpful' => true])->assertStatus(400)
            ->assertJsonPath('message', 'No puedes votar tu propia reseña');

        $votante = $this->otroCliente();
        $this->actingAs($votante, 'sanctum');
        $this->postJson("/api/reviews/{$id}/vote", ['isHelpful' => true])->assertOk()->assertExactJson(['success' => true, 'data' => ['helpfulCount' => 1]]);
        // Cambiar el voto actualiza (no duplica).
        $this->postJson("/api/reviews/{$id}/vote", ['isHelpful' => false])->assertOk()->assertJsonPath('data.helpfulCount', 0);
        $this->postJson("/api/reviews/{$id}/vote", ['isHelpful' => true])->assertOk()->assertJsonPath('data.helpfulCount', 1);

        // El listado muestra el voto del usuario autenticado (auth opcional).
        $this->getJson("/api/reviews/product/{$this->product->id}")->assertOk()->assertJsonPath('data.0.userVote', true);
        $this->getJson("/api/reviews/{$id}")->assertOk()->assertJsonPath('data.helpfulCount', 1)->assertJsonPath('data.userVote', true);

        $this->deleteJson("/api/reviews/{$id}/vote")->assertOk()->assertJsonPath('data.helpfulCount', 0);
        $this->postJson('/api/reviews/99999/vote', ['isHelpful' => true])->assertNotFound();
        // ACTUAL: quitar el voto de una reseña inexistente responde 200 con 0.
        $this->deleteJson('/api/reviews/99999/vote')->assertOk()->assertJsonPath('data.helpfulCount', 0);
    }

    public function test_editar_y_eliminar_solo_el_autor(): void
    {
        $autor = $this->actingAsCliente();
        $this->purchase($autor, 'DELIVERED');
        $id = $this->review(5)->json('data.id');

        $this->putJson("/api/reviews/{$id}", ['rating' => 3, 'comment' => null])->assertOk()
            ->assertJsonPath('message', 'Reseña actualizada exitosamente')
            ->assertJsonPath('data.rating', 3)
            ->assertJsonPath('data.comment', 'Excelente'); // null no pisa
        $this->assertEquals(3.0, $this->product->fresh()->rating);

        $this->actingAs($this->otroCliente(), 'sanctum');
        $this->putJson("/api/reviews/{$id}", ['rating' => 1])->assertForbidden()->assertJsonPath('message', 'No puedes editar esta reseña');
        $this->deleteJson("/api/reviews/{$id}")->assertForbidden()->assertJsonPath('message', 'No puedes eliminar esta reseña');

        $this->actingAs($autor, 'sanctum');
        $this->getJson('/api/reviews/my/all')->assertOk()->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.product.name', 'Suéter');
        $this->deleteJson("/api/reviews/{$id}")->assertOk()->assertJsonPath('message', 'Reseña eliminada exitosamente');
        $p = $this->product->fresh();
        $this->assertEquals(0, $p->rating);
        $this->assertSame(0, $p->reviewsCount);
    }

    public function test_productos_pendientes_por_resenar(): void
    {
        $cliente = $this->actingAsCliente();
        $otro = $this->makeProduct('Tote', 25000, [[null, null, 5]], ['category' => 'accesorios']);
        $this->purchase($cliente, 'DELIVERED');
        $this->purchase($cliente, 'SHIPPED');
        $this->purchase($cliente, 'PAID', $otro);
        $this->purchase($cliente, 'PENDING', $this->makeProduct('Gorra', 1000));

        $pending = $this->getJson('/api/reviews/pending/products')->assertOk()->json('data');
        $this->assertSame([$this->product->id, $otro->id], array_column($pending, 'productId'));
        $this->assertSame(['productId', 'productName', 'productImage', 'orderId', 'orderNumber', 'purchaseDate'], array_keys($pending[0]));

        $this->review()->assertCreated();
        $this->assertSame([$otro->id], array_column($this->getJson('/api/reviews/pending/products')->json('data'), 'productId'));
    }
}
