<?php

namespace Database\Seeders;

use App\Models\Channel;
use Illuminate\Database\Seeder;

/**
 * Canales iniciales del módulo de mensajería.
 * En Fase 1 solo se crea el canal de Chat Web (activo, sin IA por defecto).
 * Los canales externos (Messenger/WhatsApp/SMS) se agregan en fases siguientes.
 */
class MessagingSeeder extends Seeder
{
    public function run(): void
    {
        // Chat web propio — activo desde el día uno (no requiere credenciales externas).
        Channel::updateOrCreate(
            ['type' => 'webchat'],
            [
                'name' => 'Chat Web',
                'isActive' => true,
                'aiAutoReply' => false,
                'config' => [
                    'greeting' => '¡Hola! ¿En qué te podemos ayudar?',
                    'requireEmail' => false,
                ],
            ]
        );

        // Facebook Messenger — Meta Graph API + Page Access Token.
        Channel::updateOrCreate(
            ['type' => 'messenger'],
            [
                'name' => 'Facebook Messenger',
                'isActive' => false,
                'aiAutoReply' => false,
                'config' => [
                    'appId' => '',
                    'appSecret' => '',
                    'pageId' => '',
                    'pageName' => '',
                    'pageAccessToken' => '',
                    'verifyToken' => '',
                ],
            ]
        );

        // Instagram Direct — usa el Page Access Token de la Página de FB enlazada.
        Channel::updateOrCreate(
            ['type' => 'instagram'],
            [
                'name' => 'Instagram Direct',
                'isActive' => false,
                'aiAutoReply' => false,
                'config' => [
                    'appId' => '',
                    'appSecret' => '',
                    'instagramBusinessAccountId' => '',
                    'username' => '',
                    'pageAccessToken' => '',
                    'verifyToken' => '',
                ],
            ]
        );

        // WhatsApp Cloud API — WABA + Phone Number ID + System User Token.
        Channel::updateOrCreate(
            ['type' => 'whatsapp'],
            [
                'name' => 'WhatsApp Business',
                'isActive' => false,
                'aiAutoReply' => false,
                'config' => [
                    'appId' => '',
                    'appSecret' => '',
                    'wabaId' => '',
                    'phoneNumberId' => '',
                    'displayPhoneNumber' => '',
                    'permanentAccessToken' => '',
                    'verifyToken' => '',
                ],
            ]
        );

        // SMS — provider externo (Twilio, Hablame, LabsMobile, etc.).
        Channel::updateOrCreate(
            ['type' => 'sms'],
            [
                'name' => 'SMS',
                'isActive' => false,
                'aiAutoReply' => false,
                'config' => [
                    'provider' => 'twilio',
                    'accountSid' => '',
                    'authToken' => '',
                    'fromNumber' => '',
                ],
            ]
        );
    }
}
