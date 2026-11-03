import { describe, expect, it } from 'vitest';
import type { TemplateZone } from '../../services/template-zones.service';
import type { CustomizedProduct, Design } from '../../types/design';
import {
  buildCustomizedProduct, buildOrderCustomization, buildViews, buildZones, canonicalView, cartThumbnails, clampToZone,
  dpiLevel, estimateDpi, fitSize, localQuote, missingRequiredZones, normalizeTemplateImages, normalizeZone,
  resolveViewImage, restoreDesigns, sizeChartType, templateCover, usedZoneIds, type StudioDesign,
} from './customizerModel';

const zone = (over: Partial<TemplateZone> = {}): TemplateZone => ({
  id: 1, templateId: 4, zoneTypeId: 1, zoneId: 'zone-frente', name: 'Frente', shape: 'rect',
  positionX: 20, positionY: 18, maxWidth: 60, maxHeight: 60, price: 8000, isEditable: true, isRequired: true,
  isBlocked: false, sortOrder: 1, isActive: true, createdAt: '', updatedAt: '',
  zoneType: { id: 1, name: 'Frente', slug: 'frente' },
  ...over,
});

const back = zone({ id: 2, zoneTypeId: 2, name: 'Espalda', isRequired: false, sortOrder: 2, zoneType: { id: 2, name: 'Espalda', slug: 'espalda' } });

const design = (over: Partial<StudioDesign> = {}): StudioDesign => ({
  id: 'd1', viewSlug: 'frente', viewType: 'frente', zoneId: 'view-frente', templateZoneId: 1, zoneName: 'Frente',
  imageData: 'data:image/png;base64,AAA', position: { x: 50, y: 50 }, size: { width: 30, height: 30 }, rotation: 0, opacity: 1,
  ...over,
});

describe('vistas e imágenes', () => {
  it('reconoce los slugs en español e inglés', () => {
    expect(canonicalView('frente')).toBe('front');
    expect(canonicalView('back')).toBe('back');
    expect(canonicalView('espalda')).toBe('back');
    expect(canonicalView('manga-izquierda')).toBe('side');
    expect(canonicalView('bolsillo')).toBeNull();
  });

  it('normaliza las imágenes en objeto o en arreglo (formato del admin)', () => {
    expect(normalizeTemplateImages({ front: 'a.png', back: '', side: ' ' })).toEqual({ front: 'a.png', back: undefined, side: undefined });
    expect(normalizeTemplateImages(['f.png', 'b.png'])).toEqual({ front: 'f.png', back: 'b.png', side: undefined });
    expect(normalizeTemplateImages([{ url: 'x.png' }])).toEqual({ front: 'x.png', back: undefined, side: undefined });
    expect(normalizeTemplateImages(null)).toEqual({});
  });

  it('resuelve la imagen de la vista: tipo de zona → alias → images; sin foto de espalda no usa la del frente', () => {
    const t = { images: { front: 'f.png' }, zoneTypeImages: { front: 'zf.png' } };
    expect(resolveViewImage(t, 'frente')).toBe('zf.png');
    expect(resolveViewImage({ images: ['f.png', 'b.png'] as unknown as { front: string }, zoneTypeImages: null }, 'espalda')).toBe('b.png');
    expect(resolveViewImage({ images: { front: 'f.png' }, zoneTypeImages: null }, 'espalda')).toBeUndefined();
    expect(templateCover({ images: { front: '' }, zoneTypeImages: { frente: 'z.png' } })).toBe('z.png');
  });

  it('arma las vistas en orden frente, espalda, mangas y sin las zonas bloqueadas o inactivas', () => {
    const sleeve = zone({ id: 3, name: 'Manga', sortOrder: 0, zoneType: { id: 3, name: 'Manga izquierda', slug: 'manga-izquierda' } });
    const blocked = zone({ id: 4, isBlocked: true, zoneType: { id: 5, name: 'Bolsillo', slug: 'bolsillo' } });
    const off = zone({ id: 5, isActive: false, zoneType: { id: 6, name: 'Cuello', slug: 'cuello' } });
    expect(buildViews([sleeve, back, zone(), blocked, off]).map((v) => v.slug)).toEqual(['frente', 'espalda', 'manga-izquierda']);
    expect(buildViews([back])[0].kind).toBe('back');
  });
});

