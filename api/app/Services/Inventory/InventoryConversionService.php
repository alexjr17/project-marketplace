<?php

namespace App\Services\Inventory;

use App\Exceptions\BusinessRuleException;
use App\Exceptions\InsufficientStockException;
use App\Models\ConversionInputItem;
use App\Models\ConversionOutputItem;
use App\Models\InputVariant;
use App\Models\InventoryConversion;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use App\Services\NumberSequenceService;
use App\Services\StockService;
use Illuminate\Support\Facades\DB;

/**
 * Conversiones de insumos a producto terminado: borrador (se editan los insumos a consumir
 * y los productos a generar) → pendiente → aprobada (o cancelada).
 *
 * Al aprobar, en una transacción y con StockService: sale el stock de cada variante de
 * insumo (SALIDA) y entra el de cada variante de producto (PURCHASE); después se recalcula
 * products.stock de los productos afectados.
 */
class InventoryConversionService
{
    private const STATUSES = ['DRAFT', 'PENDING', 'APPROVED', 'CANCELLED'];

    public function __construct(private NumberSequenceService $numbers, private StockService $stock) {}

    public function list(array $filters)
    {
        $query = InventoryConversion::with(['inputItems', 'outputItems']);
        if (! empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }
        if (! empty($filters['fromDate'])) {
            $query->where('conversionDate', '>=', $filters['fromDate']);
        }
        if (! empty($filters['toDate'])) {
            $query->where('conversionDate', '<=', $filters['toDate']);
        }

        return $query->orderByDesc('createdAt')->get()->map(fn ($c) => $this->format($c));
    }

    public function stats(): array
    {
        $byStatus = [];
        foreach (self::STATUSES as $status) {
            $byStatus[$status] = InventoryConversion::where('status', $status)->count();
        }
        $approved = fn () => InventoryConversion::where('status', 'APPROVED');

        return [
            'total' => array_sum($byStatus),
            'byStatus' => $byStatus,
            'lastConversion' => $approved()->orderByDesc('approvedAt')->value('approvedAt'),
            'totalInputCost' => (float) $approved()->sum('totalInputCost'),
            'totalOutputValue' => (float) $approved()->sum('totalOutputCost'),
        ];
    }

    public function detail(int $id): array
    {
        return $this->format($this->load($id), true);
    }

    public function create(array $data, User $user): array
    {
        $conversion = InventoryConversion::create([
            'conversionNumber' => $this->numbers->next(NumberSequenceService::INVENTORY_CONVERSION),
            'conversionType' => $data['conversionType'] ?? 'MANUAL',
            'templateId' => $data['templateId'] ?? null,
            'templateVariantId' => $data['templateVariantId'] ?? null,
            'status' => 'DRAFT',
            'conversionDate' => $data['conversionDate'] ?? now(),
            'createdById' => $user->id,
            'createdByName' => $user->name,
            'description' => $data['description'] ?? null,
            'notes' => $data['notes'] ?? null,
            'totalInputCost' => 0,
            'totalOutputCost' => 0,
        ]);

        return $this->format($this->load($conversion->id));
    }

    /** Arma la conversión desde las recetas de una variante de plantilla. */
    public function fromTemplate(array $data, User $user): array
    {
        $templateVariant = ProductVariant::with(['product', 'templateRecipes.inputVariant.input'])->find($data['templateVariantId']);
        if (! $templateVariant) {
            throw new BusinessRuleException('Variante de plantilla no encontrada', 404);
        }
        if (! $templateVariant->product || ! $templateVariant->product->isTemplate) {
            throw new BusinessRuleException('La variante no pertenece a una plantilla', 400);
        }
        if ($templateVariant->templateRecipes->isEmpty()) {
            throw new BusinessRuleException('La variante de plantilla no tiene recetas asociadas', 400);
        }
        $outputVariant = ProductVariant::find($data['outputVariantId']);
        if (! $outputVariant) {
            throw new BusinessRuleException('Variante de producto no encontrada', 404);
        }

        foreach ($templateVariant->templateRecipes as $recipe) {
            $required = $data['quantity'] * (float) $recipe->quantity;
            $iv = $recipe->inputVariant;
            if (! $iv || (float) $iv->currentStock < $required) {
                $name = $iv?->input?->name ?? 'insumo';
                throw new BusinessRuleException("Stock insuficiente de {$name} ({$iv?->sku}). Disponible: ".($iv?->currentStock ?? 0).", Requerido: {$required}", 400);
            }
        }

        $conversion = DB::transaction(function () use ($data, $templateVariant, $outputVariant, $user) {
            $conversion = InventoryConversion::create([
                'conversionNumber' => $this->numbers->next(NumberSequenceService::INVENTORY_CONVERSION),
                'conversionType' => 'TEMPLATE',
                'templateId' => $templateVariant->productId,
                'templateVariantId' => $data['templateVariantId'],
                'status' => 'DRAFT',
                'conversionDate' => $data['conversionDate'] ?? now(),
                'createdById' => $user->id,
                'createdByName' => $user->name,
                'description' => $data['description'] ?? 'Conversión de plantilla: '.$templateVariant->product->name,
                'notes' => $data['notes'] ?? null,
                'totalInputCost' => 0,
                'totalOutputCost' => 0,
            ]);

            foreach ($templateVariant->templateRecipes as $recipe) {
                $required = $data['quantity'] * (float) $recipe->quantity;
                $this->createInputItem($conversion->id, $recipe->inputVariant->loadMissing('color', 'size'), $required,
                    "Insumo para {$data['quantity']} unidades de ".$templateVariant->product->name);
            }
            $this->createOutputItem($conversion->id, $outputVariant->loadMissing('product', 'color', 'size'), (int) $data['quantity'],
                "Generado desde plantilla {$templateVariant->sku}");
            $this->recalculateTotals($conversion->id);

            return $conversion;
        });

        return $this->format($this->load($conversion->id), true);
    }

