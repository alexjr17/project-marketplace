<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Services\Pos\CashSessionService;
use Illuminate\Http\Request;

/**
 * Cajas registradoras y sesiones de caja del POS. Valida y responde; la apertura, el cierre
 * con cuadre y el reporte los hace CashSessionService.
 */
class CashRegisterController extends Controller
{
    use ApiResponse;

    public function __construct(private CashSessionService $cash) {}

    /** GET /api/cash-registers */
    public function index(Request $request)
    {
        return $this->success($this->cash->registers($request->query('activeOnly') === 'true'));
    }

    /** GET /api/cash-registers/my-session */
    public function mySession(Request $request)
    {
        return $this->success($this->cash->mySession($request->user()->id));
    }

    /** GET /api/cash-registers/{id} */
    public function show(int $id)
    {
        return $this->success($this->cash->register($id));
    }

    /** POST /api/cash-registers */
    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string',
            'location' => 'required|string',
            'code' => 'required|string',
            'categoryIds' => 'nullable|array',
            'categoryIds.*' => 'integer',
        ]);

        return $this->created($this->cash->createRegister($data), 'Caja registradora creada exitosamente');
    }

    /** PATCH /api/cash-registers/{id} */
    public function update(Request $request, int $id)
    {
        $data = $request->validate([
            'name' => 'sometimes|string',
            'location' => 'sometimes|string',
            'code' => 'sometimes|string',
            'isActive' => 'sometimes|boolean',
            'categoryIds' => 'sometimes|nullable|array',
            'categoryIds.*' => 'integer',
        ]);

        return $this->success($this->cash->updateRegister($id, $data), 'Caja registradora actualizada exitosamente');
    }

    /** DELETE /api/cash-registers/{id} */
    public function destroy(int $id)
    {
        $this->cash->deleteRegister($id);

        return $this->success(null, 'Caja registradora eliminada exitosamente');
    }

    /** POST /api/cash-registers/{id}/open-session */
    public function openSession(Request $request, int $id)
    {
        $data = $request->validate([
            'initialCash' => 'required|numeric',
            'notes' => 'nullable|string',
        ]);

        return $this->created($this->cash->open($id, $request->user(), $data), 'Sesión abierta exitosamente');
    }

    /** POST /api/cash-registers/sessions/{id}/close */
    public function closeSession(Request $request, int $id)
    {
        $data = $request->validate([
            'finalCash' => 'required|numeric',
            'notes' => 'nullable|string',
        ]);

        return $this->success($this->cash->close($id, $request->user(), $data), 'Sesión cerrada exitosamente');
    }

    /** GET /api/cash-registers/sessions */
    public function listSessions(Request $request)
    {
        return $this->success($this->cash->sessions([
            'cashRegisterId' => $request->filled('cashRegisterId') ? (int) $request->query('cashRegisterId') : null,
            'sellerId' => $request->filled('sellerId') ? (int) $request->query('sellerId') : null,
            'status' => $request->filled('status') ? $request->query('status') : null,
            'dateFrom' => $request->filled('dateFrom') ? $request->query('dateFrom') : null,
            'dateTo' => $request->filled('dateTo') ? $request->query('dateTo') : null,
        ]));
    }

    /** GET /api/cash-registers/sessions/{id}/report */
    public function sessionReport(int $id)
    {
        return $this->success($this->cash->report($id));
    }
}
