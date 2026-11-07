<?php

namespace App\Services\Settings;

use App\Models\Setting;
use App\Models\User;
use App\Services\PaymentGatewayConfig;

/**
 * Configuración de la tienda guardada por clave en la tabla settings: qué tipo va en qué
 * clave, quién puede leer/guardar cada tipo y qué parte es pública.
 */
class SettingsService
{
    /** Tipo de configuración → clave en la tabla settings. */
    public const TYPE_KEYS = [
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

    /**
     * Permiso que exige cada tipo. Quien tenga cualquiera de los permisos listados puede leer
     * y guardar ese tipo; el SuperAdmin, todos.
     */
    public const TYPE_PERMISSIONS = [
        'store' => ['settings.general'],
        'orders' => ['settings.general'],
        'notifications' => ['settings.general'],
        'general' => ['settings.general'],
        'payments' => ['settings.payment'],
        'appearance' => ['settings.appearance'],
        'shipping' => ['shipping.config', 'shipping.zones', 'shipping.carriers', 'shipping.connections'],
        'home' => ['settings.home'],
        'catalog' => ['settings.catalog'],
        'legal' => ['settings.legal'],
        'printing' => ['settings.printing'],
    ];

    /**
     * Permisos que además dejan LEER (no editar) un tipo: el POS necesita el formato de
     * impresión del recibo (antes el cajero recibía 403 y el historial usaba el formato por defecto).
     */
    private const READ_ONLY_PERMISSIONS = [
        'printing' => ['pos.access'],
    ];

    public function keyFor(string $type): ?string
    {
        return self::TYPE_KEYS[$type] ?? null;
    }

    public function canAccessType(User $user, string $type): bool
    {
        if ((int) $user->roleId === 1) {
            return true;
        }
        $perms = is_array($user->role?->permissions) ? $user->role->permissions : [];

        return (bool) array_intersect(self::TYPE_PERMISSIONS[$type] ?? [], $perms);
    }

    /** Puede leer el tipo: quien lo puede editar o quien tiene un permiso de solo lectura. */
    public function canReadType(User $user, string $type): bool
    {
        if ($this->canAccessType($user, $type)) {
            return true;
        }
        $perms = is_array($user->role?->permissions) ? $user->role->permissions : [];

        return (bool) array_intersect(self::READ_ONLY_PERMISSIONS[$type] ?? [], $perms);
    }

    public function read(string $key): array
    {
        $value = Setting::where('key', $key)->first()?->value;

        return is_array($value) ? $value : [];
    }

    public function write(string $key, mixed $value): Setting
    {
        return Setting::updateOrCreate(['key' => $key], ['value' => $value]);
    }

    /** Lo que la tienda puede ver sin sesión (sin las claves secretas de las pasarelas). */
    public function publicSettings(): array
    {
        return [
            'store' => $this->read('store_settings'),
            'general' => $this->read('general_settings'),
            'appearance' => $this->read('appearance_settings'),
            'home' => $this->read('home_settings'),
            'catalog' => $this->read('catalog_settings'),
            'shipping' => $this->read('shipping_settings'),
            'payment' => PaymentGatewayConfig::publicView($this->read('payment_settings')),
            'legal' => $this->read('legal_settings'),
        ];
    }
}