    // ==================== Ítems ====================

    public function addInputItem(int $id, array $data): array
    {
        $this->editable($id);
        $iv = InputVariant::with('input', 'color', 'size')->find($data['inputVariantId']);
        if (! $iv) {
            throw new BusinessRuleException('Variante de insumo no encontrada', 404);
        }
        if ((float) $iv->currentStock < $data['quantity']) {
            throw new BusinessRuleException("Stock insuficiente de {$iv->input->name} ({$iv->sku}). Disponible: {$iv->currentStock} {$iv->input->unitOfMeasure}", 400);
        }
        if (ConversionInputItem::where('conversionId', $id)->where('inputVariantId', $data['inputVariantId'])->exists()) {
            throw new BusinessRuleException('Esta variante de insumo ya está agregada a la conversión', 400);
        }

        DB::transaction(function () use ($id, $iv, $data) {
            $this->createInputItem($id, $iv, (float) $data['quantity'], $data['notes'] ?? null);
            $this->recalculateTotals($id);
        });

        return $this->format($this->load($id), true);
    }

    public function updateInputItem(int $id, int $itemId, array $data): array
    {
        $this->editable($id);
        $item = ConversionInputItem::where('id', $itemId)->where('conversionId', $id)->first();
        if (! $item) {
            throw new BusinessRuleException('Item no encontrado', 404);
        }

        if (array_key_exists('quantity', $data) && $data['quantity'] !== null) {
            $iv = InputVariant::with('input')->find($item->inputVariantId);
            if ($iv && (float) $iv->currentStock < $data['quantity']) {
                throw new BusinessRuleException("Stock insuficiente de {$iv->input->name} ({$item->variantSku}). Disponible: {$iv->currentStock} {$item->unitOfMeasure}", 400);
            }
            $item->quantity = $data['quantity'];
            $item->totalCost = $data['quantity'] * (float) $item->unitCost;
            $item->notes = $data['notes'] ?? null;
        } elseif (array_key_exists('notes', $data)) {
            $item->notes = $data['notes'];
        }

        DB::transaction(function () use ($id, $item) {
            $item->save();
            $this->recalculateTotals($id);
        });

        return $this->format($this->load($id), true);
    }

    public function removeInputItem(int $id, int $itemId): array
    {
        $this->editable($id);
        DB::transaction(function () use ($id, $itemId) {
            ConversionInputItem::where('id', $itemId)->where('conversionId', $id)->delete();
            $this->recalculateTotals($id);
        });

        return $this->format($this->load($id), true);
    }

    public function addOutputItem(int $id, array $data): array
    {
        $this->editable($id);
        $variant = ProductVariant::with('product', 'color', 'size')->find($data['variantId']);
        if (! $variant) {
            throw new BusinessRuleException('Variante de producto no encontrada', 404);
        }
        if (ConversionOutputItem::where('conversionId', $id)->where('variantId', $data['variantId'])->exists()) {
            throw new BusinessRuleException('Esta variante ya está agregada a la conversión', 400);
        }

        DB::transaction(function () use ($id, $variant, $data) {
            $this->createOutputItem($id, $variant, (int) $data['quantity'], $data['notes'] ?? null);
            $this->recalculateTotals($id);
        });

        return $this->format($this->load($id), true);
    }

    public function updateOutputItem(int $id, int $itemId, array $data): array
    {
        $this->editable($id);
        $item = ConversionOutputItem::where('id', $itemId)->where('conversionId', $id)->first();
        if (! $item) {
            throw new BusinessRuleException('Item no encontrado', 404);
        }

        if (array_key_exists('quantity', $data) && $data['quantity'] !== null) {
            $item->quantity = $data['quantity'];
            $item->totalValue = $data['quantity'] * (float) $item->unitPrice;
            $item->notes = $data['notes'] ?? null;
        } elseif (array_key_exists('notes', $data)) {
            $item->notes = $data['notes'];
        }

        DB::transaction(function () use ($id, $item) {
            $item->save();
            $this->recalculateTotals($id);
        });

        return $this->format($this->load($id), true);
    }

