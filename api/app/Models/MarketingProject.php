<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Proyecto (trabajo en curso) del estudio de contenido (ver MarketingProjectService). */
class MarketingProject extends BaseModel
{
    protected $table = 'marketing_projects';

    protected $casts = [
        'data' => 'array',
    ];

    public function editor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updatedBy');
    }
}
