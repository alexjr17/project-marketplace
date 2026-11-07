<?php

namespace App\Exceptions;

use RuntimeException;

/**
 * Regla de negocio que impide la operación (p. ej. "el cliente tiene pedidos").
 * La lanza un servicio y el manejador de la API la responde con su código
 * ({ success:false, message, errors? }), sin que el controlador tenga que atraparla.
 */
class BusinessRuleException extends RuntimeException
{
    public function __construct(
        string $message,
        public readonly int $status = 422,
        public readonly ?array $errors = null,
    ) {
        parent::__construct($message);
    }
}
