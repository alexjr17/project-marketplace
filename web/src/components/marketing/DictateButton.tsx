/**
 * Dictar por voz: escucha el micrófono y escribe lo que se dice (reconocimiento de voz del navegador,
 * en español de Colombia). Si el navegador no lo soporta, el botón no aparece.
 */
import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { toast } from '../ui';
import { canDictate, recognitionCtor, type Recognition } from './dictation';

export function DictateButton({ onText, label = 'Dictar por voz', className = '' }: { onText: (text: string) => void; label?: string; className?: string }) {
  const [on, setOn] = useState(false);
  const rec = useRef<Recognition | null>(null);
  useEffect(() => () => rec.current?.stop(), []);
  if (!canDictate()) return null;

  const toggle = () => {
    if (on) { rec.current?.stop(); return; }
    const R = recognitionCtor()!;
    const r = new R();
    r.lang = 'es-CO';
    r.continuous = true;
    r.interimResults = false;
    r.onresult = (e) => {
      let text = '';
      for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) text += e.results[i][0].transcript;
      if (text.trim()) onText(text.trim());
    };
    r.onerror = (e) => { if (e.error !== 'no-speech' && e.error !== 'aborted') toast.error(e.error === 'not-allowed' ? 'Permite el micrófono para dictar' : 'No se pudo escuchar el micrófono'); };
    r.onend = () => setOn(false);
    rec.current = r;
    r.start();
    setOn(true);
  };

  return (
    <button
      type="button" onClick={toggle} title={on ? 'Dejar de dictar' : label} aria-label={on ? 'Dejar de dictar' : label} aria-pressed={on}
      className={`inline-flex items-center justify-center rounded-lg p-2 transition-colors ${on ? 'bg-red-50 text-red-600 animate-pulse' : 'text-gray-500 hover:text-app-700 hover:bg-app-50'} ${className}`}
    >
      {on ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
    </button>
  );
}

