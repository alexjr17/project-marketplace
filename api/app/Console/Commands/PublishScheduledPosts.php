<?php

namespace App\Console\Commands;

use App\Services\Social\SocialPostService;
use Illuminate\Console\Command;

/** Publica las publicaciones programadas cuya hora ya llegó (corre cada minuto con schedule:work). */
class PublishScheduledPosts extends Command
{
    protected $signature = 'social:publish-scheduled';

    protected $description = 'Publica en Facebook e Instagram las publicaciones programadas que ya deben salir';

    public function handle(SocialPostService $posts): int
    {
        $n = $posts->publishDue();
        if ($n) {
            $this->info("Publicaciones procesadas: {$n}");
        }

        return self::SUCCESS;
    }
}
