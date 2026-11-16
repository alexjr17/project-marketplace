<?php

namespace Tests\Feature\Flows\Customizer;

use App\Models\DesignFamily;
use App\Models\DesignImage;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\ActsAsRoles;
use Tests\TestCase;

/**
 * Galería del personalizador: diseños con nombre editable (textos editables), temporada y familias
 * de diseños para el pack familiar (Papá, Mamá, Hijo…).
 */
class DesignLibraryTest extends TestCase
{
    use ActsAsRoles, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRolesAndUsers();
    }

    private function design(array $over = []): array
    {
        return $this->postJson('/api/design-images', array_merge([
            'name' => 'Reno', 'thumbnailUrl' => 'data:image/png;base64,AAA', 'fullUrl' => 'https://drive.example/reno',
            'category' => 'Navidad', 'season' => 'Navidad',
        ], $over))->assertCreated()->json('data');
    }

    public function test_textos_editables_se_guardan_ordenados_y_seguros(): void
    {
        $this->actingAsAdmin();
        $d = $this->design([
            'printUrl' => '/uploads/designs/reno.png',
            'textFields' => [
                ['label' => 'Nombre', 'default' => 'Sofía', 'maxLength' => 12, 'box' => ['x' => 10, 'y' => 75, 'w' => 200, 'h' => 15],
                    'style' => ['font' => 'Mountains of Christmas', 'color' => '#c62828', 'shape' => 'arco', 'curve' => 30, 'outline' => ['color' => '#ffffff', 'width' => 6], 'shadow' => ['blur' => 9]]],
                ['label' => 'Nombre', 'default' => 'Un texto demasiado largo para el máximo', 'maxLength' => 5, 'style' => ['shape' => 'espiral', 'color' => 'rojo']],
            ],
        ]);
        $this->assertSame('navidad', $d['season']);
        $this->assertSame('/uploads/designs/reno.png', $d['printUrl']);
        [$a, $b] = $d['textFields'];
        $this->assertSame(['nombre', 'Nombre', 'Sofía', 12], [$a['key'], $a['label'], $a['default'], $a['maxLength']]);
        // La caja no se sale de la imagen.
        $this->assertEquals(['x' => 10, 'y' => 75, 'w' => 90, 'h' => 15], $a['box']);
        $this->assertSame(['font' => 'Mountains of Christmas', 'color' => '#C62828', 'shape' => 'arco', 'outline' => ['color' => '#FFFFFF', 'width' => 6]],
            array_intersect_key($a['style'], array_flip(['font', 'color', 'shape', 'outline'])));
        // Para DTF: nada de sombras.
        $this->assertArrayNotHasKey('shadow', $a['style']);
        // Claves únicas, texto recortado al máximo, forma y color desconocidos → por defecto.
        $this->assertNotSame($a['key'], $b['key']);
        $this->assertSame('Un te', $b['default']);
        $this->assertSame(['recto', '#111111'], [$b['style']['shape'], $b['style']['color']]);

        // Se pueden quitar los textos (vuelve a ser un diseño normal).
        $this->putJson('/api/design-images/'.$d['id'], ['textFields' => null])->assertOk()->assertJsonPath('data.textFields', null);
        $this->putJson('/api/design-images/'.$d['id'], ['textFields' => array_fill(0, 7, ['label' => 'x'])])->assertUnprocessable();
    }

    public function test_filtros_de_la_galeria_temporada_y_con_nombre(): void
    {
        $this->actingAsAdmin();
        $named = $this->design(['textFields' => [['label' => 'Nombre']]]);
        $this->design(['name' => 'Estrella']);
        $this->design(['name' => 'Corazón', 'season' => null, 'category' => 'Amor']);

        $this->assertSame([$named['id']], array_column($this->getJson('/api/design-images?named=1')->assertOk()->json('data'), 'id'));
        $this->assertCount(2, $this->getJson('/api/design-images?season=navidad')->json('data'));
        $this->assertSame(['navidad'], $this->getJson('/api/design-images/seasons')->assertOk()->json('data'));
    }

    public function test_familias_para_el_pack_familiar(): void
    {
        $this->actingAsAdmin();
        $papa = $this->design(['name' => 'Reno papá', 'textFields' => [['label' => 'Nombre']]]);
        $mama = $this->design(['name' => 'Reno mamá', 'textFields' => [['label' => 'Nombre']]]);
        $hijo = $this->design(['name' => 'Reno hijo', 'textFields' => [['label' => 'Nombre']]]);

        $f = $this->postJson('/api/design-families', [
            'name' => 'Familia Reno', 'season' => 'Navidad',
            'designs' => [['id' => $papa['id'], 'role' => 'Papá'], ['id' => $mama['id'], 'role' => 'Mamá'], ['id' => $hijo['id'], 'role' => 'Hijo']],
        ])->assertCreated()->json('data');
        $this->assertSame('navidad', $f['season']);
        $this->assertSame(['Papá', 'Mamá', 'Hijo'], array_column($f['designs'], 'familyRole'));

        // Se reordena y sale uno: el que sale queda suelto en la galería.
        $f = $this->putJson('/api/design-families/'.$f['id'], ['designs' => [['id' => $mama['id'], 'role' => 'Mamá'], ['id' => $papa['id'], 'role' => 'Papá']]])
            ->assertOk()->json('data');
        $this->assertSame(['Reno mamá', 'Reno papá'], array_column($f['designs'], 'name'));
        $this->assertNull(DesignImage::find($hijo['id'])->familyId);

        // La tienda ve la familia con sus diseños activos; sin diseños activos no aparece.
        $this->postJson('/api/logout');
        $this->app['auth']->forgetGuards();
        $this->assertSame(['Familia Reno'], array_column($this->getJson('/api/design-families')->assertOk()->json('data'), 'name'));
        $this->getJson('/api/design-families/'.$f['id'])->assertOk()->assertJsonCount(2, 'data.designs');
        DesignImage::whereIn('id', [$papa['id'], $mama['id']])->update(['isActive' => false]);
        $this->assertSame([], $this->getJson('/api/design-families')->json('data'));

        // Eliminar la familia deja los diseños.
        $this->actingAsAdmin();
        $this->deleteJson('/api/design-families/'.$f['id'])->assertOk();
        $this->assertSame(0, DesignFamily::count());
        $this->assertSame(3, DesignImage::count());
        $this->assertSame(0, DesignImage::whereNotNull('familyId')->count());
    }

    public function test_permisos(): void
    {
        $this->getJson('/api/design-families')->assertOk();
        $this->postJson('/api/design-families', ['name' => 'X'])->assertUnauthorized();
        $this->actingAsCliente();
        $this->postJson('/api/design-families', ['name' => 'X'])->assertForbidden();
        $this->getJson('/api/design-families/admin')->assertForbidden();
        $this->postJson('/api/design-images', ['name' => 'X', 'thumbnailUrl' => 'a', 'fullUrl' => 'b', 'textFields' => [['label' => 'Nombre']]])->assertForbidden();
        $this->actingAsVendedor();
        $this->postJson('/api/design-families', ['name' => 'X'])->assertForbidden();
        $this->actingAsAdmin();
        $this->getJson('/api/design-families/admin')->assertOk();
        $this->postJson('/api/design-families', ['name' => 'X', 'designs' => [['id' => 999]]])->assertUnprocessable();
    }
}
