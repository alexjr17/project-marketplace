<?php

namespace Tests\Feature\Flows\Messaging;

use App\Models\BotKnowledge;
use App\Models\BotKnowledgeCategory;
use App\Models\Channel;
use App\Models\Notification;
use App\Models\SocialPost;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\ActsAsRoles;
use Tests\Feature\Flows\Store\Concerns\StoreFixtures;
use Tests\TestCase;

/**
 * Mensajería del panel después de pasar la lógica a servicios: canales (secretos enmascarados),
 * base de conocimiento del bot, publicaciones y notificaciones de reseña.
 */
class MessagingAdminTest extends TestCase
{
    use ActsAsRoles, RefreshDatabase, StoreFixtures;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRolesAndUsers();
    }

    private function messenger(array $config = []): Channel
    {
        return Channel::create(['type' => 'messenger', 'name' => 'Facebook', 'isActive' => false, 'aiAutoReply' => false, 'config' => $config]);
    }

    // ---------------- Canales ----------------

    public function test_los_secretos_salen_enmascarados_y_no_se_pisan_al_guardar(): void
    {
        $this->actingAsAdmin();
        $c = $this->messenger(['appId' => '123', 'appSecret' => 'supersecreto9876']);

        $this->getJson("/api/messaging/channels/{$c->id}")->assertOk()
            ->assertJsonPath('data.config.appSecret', '••••9876')
            ->assertJsonPath('data.config.appId', '123');

        // El secreto vuelve enmascarado (tal como salió): se conserva; lo demás se combina.
        $this->patchJson("/api/messaging/channels/{$c->id}", [
            'isActive' => true,
            'config' => ['appSecret' => '••••9876', 'pageId' => 'P1'],
        ])->assertOk()->assertJsonPath('message', 'Canal actualizado')->assertJsonPath('data.isActive', true);

        $config = $c->fresh()->config;
        $this->assertSame('supersecreto9876', $config['appSecret']);
        $this->assertSame('P1', $config['pageId']);
        $this->assertSame('123', $config['appId']);
    }

    public function test_probar_canal_informa_los_campos_que_faltan(): void
    {
        $this->actingAsAdmin();
        $c = $this->messenger(['appId' => '1', 'appSecret' => 's', 'pageId' => 'p']);

        $this->postJson("/api/messaging/channels/{$c->id}/test")->assertStatus(422)
            ->assertJsonPath('message', 'Faltan campos por completar: pageAccessToken, verifyToken');

        $c->update(['config' => $c->config + ['pageAccessToken' => 't', 'verifyToken' => 'v']]);
        $this->postJson("/api/messaging/channels/{$c->id}/test")->assertOk()->assertJsonPath('data.status', 'ok');
    }

    // ---------------- Base de conocimiento ----------------

    public function test_categorias_slug_unico_conteo_y_renombre_que_mueve_las_entradas(): void
    {
        $this->actingAsAdmin();
        $this->postJson('/api/messaging/knowledge/categories', ['label' => 'Envíos'])->assertCreated()
            ->assertJsonPath('data.slug', 'envios');
        // El slug generado no choca: lleva sufijo.
        $cat = $this->postJson('/api/messaging/knowledge/categories', ['label' => 'Envíos'])->assertCreated()
            ->assertJsonPath('data.slug', 'envios_2')->json('data');

        $this->postJson('/api/messaging/knowledge', ['category' => 'envios_2', 'title' => 'Tiempos', 'content' => '3 días'])
            ->assertCreated()->assertJsonPath('data.isActive', true)->assertJsonPath('data.sortOrder', 0);

        $list = collect($this->getJson('/api/messaging/knowledge/categories')->assertOk()->json('data'))->keyBy('slug');
        $this->assertSame(0, $list['envios']['entriesCount']);
        $this->assertSame(1, $list['envios_2']['entriesCount']);

        // Renombrar a un slug ocupado: 422 y nada cambia.
        $this->patchJson("/api/messaging/knowledge/categories/{$cat['id']}", ['slug' => 'envios'])->assertStatus(422)
            ->assertJsonPath('message', 'Ya existe otra categoría con ese slug');

        // Renombrar: la entrada pasa al slug nuevo.
        $this->patchJson("/api/messaging/knowledge/categories/{$cat['id']}", ['slug' => 'despachos', 'label' => 'Despachos'])
            ->assertOk()->assertJsonPath('data.slug', 'despachos')->assertJsonPath('data.entriesCount', 1);
        $this->assertSame(1, BotKnowledge::where('category', 'despachos')->count());

        // No se borra con entradas.
        $this->deleteJson("/api/messaging/knowledge/categories/{$cat['id']}")->assertStatus(422)
            ->assertJsonPath('message', 'No se puede eliminar: hay 1 entradas en esta categoría. Muévelas o elimínalas primero.');
        BotKnowledge::query()->delete();
        $this->deleteJson("/api/messaging/knowledge/categories/{$cat['id']}")->assertOk();
        $this->assertNull(BotKnowledgeCategory::find($cat['id']));
    }

    // ---------------- Publicaciones ----------------

    public function test_publicaciones_requieren_canal_y_contenido(): void
    {
        $this->actingAsAdmin();
        $this->postJson('/api/messaging/posts', ['platform' => 'facebook', 'content' => 'Hola'])->assertStatus(422)
            ->assertJsonPath('message', 'Canal Messenger/FB no configurado');

        $this->messenger();
        $this->postJson('/api/messaging/posts/publish', ['platform' => 'facebook'])->assertStatus(422)
            ->assertJsonPath('message', 'La publicación debe tener al menos texto o imagen');

        $post = $this->postJson('/api/messaging/posts', ['platform' => 'facebook', 'mediaUrl' => ' https://x.test/a.jpg '])
            ->assertCreated()->assertJsonPath('message', 'Borrador creado')
            ->assertJsonPath('data.status', 'draft')->assertJsonPath('data.type', 'photo')
            ->assertJsonPath('data.mediaUrls', ['https://x.test/a.jpg'])->json('data');

        $this->getJson('/api/messaging/posts')->assertOk()->assertJsonPath('pagination.total', 1);

        // Un borrador se borra solo en local (no se llama a Meta).
        $this->deleteJson("/api/messaging/posts/{$post['id']}")->assertOk();
        $this->assertSame(0, SocialPost::count());
    }

    // ---------------- Notificaciones ----------------

    public function test_notificaciones_de_resena_traen_el_producto(): void
    {
        $this->seedStoreCatalog();
        $cliente = $this->actingAsCliente();
        $p = $this->makeProduct('Suéter', 58000, [['negro', 'M', 1]]);
        $p->update(['images' => ['front' => '/uploads/a.jpg']]);
        Notification::create(['userId' => $cliente->id, 'type' => 'REVIEW_AVAILABLE', 'title' => 'Califica', 'message' => 'x', 'referenceType' => 'product', 'referenceId' => $p->id, 'isRead' => false]);
        Notification::create(['userId' => $cliente->id, 'type' => 'SYSTEM', 'title' => 'Hola', 'message' => 'y', 'isRead' => true]);

        $res = $this->getJson('/api/notifications')->assertOk()->assertJsonPath('meta.unreadCount', 1)->json('data');
        $review = collect($res)->firstWhere('type', 'REVIEW_AVAILABLE');
        $this->assertSame('Suéter', $review['productName']);
        $this->assertSame('/uploads/a.jpg', $review['productImage']);
        $this->assertArrayNotHasKey('productName', collect($res)->firstWhere('type', 'SYSTEM'));
    }
}
