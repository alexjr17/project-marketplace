<?php

namespace Tests\Feature\Flows\Customizer;

use App\Models\Product;
use App\Models\TemplateZone;
use App\Models\ZoneType;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\ActsAsRoles;
use Tests\Feature\Flows\Store\Concerns\StoreFixtures;
use Tests\TestCase;

/** Pasar una plantilla 3D a fotos con las fotos y las zonas de otra plantilla. */
class TemplateViewsTest extends TestCase
{
    use ActsAsRoles, RefreshDatabase, StoreFixtures;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRolesAndUsers();
        $this->seedStoreCatalog();
    }

    private function zone(Product $t, string $slug, array $a = []): TemplateZone
    {
        return TemplateZone::create(array_merge([
            'templateId' => $t->id, 'zoneTypeId' => ZoneType::where('slug', $slug)->value('id'), 'zoneId' => 'z-'.uniqid(),
            'name' => ucfirst($slug), 'shape' => 'rect', 'positionX' => 40, 'positionY' => 30, 'maxWidth' => 18, 'maxHeight' => 22,
            'isEditable' => true, 'isRequired' => false, 'isBlocked' => false, 'price' => 8000, 'sortOrder' => 1, 'isActive' => true,
        ], $a));
    }

    public function test_copia_fotos_y_acomoda_zonas_sin_tocar_precios(): void
    {
        $this->actingAsAdmin();
        $foto = $this->makeProduct('Camiseta Premium', 52000, [['negro', 'M', 2]], [
            'isTemplate' => true, 'zoneTypeImages' => ['frente' => '/uploads/f.png', 'espalda' => '/uploads/e.png'],
        ]);
        $this->zone($foto, 'frente', ['positionX' => 34, 'positionY' => 23.6, 'maxWidth' => 31.2, 'maxHeight' => 36.8, 'price' => 0]);
        $this->zone($foto, 'frente', ['name' => 'Pecho', 'positionX' => 55, 'maxWidth' => 10, 'maxHeight' => 9, 'price' => 0]);
        $this->zone($foto, 'espalda', ['positionX' => 32.7, 'positionY' => 21, 'maxWidth' => 33.4, 'maxHeight' => 43.8, 'price' => 0]);

        $tres = $this->makeProduct('Suéter 3D', 22000, [['negro', 'M', 2]], ['isTemplate' => true, 'model3d' => 'basica']);
        $f = $this->zone($tres, 'frente');
        $e = $this->zone($tres, 'espalda');

        $r = $this->postJson("/api/templates/{$tres->id}/copy-views", ['fromId' => $foto->id])->assertOk()->json('data');
        $this->assertNull($r['model3d']);
        $this->assertSame(['frente' => '/uploads/f.png', 'espalda' => '/uploads/e.png'], $r['zoneTypeImages']);
        $this->assertSame(['views' => 2, 'zones' => 2], $r['copied']);
        // La zona toma el lugar de la más grande del mismo tipo (no el pecho) y conserva su precio.
        $f->refresh();
        $this->assertEquals([34, 23.6, 31.2, 36.8, 8000], [$f->positionX, $f->positionY, $f->maxWidth, $f->maxHeight, $f->price]);
        $this->assertEquals([32.7, 21, 33.4, 43.8], [$e->fresh()->positionX, $e->fresh()->positionY, $e->fresh()->maxWidth, $e->fresh()->maxHeight]);

        // Sin fotos en el origen, o la misma plantilla: no.
        $vacia = $this->makeProduct('Sin fotos', 1000, [['negro', 'M', 1]], ['isTemplate' => true]);
        $this->postJson("/api/templates/{$tres->id}/copy-views", ['fromId' => $vacia->id])->assertUnprocessable();
        $this->postJson("/api/templates/{$tres->id}/copy-views", ['fromId' => $tres->id])->assertUnprocessable();
        $this->postJson('/api/templates/999999/copy-views', ['fromId' => $foto->id])->assertNotFound();

        $this->actingAsCliente();
        $this->postJson("/api/templates/{$tres->id}/copy-views", ['fromId' => $foto->id])->assertForbidden();
    }
}
