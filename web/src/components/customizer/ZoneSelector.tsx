import type { PrintZone, PrintZoneConfig } from '../../types/product';
import { Maximize2, Square, Circle } from 'lucide-react';

interface ZoneSelectorProps {
  zones: PrintZoneConfig[];
  selectedZone: PrintZone;
  onZoneChange: (zone: PrintZone) => void;
}

const getZoneIcon = (zoneId: string) => {
  if (zoneId.includes('large') || zoneId.includes('grande')) {
    return Maximize2;
  }
  if (zoneId.includes('small') || zoneId.includes('sleeve')) {
    return Circle;
  }
  return Square;
};

const getZoneColor = (zoneId: string) => {
  if (zoneId.includes('front')) return 'bg-blue-50 border-blue-300 text-blue-700';
  if (zoneId.includes('back')) return 'bg-green-50 border-green-300 text-green-700';
  if (zoneId.includes('sleeve')) return 'bg-amber-50 border-amber-300 text-amber-700';
  return 'bg-app-50 border-app-300 text-app-700';
};

export const ZoneSelector = ({ zones, selectedZone, onZoneChange }: ZoneSelectorProps) => {
  return (
    <div className="space-y-3">
      <label className="block text-sm font-semibold text-gray-900">Zonas de Impresión</label>
      <div className="space-y-2">
        {zones.map((zone) => {
          const Icon = getZoneIcon(zone.id);
          const colorClass = getZoneColor(zone.id);
          const isSelected = selectedZone === zone.id;

          return (
            <button
              key={zone.id}
              onClick={() => onZoneChange(zone.id)}
              className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all hover:shadow-md ${
                isSelected
                  ? 'border-app-600 bg-app-50 shadow-md'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className={`p-2 rounded-lg border ${colorClass}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 text-left">
                <div className="font-semibold text-gray-900 text-sm">{zone.name}</div>
                <div className="text-xs text-gray-500">
                  Máx: {zone.maxWidth}x{zone.maxHeight}px
                </div>
              </div>
              {isSelected && (
                <div className="w-2 h-2 rounded-full bg-app-600"></div>
              )}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-gray-500 mt-2">
        Selecciona la zona donde quieres aplicar tu diseño
      </p>
    </div>
  );
};
