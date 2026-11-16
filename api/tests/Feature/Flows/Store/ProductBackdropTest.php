<?php

namespace Tests\Feature\Flows\Store;

use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\ActsAsRoles;
use Tests\Feature\Flows\Store\Concerns\StoreFixtures;
use Tests\TestCase;

/**
 * Fondo de la foto del producto en la tienda (productos y plantillas personalizables) y las imágenes
 * de la plantilla tomadas de sus zonas.
 */
class ProductBackdropTest extends TestCase
{
    use ActsAsRoles, RefreshDatabase, StoreFixtures;

    private array $files = [];

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRolesAndUsers();
        $this->seedStoreCatalog();
        // Sin cuentas de IA: el recorte con IA no está disponible en las pruebas.
        config(['services.huggingface.tokens' => []]);
    }

    protected function tearDown(): void
    {
        foreach ($this->files as $f) {
            @unlink(public_path(ltrim($f, '/')));
        }
        parent::tearDown();
    }

    /** PNG en /uploads (transparente o con fondo). */
    private function png(string $name, bool $transparent): string
    {
        $im = imagecreatetruecolor(40, 40);
        imagesavealpha($im, true);
        imagefill($im, 0, 0, $transparent ? imagecolorallocatealpha($im, 0, 0, 0, 127) : imagecolorallocate($im, 255, 255, 255));
        imagefilledrectangle($im, 12, 12, 28, 28, imagecolorallocate($im, 200, 0, 0));
        @mkdir(public_path('uploads/tests'), 0775, true);
        $rel = '/uploads/tests/'.$name.'-'.uniqid().'.png';
        imagepng($im, public_path(ltrim($rel, '/')));
        $this->files[] = $rel;

        return $rel;
    }

    public function test_fondo_con_la_foto_sin_fondo_y_cuando_cambia_la_foto(): void
    {
        $this->actingAsAdmin();
        $photo = $this->png('suéter', true);
        $p = $this->makeProduct('Suéter Rojo', 50000, [['negro', 'M', 3]], ['images' => ['front' => $photo]]);
        $bg = $this->png('fondo', false);

        // La foto ya no tiene fondo: se usa tal cual como recorte (sin IA).
        $r = $this->putJson("/api/products/{$p->id}/backdrop", ['url' => 'http://localhost'.$bg])->assertOk()->json('data');
        $this->assertSame(['url' => $bg, 'cutout' => $photo], $r['backdrop']);
        $this->assertNull($r['warning']);
        $this->getJson("/api/products/{$p->id}")->assertOk()->assertJsonPath('data.backdrop', ['url' => $bg, 'cutout' => $photo]);

        // Cambia la foto principal: el recorte viejo deja de usarse (queda solo el fondo).
        $p->update(['images' => ['front' => $this->png('otra', true)]]);
        $this->getJson("/api/products/{$p->id}")->assertJsonPath('data.backdrop', ['url' => $bg, 'cutout' => null]);

        // Quitar el fondo.
        $this->putJson("/api/products/{$p->id}/backdrop", ['url' => null])->assertOk()->assertJsonPath('message', 'Fondo quitado');
        $this->getJson("/api/products/{$p->id}")->assertJsonPath('data.backdrop', null);
    }

    public function test_sin_ia_el_fondo_queda_y_avisa(): void
    {
        $this->actingAsAdmin();
        $p = $this->makeProduct('Camisa', 40000, [['negro', 'M', 3]], ['images' => ['front' => $this->png('camisa', false)]]);
        $bg = $this->png('fondo', false);
        $r = $this->putJson("/api/products/{$p->id}/backdrop", ['url' => $bg])->assertOk()->json('data');
        $this->assertSame(['url' => $bg, 'cutout' => null], $r['backdrop']);
        $this->assertStringContainsString('No se pudo recortar', $r['warning']);
    }

    public function test_validaciones_y_permisos(): void
    {
        $p = $this->makeProduct('Gorra', 20000, [['negro', 'M', 3]]);
        $this->putJson("/api/products/{$p->id}/backdrop", ['url' => null])->assertUnauthorized();
        $this->actingAsCliente();
        $this->putJson("/api/products/{$p->id}/backdrop", ['url' => null])->assertForbidden();
        $this->postJson('/api/products/backdrop/ai', ['style' => 'lujo'])->assertForbidden();
        // Quien edita productos (el vendedor también) puede ponerles fondo, igual que editarlos.
        $this->actingAsVendedor();
        $this->assertSame(
            $this->putJson("/api/products/{$p->id}", ['name' => 'Gorra'])->status() === 200,
            $this->putJson("/api/products/{$p->id}/backdrop", ['url' => null])->status() === 200,
        );

        $this->actingAsAdmin();
        // Solo imágenes subidas a la tienda (no de otros sitios ni otras rutas).
        $this->putJson("/api/products/{$p->id}/backdrop", ['url' => 'https://otro.com/uploads/x.png'])->assertUnprocessable();
        $this->putJson("/api/products/{$p->id}/backdrop", ['url' => '/etc/passwd'])->assertUnprocessable();
        $this->putJson("/api/products/{$p->id}/backdrop", ['url' => '/uploads/../.env'])->assertUnprocessable();
        $this->putJson('/api/products/999999/backdrop', ['url' => null])->assertNotFound();
        $this->postJson('/api/products/backdrop/ai', ['style' => 'otro'])->assertUnprocessable();
        // Sin cuenta de IA, generar avisa (no se cae).
        $this->postJson('/api/products/backdrop/ai', ['style' => 'minimal'])->assertUnprocessable();
    }

    public function test_la_plantilla_usa_las_imagenes_de_sus_zonas_y_su_fondo(): void
    {
        $this->actingAsAdmin();
        $front = $this->png('frente', true);
        $tpl = $this->makeProduct('Camiseta Personalizable', 60000, [['negro', 'M', 3]], [
            'isTemplate' => true, 'images' => ['front' => '/uploads/vieja.png', 'back' => '/uploads/vieja-espalda.png'],
            'zoneTypeImages' => ['frente' => $front, 'manga-derecha' => '/uploads/manga.png'],
        ]);
        $t = $this->getJson("/api/templates/{$tpl->id}")->assertOk()->json('data');
        // La de la zona manda; la foto vieja queda de respaldo donde la zona no tiene.
        $this->assertSame(['front' => $front, 'back' => '/uploads/vieja-espalda.png', 'side' => '/uploads/manga.png'], $t['images']);

        $bg = $this->png('fondo', false);
        $this->putJson("/api/products/{$tpl->id}/backdrop", ['url' => $bg])->assertOk()->assertJsonPath('data.backdrop.cutout', $front);
        $this->getJson("/api/templates/{$tpl->id}")->assertJsonPath('data.backdrop', ['url' => $bg, 'cutout' => $front]);
        $this->assertSame($bg, Product::find($tpl->id)->backdrop['url']);
    }
}
