<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Models\ConversionInputItem;
use App\Models\ConversionOutputItem;
use App\Models\InputVariant;
use App\Models\InputVariantMovement;
use App\Models\InventoryConversion;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\VariantMovement;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class InventoryConversionController extends Controller
{
    use ApiResponse;

    /** Da formato a una conversión con sus items, normalizando numéricos. */
    private function formatConversion(InventoryConversion $c, bool $withTemplate = false): array
    {
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
            'inputItems' => $this->mapInputItems($c),
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
            $data['template'] = $c->templateId
                ? Product::select('id', 'name', 'sku')->find($c->templateId)
                : null;
        }

        return $data;
    }

    /**
     * Da formato a los ítems de entrada, incluyendo el stock disponible
     * actual de cada variante de insumo (para saber si alcanza).
     */
    private function mapInputItems(InventoryConversion $c): array
    {
        $stockByVariant = InputVariant::whereIn('id', $c->inputItems->pluck('inputVariantId')->filter())
            ->pluck('currentStock', 'id');

        return $c->inputItems->map(fn ($i) => [
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
        ])->all();
    }

    /** Genera el siguiente número de conversión (CONV-AAAA-NNNN). */
    private function generateConversionNumber(): string
    {
        $year = date('Y');
        $count = InventoryConversion::where('conversionNumber', 'like', "CONV-{$year}%")->count();

        return sprintf('CONV-%s-%04d', $year, $count + 1);
    }

    /** Recalcula los totales de la conversión a partir de sus items. */
    private function recalculateTotals(int $conversionId): void
    {
        $totalInputCost = (float) ConversionInputItem::where('conversionId', $conversionId)->sum('totalCost');
        $totalOutputCost = (float) ConversionOutputItem::where('conversionId', $conversionId)->sum('totalValue');

        InventoryConversion::where('id', $conversionId)->update([
            'totalInputCost' => $totalInputCost,
            'totalOutputCost' => $totalOutputCost,
        ]);
    }

    /** Carga una conversión con items o devuelve null. */
    private function loadConversion(int $id): ?InventoryConversion
    {
        return InventoryConversion::with([
            'inputItems' => fn ($q) => $q->orderBy('inputName'),
            'outputItems' => fn ($q) => $q->orderBy('productName'),
        ])->find($id);
    }

    /** GET /api/inventory-conversions */
    public function index(Request $request)
    {
        $query = InventoryConversion::with(['inputItems', 'outputItems']);

        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }
        if ($request->filled('fromDate')) {
            $query->where('conversionDate', '>=', $request->query('fromDate'));
        }
        if ($request->filled('toDate')) {
            $query->where('conversionDate', '<=', $request->query('toDate'));
        }

        $conversions = $query->orderByDesc('createdAt')->get();

        return $this->success($conversions->map(fn ($c) => $this->formatConversion($c)));
    }

    /** GET /api/inventory-conversions/stats */
    public function stats()
    {
        $byStatus = [
            'DRAFT' => InventoryConversion::where('status', 'DRAFT')->count(),
            'PENDING' => InventoryConversion::where('status', 'PENDING')->count(),
            'APPROVED' => InventoryConversion::where('status', 'APPROVED')->count(),
            'CANCELLED' => InventoryConversion::where('status', 'CANCELLED')->count(),
        ];

        $approved = InventoryConversion::where('status', 'APPROVED');
        $lastConversion = (clone $approved)->orderByDesc('approvedAt')->value('approvedAt');

        return $this->success([
            'total' => array_sum($byStatus),
            'byStatus' => $byStatus,
            'lastConversion' => $lastConversion,
            'totalInputCost' => (float) (clone $approved)->sum('totalInputCost'),
            'totalOutputValue' => (float) $approved->sum('totalOutputCost'),
        ]);
    }

    /** GET /api/inventory-conversions/{id} */
    public function show(int $id)
    {
        $conversion = $this->loadConversion($id);
        if (! $conversion) {
            return $this->error('Conversión de inventario no encontrada', 404);
        }

        return $this->success($this->formatConversion($conversion, true));
    }

    /** POST /api/inventory-conversions */
    public function store(Request $request)
    {
        $data = $request->validate([
            'conversionType' => 'nullable|in:MANUAL,TEMPLATE',
            'templateId' => 'nullable|integer',
            'templateVariantId' => 'nullable|integer',
            'conversionDate' => 'nullable|date',
            'description' => 'nullable|string',
            'notes' => 'nullable|string',
        ]);

        $user = $request->user();
        $conversion = InventoryConversion::create([
            'conversionNumber' => $this->generateConversionNumber(),
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

        return $this->created($this->formatConversion($this->loadConversion($conversion->id)));
    }

    /** POST /api/inventory-conversions/from-template */
    public function fromTemplate(Request $request)
    {
        $data = $request->validate([
            'templateVariantId' => 'required|integer',
            'outputVariantId' => 'required|integer',
            'quantity' => 'required|numeric|min:1',
            'conversionDate' => 'nullable|date',
            'description' => 'nullable|string',
            'notes' => 'nullable|string',
        ]);

        $templateVariant = ProductVariant::with([
            'product', 'templateRecipes.inputVariant.input',
        ])->find($data['templateVariantId']);

        if (! $templateVariant) {
            return $this->error('Variante de plantilla no encontrada', 404);
        }
        if (! $templateVariant->product || ! $templateVariant->product->isTemplate) {
            return $this->error('La variante no pertenece a una plantilla', 400);
        }
        if ($templateVariant->templateRecipes->isEmpty()) {
            return $this->error('La variante de plantilla no tiene recetas asociadas', 400);
        }

        $outputVariant = ProductVariant::find($data['outputVariantId']);
        if (! $outputVariant) {
            return $this->error('Variante de producto no encontrada', 404);
        }

        // Verificar stock de todos los ingredientes.
        foreach ($templateVariant->templateRecipes as $recipe) {
            $required = $data['quantity'] * (float) $recipe->quantity;
            $iv = $recipe->inputVariant;
            if (! $iv || (float) $iv->currentStock < $required) {
                $name = $iv?->input?->name ?? 'insumo';
                $sku = $iv?->sku ?? '';
                $avail = $iv?->currentStock ?? 0;

                return $this->error("Stock insuficiente de {$name} ({$sku}). Disponible: {$avail}, Requerido: {$required}", 400);
            }
        }

        $user = $request->user();
        $conversion = DB::transaction(function () use ($data, $templateVariant, $outputVariant, $user) {
            $conversion = InventoryConversion::create([
                'conversionNumber' => $this->generateConversionNumber(),
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
                $iv = $recipe->inputVariant->loadMissing('color', 'size');
                ConversionInputItem::create([
                    'conversionId' => $conversion->id,
                    'inputVariantId' => $iv->id,
                    'inputCode' => $iv->input->code,
                    'inputName' => $iv->input->name,
                    'variantSku' => $iv->sku,
                    'colorName' => $iv->color?->name,
                    'sizeName' => $iv->size?->name,
                    'unitOfMeasure' => $iv->input->unitOfMeasure,
                    'unitCost' => $iv->unitCost,
                    'quantity' => $required,
                    'totalCost' => $required * (float) $iv->unitCost,
                    'notes' => "Insumo para {$data['quantity']} unidades de ".$templateVariant->product->name,
                ]);
            }

            $outputVariant->loadMissing('product', 'color', 'size');
            $unitPrice = (float) $outputVariant->product->basePrice + (float) ($outputVariant->priceAdjustment ?? 0);
            ConversionOutputItem::create([
                'conversionId' => $conversion->id,
                'variantId' => $outputVariant->id,
                'productName' => $outputVariant->product->name,
                'variantSku' => $outputVariant->sku,
                'colorName' => $outputVariant->color?->name,
                'sizeName' => $outputVariant->size?->name,
                'unitPrice' => $unitPrice,
                'quantity' => $data['quantity'],
                'totalValue' => $data['quantity'] * $unitPrice,
                'notes' => "Generado desde plantilla {$templateVariant->sku}",
            ]);

            $this->recalculateTotals($conversion->id);

            return $conversion;
        });

        return $this->created($this->formatConversion($this->loadConversion($conversion->id), true));
    }

    /** POST /api/inventory-conversions/{id}/input-items */
    public function addInputItem(Request $request, int $id)
    {
        $data = $request->validate([
            'inputVariantId' => 'required|integer',
            'quantity' => 'required|numeric|min:0.01',
            'notes' => 'nullable|string',
        ]);

        $conversion = InventoryConversion::find($id);
        if (! $conversion) {
            return $this->error('Conversión de inventario no encontrada', 404);
        }
        if ($conversion->status !== 'DRAFT') {
            return $this->error('Solo se pueden modificar conversiones en borrador', 400);
        }

        $iv = InputVariant::with('input', 'color', 'size')->find($data['inputVariantId']);
        if (! $iv) {
            return $this->error('Variante de insumo no encontrada', 404);
        }
        if ((float) $iv->currentStock < $data['quantity']) {
            return $this->error("Stock insuficiente de {$iv->input->name} ({$iv->sku}). Disponible: {$iv->currentStock} {$iv->input->unitOfMeasure}", 400);
        }

        $exists = ConversionInputItem::where('conversionId', $id)
            ->where('inputVariantId', $data['inputVariantId'])->exists();
        if ($exists) {
            return $this->error('Esta variante de insumo ya está agregada a la conversión', 400);
        }

        ConversionInputItem::create([
            'conversionId' => $id,
            'inputVariantId' => $data['inputVariantId'],
            'inputCode' => $iv->input->code,
            'inputName' => $iv->input->name,
            'variantSku' => $iv->sku,
            'colorName' => $iv->color?->name,
            'sizeName' => $iv->size?->name,
            'unitOfMeasure' => $iv->input->unitOfMeasure,
            'unitCost' => $iv->unitCost,
            'quantity' => $data['quantity'],
            'totalCost' => $data['quantity'] * (float) $iv->unitCost,
            'notes' => $data['notes'] ?? null,
        ]);
        $this->recalculateTotals($id);

        return $this->created($this->formatConversion($this->loadConversion($id), true));
    }

    /** PATCH /api/inventory-conversions/{id}/input-items/{itemId} */
    public function updateInputItem(Request $request, int $id, int $itemId)
    {
        $data = $request->validate([
            'quantity' => 'nullable|numeric|min:0.01',
            'notes' => 'nullable|string',
        ]);

        $conversion = InventoryConversion::find($id);
        if (! $conversion) {
            return $this->error('Conversión de inventario no encontrada', 404);
        }
        if ($conversion->status !== 'DRAFT') {
            return $this->error('Solo se pueden modificar conversiones en borrador', 400);
        }

        $item = ConversionInputItem::where('id', $itemId)->where('conversionId', $id)->first();
        if (! $item) {
            return $this->error('Item no encontrado', 404);
        }

        if (array_key_exists('quantity', $data) && $data['quantity'] !== null) {
            $iv = InputVariant::with('input')->find($item->inputVariantId);
            if ($iv && (float) $iv->currentStock < $data['quantity']) {
                return $this->error("Stock insuficiente de {$iv->input->name} ({$item->variantSku}). Disponible: {$iv->currentStock} {$item->unitOfMeasure}", 400);
            }
            $item->quantity = $data['quantity'];
            $item->totalCost = $data['quantity'] * (float) $item->unitCost;
            $item->notes = $data['notes'] ?? null;
            $item->save();
        } elseif (array_key_exists('notes', $data)) {
            $item->notes = $data['notes'];
            $item->save();
        }

        $this->recalculateTotals($id);

        return $this->success($this->formatConversion($this->loadConversion($id), true));
    }

    /** DELETE /api/inventory-conversions/{id}/input-items/{itemId} */
    public function removeInputItem(int $id, int $itemId)
    {
        $conversion = InventoryConversion::find($id);
        if (! $conversion) {
            return $this->error('Conversión de inventario no encontrada', 404);
        }
        if ($conversion->status !== 'DRAFT') {
            return $this->error('Solo se pueden modificar conversiones en borrador', 400);
        }

        ConversionInputItem::where('id', $itemId)->where('conversionId', $id)->delete();
        $this->recalculateTotals($id);

        return $this->success($this->formatConversion($this->loadConversion($id), true));
    }

    /** POST /api/inventory-conversions/{id}/output-items */
    public function addOutputItem(Request $request, int $id)
    {
        $data = $request->validate([
            'variantId' => 'required|integer',
            'quantity' => 'required|integer|min:1',
            'notes' => 'nullable|string',
        ]);

        $conversion = InventoryConversion::find($id);
        if (! $conversion) {
            return $this->error('Conversión de inventario no encontrada', 404);
        }
        if ($conversion->status !== 'DRAFT') {
            return $this->error('Solo se pueden modificar conversiones en borrador', 400);
        }

        $variant = ProductVariant::with('product', 'color', 'size')->find($data['variantId']);
        if (! $variant) {
            return $this->error('Variante de producto no encontrada', 404);
        }

        $exists = ConversionOutputItem::where('conversionId', $id)
            ->where('variantId', $data['variantId'])->exists();
        if ($exists) {
            return $this->error('Esta variante ya está agregada a la conversión', 400);
        }

        $unitPrice = (float) $variant->product->basePrice + (float) ($variant->priceAdjustment ?? 0);
        ConversionOutputItem::create([
            'conversionId' => $id,
            'variantId' => $data['variantId'],
            'productName' => $variant->product->name,
            'variantSku' => $variant->sku,
            'colorName' => $variant->color?->name,
            'sizeName' => $variant->size?->name,
            'unitPrice' => $unitPrice,
            'quantity' => $data['quantity'],
            'totalValue' => $data['quantity'] * $unitPrice,
            'notes' => $data['notes'] ?? null,
        ]);
        $this->recalculateTotals($id);

        return $this->created($this->formatConversion($this->loadConversion($id), true));
    }

    /** PATCH /api/inventory-conversions/{id}/output-items/{itemId} */
    public function updateOutputItem(Request $request, int $id, int $itemId)
    {
        $data = $request->validate([
            'quantity' => 'nullable|integer|min:1',
            'notes' => 'nullable|string',
        ]);

        $conversion = InventoryConversion::find($id);
        if (! $conversion) {
            return $this->error('Conversión de inventario no encontrada', 404);
        }
        if ($conversion->status !== 'DRAFT') {
            return $this->error('Solo se pueden modificar conversiones en borrador', 400);
        }

        $item = ConversionOutputItem::where('id', $itemId)->where('conversionId', $id)->first();
        if (! $item) {
            return $this->error('Item no encontrado', 404);
        }

        if (array_key_exists('quantity', $data) && $data['quantity'] !== null) {
            $item->quantity = $data['quantity'];
            $item->totalValue = $data['quantity'] * (float) $item->unitPrice;
            $item->notes = $data['notes'] ?? null;
            $item->save();
        } elseif (array_key_exists('notes', $data)) {
            $item->notes = $data['notes'];
            $item->save();
        }

        $this->recalculateTotals($id);

        return $this->success($this->formatConversion($this->loadConversion($id), true));
    }

    /** DELETE /api/inventory-conversions/{id}/output-items/{itemId} */
    public function removeOutputItem(int $id, int $itemId)
    {
        $conversion = InventoryConversion::find($id);
        if (! $conversion) {
            return $this->error('Conversión de inventario no encontrada', 404);
        }
        if ($conversion->status !== 'DRAFT') {
            return $this->error('Solo se pueden modificar conversiones en borrador', 400);
        }

        ConversionOutputItem::where('id', $itemId)->where('conversionId', $id)->delete();
        $this->recalculateTotals($id);

        return $this->success($this->formatConversion($this->loadConversion($id), true));
    }

    /** POST /api/inventory-conversions/{id}/submit */
    public function submit(int $id)
    {
        $conversion = $this->loadConversion($id);
        if (! $conversion) {
            return $this->error('Conversión de inventario no encontrada', 404);
        }
        if ($conversion->status !== 'DRAFT') {
            return $this->error('Solo se pueden enviar a aprobación conversiones en borrador', 400);
        }
        if ($conversion->inputItems->isEmpty()) {
            return $this->error('Debe agregar al menos un insumo a consumir', 400);
        }
        if ($conversion->outputItems->isEmpty()) {
            return $this->error('Debe agregar al menos un producto a generar', 400);
        }

        foreach ($conversion->inputItems as $item) {
            $iv = InputVariant::find($item->inputVariantId);
            if (! $iv) {
                return $this->error("Variante de insumo {$item->inputName} ({$item->variantSku}) no encontrada", 400);
            }
            if ((float) $iv->currentStock < (float) $item->quantity) {
                return $this->error("Stock insuficiente de {$item->inputName} ({$item->variantSku}). Disponible: {$iv->currentStock} {$item->unitOfMeasure}, Requerido: {$item->quantity}", 400);
            }
        }

        $conversion->status = 'PENDING';
        $conversion->save();

        return $this->success($this->formatConversion($this->loadConversion($id)));
    }

    /** POST /api/inventory-conversions/{id}/approve */
    public function approve(Request $request, int $id)
    {
        $conversion = $this->loadConversion($id);
        if (! $conversion) {
            return $this->error('Conversión de inventario no encontrada', 404);
        }
        if ($conversion->status !== 'PENDING') {
            return $this->error('Solo se pueden aprobar conversiones pendientes', 400);
        }

        foreach ($conversion->inputItems as $item) {
            $iv = InputVariant::find($item->inputVariantId);
            if (! $iv) {
                return $this->error("Variante de insumo {$item->inputName} ({$item->variantSku}) no encontrada", 400);
            }
            if ((float) $iv->currentStock < (float) $item->quantity) {
                return $this->error("Stock insuficiente de {$item->inputName} ({$item->variantSku}). Disponible: {$iv->currentStock} {$item->unitOfMeasure}, Requerido: {$item->quantity}", 400);
            }
        }

        $user = $request->user();
        DB::transaction(function () use ($conversion, $user) {
            foreach ($conversion->inputItems as $item) {
                $iv = InputVariant::find($item->inputVariantId);
                if (! $iv) {
                    continue;
                }
                $previousStock = (float) $iv->currentStock;
                $quantity = (float) $item->quantity;
                $iv->currentStock = $previousStock - $quantity;
                $iv->save();

                InputVariantMovement::create([
                    'inputVariantId' => $item->inputVariantId,
                    'movementType' => 'SALIDA',
                    'quantity' => -$quantity,
                    'previousStock' => $previousStock,
                    'newStock' => $previousStock - $quantity,
                    'referenceType' => 'conversion',
                    'referenceId' => $conversion->id,
                    'reason' => "Conversión a producto {$conversion->conversionNumber}",
                    'notes' => $item->notes,
                    'userId' => $user->id,
                ]);
            }

            $affectedProductIds = [];
            foreach ($conversion->outputItems as $item) {
                $variant = ProductVariant::find($item->variantId);
                $previousStock = $variant ? (int) $variant->stock : 0;
                if ($variant) {
                    $variant->stock = $previousStock + (int) $item->quantity;
                    $variant->save();
                    $affectedProductIds[$variant->productId] = true;
                }

                VariantMovement::create([
                    'variantId' => $item->variantId,
                    'movementType' => 'PURCHASE',
                    'quantity' => (int) $item->quantity,
                    'previousStock' => $previousStock,
                    'newStock' => $previousStock + (int) $item->quantity,
                    'referenceType' => 'conversion',
                    'referenceId' => $conversion->id,
                    'reason' => "Conversión desde insumos {$conversion->conversionNumber}",
                    'notes' => $item->notes,
                    'userId' => $user->id,
                ]);
            }

            // Recalcula el stock agregado de cada producto afectado
            // (la lista de productos muestra products.stock, no la suma de variantes).
            foreach (array_keys($affectedProductIds) as $productId) {
                Product::where('id', $productId)->update([
                    'stock' => (int) ProductVariant::where('productId', $productId)->sum('stock'),
                ]);
            }

            $conversion->status = 'APPROVED';
            $conversion->approvedById = $user->id;
            $conversion->approvedByName = $user->name;
            $conversion->approvedAt = now();
            $conversion->save();
        });

        return $this->success($this->formatConversion($this->loadConversion($id), true));
    }

    /** POST /api/inventory-conversions/{id}/cancel */
    public function cancel(int $id)
    {
        $conversion = InventoryConversion::find($id);
        if (! $conversion) {
            return $this->error('Conversión de inventario no encontrada', 404);
        }
        if ($conversion->status === 'APPROVED') {
            return $this->error('No se pueden cancelar conversiones aprobadas', 400);
        }

        $conversion->status = 'CANCELLED';
        $conversion->save();

        return $this->success($this->formatConversion($this->loadConversion($id)));
    }

    /** DELETE /api/inventory-conversions/{id} */
    public function destroy(int $id)
    {
        $conversion = InventoryConversion::find($id);
        if (! $conversion) {
            return $this->error('Conversión de inventario no encontrada', 404);
        }
        if (! in_array($conversion->status, ['DRAFT', 'CANCELLED'], true)) {
            return $this->error('Solo se pueden eliminar conversiones en borrador o canceladas', 400);
        }

        $conversion->delete();

        return $this->success(null, 'Conversión eliminada exitosamente');
    }
}
