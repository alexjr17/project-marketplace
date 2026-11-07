/**
 * Fotos de la portada (public/home). Son PROVISIONALES: fotos de Unsplash (licencia Unsplash,
 * uso comercial sin atribución obligatoria) para cambiar por fotos propias de la tienda.
 * Cada foto tiene 800 y 1600 px de ancho en WebP. `id` = id de la foto en unsplash.com/photos/<id>.
 */
export interface HomePhoto {
  src: string;
  srcSet: string;
  alt: string;
  /** Ancho / alto. */
  ratio: number;
  id: string;
}

const photo = (name: string, alt: string, ratio: number, id: string): HomePhoto => ({
  src: `/home/${name}-1600.webp`,
  srcSet: `/home/${name}-800.webp 800w, /home/${name}-1600.webp 1600w`,
  alt,
  ratio,
  id,
});

export const PHOTOS = {
  rasqueta: photo('rasqueta', 'Manos con guantes pasando la rasqueta con tinta amarilla sobre un marco de serigrafía', 1.51, '0y3DOYVP2bs'),
  tintas: photo('tintas', 'Rasqueta sobre un marco con franjas de tinta amarilla, verde y naranja', 1.5, 'GUdUmJua9cI'),
  marco: photo('marco', 'Persona revisando un marco de serigrafía junto a la ventana del taller', 1.5, 'ZCTh4f4mv18'),
  pulpo: photo('pulpo', 'Estampado de una camiseta negra en la máquina de serigrafía', 1.5, '-OI61ziuAh0'),
  lupa: photo('lupa-cmyk', 'Cuentahílos sobre una carta de colores CMYK de imprenta', 0.665, 'eWuUwZWuWvE'),
  mural: photo('mural', 'Mujer con camiseta estampada frente a un mural de colores', 0.8, 'fr40m4ti_As'),
  grafiti: photo('grafiti', 'Mujer con camiseta blanca estampada frente a una pared con grafiti', 0.667, 'lD23vvZfeHc'),
  gafas: photo('gafas', 'Mujer con gafas oscuras y camiseta negra estampada', 0.667, '897u01Sv7lI'),
  espalda: photo('espalda', 'Hombre de espaldas con una camiseta negra estampada en la espalda', 1.78, 'gC_iESfp7a8'),
  estudio: photo('estudio', 'Hombre de espaldas con camiseta blanca estampada en estudio', 0.667, 'TysFvOl78u0'),
  noche: photo('noche', 'Mujer con camiseta estampada de noche', 0.667, 'ey9ZxQFBZPE'),
} as const;
