<?php

namespace App\Models;

class Role extends BaseModel
{
    protected $table = 'roles';

    protected $casts = [
        'permissions' => 'array',
        'isSystem' => 'boolean',
        'isActive' => 'boolean',
    ];

    public function users()
    {
        return $this->hasMany(User::class, 'roleId');
    }
}
