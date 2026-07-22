<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Models\MfgWarehouseStock;
use Illuminate\Http\Request;

/**
 * Inventario de producto terminado por bodega (llenado por los lotes de producción).
 */
class MfgInventoryController extends Controller
{
    use ApiResponse;

    public function index(Request $request)
    {
        $query = MfgWarehouseStock::with([
            'warehouse:id,name',
            'reference:id,code,name',
            'color:id,name,hexCode',
            'size:id,name,abbreviation,sortOrder',
        ])->where('quantity', '>', 0);

        if ($request->filled('warehouseId')) {
            $query->where('warehouseId', $request->integer('warehouseId'));
        }

        return $this->success($query->get());
    }
}
