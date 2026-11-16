<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Diseños con nombre editable y familias (ej. Navidad):
     * - design_families: un grupo de diseños que van juntos (Papá, Mamá, Hijo…), para el pack familiar.
     * - design_images: temporada (navidad…), familia y rol dentro de ella, archivo de producción propio
     *   (printUrl) y los textos editables (textFields: dónde va el nombre y con qué letra).
     */
    public function up(): void
    {
        if (! Schema::hasTable('design_families')) {
            Schema::create('design_families', function (Blueprint $table) {
                $table->id();
                $table->string('name', 120);
                $table->text('description')->nullable();
                $table->string('season', 30)->nullable();
                $table->integer('sortOrder')->default(0);
                $table->boolean('isActive')->default(true);
                $table->timestamp('createdAt')->nullable();
                $table->timestamp('updatedAt')->nullable();
                $table->index(['isActive', 'season']);
            });
        }
        Schema::table('design_images', function (Blueprint $table) {
            if (! Schema::hasColumn('design_images', 'season')) {
                $table->string('season', 30)->nullable()->after('category');
                $table->index('season');
            }
            if (! Schema::hasColumn('design_images', 'printUrl')) {
                $table->string('printUrl', 500)->nullable()->after('fullUrl');
            }
            if (! Schema::hasColumn('design_images', 'textFields')) {
                $table->json('textFields')->nullable()->after('tags');
            }
            if (! Schema::hasColumn('design_images', 'familyId')) {
                $table->foreignId('familyId')->nullable()->after('textFields')->constrained('design_families')->nullOnDelete();
                $table->string('familyRole', 40)->nullable()->after('familyId');
            }
        });
    }

    public function down(): void
    {
        Schema::table('design_images', function (Blueprint $table) {
            if (Schema::hasColumn('design_images', 'familyId')) {
                $table->dropConstrainedForeignId('familyId');
                $table->dropColumn('familyRole');
            }
            foreach (['season', 'printUrl', 'textFields'] as $c) {
                if (Schema::hasColumn('design_images', $c)) {
                    if ($c === 'season') {
                        $table->dropIndex(['season']);
                    }
                    $table->dropColumn($c);
                }
            }
        });
        Schema::dropIfExists('design_families');
    }
};
