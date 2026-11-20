<?php

namespace Tests\Feature\Commands;

use App\Models\Category;
use App\Models\Product;
use App\Models\Role;
use App\Models\Setting;
use App\Models\User;
use Database\Seeders\ProductionCatalogSeeder;
use Database\Seeders\ProductionInitialSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class SeedIfEmptyTest extends TestCase
{
    use RefreshDatabase;

    public function test_production_initial_seed_preserves_existing_admin_and_does_not_load_demo_records(): void
    {
        $this->seed(RoleSeeder::class);

        $admin = User::create([
            'email' => 'owner@example.test',
            'passwordHash' => Hash::make('not-a-demo-password'),
            'name' => 'Store Owner',
            'roleId' => Role::where('slug', 'superadmin')->value('id'),
            'status' => 'ACTIVE',
        ]);
        Setting::create(['key' => 'custom_setting', 'value' => ['keep' => true]]);
        Setting::create(['key' => 'seedVersion', 'value' => ['v' => 'older-version']]);
        Setting::create(['key' => 'store_settings', 'value' => ['storeName' => 'Nombre existente', 'nit' => '123456']]);

        $this->app->detectEnvironment(fn () => 'production');

        $this->artisan('app:seed-if-empty')->assertSuccessful();

        $this->assertDatabaseHas('users', ['id' => $admin->id, 'email' => 'owner@example.test']);
        $this->assertDatabaseHas('settings', ['key' => 'custom_setting']);
        $this->assertSame('older-version', Setting::where('key', 'seedVersion')->firstOrFail()->value['v']);
        $storeSettings = Setting::where('key', 'store_settings')->firstOrFail()->value;
        $this->assertSame('TOCLEX', $storeSettings['storeName']);
        $this->assertSame('123456', $storeSettings['nit']);
        $this->assertDatabaseHas('products', ['sku' => 'SUE-0019-MW655HJ4']);
        $this->assertDatabaseHas('products', ['sku' => 'TPL-OVERSIZE-PREMIUM']);
        $this->assertDatabaseMissing('products', ['sku' => 'PRD-0001']);
        $this->assertDatabaseMissing('products', ['sku' => 'QAOLA4-N']);
        $this->assertDatabaseMissing('users', ['email' => 'admin@vexa.com']);
        $this->assertDatabaseHas('settings', ['key' => ProductionInitialSeeder::MARKER_SETTING]);

        $shirt = Product::where('sku', 'TPL-OVERSIZE-PREMIUM')->firstOrFail();
        $this->assertSame('Suéter Básico Blanco', Product::where('sku', 'SUE-0019-MW655HJ4')->value('name'));
        $this->assertSame(
            Category::where('slug', 'camisetas')->value('id'),
            $shirt->categoryId
        );
        $this->assertSame(0, $shirt->variants()->sum('stock'));

        $variant = $shirt->variants()->firstOrFail();
        $variant->update(['stock' => 17]);
        app(ProductionCatalogSeeder::class)->run();
        $this->assertSame(17, $variant->fresh()->stock);
    }

    public function test_production_initial_seed_runs_only_once_automatically(): void
    {
        $this->seed(RoleSeeder::class);
        $this->app->detectEnvironment(fn () => 'production');

        $this->artisan('app:seed-if-empty')->assertSuccessful();
        $productCount = Product::count();

        Product::where('sku', 'SUE-0019-MW655HJ4')->update(['basePrice' => 99999]);
        $this->artisan('app:seed-if-empty')->assertSuccessful();

        $this->assertSame($productCount, Product::count());
        $this->assertDatabaseHas('products', [
            'sku' => 'SUE-0019-MW655HJ4',
            'basePrice' => 99999,
        ]);
    }
}
