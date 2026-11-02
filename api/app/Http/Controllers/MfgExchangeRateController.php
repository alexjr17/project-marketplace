<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Models\MfgExchangeRate;
use App\Services\MfgExchangeRateService;
use Illuminate\Http\Request;

/** Tasa de cambio COP→USD (para precios de exportación en dólares). */
class MfgExchangeRateController extends Controller
{
    use ApiResponse;

    public function __construct(private MfgExchangeRateService $service) {}

    public function index()
    {
        return $this->success(MfgExchangeRate::orderByDesc('id')->get());
    }

    /** Tasa activa vigente (para el formulario de referencia). */
    public function active()
    {
        return $this->success(MfgExchangeRate::active());
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            // decimal(12,4): el máximo que cabe en la columna.
            'rate' => 'required|numeric|min:0.0001|max:99999999.9999',
            'currency' => 'nullable|string|size:3|alpha',
            'effectiveDate' => 'nullable|date',
        ]);

        return $this->created($this->service->store($data), 'Tasa de cambio registrada');
    }

    public function destroy(int $id)
    {
        $r = MfgExchangeRate::find($id);
        if (! $r) {
            return $this->error('Tasa no encontrada', 404);
        }
        $this->service->destroy($r);

        return $this->success(null, 'Tasa eliminada');
    }
}
