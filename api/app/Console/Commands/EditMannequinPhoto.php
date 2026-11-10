<?php

namespace App\Console\Commands;

use App\Services\Customizer\MannequinEditService;
use Illuminate\Console\Command;

/** Aplica un mensaje del chat de ajustes de un modelo 3D (lo lanza MannequinGenerationLauncher). */
class EditMannequinPhoto extends Command
{
    protected $signature = 'mannequin:edit {id : id de mannequin_model_edits}';

    protected $description = 'Edita la foto de un modelo 3D con la IA según el mensaje del chat';

    public function handle(MannequinEditService $service): int
    {
        set_time_limit(0);
        $service->run((int) $this->argument('id'));

        return self::SUCCESS;
    }
}
