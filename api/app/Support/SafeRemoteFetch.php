<?php

namespace App\Support;

use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * Descarga de URLs externas sin SSRF: solo http(s), el host debe resolver a IPs
 * públicas (nada de la red interna de Docker, localhost ni 169.254.169.254), sin
 * seguir redirecciones (podrían apuntar a una IP interna) y con tope de tamaño
 * mientras se descarga (no después de bajarlo todo).
 *
 * assertPublicUrl() sirve sola para llamadas a APIs configurables (POST con cabeceras): se
 * valida la URL antes y la petición se hace sin seguir redirecciones.
 */
final class SafeRemoteFetch
{
    public static function get(string $url, int $maxBytes, int $timeout = 15): string
    {
        self::assertPublicUrl($url);

        $response = Http::timeout($timeout)
            ->withOptions(['allow_redirects' => false, 'stream' => true])
            ->get($url);
        if (! $response->successful()) {
            throw new RuntimeException('No se pudo descargar el archivo desde la URL');
        }

        $length = (int) $response->header('Content-Length');
        if ($length > $maxBytes) {
            throw new RuntimeException('El archivo es demasiado grande');
        }

        $body = $response->toPsrResponse()->getBody();
        $bytes = '';
        while (! $body->eof()) {
            $bytes .= $body->read(65536);
            if (strlen($bytes) > $maxBytes) {
                throw new RuntimeException('El archivo es demasiado grande');
            }
        }

        return $bytes;
    }

    /** Solo http(s) a un host que resuelva a IPs públicas; si no, lanza RuntimeException. */
    public static function assertPublicUrl(string $url): void
    {
        $parts = parse_url($url);
        $scheme = strtolower($parts['scheme'] ?? '');
        $host = $parts['host'] ?? '';
        if (! in_array($scheme, ['http', 'https'], true) || $host === '') {
            throw new RuntimeException('URL no permitida');
        }

        $ips = filter_var($host, FILTER_VALIDATE_IP) ? [$host] : (gethostbynamel($host) ?: []);
        if ($ips === []) {
            throw new RuntimeException('No se pudo resolver el host de la URL');
        }
        foreach ($ips as $ip) {
            if (! filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
                throw new RuntimeException('URL no permitida');
            }
        }
    }
}
