import { useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  Edit3,
  FolderPlus,
  Plus,
  Save,
  Send,
  Settings,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { Alert, Badge, Button, Card, CardTitle, Checkbox, Dialog, EmptyState, Field, IconButton, Page, PageHeader, Spinner, TextArea, TextInput, toast, useConfirm } from '../../components/ui';
import botKnowledgeService, {
  type CategoryInput,
  type KnowledgeInput,
} from '../../services/botKnowledge.service';
import type { BotKnowledgeEntry, KnowledgeCategory } from '../../types/messaging';

// =====================================================================

export const KnowledgePage = () => {
  const confirm = useConfirm();

  const [categories, setCategories] = useState<KnowledgeCategory[]>([]);
  const [entries, setEntries] = useState<BotKnowledgeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [entryEditor, setEntryEditor] = useState<{ entry: BotKnowledgeEntry | null; categorySlug: string } | null>(null);
  const [categoryEditor, setCategoryEditor] = useState<KnowledgeCategory | 'new' | null>(null);

  // Panel de prueba en vivo
  const [testText, setTestText] = useState('');
  const [testContactName, setTestContactName] = useState('Camila');
  const [testBusy, setTestBusy] = useState(false);
  const [testResult, setTestResult] = useState<{ provider: string; reply: string } | null>(null);

  const load = async () => {
    try {
      const [cats, ents] = await Promise.all([
        botKnowledgeService.listCategories(),
        botKnowledgeService.list(),
      ]);
      setCategories(cats);
      setEntries(ents);
      // Expandir la primera categoría por defecto
      if (cats.length > 0) {
        setExpanded({ [cats[0].slug]: true });
      }
    } catch (err) {
      console.error('[Knowledge] Error cargando:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const byCategory = useMemo(() => {
    const map: Record<string, BotKnowledgeEntry[]> = {};
    for (const e of entries) {
      (map[e.category] ??= []).push(e);
    }
    return map;
  }, [entries]);

  const toggleCategory = (slug: string) => {
    setExpanded((p) => ({ ...p, [slug]: !p[slug] }));
  };

  // ===== Handlers entradas =====

  const openNewEntry = (categorySlug: string) => setEntryEditor({ entry: null, categorySlug });
  const openEditEntry = (entry: BotKnowledgeEntry) => setEntryEditor({ entry, categorySlug: entry.category });
  const closeEntryEditor = () => setEntryEditor(null);

  const handleSaveEntry = async (input: KnowledgeInput, id?: number) => {
    const saved = id
      ? await botKnowledgeService.update(id, input)
      : await botKnowledgeService.create(input);
    if (saved) {
      setEntries((prev) => {
        const exists = prev.find((e) => e.id === saved.id);
        return exists ? prev.map((e) => (e.id === saved.id ? saved : e)) : [...prev, saved];
      });
    }
    closeEntryEditor();
  };

  const handleToggleEntry = async (entry: BotKnowledgeEntry) => {
    const updated = await botKnowledgeService.update(entry.id, { isActive: !entry.isActive });
    if (updated) setEntries((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
  };

  const handleDeleteEntry = async (entry: BotKnowledgeEntry) => {
    if (!(await confirm({ title: `¿Eliminar "${entry.title}"?`, message: 'El bot dejará de usar esta entrada. No se puede deshacer.', tone: 'danger' }))) return;
    await botKnowledgeService.remove(entry.id);
    setEntries((prev) => prev.filter((e) => e.id !== entry.id));
    // refrescar conteo de categorías
    setCategories((prev) =>
      prev.map((c) => (c.slug === entry.category ? { ...c, entriesCount: Math.max(0, c.entriesCount - 1) } : c))
    );
  };

  // ===== Handlers categorías =====

  const openNewCategory = () => setCategoryEditor('new');
  const openEditCategory = (cat: KnowledgeCategory) => setCategoryEditor(cat);
  const closeCategoryEditor = () => setCategoryEditor(null);

  const handleSaveCategory = async (input: CategoryInput, id?: number) => {
    const saved = id
      ? await botKnowledgeService.updateCategory(id, input)
      : await botKnowledgeService.createCategory(input);
    if (saved) {
      setCategories((prev) => {
        const exists = prev.find((c) => c.id === saved.id);
        const updated = exists ? prev.map((c) => (c.id === saved.id ? saved : c)) : [...prev, saved];
        return updated.sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
      });
    }
    closeCategoryEditor();
  };

  const handleDeleteCategory = async (cat: KnowledgeCategory) => {
    if (cat.entriesCount > 0) {
      toast.warning(`No puedes eliminar "${cat.label}" porque tiene ${cat.entriesCount} entradas. Muévelas o elimínalas primero.`);
      return;
    }
    if (!(await confirm({ title: `¿Eliminar la categoría "${cat.label}"?`, message: 'No se puede deshacer.', tone: 'danger' }))) return;
    try {
      await botKnowledgeService.removeCategory(cat.id);
      setCategories((prev) => prev.filter((c) => c.id !== cat.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo eliminar');
    }
  };

  // ===== Handler test =====

  const handleTest = async () => {
    if (!testText.trim()) return;
    setTestBusy(true);
    setTestResult(null);
    try {
      const res = await botKnowledgeService.test(testText.trim(), testContactName.trim() || undefined);
      setTestResult(res);
    } catch (err) {
      setTestResult({ provider: 'error', reply: err instanceof Error ? err.message : 'Error' });
    } finally {
      setTestBusy(false);
    }
  };

  const activeCount = entries.filter((e) => e.isActive).length;
  const visibleCategories = categories.filter((c) => c.isActive);

  return (
    <Page className="max-w-6xl mx-auto">
      <PageHeader
        icon={Sparkles}
        title="Entrenar al bot"
        subtitle={`Lo que escribas aquí se inyecta en el prompt del modelo cuando responde a un cliente. ${activeCount} de ${entries.length} entradas activas · ${categories.length} categorías.`}
        actions={<Button icon={<FolderPlus className="w-4 h-4" />} onClick={openNewCategory}>Nueva categoría</Button>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        {/* ===== Categorías ===== */}
        <div className="lg:col-span-2 space-y-3">
          {loading ? (
            <Spinner label="Cargando conocimiento…" />
          ) : visibleCategories.length === 0 ? (
            <Card>
              <EmptyState
                icon={FolderPlus}
                title="No hay categorías"
                description="Crea la primera para empezar a entrenar al bot."
                action={<Button icon={<FolderPlus className="w-4 h-4" />} onClick={openNewCategory}>Nueva categoría</Button>}
              />
            </Card>
          ) : (
            visibleCategories.map((cat) => {
              const items = byCategory[cat.slug] ?? [];
              const open = expanded[cat.slug];
              return (
                <section key={cat.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="flex items-center gap-2 px-3 md:px-4 py-3">
                    <button onClick={() => toggleCategory(cat.slug)} aria-expanded={!!open} className="flex items-center gap-3 flex-1 text-left min-w-0">
                      <span className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-lg flex-shrink-0">{cat.emoji || '📁'}</span>
                      <div className="flex-1 min-w-0">
                        <h2 className="font-semibold text-gray-900 text-sm truncate">{cat.label}</h2>
                        {cat.description && <p className="text-xs text-gray-500 truncate">{cat.description}</p>}
                      </div>
                      <Badge tone="gray">{items.filter((i) => i.isActive).length}/{items.length}</Badge>
                      <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
                    </button>
                    <div className="flex items-center flex-shrink-0">
                      <IconButton title="Editar categoría" tone="app" onClick={() => openEditCategory(cat)}><Settings className="w-4 h-4" /></IconButton>
                      <IconButton
                        tone="danger"
                        onClick={() => handleDeleteCategory(cat)}
                        disabled={cat.entriesCount > 0}
                        title={cat.entriesCount > 0 ? `Tiene ${cat.entriesCount} entradas — muévelas antes` : 'Eliminar categoría'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </IconButton>
                    </div>
                  </div>

                  {open && (
                    <div className="border-t border-gray-100 p-3 space-y-2">
                      {items.length === 0 ? (
                        <p className="text-sm text-gray-400 px-1 py-1">Aún no hay entradas en esta categoría.</p>
                      ) : (
                        items.map((entry) => (
                          <EntryRow
                            key={entry.id}
                            entry={entry}
                            onEdit={() => openEditEntry(entry)}
                            onToggle={() => handleToggleEntry(entry)}
                            onDelete={() => handleDeleteEntry(entry)}
                          />
                        ))
                      )}
                      <button
                        onClick={() => openNewEntry(cat.slug)}
                        className="w-full flex items-center justify-center gap-1.5 h-10 text-sm font-medium rounded-lg border border-dashed border-gray-300 hover:border-app-400 hover:bg-app-50 text-gray-600 hover:text-app-700 transition-colors"
                      >
                        <Plus className="w-4 h-4" /> Agregar entrada
                      </button>
                    </div>
                  )}
                </section>
              );
            })
          )}
        </div>

        {/* ===== Prueba en vivo ===== */}
        <aside className="lg:sticky lg:top-4">
          <Card>
            <CardTitle icon={Send}>Probar al bot</CardTitle>
            <p className="text-sm text-gray-500 -mt-2 mb-4">Escribe lo que escribiría un cliente. El bot usa el conocimiento activo.</p>
            <div className="space-y-3">
              <Field label="Nombre del cliente">
                <TextInput value={testContactName} onChange={(e) => setTestContactName(e.target.value)} placeholder="Camila" />
              </Field>
              <Field label="Mensaje del cliente">
                <TextArea value={testText} onChange={(e) => setTestText(e.target.value)} rows={3} placeholder="Ej. ¿Tienen talla XL en suéter oversize?" className="resize-none" />
              </Field>
              <Button fullWidth onClick={handleTest} isLoading={testBusy} disabled={!testText.trim()} icon={!testBusy ? <Send className="w-4 h-4" /> : undefined}>
                Probar respuesta
              </Button>

              {testResult && (
                <div className="space-y-1.5 pt-3 border-t border-gray-100">
                  <p className="text-xs uppercase tracking-wide text-gray-500 font-medium">Respuesta del bot ({testResult.provider})</p>
                  <div className={`text-sm rounded-lg p-3 whitespace-pre-wrap border ${testResult.provider === 'error' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-app-50 border-app-200 text-gray-800'}`}>
                    {testResult.reply}
                  </div>
                </div>
              )}
            </div>
          </Card>
        </aside>
      </div>

      {entryEditor && (
        <EntryEditor
          initial={entryEditor.entry}
          categorySlug={entryEditor.categorySlug}
          categoryLabel={categories.find((c) => c.slug === entryEditor.categorySlug)?.label ?? entryEditor.categorySlug}
          onClose={closeEntryEditor}
          onSave={handleSaveEntry}
        />
      )}

      {categoryEditor && (
        <CategoryEditor
          initial={categoryEditor === 'new' ? null : categoryEditor}
          onClose={closeCategoryEditor}
          onSave={handleSaveCategory}
        />
      )}
    </Page>
  );
};

// =====================================================================
// Fila de entrada
// =====================================================================

interface EntryRowProps {
  entry: BotKnowledgeEntry;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}

const EntryRow = ({ entry, onEdit, onToggle, onDelete }: EntryRowProps) => (
  <div className={`px-3 py-2.5 rounded-lg border border-gray-200 ${entry.isActive ? 'bg-white' : 'bg-gray-50'}`}>
    <div className="flex items-start gap-3">
      <button
        onClick={onToggle}
        title={entry.isActive ? 'Activa — clic para desactivar' : 'Inactiva — clic para activar'}
        aria-label={entry.isActive ? 'Desactivar entrada' : 'Activar entrada'}
        className="mt-0.5 flex-shrink-0"
      >
        <Badge tone={entry.isActive ? 'green' : 'gray'}>{entry.isActive ? 'Activa' : 'Inactiva'}</Badge>
      </button>
      <div className={`flex-1 min-w-0 ${entry.isActive ? '' : 'opacity-60'}`}>
        <p className="text-sm font-medium text-gray-900">{entry.title}</p>
        <p className="text-sm text-gray-600 mt-0.5 leading-snug">{entry.content}</p>
      </div>
      <div className="flex items-center flex-shrink-0">
        <IconButton title="Editar" tone="app" onClick={onEdit}><Edit3 className="w-4 h-4" /></IconButton>
        <IconButton title="Eliminar" tone="danger" onClick={onDelete}><Trash2 className="w-4 h-4" /></IconButton>
      </div>
    </div>
  </div>
);

// =====================================================================
// Editor de ENTRADA
// =====================================================================

interface EntryEditorProps {
  initial: BotKnowledgeEntry | null;
  categorySlug: string;
  categoryLabel: string;
  onClose: () => void;
  onSave: (input: KnowledgeInput, id?: number) => Promise<void>;
}

const EntryEditor = ({ initial, categorySlug, categoryLabel, onClose, onSave }: EntryEditorProps) => {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [content, setContent] = useState(initial?.content ?? '');
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!title.trim() || !content.trim()) {
      setError('Título y contenido son obligatorios.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(
        {
          category: categorySlug,
          title: title.trim(),
          content: content.trim(),
          isActive,
          sortOrder: initial?.sortOrder ?? 0,
        },
        initial?.id
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.');
      setSaving(false);
    }
  };

  return (
    <Dialog open onClose={onClose} title={`${initial ? 'Editar' : 'Nueva'} entrada`} description={categoryLabel} footer={<ModalFooter onClose={onClose} onSubmit={submit} saving={saving} />}>
      <div className="space-y-4">
        <Field label="Título corto" required>
          <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Política de envíos" autoFocus />
        </Field>
        <Field label="Contenido (lo que el bot leerá)" required hint="Sé específico y honesto. Una idea por entrada.">
          <TextArea value={content} onChange={(e) => setContent(e.target.value)} rows={6} className="resize-none" />
        </Field>
        <Checkbox label="Activa (el bot la usa)" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
        {error && <Alert tone="error">{error}</Alert>}
      </div>
    </Dialog>
  );
};

// =====================================================================
// Editor de CATEGORÍA
// =====================================================================

interface CategoryEditorProps {
  initial: KnowledgeCategory | null;
  onClose: () => void;
  onSave: (input: CategoryInput, id?: number) => Promise<void>;
}

const EMOJI_PRESETS = ['📁', '🏢', '🎭', '🧵', '📏', '🎨', '🚚', '↩️', '💳', '💰', '❓', '📝', '🛒', '⭐', '🔥', '🎁'];

const CategoryEditor = ({ initial, onClose, onSave }: CategoryEditorProps) => {
  const [label, setLabel] = useState(initial?.label ?? '');
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [emoji, setEmoji] = useState(initial?.emoji ?? '📁');
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!label.trim()) {
      setError('La etiqueta es obligatoria.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload: CategoryInput = {
        label: label.trim(),
        description: description.trim() || null,
        emoji: emoji.trim() || null,
        isActive,
      };
      // Solo enviamos slug si el usuario lo escribió explícitamente.
      if (slug.trim()) payload.slug = slug.trim();
      await onSave(payload, initial?.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.');
      setSaving(false);
    }
  };

  return (
    <Dialog open onClose={onClose} title={initial ? 'Editar categoría' : 'Nueva categoría'} description={initial?.label} footer={<ModalFooter onClose={onClose} onSubmit={submit} saving={saving} />}>
      <div className="space-y-4">
        <Field label="Nombre de la categoría" required>
          <TextInput value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ej. Promociones del mes" autoFocus />
        </Field>

        <Field label="Identificador (slug)" hint="Opcional. Solo minúsculas, números y guiones; si lo dejas vacío se arma del nombre.">
          <TextInput
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
            placeholder="se_genera_solo"
            className="font-mono"
          />
        </Field>

        <Field label="Descripción corta">
          <TextInput value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Para qué sirve esta categoría" />
        </Field>

        <Field label="Emoji">
          <div className="flex items-start gap-3">
            <TextInput value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={4} className="!w-16 text-center text-lg" aria-label="Emoji" />
            <div className="flex flex-wrap gap-1">
              {EMOJI_PRESETS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEmoji(e)}
                  className={`w-9 h-9 rounded-lg text-base border transition-colors ${emoji === e ? 'border-app-500 bg-app-50' : 'border-transparent hover:bg-gray-100'}`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        </Field>

        <Checkbox label="Activa (visible en la lista)" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />

        {error && <Alert tone="error">{error}</Alert>}
      </div>
    </Dialog>
  );
};

// =====================================================================
// Pie de los modales
// =====================================================================

const ModalFooter = ({ onClose, onSubmit, saving }: { onClose: () => void; onSubmit: () => void; saving: boolean }) => (
  <>
    <Button variant="secondary" onClick={onClose}>Cancelar</Button>
    <Button onClick={onSubmit} isLoading={saving} icon={!saving ? <Save className="w-4 h-4" /> : undefined}>Guardar</Button>
  </>
);

export default KnowledgePage;
