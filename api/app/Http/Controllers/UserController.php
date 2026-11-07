<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Services\Users\AddressService;
use App\Services\Users\UserAdminService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Usuarios (panel), perfil propio y direcciones. Las reglas viven en Users\UserAdminService
 * (con UserPolicy) y Users\AddressService.
 */
class UserController extends Controller
{
    use ApiResponse;

    private const STATUSES = ['ACTIVE', 'INACTIVE', 'SUSPENDED'];

    public function __construct(
        private UserAdminService $users,
        private AddressService $addresses,
    ) {}

    // ==================== USUARIOS (Admin) ====================

    public function index(Request $request)
    {
        $data = $request->validate([
            'page' => 'nullable|integer|min:1',
            'limit' => 'nullable|integer|min:1|max:100',
            'search' => 'nullable|string',
            'status' => ['nullable', Rule::in(self::STATUSES)],
            'roleId' => 'nullable|integer',
            'sortBy' => ['nullable', Rule::in(['name', 'email', 'createdAt', 'updatedAt'])],
            'sortOrder' => ['nullable', Rule::in(['asc', 'desc'])],
        ]);

        return response()->json(['success' => true] + $this->users->paginate($request->user(), $data));
    }

    public function show(Request $request, int $id)
    {
        return $this->success($this->users->format($this->users->findManageable($request->user(), $id)));
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
            'status' => ['nullable', Rule::in(self::STATUSES)],
        ]);

        $user = $this->users->create($request->user(), $data);

        return $this->created($this->users->format($user), 'Usuario creado exitosamente');
    }

    public function update(Request $request, int $id)
    {
        $user = $this->users->findManageable($request->user(), $id);

        $data = $request->validate([
            'email' => 'nullable|email|max:255',
            'name' => 'nullable|string|min:2|max:100',
            'phone' => 'nullable|string',
            'cedula' => 'nullable|string',
            'roleId' => 'nullable|integer',
            'status' => ['nullable', Rule::in(self::STATUSES)],
        ]);

        $user = $this->users->update($request->user(), $user, $data);

        return $this->success($this->users->format($user), 'Usuario actualizado exitosamente');
    }

    public function destroy(Request $request, int $id)
    {
        $this->users->delete($this->users->findManageable($request->user(), $id));

        return $this->success(null, 'Usuario eliminado exitosamente');
    }

    // ==================== PERFIL PROPIO ====================

    public function profile(Request $request)
    {
        return $this->success($this->users->format($request->user()->load('role')));
    }

    public function updateProfile(Request $request)
    {
        $data = $request->validate([
            'name' => 'nullable|string|min:2|max:100',
            'phone' => 'nullable|string',
            'cedula' => 'nullable|string',
        ]);

        $user = $this->users->updateProfile($request->user(), $data);

        return $this->success($this->users->format($user), 'Perfil actualizado exitosamente');
    }

    // ==================== DIRECCIONES ====================

    public function addresses(Request $request)
    {
        return $this->success($this->addresses->list($request->user()));
    }

    public function storeAddress(Request $request)
    {
        $address = $this->addresses->create($request->user(), $this->validateAddress($request));

        return $this->created($address, 'Dirección creada exitosamente');
    }

    public function updateAddress(Request $request, int $addressId)
    {
        $user = $request->user();
        // Primero la propiedad (404) y después la validación, como antes.
        $this->addresses->find($user, $addressId);
        $address = $this->addresses->update($user, $addressId, $this->validateAddress($request));

        return $this->success($address, 'Dirección actualizada exitosamente');
    }

    public function destroyAddress(Request $request, int $addressId)
    {
        $this->addresses->delete($request->user(), $addressId);

        return $this->success(null, 'Dirección eliminada exitosamente');
    }

    public function setDefaultAddress(Request $request, int $addressId)
    {
        return $this->success($this->addresses->setDefault($request->user(), $addressId), 'Dirección predeterminada actualizada');
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
