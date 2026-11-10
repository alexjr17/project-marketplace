<?php

namespace App\Console\Commands;

use App\Services\Customizer\MannequinModelService;
use Illuminate\Console\Command;

/** Genera un maniquí 3D del admin (lo lanza MannequinGenerationLauncher en segundo plano). */
class GenerateMannequinModel extends Command
{
    protected $signature = 'mannequin:generate {id : id de mannequin_models}';

    protected $description = 'Genera el modelo 3D de un maniquí con la IA de Hugging Face';

    public function handle(MannequinModelService $service): int
    {
        set_time_limit(0);
        $service->generate((int) $this->argument('id'));

        return self::SUCCESS;
    }
}
