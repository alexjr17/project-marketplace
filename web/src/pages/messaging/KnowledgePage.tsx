import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Edit3,
  FolderPlus,
  Loader2,
  Plus,
  Save,
  Send,
  Settings,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import botKnowledgeService, {
  type CategoryInput,
  type KnowledgeInput,
} from '../../services/botKnowledge.service';
import type { BotKnowledgeEntry, KnowledgeCategory } from '../../types/messaging';
import { useSettings } from '../../context/SettingsContext';

// =====================================================================

export const KnowledgePage = () => {
  const { settings } = useSettings();
  const brandColors = settings.appearance?.brandColors || settings.general.brandColors || {
    primary: '#7c3aed',
    secondary: '#ec4899',
    accent: '#f59e0b',
  };
  const gradient = `linear-gradient(135deg, ${brandColors.primary}, ${brandColors.secondary})`;

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
    if (!confirm(`¿Eliminar "${entry.title}"?`)) return;
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
      alert(`No puedes eliminar "${cat.label}" porque tiene ${cat.entriesCount} entradas. Muévelas o elimínalas primero.`);
      return;
    }
    if (!confirm(`¿Eliminar la categoría "${cat.label}"?`)) return;
    try {
      await botKnowledgeService.removeCategory(cat.id);
      setCategories((prev) => prev.filter((c) => c.id !== cat.id));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'No se pudo eliminar');
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
    <div className="h-[calc(100vh-3.5rem)] overflow-y-auto bg-gray-50">
      <div className="max-w-5xl mx-auto p-6 space-y-5">
        <header className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Sparkles className="w-6 h-6" style={{ color: brandColors.primary }} />
              Entrenar al bot
            </h1>
            <p className="text-sm text-gray-500 mt-1 max-w-2xl">
              Todo lo que escribas acá se inyecta en el prompt del modelo cuando responde un cliente.
              Mientras más específico y honesto, mejor responde. {activeCount} de {entries.length} entradas activas, {categories.length} categorías.
            </p>
          </div>
          <button
            onClick={openNewCategory}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50"
          >
            <FolderPlus className="w-4 h-4" /> Nueva categoría
          </button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* ===== Lista de categorías ===== */}
          <div className="lg:col-span-2 space-y-3">
            {loading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : visibleCategories.length === 0 ? (
              <div className="bg-white border border-dashed border-gray-300 rounded-xl p-10 text-center text-sm text-gray-400">
                No hay categorías. Crea la primera con el botón "Nueva categoría".
              </div>
            ) : (
              visibleCategories.map((cat) => {
                const items = byCategory[cat.slug] ?? [];
                const open = expanded[cat.slug];
                return (
                  <section key={cat.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
                      <button
                        onClick={() => toggleCategory(cat.slug)}
                        className="flex items-center gap-3 flex-1 text-left min-w-0"
                      >
                        <span className="text-xl">{cat.emoji || '📁'}</span>
                        <div className="flex-1 min-w-0">
                          <h2 className="font-semibold text-gray-900 text-sm truncate">{cat.label}</h2>
                          {cat.description && (
                            <p className="text-[11px] text-gray-500 truncate">{cat.description}</p>
                          )}
                        </div>
                        <span className="text-xs text-gray-400 flex-shrink-0">
                          {items.filter((i) => i.isActive).length}/{items.length}
                        </span>
                        {open ? (
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        <button
                          onClick={() => openEditCategory(cat)}
                          className="p-1.5 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded"
                          title="Editar categoría"
                        >
                          <Settings className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteCategory(cat)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded disabled:opacity-40 disabled:cursor-not-allowed"
                          disabled={cat.entriesCount > 0}
                          title={
                            cat.entriesCount > 0
                              ? `Tiene ${cat.entriesCount} entradas — muévelas antes`
                              : 'Eliminar categoría'
                          }
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {open && (
                      <div className="border-t border-gray-100 p-3 space-y-2">
                        {items.length === 0 ? (
                          <p className="text-xs text-gray-400 italic px-2">Aún no hay entradas en esta categoría.</p>
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
                          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border-2 border-dashed border-gray-200 hover:border-violet-300 hover:bg-violet-50/30 text-gray-500 transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" /> Agregar entrada
                        </button>
                      </div>
                    )}
                  </section>
                );
              })
            )}
          </div>

          {/* ===== Panel de prueba en vivo (sticky) ===== */}
          <aside className="lg:col-span-1">
            <div className="sticky top-4 bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-3">
              <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-1.5">
                <Send className="w-4 h-4" style={{ color: brandColors.primary }} />
                Probar al bot
              </h3>
              <p className="text-[11px] text-gray-500">
                Escribe lo que escribiría un cliente. El bot usa el conocimiento activo actual.
              </p>

              <div>
                <label className="block text-[11px] font-medium text-gray-700 mb-1">Nombre del cliente</label>
                <input
                  value={testContactName}
                  onChange={(e) => setTestContactName(e.target.value)}
                  placeholder="Camila"
                  className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-gray-700 mb-1">Mensaje del cliente</label>
                <textarea
                  value={testText}
                  onChange={(e) => setTestText(e.target.value)}
                  rows={3}
                  placeholder="Ej. Tienen talla XL en sueter oversize?"
                  className="w-full rounded-lg border border-gray-200 px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200 resize-none"
                />
              </div>

              <button
                onClick={handleTest}
                disabled={testBusy || !testText.trim()}
                className="w-full inline-flex items-center justify-center gap-2 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50"
                style={{ background: gradient }}
              >
                {testBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Probar respuesta
              </button>

              {testResult && (
                <div className="space-y-1.5 pt-3 border-t border-gray-100">
                  <p className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold">
                    Respuesta del bot ({testResult.provider})
                  </p>
                  <div className="text-sm bg-violet-50 border border-violet-100 text-gray-800 rounded-lg p-3 whitespace-pre-wrap">
                    {testResult.reply}
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>

      {entryEditor && (
        <EntryEditor
          initial={entryEditor.entry}
          categorySlug={entryEditor.categorySlug}
          categoryLabel={categories.find((c) => c.slug === entryEditor.categorySlug)?.label ?? entryEditor.categorySlug}
          gradient={gradient}
          onClose={closeEntryEditor}
          onSave={handleSaveEntry}
        />
      )}

      {categoryEditor && (
        <CategoryEditor
          initial={categoryEditor === 'new' ? null : categoryEditor}
          gradient={gradient}
          onClose={closeCategoryEditor}
          onSave={handleSaveCategory}
        />
      )}
    </div>
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
  <div
    className={`p-2.5 rounded-lg border ${
      entry.isActive ? 'border-gray-200 bg-white' : 'border-gray-200 bg-gray-50 opacity-60'
    }`}
  >
    <div className="flex items-start gap-2">
      <button
        onClick={onToggle}
        title={entry.isActive ? 'Activa — click para desactivar' : 'Inactiva — click para activar'}
        className={`mt-0.5 w-3 h-3 rounded-full flex-shrink-0 ${entry.isActive ? 'bg-green-500' : 'bg-gray-300'}`}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">{entry.title}</p>
        <p className="text-xs text-gray-600 mt-0.5 leading-snug">{entry.content}</p>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={onEdit}
          className="p-1.5 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded"
          title="Editar"
        >
          <Edit3 className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
          title="Eliminar"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
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
  gradient: string;
  onClose: () => void;
  onSave: (input: KnowledgeInput, id?: number) => Promise<void>;
}

const EntryEditor = ({ initial, categorySlug, categoryLabel, gradient, onClose, onSave }: EntryEditorProps) => {
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
    <ModalShell title={`${initial ? 'Editar' : 'Nueva'} entrada · ${categoryLabel}`} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Título corto">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej. Política de envíos"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
          />
        </Field>
        <Field label="Contenido (lo que el bot leerá)">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={6}
            placeholder="Sé específico y honesto. Una idea por entrada."
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200 resize-none"
          />
        </Field>
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="rounded"
          />
          <span className="text-sm text-gray-700">Activa (el bot la usa)</span>
        </label>
        {error && <ErrorBox msg={error} />}
      </div>
      <ModalFooter onClose={onClose} onSubmit={submit} saving={saving} gradient={gradient} />
    </ModalShell>
  );
};

// =====================================================================
// Editor de CATEGORÍA
// =====================================================================

interface CategoryEditorProps {
  initial: KnowledgeCategory | null;
  gradient: string;
  onClose: () => void;
  onSave: (input: CategoryInput, id?: number) => Promise<void>;
}

const EMOJI_PRESETS = ['📁', '🏢', '🎭', '🧵', '📏', '🎨', '🚚', '↩️', '💳', '💰', '❓', '📝', '🛒', '⭐', '🔥', '🎁'];

const CategoryEditor = ({ initial, gradient, onClose, onSave }: CategoryEditorProps) => {
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
    <ModalShell title={initial ? `Editar categoría · ${initial.label}` : 'Nueva categoría'} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Nombre de la categoría">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ej. Promociones del mes"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
          />
        </Field>

        <Field
          label={
            <>
              Identificador (slug)
              <span className="text-[10px] font-normal text-gray-400 ml-1">opcional, se genera solo</span>
            </>
          }
        >
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
            placeholder="se_genera_solo"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-200"
          />
          <p className="text-[10px] text-gray-400 mt-1">
            Solo letras minúsculas, números y guiones. Si lo dejas vacío, lo armamos del nombre.
          </p>
        </Field>

        <Field label="Descripción corta">
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Para qué sirve esta categoría"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
          />
        </Field>

        <Field label="Emoji">
          <div className="flex items-center gap-2 flex-wrap">
            <input
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              maxLength={4}
              className="w-16 rounded-lg border border-gray-200 px-2 py-2 text-center text-lg focus:outline-none focus:ring-2 focus:ring-violet-200"
            />
            <div className="flex flex-wrap gap-1">
              {EMOJI_PRESETS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEmoji(e)}
                  className={`w-7 h-7 rounded text-base hover:bg-gray-100 ${emoji === e ? 'bg-violet-100' : ''}`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        </Field>

        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="rounded"
          />
          <span className="text-sm text-gray-700">Activa (visible en la lista)</span>
        </label>

        {error && <ErrorBox msg={error} />}
      </div>
      <ModalFooter onClose={onClose} onSubmit={submit} saving={saving} gradient={gradient} />
    </ModalShell>
  );
};

// =====================================================================
// Helpers compartidos para los modales
// =====================================================================

const ModalShell = ({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) => (
  <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
    <div
      className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
        <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-5">{children}</div>
    </div>
  </div>
);

const Field = ({ label, children }: { label: React.ReactNode; children: React.ReactNode }) => (
  <div>
    <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
    {children}
  </div>
);

const ErrorBox = ({ msg }: { msg: string }) => (
  <div className="text-xs bg-red-50 text-red-700 border border-red-200 rounded p-2 flex items-start gap-1.5">
    <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
    <span>{msg}</span>
  </div>
);

const ModalFooter = ({
  onClose,
  onSubmit,
  saving,
  gradient,
}: {
  onClose: () => void;
  onSubmit: () => void;
  saving: boolean;
  gradient: string;
}) => (
  <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-end gap-2">
    <button
      onClick={onClose}
      className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 hover:bg-gray-50"
    >
      Cancelar
    </button>
    <button
      onClick={onSubmit}
      disabled={saving}
      className="inline-flex items-center gap-1.5 px-4 py-1.5 text-white text-sm font-medium rounded-lg disabled:opacity-50"
      style={{ background: gradient }}
    >
      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
      Guardar
    </button>
  </div>
);

export default KnowledgePage;
