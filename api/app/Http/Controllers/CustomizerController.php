<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Models\Product;
use App\Services\CustomizationPricingService;
use Illuminate\Http\Request;

/** Personalizador de la tienda: cotización del precio de un diseño. */
class CustomizerController extends Controller
{
    use ApiResponse;

    public function __construct(private CustomizationPricingService $pricing) {}

    /** Precio de una plantilla con las zonas diseñadas (el mismo que cobra el pedido). */
    public function quote(Request $request)
    {
        $data = $request->validate([
            'templateId' => 'required|integer',
            'templateZoneIds' => 'present|array|max:20',
            'templateZoneIds.*' => 'integer',
        ]);

        $template = Product::where('isTemplate', true)->where('isActive', true)->find($data['templateId']);
        if (! $template) {
            return $this->error('Plantilla no encontrada', 404);
        }

        return $this->success($this->pricing->quote($template, $data['templateZoneIds']));
    }
}
