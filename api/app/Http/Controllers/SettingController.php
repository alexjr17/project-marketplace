<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Models\Setting;
use Illuminate\Http\Request;

class SettingController extends Controller
{
    use ApiResponse;

    /** Mapeo de tipo de configuración → key en la tabla settings. */
    private const TYPE_KEYS = [
        'store' => 'store_settings',
        'orders' => 'order_settings',
        'payments' => 'payment_settings',
        'notifications' => 'notification_settings',
        'general' => 'general_settings',
        'appearance' => 'appearance_settings',
        'shipping' => 'shipping_settings',
        'home' => 'home_settings',
        'catalog' => 'catalog_settings',
        'legal' => 'legal_settings',
        'printing' => 'printing_settings',
    ];

    private function readSetting(string $key): array
    {
        $setting = Setting::where('key', $key)->first();

        return is_array($setting?->value) ? $setting->value : [];
    }

    private function writeSetting(string $key, $value): Setting
    {
        return Setting::updateOrCreate(['key' => $key], ['value' => $value]);
    }

    // ==================== PÚBLICO ====================

    public function getPublic()
    {
        return $this->success([
            'store' => $this->readSetting('store_settings'),
            'general' => $this->readSetting('general_settings'),
            'appearance' => $this->readSetting('appearance_settings'),
            'home' => $this->readSetting('home_settings'),
            'catalog' => $this->readSetting('catalog_settings'),
            'shipping' => $this->readSetting('shipping_settings'),
            'payment' => $this->readSetting('payment_settings'),
            'legal' => $this->readSetting('legal_settings'),
        ]);
    }

    // ==================== CONFIG POR TIPO ====================

    public function getConfig(string $type)
    {
        $key = self::TYPE_KEYS[$type] ?? null;
        if (! $key) {
            return $this->error('Tipo de configuración no válido', 404);
        }

        return $this->success($this->readSetting($key));
    }

    public function updateConfig(Request $request, string $type)
    {
        $key = self::TYPE_KEYS[$type] ?? null;
        if (! $key) {
            return $this->error('Tipo de configuración no válido', 404);
        }

        $setting = $this->writeSetting($key, $request->all());

        return $this->success($setting->value, 'Configuración actualizada');
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
        $setting = $this->writeSetting($key, $request->input('value'));

        return $this->success($setting, 'Configuración actualizada exitosamente');
    }
}