    public function removeOutputItem(int $id, int $itemId): array
    {
        $this->editable($id);
        DB::transaction(function () use ($id, $itemId) {
            ConversionOutputItem::where('id', $itemId)->where('conversionId', $id)->delete();
            $this->recalculateTotals($id);
        });

        return $this->format($this->load($id), true);
    }

    // ==================== Estados ====================

    public function submit(int $id): array
    {
        $conversion = $this->load($id);
        if ($conversion->status !== 'DRAFT') {
            throw new BusinessRuleException('Solo se pueden enviar a aprobación conversiones en borrador', 400);
        }
        if ($conversion->inputItems->isEmpty()) {
            throw new BusinessRuleException('Debe agregar al menos un insumo a consumir', 400);
        }
        if ($conversion->outputItems->isEmpty()) {
            throw new BusinessRuleException('Debe agregar al menos un producto a generar', 400);
        }
        $this->assertInputStock($conversion);

        $conversion->status = 'PENDING';
        $conversion->save();

        return $this->format($this->load($id));
    }

    public function approve(int $id, User $user): array
    {
        $conversion = $this->load($id);
        if ($conversion->status !== 'PENDING') {
            throw new BusinessRuleException('Solo se pueden aprobar conversiones pendientes', 400);
        }
        $this->assertInputStock($conversion);

        try {
            DB::transaction(function () use ($conversion, $user) {
                foreach ($conversion->inputItems as $item) {
                    $this->stock->inputVariantOut($item->inputVariantId, (float) $item->quantity, 'SALIDA', [
                        'referenceType' => 'conversion',
                        'referenceId' => $conversion->id,
                        'reason' => "Conversión a producto {$conversion->conversionNumber}",
                        'notes' => $item->notes,
                        'userId' => $user->id,
                    ]);
                }

                $productIds = [];
                foreach ($conversion->outputItems as $item) {
                    $variant = ProductVariant::find($item->variantId);
                    if (! $variant) {
                        continue;
                    }
                    $this->stock->variantIn($variant->id, (int) $item->quantity, 'PURCHASE', [
                        'referenceType' => 'conversion',
                        'referenceId' => $conversion->id,
                        'reason' => "Conversión desde insumos {$conversion->conversionNumber}",
                        'notes' => $item->notes,
                        'userId' => $user->id,
                    ]);
                    $productIds[$variant->productId] = true;
                }
                foreach (array_keys($productIds) as $productId) {
                    $this->stock->syncProductStock((int) $productId);
                }

                $conversion->status = 'APPROVED';
                $conversion->approvedById = $user->id;
                $conversion->approvedByName = $user->name;
                $conversion->approvedAt = now();
                $conversion->save();
            });
        } catch (InsufficientStockException $e) {
            throw new BusinessRuleException($e->getMessage(), 400);
        }

        return $this->format($this->load($id), true);
    }

    public function cancel(int $id): array
    {
        $conversion = $this->find($id);
        if ($conversion->status === 'APPROVED') {
            throw new BusinessRuleException('No se pueden cancelar conversiones aprobadas', 400);
        }
        $conversion->status = 'CANCELLED';
        $conversion->save();

        return $this->format($this->load($id));
    }

    public function delete(int $id): void
    {
        $conversion = $this->find($id);
        if (! in_array($conversion->status, ['DRAFT', 'CANCELLED'], true)) {
            throw new BusinessRuleException('Solo se pueden eliminar conversiones en borrador o canceladas', 400);
        }
        $conversion->delete();
    }

    // ==================== Utilidades ====================

    private function find(int $id): InventoryConversion
    {
        $conversion = InventoryConversion::find($id);
        if (! $conversion) {
            throw new BusinessRuleException('Conversión de inventario no encontrada', 404);
        }

        return $conversion;
    }

    private function load(int $id): InventoryConversion
    {
        $conversion = InventoryConversion::with([
            'inputItems' => fn ($q) => $q->orderBy('inputName'),
            'outputItems' => fn ($q) => $q->orderBy('productName'),
        ])->find($id);
        if (! $conversion) {
            throw new BusinessRuleException('Conversión de inventario no encontrada', 404);
        }

        return $conversion;
    }

    private function editable(int $id): InventoryConversion
    {
        $conversion = $this->find($id);
        if ($conversion->status !== 'DRAFT') {
            throw new BusinessRuleException('Solo se pueden modificar conversiones en borrador', 400);
        }

        return $conversion;
    }

