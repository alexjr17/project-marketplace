<?php

namespace Tests\Feature\Services;

use App\Models\InventoryCount;
use App\Models\MfgGarmentType;
use App\Models\NumberSequence;
use App\Models\PurchaseOrder;
use App\Services\NumberSequenceService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\Concerns\ActsAsRoles;
use Tests\Feature\Flows\Inventory\Concerns\BuildsInventoryData;
use Tests\TestCase;

/** Consecutivos atómicos: formato igual al de antes, sin repetir y arrancando desde lo existente. */
class NumberSequenceServiceTest extends TestCase
{
    use ActsAsRoles, BuildsInventoryData, RefreshDatabase;

    private NumberSequenceService $numbers;

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow('2026-11-02 10:00:00');
        $this->numbers = app(NumberSequenceService::class);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_formatos_iguales_a_los_de_antes(): void
    {
        $expected = [
            NumberSequenceService::ORDER => 'ORD-261102-0001',
            NumberSequenceService::POS_SALE => 'POS-261102-0001',
            NumberSequenceService::PURCHASE_ORDER => 'OC-2026-0001',
            NumberSequenceService::PURCHASE_RETURN => 'DEV-2026-0001',
            NumberSequenceService::INVENTORY_COUNT => 'INV-2026-0001',
            NumberSequenceService::INVENTORY_CONVERSION => 'CONV-2026-0001',
            NumberSequenceService::SUPPLIER => 'PROV-001',
            NumberSequenceService::MFG_PURCHASE_ORDER => 'PED-2026-0001',
            NumberSequenceService::MFG_PRODUCTION_ORDER => 'OP-2026-0001',
            NumberSequenceService::MFG_LOT => 'L-2026-0001',
            NumberSequenceService::MFG_DISPATCH => 'DES-2026-0001',
        ];
        foreach ($expected as $type => $number) {
            $this->assertSame($number, $this->numbers->next($type), $type);
        }
        $this->assertSame('CAM-0001', $this->numbers->next(NumberSequenceService::MFG_REFERENCE, ['code' => 'CAM']));
        $this->assertSame('HOO-0001', $this->numbers->next(NumberSequenceService::MFG_REFERENCE, ['code' => 'HOO']));
    }

    public function test_consecutivos_y_peek_no_consume(): void
    {
        $this->assertSame('OC-2026-0001', $this->numbers->peek(NumberSequenceService::PURCHASE_ORDER));
        $this->assertSame('OC-2026-0001', $this->numbers->peek(NumberSequenceService::PURCHASE_ORDER));
        $this->assertSame('OC-2026-0001', $this->numbers->next(NumberSequenceService::PURCHASE_ORDER));
        $this->assertSame('OC-2026-0002', $this->numbers->next(NumberSequenceService::PURCHASE_ORDER));
        $this->assertSame('OC-2026-0003', $this->numbers->peek(NumberSequenceService::PURCHASE_ORDER));
        $this->assertSame(1, NumberSequence::count());
    }

    public function test_arranca_desde_el_mayor_existente_y_no_repite_tras_borrar(): void
    {
        // Datos anteriores al servicio (o escritos a mano): la serie continúa desde el mayor.
        InventoryCount::create(['countNumber' => 'INV-2026-0007', 'countType' => 'FULL', 'status' => 'DRAFT']);
        InventoryCount::create(['countNumber' => 'INV-2025-0099', 'countType' => 'FULL', 'status' => 'DRAFT']);
        $this->assertSame('INV-2026-0008', $this->numbers->next(NumberSequenceService::INVENTORY_COUNT));

        // Borrar el último no hace que se vuelva a entregar.
        InventoryCount::where('countNumber', 'INV-2026-0007')->delete();
        $this->assertSame('INV-2026-0009', $this->numbers->next(NumberSequenceService::INVENTORY_COUNT));

        // Un código insertado por fuera del servicio tampoco choca.
        InventoryCount::create(['countNumber' => 'INV-2026-0050', 'countType' => 'FULL', 'status' => 'DRAFT']);
        $this->assertSame('INV-2026-0051', $this->numbers->next(NumberSequenceService::INVENTORY_COUNT));
    }

    public function test_la_serie_se_reinicia_por_periodo(): void
    {
        $this->assertSame('POS-261102-0001', $this->numbers->next(NumberSequenceService::POS_SALE));
        $this->assertSame('POS-261102-0002', $this->numbers->next(NumberSequenceService::POS_SALE));
        // El pedido online del mismo día lleva su propia serie.
        $this->assertSame('ORD-261102-0001', $this->numbers->next(NumberSequenceService::ORDER));

        Carbon::setTestNow('2026-11-03 08:00:00');
        $this->assertSame('POS-261103-0001', $this->numbers->next(NumberSequenceService::POS_SALE));

        Carbon::setTestNow('2027-01-01 08:00:00');
        $this->assertSame('OC-2027-0001', $this->numbers->next(NumberSequenceService::PURCHASE_ORDER));
    }

    public function test_proveedor_supera_999_sin_romper_el_orden(): void
    {
        // Antes se ordenaba como texto: tras PROV-999 y PROV-1000 sugería PROV-1000 otra vez.
        $this->makeSupplier('PROV-999');
        $this->makeSupplier('PROV-1000', 'Otro');
        $this->assertSame('PROV-1001', $this->numbers->peek(NumberSequenceService::SUPPLIER));
    }

    public function test_numeracion_de_documentos_por_api(): void
    {
        $this->seedRolesAndUsers();
        $this->actingAsAdmin();

        $supplier = $this->makeSupplier();
        $input = $this->makeInput();
        $payload = ['supplierId' => $supplier->id, 'items' => [['inputId' => $input->id, 'quantity' => 1, 'unitCost' => 1]]];

        $this->getJson('/api/purchase-orders/generate-number')->assertJsonPath('data.orderNumber', 'OC-2026-0001');
        $this->postJson('/api/purchase-orders', $payload)->assertCreated()->assertJsonPath('data.orderNumber', 'OC-2026-0001');
        $this->postJson('/api/purchase-orders', $payload)->assertCreated()->assertJsonPath('data.orderNumber', 'OC-2026-0002');

        // Borrar la última y crear otra: OC-2026-0003 (antes se repetía y chocaba).
        $last = PurchaseOrder::where('orderNumber', 'OC-2026-0002')->first();
        $this->deleteJson("/api/purchase-orders/{$last->id}")->assertOk();
        $this->postJson('/api/purchase-orders', $payload)->assertCreated()->assertJsonPath('data.orderNumber', 'OC-2026-0003');

        $this->getJson('/api/suppliers/generate-code')->assertJsonPath('data.code', 'PROV-002');
    }

    public function test_codigo_de_referencia_por_tipo_de_prenda(): void
    {
        $this->seedRolesAndUsers();
        $this->actingAsAdmin();
        $gt = MfgGarmentType::create(['code' => 'cam', 'name' => 'Camiseta', 'isActive' => true]);

        $this->postJson('/api/manufacturing/references/generate-code', ['garmentTypeId' => $gt->id])
            ->assertOk()->assertJsonPath('data.code', 'CAM-0001');
        // generate-code solo muestra: no consume.
        $this->postJson('/api/manufacturing/references/generate-code', ['garmentTypeId' => $gt->id])
            ->assertJsonPath('data.code', 'CAM-0001');
        $this->assertSame(0, NumberSequence::count());
    }
}
