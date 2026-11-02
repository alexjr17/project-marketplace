import { useState } from 'react';
import { useSettings } from '../../../context/SettingsContext';
import {
  Page, PageHeader, Card, CardTitle, Button, TextInput, ColorInput, Field, FormActions, FormGrid, SettingsSection, Switch, toast,
} from '../../../components/ui';
import { APP_LABELS, DEFAULT_APP_COLORS, resolveAppColor, type AppColors } from '../../../theme/appTheme';
import type { AppearanceSettings } from '../../../types/settings';
import { BRAND_COLOR_PRESETS, THEME_PRESETS } from '../../../types/settings';
import { Palette, Save, LayoutGrid, RotateCcw } from 'lucide-react';

const PANEL_APPS = Object.keys(DEFAULT_APP_COLORS) as (keyof AppColors)[];

const gradient = (c: { primary: string; secondary: string; accent: string }, dir = 'to right') =>
  `linear-gradient(${dir}, ${c.primary}, ${c.secondary}, ${c.accent})`;

export const SettingsAppearancePage = () => {
  const { settings, updateAppearanceSettings } = useSettings();
  const [appearanceForm, setAppearanceForm] = useState<AppearanceSettings>(settings.appearance);

  const [saving, setSaving] = useState(false);

  const handleSaveAppearance = async () => {
    setSaving(true);
    try {
      await updateAppearanceSettings(appearanceForm);
      toast.success('Configuración de apariencia guardada');
    } catch {
      toast.error('No se pudo guardar la apariencia');
    } finally {
      setSaving(false);
    }
  };

  const setBrand = (patch: Partial<AppearanceSettings['brandColors']>) =>
    setAppearanceForm({ ...appearanceForm, brandColors: { ...appearanceForm.brandColors, ...patch } });

  const appColor = (app: keyof AppColors) => resolveAppColor(app, appearanceForm);
  const setAppColor = (app: keyof AppColors, color: string) =>
    setAppearanceForm({ ...appearanceForm, appColors: { ...appearanceForm.appColors, [app]: color } });

  return (
    <Page>
      <PageHeader icon={Palette} title="Apariencia" subtitle="Colores y estilos del sitio y de cada aplicación" />

      <div className="space-y-5">
        {/* Colores por aplicación */}
        <Card>
          <CardTitle
            icon={LayoutGrid}
            actions={
              <Button variant="ghost" size="sm" icon={<RotateCcw className="w-4 h-4" />} onClick={() => setAppearanceForm({ ...appearanceForm, appColors: { ...DEFAULT_APP_COLORS } })}>
                Restaurar
              </Button>
            }
          >
            Colores por aplicación
          </CardTitle>
          <p className="text-sm text-gray-500 mb-4">
            Cada app del panel tiene su color de acento (botones, menú, iconos). La Tienda usa el color primario de la marca.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {PANEL_APPS.map((app) => (
              <div key={app} className="rounded-lg border border-gray-200 p-3">
                <p className="text-sm font-medium text-gray-900 mb-2">{APP_LABELS[app]}</p>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    aria-label={`Color de ${APP_LABELS[app]}`}
                    value={appColor(app)}
                    onChange={(e) => setAppColor(app, e.target.value)}
                    className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer flex-shrink-0"
                  />
                  <TextInput value={appColor(app)} onChange={(e) => setAppColor(app, e.target.value)} className="font-mono" maxLength={7} />
                </div>
                <span className="mt-3 flex h-8 items-center justify-center rounded-lg text-white text-sm font-medium" style={{ backgroundColor: appColor(app) }}>
                  Botón de ejemplo
                </span>
                {appColor(app).toLowerCase() !== DEFAULT_APP_COLORS[app] && (
                  <button type="button" onClick={() => setAppColor(app, DEFAULT_APP_COLORS[app])} className="mt-2 text-xs text-gray-500 hover:text-gray-800">
                    Por defecto: <span className="font-mono">{DEFAULT_APP_COLORS[app]}</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </Card>

        <div>
          <SettingsSection title="Temas predefinidos" description="Aplica de una vez los colores de marca, de botones y del pie de la tienda.">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {THEME_PRESETS.map((theme, index) => {
                const active = appearanceForm.brandColors.primary === theme.brandColors.primary;
                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setAppearanceForm({ ...appearanceForm, brandColors: theme.brandColors, buttonColor: theme.buttonColor, footerBgColor: theme.footerBgColor })}
                    className={`p-3 rounded-lg border text-left transition-colors ${active ? 'border-app-500 ring-2 ring-app-200' : 'border-gray-200 hover:border-gray-300'}`}
                  >
                    <div className="h-10 rounded-md mb-2" style={{ background: gradient(theme.brandColors) }} />
                    <span className="text-sm font-medium text-gray-700">{theme.name}</span>
                  </button>
                );
              })}
            </div>
          </SettingsSection>

          <SettingsSection title="Colores de marca" description="Gradiente del nombre del sitio y de los elementos destacados. El primario es también el color de acento de la Tienda.">
            <Field label="Paletas de gradiente">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {BRAND_COLOR_PRESETS.map((preset, index) => {
                  const active = appearanceForm.brandColors.primary === preset.primary && appearanceForm.brandColors.secondary === preset.secondary;
                  return (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setAppearanceForm({ ...appearanceForm, brandColors: { primary: preset.primary, secondary: preset.secondary, accent: preset.accent } })}
                      className={`p-3 rounded-lg border text-left transition-colors ${active ? 'border-app-500 ring-2 ring-app-200' : 'border-gray-200 hover:border-gray-300'}`}
                    >
                      <div className="h-7 rounded-md mb-2" style={{ background: gradient(preset) }} />
                      <span className="text-xs font-medium text-gray-700">{preset.name}</span>
                    </button>
                  );
                })}
              </div>
            </Field>
            <FormGrid cols={3}>
              <Field label="Primario"><ColorInput value={appearanceForm.brandColors.primary} onChange={(v) => setBrand({ primary: v })} /></Field>
              <Field label="Secundario"><ColorInput value={appearanceForm.brandColors.secondary} onChange={(v) => setBrand({ secondary: v })} /></Field>
              <Field label="Acento"><ColorInput value={appearanceForm.brandColors.accent} onChange={(v) => setBrand({ accent: v })} /></Field>
            </FormGrid>
            <Field label="Vista previa">
              <div className="flex items-center gap-3 rounded-lg border border-gray-200 p-3">
                <div className="w-10 h-10 rounded-lg flex-shrink-0" style={{ background: gradient(appearanceForm.brandColors, 'to bottom right') }} />
                <span
                  className="text-2xl font-black truncate"
                  style={{ background: gradient(appearanceForm.brandColors), WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}
                >
                  {settings.general.siteName || 'StylePrint'}
                </span>
              </div>
            </Field>
          </SettingsSection>

          <SettingsSection title="Botones de la tienda" description="Color principal de botones y elementos interactivos de la tienda.">
            <div className="flex flex-col sm:flex-row sm:items-end gap-3">
              <Field label="Color de botones" className="sm:w-56">
                <ColorInput value={appearanceForm.buttonColor} onChange={(v) => setAppearanceForm({ ...appearanceForm, buttonColor: v })} />
              </Field>
              <span className="inline-flex h-10 items-center justify-center rounded-lg px-5 text-sm font-medium text-white" style={{ backgroundColor: appearanceForm.buttonColor }}>
                Ejemplo de botón
              </span>
            </div>
          </SettingsSection>

          <SettingsSection title="Encabezado" description="Opciones de la barra superior de la tienda.">
            <Switch
              checked={!!appearanceForm.showSlogan}
              onChange={(v) => setAppearanceForm({ ...appearanceForm, showSlogan: v })}
              label="Mostrar slogan"
              description="Muestra el slogan debajo del nombre en el encabezado."
            />
          </SettingsSection>

          <SettingsSection title="Pie de página" description="Color y contenido del pie de la tienda.">
            <div className="flex flex-col sm:flex-row sm:items-end gap-3">
              <Field label="Color de fondo" className="sm:w-56">
                <ColorInput value={appearanceForm.footerBgColor} onChange={(v) => setAppearanceForm({ ...appearanceForm, footerBgColor: v })} />
              </Field>
              <span className="h-10 w-24 rounded-lg border border-gray-200" style={{ backgroundColor: appearanceForm.footerBgColor }} />
            </div>
            <Switch
              checked={!!appearanceForm.showSocialInFooter}
              onChange={(v) => setAppearanceForm({ ...appearanceForm, showSocialInFooter: v })}
              label="Mostrar redes sociales"
              description="Muestra los iconos de redes sociales en el pie."
            />
            <Switch
              checked={!!appearanceForm.showScheduleInFooter}
              onChange={(v) => setAppearanceForm({ ...appearanceForm, showScheduleInFooter: v })}
              label="Mostrar horarios"
              description="Muestra la sección de horarios de atención en el pie."
            />
          </SettingsSection>
        </div>
      </div>

      <FormActions sticky>
        <Button onClick={handleSaveAppearance} isLoading={saving} icon={<Save className="w-4 h-4" />}>
          Guardar cambios
        </Button>
      </FormActions>
    </Page>
  );
};
