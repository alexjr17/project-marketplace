<?php

namespace Tests\Feature\Services;

use App\Exceptions\InsufficientStockException;
use App\Models\InputVariantMovement;
use App\Models\VariantMovement;
use App\Services\StockService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Flows\Inventory\Concerns\BuildsInventoryData;
use Tests\TestCase;

/** Movimientos de stock centralizados: registran movimiento y no dejan negativos en las salidas. */
class StockServiceTest extends TestCase
{
    use BuildsInventoryData, RefreshDatabase;

    private StockService $stock;

    protected function setUp(): void
    {
        parent::setUp();
        $this->stock = app(StockService::class);
    }

    public function test_entrada_salida_y_ajuste_de_variante_registran_movimiento(): void
    {
        $variant = $this->makeProductVariant($this->makeProduct(), 5);

        $in = $this->stock->variantIn($variant->id, 3, 'PURCHASE', ['referenceType' => 'purchase_order', 'referenceId' => 9, 'userId' => 1, 'unitCost' => 1200, 'ignorado' => 'x']);
        $this->assertSame([3, 5, 8], [(int) $in->quantity, (int) $in->previousStock, (int) $in->newStock]);
        $this->assertSame('purchase_order', $in->referenceType);

        $out = $this->stock->variantOut($variant->id, 8, 'SALE', ['reason' => 'Venta']);
        $this->assertSame([-8, 8, 0], [(int) $out->quantity, (int) $out->previousStock, (int) $out->newStock]);

        $adj = $this->stock->variantAdjustTo($variant->id, 4, 'ADJUSTMENT', ['reason' => 'Conteo']);
        $this->assertSame([4, 0, 4], [(int) $adj->quantity, (int) $adj->previousStock, (int) $adj->newStock]);

        $this->assertSame(4, (int) $variant->fresh()->stock);
        $this->assertSame(3, VariantMovement::where('variantId', $variant->id)->count());
    }

    public function test_salida_que_deja_negativo_falla_y_no_toca_nada(): void
    {
        $variant = $this->makeProductVariant($this->makeProduct(), 2);

        try {
            $this->stock->variantOut($variant->id, 3, 'SALE');
            $this->fail('Debía fallar por stock insuficiente');
        } catch (InsufficientStockException $e) {
            $this->assertSame("Stock insuficiente para {$variant->sku}. Disponible: 2, Solicitado: 3", $e->getMessage());
        }
        $this->assertSame(2, (int) $variant->fresh()->stock);
        $this->assertSame(0, VariantMovement::count());

        // Con allowNegative (consumos que no pueden fallar) sí pasa.
        $this->stock->variantOut($variant->id, 3, 'SALE', [], allowNegative: true);
        $this->assertSame(-1, (int) $variant->fresh()->stock);
    }

    public function test_valida_el_total_por_variante(): void
    {
        $a = $this->makeProductVariant($this->makeProduct(), 3);
        $b = $this->makeProductVariant($this->makeProduct(), 1);

        $locked = $this->stock->assertVariantsAvailable([$b->id => 1, $a->id => 3]);
        $this->assertEqualsCanonicalizing([$a->id, $b->id], $locked->keys()->all());

        $this->expectException(InsufficientStockException::class);
        $this->stock->assertVariantsAvailable([$a->id => 4]);
    }

    public function test_variantes_de_insumo(): void
    {
        ['variant' => $iv] = $this->makeVariantInput(2.5);

        $this->stock->inputVariantIn($iv->id, 1.5, 'ENTRADA', ['reason' => 'Compra']);
        $this->stock->inputVariantOut($iv->id, 4, 'SALIDA');
        $this->assertEquals(0, (float) $iv->fresh()->currentStock);

        $this->expectException(InsufficientStockException::class);
        try {
            $this->stock->inputVariantOut($iv->id, 0.5, 'SALIDA');
        } finally {
            $this->assertSame(2, InputVariantMovement::where('inputVariantId', $iv->id)->count());
        }
    }
}
