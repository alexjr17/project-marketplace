<?php

namespace Tests\Feature\Flows\Store;

use App\Models\Discount;
use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\ActsAsRoles;
use Tests\Feature\Flows\Store\Concerns\StoreFixtures;
use Tests\TestCase;

/**
 * Caracterización de los cupones: POST /discounts/validate (vigencia, canal, mínimos,
 * límites, alcance, no acumulable con ofertas) y su aplicación en el pedido online.
 */
class CouponTest extends TestCase
{
    use ActsAsRoles, RefreshDatabase, StoreFixtures;

    private Product $sueter;

    private Product $tote;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRolesAndUsers();
        $this->seedStoreCatalog();
        $this->sueter = $this->makeProduct('Suéter', 58000, [['negro', 'M', 20]]);
        $this->tote = $this->makeProduct('Tote', 25000, [[null, null, 20]], ['category' => 'accesorios']);
    }

    private function coupon(array $attrs = []): Discount
    {
        return Discount::create(array_merge(['code' => 'BIENVENIDA', 'name' => 'Bienvenida', 'type' => 'percent', 'value' => 10], $attrs));
    }

    /** Valida con 2 suéteres (116000) + 1 tote (25000) = 141000. */
    private function validateCoupon(string $code, array $extra = []): \Illuminate\Testing\TestResponse
    {
        return $this->postJson('/api/discounts/validate', array_merge([
            'code' => $code,
            'items' => [
                ['productId' => $this->sueter->id, 'price' => 1, 'quantity' => 2], // el precio del front se ignora
                ['productId' => $this->tote->id, 'quantity' => 1],
            ],
        ], $extra));
    }

    public function test_cupon_porcentual_valido_para_invitado(): void
    {
        $this->coupon();

        $this->validateCoupon('  bienvenida ')->assertOk()->assertExactJson([
            'success' => true, 'message' => 'Cupón válido',
            'data' => ['code' => 'BIENVENIDA', 'name' => 'Bienvenida', 'type' => 'percent', 'value' => 10, 'amount' => 14100],
        ]);
    }

    public function test_cupon_fijo_con_tope_en_la_base(): void
    {
        $this->coupon(['code' => 'FIJO', 'type' => 'fixed', 'value' => 5000]);
        $this->coupon(['code' => 'ENORME', 'type' => 'fixed', 'value' => 999999]);

        $this->validateCoupon('FIJO')->assertOk()->assertJsonPath('data.amount', 5000);
        $this->validateCoupon('ENORME')->assertOk()->assertJsonPath('data.amount', 141000);
    }

    public function test_reglas_que_invalidan_el_cupon(): void
    {
        $this->coupon(['code' => 'INACTIVO', 'isActive' => false]);
        $this->coupon(['code' => 'FUTURO', 'startsAt' => now()->addDay()]);
        $this->coupon(['code' => 'VENCIDO', 'endsAt' => now()->subMinute()]);
        $this->coupon(['code' => 'SOLOPOS', 'channel' => 'pos']);
        $this->coupon(['code' => 'SOLOWEB', 'channel' => 'online']);
        $this->coupon(['code' => 'MINIMO', 'minSubtotal' => 200000]);
        $this->coupon(['code' => 'AGOTADO', 'maxUses' => 3, 'usedCount' => 3]);
        $this->coupon(['code' => 'VIP', 'appliesTo' => 'user', 'targetIds' => [999]]);

        $msg = fn (string $code, array $extra = []) => $this->validateCoupon($code, $extra)->assertStatus(422)->json('message');

        $this->assertSame('El cupón no existe o no está activo', $msg('NOEXISTE'));
        $this->assertSame('El cupón no existe o no está activo', $msg('INACTIVO'));
        $this->assertSame('El cupón aún no está vigente', $msg('FUTURO'));
        $this->assertSame('El cupón ya venció', $msg('VENCIDO'));
        $this->assertSame('Este cupón solo es válido en punto de venta', $msg('SOLOPOS'));
        $this->assertSame('Este cupón solo es válido en la tienda online', $msg('SOLOWEB', ['channel' => 'pos']));
        $this->assertSame('El pedido no alcanza el mínimo de compra para este cupón', $msg('MINIMO'));
        $this->assertSame('El cupón alcanzó su límite de usos', $msg('AGOTADO'));
        $this->assertSame('Este cupón no está disponible para tu cuenta', $msg('VIP'));
        $this->postJson('/api/discounts/validate', [])->assertStatus(422)->assertJsonPath('message', 'Error de validación');
    }

    public function test_cupon_de_usuario_solo_para_su_cuenta(): void
    {
        $cliente = $this->actingAsCliente();
        $this->coupon(['code' => 'VIP', 'appliesTo' => 'user', 'targetIds' => [(string) $cliente->id]]);

        $this->validateCoupon('VIP')->assertOk()->assertJsonPath('data.amount', 14100);
    }

    public function test_alcance_por_producto_y_por_categoria(): void
    {
        $this->coupon(['code' => 'PROD', 'appliesTo' => 'product', 'targetIds' => [$this->tote->id]]);
        $this->coupon(['code' => 'CAT', 'appliesTo' => 'category', 'targetIds' => [$this->sueter->categoryId]]);
        $this->coupon(['code' => 'OTRO', 'appliesTo' => 'product', 'targetIds' => [99999]]);

        $this->validateCoupon('PROD')->assertOk()->assertJsonPath('data.amount', 2500);   // 10% de 25000
        $this->validateCoupon('CAT')->assertOk()->assertJsonPath('data.amount', 11600);   // 10% de 116000
        $this->validateCoupon('OTRO')->assertStatus(422)
            ->assertJsonPath('message', 'El cupón no aplica: los productos no califican o ya tienen una oferta (no se acumulan descuentos)');
    }

    public function test_no_se_acumula_con_una_oferta_automatica(): void
    {
        $this->coupon();
        Discount::create(['isAuto' => true, 'type' => 'percent', 'value' => 20, 'appliesTo' => 'product', 'targetIds' => [$this->sueter->id]]);

        // Solo el tote (sin oferta) entra en la base del cupón.
        $this->validateCoupon('BIENVENIDA')->assertOk()->assertJsonPath('data.amount', 2500);
    }

    public function test_sin_items_o_con_producto_desconocido(): void
    {
        $this->coupon();

        // Sin ítems el subtotal es 0 → no aplica.
        $this->postJson('/api/discounts/validate', ['code' => 'BIENVENIDA'])->assertStatus(422);
        // ACTUAL: para un productId que no existe se usa el precio que manda el front.
        $this->postJson('/api/discounts/validate', ['code' => 'BIENVENIDA', 'items' => [['productId' => 99999, 'price' => 50000, 'quantity' => 1]]])
            ->assertOk()->assertJsonPath('data.amount', 5000);
    }

    public function test_el_pedido_aplica_el_cupon_y_registra_el_uso(): void
    {
        $this->actingAsCliente();
        $coupon = $this->coupon(['maxUsesPerUser' => 1]);

        $o = $this->postJson('/api/orders', $this->orderPayload(
            [$this->item($this->sueter, 'negro', 'M', 2), $this->item($this->tote, null, null, 1)],
            ['couponCode' => 'bienvenida']
        ))->assertCreated()->json('data');

        // 141000 ≤ 150000 → envío 12000; descuento 10% de 141000.
        $this->assertSame([141000, 12000, 14100, 138900, 'BIENVENIDA'], [$o['subtotal'], $o['shippingCost'], $o['discount'], $o['total'], $o['couponCode']]);
        $this->assertSame(1, $coupon->fresh()->usedCount);

        // Límite por usuario.
        $this->postJson('/api/orders', $this->orderPayload([$this->item($this->sueter, 'negro', 'M', 1)], ['couponCode' => 'BIENVENIDA']))
            ->assertStatus(400)->assertJsonPath('message', 'Ya usaste este cupón el máximo de veces permitido');

        // Cancelar devuelve el uso y deja volver a usarlo.
        $this->postJson("/api/orders/my/{$o['id']}/cancel")->assertOk();
        $this->assertSame(0, $coupon->fresh()->usedCount);
        $this->postJson('/api/orders', $this->orderPayload([$this->item($this->sueter, 'negro', 'M', 1)], ['couponCode' => 'BIENVENIDA']))
            ->assertCreated()->assertJsonPath('data.discount', 5800);
    }

    public function test_cupon_invalido_en_el_pedido_no_crea_nada(): void
    {
        $this->actingAsCliente();

        $this->postJson('/api/orders', $this->orderPayload([$this->item($this->sueter, 'negro', 'M', 1)], ['couponCode' => 'NOEXISTE']))
            ->assertStatus(400)->assertJsonPath('message', 'El cupón no existe o no está activo');
        $this->assertSame(20, $this->variantOf($this->sueter, 'negro', 'M')->stock);
    }
}
