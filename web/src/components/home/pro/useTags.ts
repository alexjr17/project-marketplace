import { useStoreData } from '../../../hooks/useStoreData';
import { storefrontService, type TagStat } from '../../../services/storefront.service';
import { PHOTOS, type HomePhoto } from './photos';

/** Fotos de ambiente para las temáticas (provisionales, hasta que cada una tenga la suya). */
const COVERS: HomePhoto[] = [PHOTOS.mural, PHOTOS.grafiti, PHOTOS.gafas, PHOTOS.noche, PHOTOS.espalda, PHOTOS.estudio];
export const coverFor = (index: number) => COVERS[index % COVERS.length];

const fetchTags = () => storefrontService.getTagStats(12);

/** Temáticas de la tienda (etiquetas de producto), las que más productos tienen primero. */
export function useTags() {
  const { data, loading } = useStoreData<TagStat[]>('tags:stats', fetchTags);
  return { tags: data ?? [], loading };
}

export const tagHref = (tag: string) => `/catalog?tag=${encodeURIComponent(tag)}`;
