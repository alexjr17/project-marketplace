<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\HasMany;

/** Familia de diseños (ej. Navidad: Papá, Mamá, Hijo…) para el pack familiar. Ver DesignLibraryService. */
class DesignFamily extends BaseModel
{
    protected $table = 'design_families';

    protected $casts = [
        'isActive' => 'boolean',
    ];

    public function designs(): HasMany
    {
        return $this->hasMany(DesignImage::class, 'familyId')->orderBy('sortOrder')->orderBy('id');
    }
}
