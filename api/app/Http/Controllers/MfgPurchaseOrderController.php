<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Services\Manufacturing\MfgPurchaseOrderService;
use Illuminate\Http\Request;

/**
 * Pedidos de clientes de la app Fábrica. Valida y responde; el detalle y la generación de
 * producción los hace MfgPurchaseOrderService.
 */
class MfgPurchaseOrderController extends Controller
{
    use ApiResponse;

    public function __construct(private MfgPurchaseOrderService $orders) {}

    public function index(Request $request)
    {
        return $this->success($this->orders->list([
            'status' => $request->filled('status') ? (string) $request->string('status') : null,
            'search' => $request->filled('search') ? (string) $request->string('search') : null,
        ]));
    }

    public function show(int $id)
    {
        return $this->success($this->orders->detail($id));
    }

    public function generateNumber()
    {
        return $this->success(['code' => $this->orders->peekCode()]);
    }

    public function store(Request $request)
    {
        $data = $this->validateData($request);

        return $this->created($this->orders->create($data, $request->user()?->id), 'Pedido creado');
    }

    public function update(Request $request, int $id)
    {
        $this->orders->assertEditable($id);
        $data = $this->validateData($request);

        return $this->success($this->orders->update($id, $data), 'Pedido actualizado');
    }

    public function changeStatus(Request $request, int $id)
    {
        $this->orders->findOrFail($id);
        $data = $request->validate(['status' => 'required|in:DRAFT,APPROVED,IN_PRODUCTION,DELIVERED,CANCELLED']);

        return $this->success($this->orders->changeStatus($id, $data['status']), 'Estado actualizado');
    }

    public function destroy(int $id)
    {
        $this->orders->delete($id);

        return $this->success(null, 'Pedido eliminado');
    }

    /** Genera las órdenes de producción del pedido (todas las referencias pendientes o las elegidas). */
    public function generateProduction(Request $request, int $id)
    {
        $onlyRefs = $request->input('referenceIds');
        $result = $this->orders->generateProduction($id, is_array($onlyRefs) ? $onlyRefs : null, $request->user()?->id);

        return $this->success($result, 'Se generaron '.$result['created'].' orden(es) de producción');
    }

    private function validateData(Request $request): array
    {
        return $request->validate([
            'clientId' => 'required|integer|exists:mfg_clients,id',
            'collectionId' => 'nullable|integer|exists:mfg_collections,id',
            'semester' => 'nullable|in:I,II',
            'market' => 'nullable|in:NATIONAL,EXPORT',
            'status' => 'nullable|in:DRAFT,APPROVED,IN_PRODUCTION,DELIVERED,CANCELLED',
            'dispatchStartDate' => 'nullable|date',
            'deliveryDate' => 'nullable|date',
            'partialDates' => 'nullable|array|max:4',
            'partialDates.*' => 'nullable|date',
            'notes' => 'nullable|string',
            'references' => 'required|array|min:1',
            'references.*.referenceId' => 'required|integer|exists:mfg_references,id',
            'references.*.items' => 'required|array|min:1',
            'references.*.items.*.colorId' => 'required|integer|exists:mfg_colors,id',
            'references.*.items.*.sizeId' => 'required|integer|exists:mfg_sizes,id',
            'references.*.items.*.quantity' => 'required|integer|min:0',
        ]);
    }
}
