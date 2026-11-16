<?php

namespace Tests\Feature\Flows\Messaging;

use App\Models\Channel;
use App\Models\Discount;
use App\Models\MarketingCreative;
use App\Models\SocialPost;
use App\Models\TemplateZone;
use App\Models\ZoneType;
use App\Services\Social\SocialPostService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Tests\Concerns\ActsAsRoles;
use Tests\Feature\Flows\Store\Concerns\StoreFixtures;
use Tests\TestCase;

/**
 * App Social → Estudio de contenido: permisos, fuentes, textos con IA (Groq simulado), ficha de la
 * marca, biblioteca de piezas, publicar en Facebook e Instagram (Meta simulado), programar y calendario.
 */
class MarketingStudioTest extends TestCase
{
    use ActsAsRoles, RefreshDatabase, StoreFixtures;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRolesAndUsers();
        $this->seedStoreCatalog();
        config(['services.groq.key' => 'gsk_test']);
    }

    protected function tearDown(): void
    {
        foreach (MarketingCreative::all() as $c) {
            @unlink(public_path($c->mediaPath));
        }
        parent::tearDown();
    }

    private function channel(): Channel
    {
        return Channel::create(['type' => 'messenger', 'name' => 'Facebook', 'isActive' => true, 'aiAutoReply' => false, 'config' => ['pageId' => '111', 'pageAccessToken' => 'tok']]);
    }

    private function creative(string $kind = 'post', string $mime = 'image/png'): array
    {
        $file = $mime === 'image/png'
            ? UploadedFile::fake()->image('pieza.png', 100, 100)
            : UploadedFile::fake()->create('reel.mp4', 200, 'video/mp4');

        return $this->post('/api/messaging/marketing/creatives', [
            'title' => 'Suéter oferta', 'kind' => $kind, 'source' => 'producto', 'sourceIds' => '[1]', 'template' => 'destacado',
            'data' => '{"title":"x"}', 'caption' => 'Texto del post', 'hashtags' => '["toclex","moda"]', 'media' => $file,
        ], ['Accept' => 'application/json'])->assertCreated()->json('data');
    }

    public function test_solo_quien_publica_en_social_entra_al_estudio(): void
    {
        $this->getJson('/api/messaging/marketing/creatives')->assertUnauthorized();
        $this->actingAsCliente();
        $this->getJson('/api/messaging/marketing/creatives')->assertForbidden();
        $this->actingAsVendedor();
        $this->getJson('/api/messaging/marketing/sources?type=producto')->assertForbidden();
        $this->actingAsAdmin();
        $this->getJson('/api/messaging/marketing/creatives')->assertOk()->assertJsonPath('data', []);
    }

    public function test_fuentes_con_precio_oferta_y_promociones(): void
    {
        $this->actingAsAdmin();
        $p = $this->makeProduct('Suéter Negro', 50000, [['negro', 'M', 3]], ['tags' => ['anime']]);
        Discount::create(['name' => 'Oferta 20', 'type' => 'percent', 'value' => 20, 'isAuto' => true, 'isActive' => true, 'appliesTo' => 'product', 'targetIds' => [$p->id], 'channel' => 'all']);
        Discount::create(['code' => 'HOLA10', 'name' => 'Hola', 'type' => 'percent', 'value' => 10, 'isAuto' => false, 'isActive' => true, 'appliesTo' => 'all', 'channel' => 'all']);

        $row = collect($this->getJson('/api/messaging/marketing/sources?type=producto')->assertOk()->json('data'))->firstWhere('id', $p->id);
        $this->assertEquals([40000, 50000, 20], [$row['price'], $row['listPrice'], $row['discountPercent']]);
        $col = collect($this->getJson('/api/messaging/marketing/sources?type=coleccion')->json('data'))->firstWhere('id', 'anime');
        $this->assertSame('Anime', $col['name']);
        $promos = collect($this->getJson('/api/messaging/marketing/sources?type=promocion')->json('data'));
        $this->assertSame('-10%', $promos->firstWhere('code', 'HOLA10')['label']);
        $this->getJson('/api/messaging/marketing/sources?type=otro')->assertUnprocessable();

        // Plantillas personalizables: con sus zonas de diseño (sin las bloqueadas) para los videos 3D.
        $tpl = $this->makeProduct('Suéter Personalizable', 70000, [['negro', 'M', 2]], ['isTemplate' => true, 'model3d' => 'basica']);
        $zone = fn (string $slug, array $a = []) => TemplateZone::create(array_merge([
            'templateId' => $tpl->id, 'zoneTypeId' => ZoneType::where('slug', $slug)->value('id'), 'zoneId' => 'z-'.uniqid(),
            'name' => ucfirst($slug), 'shape' => 'rect', 'positionX' => 30, 'positionY' => 24, 'maxWidth' => 40, 'maxHeight' => 42,
            'isEditable' => true, 'isRequired' => false, 'isBlocked' => false, 'price' => 0, 'sortOrder' => 1, 'isActive' => true,
        ], $a));
        $zone('frente');
        $zone('espalda', ['shape' => 'circle', 'sortOrder' => 2]);
        $zone('frente', ['isBlocked' => true, 'name' => 'Bloqueada']);
        $row = collect($this->getJson('/api/messaging/marketing/sources?type=plantilla')->assertOk()->json('data'))->firstWhere('id', $tpl->id);
        $this->assertSame(['Frente', 'Espalda'], array_column($row['zones'], 'name'));
        $this->assertEquals(['frente', 30, 24, 40, 42, false], [$row['zones'][0]['view'], $row['zones'][0]['x'], $row['zones'][0]['y'], $row['zones'][0]['w'], $row['zones'][0]['h'], $row['zones'][0]['circle']]);
        $this->assertTrue($row['zones'][1]['circle']);
        $this->assertSame(['front', 'back', 'side'], array_keys($row['viewImages']));
        $this->assertIsArray($row['zoneTypeImages']);
        // Zonas viejas en píxeles (sobre 500) llegan en %.
        $zone('espalda', ['name' => 'Vieja', 'positionX' => 200, 'positionY' => 150, 'maxWidth' => 100, 'maxHeight' => 120]);
        $row = collect($this->getJson('/api/messaging/marketing/sources?type=plantilla')->assertOk()->json('data'))->firstWhere('id', $tpl->id);
        $old = collect($row['zones'])->firstWhere('name', 'Vieja');
        $this->assertEquals([40, 30, 20, 24], [$old['x'], $old['y'], $old['w'], $old['h']]);
    }

    public function test_textos_con_ia_y_respaldo_sin_ia(): void
    {
        $this->actingAsAdmin();
        Http::fake(['api.groq.com/*' => Http::sequence()
            ->push(['choices' => [['message' => ['content' => json_encode([
                'title' => 'Estilo que destaca', 'subtitle' => 'Nuevo', 'cta' => 'Compra ya', 'caption' => 'Lleva el tuyo.', 'hashtags' => ['#moda', 'toclex', 'ropa nueva'],
            ])]]]])
            ->push('caído', 500)]);
        $items = [['name' => 'Suéter', 'price' => 50000, 'image' => 'data:image/png;base64,'.str_repeat('A', 5000)]];
        $r = $this->postJson('/api/messaging/marketing/copy', ['kind' => 'post', 'source' => 'producto', 'items' => $items])->assertOk()->json('data');
        $this->assertTrue($r['ai']);
        $this->assertSame('Estilo que destaca', $r['title']);
        // Hashtags de la marca primero, limpios y sin repetir.
        $this->assertSame(['toclex', 'madewithintention', 'moda', 'ropanueva'], $r['hashtags']);
        // A la IA no se le mandan fotos.
        Http::assertSent(fn ($req) => ! str_contains($req->body(), 'data:image'));

        $r = $this->postJson('/api/messaging/marketing/copy', ['kind' => 'reel', 'source' => 'producto', 'items' => $items])->assertOk()->json('data');
        $this->assertFalse($r['ai']);
        $this->assertNotEmpty($r['caption']);
        $this->assertArrayNotHasKey('scenes', $r);
    }

    public function test_textos_por_escena_del_video(): void
    {
        $this->actingAsAdmin();
        Http::fake(['api.groq.com/*' => Http::sequence()
            // La IA devuelve solo dos de las tres escenas: la que falta sale de plantilla.
            ->push(['choices' => [['message' => ['content' => json_encode([
                'title' => 'Hazla tuya', 'subtitle' => 'Tu diseño', 'cta' => 'Diseña ya', 'caption' => 'Crea la tuya.', 'hashtags' => ['moda'],
                'scenes' => [['title' => 'Nuevo drop', 'subtitle' => 'Llegó la camiseta'], ['title' => 'Mira el detalle', 'subtitle' => '']],
            ])]]]])
            ->push('caído', 500)]);
        $scenes = [['kind' => 'texto', 'about' => 'Anuncio'], ['kind' => '3d', 'about' => 'Camiseta básica'], ['kind' => 'foto', 'about' => 'Suéter rojo']];
        $r = $this->postJson('/api/messaging/marketing/copy', ['kind' => 'video360', 'source' => 'plantilla', 'items' => [['name' => 'Camiseta']], 'scenes' => $scenes])->assertOk()->json('data');
        $this->assertTrue($r['ai']);
        $this->assertCount(3, $r['scenes']);
        $this->assertSame(['title' => 'Nuevo drop', 'subtitle' => 'Llegó la camiseta'], $r['scenes'][0]);
        $this->assertSame('Mira el detalle', $r['scenes'][1]['title']);
        $this->assertSame('Diseña la tuya', $r['scenes'][2]['title']);
        // A la IA se le dice cuántas escenas son y de qué.
        Http::assertSent(function ($req) {
            $prompt = (string) ($req->data()['messages'][1]['content'] ?? '');

            return str_contains($prompt, 'exactamente 3') && str_contains($prompt, 'Suéter rojo');
        });

        // Sin IA: un texto por escena con plantillas.
        $r = $this->postJson('/api/messaging/marketing/copy', ['kind' => 'video360', 'source' => 'producto', 'items' => [['name' => 'Suéter', 'price' => 50000]], 'scenes' => $scenes])->assertOk()->json('data');
        $this->assertFalse($r['ai']);
        $this->assertCount(3, $r['scenes']);
        $this->assertSame($r['title'], $r['scenes'][0]['title']);
        $this->assertNotSame('', $r['scenes'][2]['title']);

        $this->postJson('/api/messaging/marketing/copy', ['kind' => 'video360', 'source' => 'producto', 'scenes' => [['kind' => 'otro']]])->assertUnprocessable();
    }

    public function test_ayuda_ia_del_video(): void
    {
        $this->actingAsAdmin();
        Http::fake(['api.groq.com/*' => Http::sequence()
            // La IA inventa una transición y un sonido que no van: se corrigen con el catálogo.
            ->push(['choices' => [['message' => ['content' => json_encode([
                'summary' => 'Buen gancho, falta ritmo.',
                'tips' => ['Acorta la primera escena', 'Agrega música'],
                'scenes' => [
                    ['transition' => 'zoom', 'transitionSeconds' => 9, 'sound' => 'riser', 'textAnim' => 'pop', 'motion' => null, 'seconds' => 2, 'reason' => 'Gancho'],
                    ['transition' => 'teletransporte', 'sound' => 'trueno', 'textAnim' => 'bailar', 'motion' => 'detalle', 'seconds' => 99],
                ],
            ])]]]])
            ->push('caído', 500)]);
        $scenes = [
            ['kind' => 'texto', 'title' => 'Nuevo', 'seconds' => 3, 'transition' => 'fundido'],
            ['kind' => '3d', 'about' => 'Camiseta', 'seconds' => 4, 'transition' => 'fundido', 'motion' => 'giro'],
        ];
        $r = $this->postJson('/api/messaging/marketing/video-advice', ['tone' => 'urgente', 'endCard' => true, 'scenes' => $scenes])->assertOk()->json('data');
        $this->assertTrue($r['ai']);
        $this->assertSame('Buen gancho, falta ritmo.', $r['summary']);
        $this->assertEquals(['transition' => 'zoom', 'transitionSeconds' => 1.5, 'sound' => 'riser', 'textAnim' => 'pop', 'motion' => null, 'seconds' => 2.0],
            array_intersect_key($r['scenes'][0], array_flip(['transition', 'transitionSeconds', 'sound', 'textAnim', 'motion', 'seconds'])));
        // Lo inventado sale de las reglas; el sonido siempre es uno de los de su transición.
        $s = $r['scenes'][1];
        $this->assertContains($s['transition'], \App\Services\Marketing\MarketingVideoAdviceService::TRANSITIONS);
        $this->assertContains($s['sound'], \App\Services\Marketing\MarketingVideoAdviceService::TRANSITION_SOUNDS[$s['transition']]);
        $this->assertSame('detalle', $s['motion']);
        $this->assertEquals(12, $s['seconds']);
        $this->assertNotSame('bailar', $s['textAnim']);

        // Sin IA: reglas según el tono, una recomendación por escena.
        $r = $this->postJson('/api/messaging/marketing/video-advice', ['tone' => 'elegante', 'scenes' => $scenes])->assertOk()->json('data');
        $this->assertFalse($r['ai']);
        $this->assertCount(2, $r['scenes']);
        $this->assertEquals(1, $r['scenes'][0]['transitionSeconds']);
        $this->assertSame('revelar', $r['scenes'][1]['motion']);
        $this->assertNull($r['scenes'][0]['motion']);
        $this->assertNotEmpty($r['tips']);

        $this->postJson('/api/messaging/marketing/video-advice', ['scenes' => []])->assertUnprocessable();
    }

    public function test_narrador_guion_y_voz(): void
    {
        $this->actingAsAdmin();
        Http::fake(['api.groq.com/*' => Http::sequence()
            ->push(['choices' => [['message' => ['content' => json_encode([
                'lines' => ['¿Buscas algo **único**? #moda', 'Esta camiseta se adapta a tu estilo y a tu diseño, con tela suave que dura y colores que no se van nunca jamás'],
            ])]]]])
            ->push('caído', 500)]);
        $scenes = [['kind' => 'texto', 'title' => 'Nuevo', 'seconds' => 2], ['kind' => '3d', 'about' => 'Camiseta', 'title' => 'Hazla tuya', 'seconds' => 3]];
        $r = $this->postJson('/api/messaging/marketing/narration/script', ['tone' => 'cercano', 'scenes' => $scenes])->assertOk()->json('data');
        $this->assertTrue($r['ai']);
        // Sin símbolos de formato ni hashtags; la línea larga se recorta a lo que cabe en 3 s.
        $this->assertSame('¿Buscas algo único? moda', $r['lines'][0]);
        $this->assertLessThanOrEqual(10, count(explode(' ', $r['lines'][1])));
        $this->assertStringEndsWith('…', $r['lines'][1]);

        $r = $this->postJson('/api/messaging/marketing/narration/script', ['scenes' => $scenes])->assertOk()->json('data');
        $this->assertFalse($r['ai']);
        $this->assertSame(['Nuevo.', 'Hazla tuya. Encuéntralo en nuestra tienda.'], $r['lines']);

        $this->assertCount(8, $this->getJson('/api/messaging/marketing/narration/voices')->assertOk()->json('data'));
        $this->postJson('/api/messaging/marketing/narration/speak', ['text' => 'Hola', 'voice' => 'robot'])->assertUnprocessable();
        // Lo ya generado sale de la caché, sin llamar al servicio de voz.
        \Illuminate\Support\Facades\Storage::fake('local');
        \Illuminate\Support\Facades\Storage::disk('local')->put('tts/'.sha1('es-CO-SalomeNeural|0|Hola Toclex').'.mp3', 'MP3DATA');
        $res = $this->post('/api/messaging/marketing/narration/speak', ['text' => '  Hola   Toclex ', 'voice' => 'es-CO-SalomeNeural'], ['Accept' => 'application/json'])->assertOk();
        $this->assertSame('MP3DATA', $res->getContent());
        $this->assertSame('audio/mpeg', $res->headers->get('Content-Type'));
    }

    public function test_imagen_con_ia(): void
    {
        $this->actingAsAdmin();
        $this->postJson('/api/messaging/marketing/ai-image', ['prompt' => 'León dorado', 'kind' => 'meme'])->assertUnprocessable();
        $this->postJson('/api/messaging/marketing/ai-image', ['prompt' => 'x', 'kind' => 'diseno'])->assertUnprocessable();
        // Sin cuentas de Hugging Face avisa claro (y no llama al generador).
        config(['services.huggingface.tokens' => []]);
        Http::fake(['api.groq.com/*' => Http::response(['choices' => [['message' => ['content' => json_encode(['prompt' => 'golden lion'])]]]])]);
        $this->postJson('/api/messaging/marketing/ai-image', ['prompt' => 'León dorado', 'kind' => 'diseno'])
            ->assertUnprocessable()->assertJsonFragment(['message' => 'Crear imágenes con IA necesita una cuenta de Hugging Face (HF_TOKEN en el .env de la API)']);
        Http::assertNotSent(fn ($req) => str_contains($req->url(), 'hf.space'));
    }

    public function test_fondo_profesional_con_ia(): void
    {
        $this->actingAsAdmin();
        $url = '/api/messaging/marketing/ai-backdrop';
        $this->postJson($url, ['style' => 'disco'])->assertUnprocessable();
        $this->postJson($url, ['style' => 'lujo', 'palette' => ['rojo']])->assertUnprocessable();
        $this->postJson($url, ['style' => 'lujo', 'designs' => ['https://otro.sitio/x.png']])->assertUnprocessable();
        $this->postJson($url, ['style' => 'lujo', 'designs' => array_fill(0, 4, 'data:image/jpeg;base64,AAAA')])->assertUnprocessable();

        // La IA que ve imágenes recibe los diseños; sin cuentas de Hugging Face no se genera la imagen.
        config(['services.huggingface.tokens' => [], 'services.groq.key' => 'test']);
        Http::fake(['api.groq.com/*' => Http::response(['choices' => [['message' => ['content' => '<think>x</think>{"prompt":"roman marble set","concept":"Set romano"}']]]])]);
        $this->postJson($url, ['style' => 'clasico', 'idea' => 'Roma', 'palette' => ['#C8962E'], 'designs' => ['data:image/jpeg;base64,AAAA'], 'ratio' => '4:5'])
            ->assertUnprocessable()->assertJsonFragment(['message' => 'Crear imágenes con IA necesita una cuenta de Hugging Face (HF_TOKEN en el .env de la API)']);
        Http::assertSent(fn ($req) => str_contains($req->url(), 'api.groq.com') && str_contains(json_encode($req->data(), JSON_UNESCAPED_SLASHES), 'data:image/jpeg;base64,AAAA'));
        Http::assertNotSent(fn ($req) => str_contains($req->url(), 'hf.space'));
    }

    public function test_recorte_de_la_foto_del_producto(): void
    {
        $this->actingAsAdmin();
        $url = '/api/messaging/marketing/product-cutout';
        $this->postJson($url, [])->assertUnprocessable();
        // Solo fotos de la tienda: nada fuera de /uploads ni direcciones externas que no sean de un producto.
        foreach (['/uploads/../.env', '/etc/passwd', 'https://otro.sitio/x.png', '/uploads/templates/no-existe.png'] as $bad) {
            $this->postJson($url, ['url' => $bad])->assertNotFound();
        }
        Http::assertNothingSent();
        // Ya recortada: sale del archivo guardado, sin volver a llamar a la IA.
        $src = '/uploads/templates/qa-recorte.png';
        $out = public_path('uploads/marketing/recortes/'.sha1($src).'.png');
        @mkdir(dirname($out), 0775, true);
        file_put_contents($out, 'png');
        try {
            $this->postJson($url, ['url' => $src])->assertOk()->assertJsonPath('data.cached', true)
                ->assertJsonPath('data.url', '/uploads/marketing/recortes/'.sha1($src).'.png');
        } finally {
            @unlink($out);
        }
    }

    public function test_prenda_en_vistas_seguridad_y_espejo(): void
    {
        $this->actingAsAdmin();
        // Solo imágenes creadas por la IA del estudio: nada de otras carpetas ni rutas con "..".
        foreach (['../.env', 'uploads/templates/x.png', 'uploads/marketing/ia/../../../.env', '/etc/passwd'] as $bad) {
            $this->postJson('/api/messaging/marketing/ai-garment/cutout', ['path' => $bad])->assertNotFound();
        }
        $this->postJson('/api/messaging/marketing/ai-garment/view', ['path' => 'uploads/marketing/ia/x.webp', 'view' => 'arriba'])->assertUnprocessable();
        $this->postJson('/api/messaging/marketing/ai-garment/front', ['idea' => 'x'])->assertUnprocessable();

        // Espejo: la manga derecha a partir de la izquierda, en PNG con transparencia.
        $dir = public_path('uploads/marketing/ia');
        @mkdir($dir, 0775, true);
        $img = imagecreatetruecolor(4, 2);
        imagealphablending($img, false);
        imagesavealpha($img, true);
        imagefill($img, 0, 0, imagecolorallocatealpha($img, 0, 0, 0, 127));
        imagesetpixel($img, 0, 0, imagecolorallocatealpha($img, 255, 0, 0, 0));
        imagepng($img, $dir.'/qa-espejo-test.png');
        imagedestroy($img);
        try {
            $r = $this->postJson('/api/messaging/marketing/ai-garment/mirror', ['path' => 'uploads/marketing/ia/qa-espejo-test.png'])->assertOk()->json('data');
            $out = imagecreatefrompng(public_path($r['path']));
            // El píxel rojo pasó de la esquina izquierda a la derecha; lo demás sigue transparente.
            $this->assertSame(255, (imagecolorat($out, 3, 0) >> 16) & 0xFF);
            $this->assertSame(127, (imagecolorat($out, 0, 0) >> 24) & 0x7F);
            @unlink(public_path($r['path']));
        } finally {
            @unlink($dir.'/qa-espejo-test.png');
        }
        // El espejo es solo para PNG (las vistas ya recortadas).
        file_put_contents($dir.'/qa-espejo-test.webp', 'x');
        $this->postJson('/api/messaging/marketing/ai-garment/mirror', ['path' => 'uploads/marketing/ia/qa-espejo-test.webp'])->assertUnprocessable();
        @unlink($dir.'/qa-espejo-test.webp');
    }

        public function test_ficha_de_la_marca(): void
    {
        $this->actingAsAdmin();
        $k = $this->getJson('/api/messaging/marketing/brand')->assertOk()->json('data');
        $this->assertSame('Elegant Lime', collect($k['colors'])->firstWhere('key', 'accent')['name']);
        $this->putJson('/api/messaging/marketing/brand', ['colors' => [['key' => 'accent', 'name' => 'Lima', 'hex' => 'verde']]])->assertUnprocessable();
        $r = $this->putJson('/api/messaging/marketing/brand', [
            'slogan' => 'Hecho con intención',
            'colors' => [['key' => 'primary', 'name' => 'Carbón', 'hex' => '#111111'], ['key' => 'accent', 'name' => 'Lima', 'hex' => '#abd04c']],
            'fonts' => ['heading' => 'Bebas Neue', 'body' => 'Comic Sans', 'headingUppercase' => false],
            'voice' => ['tone' => 'elegante', 'hashtags' => ['#toclex', 'hecho con'], 'personality' => 'Sobria'],
        ])->assertOk()->json('data');
        $this->assertSame('Hecho con intención', $r['slogan']);
        $this->assertSame('#ABD04C', $r['colors'][1]['hex']);
        $this->assertSame(['Bebas Neue', 'Inter', false], [$r['fonts']['heading'], $r['fonts']['body'], $r['fonts']['headingUppercase']]);
        $this->assertSame(['toclex', 'hechocon'], $r['voice']['hashtags']);
    }

    public function test_biblioteca_publicar_programar_y_calendario(): void
    {
        $this->actingAsAdmin();
        // Un reel debe ser video.
        $this->post('/api/messaging/marketing/creatives', [
            'title' => 'x', 'kind' => 'reel', 'media' => UploadedFile::fake()->image('a.png'),
        ], ['Accept' => 'application/json'])->assertUnprocessable();
        $img = $this->creative();
        $this->assertFileExists(public_path(ltrim($img['media'], '/')));
        $video = $this->creative('reel', 'video/mp4');
        $this->assertSame('video', $video['mediaType']);

        // Sin página de Facebook conectada no se publica.
        $this->postJson('/api/messaging/marketing/publish', ['creativeIds' => [$img['id']], 'platforms' => ['facebook']])->assertUnprocessable();
        $this->channel();

        // Un video no va en carrusel.
        $this->postJson('/api/messaging/marketing/publish', ['creativeIds' => [$img['id'], $video['id']], 'platforms' => ['facebook']])->assertUnprocessable();

        // Ahora: Facebook (foto) e Instagram (reel), con Meta simulado.
        Http::fake([
            'graph.facebook.com/*/111/photos' => Http::response(['id' => 'p1', 'post_id' => '111_p1']),
            'graph.facebook.com/*/111?fields=instagram_business_account*' => Http::response(['instagram_business_account' => ['id' => 'ig9']]),
            'graph.facebook.com/*/111?*' => Http::response(['instagram_business_account' => ['id' => 'ig9']]),
            'graph.facebook.com/*/ig9/media_publish' => Http::response(['id' => 'm77']),
            'graph.facebook.com/*/ig9/media' => Http::response(['id' => 'c55']),
            'graph.facebook.com/*/c55*' => Http::response(['status_code' => 'FINISHED']),
            'graph.facebook.com/*' => Http::response(['permalink_url' => 'https://fb.com/x', 'permalink' => 'https://ig.com/x']),
        ]);
        config(['services.meta.public_domain' => 'tienda.test']);
        $fb = $this->postJson('/api/messaging/marketing/publish', ['creativeIds' => [$img['id']], 'platforms' => ['facebook']])->assertOk()->json('data.0');
        $this->assertSame(['published', 'photo'], [$fb['status'], $fb['type']]);
        $ig = $this->postJson('/api/messaging/marketing/publish', ['creativeIds' => [$video['id']], 'platforms' => ['instagram'], 'caption' => 'Reel'])->assertOk()->json('data.0');
        $this->assertSame(['published', 'video'], [$ig['status'], $ig['type']], (string) ($ig['error'] ?? ''));
        Http::assertSent(fn ($req) => str_contains($req->url(), '/ig9/media') && ($req['media_type'] ?? null) === 'REELS');

        // Programar: queda programada y la publica el comando cuando llega la hora.
        $this->postJson('/api/messaging/marketing/publish', ['creativeIds' => [$img['id']], 'platforms' => ['facebook'], 'scheduledAt' => now()->subDay()->toIso8601String()])->assertUnprocessable();
        $when = now()->addHour();
        $s = $this->postJson('/api/messaging/marketing/publish', ['creativeIds' => [$img['id']], 'platforms' => ['facebook'], 'scheduledAt' => $when->toIso8601String()])->assertOk()->json('data.0');
        $this->assertSame('scheduled', $s['status']);
        // Con programadas pendientes la pieza no se borra.
        $this->deleteJson("/api/messaging/marketing/creatives/{$img['id']}")->assertStatus(409);
        $this->patchJson("/api/messaging/marketing/posts/{$s['id']}/schedule", ['scheduledAt' => now()->addHours(2)->toIso8601String()])->assertOk();

        $cal = collect($this->getJson('/api/messaging/marketing/calendar?month='.now()->format('Y-m'))->assertOk()->json('data'));
        $this->assertTrue($cal->contains(fn ($p) => $p['id'] === $s['id'] && $p['thumb'] === $img['media']));

        $this->assertSame(0, app(SocialPostService::class)->publishDue()); // todavía no es la hora
        SocialPost::where('id', $s['id'])->update(['scheduledAt' => now()->subMinute()]);
        $this->artisan('social:publish-scheduled')->assertSuccessful();
        $this->assertSame('published', SocialPost::find($s['id'])->status);

        // Ya publicada: la pieza se puede borrar de la biblioteca.
        $this->deleteJson("/api/messaging/marketing/creatives/{$img['id']}")->assertOk();
        $this->assertNull(MarketingCreative::find($img['id']));
    }
}
