import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/shared/PageHeader';
import { Spinner } from '../components/ui';
import { CustomizerStudio } from '../components/customizer/CustomizerStudio';
import { ModelPicker } from '../components/customizer/ModelPicker';
import { useCustomizer } from '../components/customizer/useCustomizer';

/** /customize: elegir modelo → estudio. ?template=ID entra directo; ?edit=ITEM edita un ítem del carrito. */
export const CustomizerPage = () => {
  const navigate = useNavigate();
  const api = useCustomizer();
  const name = api.template?.name.replace(/\s+personalizable$/i, '');

  return (
    <div className="min-h-screen bg-gray-50">
      {api.isEditMode ? (
        <PageHeader title={`Editar diseño${name ? `: ${name}` : ''}`} subtitle="Los cambios se guardan en tu carrito" backTo="/cart" backLabel="Carrito" />
      ) : api.template ? (
        <PageHeader title={`Personaliza tu ${name?.toLowerCase()}`} subtitle="Elige talla, sube tu diseño y mira cómo queda" backTo="/customize" backLabel="Personalizador" />
      ) : (
        <PageHeader title="Personalizador" subtitle="Crea una prenda única con tu diseño" backLabel="Ver catálogo" onBack={() => navigate('/catalog')} />
      )}

      {api.template ? (
        api.zonesReady ? <CustomizerStudio api={api} /> : <div className="py-24"><Spinner label="Preparando el estudio…" /></div>
      ) : api.pendingTemplate ? (
        <div className="py-24"><Spinner label="Cargando…" /></div>
      ) : (
        <ModelPicker templates={api.templates} loading={api.loadingTemplates} onPick={api.selectTemplate} />
      )}
    </div>
  );
};
