<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens;

    const CREATED_AT = 'createdAt';

    const UPDATED_AT = 'updatedAt';

    public static $snakeAttributes = false;

    protected $table = 'users';

    protected $guarded = [];

    protected $hidden = ['passwordHash', 'resetToken'];

    protected $casts = [
        'resetTokenExp' => 'datetime',
    ];

    /**
     * Sanctum / Auth usa esta columna como contraseña.
     */
    public function getAuthPassword(): string
    {
        return $this->passwordHash;
    }

    public function role()
    {
        return $this->belongsTo(Role::class, 'roleId');
    }

    public function addresses()
    {
        return $this->hasMany(Address::class, 'userId');
    }

    public function orders()
    {
        return $this->hasMany(Order::class, 'userId');
    }

    public function salesAsSeller()
    {
        return $this->hasMany(Order::class, 'sellerId');
    }

    public function cashSessions()
    {
        return $this->hasMany(CashSession::class, 'sellerId');
    }

    public function cart()
    {
        return $this->hasOne(Cart::class, 'userId');
    }

    public function reviews()
    {
        return $this->hasMany(Review::class, 'userId');
    }

    public function userNotifications()
    {
        return $this->hasMany(Notification::class, 'userId');
    }

    /**
     * Forma del usuario que espera el frontend: incluye el nombre del rol
     * y la lista de permisos. Replica el AuthResponse.user del backend Node.
     */
    public function authPayload(): array
    {
        $role = $this->role;

        return [
            'id' => $this->id,
            'email' => $this->email,
            'name' => $this->name,
            'phone' => $this->phone,
            'avatar' => $this->avatar,
            'roleId' => $this->roleId,
            'role' => $role?->name,
            'permissions' => is_array($role?->permissions) ? $role->permissions : [],
            'status' => $this->status,
        ];
    }
}
