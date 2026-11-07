<?php

namespace App\Services\Users;

use App\Exceptions\BusinessRuleException;
use App\Models\Address;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Direcciones del usuario: solo las propias, y una sola predeterminada a la vez (el cambio de
 * predeterminada va en una transacción para no quedar con dos ni con ninguna).
 */
class AddressService
{
    public function list(User $user): Collection
    {
        return $user->addresses()->orderByDesc('isDefault')->orderByDesc('createdAt')->get();
    }

    public function create(User $user, array $data): Address
    {
        return DB::transaction(function () use ($user, $data) {
            if (! empty($data['isDefault'])) {
                $user->addresses()->where('isDefault', true)->update(['isDefault' => false]);
            }

            return Address::create($data + ['userId' => $user->id]);
        });
    }

    public function update(User $user, int $addressId, array $data): Address
    {
        $address = $this->find($user, $addressId);

        DB::transaction(function () use ($user, $address, $data) {
            if (! empty($data['isDefault'])) {
                $user->addresses()->where('isDefault', true)->where('id', '!=', $address->id)
                    ->update(['isDefault' => false]);
            }
            $address->update($data);
        });

        return $address;
    }

    public function delete(User $user, int $addressId): void
    {
        $this->find($user, $addressId)->delete();
    }

    public function setDefault(User $user, int $addressId): Address
    {
        $address = $this->find($user, $addressId);

        DB::transaction(function () use ($user, $address) {
            $user->addresses()->where('isDefault', true)->update(['isDefault' => false]);
            $address->update(['isDefault' => true]);
        });

        return $address;
    }

    /** Dirección del usuario; las de otros responden 404 igual que una inexistente. */
    public function find(User $user, int $addressId): Address
    {
        return $user->addresses()->where('id', $addressId)->first()
            ?? throw new BusinessRuleException('Dirección no encontrada', 404);
    }
}
