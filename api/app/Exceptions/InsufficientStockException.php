<?php

namespace App\Exceptions;

use RuntimeException;

/**
 * Una salida de inventario dejaría el stock en negativo. Extiende RuntimeException para
 * que los controladores que ya atrapan RuntimeException respondan 400 con el mensaje.
 */
class InsufficientStockException extends RuntimeException
{
    public function __construct(
        public readonly string $sku,
        public readonly float $available,
        public readonly float $requested,
    ) {
        parent::__construct("Stock insuficiente para {$sku}. Disponible: {$this->fmt($available)}, Solicitado: {$this->fmt($requested)}");
    }

    private function fmt(float $n): string
    {
        return floor($n) == $n ? (string) (int) $n : (string) $n;
    }
}
