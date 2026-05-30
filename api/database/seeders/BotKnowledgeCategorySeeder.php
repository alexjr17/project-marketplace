<?php

namespace Database\Seeders;

use App\Models\BotKnowledgeCategory;
use Illuminate\Database\Seeder;

/**
 * Categorías iniciales del módulo "Entrenar IA". Se siembran solo si la
 * tabla está vacía — después el admin puede editarlas, agregar nuevas o
 * eliminar las que no use desde /messaging/knowledge.
 *
 * Debe correr ANTES que BotKnowledgeSeeder.
 */
class BotKnowledgeCategorySeeder extends Seeder
{
    public function run(): void
    {
        if (BotKnowledgeCategory::count() > 0) {
            return;
        }

        $defaults = [
            ['business', 'Sobre el negocio', 'Identidad, ubicación, horarios.', '🏢', 'blue'],
            ['tone', 'Tono y personalidad', 'Cómo habla el bot, qué evitar.', '🎭', 'purple'],
            ['fabrics', 'Telas y calidad', 'Tipos de tela, cuidados.', '🧵', 'amber'],
            ['sizing', 'Tallas', 'Equivalencias y guía de medidas.', '📏', 'green'],
            ['colors', 'Colores', 'Colores disponibles, temporadas.', '🎨', 'pink'],
            ['shipping', 'Envíos', 'Cobertura, tiempos, costos.', '🚚', 'orange'],
            ['returns', 'Devoluciones', 'Política y procedimiento.', '↩️', 'red'],
            ['payments', 'Pagos', 'Métodos aceptados.', '💳', 'indigo'],
            ['sales', 'Cierre de ventas', 'Cómo guiar al cliente al pedido.', '💰', 'emerald'],
            ['faq', 'Preguntas frecuentes', 'FAQ libres.', '❓', 'cyan'],
            ['other', 'Otra información', 'Lo que no encaja en lo anterior.', '📝', 'gray'],
        ];

        foreach ($defaults as $i => [$slug, $label, $desc, $emoji, $color]) {
            BotKnowledgeCategory::create([
                'slug' => $slug,
                'label' => $label,
                'description' => $desc,
                'emoji' => $emoji,
                'color' => $color,
                'sortOrder' => $i,
                'isActive' => true,
            ]);
        }
    }
}