    private function assertInputStock(InventoryConversion $conversion): void
    {
        foreach ($conversion->inputItems as $item) {
            $iv = InputVariant::find($item->inputVariantId);
            if (! $iv) {
                throw new BusinessRuleException("Variante de insumo {$item->inputName} ({$item->variantSku}) no encontrada", 400);
            }
            if ((float) $iv->currentStock < (float) $item->quantity) {
                throw new BusinessRuleException("Stock insuficiente de {$item->inputName} ({$item->variantSku}). Disponible: {$iv->currentStock} {$item->unitOfMeasure}, Requerido: {$item->quantity}", 400);
            }
        }
    }

    private function createInputItem(int $conversionId, InputVariant $iv, float $quantity, ?string $notes): void
    {
        ConversionInputItem::create([
            'conversionId' => $conversionId,
            'inputVariantId' => $iv->id,
            'inputCode' => $iv->input->code,
            'inputName' => $iv->input->name,
            'variantSku' => $iv->sku,
            'colorName' => $iv->color?->name,
            'sizeName' => $iv->size?->name,
            'unitOfMeasure' => $iv->input->unitOfMeasure,
            'unitCost' => $iv->unitCost,
            'quantity' => $quantity,
            'totalCost' => $quantity * (float) $iv->unitCost,
            'notes' => $notes,
        ]);
    }

    private function createOutputItem(int $conversionId, ProductVariant $variant, int $quantity, ?string $notes): void
    {
        $unitPrice = (float) $variant->product->basePrice + (float) ($variant->priceAdjustment ?? 0);
        ConversionOutputItem::create([
            'conversionId' => $conversionId,
            'variantId' => $variant->id,
            'productName' => $variant->product->name,
            'variantSku' => $variant->sku,
            'colorName' => $variant->color?->name,
            'sizeName' => $variant->size?->name,
            'unitPrice' => $unitPrice,
            'quantity' => $quantity,
            'totalValue' => $quantity * $unitPrice,
            'notes' => $notes,
        ]);
    }

    private function recalculateTotals(int $conversionId): void
    {
        InventoryConversion::where('id', $conversionId)->update([
            'totalInputCost' => (float) ConversionInputItem::where('conversionId', $conversionId)->sum('totalCost'),
            'totalOutputCost' => (float) ConversionOutputItem::where('conversionId', $conversionId)->sum('totalValue'),
        ]);
    }

    private function format(InventoryConversion $c, bool $withTemplate = false): array
    {
        $stockByVariant = InputVariant::whereIn('id', $c->inputItems->pluck('inputVariantId')->filter())->pluck('currentStock', 'id');

        $data = [
            'id' => $c->id,
            'conversionNumber' => $c->conversionNumber,
            'conversionType' => $c->conversionType,
            'templateId' => $c->templateId,
            'templateVariantId' => $c->templateVariantId,
            'status' => $c->status,
            'conversionDate' => $c->conversionDate,
            'createdById' => $c->createdById,
            'createdByName' => $c->createdByName,
            'approvedById' => $c->approvedById,
            'approvedByName' => $c->approvedByName,
            'approvedAt' => $c->approvedAt,
            'description' => $c->description,
            'notes' => $c->notes,
            'inputItems' => $c->inputItems->map(fn ($i) => [
                'id' => $i->id,
                'inputVariantId' => $i->inputVariantId,
                'inputCode' => $i->inputCode,
                'inputName' => $i->inputName,
                'variantSku' => $i->variantSku,
                'colorName' => $i->colorName,
                'sizeName' => $i->sizeName,
                'unitOfMeasure' => $i->unitOfMeasure,
                'unitCost' => (float) $i->unitCost,
                'quantity' => (float) $i->quantity,
                'totalCost' => (float) $i->totalCost,
                'availableStock' => (float) ($stockByVariant[$i->inputVariantId] ?? 0),
                'notes' => $i->notes,
            ])->all(),
            'outputItems' => $c->outputItems->map(fn ($i) => [
                'id' => $i->id,
                'variantId' => $i->variantId,
                'productName' => $i->productName,
                'variantSku' => $i->variantSku,
                'colorName' => $i->colorName,
                'sizeName' => $i->sizeName,
                'unitPrice' => (float) $i->unitPrice,
                'quantity' => (int) $i->quantity,
                'totalValue' => (float) $i->totalValue,
                'notes' => $i->notes,
            ])->all(),
            'totalInputCost' => (float) $c->totalInputCost,
            'totalOutputCost' => (float) $c->totalOutputCost,
            'createdAt' => $c->createdAt,
            'updatedAt' => $c->updatedAt,
        ];

        if ($withTemplate) {
            $data['template'] = $c->templateId ? Product::select('id', 'name', 'sku')->find($c->templateId) : null;
        }

        return $data;
    }
}
