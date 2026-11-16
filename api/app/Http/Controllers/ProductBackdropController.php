<?php

namespace App\Http\Controllers;

use App\Exceptions\BusinessRuleException;
use App\Http\Concerns\ApiResponse;
use App\Models\Product;
use App\Services\Catalog\ProductBackdropService;
use App\Services\Marketing\MarketingImageService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Fondo de la foto del producto en la tienda (productos y plantillas). Reglas en ProductBackdropService. */
class ProductBackdropController extends Controller
{
    use ApiResponse;

    public function __construct(private ProductBackdropService $backdrops, private MarketingImageService $images) {}

    /** PUT /products/{id}/backdrop { url | null }: pone el fondo (y recorta la foto) o lo quita. */
    public function update(Request $request, int $id)
    {
        $data = $request->validate(['url' => 'present|nullable|string|max:600']);
        $product = Product::find($id) ?? throw new BusinessRuleException('Producto no encontrado', 404);
        $r = $this->backdrops->set($product, $data['url']);

        return $this->success($r, $r['warning'] ?? ($r['backdrop'] ? 'Fondo guardado' : 'Fondo quitado'));
    }

    /** POST /products/backdrop/ai: fondo generado con IA (a partir de la foto del producto y su paleta). */
    public function ai(Request $request)
    {
        $data = $request->validate([
            'style' => ['required', Rule::in(array_keys(MarketingImageService::BACKDROP_STYLES))],
            'idea' => 'nullable|string|max:300',
            'palette' => 'nullable|array|max:6',
            'palette.*' => ['string', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'designs' => 'nullable|array|max:3',
            'designs.*' => ['string', 'max:400000', 'regex:/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+\/=]+$/'],
            'ratio' => ['nullable', Rule::in(array_keys(MarketingImageService::RATIOS))],
        ]);
        // Es el escenario de la foto de un producto: sin texto y con el centro libre.
        $idea = trim(($data['idea'] ?? '').' Fondo para la foto de un producto en una tienda en línea: el centro despejado para poner el producto, sin textos ni personas.');

        return $this->success($this->images->backdrop($data['style'], $idea, $data['palette'] ?? [], $data['designs'] ?? [], $data['ratio'] ?? '1:1'));
    }
}
