<?php

namespace App\Services\Customizer;

/**
 * Estándar de los modelos 3D: cada tipo de producto va en su maniquí grafito (el mismo estilo del
 * aprobado: gris grafito mate #6E6C6D, sin rasgos, sin brazos ni manos, sobre palo y base redonda),
 * con la misma toma, luz y fondo. Así todos los modelos salen parejos y la IA no inventa el soporte.
 * Los textos van en inglés porque los modelos de imagen lo entienden mejor.
 */
class MannequinStandard
{
    public const KINDS = ['maniqui', 'cabeza', 'piernas', 'objeto'];

    /** Soporte de cada tipo. */
    private const SUPPORT = [
        'maniqui' => 'worn by a matte graphite gray (#6E6C6D) armless half-body torso mannequin with a smooth featureless egg-shaped head, no arms and no hands, standing on a thin metal pole with a round metal base',
        // La cabeza como la de los maniquíes de los suéteres: un huevo liso, sin cara (la IA tiende a dibujar rostros).
        'cabeza' => 'worn on a matte graphite gray (#6E6C6D) mannequin head that is a completely smooth blank egg shape (like an egg: no eyes, no nose, no mouth, no ears, no face at all) on a straight cylindrical neck, mounted on a thin metal pole with a round metal base',
        'piernas' => 'worn by a matte graphite gray (#6E6C6D) lower-body mannequin (waist, hips and two legs, no feet details), standing on a thin metal pole with a round metal base',
        'objeto' => 'shown alone as a single object, with no mannequin, no person and no props',
    ];

    /** Siempre de frente y a la altura: es la vista "frente" del 3D multivista. */
    private const SHOT = [
        'maniqui' => 'straight front view at eye level, facing the camera',
        // Gorras y objetos: tres cuartos (frente, lado y visera en una foto): con una sola foto la IA
        // arma mucho mejor el 3D que solo de frente (de frente inventa la parte de atrás).
        'cabeza' => 'three-quarter front view slightly from above, the brim pointing to the front-left, the whole head and the back of the cap partially visible',
        'piernas' => 'straight front view at eye level, facing the camera',
        'objeto' => 'three-quarter front view slightly from above',
    ];

    /**
     * La prenda siempre sale blanca: la tienda la pinta del color que elija el cliente y así se separa
     * bien del maniquí grafito en el 3D.
     */
    private const COMMON = 'The whole product is visible and centered with some margin, plain light gray seamless studio background, soft even lighting, photorealistic e-commerce product photo, sharp detail. No text and no logos unless asked.';

    public static function kind(?string $kind): string
    {
        return in_array($kind, self::KINDS, true) ? $kind : 'maniqui';
    }

    /** Foto base desde una foto de referencia: el producto de la foto, en su maniquí estándar. */
    public static function fromPhoto(string $kind, string $details): string
    {
        $k = self::kind($kind);

        return 'Take the product from this image and show it '.self::SUPPORT[$k].', '.self::SHOT[$k].'. '
            .'Keep the product exactly as it is: same shape, proportions, fit, material and construction details, but make it plain white. '
            .($details !== '' ? 'Also: '.$details.'. ' : '')
            .self::COMMON;
    }

    /** Foto base solo desde la descripción. */
    public static function fromText(string $kind, string $details): string
    {
        $k = self::kind($kind);

        return 'A '.$details.', '.self::SUPPORT[$k].', '.self::SHOT[$k].'. The product is plain white. '.self::COMMON;
    }

    public const VIEWS = ['back', 'left', 'right'];

    /** Cómo se ve cada vista para el 3D multivista (frente, espalda y los dos lados, misma escala). */
    private const VIEW_SHOT = [
        'back' => 'Rotate the product 180 degrees: show it from directly behind, a pure back view (its front faces away from the camera, nothing of the front is visible)',
        'left' => 'Rotate the product 90 degrees: show a pure side profile of its left side, the front of the product points to the LEFT edge of the image (not a three-quarter view, the front is not visible)',
        'right' => 'Rotate the product 90 degrees: show a pure side profile of its right side, the front of the product points to the RIGHT edge of the image (not a three-quarter view, the front is not visible)',
    ];

    /**
     * Otra vista de la foto aprobada, para generar el 3D con 4 vistas: mismo producto, mismo maniquí,
     * misma escala, encuadre, luz y fondo; solo cambia el ángulo (cámara a la altura, sin perspectiva).
     */
    public static function view(string $kind, string $view, string $extra): string
    {
        $k = self::kind($kind);
        $support = $k === 'objeto' ? '' : ' on the same matte graphite gray mannequin with its pole and base (no arms, no hands)';

        return self::VIEW_SHOT[$view].$support.'. Straight orthographic-like view at the same height, same size, scale and position in the frame, '
            .'same plain white color, material, seams and details, same lighting and plain light gray background. '
            .'Do not add or invent anything that would not be visible from that side.'
            .($extra !== '' ? ' Also: '.$extra.'.' : '');
    }

    /** Un cambio del chat sobre la foto actual. */
    public static function edit(string $kind, string $instruction): string
    {
        $k = self::kind($kind);
        $keep = $k === 'objeto'
            ? 'Keep everything else exactly the same: the object, camera angle, framing, lighting and plain light gray background.'
            : 'Keep everything else exactly the same: the same matte graphite gray mannequin (no arms, no hands), pole and base, pose, camera angle, framing, lighting and plain light gray background.';

        return 'Edit this photo: '.rtrim($instruction, '. ').'. Make this change clearly visible. '.$keep;
    }
}
