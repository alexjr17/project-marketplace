<?php

namespace Tests\Feature\Flows\Pos;

use App\Models\CashRegister;
use App\Models\CashSession;
use App\Models\Order;

/**
 * Caracterización de cajas y sesiones de caja: CRUD de cajas, abrir sesión,
 * mi sesión, cierre (efectivo esperado, diferencia, conteos), listado y reporte.
 */
class CashSessionFlowTest extends PosFlowTestCase
{
    public function test_abrir_sesion_crea_la_sesion_abierta_con_la_forma_esperada(): void
    {
        $user = $this->actingAsCajero();
        $register = $this->makeRegister();

        $res = $this->postJson("/api/cash-registers/{$register->id}/open-session", [
            'initialCash' => 50000,
            'notes' => 'Base del día',
        ]);

        $res->assertCreated()
            ->assertJsonPath('success', true)
            ->assertJsonPath('message', 'Sesión abierta exitosamente')
            ->assertJsonStructure([
                'success', 'message',
                'data' => [
                    'id', 'cashRegisterId', 'sellerId', 'initialCash', 'openedAt', 'status',
                    'notes', 'salesCount', 'totalSales', 'createdAt', 'updatedAt',
                    'cashRegister' => ['id', 'name', 'location', 'code', 'isActive', 'categoryIds'],
                    'seller' => ['id', 'name', 'email'],
                ],
            ])
            ->assertJsonPath('data.status', 'OPEN')
            ->assertJsonPath('data.sellerId', $user->id)
            ->assertJsonPath('data.cashRegisterId', $register->id)
            ->assertJsonPath('data.notes', 'Base del día')
            ->assertJsonPath('data.salesCount', 0);

        $this->assertSame(50000.0, (float) $res->json('data.initialCash'));
        $this->assertSame(1, CashSession::where('status', 'OPEN')->count());
    }

    public function test_abrir_sesion_valida_caja_inexistente_inactiva_y_ya_abierta(): void
    {
        $this->actingAsCajero();
        $register = $this->makeRegister();

        // initialCash es obligatorio.
        $this->postJson("/api/cash-registers/{$register->id}/open-session", [])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['initialCash']);

        $this->postJson('/api/cash-registers/999999/open-session', ['initialCash' => 0])
            ->assertNotFound()
            ->assertJsonPath('message', 'Caja registradora no encontrada');

        $inactive = $this->makeRegister('CAJA-OFF', ['isActive' => false]);
        $this->postJson("/api/cash-registers/{$inactive->id}/open-session", ['initialCash' => 0])
            ->assertStatus(400)
            ->assertJsonPath('message', 'La caja registradora no está activa');

