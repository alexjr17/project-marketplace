<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Services\Orders\ShippingRateSyncService;
use Illuminate\Http\Request;

/** Sincronización de tarifas de envío. La lógica vive en Orders\ShippingRateSyncService. */
class ShippingController extends Controller
{
    use ApiResponse;

    public function __construct(private ShippingRateSyncService $rates) {}

    /** POST /api/shipping/sync-rates */
    public function syncRates(Request $request)
    {
        $data = $request->validate([
            'zones' => 'required|array|min:1',
            'zones.*.id' => 'required|string',
            'zones.*.name' => 'required|string',
            'zones.*.cities' => 'nullable|array',
            'apiConfig' => 'nullable|array',
            'origin' => 'nullable|array',
            'packageDefaults' => 'nullable|array',
            'carrierCode' => 'nullable|string',
            'declaredValue' => 'nullable|numeric',
        ]);

        return $this->success($this->rates->sync($data));
    }
}
