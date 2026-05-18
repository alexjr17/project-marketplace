<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Models\Address;
use App\Models\Role;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    use ApiResponse;

    /**
     * Forma del usuario que espera el frontend (replica formatUserResponse del Node).
     */
    private function formatUser(User $user): array
    {
        $role = $user->role;

        return [
            'id' => $user->id,
            'email' => $user->email,
            'name' => $user->name,
            'phone' => $user->phone,
            'cedula' => $user->cedula,
            'avatar' => $user->avatar,
            'roleId' => $user->roleId,
            'role' => $role?->name ?? '',
            'permissions' => is_array($role?->permissions) ? $role->permissions : [],
            'status' => $user->status,
            'createdAt' => $user->createdAt,
            'updatedAt' => $user->updatedAt,
        ];
    }

    // ==================== USUARIOS (Admin) ====================

    public function index(Request $request)
    {
        $data = $request->validate([
            'page' => 'nullable|integer|min:1',
            'limit' => 'nullable|integer|min:1|max:100',
            'search' => 'nullable|string',
            'status' => ['nullable', Rule::in(['ACTIVE', 'INACTIVE', 'SUSPENDED'])],
            'roleId' => 'nullable|integer',
            'sortBy' => ['nullable', Rule::in(['name', 'email', 'createdAt', 'updatedAt'])],
            'sortOrder' => ['nullable', Rule::in(['asc', 'desc'])],
        ]);

        $page = (int) ($data['page'] ?? 1);
        $limit = (int) ($data['limit'] ?? 10);

        $query = User::with('role');

        if (! empty($data['search'])) {
            $search = $data['search'];
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('cedula', 'like', "%{$search}%");
            });
        }
        if (! empty($data['status'])) {
            $query->where('status', $data['status']);
        }
        if (! empty($data['roleId'])) {
            $query->where('roleId', $data['roleId']);
        }

        $total = $query->count();
        $users = $query->orderBy($data['sortBy'] ?? 'createdAt', $data['sortOrder'] ?? 'desc')
            ->skip(($page - 1) * $limit)
            ->take($limit)
            ->get();

        return response()->json([
            'success' => true,
            'data' => $users->map(fn ($u) => $this->formatUser($u))->all(),
            'pagination' => [
                'page' => $page,
                'limit' => $limit,
                'total' => $total,
                'totalPages' => $limit > 0 ? (int) ceil($total / $limit) : 0,
            ],
        ]);
    }

    public function show(int $id)
    {
        $user = User::with('role')->find($id);

        if (! $user) {
            return $this->error('Usuario no encontrado', 404);
        }

        return $this->success($this->formatUser($user));
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'email' => 'required|email|max:255',
            'password' => 'required|string|min:6|max:100',
            'name' => 'required|string|min:2|max:100',
            'phone' => 'nullable|string',
            'cedula' => 'nullable|string',
            'roleId' => 'required|integer',
            'status' => ['nullable', Rule::in(['ACTIVE', 'INACTIVE', 'SUSPENDED'])],
        ]);

        $email = strtolower(trim($data['email']));

        if (User::where('email', $email)->exists()) {
            return $this->error('El email ya está registrado', 409);
        }

        if (! Role::find($data['roleId'])) {
            return $this->error('El rol especificado no existe', 400);
        }

        $user = User::create([
            'email' => $email,
            'passwordHash' => Hash::make($data['password']),
            'name' => $data['name'],
            'phone' => $data['phone'] ?? null,
            'cedula' => $data['cedula'] ?? null,
            'roleId' => $data['roleId'],
            'status' => $data['status'] ?? 'ACTIVE',
        ]);

        return $this->created($this->formatUser($user->load('role')), 'Usuario creado exitosamente');
    }

    public function update(Request $request, int $id)
    {
        $user = User::find($id);

        if (! $user) {
            return $this->error('Usuario no encontrado', 404);
        }

        $data = $request->validate([
            'email' => 'nullable|email|max:255',
            'name' => 'nullable|string|min:2|max:100',
            'phone' => 'nullable|string',
            'cedula' => 'nullable|string',
            'roleId' => 'nullable|integer',
            'status' => ['nullable', Rule::in(['ACTIVE', 'INACTIVE', 'SUSPENDED'])],
        ]);

        if (! empty($data['email'])) {
            $email = strtolower(trim($data['email']));
            if ($email !== $user->email && User::where('email', $email)->exists()) {
                return $this->error('El email ya está en uso', 409);
            }
            $user->email = $email;
        }

        if (! empty($data['roleId']) && ! Role::find($data['roleId'])) {
            return $this->error('El rol especificado no existe', 400);
        }

        foreach (['name', 'phone', 'cedula', 'roleId', 'status'] as $field) {
            if (array_key_exists($field, $data) && $data[$field] !== null) {
                $user->{$field} = $data[$field];
            }
        }
        $user->save();

        return $this->success($this->formatUser($user->load('role')), 'Usuario actualizado exitosamente');
    }

    public function destroy(int $id)
    {
        $user = User::find($id);

        if (! $user) {
            return $this->error('Usuario no encontrado', 404);
        }

        if ((int) $user->roleId === 1) {
            return $this->error('No se puede eliminar un superadmin', 400);
        }

        $user->delete();

        return $this->success(null, 'Usuario eliminado exitosamente');
    }

    // ==================== PERFIL PROPIO ====================

    public function profile(Request $request)
    {
        return $this->success($this->formatUser($request->user()->load('role')));
    }

    public function updateProfile(Request $request)
    {
        $data = $request->validate([
            'name' => 'nullable|string|min:2|max:100',
            'phone' => 'nullable|string',
            'cedula' => 'nullable|string',
        ]);

        $user = $request->user();
        foreach (['name', 'phone', 'cedula'] as $field) {
            if (array_key_exists($field, $data) && $data[$field] !== null) {
                $user->{$field} = $data[$field];
            }
        }
        $user->save();

        return $this->success($this->formatUser($user->load('role')), 'Perfil actualizado exitosamente');
    }

    // ==================== DIRECCIONES ====================

    public function addresses(Request $request)
    {
        $addresses = $request->user()->addresses()
            ->orderByDesc('isDefault')
            ->orderByDesc('createdAt')
            ->get();

        return $this->success($addresses);
    }

    public function storeAddress(Request $request)
    {
        $data = $this->validateAddress($request);
        $user = $request->user();

        if (! empty($data['isDefault'])) {
            $user->addresses()->where('isDefault', true)->update(['isDefault' => false]);
        }

        $address = Address::create($data + ['userId' => $user->id]);

        return $this->created($address, 'Dirección creada exitosamente');
    }

    public function updateAddress(Request $request, int $addressId)
    {
        $user = $request->user();
        $address = $user->addresses()->where('id', $addressId)->first();

        if (! $address) {
            return $this->error('Dirección no encontrada', 404);
        }

        $data = $this->validateAddress($request);

        if (! empty($data['isDefault'])) {
            $user->addresses()->where('isDefault', true)->where('id', '!=', $addressId)
                ->update(['isDefault' => false]);
        }

        $address->update($data);

        return $this->success($address, 'Dirección actualizada exitosamente');
    }

    public function destroyAddress(Request $request, int $addressId)
    {
        $address = $request->user()->addresses()->where('id', $addressId)->first();

        if (! $address) {
            return $this->error('Dirección no encontrada', 404);
        }

        $address->delete();

        return $this->success(null, 'Dirección eliminada exitosamente');
    }

    public function setDefaultAddress(Request $request, int $addressId)
    {
        $user = $request->user();
        $address = $user->addresses()->where('id', $addressId)->first();

        if (! $address) {
            return $this->error('Dirección no encontrada', 404);
        }

        $user->addresses()->where('isDefault', true)->update(['isDefault' => false]);
        $address->update(['isDefault' => true]);

        return $this->success($address, 'Dirección predeterminada actualizada');
    }

    private function validateAddress(Request $request): array
    {
        return $request->validate([
            'label' => 'required|string',
            'address' => 'required|string',
            'city' => 'required|string',
            'department' => 'nullable|string',
            'postalCode' => 'nullable|string',
            'country' => 'nullable|string',
            'isDefault' => 'nullable|boolean',
        ]);
    }
}
