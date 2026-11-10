<?php

namespace Tests\Feature\Flows\Store;

use App\Models\MannequinModel;
use App\Models\MannequinModelEdit;
use App\Models\Role;
use App\Services\Customizer\HuggingFaceClient;
use App\Services\Customizer\MannequinEditService;
use App\Services\Customizer\MannequinGenerationLauncher;
use App\Services\Customizer\MannequinModelService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use RuntimeException;
use Tests\Concerns\ActsAsRoles;
use Tests\Feature\Flows\Store\Concerns\StoreFixtures;
use Tests\TestCase;

/**
 * Admin → Modelos 3D: permisos, chat para definir el modelo (foto base estándar, cambios, fotos de
 * referencia), aprobación con las 4 vistas, generación del 3D con la cuenta que tenga cuota (Hugging Face
 * simulado), revisión, publicación y uso en las plantillas. Nada gasta GPU sin un pedido explícito.
 */
class MannequinModelsTest extends TestCase
{
    use ActsAsRoles, RefreshDatabase, StoreFixtures;

    /** PNG de 1×1. */
    private const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

    private FakeHuggingFace $hf;

    private FakeLauncher $launcher;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRolesAndUsers();
        $this->seedStoreCatalog();
        $this->hf = new FakeHuggingFace;
        $this->launcher = new FakeLauncher;
        $this->app->instance(HuggingFaceClient::class, $this->hf);
        $this->app->instance(MannequinGenerationLauncher::class, $this->launcher);
    }

    protected function tearDown(): void
    {
        foreach (MannequinModel::all() as $m) {
            foreach (array_filter([$m->glbPath, $m->posterPath, ...array_values($m->inputImages ?? [])]) as $p) {
                @unlink(public_path($p));
            }
        }
        foreach (MannequinModelEdit::all() as $e) {
            foreach (array_filter([$e->imagePath, $e->basePath]) as $p) {
                @unlink(public_path($p));
            }
        }
        parent::tearDown();
    }

    private function edits(int $id): array
    {
        return $this->getJson("/api/mannequin-models/{$id}/edits")->assertOk()->json('data');
    }

    /** Corre en el acto lo que se lanzó en segundo plano (fotos del chat). */
    private function runLaunchedEdits(): void
    {
        foreach ($this->launcher->launched as $i => [$id, $cmd]) {
            if ($cmd === 'mannequin:edit') {
                app(MannequinEditService::class)->run($id);
                unset($this->launcher->launched[$i]);
            }
        }
    }

    /** Modelo creado desde el chat y con el 3D pedido con una foto (queda "generando"). */
    private function modelGenerating(string $name = 'Hoodie'): array
    {
        $m = $this->postJson('/api/mannequin-models', ['name' => $name, 'prompt' => 'buso con capucha'])->assertCreated()->json('data');
        $this->runLaunchedEdits();
        $photo = $this->edits($m['id'])[0];

        return $this->postJson("/api/mannequin-models/{$m['id']}/edits/{$photo['id']}/apply")->assertOk()->json('data');
    }

    public function test_solo_quien_tiene_el_permiso_entra_al_modulo(): void
    {
        $this->getJson('/api/mannequin-models')->assertUnauthorized();

        $this->actingAsCliente();
        $this->getJson('/api/mannequin-models')->assertForbidden();
        $this->postJson('/api/mannequin-models', ['name' => 'x', 'prompt' => 'gorra'])->assertForbidden();

        // Vendedor (rol Administrador de la tienda): no lo tiene por defecto (gasta la cuota de GPU).
        $this->actingAsVendedor();
        $this->getJson('/api/mannequin-models')->assertForbidden();
        $this->getJson('/api/mannequin-models/accounts')->assertForbidden();

        // Con el permiso asignado al rol, sí.
        $role = Role::find(3);
        $role->update(['permissions' => array_merge($role->permissions, ['models3d.view'])]);
        $this->actingAsVendedor();
        $this->getJson('/api/mannequin-models')->assertOk();

        $this->actingAsAdmin();
        $this->getJson('/api/mannequin-models')->assertOk()->assertJsonPath('data', []);
        // Asignable a roles personalizados.
        $this->assertContains('models3d.view', \App\Services\Users\RoleService::AVAILABLE_PERMISSIONS);
    }

    public function test_muestra_la_cuota_de_gpu_de_cada_cuenta(): void
    {
        $this->actingAsAdmin();
        $data = $this->getJson('/api/mannequin-models/accounts')->assertOk()->json('data');
        $this->assertCount(2, $data['accounts']);
        $this->assertSame(['account' => 1, 'user' => 'cuenta1', 'left' => 30], array_intersect_key($data['accounts'][0], array_flip(['account', 'user', 'left'])));
        $this->assertSame(330, $data['totalLeft']);
        $this->assertSame(90, $data['needs']['edit']);
        $this->assertSame(270, $data['needs']['views']);
        // No expone los tokens.
        $this->assertStringNotContainsString('tok1', json_encode($data));
    }

    public function test_crear_solo_abre_el_chat_y_arma_la_primera_foto(): void
    {
        $this->actingAsAdmin();
        $this->postJson('/api/mannequin-models', ['name' => 'Gorra'])->assertUnprocessable();
        $this->postJson('/api/mannequin-models', ['name' => 'Gorra', 'kind' => 'casco', 'prompt' => 'x'])->assertUnprocessable();
        $this->postJson('/api/mannequin-models', ['name' => 'Gorra', 'image' => 'data:image/png;base64,bm8gZXMgdW5hIGltYWdlbg=='])->assertStatus(400);

        $m = $this->postJson('/api/mannequin-models', ['name' => 'Gorra', 'kind' => 'cabeza', 'prompt' => 'gorra de 6 paneles'])->assertCreated()->json('data');
        $this->assertSame('borrador', $m['status']);
        $this->assertSame('cabeza', $m['config']['kind']);
        $this->assertSame('m'.$m['id'], $m['key']);
        // Solo se lanzó la primera foto (nada de 3D).
        $this->assertSame([[$this->edits($m['id'])[0]['id'], 'mannequin:edit']], array_values($this->launcher->launched));

        // Sin foto: la crea desde el texto traducido, en la cabeza de maniquí estándar y en blanco.
        $this->runLaunchedEdits();
        $this->assertSame('black-forest-labs/FLUX.1-schnell', $this->hf->calls[0][0]);
        $this->assertStringContainsString('EN(gorra de 6 paneles)', $this->hf->prompts[0]);
        $this->assertStringContainsString('mannequin head', $this->hf->prompts[0]);
        $this->assertStringContainsString('plain white', $this->hf->prompts[0]);
        $first = $this->edits($m['id'])[0];
        $this->assertSame(['listo', 'text', true], [$first['status'], $first['mode'], $first['initial']]);
        $this->assertFileExists(public_path(ltrim($first['image'], '/')));

        // Sin 3D todavía no se revisa ni se publica.
        $this->putJson("/api/mannequin-models/{$m['id']}", ['published' => true])->assertStatus(409);
    }

    public function test_el_chat_pule_la_foto_con_referencias_y_el_maniqui_estandar(): void
    {
        $this->actingAsAdmin();
        // Primer mensaje con foto de referencia: ese producto pasa al maniquí estándar.
        $m = $this->postJson('/api/mannequin-models', ['name' => 'Buso', 'prompt' => 'con capucha', 'image' => self::PNG])->assertCreated()->json('data');
        $first = $this->edits($m['id'])[0];
        $this->assertSame('base', $first['mode']);
        // Mientras arma la foto no se manda otro mensaje.
        $this->postJson("/api/mannequin-models/{$m['id']}/edits", ['prompt' => 'más ancho'])->assertStatus(409);
        $this->runLaunchedEdits();
        $this->assertSame('black-forest-labs/FLUX.1-Kontext-Dev', $this->hf->calls[0][0]);
        $this->assertSame(2, $this->edits($m['id'])[0]['account']); // la cuenta 1 no tiene los 90 s
        $this->assertStringContainsString('Take the product from this image', $this->hf->prompts[0]);
        $this->assertStringContainsString('torso mannequin', $this->hf->prompts[0]);
        $this->assertStringContainsString('EN(con capucha)', $this->hf->prompts[0]);

        // Un cambio: sobre la última foto, conservando el maniquí.
        $this->postJson("/api/mannequin-models/{$m['id']}/edits", ['prompt' => ''])->assertUnprocessable();
        $e2 = $this->postJson("/api/mannequin-models/{$m['id']}/edits", ['prompt' => 'manga larga'])->assertCreated()->json('data');
        $this->assertSame(['edit', $this->edits($m['id'])[0]['image']], [$e2['mode'], $e2['base']]);
        $this->runLaunchedEdits();
        $this->assertStringContainsString('Edit this photo: EN(manga larga)', $this->hf->prompts[1]);
        $this->assertStringContainsString('Keep everything else exactly the same', $this->hf->prompts[1]);

        // Otra foto de referencia en el chat (otro detalle): vuelve a pasar al maniquí estándar.
        $e3 = $this->postJson("/api/mannequin-models/{$m['id']}/edits", ['prompt' => 'este bolsillo', 'image' => self::PNG])->assertCreated()->json('data');
        $this->assertSame('base', $e3['mode']);
        $this->runLaunchedEdits();

        // Sobre una foto anterior.
        $e4 = $this->postJson("/api/mannequin-models/{$m['id']}/edits", ['prompt' => 'más corto', 'fromEditId' => $first['id']])->assertCreated()->json('data');
        $this->assertSame($this->edits($m['id'])[0]['image'], $e4['base']);
        // Un error de la IA queda en el chat.
        $this->hf->failWith = 'El servicio black-forest-labs/FLUX.1-Kontext-Dev no está disponible ahora';
        $this->runLaunchedEdits();
        $this->assertSame('error', MannequinModelEdit::find($e4['id'])->status);
        $this->hf->failWith = null;

        // Si la traducción falla, va el texto tal cual.
        $this->hf->translateFails = true;
        $this->postJson("/api/mannequin-models/{$m['id']}/edits", ['prompt' => 'sin bolsillo'])->assertCreated();
        $this->runLaunchedEdits();
        $this->assertStringContainsString('sin bolsillo.', end($this->hf->prompts));
    }

    public function test_aprobar_arma_las_4_vistas_y_el_3d_sale_de_ellas(): void
    {
        $this->actingAsAdmin();
        $m = $this->postJson('/api/mannequin-models', ['name' => 'Gorra', 'kind' => 'cabeza', 'prompt' => 'gorra'])->assertCreated()->json('data');
        $this->runLaunchedEdits();
        // Todavía no hay vistas.
        $this->postJson("/api/mannequin-models/{$m['id']}/views/generate")->assertUnprocessable();
        $photo = $this->edits($m['id'])[0];

        // Aprobar: arma espalda y lados en cadena (un solo proceso).
        $list = $this->postJson("/api/mannequin-models/{$m['id']}/edits/{$photo['id']}/approve")->assertOk()->json('data');
        $views = array_values(array_filter($list, fn ($e) => $e['mode'] === 'view'));
        $this->assertSame(['back', 'left', 'right'], array_column($views, 'view'));
        $this->assertCount(1, $this->launcher->launched);
        $this->assertSame($photo['image'], $this->getJson("/api/mannequin-models/{$m['id']}")->json('data.inputImages.front'));
        $this->postJson("/api/mannequin-models/{$m['id']}/views/generate")->assertStatus(409); // aún armando
        $this->runLaunchedEdits();
        $views = array_values(array_filter($this->edits($m['id']), fn ($e) => $e['mode'] === 'view'));
        $this->assertSame(['listo', 'listo', 'listo'], array_column($views, 'status'));
        $this->assertStringContainsString('from directly behind', $this->hf->prompts[1]);
        $this->assertStringContainsString('left side', $this->hf->prompts[2]);

        // Rehacer una vista con lo que hay que corregir.
        $this->postJson("/api/mannequin-models/{$m['id']}/views/top", ['prompt' => 'x'])->assertNotFound();
        $redo = $this->postJson("/api/mannequin-models/{$m['id']}/views/back", ['prompt' => 'que se vea el broche'])->assertCreated()->json('data');
        $this->assertSame(['view', 'back', $photo['image']], [$redo['mode'], $redo['view'], $redo['base']]);
        $this->runLaunchedEdits();
        $this->assertStringContainsString('EN(que se vea el broche)', end($this->hf->prompts));

        // 3D con las 4 vistas: la espalda es la rehecha.
        $r = $this->postJson("/api/mannequin-models/{$m['id']}/views/generate")->assertOk()->json('data');
        $this->assertSame(['generando', 'vistas'], [$r['status'], $r['source']]);
        $this->assertSame($this->edits($m['id'])[4]['image'], $r['inputImages']['back']);
        $this->assertSame([$m['id'], 'mannequin:generate'], end($this->launcher->launched));
        // Mientras genera el 3D, el chat no cambia nada.
        $this->postJson("/api/mannequin-models/{$m['id']}/edits", ['prompt' => 'otra cosa'])->assertStatus(409);
        app(MannequinModelService::class)->generate($m['id']);
        $this->assertSame('tencent/Hunyuan3D-2mv', end($this->hf->calls)[0]);
        $this->assertSame('revision', MannequinModel::find($m['id'])->status);
    }

    public function test_genera_el_3d_con_la_cuenta_que_tiene_cuota(): void
    {
        $this->actingAsAdmin();
        $m = $this->modelGenerating();
        $this->assertSame('generando', $m['status']);

        // La cuenta 1 tiene 30 s y el 3D pide 270: usa la 2.
        app(MannequinModelService::class)->generate($m['id']);
        $r = $this->getJson("/api/mannequin-models/{$m['id']}")->assertOk()->json('data');
        $this->assertSame('revision', $r['status']);
        $this->assertSame(2, $r['account']);
        $this->assertSame(['tencent/Hunyuan3D-2.1', '/generation_all', 'tok2'], end($this->hf->calls));
        $this->assertSame('glTF', file_get_contents(public_path(ltrim($r['model'], '/')), false, null, 0, 4));
        $this->assertTrue($this->edits($m['id'])[0]['applied']);

        // En revisión no se puede elegir todavía en una plantilla.
        $tpl = $this->makeProduct('Plantilla', 50000, [['negro', 'M', 0]], ['isTemplate' => true]);
        $this->putJson("/api/templates/{$tpl->id}", ['model3d' => $r['key']])->assertUnprocessable();
        $this->assertSame([], $this->getJson('/api/mannequin-models/public')->json('data'));
    }

    public function test_sin_cuota_queda_con_error_y_se_puede_reintentar(): void
    {
        $this->actingAsAdmin();
        $m = $this->modelGenerating();
        $this->hf->quota = [1 => 10, 2 => 200];
        $calls = count($this->hf->calls);
        app(MannequinModelService::class)->generate($m['id']);
        $r = $this->getJson("/api/mannequin-models/{$m['id']}")->json('data');
        $this->assertSame('error', $r['status']);
        $this->assertStringContainsString('cuota', $r['error']);
        $this->assertCount($calls, $this->hf->calls);

        // El Space responde sin cuota en la primera: sigue con la siguiente.
        $this->hf->quota = [1 => 300, 2 => 300];
        $this->hf->failFirstWithQuota = true;
        $this->postJson("/api/mannequin-models/{$m['id']}/retry")->assertOk()->assertJsonPath('data.status', 'generando');
        app(MannequinModelService::class)->generate($m['id']);
        $r = $this->getJson("/api/mannequin-models/{$m['id']}")->json('data');
        $this->assertSame(['revision', 2], [$r['status'], $r['account']]);

        // Un error que no es de cuota no prueba otras cuentas.
        $m2 = $this->modelGenerating('Otro');
        $this->hf->failWith = 'El servicio tencent/Hunyuan3D-2.1 no está disponible ahora';
        app(MannequinModelService::class)->generate($m2['id']);
        $this->assertSame('error', MannequinModel::find($m2['id'])->status);
        $this->assertStringContainsString('no está disponible', MannequinModel::find($m2['id'])->error);
    }

    public function test_una_generacion_colgada_se_marca_como_error(): void
    {
        $this->actingAsAdmin();
        $m = $this->modelGenerating();
        MannequinModel::where('id', $m['id'])->update(['startedAt' => now()->subHour()]);
        $this->getJson('/api/mannequin-models')->assertOk()->assertJsonPath('data.0.status', 'error');
    }

    public function test_se_revisa_se_publica_y_se_usa_en_las_plantillas(): void
    {
        $this->actingAsAdmin();
        $m = $this->modelGenerating();
        // Mientras se genera no se edita ni se borra.
        $this->putJson("/api/mannequin-models/{$m['id']}", ['name' => 'Y'])->assertStatus(409);
        $this->deleteJson("/api/mannequin-models/{$m['id']}")->assertStatus(409);

        app(MannequinModelService::class)->generate($m['id']);

        // Publicar pide la foto de carga.
        $this->putJson("/api/mannequin-models/{$m['id']}", ['published' => true])->assertUnprocessable();
        $r = $this->putJson("/api/mannequin-models/{$m['id']}", [
            'name' => 'Hoodie negro', 'poster' => self::PNG, 'published' => true,
            'config' => ['headFrom' => 0.8, 'hem' => 1.7, 'collarCurve' => 2, 'otro' => 3, 'kind' => 'piernas', 'split' => 'altura', 'clothFrom' => 0.3],
        ])->assertOk()->json('data');
        $this->assertSame('publicado', $r['status']);
        $this->assertSame(0.8, $r['config']['headFrom']);
        $this->assertEquals(1, $r['config']['hem']); // se limita a 0..1
        $this->assertSame(2, $r['config']['collarCurve']);
        $this->assertSame(['piernas', 'altura', 0.3], [$r['config']['kind'], $r['config']['split'], $r['config']['clothFrom']]);
        $this->assertArrayNotHasKey('otro', $r['config']);
        $this->assertFileExists(public_path(ltrim($r['poster'], '/')));

        // Publicado: el chat no lo cambia.
        $this->postJson("/api/mannequin-models/{$m['id']}/edits/{$this->edits($m['id'])[0]['id']}/approve")->assertStatus(409);

        // La tienda lo recibe (sin sesión) y la plantilla lo puede usar.
        $this->app['auth']->forgetGuards();
        $pub = $this->getJson('/api/mannequin-models/public')->assertOk()->json('data');
        $this->assertSame([$m['key']], array_column($pub, 'key'));
        $this->assertSame('Hoodie negro', $pub[0]['name']);
        $this->assertArrayNotHasKey('error', $pub[0]);

        $this->actingAsAdmin();
        $tpl = $this->makeProduct('Plantilla', 50000, [['negro', 'M', 0]], ['isTemplate' => true]);
        $this->putJson("/api/templates/{$tpl->id}", ['model3d' => $m['key']])->assertOk()->assertJsonPath('data.model3d', $m['key']);
        $this->getJson("/api/mannequin-models/{$m['id']}")->assertJsonPath('data.templates', 1);

        // En uso: no se despublica ni se borra.
        $this->putJson("/api/mannequin-models/{$m['id']}", ['published' => false])->assertStatus(409);
        $this->deleteJson("/api/mannequin-models/{$m['id']}")->assertStatus(409);

        // Sin plantillas: se despublica y se borra con sus archivos y el chat.
        $this->putJson("/api/templates/{$tpl->id}", ['model3d' => 'basica'])->assertOk();
        $this->putJson("/api/mannequin-models/{$m['id']}", ['published' => false])->assertOk()->assertJsonPath('data.status', 'revision');
        $glb = public_path(ltrim($r['model'], '/'));
        $chatImg = public_path(ltrim($this->edits($m['id'])[0]['image'], '/'));
        $this->deleteJson("/api/mannequin-models/{$m['id']}")->assertOk();
        $this->assertFileDoesNotExist($glb);
        $this->assertFileDoesNotExist($chatImg);
        $this->assertNull(MannequinModel::find($m['id']));
        $this->assertSame(0, MannequinModelEdit::count());
        $this->getJson('/api/mannequin-models/999')->assertNotFound();
    }
}