describe('zonas', () => {
  it('deja las zonas en % tal cual y convierte las viejas en píxeles (lienzo de 500)', () => {
    expect(normalizeZone(zone({ positionX: 22.5 }))).toMatchObject({ x: 22.5, y: 18, width: 60, height: 60, viewSlug: 'frente', price: 8000 });
    expect(normalizeZone(zone({ positionX: 110, positionY: 90, maxWidth: 280, maxHeight: 360 }))).toMatchObject({ x: 22, y: 18, width: 56, height: 72 });
  });

  it('mantiene el diseño dentro de la zona (tamaño y posición)', () => {
    const z = buildZones([zone()])[0];
    const big = clampToZone(design({ size: { width: 90, height: 45 }, position: { x: 95, y: 5 } }), z);
    expect(big.size.width).toBeCloseTo(60);
    expect(big.size.height).toBeCloseTo(30);
    expect(big.position.x).toBeCloseTo(50); // 20 + 60 - 30
    expect(big.position.y).toBeCloseTo(33); // 18 + 15
  });

  it('calcula el tamaño que cabe con la proporción de la imagen', () => {
    expect(fitSize({ width: 60, height: 60 }, 2, 1, 1)).toEqual({ width: 60, height: 30 });
    expect(fitSize({ width: 60, height: 60 }, 0.5, 1, 0.5)).toEqual({ width: 15, height: 30 });
  });
});

describe('precio y requisitos', () => {
  const zones = buildZones([zone(), back]);

  it('suma una vez cada zona usada', () => {
    const q = localQuote(70000, zones, [design(), design({ id: 'd2' }), design({ id: 'd3', templateZoneId: 2 })]);
    expect(usedZoneIds([design(), design({ templateZoneId: 2 })])).toEqual([1, 2]);
    expect(q).toMatchObject({ basePrice: 70000, customizationPrice: 16000, total: 86000, estimated: true });
    expect(q.zones.map((z) => z.name)).toEqual(['Frente', 'Espalda']);
  });

  it('avisa las zonas obligatorias sin diseño', () => {
    expect(missingRequiredZones(zones, [design({ templateZoneId: 2 })]).map((z) => z.name)).toEqual(['Frente']);
    expect(missingRequiredZones(zones, [design()])).toEqual([]);
  });

  it('estima los dpi de impresión', () => {
    // 30 % de 60 cm = 18 cm; 2126 px / (18 / 2.54) ≈ 300 dpi
    expect(estimateDpi({ size: { width: 30, height: 30 }, pixelWidth: 2126 })).toBe(300);
    expect(dpiLevel(estimateDpi({ size: { width: 50, height: 50 }, pixelWidth: 800 }))).toBe('low');
    expect(dpiLevel(null)).toBe('unknown');
  });

  it('elige la guía de tallas por el tipo del modelo', () => {
    expect(sizeChartType('sueter-basico', 'Suéter Básico')).toBe('sweatshirt');
    expect(sizeChartType('hoodie-x', null)).toBe('hoodie');
    expect(sizeChartType(null, null)).toBe('tshirt');
  });
});

