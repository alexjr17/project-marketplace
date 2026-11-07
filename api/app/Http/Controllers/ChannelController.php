<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Models\Channel;
use App\Services\Messaging\ChannelService;
use Illuminate\Http\Request;

/**
 * Configuración de canales del módulo de mensajería: lista canales, actualiza
 * credenciales/estado y prueba la conexión. Las reglas están en ChannelService.
 */
class ChannelController extends Controller
{
    use ApiResponse;

    public function __construct(private ChannelService $channels) {}

    public function index()
    {
        return $this->success($this->channels->all());
    }

    public function show(int $id)
    {
        $channel = Channel::find($id);
        if (! $channel) {
            return $this->error('Canal no encontrado', 404);
        }

        return $this->success($this->channels->format($channel));
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

        return $this->success($this->channels->format($this->channels->update($channel, $data)), 'Canal actualizado');
    }

    /**
     * Prueba de conexión: por ahora valida que estén los campos clave del tipo de canal.
     * La verificación real contra el proveedor (Meta Graph, Twilio…) llega con sus SDKs.
     */
    public function test(int $id)
    {
        $channel = Channel::find($id);
        if (! $channel) {
            return $this->error('Canal no encontrado', 404);
        }

        $missing = $this->channels->missingFields($channel);
        if ($missing) {
            return $this->error('Faltan campos por completar: '.implode(', ', $missing), 422);
        }

        return $this->success([
            'status' => 'ok',
            'note' => 'Validación local OK. La verificación real contra el proveedor se habilita al conectar el SDK (próximas fases).',
        ]);
    }
}
