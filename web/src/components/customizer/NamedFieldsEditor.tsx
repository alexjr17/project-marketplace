/**
 * Admin → diseño con nombre: sobre la imagen del diseño se marca dónde va cada texto editable (el
 * nombre…) arrastrando y cambiando el tamaño de su caja, y con qué letra se dibuja. La vista previa
 * es la misma imagen que verá el cliente.
 */
import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { Plus, Trash2, Type } from 'lucide-react';
import { Button, Spinner } from '../ui';
import type { NamedField } from '../../services/design-images.service';
import { composeNamed, defaultValues, fieldSpec } from '../../lib/namedDesign';
import { DEFAULT_TEXT, type TextSpec } from '../../lib/textArt';
import { TextStyleEditor } from './TextTools';

const MAX = 6;

const newField = (n: number): NamedField => ({
  key: n ? `texto-${n + 1}` : 'nombre',
  label: n ? `Texto ${n + 1}` : 'Nombre',
  default: n ? 'Texto' : 'Sofía',
  maxLength: 14,
  box: { x: 15, y: 70, w: 70, h: 18 },
  style: { font: 'Mountains of Christmas', weight: 700, italic: false, color: '#C62828', upper: false, spacing: 2, shape: 'arco', curve: 25, outline: { color: '#FFFFFF', width: 6 } },
});

const r2 = (v: number) => Math.round(v * 100) / 100;