describe('carrito y pedido', () => {
  const zones = buildZones([zone(), back]);
  const views = buildViews([zone(), back]);
  const template = { id: 4, name: 'Suéter Básico', slug: 'sueter', basePrice: 70000, typeSlug: 'sueter-basico', images: { front: '' }, zoneTypeImages: null };
  const designs = [design({ originalImageData: 'data:orig-front' }), design({ id: 'd2', viewSlug: 'espalda', viewType: 'espalda', templateZoneId: 2, zoneName: 'Espalda', originalImageData: 'data:orig-back' })];
  const product = buildCustomizedProduct({
    template, color: { id: 2, hexCode: '#1A1A1A', name: 'Negro' }, size: { id: 4, abbreviation: 'M' }, designs,
    previews: { frente: 'data:prev-front', espalda: 'data:prev-back' }, quote: localQuote(70000, zones, designs), views,
  });

  it('arma el producto del carrito (v2) con ids, vistas previas y originales', () => {
    expect(product).toMatchObject({
      version: 2, productId: '4', templateId: 4, colorId: 2, sizeId: 4, selectedSize: 'M', selectedColorName: 'Negro',
      customizationPrice: 16000, totalPrice: 86000,
      previewImages: { front: 'data:prev-front', back: 'data:prev-back' },
      productionImages: { front: 'data:orig-front', back: 'data:orig-back' },
    });
    expect(product.designs[1]).toMatchObject({ viewSlug: 'espalda', viewType: 'espalda', templateZoneId: 2 });
  });

  it('arma el customization del pedido con el contrato v2 y las claves viejas', () => {
    const c = buildOrderCustomization(product);
    expect(c).toMatchObject({
      version: 2, templateId: 4, colorId: 2, sizeId: 4, customizationPrice: 16000, totalPrice: 86000,
      designFront: 'data:prev-front', designBack: 'data:prev-back', originalFront: 'data:orig-front', originalBack: 'data:orig-back',
    });
    expect(c.designs).toHaveLength(2);
    expect(c.designs![0]).toEqual({
      id: 'd1', viewSlug: 'frente', templateZoneId: 1, zoneName: 'Frente', imageData: 'data:image/png;base64,AAA',
      originalImageData: 'data:orig-front', originalFileName: undefined, position: { x: 50, y: 50 }, size: { width: 30, height: 30 }, rotation: 0, opacity: 1,
    });
    expect(Object.keys(c.previews!)).toEqual(['frente', 'espalda']);
  });

  it('un ítem viejo del carrito manda solo las claves viejas y se puede seguir mostrando', () => {
    const old = {
      id: 'x', productId: '4', productType: 'tshirt', productName: 'Viejo', basePrice: 70000, selectedColor: '#FFF', selectedSize: 'M',
      designs: [{ id: 'o1', viewType: 'front', zoneId: 'view-front', imageUrl: '', imageData: 'data:old', position: { x: 50, y: 40 }, size: { width: 20, height: 20 }, rotation: 0, opacity: 1 } as Design],
      previewImages: { front: 'data:old-prev' }, productionImages: { front: 'data:old-orig' }, customizationPrice: 2000, totalPrice: 72000, createdAt: new Date(),
    } as CustomizedProduct;
    expect(buildOrderCustomization(old)).toEqual({ designFront: 'data:old-prev', designBack: undefined, originalFront: 'data:old-orig', originalBack: undefined });
    expect(cartThumbnails(old)).toEqual([{ key: 'front', src: 'data:old-prev' }]);
    // Al editarlo, el diseño viejo de "front" pasa a la zona del frente.
    const restored = restoreDesigns(old.designs, zones, views);
    expect(restored).toHaveLength(1);
    expect(restored[0]).toMatchObject({ viewSlug: 'frente', templateZoneId: 1, zoneName: 'Frente' });
  });

  it('restaura los diseños v2 en su zona y descarta los que ya no tienen zona', () => {
    const restored = restoreDesigns([...product.designs, { ...product.designs[0], id: 'gone', templateZoneId: 99, viewSlug: 'bolsillo', viewType: 'bolsillo' }], zones, views);
    expect(restored.map((d) => d.id)).toEqual(['d1', 'd2']);
    expect(cartThumbnails(product).map((t) => t.key)).toEqual(['frente', 'espalda']);
  });
});
