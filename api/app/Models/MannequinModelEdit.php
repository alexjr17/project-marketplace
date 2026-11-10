<?php

namespace App\Models;

/** Mensaje del chat para pulir un modelo 3D (ver MannequinEditService). */
class MannequinModelEdit extends BaseModel
{
    protected $table = 'mannequin_model_edits';

    public const PROCESSING = 'procesando';

    public const DONE = 'listo';

    public const FAILED = 'error';

    protected $casts = [
        'applied' => 'boolean',
        'initial' => 'boolean',
        'account' => 'integer',
        'seconds' => 'integer',
    ];
}
