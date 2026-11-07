<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Services\Manufacturing\MfgDispatchService;
use Illuminate\Http\Request;

/**
 * Inventario de producto terminado por bodega (llenado por los lotes de producción).
 */
class MfgInventoryController extends Controller
{
    use ApiResponse;

    public function __construct(private MfgDispatchService $dispatches) {}

    public function index(Request $request)
    {
        return $this->success($this->dispatches->warehouseStock($request->filled('warehouseId') ? $request->integer('warehouseId') : null));
    }
}
