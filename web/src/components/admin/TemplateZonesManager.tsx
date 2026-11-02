import { useState, useEffect } from 'react';
import { templateZonesService, type TemplateZone, type CreateTemplateZoneDto } from '../../services/template-zones.service';
import { zoneTypesService, type ZoneType } from '../../services/zone-types.service';
import { Button, toast, useConfirm } from '../ui';

interface TemplateZonesManagerProps {
  templateId: number;
}

export const TemplateZonesManager = ({ templateId }: TemplateZonesManagerProps) => {
  const confirm = useConfirm();
  const [zones, setZones] = useState<TemplateZone[]>([]);
  const [zoneTypes, setZoneTypes] = useState<ZoneType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showZoneForm, setShowZoneForm] = useState(false);
  const [editingZone, setEditingZone] = useState<TemplateZone | null>(null);

  const [zoneFormData, setZoneFormData] = useState<CreateTemplateZoneDto>({
    templateId,
    zoneTypeId: 0,
    name: '',
    positionX: 0,
    positionY: 0,
    maxWidth: 100,
    maxHeight: 100,
    price: 0,
    isRequired: false,
    sortOrder: 0,
  });

  useEffect(() => {
    loadData();
  }, [templateId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [zonesData, typesData] = await Promise.all([
        templateZonesService.getByTemplateId(templateId),
        zoneTypesService.getAll(),
      ]);

      const validZones = Array.isArray(zonesData) ? zonesData : [];
      const validTypes = Array.isArray(typesData) ? typesData : [];

      setZones(validZones);
      setZoneTypes(validTypes.filter(t => t.isActive));
    } catch (err) {
      setError('Error al cargar las zonas');
      setZones([]);
      setZoneTypes([]);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateZone = async () => {
    if (!zoneFormData.zoneTypeId || zoneFormData.zoneTypeId === 0) {
      toast.error('Debe seleccionar un tipo de zona');
      return;
    }

    if (!zoneFormData.name.trim()) {
      toast.error('El nombre de la zona es requerido');
      return;
    }

    const selectedType = zoneTypes.find(t => t.id === zoneFormData.zoneTypeId);
    const zoneSlug = selectedType?.slug || 'zone';

    try {
      await templateZonesService.create({
        ...zoneFormData,
        zoneId: `${zoneSlug}-${Date.now()}`,
      });
      await loadData();
      resetZoneForm();
    } catch (err) {
      toast.error('Error al crear la zona');
      console.error(err);
    }
  };

  const handleUpdateZone = async () => {
    if (!editingZone) return;

    try {
      await templateZonesService.update(editingZone.id, {
        zoneTypeId: zoneFormData.zoneTypeId,
        name: zoneFormData.name,
        positionX: zoneFormData.positionX,
        positionY: zoneFormData.positionY,
        maxWidth: zoneFormData.maxWidth,
        maxHeight: zoneFormData.maxHeight,
        price: zoneFormData.price,
        isRequired: zoneFormData.isRequired,
        sortOrder: zoneFormData.sortOrder,
      });
      await loadData();
      resetZoneForm();
    } catch (err) {
      toast.error('Error al actualizar la zona');
      console.error(err);
    }
  };

  const handleDeleteZone = async (zoneId: number) => {
    if (!(await confirm({ title: '¿Estás seguro de eliminar esta zona?', tone: 'danger' }))) return;

    try {
      await templateZonesService.delete(zoneId);
      await loadData();
    } catch (err) {
      toast.error('Error al eliminar la zona');
      console.error(err);
    }
  };

  const handleEditZone = (zone: TemplateZone) => {
    setEditingZone(zone);
    setZoneFormData({
      templateId,
      zoneTypeId: zone.zoneTypeId,
      name: zone.name,
      positionX: zone.positionX,
      positionY: zone.positionY,
      maxWidth: zone.maxWidth,
      maxHeight: zone.maxHeight,
      price: zone.price,
      isRequired: zone.isRequired,
      sortOrder: zone.sortOrder,
    });
    setShowZoneForm(true);
  };

  const resetZoneForm = () => {
    setShowZoneForm(false);
    setEditingZone(null);
    setZoneFormData({
      templateId,
      zoneTypeId: 0,
      name: '',
      positionX: 0,
      positionY: 0,
      maxWidth: 100,
      maxHeight: 100,
      price: 0,
      isRequired: false,
      sortOrder: 0,
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg">Cargando zonas...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Zonas del Template (Editor de Texto)</h3>
        <Button
          type="button"
          onClick={() => setShowZoneForm(true)}
          variant="secondary"
        >
          Agregar Zona
        </Button>
      </div>

      {showZoneForm && (
        <div className="bg-gray-50 border border-gray-300 rounded-lg p-4">
          <h4 className="text-md font-semibold mb-3">
            {editingZone ? 'Editar Zona' : 'Nueva Zona'}
          </h4>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo de Zona *
              </label>
              <select
                value={zoneFormData.zoneTypeId}
                onChange={(e) => setZoneFormData({ ...zoneFormData, zoneTypeId: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-app-200 focus:border-app-500"
                required
              >
                <option value={0}>Seleccionar tipo...</option>
                {zoneTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre *
              </label>
              <input
                type="text"
                value={zoneFormData.name}
                onChange={(e) => setZoneFormData({ ...zoneFormData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-app-200 focus:border-app-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Posición X (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={zoneFormData.positionX}
                onChange={(e) => setZoneFormData({ ...zoneFormData, positionX: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-app-200 focus:border-app-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Posición Y (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={zoneFormData.positionY}
                onChange={(e) => setZoneFormData({ ...zoneFormData, positionY: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-app-200 focus:border-app-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ancho Máximo (%)
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={zoneFormData.maxWidth}
                onChange={(e) => setZoneFormData({ ...zoneFormData, maxWidth: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-app-200 focus:border-app-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Alto Máximo (%)
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={zoneFormData.maxHeight}
                onChange={(e) => setZoneFormData({ ...zoneFormData, maxHeight: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-app-200 focus:border-app-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Precio ($)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={zoneFormData.price}
                onChange={(e) => setZoneFormData({ ...zoneFormData, price: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-app-200 focus:border-app-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Orden
              </label>
              <input
                type="number"
                value={zoneFormData.sortOrder}
                onChange={(e) => setZoneFormData({ ...zoneFormData, sortOrder: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-app-200 focus:border-app-500"
              />
            </div>

            <div className="col-span-2">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={zoneFormData.isRequired}
                  onChange={(e) => setZoneFormData({ ...zoneFormData, isRequired: e.target.checked })}
                  className="w-4 h-4 text-app-500 border-gray-300 rounded focus:ring-app-200 focus:border-app-500"
                />
                <span className="text-sm font-medium text-gray-700">Zona requerida</span>
              </label>
            </div>
          </div>

          <div className="flex gap-3 mt-4">
            <Button
              type="button"
              onClick={resetZoneForm}
              variant="secondary"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={editingZone ? handleUpdateZone : handleCreateZone}
              variant="primary"
            >
              {editingZone ? 'Actualizar' : 'Crear'}
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {zones.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">
            No hay zonas definidas para este template
          </p>
        ) : (
          zones.map((zone) => (
            <div key={zone.id} className="bg-white border border-gray-300 rounded-lg p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h4 className="font-semibold">{zone.name}</h4>
                  <p className="text-sm text-gray-600">
                    Tipo: {zone.zoneType?.name} | Posición: ({zone.positionX}%, {zone.positionY}%) | Tamaño: {zone.maxWidth}x{zone.maxHeight}%
                  </p>
                  <p className="text-sm font-medium text-green-600 mt-1">
                    Precio: ${zone.price.toLocaleString()}
                  </p>
                  {zone.isRequired && (
                    <span className="inline-block mt-1 px-2 py-0.5 bg-app-100 text-app-800 text-xs rounded">
                      Requerida
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEditZone(zone)}
                    className="text-app-700 hover:text-app-900 text-sm"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDeleteZone(zone.id)}
                    className="text-red-600 hover:text-red-900 text-sm"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
