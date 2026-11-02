import DOMPurify from 'dompurify';

/**
 * Limpia HTML que viene de datos (editor de texto, contenido legal) antes de pintarlo con
 * dangerouslySetInnerHTML: quita scripts, manejadores on*, iframes y URLs javascript:.
 * Todo HTML de datos se pinta SIEMPRE a través de esta función.
 */
export function sanitizeHtml(html: string | null | undefined): string {
  return DOMPurify.sanitize(html ?? '', {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['style', 'iframe', 'form', 'input', 'button'],
    FORBID_ATTR: ['style'],
  });
}
