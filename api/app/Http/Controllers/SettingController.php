<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Models\Setting;
use App\Services\Settings\SettingsService;
use Illuminate\Http\Request;

/**
 * Configuración por tipo (con permiso por tipo) y genérica por clave (solo SuperAdmin).
 * Qué clave y qué permiso corresponde a cada tipo lo define SettingsService.
 */
class SettingController extends Controller
{
    use ApiResponse;

    public function __construct(private SettingsService $settings) {}

    // ==================== PÚBLICO ====================

    public function getPublic()
    {
        return $this->success($this->settings->publicSettings());
    }

    // ==================== CONFIG POR TIPO ====================

    public function getConfig(Request $request, string $type)
    {
        $key = $this->settings->keyFor($type);
        if (! $key) {
            return $this->error('Tipo de configuración no válido', 404);
        }
        if (! $this->settings->canReadType($request->user(), $type)) {
            return $this->error('No tienes permiso para esta configuración', 403);
        }

        return $this->success($this->settings->read($key));
    }

    public function updateConfig(Request $request, string $type)
    {
        $key = $this->settings->keyFor($type);
        if (! $key) {
            return $this->error('Tipo de configuración no válido', 404);
        }
        if (! $this->settings->canAccessType($request->user(), $type)) {
            return $this->error('No tienes permiso para esta configuración', 403);
        }

        return $this->success($this->settings->write($key, $request->all())->value, 'Configuración actualizada');
    }

    // ==================== GENÉRICO (admin) ====================

    public function index()
    {
        return $this->success(Setting::all());
    }

    public function showByKey(string $key)
    {
        return $this->success(Setting::where('key', $key)->first());
    }

    public function updateByKey(Request $request, string $key)
    {
        return $this->success($this->settings->write($key, $request->input('value')), 'Configuración actualizada exitosamente');
    }
}
