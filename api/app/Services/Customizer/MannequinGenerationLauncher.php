<?php

namespace App\Services\Customizer;

/**
 * Lanza la generación de un maniquí en un proceso aparte (php artisan mannequin:generate {id}), para
 * que la petición responda al instante: la IA tarda entre 2 y 5 minutos. Funciona igual en Docker de
 * desarrollo y en producción (un solo contenedor, sin cola de trabajos). En las pruebas se reemplaza.
 */
class MannequinGenerationLauncher
{
    /** @param  string  $command  mannequin:generate (el 3D) o mannequin:edit (una foto del chat) */
    public function launch(int $id, string $command = 'mannequin:generate'): void
    {
        $cmd = sprintf('%s %s %s %d', escapeshellarg(PHP_BINARY), escapeshellarg(base_path('artisan')), escapeshellarg($command), $id);
        if (PHP_OS_FAMILY === 'Windows') {
            pclose(popen('start /B "" '.$cmd.' > NUL 2>&1', 'r'));

            return;
        }
        exec($cmd.' > /dev/null 2>&1 &');
    }
}
