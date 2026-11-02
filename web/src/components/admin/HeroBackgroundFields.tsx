import { useState, type ReactNode } from 'react';
import { Palette } from 'lucide-react';
import type { HeroCardBackground } from '../../types/settings';
import { brandGradient, customGradient, type BrandColors } from '../home/heroModel';
import { HERO_TYPE_ICONS, HERO_TYPE_LABELS } from './heroBackgroundOptions';
import { Button, ColorInput, Field, FormGrid, ImageGallery, ImageInput, NumberInput, RadioGroup, Switch, TextInput } from '../ui';

/**
 * Editores del fondo y del visual del hero (cartas y diapositivas): gradiente con colores,
 * imagen, video (archivo o YouTube) y carrusel de imágenes, con su oscurecido.
 */

type BgValue = Omit<HeroCardBackground, 'type'> & { type: string };
type MediaFieldsValue = Pick<HeroCardBackground, 'videoUrl' | 'videoPoster' | 'videoMuted' | 'videoLoop' | 'carouselImages' | 'carouselInterval' | 'carouselTransition'>;

/** Selector de tipo con iconos (fondo o visual). */
export function HeroTypePicker<T extends string>({ value, onChange, types, labels }: {
  value: T; onChange: (t: T) => void; types: readonly T[]; labels?: Partial<Record<string, string>>;
}) {
  return (
    <div className={`grid gap-2 ${types.length > 4 ? 'grid-cols-3 sm:grid-cols-6' : 'grid-cols-2 sm:grid-cols-4'}`}>
      {types.map((t) => {
        const Icon = HERO_TYPE_ICONS[t] ?? Palette;
        const active = value === t;
        return (
          <button
            key={t}
            type="button"
            onClick={() => onChange(t)}
            aria-pressed={active}
            className={`flex flex-col items-center justify-center gap-1 rounded-lg border p-2.5 text-xs transition-colors ${active ? 'border-app-500 bg-app-50 text-app-700 ring-1 ring-app-500' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
          >
            <Icon className="w-5 h-5" />
            {labels?.[t] ?? HERO_TYPE_LABELS[t] ?? t}
          </button>
        );
      })}
    </div>
  );
}

/** Campos de un video: enlace (mp4/webm o YouTube), póster, sonido y repetición. */
export function HeroVideoFields({ value, onChange }: { value: MediaFieldsValue; onChange: (patch: Partial<MediaFieldsValue>) => void }) {
  return (
    <div className="space-y-3">
      <Field label="Enlace del video" required hint="Un archivo .mp4 o .webm, o un enlace de YouTube. Se reproduce solo y en silencio.">
        <TextInput value={value.videoUrl || ''} onChange={(e) => onChange({ videoUrl: e.target.value })} placeholder="https://…/video.mp4" />
      </Field>
      <Field label="Imagen de portada (opcional)" hint="Se ve mientras carga el video y cuando el visitante prefiere menos movimiento.">
        <ImageInput ratio="landscape" value={value.videoPoster || ''} onChange={(v) => onChange({ videoPoster: v })} />
      </Field>
      <FormGrid cols={2}>
        <Switch checked={value.videoMuted ?? true} onChange={(v) => onChange({ videoMuted: v })} label="Sin sonido" description="Los navegadores solo reproducen solos los videos en silencio." />
        <Switch checked={value.videoLoop ?? true} onChange={(v) => onChange({ videoLoop: v })} label="Repetir" />
      </FormGrid>
    </div>
  );
}

/** Campos de un carrusel de imágenes: imágenes (archivo o enlace), intervalo y transición. */
export function HeroCarouselFields({ value, onChange }: { value: MediaFieldsValue; onChange: (patch: Partial<MediaFieldsValue>) => void }) {
  const images = (value.carouselImages ?? []).filter((u) => u?.trim());
  const [link, setLink] = useState('');
  const addLink = () => {
    const url = link.trim();
    if (!url) return;
    onChange({ carouselImages: [...images, url] });
    setLink('');
  };
  return (
    <div className="space-y-3">
      <Field label="Imágenes del carrusel" required hint="Arrastra o sube varias; pasa el mouse sobre una para ordenarla o quitarla.">
        <ImageGallery value={images} onChange={(v) => onChange({ carouselImages: v })} max={10} />
      </Field>
      <div className="flex gap-2">
        <TextInput
          aria-label="Enlace de una imagen"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLink(); } }}
          placeholder="O pega el enlace de una imagen: https://…"
        />
        <Button size="sm" variant="secondary" onClick={addLink} disabled={!link.trim()}>Agregar</Button>
      </div>
      <FormGrid cols={2}>
        <Field label="Cambiar de imagen cada">
          <NumberInput
            min="1"
            max="30"
            suffix="seg"
            value={(value.carouselInterval || 5000) / 1000}
            onChange={(e) => onChange({ carouselInterval: Math.min(30, Math.max(1, parseInt(e.target.value) || 5)) * 1000 })}
          />
        </Field>
        <Field label="Transición">
          <RadioGroup
            variant="segmented"
            value={value.carouselTransition === 'slide' ? 'slide' : 'fade'}
            onChange={(t) => onChange({ carouselTransition: t })}
            options={[{ value: 'fade', label: 'Fundido' }, { value: 'slide', label: 'Deslizar' }]}
          />
        </Field>
      </FormGrid>
    </div>
  );
}

/** Colores del gradiente: los de marca o tres propios (desde, medio opcional, hasta). */
function GradientFields({ value, onChange, brandColors }: { value: BgValue; onChange: (patch: Partial<BgValue>) => void; brandColors: BrandColors }) {
  const custom = !!value.gradientColors?.from;
  const colors = value.gradientColors ?? { from: brandColors.primary, via: brandColors.secondary, to: brandColors.accent };
  const set = (patch: Partial<typeof colors>) => onChange({ gradientColors: { ...colors, ...patch } });
  return (
    <div className="space-y-3">
      <div className="h-10 rounded-lg ring-1 ring-gray-200" style={{ background: custom ? customGradient(colors) : brandGradient(brandColors) }} aria-hidden="true" />
      <Switch
        checked={!custom}
        onChange={(useBrand) => onChange({ gradientColors: useBrand ? undefined : { from: brandColors.primary, via: brandColors.secondary, to: brandColors.accent } })}
        label="Usar los colores de la marca"
        description="Apágalo para elegir tus propios colores."
      />
      {custom && (
        <FormGrid cols={3}>
          <Field label="Desde"><ColorInput value={colors.from} onChange={(v) => set({ from: v })} /></Field>
          <Field label="Medio (opcional)"><ColorInput value={colors.via || ''} onChange={(v) => set({ via: v })} /></Field>
          <Field label="Hasta"><ColorInput value={colors.to} onChange={(v) => set({ to: v })} /></Field>
        </FormGrid>
      )}
    </div>
  );
}

/**
 * Editor completo de un fondo: selector de tipo y los campos de cada tipo, más el oscurecido
 * (en los fondos de color fuerte, imagen o video, donde el texto va en blanco).
 */
export function HeroBackgroundFields<T extends string>({ value, onChange, types, brandColors, labels, gradientColors = true, hint, extra }: {
  value: BgValue & { type: T };
  onChange: (next: BgValue & { type: T }) => void;
  types: readonly T[];
  brandColors: BrandColors;
  /** Nombres propios de algunos tipos (p. ej. en las laterales "gradient" es la tarjeta con producto). */
  labels?: Partial<Record<string, string>>;
  /** Mostrar los colores del gradiente. */
  gradientColors?: boolean;
  hint?: ReactNode;
  extra?: ReactNode;
}) {
  const patch = (p: Partial<BgValue>) => onChange({ ...value, ...p } as BgValue & { type: T });
  const dark = (value.type === 'gradient' && gradientColors) || ['image', 'video', 'carousel'].includes(value.type);
  return (
    <div className="space-y-4">
      <Field label="Fondo" hint={hint}><HeroTypePicker value={value.type} onChange={(type) => patch({ type })} types={types} labels={labels} /></Field>
      {value.type === 'gradient' && gradientColors && <GradientFields value={value} onChange={patch} brandColors={brandColors} />}
      {value.type === 'image' && (
        <Field label="Imagen de fondo" required hint="Se oscurece un poco para que el texto (en blanco) se lea.">
          <ImageInput ratio="landscape" value={value.imageUrl || ''} onChange={(v) => patch({ imageUrl: v })} />
        </Field>
      )}
      {value.type === 'video' && <HeroVideoFields value={value} onChange={patch} />}
      {value.type === 'carousel' && <HeroCarouselFields value={value} onChange={patch} />}
      {extra}
      {dark && (
        <Field label={`Oscurecer fondo: ${value.overlayOpacity || 0}%`}>
          <input
            type="range"
            min="0"
            max="80"
            value={value.overlayOpacity || 0}
            onChange={(e) => patch({ overlayOpacity: parseInt(e.target.value) })}
            className="w-full accent-app-600"
            aria-label="Oscurecer fondo"
          />
        </Field>
      )}
    </div>
  );
}
