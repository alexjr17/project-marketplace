<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** El diseño por capas (editor de diseños del admin), para volver a editarlo. */
    public function up(): void
    {
        if (! Schema::hasColumn('design_images', 'editorData')) {
            Schema::table('design_images', function (Blueprint $table) {
                $table->json('editorData')->nullable()->after('textFields');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('design_images', 'editorData')) {
            Schema::table('design_images', function (Blueprint $table) {
                $table->dropColumn('editorData');
            });
        }
    }
};
