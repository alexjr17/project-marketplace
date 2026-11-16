<?php

namespace Tests\Feature\Flows\Messaging;

use App\Models\MarketingProject;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\Concerns\ActsAsRoles;
use Tests\TestCase;

/**
 * App Social → Estudio de contenido → Proyectos: guardar el trabajo en curso, la lista, volver a abrirlo,
 * guardar cambios, duplicar, eliminar, la miniatura y las imágenes del proyecto (sin duplicarlas).
 */
class MarketingProjectsTest extends TestCase
{
    use ActsAsRoles, RefreshDatabase;

    private const URL = '/api/messaging/marketing/projects';

    /** Archivos creados en la prueba (se borran al final). */
    private array $files = [];

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRolesAndUsers();
    }

    protected function tearDown(): void
    {
        foreach (MarketingProject::all() as $p) {
            if ($p->thumbPath) {
                @unlink(public_path($p->thumbPath));
            }
        }
        foreach ($this->files as $f) {
            @unlink(public_path(ltrim($f, '/')));
        }
        parent::tearDown();
    }

    private function thumb(): string
    {
        $img = imagecreatetruecolor(40, 40);
        ob_start();
        imagejpeg($img);

        return 'data:image/jpeg;base64,'.base64_encode((string) ob_get_clean());
    }

    private function project(array $over = []): array
    {
        return $this->postJson(self::URL, array_merge([
            'name' => '  Post   suéter  ', 'format' => 'post', 'source' => 'producto', 'template' => 'destacado',
            'data' => ['v' => 1, 'title' => 'Suéter', 'design' => ['template' => 'destacado', 'layers' => [['id' => 'a']]]],
            'thumb' => $this->thumb(),
        ], $over))->assertCreated()->json('data');
    }

    public function test_solo_quien_publica_en_social_tiene_proyectos(): void
    {
        $this->getJson(self::URL)->assertUnauthorized();
        $this->actingAsCliente();
        $this->getJson(self::URL)->assertForbidden();
        $this->postJson(self::URL, ['name' => 'x', 'format' => 'post', 'data' => ['a' => 1]])->assertForbidden();
        $this->actingAsVendedor();
        $this->getJson(self::URL)->assertForbidden();
        $this->actingAsCajero();
        $this->getJson(self::URL)->assertForbidden();
        $this->actingAsAdmin();
        $this->getJson(self::URL)->assertOk()->assertJsonPath('data', []);
    }

    public function test_guardar_abrir_editar_duplicar_y_eliminar(): void
    {
        $admin = $this->actingAsAdmin();
        $p = $this->project();
        $this->assertSame('Post suéter', $p['name']);
        $this->assertSame('Suéter', $p['data']['title']);
        $this->assertStringStartsWith('/uploads/marketing/proyectos/miniaturas/'.$p['id'].'.jpg', $p['thumb']);
        $this->assertFileExists(public_path('uploads/marketing/proyectos/miniaturas/'.$p['id'].'.jpg'));
        $this->assertSame($admin->name, $p['updatedBy']);

        // La lista va sin lo armado (pesa); al abrirlo, con todo.
        $list = $this->getJson(self::URL)->assertOk()->json('data');
        $this->assertCount(1, $list);
        $this->assertArrayNotHasKey('data', $list[0]);
        $this->getJson(self::URL.'/'.$p['id'])->assertOk()->assertJsonPath('data.data.design.layers.0.id', 'a');

        // Guardar cambios (el editor guarda solo): lo armado y el nombre; el formato no se pierde.
        $this->putJson(self::URL.'/'.$p['id'], ['name' => 'Post oferta', 'data' => ['v' => 1, 'title' => 'Nuevo']])->assertOk()
            ->assertJsonPath('data.name', 'Post oferta')->assertJsonPath('data.format', 'post');
        $this->getJson(self::URL.'/'.$p['id'])->assertJsonPath('data.data.title', 'Nuevo');
        // Lo armado vuelve tal cual: textos vacíos y con espacios incluidos (el editor los necesita así).
        $this->putJson(self::URL.'/'.$p['id'], ['data' => ['title' => '', 'scenes' => [['title' => '', 'subtitle' => '  hola  ']]]])->assertOk();
        $this->getJson(self::URL.'/'.$p['id'])->assertJsonPath('data.data.title', '')->assertJsonPath('data.data.scenes.0.title', '')
            ->assertJsonPath('data.data.scenes.0.subtitle', '  hola  ');
        // Sin nombre queda "Proyecto sin nombre".
        $this->putJson(self::URL.'/'.$p['id'], ['name' => '   '])->assertOk()->assertJsonPath('data.name', 'Proyecto sin nombre');

        // Filtrar por formato y el más reciente primero.
        $v = $this->project(['name' => 'Video', 'format' => 'video360', 'thumb' => null]);
        $this->assertSame([$v['id']], array_column($this->getJson(self::URL.'?format=video360')->json('data'), 'id'));
        $this->travel(2)->seconds();
        $this->putJson(self::URL.'/'.$p['id'], ['data' => ['v' => 1]])->assertOk();
        $this->assertSame($p['id'], $this->getJson(self::URL)->json('data.0.id'));
        $this->getJson(self::URL.'?format=otro')->assertUnprocessable();

        // Duplicar: otra copia con su miniatura; la original no cambia.
        $copy = $this->postJson(self::URL.'/'.$p['id'].'/duplicate')->assertCreated()->json('data');
        $this->assertNotSame($p['id'], $copy['id']);
        $this->assertSame('Proyecto sin nombre (copia)', $copy['name']);
        $this->assertFileExists(public_path('uploads/marketing/proyectos/miniaturas/'.$copy['id'].'.jpg'));
        $this->assertCount(3, $this->getJson(self::URL)->json('data'));

        // Eliminar: se va con su miniatura.
        $this->deleteJson(self::URL.'/'.$copy['id'])->assertOk();
        $this->assertFileDoesNotExist(public_path('uploads/marketing/proyectos/miniaturas/'.$copy['id'].'.jpg'));
        $this->getJson(self::URL.'/'.$copy['id'])->assertNotFound();
        $this->putJson(self::URL.'/999999', ['name' => 'x'])->assertNotFound();
    }

    public function test_validaciones(): void
    {
        $this->actingAsAdmin();
        $this->postJson(self::URL, ['format' => 'post', 'data' => ['a' => 1]])->assertUnprocessable();
        $this->postJson(self::URL, ['name' => 'x', 'format' => 'gif', 'data' => ['a' => 1]])->assertUnprocessable();
        $this->postJson(self::URL, ['name' => 'x', 'format' => 'post'])->assertUnprocessable();
        // Las imágenes no van incrustadas en lo armado: se suben aparte.
        $this->postJson(self::URL, ['name' => 'x', 'format' => 'post', 'data' => ['src' => 'data:image/png;base64,'.str_repeat('A', 5000)]])
            ->assertUnprocessable()->assertJsonPath('message', 'Las imágenes del proyecto se suben aparte');
        // Miniatura que no es imagen.
        $this->postJson(self::URL, ['name' => 'x', 'format' => 'post', 'data' => ['a' => 1], 'thumb' => 'data:image/jpeg;base64,'.base64_encode('hola')])
            ->assertUnprocessable();
        $this->assertSame(0, MarketingProject::count());
    }

    public function test_imagenes_del_proyecto_sin_duplicar(): void
    {
        $this->actingAsAdmin();
        $file = UploadedFile::fake()->image('diseno.png', 60, 60);
        $a = $this->post(self::URL.'/assets', ['image' => $file], ['Accept' => 'application/json'])->assertCreated()->json('data.url');
        $this->files[] = $a;
        $this->assertMatchesRegularExpression('#^/uploads/marketing/proyectos/[0-9a-f]{40}\.png$#', $a);
        $this->assertFileExists(public_path(ltrim($a, '/')));
        // La misma imagen otra vez: el mismo archivo.
        $b = $this->post(self::URL.'/assets', ['image' => UploadedFile::fake()->createWithContent('otra.png', file_get_contents(public_path(ltrim($a, '/'))))], ['Accept' => 'application/json'])
            ->assertCreated()->json('data.url');
        $this->assertSame($a, $b);
        // La música del video también (un WAV mínimo).
        $wav = 'RIFF'.pack('V', 36).'WAVEfmt '.pack('VvvVVvv', 16, 1, 1, 8000, 8000, 1, 8).'data'.pack('V', 0);
        $m = $this->post(self::URL.'/assets', ['image' => UploadedFile::fake()->createWithContent('cancion.wav', $wav)], ['Accept' => 'application/json'])
            ->assertCreated()->json('data.url');
        $this->files[] = $m;
        $this->assertStringEndsWith('.wav', $m);
        // Nada más (ni PDF ni texto).
        $this->post(self::URL.'/assets', ['image' => UploadedFile::fake()->create('x.pdf', 10, 'application/pdf')], ['Accept' => 'application/json'])->assertUnprocessable();
        $this->post(self::URL.'/assets', ['image' => UploadedFile::fake()->createWithContent('x.png', 'hola')], ['Accept' => 'application/json'])->assertUnprocessable();
    }
}