export function NamedFieldsEditor({ image, fields, onChange }: { image: string; fields: NamedField[]; onChange: (f: NamedField[]) => void }) {
  const [sel, setSel] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const drag = useRef<{ i: number; mode: 'move' | 'size'; x: number; y: number; box: NamedField['box'] } | null>(null);
  const cur = fields[Math.min(sel, fields.length - 1)];

  // Vista previa con los textos de ejemplo (un momento después del último cambio).
  const key = JSON.stringify(fields);
  useEffect(() => {
    if (!image) return;
    let alive = true;
    const t = window.setTimeout(() => {
      setBusy(true);
      composeNamed({ base: image, fields, values: defaultValues(fields) }, 700)
        .then((r) => alive && setPreview(r.url))
        .catch(() => alive && setPreview(null))
        .finally(() => alive && setBusy(false));
    }, 300);
    return () => { alive = false; window.clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image, key]);

  const patch = (i: number, p: Partial<NamedField>) => onChange(fields.map((f, k) => (k === i ? { ...f, ...p } : f)));
  const setStyle = (i: number, p: Partial<TextSpec>) => {
    const f = fields[i];
    const next = { ...fieldSpec(f, f.default), ...p };
    patch(i, {
      ...(p.text !== undefined ? { default: p.text.slice(0, f.maxLength) } : {}),
      style: { font: next.font, weight: next.weight, italic: next.italic, color: next.color, upper: next.upper, spacing: next.spacing, shape: next.shape, curve: next.curve, outline: next.outline },
    });
  };

  const onDown = (e: RPointerEvent, i: number, mode: 'move' | 'size') => {
    e.preventDefault();
    e.stopPropagation();
    setSel(i);
    drag.current = { i, mode, x: e.clientX, y: e.clientY, box: fields[i].box };
    (e.target as Element).setPointerCapture(e.pointerId);
  };
  const onMove = (e: RPointerEvent) => {
    const d = drag.current;
    const el = stage.current;
    if (!d || !el) return;
    const r = el.getBoundingClientRect();
    const dx = ((e.clientX - d.x) / r.width) * 100, dy = ((e.clientY - d.y) / r.height) * 100;
    const b = d.box;
    const box = d.mode === 'move'
      ? { ...b, x: r2(Math.min(100 - b.w, Math.max(0, b.x + dx))), y: r2(Math.min(100 - b.h, Math.max(0, b.y + dy))) }
      : { ...b, w: r2(Math.min(100 - b.x, Math.max(4, b.w + dx))), h: r2(Math.min(100 - b.y, Math.max(4, b.h + dy))) };
    patch(d.i, { box });
  };

  if (!image) return <p className="text-sm text-gray-500">Sube primero la imagen del diseño.</p>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_20rem] gap-4">
      <div>
        <div ref={stage} onPointerMove={onMove} onPointerUp={() => { drag.current = null; }}
          className="relative mx-auto max-w-md rounded-lg overflow-hidden select-none touch-none"
          style={{ background: 'repeating-conic-gradient(#f3f4f6 0% 25%, #fff 0% 50%) 50% / 20px 20px' }}>
          {preview ? <img src={preview} alt="Vista previa del diseño con el nombre" className="block w-full" draggable={false} /> : <div className="aspect-square grid place-items-center"><Spinner /></div>}
          {fields.map((f, i) => (
            <div key={f.key + i} onPointerDown={(e) => onDown(e, i, 'move')} role="button" aria-label={`Caja de ${f.label}`} tabIndex={0}
              className={`absolute cursor-move border-2 border-dashed ${i === sel ? 'border-app-600 bg-app-500/10' : 'border-gray-400/70'}`}
              style={{ left: `${f.box.x}%`, top: `${f.box.y}%`, width: `${f.box.w}%`, height: `${f.box.h}%` }}>
              <span className={`absolute -top-5 left-0 px-1.5 rounded text-[10px] font-semibold ${i === sel ? 'bg-app-600 text-white' : 'bg-gray-600 text-white'}`}>{f.label}</span>
              <span onPointerDown={(e) => onDown(e, i, 'size')} aria-label={`Tamaño de ${f.label}`}
                className="absolute -right-1.5 -bottom-1.5 w-3.5 h-3.5 rounded-sm bg-app-600 ring-2 ring-white cursor-nwse-resize" />
            </div>
          ))}
          {busy && preview && <span className="absolute top-2 right-2"><Spinner /></span>}
        </div>
        <p className="mt-2 text-xs text-gray-500 text-center">Arrastra cada caja a su lugar y usa la esquina para cambiar su tamaño. El texto se ajusta dentro de la caja.</p>
      </div>

      <div className="space-y-3 min-w-0">
        <div className="flex flex-wrap gap-1.5">
          {fields.map((f, i) => (
            <button key={f.key + i} type="button" onClick={() => setSel(i)} aria-pressed={i === sel}
              className={`h-8 px-2.5 rounded-lg border text-xs font-medium ${i === sel ? 'border-app-600 bg-app-50 text-app-700' : 'border-gray-300 text-gray-700'}`}>
              <Type className="inline w-3.5 h-3.5 mr-1" />{f.label}
            </button>
          ))}
          {fields.length < MAX && (
            <Button size="sm" variant="ghost" icon={<Plus className="w-4 h-4" />} onClick={() => { onChange([...fields, newField(fields.length)]); setSel(fields.length); }}>Texto</Button>
          )}
        </div>
        {cur && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-xs font-medium text-gray-600">Qué es</span>
                <input value={cur.label} maxLength={40} aria-label="Qué es el texto" onChange={(e) => patch(sel, { label: e.target.value })}
                  className="mt-1 w-full h-9 rounded-lg border border-gray-300 px-2.5 text-sm" placeholder="Nombre" />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-gray-600">Máx. de letras</span>
                <input type="number" min={1} max={40} value={cur.maxLength} aria-label="Máximo de letras"
                  onChange={(e) => { const m = Math.max(1, Math.min(40, Number(e.target.value) || 1)); patch(sel, { maxLength: m, default: cur.default.slice(0, m) }); }}
                  className="mt-1 w-full h-9 rounded-lg border border-gray-300 px-2.5 text-sm" />
              </label>
            </div>
            <label className="block">
              <span className="text-xs font-medium text-gray-600">Texto de ejemplo</span>
              <input value={cur.default} maxLength={cur.maxLength} aria-label="Texto de ejemplo" onChange={(e) => patch(sel, { default: e.target.value })}
                className="mt-1 w-full h-9 rounded-lg border border-gray-300 px-2.5 text-sm" />
            </label>
            <TextStyleEditor spec={{ ...DEFAULT_TEXT, ...fieldSpec(cur, cur.default) }} sample={cur.default || 'Sofía'} onBegin={() => {}} onChange={(p) => setStyle(sel, p)} />
            <Button size="sm" variant="ghost" className="!text-red-600 hover:!bg-red-50" icon={<Trash2 className="w-4 h-4" />}
              onClick={() => { onChange(fields.filter((_, k) => k !== sel)); setSel(Math.max(0, sel - 1)); }}>
              Quitar este texto
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
