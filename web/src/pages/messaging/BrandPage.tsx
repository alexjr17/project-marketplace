/**
 * App Social → Marca. La ficha de la marca que usa el estudio de contenido: logos (de texto e ícono,
 * para fondo claro y oscuro), colores, tipografía, lema y voz (cómo escribe la IA). Viene cargada con
 * el Brand Reference Board de TOCLEX y se puede ajustar.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Palette, Plus, Save, Trash2, Type, Wand2, X } from 'lucide-react';
import {
  Badge, Button, Card, CardTitle, ColorInput, Field, FormActions, IconButton, ImageInput, Page, PageHeader, SelectInput, Spinner, Switch,
  TextArea, TextInput, toast,
} from '../../components/ui';
import { errorMessage } from '../../lib/http';
import { brandFromKit, loadFont } from '../../components/marketing/brand';
import { drawStill, type Brand } from '../../components/marketing/render';
import { marketingService, type BrandKit, type CopyTone } from '../../services/marketing.service';

const TONES: { value: CopyTone; label: string }[] = [
  { value: 'cercano', label: 'Cercano' }, { value: 'urgente', label: 'Urgente' }, { value: 'elegante', label: 'Elegante' },
  { value: 'divertido', label: 'Divertido' }, { value: 'inspirador', label: 'Inspirador' },
];

const COLOR_ROLES: Record<string, string> = {
  primary: 'Principal: fondos oscuros y textos',
  paper: 'Fondo claro',
  secondary: 'Secundario: detalles',
  accent: 'Acento: botones, precios y ofertas',
};

const LOGOS: { key: keyof BrandKit['logos']; label: string; dark: boolean }[] = [
  { key: 'wordmark', label: 'Logo de texto', dark: false },
  { key: 'wordmarkLight', label: 'Logo de texto (fondo oscuro)', dark: true },
  { key: 'icon', label: 'Ícono', dark: false },
  { key: 'iconLight', label: 'Ícono (fondo oscuro)', dark: true },
];

export const BrandPage = () => {
  const navigate = useNavigate();
  const [kit, setKit] = useState<BrandKit | null>(null);
  const [saved, setSaved] = useState('');
  const [saving, setSaving] = useState(false);
  const [tag, setTag] = useState('');
  const [brand, setBrand] = useState<Brand | null>(null);
  const offer = useRef<HTMLCanvasElement>(null);
  const coupon = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    marketingService.brand().then((k) => { setKit(k); setSaved(JSON.stringify(k)); }).catch((e) => toast.error(errorMessage(e, 'No se pudo cargar la ficha de la marca')));
  }, []);

  // Vista previa: se rearma la marca (logos y tipografías) cuando cambia la ficha.
  useEffect(() => {
    if (!kit) return;
    let alive = true;
    const t = window.setTimeout(() => { brandFromKit(kit).then((b) => { if (alive) setBrand(b); }); }, 250);
    return () => { alive = false; window.clearTimeout(t); };
  }, [kit]);

  useEffect(() => {
    if (!brand || !kit) return;
    const base = { format: 'post' as const, showPrice: true, brand, cta: 'Compra ya', items: [{ name: 'Suéter básico', price: 49900, listPrice: 58700, discountPercent: 15, image: null }] };
    const o = offer.current?.getContext('2d');
    if (o) drawStill(o, { ...base, template: 'oferta', title: 'Nueva colección', subtitle: kit.slogan, promo: null });
    const c = coupon.current?.getContext('2d');
    if (c) drawStill(c, { ...base, template: 'cupon', title: 'Cupón de bienvenida', subtitle: 'En toda la tienda', promo: { label: '-10%', code: 'BIENVENIDA10', name: 'Bienvenida' } });
  }, [brand, kit]);

  const dirty = useMemo(() => !!kit && JSON.stringify(kit) !== saved, [kit, saved]);

  if (!kit) return <Page><Spinner label="Cargando la ficha de la marca…" /></Page>;

  const set = <K extends keyof BrandKit>(k: K, v: BrandKit[K]) => setKit({ ...kit, [k]: v });
  const setColor = (i: number, patch: Partial<BrandKit['colors'][number]>) => set('colors', kit.colors.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  const save = async () => {
    setSaving(true);
    try {
      const r = await marketingService.saveBrand(kit);
      setKit(r);
      setSaved(JSON.stringify(r));
      toast.success('Ficha de la marca guardada: el estudio ya la usa');
    } catch (e) {
      toast.error(errorMessage(e, 'No se pudo guardar'));
    } finally {
      setSaving(false);
    }
  };

  const addTag = () => {
    const t = tag.trim().replace(/^#/, '').replace(/\s+/g, '');
    if (t && !kit.voice.hashtags.includes(t)) set('voice', { ...kit.voice, hashtags: [...kit.voice.hashtags, t].slice(0, 10) });
    setTag('');
  };

  const fonts = kit.fontOptions ?? ['Inter'];

  return (
    <Page className="max-w-6xl mx-auto">
      <PageHeader
        icon={Palette}
        title="Marca"
        subtitle="La ficha que usa el estudio: logos, colores, tipografía y la voz con la que escribe la IA."
        actions={(
          <>
            <Button variant="secondary" icon={<Wand2 className="w-4 h-4" />} onClick={() => navigate('/messaging/studio')}>Ir al estudio</Button>
            <Button icon={<Save className="w-4 h-4" />} isLoading={saving} disabled={!dirty} onClick={save}>Guardar</Button>
          </>
        )}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-5 items-start">
        <div className="space-y-5 min-w-0">
          <Card>
            <CardTitle>Identidad</CardTitle>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Nombre" required htmlFor="bk-name"><TextInput id="bk-name" value={kit.name} maxLength={60} onChange={(e) => set('name', e.target.value)} /></Field>
              <Field label="Lema" htmlFor="bk-slogan" hint="Sale en el cierre de los reels."><TextInput id="bk-slogan" value={kit.slogan} maxLength={80} onChange={(e) => set('slogan', e.target.value)} /></Field>
              <Field label="De qué se trata la marca" htmlFor="bk-desc" className="sm:col-span-2"><TextArea id="bk-desc" rows={2} maxLength={300} value={kit.description} onChange={(e) => set('description', e.target.value)} /></Field>
            </div>
          </Card>

          <Card>
            <CardTitle>Logos</CardTitle>
            <p className="text-sm text-gray-500 mb-4">PNG con fondo transparente. La versión para fondo oscuro va clara (blanca o gris claro).</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {LOGOS.map((l) => (
                <div key={l.key}>
                  <p className="text-xs font-medium text-gray-700 mb-1">{l.label}</p>
                  <div className={`rounded-xl p-2 ${l.dark ? 'bg-[#1F1D1E]' : 'bg-gray-50'}`}>
                    <ImageInput value={kit.logos[l.key]} onChange={(v) => set('logos', { ...kit.logos, [l.key]: v })} maxSizeMB={5} />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardTitle actions={kit.colors.length < 8 && <Button size="sm" variant="ghost" icon={<Plus className="w-4 h-4" />} onClick={() => set('colors', [...kit.colors, { key: '', name: 'Nuevo color', hex: '#888888' }])}>Agregar</Button>}>Colores</CardTitle>
            <div className="space-y-3">
              {kit.colors.map((c, i) => (
                <div key={i} className="grid grid-cols-[48px_minmax(0,1fr)_180px_auto] gap-3 items-center">
                  <span className="w-12 h-12 rounded-xl ring-1 ring-gray-200" style={{ background: c.hex }} />
                  <div className="min-w-0">
                    <TextInput aria-label="Nombre del color" value={c.name} maxLength={40} onChange={(e) => setColor(i, { name: e.target.value })} />
                    <p className="text-xs text-gray-500 mt-1">{COLOR_ROLES[c.key] ?? 'Color adicional de la paleta'}</p>
                  </div>
                  <ColorInput value={c.hex} onChange={(hex) => setColor(i, { hex: hex.toUpperCase() })} />
                  {COLOR_ROLES[c.key] ? <span className="w-9" /> : <IconButton title="Quitar color" tone="danger" onClick={() => set('colors', kit.colors.filter((_, j) => j !== i))}><Trash2 className="w-4 h-4" /></IconButton>}
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardTitle icon={Type}>Tipografía</CardTitle>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Títulos" htmlFor="bk-hf">
                <SelectInput id="bk-hf" value={kit.fonts.heading} onChange={(e) => { loadFont(e.target.value); set('fonts', { ...kit.fonts, heading: e.target.value }); }}>
                  {fonts.map((f) => <option key={f} value={f}>{f}</option>)}
                </SelectInput>
              </Field>
              <Field label="Textos" htmlFor="bk-bf">
                <SelectInput id="bk-bf" value={kit.fonts.body} onChange={(e) => { loadFont(e.target.value); set('fonts', { ...kit.fonts, body: e.target.value }); }}>
                  {fonts.map((f) => <option key={f} value={f}>{f}</option>)}
                </SelectInput>
              </Field>
              <div className="sm:col-span-2">
                <Switch checked={kit.fonts.headingUppercase} onChange={(v) => set('fonts', { ...kit.fonts, headingUppercase: v })} label="Títulos en mayúsculas" />
              </div>
              <div className="sm:col-span-2 rounded-xl border border-gray-200 p-4" style={{ background: kit.colors.find((c) => c.key === 'paper')?.hex }}>
                <p style={{ fontFamily: `"${kit.fonts.heading}", Inter, sans-serif`, fontWeight: 800, fontSize: 34, lineHeight: 1.05, textTransform: kit.fonts.headingUppercase ? 'uppercase' : 'none', color: kit.colors.find((c) => c.key === 'primary')?.hex }}>
                  Ropa que te representa
                </p>
                <p className="mt-2" style={{ fontFamily: `"${kit.fonts.body}", Inter, sans-serif`, fontSize: 16, color: kit.colors.find((c) => c.key === 'secondary')?.hex }}>
                  ABCDEFGHIJKLMNÑOPQRSTUVWXYZ · abcdefghijklmnñopqrstuvwxyz · 0123456789
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <CardTitle>Voz de la marca</CardTitle>
            <p className="text-sm text-gray-500 mb-4">Así escribe la IA los textos del estudio.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Tono por defecto" htmlFor="bk-tone">
                <SelectInput id="bk-tone" value={kit.voice.tone} onChange={(e) => set('voice', { ...kit.voice, tone: e.target.value as CopyTone })}>
                  {TONES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </SelectInput>
              </Field>
              <div />
              <Field label="Personalidad" htmlFor="bk-pers" className="sm:col-span-2"><TextArea id="bk-pers" rows={2} maxLength={400} value={kit.voice.personality} onChange={(e) => set('voice', { ...kit.voice, personality: e.target.value })} /></Field>
              <Field label="Qué evitar" htmlFor="bk-avoid" className="sm:col-span-2"><TextArea id="bk-avoid" rows={2} maxLength={300} value={kit.voice.avoid} onChange={(e) => set('voice', { ...kit.voice, avoid: e.target.value })} /></Field>
              <div className="sm:col-span-2">
                <p className="text-sm font-medium text-gray-700 mb-1.5">Hashtags de la marca <span className="font-normal text-gray-500">(van en todos los posts)</span></p>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {kit.voice.hashtags.map((t) => (
                    <Badge key={t} tone="app">#{t}<button type="button" aria-label={`Quitar #${t}`} onClick={() => set('voice', { ...kit.voice, hashtags: kit.voice.hashtags.filter((x) => x !== t) })}><X className="w-3 h-3" /></button></Badge>
                  ))}
                </div>
                <TextInput aria-label="Agregar hashtag" placeholder="Agregar hashtag y Enter" value={tag} onChange={(e) => setTag(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }} />
              </div>
            </div>
            <FormActions>
              <Button variant="secondary" disabled={!dirty || saving} onClick={() => setKit(JSON.parse(saved))}>Descartar</Button>
              <Button icon={<Save className="w-4 h-4" />} isLoading={saving} disabled={!dirty} onClick={save}>Guardar</Button>
            </FormActions>
          </Card>
        </div>

        <Card className="lg:sticky lg:top-4">
          <CardTitle>Así se ven tus piezas</CardTitle>
          <div className="space-y-3">
            <canvas ref={offer} width={1080} height={1080} className="w-full h-auto rounded-xl ring-1 ring-gray-200" aria-label="Ejemplo de oferta con la marca" />
            <canvas ref={coupon} width={1080} height={1080} className="w-full h-auto rounded-xl ring-1 ring-gray-200" aria-label="Ejemplo de cupón con la marca" />
            <div className="flex gap-1.5">{kit.colors.map((c, i) => <span key={i} title={c.name} className="flex-1 h-8 rounded-lg ring-1 ring-gray-200" style={{ background: c.hex }} />)}</div>
          </div>
        </Card>
      </div>
    </Page>
  );
};
