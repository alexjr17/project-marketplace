/** Reconocimiento de voz del navegador (para dictar textos). */
export interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}
export type RecognitionCtor = new () => Recognition;

export const recognitionCtor = (): RecognitionCtor | null => {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};
export const canDictate = () => typeof window !== 'undefined' && !!recognitionCtor();

/** Junta lo dictado con lo que ya había escrito. */
export const appendText = (cur: string, add: string) => (cur.trim() ? `${cur.trim()} ${add}` : add);
