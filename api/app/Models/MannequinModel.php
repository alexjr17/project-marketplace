<?php

namespace App\Models;

/** Maniquí 3D generado desde el admin (ver MannequinModelService). */
class MannequinModel extends BaseModel
{
    protected $table = 'mannequin_models';

    /** La foto base se está armando o puliendo en el chat; todavía no hay 3D. */
    public const DRAFT = 'borrador';

    public const GENERATING = 'generando';

    public const REVIEW = 'revision';

    public const PUBLISHED = 'publicado';

    public const FAILED = 'error';

    protected $casts = [
        'inputImages' => 'array',
        'config' => 'array',
        'account' => 'integer',
        'seconds' => 'integer',
        'startedAt' => 'datetime',
        'finishedAt' => 'datetime',
    ];
}
