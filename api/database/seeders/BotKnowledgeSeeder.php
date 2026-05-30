<?php

namespace Database\Seeders;

use App\Models\BotKnowledge;
use Illuminate\Database\Seeder;

/**
 * Conocimiento inicial del bot — plantilla para tienda de ropa.
 * Solo se inserta si la tabla está vacía. Editar después desde /messaging/knowledge.
 */
class BotKnowledgeSeeder extends Seeder
{
    public function run(): void
    {
        if (BotKnowledge::count() > 0) {
            return;
        }

        $entries = [
            // === NEGOCIO ===
            ['business', 'Identidad', 'Vexa es una tienda de ropa personalizada y de catálogo, dirigida principalmente a clientes en Colombia.'],
            ['business', 'Ubicación', 'Estamos ubicados en Sincelejo, Sucre. Atendemos pedidos a todo el país.'],
            ['business', 'Horario de atención', 'Lunes a sábado de 8:00 a.m. a 7:00 p.m. Los domingos solo respondemos mensajes urgentes.'],

            // === TONO Y PERSONALIDAD ===
            ['tone', 'Cómo hablamos', 'Trato cálido y cercano, español colombiano informal pero educado ("tú" no "usted" salvo si el cliente lo usa primero). Sin tecnicismos.'],
            ['tone', 'No prometer lo que no sabes', 'Si no conoces un precio, color, talla o disponibilidad exacta, dilo con honestidad y ofrece que un asesor confirme en breve.'],
            ['tone', 'Llamar por el nombre', 'Si conoces el nombre del cliente, úsalo en el saludo. Si no, usa "hola" sin nombre — no lo inventes.'],

            // === TELAS Y CALIDAD ===
            ['fabrics', 'Algodón perchado', 'Tela suave y abrigada, ideal para clima frío. Mantiene la forma después de varios lavados.'],
            ['fabrics', 'Algodón con elastano (jersey)', 'Stretch suave, buena caída, ideal para básicos y prendas ajustadas. No se deforma con uso normal.'],
            ['fabrics', 'Cuidado general', 'Lavado a mano o máquina ciclo suave con agua fría. Secar a la sombra. No usar secadora.'],

            // === TALLAS ===
            ['sizing', 'Tallas disponibles', 'Manejamos S, M, L y XL en todas las prendas. Algunos modelos también incluyen XS y XXL bajo pedido.'],
            ['sizing', 'Equivalencia S', 'S = busto 86-90 cm, cintura 68-72 cm. Recomendada para personas de hasta 55 kg aproximadamente.'],
            ['sizing', 'Equivalencia M', 'M = busto 90-94 cm, cintura 72-76 cm. Recomendada entre 55-65 kg.'],
            ['sizing', 'Equivalencia L', 'L = busto 94-98 cm, cintura 76-80 cm. Recomendada entre 65-75 kg.'],
            ['sizing', 'Equivalencia XL', 'XL = busto 98-104 cm, cintura 80-86 cm. Recomendada entre 75-85 kg.'],
            ['sizing', 'Si tienen dudas de talla', 'Pídeles que te indiquen su talla habitual en otra marca conocida o su busto/cintura, y luego deriva a un asesor para confirmar.'],

            // === COLORES ===
            ['colors', 'Colores base', 'Blanco, negro, gris jaspeado y azul oscuro siempre están disponibles en todos los modelos.'],
            ['colors', 'Colores de temporada', 'Los colores de moda (terracota, verde oliva, lila) salen en colecciones limitadas. Si el cliente pide uno específico, confirma con un asesor.'],

            // === ENVÍOS ===
            ['shipping', 'Cobertura', 'Hacemos envíos a todo Colombia con Servientrega, Coordinadora e Interrapidísimo según la ciudad.'],
            ['shipping', 'Tiempo de entrega', 'Ciudades capitales: 1-3 días hábiles. Municipios pequeños: 3-5 días hábiles.'],
            ['shipping', 'Costo de envío', 'El costo depende de la ciudad. En el checkout de nuestra tienda online se calcula automáticamente. Si te lo preguntan, ofrece pasar al asesor para confirmar.'],

            // === DEVOLUCIONES ===
            ['returns', 'Política', 'Aceptamos cambios y devoluciones dentro de los 15 días posteriores a la entrega, siempre que la prenda esté en su estado original, sin uso, con etiquetas.'],
            ['returns', 'Costo del cambio', 'El cliente cubre el envío de devolución. Nosotros enviamos el cambio sin costo adicional dentro del país.'],

            // === PAGOS ===
            ['payments', 'Métodos aceptados', 'Aceptamos transferencia bancaria (Bancolombia), Nequi, Daviplata y tarjeta crédito/débito a través de Wompi. Próximamente PSE.'],
            ['payments', 'Pago contra entrega', 'Solo para Sincelejo y municipios cercanos. Para el resto del país pago anticipado o por Wompi.'],

            // === CIERRE DE VENTAS ===
            ['sales', 'Siempre pregunta', 'Cuando el cliente muestre interés, pregunta si quiere proceder con el pedido y pídele talla + color + número de WhatsApp para confirmar.'],
            ['sales', 'Crear urgencia con honestidad', 'Si una prenda tiene poco stock o está en oferta limitada, menciónalo. NO inventes urgencia falsa.'],
            ['sales', 'Ofrecer alternativas', 'Si lo que el cliente pide no está disponible, ofrece un producto similar antes de cerrar la conversación.'],
            ['sales', 'Cuando estén listos para comprar', 'Diles "perfecto, te paso con un asesor humano para confirmar pedido y datos de envío" y deja la conversación abierta para el operador.'],

            // === FAQ ===
            ['faq', '¿Hacen envíos a Venezuela?', 'No hacemos envíos internacionales por ahora. Solo Colombia.'],
            ['faq', '¿Tienen tienda física?', 'Sí, en Sincelejo. Puedes recoger pedidos ahí o pedir cita para conocer la colección en persona.'],
        ];

        foreach ($entries as $i => [$cat, $title, $content]) {
            BotKnowledge::create([
                'category' => $cat,
                'title' => $title,
                'content' => $content,
                'isActive' => true,
                'sortOrder' => $i,
            ]);
        }
    }
}
