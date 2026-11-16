<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Diseño de la galería del personalizador (ver DesignLibraryService para los textos editables y las familias). */
class DesignImage extends BaseModel
{
    protected $table = 'design_images';

    protected $casts = [
        'tags' => 'array',
        'textFields' => 'array',
        'isActive' => 'boolean',
    ];

    public function family(): BelongsTo
    {
        return $this->belongsTo(DesignFamily::class, 'familyId');
    }
}
