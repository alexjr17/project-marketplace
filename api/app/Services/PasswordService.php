<?php

namespace App\Services;

use App\Models\Setting;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use RuntimeException;
use Throwable;

/**
 * Recuperación y cambio de contraseña.
 * - El token de recuperación se guarda hasheado, vence en 1 hora y NUNCA se escribe en el log.
 * - Cambiar o recuperar la contraseña cierra las demás sesiones (revoca los tokens).
 */
class PasswordService
{
    /** Genera el token y envía el correo. No revela si el email existe. */
    public function requestReset(string $email): void
    {
        $user = User::where('email', strtolower(trim($email)))->first();
        if (! $user) {
            return;
        }

        $token = bin2hex(random_bytes(32));
        $user->resetToken = hash('sha256', $token);
        $user->resetTokenExp = now()->addHour();
        $user->save();

        $resetUrl = rtrim((string) config('app.frontend_url'), '/')
            .'/reset-password?token='.$token.'&email='.urlencode($user->email);

        $this->sendResetEmail($user, $resetUrl);
    }

    /** Cambia la contraseña con un token vigente y cierra todas las sesiones del usuario. */
    public function resetWithToken(string $token, string $password): void
    {
        $user = User::where('resetToken', hash('sha256', $token))
            ->where('resetTokenExp', '>', now())
            ->first();
        if (! $user) {
            throw new RuntimeException('Token inválido o expirado', 400);
        }

        $user->passwordHash = Hash::make($password);
        $user->resetToken = null;
        $user->resetTokenExp = null;
        $user->save();

        $user->tokens()->delete();
    }

    /** Cambia la contraseña del usuario autenticado y cierra sus OTRAS sesiones. */
    public function change(User $user, string $current, string $new): void
    {
        if (! Hash::check($current, $user->passwordHash)) {
            throw new RuntimeException('La contraseña actual es incorrecta', 400);
        }

        $user->passwordHash = Hash::make($new);
        $user->save();

        $currentId = $user->currentAccessToken()?->id;
        $user->tokens()->when($currentId, fn ($q) => $q->where('id', '!=', $currentId))->delete();
    }

    private function sendResetEmail(User $user, string $resetUrl): void
    {
        // En producción, con el mailer "log" el correo (con el enlace y el token) quedaría en
        // el log: no se envía y solo se avisa que falta configurar el correo.
        if (app()->environment('production') && in_array(config('mail.default'), ['log', 'array'], true)) {
            Log::warning('Recuperación de contraseña: el correo no está configurado (MAIL_MAILER); no se envió el enlace.');

            return;
        }

        $siteName = (string) (Setting::where('key', 'general_settings')->first()?->value['siteName'] ?? config('app.name'));

        try {
            Mail::send('emails.password-reset', [
                'name' => $user->name,
                'siteName' => $siteName,
                'resetUrl' => $resetUrl,
            ], function ($message) use ($user, $siteName) {
                $message->to($user->email, $user->name)->subject("Recupera tu contraseña · {$siteName}");
            });
        } catch (Throwable $e) {
            Log::error('Recuperación de contraseña: no se pudo enviar el correo: '.$e->getMessage());
        }
    }
}
