<?php

namespace Tests\Feature\Flows\Pos;

use App\Models\CashRegister;
use App\Models\CashSession;
use App\Models\Input;
use App\Models\InputType;
use App\Models\InputVariant;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\TemplateRecipe;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Testing\TestResponse;
use Tests\Concerns\ActsAsRoles;
use Tests\TestCase;

/**
 * Base de los tests de caracterización del POS y las cajas.
 *
 * Fija el reloj (2026-11-02 10:00:00 UTC) y crea los datos con los modelos
 * para que los números sean exactos: productos simples (sin color/talla), una
 * caja y, si hace falta, una plantilla con su receta de insumos.
 *
 * Es abstracta y no termina en "Test", así PHPUnit no la ejecuta sola.
 */
abstract class PosFlowTestCase extends TestCase
{
    use ActsAsRoles, RefreshDatabase;

    protected const NOW = '2026-11-02 10:00:00';

    private int $seq = 0;

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow(Carbon::parse(self::NOW));
        $this->seedRolesAndUsers();
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    /** Producto de catálogo simple con una sola variante (color/talla nulos). */
    protected function makeVariant(string $name, float $price, int $stock, array $productExtra = [], array $variantExtra = []): ProductVariant
    {
        $n = ++$this->seq;
        $product = Product::create(array_merge([
            'sku' => 'TST-'.$n,
            'slug' => 'tst-'.$n,
            'name' => $name,
            'description' => 'Producto de prueba',
            'basePrice' => $price,
            'stock' => 0,
            'isActive' => true,
            'isTemplate' => false,
            'images' => [],
            'tags' => [],
        ], $productExtra));

        return ProductVariant::create(array_merge([
            'productId' => $product->id,
            'sku' => 'TST-'.$n.'-U',
            'barcode' => '77000000'.str_pad((string) $n, 5, '0', STR_PAD_LEFT),
            'stock' => $stock,
            'isActive' => true,
        ], $variantExtra))->load('product');
    }

    /**
     * Plantilla (isTemplate) con una variante y una receta: cada unidad vendida
     * consume $perUnit del insumo, que arranca con $inputStock.
     *
     * @return array{0: ProductVariant, 1: InputVariant}
     */
    protected function makeTemplateWithRecipe(float $price, float $inputStock, float $perUnit): array
    {
        $variant = $this->makeVariant('Plantilla POS', $price, 0, ['isTemplate' => true]);

        $type = InputType::create(['name' => 'Prenda base', 'slug' => 'prenda-base-'.$this->seq]);
        $input = Input::create([
            'code' => 'INS-T'.$this->seq,
            'name' => 'Camiseta blanca',
            'inputTypeId' => $type->id,
            'unitOfMeasure' => 'unidad',
            'unitCost' => 10000,
            'currentStock' => $inputStock,
        ]);
        $iv = InputVariant::create([
            'inputId' => $input->id,
            'sku' => 'INS-T'.$this->seq.'-V',
            'unitCost' => 10000,
            'currentStock' => $inputStock,
        ]);
        TemplateRecipe::create([
            'variantId' => $variant->id,
            'inputVariantId' => $iv->id,
            'quantity' => $perUnit,
        ]);

        return [$variant, $iv];
    }

    protected function makeRegister(string $code = 'CAJA-T1', array $extra = []): CashRegister
    {
        return CashRegister::create(array_merge([
            'name' => 'Caja '.$code,
            'location' => 'Tienda',
            'code' => $code,
            'isActive' => true,
            'categoryIds' => [],
        ], $extra));
    }

    /** Sesión abierta directamente en la base (sin pasar por el endpoint). */
    protected function openSessionFor(User $user, CashRegister $register, float $initialCash = 0): CashSession
    {
        return CashSession::create([
            'cashRegisterId' => $register->id,
            'sellerId' => $user->id,
            'initialCash' => $initialCash,
            'openedAt' => now(),
            'status' => 'OPEN',
            'salesCount' => 0,
            'totalSales' => 0,
        ]);
    }

    /** Cajero autenticado con una caja y su sesión abierta. */
    protected function cajeroConCaja(float $initialCash = 0): array
    {
        $user = $this->actingAsCajero();
        $register = $this->makeRegister();
        $session = $this->openSessionFor($user, $register, $initialCash);

        return [$user, $register, $session];
    }

    /** POST /api/pos/sale con un ítem por variante: [[variant, qty, price?], ...]. */
    protected function sell(CashRegister $register, array $lines, array $extra = []): TestResponse
    {
        $items = array_map(fn ($l) => [
            'variantId' => $l[0]->id,
            'quantity' => $l[1],
            'price' => $l[2] ?? (float) $l[0]->product->basePrice,
        ], $lines);

        return $this->postJson('/api/pos/sale', array_merge([
            'cashRegisterId' => $register->id,
            'items' => $items,
            'paymentMethod' => 'cash',
        ], $extra));
    }

    /** Crea una venta y devuelve la orden ya cargada. */
    protected function sellOk(CashRegister $register, array $lines, array $extra = []): Order
    {
        $res = $this->sell($register, $lines, $extra);
        $res->assertCreated();

        return Order::with('items')->findOrFail($res->json('data.id'));
    }

    protected function stockOf(ProductVariant $v): int
    {
        return (int) ProductVariant::whereKey($v->id)->value('stock');
    }

    /** Estructura común de una orden POS serializada. */
    protected function orderShape(): array
    {
        return [
            'id', 'orderNumber', 'posCustomerId', 'customerEmail', 'customerName', 'customerPhone',
            'subtotal', 'discount', 'tax', 'total', 'status', 'paymentMethod', 'paymentRef',
            'cashAmount', 'cardAmount', 'cardReference', 'cardType', 'cardLastFour',
            'saleChannel', 'sellerId', 'cashRegisterId', 'statusHistory', 'paidAt', 'notes',
            'editHistory', 'createdAt', 'updatedAt',
        ];
    }
}
