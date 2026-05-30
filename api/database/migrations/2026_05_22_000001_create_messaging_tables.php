<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Módulo de Mensajería (Fase 1):
 * - channels: cada canal de mensajería (webchat, messenger, whatsapp, sms, instagram).
 * - contacts: persona/usuario externo con el que se conversa.
 * - conversations: hilo abierto entre un contacto y la empresa, por un canal.
 * - messages: cada mensaje del hilo (inbound o outbound).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('channels', function (Blueprint $table) {
            $table->id();
            $table->string('type', 30); // webchat | messenger | whatsapp | instagram | sms | email
            $table->string('name');
            $table->boolean('isActive')->default(true);
            // Toggle: ¿el bot/IA responde primero las conversaciones de este canal?
            $table->boolean('aiAutoReply')->default(false);
            $table->json('config')->nullable(); // credenciales y opciones propias del canal
            $table->timestamp('createdAt')->useCurrent();
            $table->timestamp('updatedAt')->useCurrent()->useCurrentOnUpdate();
        });

        Schema::create('contacts', function (Blueprint $table) {
            $table->id();
            $table->string('name')->nullable();
            $table->string('email')->nullable();
            $table->string('phone', 50)->nullable();
            $table->foreignId('userId')->nullable()->constrained('users')->nullOnDelete();
            // IDs externos por canal: { messenger: 'psid', whatsapp: '+57...', instagram: '@user' }
            $table->json('externalIds')->nullable();
            $table->string('avatarUrl', 500)->nullable();
            $table->json('metadata')->nullable();
            $table->timestamp('createdAt')->useCurrent();
            $table->timestamp('updatedAt')->useCurrent()->useCurrentOnUpdate();
            $table->index('email');
            $table->index('phone');
        });

        Schema::create('conversations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('channelId')->constrained('channels')->cascadeOnDelete();
            $table->foreignId('contactId')->constrained('contacts')->cascadeOnDelete();
            $table->string('status', 20)->default('open'); // open | pending | resolved | closed
            $table->foreignId('assigneeUserId')->nullable()->constrained('users')->nullOnDelete();
            // Si true, la IA responde primero los mensajes entrantes de esta conversación.
            $table->boolean('aiEnabled')->default(false);
            $table->timestamp('lastMessageAt')->nullable();
            $table->string('lastMessagePreview', 200)->nullable();
            $table->unsignedInteger('unreadCount')->default(0);
            // Token de sesión usado por el widget web para autenticar polling/send sin login.
            $table->string('sessionToken', 64)->nullable()->unique();
            $table->json('metadata')->nullable();
            $table->timestamp('createdAt')->useCurrent();
            $table->timestamp('updatedAt')->useCurrent()->useCurrentOnUpdate();
            $table->index(['status', 'lastMessageAt']);
            $table->index('assigneeUserId');
        });

        Schema::create('messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('conversationId')->constrained('conversations')->cascadeOnDelete();
            $table->string('direction', 10); // inbound | outbound
            $table->string('senderType', 20); // contact | user | system | bot
            $table->foreignId('senderUserId')->nullable()->constrained('users')->nullOnDelete();
            $table->text('content')->nullable();
            $table->json('attachments')->nullable();
            // ID que dio el canal externo (Meta/Twilio/etc.). Sirve para deduplicar webhooks.
            $table->string('channelMessageId')->nullable();
            $table->string('status', 20)->default('sent'); // sent | delivered | read | failed
            $table->timestamp('createdAt')->useCurrent();
            $table->timestamp('updatedAt')->useCurrent()->useCurrentOnUpdate();
            $table->index('conversationId');
            $table->index('channelMessageId');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('messages');
        Schema::dropIfExists('conversations');
        Schema::dropIfExists('contacts');
        Schema::dropIfExists('channels');
    }
};
