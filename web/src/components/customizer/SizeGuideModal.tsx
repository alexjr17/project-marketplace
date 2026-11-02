import { X, Ruler, Info } from 'lucide-react';
import type { SizeChart } from '../../data/sizeCharts';

interface SizeGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  sizeChart: SizeChart;
}

export const SizeGuideModal = ({ isOpen, onClose, sizeChart }: SizeGuideModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="bg-app-600 text-white px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <Ruler className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Guía de Tallas</h2>
                <p className="text-xs text-white/80">{sizeChart.productName}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="hover:bg-white/20 p-2 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(85vh-80px)]">
          {/* Guía de medición */}
          <div className="mb-5 p-4 bg-app-50 border border-app-200 rounded-lg">
            <div className="flex items-start gap-2">
              <Info className="w-5 h-5 text-app-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-gray-900 mb-1">Cómo medir correctamente</h3>
                <p className="text-sm text-gray-700">{sizeChart.guide}</p>
              </div>
            </div>
          </div>

          {/* Tabla de tallas */}
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full border-collapse bg-white">
              <thead>
                <tr className="bg-gray-50 text-gray-700 border-b border-gray-200">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide border-r border-gray-200">
                    Talla
                  </th>
                  {sizeChart.sizes[0].chest !== undefined && (
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide border-r border-gray-200">
                      Pecho
                    </th>
                  )}
                  {sizeChart.sizes[0].length !== undefined && (
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide border-r border-gray-200">
                      Largo
                    </th>
                  )}
                  {sizeChart.sizes[0].shoulders !== undefined && (
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide border-r border-gray-200">
                      Hombros
                    </th>
                  )}
                  {sizeChart.sizes[0].sleeves !== undefined && (
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide border-r border-gray-200">
                      Manga
                    </th>
                  )}
                  {sizeChart.sizes[0].diameter !== undefined && (
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide border-r border-gray-200">
                      Diámetro
                    </th>
                  )}
                  {sizeChart.sizes[0].height !== undefined && (
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide border-r border-gray-200">
                      Altura
                    </th>
                  )}
                  {sizeChart.sizes[0].width !== undefined && (
                    <th className="px-4 py-3 text-left font-semibold">
                      Ancho
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {sizeChart.sizes.map((size, index) => (
                  <tr
                    key={size.size}
                    className={`${
                      index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                    } hover:bg-app-50 transition-colors`}
                  >
                    <td className="px-4 py-3 font-bold text-app-600 border-r border-gray-200">
                      {size.size}
                    </td>
                    {size.chest !== undefined && (
                      <td className="px-4 py-3 border-r border-gray-200">{size.chest} cm</td>
                    )}
                    {size.length !== undefined && (
                      <td className="px-4 py-3 border-r border-gray-200">{size.length} cm</td>
                    )}
                    {size.shoulders !== undefined && (
                      <td className="px-4 py-3 border-r border-gray-200">{size.shoulders} cm</td>
                    )}
                    {size.sleeves !== undefined && (
                      <td className="px-4 py-3 border-r border-gray-200">{size.sleeves} cm</td>
                    )}
                    {size.diameter !== undefined && (
                      <td className="px-4 py-3 border-r border-gray-200">{size.diameter} cm</td>
                    )}
                    {size.height !== undefined && (
                      <td className="px-4 py-3 border-r border-gray-200">{size.height} cm</td>
                    )}
                    {size.width !== undefined && (
                      <td className="px-4 py-3">{size.width} cm</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Nota adicional */}
          <div className="mt-5 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-gray-700">
              <strong className="text-amber-700">Nota:</strong> Las medidas pueden variar ligeramente (±2cm) según el método de medición y el ajuste deseado.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full h-11 bg-app-600 hover:bg-app-700 text-white font-medium px-6 rounded-lg transition-colors"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
