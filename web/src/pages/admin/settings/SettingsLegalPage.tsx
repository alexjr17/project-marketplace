import { useState } from 'react';
import { useSettings } from '../../../context/SettingsContext';
import { RichTextEditor } from '../../../components/shared/RichTextEditor';
import type { LegalSettings } from '../../../types/settings';
import { ExternalLink, FileText, Pencil, RefreshCw, Save, Shield } from 'lucide-react';
import {
  Badge, Button, Dialog, Field, IconButton, Page, PageHeader, SettingsSection, Switch, TextInput, toast,
} from '../../../components/ui';

const LEGAL_PAGES: Record<keyof LegalSettings, { icon: typeof FileText; label: string; slug: string; description: string }> = {
  termsAndConditions: { icon: FileText, label: 'Términos y condiciones', slug: 'terms', description: 'Reglas de uso de la tienda y condiciones de compra.' },
  privacyPolicy: { icon: Shield, label: 'Política de privacidad', slug: 'privacy', description: 'Cómo se recogen y tratan los datos de los clientes.' },
  returnsPolicy: { icon: RefreshCw, label: 'Política de devoluciones', slug: 'returns', description: 'Plazos y condiciones para cambios y devoluciones.' },
};

/** Páginas legales de la tienda (se enlazan desde el pie de página). */
export const SettingsLegalPage = () => {
  const { settings, updateLegalPage } = useSettings();

  const [editing, setEditing] = useState<keyof LegalSettings | null>(null);
  const [form, setForm] = useState({ title: '', content: '', isActive: true });
  const [saving, setSaving] = useState(false);

  const openEditor = (key: keyof LegalSettings) => {
    const page = settings.legal[key];
    setForm({ title: page.title, content: page.content, isActive: page.isActive });
    setEditing(key);
  };

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await updateLegalPage(editing, form);
      toast.success('Página legal actualizada');
      setEditing(null);
    } catch {
      toast.error('No se pudo guardar la página legal');
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (key: keyof LegalSettings) => {
    const page = settings.legal[key];
    try {
      await updateLegalPage(key, { isActive: !page.isActive });
      toast.success(`Página ${!page.isActive ? 'activada' : 'desactivada'}`);
    } catch {
      toast.error('No se pudo cambiar el estado de la página');
    }
  };

  return (
    <Page>
      <PageHeader icon={FileText} title="Páginas legales" subtitle="Contenido de las páginas legales que se enlazan desde el pie de la tienda" />

      <div>
        {(Object.keys(LEGAL_PAGES) as Array<keyof LegalSettings>).map((key) => {
          const info = LEGAL_PAGES[key];
          const page = settings.legal[key];
          const date = new Date(page.lastUpdated).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
          const preview = page.content.replace(/<[^>]*>/g, '').trim();
          return (
            <SettingsSection key={key} title={info.label} description={info.description}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-gray-900">{page.title}</p>
                    <Badge tone={page.isActive ? 'green' : 'gray'}>{page.isActive ? 'Publicada' : 'Inactiva'}</Badge>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">/legal/{info.slug} · Actualizada el {date}</p>
                </div>
                <div className="flex items-center flex-shrink-0">
                  <a href={`/legal/${info.slug}`} target="_blank" rel="noopener noreferrer" title="Ver en la tienda"
                    className="p-2 rounded-lg text-gray-500 hover:text-app-700 hover:bg-app-50 transition-colors">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  <IconButton title="Editar" tone="app" onClick={() => openEditor(key)}><Pencil className="w-4 h-4" /></IconButton>
                </div>
              </div>
              <p className="text-sm text-gray-500 line-clamp-2">{preview ? `${preview.substring(0, 180)}…` : <span className="text-gray-400">Sin contenido.</span>}</p>
              <div className="border-t border-gray-100 pt-4">
                <Switch checked={page.isActive} onChange={() => toggle(key)} label="Visible en la tienda" description="Si la desactivas, el enlace deja de mostrarse en el pie de página." />
              </div>
            </SettingsSection>
          );
        })}
      </div>

      <Dialog
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing ? `Editar ${LEGAL_PAGES[editing].label.toLowerCase()}` : 'Editar página'}
        size="xl"
        footer={<>
          <Button variant="secondary" onClick={() => setEditing(null)}>Cancelar</Button>
          <Button icon={<Save className="w-4 h-4" />} isLoading={saving} onClick={save}>Guardar cambios</Button>
        </>}
      >
        <div className="space-y-4">
          <Field label="Título de la página" htmlFor="legal-title">
            <TextInput id="legal-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ej: Términos y condiciones" />
          </Field>
          <Field label="Contenido">
            <RichTextEditor content={form.content} onChange={(html) => setForm({ ...form, content: html })} />
          </Field>
          <Switch checked={form.isActive} onChange={(v) => setForm({ ...form, isActive: v })} label="Página activa" description="Visible en el sitio y enlazada en el pie de página." />
        </div>
      </Dialog>
    </Page>
  );
};
