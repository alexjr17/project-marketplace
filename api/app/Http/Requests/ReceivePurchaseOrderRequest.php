<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/** POST /api/purchase-orders/{id}/receive — el permiso lo pone la ruta (purchase_orders.view). */
class ReceivePurchaseOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'items' => 'required|array|min:1',
            'items.*.itemId' => 'required|integer',
            'items.*.quantityReceived' => 'required|numeric|min:0',
        ];
    }
}