/** Hugging Face simulado: 2 cuentas, cuota configurable, traductor y respuestas mínimas. */
class FakeHuggingFace extends HuggingFaceClient
{
    public array $quota = [1 => 30, 2 => 300];

    public array $calls = [];

    public array $prompts = [];

    public bool $failFirstWithQuota = false;

    public ?string $failWith = null;

    public bool $translateFails = false;

    public function __construct() {}

    public function accounts(): array
    {
        return [1 => 'tok1', 2 => 'tok2'];
    }

    public function whoami(string $token): ?string
    {
        return $token === 'tok1' ? 'cuenta1' : 'cuenta2';
    }

    public function quota(string $token): ?array
    {
        $left = $this->quota[(int) substr($token, 3)];

        return ['base' => 300, 'left' => $left, 'resetsAt' => null, 'runsLimit' => 8, 'runsLeft' => 8, 'runsResetAt' => null];
    }

    public function run(string $space, string $api, array $data, string $token, int $timeout = 900): array
    {
        if (str_contains($space, 'opus-translate')) {
            if ($this->translateFails) {
                throw new RuntimeException('traductor caído');
            }

            return ['EN('.$data[0].')', ''];
        }
        if ($this->failWith) {
            throw new RuntimeException($this->failWith);
        }
        if ($this->failFirstWithQuota) {
            $this->failFirstWithQuota = false;
            throw new RuntimeException('Sin cuota de GPU en la cuenta (pide 270 s y le quedan 0 s).');
        }
        $this->calls[] = [$space, $api, $token];
        if (str_contains($space, 'Kontext')) {
            $this->prompts[] = $data[1];

            return [['url' => 'https://x/editada.webp', 'path' => '/tmp/editada.webp'], 1];
        }
        if (str_contains($space, 'FLUX')) {
            $this->prompts[] = $data[0];

            return [['url' => 'https://x/foto.webp', 'path' => '/tmp/foto.webp'], 1];
        }

        return [['url' => 'https://x/forma.glb'], ['url' => 'https://x/textura.glb'], '', [], 1];
    }

    public function download(array $file, string $dest, string $token): void
    {
        file_put_contents($dest, str_ends_with($file['url'], '.glb') ? 'glTF'.str_repeat("\0", 16) : base64_decode(substr(MannequinModelsTestPng::PNG, 22)));
    }
}

/** Lanzador simulado: anota qué se lanzó (la prueba lo corre a mano). */
class FakeLauncher extends MannequinGenerationLauncher
{
    public array $launched = [];

    public function launch(int $id, string $command = 'mannequin:generate'): void
    {
        $this->launched[] = [$id, $command];
    }
}

final class MannequinModelsTestPng
{
    public const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
}
