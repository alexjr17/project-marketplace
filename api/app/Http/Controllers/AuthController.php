<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Models\Address;
use App\Models\Role;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;

class AuthController extends Controller
{
    use ApiResponse;

    /** Rol por defecto para usuarios nuevos (Cliente). */
    private const DEFAULT_ROLE_ID = 2;

    public function register(Request $request)
    {
        $data = $request->validate([
            'email' => 'required|email|max:255',
            'password' => 'required|string|min:6|max:100',
            'name' => 'required|string|min:2|max:100',
            'phone' => 'nullable|string',
        ]);

        $email = strtolower(trim($data['email']));

        if (User::where('email', $email)->exists()) {
            return $this->error('El email ya está registrado', 409);
        }

        if (! Role::find(self::DEFAULT_ROLE_ID)) {
            return $this->error('Error de configuración: rol por defecto no encontrado', 400);
        }

        $user = User::create([
            'email' => $email,
            'passwordHash' => Hash::make($data['password']),
            'name' => trim($data['name']),
            'phone' => $data['phone'] ?? null,
            'roleId' => self::DEFAULT_ROLE_ID,
            'status' => 'ACTIVE',
        ]);

        $token = $user->createToken('auth')->plainTextToken;

        return $this->created(
            ['user' => $user->authPayload(), 'token' => $token],
            'Usuario registrado exitosamente'
        );
    }

    public function login(Request $request)
    {
        $data = $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
        ]);

        $email = strtolower(trim($data['email']));
        $user = User::where('email', $email)->first();

        if (! $user || ! Hash::check($data['password'], $user->passwordHash)) {
            return $this->error('Credenciales inválidas', 401);
        }

        if ($user->status !== 'ACTIVE') {
            return $this->error('Tu cuenta está desactivada. Contacta al administrador.', 401);
        }

        $token = $user->createToken('auth')->plainTextToken;

        return $this->success(
            ['user' => $user->authPayload(), 'token' => $token],
            'Inicio de sesión exitoso'
        );
    }

    public function me(Request $request)
    {
        return $this->success(['user' => $request->user()->authPayload()]);
    }

    public function updateMe(Request $request)
    {
        $data = $request->validate([
            'name' => 'nullable|string',
            'phone' => 'nullable|string',
            'cedula' => 'nullable|string',
            'address' => 'nullable|string',
            'city' => 'nullable|string',
            'postalCode' => 'nullable|string',
            'country' => 'nullable|string',
        ]);

        $user = $request->user();

        $user->fill(array_filter([
            'name' => $data['name'] ?? null,
            'phone' => $data['phone'] ?? null,
            'cedula' => $data['cedula'] ?? null,
        ], fn ($v) => $v !== null));
        $user->save();

        // Dirección por defecto del usuario.
        $address = $user->addresses()->where('isDefault', true)->first();

        if (! empty($data['address']) || ! empty($data['city']) || ! empty($data['postalCode']) || ! empty($data['country'])) {
            if ($address) {
                $address->update(array_filter([
                    'address' => $data['address'] ?? null,
                    'city' => $data['city'] ?? null,
                    'postalCode' => $data['postalCode'] ?? null,
                    'country' => $data['country'] ?? null,
                ], fn ($v) => $v !== null));
            } else {
                $address = Address::create([
                    'userId' => $user->id,
                    'label' => 'Principal',
                    'address' => $data['address'] ?? '',
                    'city' => $data['city'] ?? '',
                    'postalCode' => $data['postalCode'] ?? '',
                    'country' => $data['country'] ?? 'Colombia',
                    'isDefault' => true,
                ]);
            }
        }

        $payload = $user->fresh()->authPayload();
        $payload['profile'] = [
            'cedula' => $user->cedula,
            'phone' => $user->phone,
            'address' => $address?->address,
            'city' => $address?->city,
            'postalCode' => $address?->postalCode,
            'country' => $address?->country,
        ];

        return $this->success($payload, 'Perfil actualizado exitosamente');
    }

    public function forgotPassword(Request $request)
    {
        $data = $request->validate(['email' => 'required|email']);
        $email = strtolower(trim($data['email']));

        $user = User::where('email', $email)->first();

        if ($user) {
            $resetToken = bin2hex(random_bytes(32)); // 64 caracteres hex
            $user->resetToken = hash('sha256', $resetToken);
            $user->resetTokenExp = now()->addHour();
            $user->save();

            $frontendUrl = env('FRONTEND_URL', 'http://localhost:5173');
            $resetUrl = $frontendUrl.'/reset-password?token='.$resetToken.'&email='.urlencode($email);

            Log::info("[Auth] Token de recuperación para {$email}: {$resetToken}");
            Log::info("[Auth] URL de reset: {$resetUrl}");
            // TODO (Fase 4): enviar el email real de recuperación.
        }

        // Siempre responde igual para no revelar si el email existe.
        return $this->success(null, 'Si el email existe, recibirás instrucciones para recuperar tu contraseña');
    }

    public function resetPassword(Request $request)
    {
        $data = $request->validate([
            'token' => 'required|string',
            'password' => 'required|string|min:6|max:100',
        ]);

        $user = User::where('resetToken', hash('sha256', $data['token']))
            ->where('resetTokenExp', '>', now())
            ->first();

        if (! $user) {
            return $this->error('Token inválido o expirado', 400);
        }

        $user->passwordHash = Hash::make($data['password']);
        $user->resetToken = null;
        $user->resetTokenExp = null;
        $user->save();

        return $this->success(null, 'Contraseña actualizada exitosamente');
    }

    public function changePassword(Request $request)
    {
        $data = $request->validate([
            'currentPassword' => 'required|string',
            'newPassword' => 'required|string|min:6|max:100',
        ]);

        $user = $request->user();

        if (! Hash::check($data['currentPassword'], $user->passwordHash)) {
            return $this->error('La contraseña actual es incorrecta', 400);
        }

        $user->passwordHash = Hash::make($data['newPassword']);
        $user->save();

        return $this->success(null, 'Contraseña cambiada exitosamente');
    }

    public function logout(Request $request)
    {
        // Revoca el token actual si la petición viene autenticada.
        $request->user()?->currentAccessToken()?->delete();

        return $this->success(null, 'Sesión cerrada exitosamente');
    }
}