        $this->postJson("/api/cash-registers/{$register->id}/open-session", ['initialCash' => 0])->assertCreated();
        $this->postJson("/api/cash-registers/{$register->id}/open-session", ['initialCash' => 0])
            ->assertStatus(400)
            ->assertJsonPath('message', 'Ya existe una sesión abierta en esta caja');
    }

    public function test_un_mismo_cajero_puede_abrir_sesion_en_dos_cajas_a_la_vez(): void
    {
        $this->actingAsCajero();
        $a = $this->makeRegister('CAJA-A');
        $b = $this->makeRegister('CAJA-B');

        $this->postJson("/api/cash-registers/{$a->id}/open-session", ['initialCash' => 0])->assertCreated();
        // ACTUAL (posible bug): solo se valida que la CAJA no tenga sesión abierta, no que el
        // cajero ya tenga otra; el POS (currentSession) toma luego la primera que encuentre.
        $this->postJson("/api/cash-registers/{$b->id}/open-session", ['initialCash' => 0])->assertCreated();

        $this->assertSame(2, CashSession::where('status', 'OPEN')->count());
    }

    public function test_my_session_devuelve_404_sin_sesion_y_la_sesion_abierta_si_existe(): void
    {
        $user = $this->actingAsCajero();
        $this->getJson('/api/cash-registers/my-session')
            ->assertNotFound()
            ->assertJsonPath('message', 'No tienes una sesión activa');

        $register = $this->makeRegister();
        $session = $this->openSessionFor($user, $register, 1000);

        $this->getJson('/api/cash-registers/my-session')
            ->assertOk()
            ->assertJsonPath('data.id', $session->id)
            ->assertJsonStructure(['data' => ['id', 'status', 'cashRegister' => ['id', 'code'], 'seller' => ['id', 'name', 'email']]]);
    }

    public function test_cerrar_caja_calcula_efectivo_esperado_diferencia_y_conteos(): void
    {
        [$user, $register, $session] = $this->cajeroConCaja(50000);
        $a = $this->makeVariant('Camiseta', 50000, 20);
        $b = $this->makeVariant('Gorra', 30000, 20);

        // Efectivo: 2 x 50.000 - 5.000 = 95.000.
        $this->sellOk($register, [[$a, 2]], ['paymentMethod' => 'cash', 'cashAmount' => 100000, 'discount' => 5000]);
        // Tarjeta: 30.000.
        $this->sellOk($register, [[$b, 1]], ['paymentMethod' => 'card', 'cardAmount' => 30000, 'cardReference' => 'R1']);
        // Mixta: 50.000 (20.000 efectivo + 30.000 tarjeta).
        $this->sellOk($register, [[$a, 1]], ['paymentMethod' => 'mixed', 'cashAmount' => 20000, 'cardAmount' => 30000]);
        // Fiado sin abono: queda PENDING.
        $this->sellOk($register, [[$b, 1]], ['paymentMethod' => 'debe', 'customerName' => 'Ana Fiado']);
        // Venta en efectivo anulada: 30.000.
        $cancelled = $this->sellOk($register, [[$b, 1]], ['paymentMethod' => 'cash']);
        $this->postJson("/api/pos/sale/{$cancelled->id}/cancel", ['reason' => 'error'])->assertOk();

        // Antes de cerrar, los contadores incrementales de la sesión incluyen el fiado.
        $session->refresh();
        $this->assertSame(4, (int) $session->salesCount);
        $this->assertSame(205000.0, (float) $session->totalSales);

        $res = $this->postJson("/api/cash-registers/sessions/{$session->id}/close", [
            'finalCash' => 140000,
            'notes' => 'Cierre de prueba',
        ]);

        $res->assertOk()
            ->assertJsonPath('message', 'Sesión cerrada exitosamente')
            ->assertJsonPath('data.status', 'CLOSED')
            ->assertJsonStructure(['data' => [
                'id', 'status', 'closedAt', 'finalCash', 'expectedCash', 'difference', 'salesCount',
                'totalSales', 'notes', 'cashRegister' => ['id'], 'seller' => ['id', 'name', 'email'],
            ]]);

        // Al cerrar se recalcula desde las órdenes PAID/PROCESSING/SHIPPED/DELIVERED:
        // cuenta efectivo + tarjeta + mixta (3), excluye el fiado PENDING y la anulada.
        $this->assertSame(3, (int) $res->json('data.salesCount'));
        $this->assertSame(175000.0, (float) $res->json('data.totalSales'));
        // ACTUAL (posible bug): el efectivo esperado solo suma ventas con paymentMethod "cash"
        // (por su TOTAL); los 20.000 en efectivo de la venta mixta no entran. 50.000 + 95.000.
        $this->assertSame(145000.0, (float) $res->json('data.expectedCash'));
        $this->assertSame(-5000.0, (float) $res->json('data.difference'));
        $this->assertSame(140000.0, (float) $res->json('data.finalCash'));
        $this->assertSame('Cierre de prueba', $res->json('data.notes'));

        // Cerrar dos veces.
        $this->postJson("/api/cash-registers/sessions/{$session->id}/close", ['finalCash' => 0])
            ->assertStatus(400)
            ->assertJsonPath('message', 'La sesión ya está cerrada');
    }

    public function test_el_efectivo_esperado_usa_el_total_y_no_el_efectivo_recibido(): void
    {
        [, $register, $session] = $this->cajeroConCaja(10000);
        $a = $this->makeVariant('Camiseta', 50000, 5);

        // El cliente paga con 100.000 (cashAmount) una venta de 50.000.
        $this->sellOk($register, [[$a, 1]], ['paymentMethod' => 'cash', 'cashAmount' => 100000]);

        $res = $this->postJson("/api/cash-registers/sessions/{$session->id}/close", ['finalCash' => 60000])->assertOk();
        $this->assertSame(60000.0, (float) $res->json('data.expectedCash'));
        $this->assertSame(0.0, (float) $res->json('data.difference'));
    }

    public function test_fiado_cobrado_en_efectivo_no_entra_al_efectivo_esperado(): void
    {
        [, $register, $session] = $this->cajeroConCaja(0);
        $a = $this->makeVariant('Camiseta', 40000, 5);

        $debt = $this->sellOk($register, [[$a, 1]], ['paymentMethod' => 'debe', 'customerName' => 'Luis']);
        $this->postJson("/api/pos/sale/{$debt->id}/collect", ['paymentMethod' => 'cash'])->assertOk();

        $res = $this->postJson("/api/cash-registers/sessions/{$session->id}/close", ['finalCash' => 40000])->assertOk();
        // El fiado ya saldado (PAID) cuenta en ventas...
        $this->assertSame(1, (int) $res->json('data.salesCount'));
        $this->assertSame(40000.0, (float) $res->json('data.totalSales'));
        // ACTUAL (posible bug): ...pero como su paymentMethod sigue siendo "debe", los 40.000
        // cobrados en efectivo no suman al efectivo esperado; el cuadre da +40.000 de sobrante.
        $this->assertSame(0.0, (float) $res->json('data.expectedCash'));
        $this->assertSame(40000.0, (float) $res->json('data.difference'));
    }

    public function test_el_admin_puede_cerrar_la_sesion_de_otro(): void
    {
        $cajero = $this->userByEmail('pos@vexa.com');
        $register = $this->makeRegister();
        $session = $this->openSessionFor($cajero, $register, 0);

        $this->actingAsAdmin();
        $this->postJson("/api/cash-registers/sessions/{$session->id}/close", ['finalCash' => 0])->assertOk();
        $this->postJson('/api/cash-registers/sessions/999999/close', ['finalCash' => 0])->assertNotFound();
        $this->postJson("/api/cash-registers/sessions/{$session->id}/close", [])->assertStatus(422);
    }

    public function test_listado_de_sesiones_y_reporte_de_sesion(): void
    {
        [$user, $register, $session] = $this->cajeroConCaja(0);
        $a = $this->makeVariant('Camiseta', 50000, 10);
        $this->sellOk($register, [[$a, 1]], ['paymentMethod' => 'cash']);
        $this->sellOk($register, [[$a, 2]], ['paymentMethod' => 'card']);
        $cancelled = $this->sellOk($register, [[$a, 1]], ['paymentMethod' => 'cash']);
        $this->postJson("/api/pos/sale/{$cancelled->id}/cancel", ['reason' => 'x'])->assertOk();

        // El Cajero no tiene pos.view_reports, pero sí pos.cash_register.
        $this->getJson('/api/cash-registers/sessions?status=OPEN')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonStructure(['data' => [['id', 'status', 'cashRegister' => ['id'], 'seller' => ['id', 'name', 'email']]]]);
        $this->getJson('/api/cash-registers/sessions?status=CLOSED')->assertOk()->assertJsonCount(0, 'data');

        $res = $this->getJson("/api/cash-registers/sessions/{$session->id}/report")->assertOk();
        $res->assertJsonStructure(['data' => [
            'session' => ['id', 'status', 'cashRegister', 'seller'],
            'sales' => [['id', 'orderNumber', 'total', 'paymentMethod', 'status']],
            'summary' => ['totalSales', 'totalAmount', 'paymentMethods', 'duration'],
        ]]);
        // ACTUAL (posible bug): el reporte NO filtra por estado: incluye la venta anulada
        // (3 ventas, 200.000), a diferencia del cierre de caja que solo suma las pagadas.
        $this->assertSame(3, $res->json('data.summary.totalSales'));
        $this->assertSame(200000.0, (float) $res->json('data.summary.totalAmount'));
        $this->assertSame(2, $res->json('data.summary.paymentMethods.cash.count'));
        $this->assertSame(100000.0, (float) $res->json('data.summary.paymentMethods.cash.total'));
        $this->assertSame(1, $res->json('data.summary.paymentMethods.card.count'));
        $this->assertNull($res->json('data.summary.duration'));

        // Sesión cerrada 90 minutos después: duración en minutos.
        $this->travel(90)->minutes();
        $this->postJson("/api/cash-registers/sessions/{$session->id}/close", ['finalCash' => 0])->assertOk();
        $this->assertSame(90, $this->getJson("/api/cash-registers/sessions/{$session->id}/report")->json('data.summary.duration'));

        $this->getJson('/api/cash-registers/sessions/999999/report')->assertNotFound();
    }

    public function test_crud_de_cajas(): void
    {
        $this->actingAsAdmin();

        $res = $this->postJson('/api/cash-registers', [
            'name' => 'Caja Norte', 'location' => 'Local 2', 'code' => 'CN-01', 'categoryIds' => [3, 4],
        ]);
        $res->assertCreated()
            ->assertJsonPath('message', 'Caja registradora creada exitosamente')
            ->assertJsonPath('data.isActive', true)
            ->assertJsonPath('data.categoryIds', [3, 4])
            ->assertJsonStructure(['data' => ['id', 'name', 'location', 'code', 'categoryIds', 'isActive', 'createdAt']]);
        $id = $res->json('data.id');

        $this->postJson('/api/cash-registers', ['name' => 'X', 'location' => 'Y', 'code' => 'CN-01'])
            ->assertStatus(400)
            ->assertJsonPath('message', 'Ya existe una caja registradora con este código');
        $this->postJson('/api/cash-registers', [])->assertStatus(422);

        $other = $this->makeRegister('CN-02');
        $this->patchJson("/api/cash-registers/{$id}", ['code' => 'CN-02'])->assertStatus(400);
        $this->patchJson("/api/cash-registers/{$id}", ['name' => 'Caja Norte 2', 'isActive' => false])
            ->assertOk()
            ->assertJsonPath('data.name', 'Caja Norte 2')
            ->assertJsonPath('data.isActive', false);

        $this->getJson('/api/cash-registers?activeOnly=true')->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/cash-registers')->assertOk()->assertJsonCount(2, 'data')
            ->assertJsonStructure(['data' => [['id', 'name', 'code', 'cashSessions']]]);
        $this->getJson("/api/cash-registers/{$id}")->assertOk()->assertJsonStructure(['data' => ['id', 'cashSessions']]);
        $this->getJson('/api/cash-registers/999999')->assertNotFound();

        // No se elimina con sesión abierta.
        $this->openSessionFor($this->userByEmail('admin@vexa.com'), $other);
        $this->deleteJson("/api/cash-registers/{$other->id}")
            ->assertStatus(400)
            ->assertJsonPath('message', 'No se puede eliminar una caja con sesiones abiertas');
        $this->deleteJson("/api/cash-registers/{$id}")->assertOk()->assertJsonPath('message', 'Caja registradora eliminada exitosamente');
        $this->assertNull(CashRegister::find($id));
    }

    public function test_cierre_no_cuenta_ventas_de_otro_vendedor_en_la_misma_caja(): void
    {
        [$user, $register, $session] = $this->cajeroConCaja(0);
        Order::create([
            'orderNumber' => 'POS-AJENA-1', 'subtotal' => 99000, 'total' => 99000, 'status' => 'PAID',
            'paymentMethod' => 'cash', 'saleChannel' => 'POS', 'sellerId' => $this->userByEmail('admin@vexa.com')->id,
            'cashRegisterId' => $register->id, 'statusHistory' => [],
        ]);

        $res = $this->postJson("/api/cash-registers/sessions/{$session->id}/close", ['finalCash' => 0])->assertOk();
        $this->assertSame(0, (int) $res->json('data.salesCount'));
        $this->assertSame(0.0, (float) $res->json('data.expectedCash'));
    }
}
