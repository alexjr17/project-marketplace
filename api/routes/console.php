<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Estudio de contenido: publica a su hora las publicaciones programadas (Facebook e Instagram).
\Illuminate\Support\Facades\Schedule::command('social:publish-scheduled')->everyMinute()->withoutOverlapping();
