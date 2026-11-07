<?php

namespace App\Services\Messaging;

use App\Models\Channel;

/**
 * Canales de mensajería (Messenger, Instagram, WhatsApp, SMS, Chat web): credenciales con
 * los secretos enmascarados al salir, guardado sin pisar secretos y prueba de campos.
 */
class ChannelService
{
    /** Claves secretas del canal: nunca salen completas en las respuestas. */
    public const SECRET_KEYS = ['appSecret', 'pageAccessToken', 'permanentAccessToken', 'authToken'];

    public const MASK = '••••';

    /** Campos obligatorios por tipo de canal para darlo por configurado. */
    private const REQUIRED_FIELDS = [
        'messenger' => ['appId', 'appSecret', 'pageId', 'pageAccessToken', 'verifyToken'],
        'instagram' => ['appId', 'appSecret', 'instagramBusinessAccountId', 'pageAccessToken', 'verifyToken'],
        'whatsapp' => ['wabaId', 'phoneNumberId', 'permanentAccessToken', 'verifyToken'],
        'sms' => ['provider', 'accountSid', 'authToken', 'fromNumber'],
    ];

    /** @return array<int, array> */
    public function all(): array
    {
        return Channel::orderBy('id')->get()->map(fn ($c) => $this->format($c))->all();
    }

    /**
     * Actualiza nombre, estado, respuesta automática y credenciales. Las credenciales se
     * combinan con las guardadas, y un secreto que vuelve enmascarado no se toca.
     */
    public function update(Channel $channel, array $data): Channel
    {
        foreach (['name', 'isActive', 'aiAutoReply'] as $field) {
            if (array_key_exists($field, $data)) {
                $channel->{$field} = $field === 'name' ? $data[$field] : (bool) $data[$field];
            }
        }
        if (is_array($data['config'] ?? null)) {
            $incoming = array_filter(
                $data['config'],
                fn ($v, $k) => ! (in_array($k, self::SECRET_KEYS, true) && is_string($v) && str_starts_with($v, self::MASK)),
                ARRAY_FILTER_USE_BOTH,
            );
            $channel->config = array_merge((array) $channel->config, $incoming);
        }
        $channel->save();

        return $channel->fresh();
    }

    /** Campos obligatorios que le faltan al canal según su tipo. */
    public function missingFields(Channel $channel): array
    {
        $config = (array) $channel->config;

        return array_values(array_filter(
            self::REQUIRED_FIELDS[$channel->type] ?? [],
            fn ($k) => empty($config[$k] ?? null),
        ));
    }

    public function format(Channel $c): array
    {
        return [
            'id' => $c->id,
            'type' => $c->type,
            'name' => $c->name,
            'isActive' => (bool) $c->isActive,
            'aiAutoReply' => (bool) $c->aiAutoReply,
            'config' => $this->maskedConfig($c),
            'createdAt' => optional($c->createdAt)->toIso8601String(),
            'updatedAt' => optional($c->updatedAt)->toIso8601String(),
        ];
    }

    private function maskedConfig(Channel $c): array
    {
        $config = (array) $c->config;
        foreach (self::SECRET_KEYS as $key) {
            if (! empty($config[$key]) && is_string($config[$key])) {
                $config[$key] = self::MASK.substr($config[$key], -4);
            }
        }

        return $config;
    }
}
