<?php

namespace App\Support;

use App\Models\Setting;
use Illuminate\Support\Facades\DB;

final class BrandIdentitySettings
{
    public static function definitions(): array
    {
        return [
            'general_settings' => [
                'siteName' => 'TOCLEX',
                'siteDescription' => 'Ropa con temáticas que te representan y prendas personalizadas.',
                'slogan' => 'Made with intention',
                'logo' => '/brand/toclex-logo.png',
                'logoOnDark' => '/brand/toclex-logo-light.png',
                'favicon' => '/brand/toclex-icon.png',
                'brandColors' => [
                    'primary' => '#1F1D1E',
                    'secondary' => '#747474',
                    'accent' => '#ABD04C',
                ],
            ],
            'appearance_settings' => [
                'brandColors' => [
                    'primary' => '#1F1D1E',
                    'secondary' => '#747474',
                    'accent' => '#ABD04C',
                ],
                'buttonColor' => '#1F1D1E',
                'headerBgColor' => '#F3F3EE',
                'showSlogan' => true,
                'headerStyle' => 'default',
                'footerBgColor' => '#1F1D1E',
                'useGradientHero' => false,
            ],
            'store_settings' => [
                'storeName' => 'TOCLEX',
            ],
        ];
    }

    public static function apply(): void
    {
        DB::transaction(function (): void {
            foreach (self::definitions() as $key => $fields) {
                $setting = Setting::firstOrNew(['key' => $key]);
                $setting->value = array_replace((array) $setting->value, $fields);
                $setting->save();
            }
        });
    }
}
