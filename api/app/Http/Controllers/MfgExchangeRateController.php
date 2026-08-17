<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Models\MfgExchangeRate;
use Illuminate\Http\Request;

/** Tasa de cambio COP→USD (para precios de exportación en dólares). */
class MfgExchangeRateController extends Controller
{
    use ApiResponse;

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
            'rate' => 'required|numeric|min:0.0001',
            'currency' => 'nullable|string|max:10',
            'effectiveDate' => 'nullable|date',
        ]);
        // La nueva tasa queda como la activa; se desactivan las anteriores.
        MfgExchangeRate::query()->update(['isActive' => false]);
        $r = MfgExchangeRate::create([
            'rate' => $data['rate'],
            'currency' => $data['currency'] ?? 'USD',
            'effectiveDate' => $data['effectiveDate'] ?? now()->toDateString(),
            'isActive' => true,
        ]);

        return $this->created($r, 'Tasa de cambio registrada');
    }

    public function destroy(int $id)
    {
        $r = MfgExchangeRate::find($id);
        if (! $r) {
            return $this->error('Tasa no encontrada', 404);
        }
        $r->delete();

        return $this->success(null, 'Tasa eliminada');
    }
}
