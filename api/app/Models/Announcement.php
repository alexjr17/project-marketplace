<?php

namespace App\Models;

class Announcement extends BaseModel
{
    protected $table = 'announcements';

    protected $casts = [
        'isActive' => 'boolean',
        'dismissible' => 'boolean',
        'priority' => 'integer',
        'startsAt' => 'datetime',
        'endsAt' => 'datetime',
    ];

    /** Activos y dentro de su ventana de fechas, de mayor a menor prioridad. */
    public function scopeCurrent($query)
    {
        $now = now();

        return $query->where('isActive', true)
            ->where(fn ($q) => $q->whereNull('startsAt')->orWhere('startsAt', '<=', $now))
            ->where(fn ($q) => $q->whereNull('endsAt')->orWhere('endsAt', '>=', $now))
            ->orderByDesc('priority')
            ->orderByDesc('createdAt');
    }
}
