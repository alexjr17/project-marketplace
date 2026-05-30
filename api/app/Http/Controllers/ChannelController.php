<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Models\Channel;
use Illuminate\Http\Request;

/**
 * Configuración de canales del módulo de mensajería:
 * lista canales, actualiza credenciales/estado, prueba conexión.
 */
class ChannelController extends Controller
{
    use ApiResponse;

    public function index()
    {
        $channels = Channel::orderBy('id')->get()->map(fn ($c) => $this->format($c))->all();

        return $this->success($channels);
    }

    public function show(int $id)
    {
        $channel = Channel::find($id);
        if (! $channel) {
            return $this->error('Canal no encontrado', 404);
        }

        return $this->success($this->format($channel));
    }

    public function update(int $id, Request $request)
    {
        $channel = Channel::find($id);
        if (! $channel) {
            return $this->error('Canal no encontrado', 404);
        }

        $data = $request->validate([
            'name' => 'nullable|string|max:100',
            'isActive' => 'nullable|boolean',
            'aiAutoReply' => 'nullable|boolean',
            'config' => 'nullable|array',
        ]);

        if (array_key_exists('name', $data)) {
            $channel->name = $data['name'];
        }
        if (array_key_exists('isActive', $data)) {
            $channel->isActive = (bool) $data['isActive'];
        }
        if (array_key_exists('aiAutoReply', $data)) {
            $channel->aiAutoReply = (bool) $data['aiAutoReply'];
        }
        if (array_key_exists('config', $data) && is_array($data['config'])) {
            // Merge: campos no provistos conservan su valor anterior.
            $channel->config = array_merge((array) $channel->config, $data['config']);
        }
        $channel->save();

        return $this->success($this->format($channel->fresh()), 'Canal actualizado');
    }

    /**
     * Prueba de conexión (stub para Fase 1).
     * Cuando se conecten los SDKs reales (Meta Graph, Twilio…) llamará a sus
     * endpoints de verificación. Por ahora solo valida que los campos clave
     * estén presentes según el tipo de canal.
     */
    public function test(int $id)
    {
        $channel = Channel::find($id);
        if (! $channel) {
            return $this->error('Canal no encontrado', 404);
        }

        $missing = $this->missingFields($channel);
        if (count($missing) > 0) {
            return $this->error(
                'Faltan campos por completar: '.implode(', ', $missing),
                422
            );
        }

        return $this->success([
            'status' => 'ok',
            'note' => 'Validación local OK. La verificación real contra el proveedor se habilita al conectar el SDK (próximas fases).',
        ]);
    }

    private function missingFields(Channel $channel): array
    {
        $required = match ($channel->type) {
            'messenger' => ['appId', 'appSecret', 'pageId', 'pageAccessToken', 'verifyToken'],
            'instagram' => ['appId', 'appSecret', 'instagramBusinessAccountId', 'pageAccessToken', 'verifyToken'],
            'whatsapp' => ['wabaId', 'phoneNumberId', 'permanentAccessToken', 'verifyToken'],
            'sms' => ['provider', 'accountSid', 'authToken', 'fromNumber'],
            default => [],
        };

        $config = (array) $channel->config;

        return array_values(array_filter($required, fn ($k) => empty($config[$k] ?? null)));
    }

    private function format(Channel $c): array
    {
        return [
            'id' => $c->id,
            'type' => $c->type,
            'name' => $c->name,
            'isActive' => (bool) $c->isActive,
            'aiAutoReply' => (bool) $c->aiAutoReply,
            'config' => (array) $c->config,
            'createdAt' => optional($c->createdAt)->toIso8601String(),
            'updatedAt' => optional($c->updatedAt)->toIso8601String(),
        ];
    }
}
