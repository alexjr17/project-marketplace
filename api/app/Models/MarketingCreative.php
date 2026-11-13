<?php

namespace App\Models;

/** Pieza del estudio de contenido (ver MarketingCreativeService). */
class MarketingCreative extends BaseModel
{
    protected $table = 'marketing_creatives';

    protected $casts = [
        'sourceIds' => 'array',
        'data' => 'array',
        'hashtags' => 'array',
    ];
}
