<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Modelo base para toda la app.
 *
 * El esquema usa columnas camelCase (createdAt / updatedAt) para que el
 * JSON de la API salga idéntico al del backend Node original.
 */
abstract class BaseModel extends Model
{
    const CREATED_AT = 'createdAt';

    const UPDATED_AT = 'updatedAt';

    /**
     * No convertir las claves de relaciones a snake_case al serializar,
     * para que el JSON salga en camelCase (inputType, productColors, etc.).
     */
    public static $snakeAttributes = false;

    protected $guarded = [];
}
