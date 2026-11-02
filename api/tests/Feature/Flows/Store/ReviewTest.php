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

    public function test_resenas_destacadas_para_la_portada(): void
    {
        $tote = $this->makeProduct('Tote', 25000, [[null, null, 5]], ['category' => 'accesorios']);
        $oculto = $this->makeProduct('Gorra vieja', 15000, [], ['isActive' => false]);
        $ana = User::create(['email' => 'ana.secreta@vexa.test', 'name' => 'ana maría gómez ruiz', 'passwordHash' => bcrypt('x'), 'roleId' => 2, 'status' => 'ACTIVE']);
        $luis = User::create(['email' => 'luis@vexa.test', 'name' => 'Luis', 'passwordHash' => bcrypt('x'), 'roleId' => 2, 'status' => 'ACTIVE']);
        $cliente = $this->userByEmail('cliente@vexa.com'); // "Cliente Demo"

        $make = fn (User $u, Product $p, int $rating, ?string $comment, string $status = 'APPROVED', int $daysAgo = 0) => Review::create([
            'userId' => $u->id, 'productId' => $p->id, 'rating' => $rating, 'title' => 'T', 'comment' => $comment,
            'status' => $status, 'verifiedPurchase' => true, 'createdAt' => now()->subDays($daysAgo),
        ]);
        $make($cliente, $this->product, 5, 'Me encantó la tela', 'APPROVED', 3);
        $make($ana, $tote, 4, 'Muy buena calidad', 'APPROVED', 1);
        $make($luis, $this->product, 5, 'Llegó rápido', 'APPROVED', 2);
        $otro = fn (string $n) => User::create(['email' => "{$n}@vexa.test", 'name' => 'Otro '.$n, 'passwordHash' => bcrypt('x'), 'roleId' => 2, 'status' => 'ACTIVE']);
        $make($otro('a'), $tote, 3, 'Normal');                          // menos de 4 estrellas
        $make($otro('b'), $this->product, 5, '   ');                    // sin comentario
        $make($otro('c'), $tote, 5, 'Pendiente de moderar', 'PENDING');
        $make($otro('d'), $this->product, 5, 'Rechazada', 'REJECTED');
        $make($otro('e'), $oculto, 5, 'De un producto oculto');         // producto inactivo

        $res = $this->getJson('/api/reviews/featured')->assertOk()->assertJsonPath('success', true);
        $data = $res->json('data');

        // Solo aprobadas, 4-5 estrellas, con comentario y de productos visibles; recientes primero.
        $this->assertSame(['Muy buena calidad', 'Llegó rápido', 'Me encantó la tela'], array_column($data, 'comment'));
        $this->assertSame(['id', 'rating', 'title', 'comment', 'verifiedPurchase', 'createdAt', 'customerName', 'product'], array_keys($data[0]));
        $this->assertSame(['id', 'name', 'image'], array_keys($data[0]['product']));
        $this->assertSame([$tote->id, 'Tote'], [$data[0]['product']['id'], $data[0]['product']['name']]);
        // Nombre de pila + inicial del apellido; nunca el email ni el id del usuario.
        $this->assertSame(['Ana G.', 'Luis', 'Cliente D.'], array_column($data, 'customerName'));
        $this->assertStringNotContainsString('@', $res->getContent());
        $this->assertStringNotContainsString('userId', $res->getContent());

        $this->getJson('/api/reviews/featured?limit=1')->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/reviews/featured?limit=50')->assertStatus(422);
    }
}
