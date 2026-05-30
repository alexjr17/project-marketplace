<?php

/**
 * Router para el servidor embebido de PHP (php -S) en producción.
 *
 * Su único objetivo extra frente a `php artisan serve` es añadir cabeceras
 * CORS a los archivos subidos en /uploads. El personalizador del frontend
 * usa esas imágenes en máscaras CSS y en <canvas> (colorizar, detectar
 * bordes, exportar el diseño), y como el front vive en otro dominio, el
 * navegador las bloquea si no llegan con Access-Control-Allow-Origin.
 *
 * Para el resto de rutas delega en Laravel (public/index.php) tal cual.
 */

$public = __DIR__ . '/public';
$uri = urldecode(parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/');

// Resolver el archivo solicitado dentro de public/ de forma segura.
$requested = realpath($public . $uri);
$publicReal = realpath($public);
$insidePublic = $requested && $publicReal && str_starts_with($requested, $publicReal);

// --- Archivos subidos: servir con CORS ---
if ($insidePublic && is_file($requested) && str_starts_with($uri, '/uploads/')) {
    header('Access-Control-Allow-Origin: *');
    header('Cross-Origin-Resource-Policy: cross-origin');
    header('Access-Control-Allow-Methods: GET, HEAD, OPTIONS');
    header('Cache-Control: public, max-age=31536000, immutable');

    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
        http_response_code(204);
        return true;
    }

    // Tipo de contenido por extensión (no depende de la extensión fileinfo).
    $ext = strtolower(pathinfo($requested, PATHINFO_EXTENSION));
    $types = [
        'png' => 'image/png', 'jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg',
        'gif' => 'image/gif', 'webp' => 'image/webp', 'svg' => 'image/svg+xml',
        'avif' => 'image/avif', 'bmp' => 'image/bmp',
    ];
    header('Content-Type: ' . ($types[$ext] ?? 'application/octet-stream'));
    header('Content-Length: ' . filesize($requested));
    readfile($requested);
    return true;
}

// --- Otros archivos estáticos existentes (assets, etc.): servir directo ---
if ($insidePublic && is_file($requested) && $uri !== '/') {
    return false;
}

// --- Todo lo demás: Laravel ---
require $public . '/index.php';
