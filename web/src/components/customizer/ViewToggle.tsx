import { RotateCw } from 'lucide-react';

interface ViewToggleProps {
  currentView: 'front' | 'back';
  onViewChange: (view: 'front' | 'back') => void;
}

export const ViewToggle = ({ currentView, onViewChange }: ViewToggleProps) => {
  return (
    <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
      <button
        onClick={() => onViewChange('front')}
        className={`flex-1 px-4 py-2 rounded-md font-semibold text-sm transition-all ${
          currentView === 'front'
            ? 'bg-white text-app-600 shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
        }`}
      >
        Frente
      </button>
      <button
        onClick={() => onViewChange('back')}
        className={`flex-1 px-4 py-2 rounded-md font-semibold text-sm transition-all ${
          currentView === 'back'
            ? 'bg-white text-app-600 shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
        }`}
      >
        Espalda
      </button>
      <button
        onClick={() => onViewChange(currentView === 'front' ? 'back' : 'front')}
        className="p-2 text-gray-600 hover:text-app-600 hover:bg-white rounded-md transition-all"
        title="Rotar vista"
      >
        <RotateCw className="w-5 h-5" />
      </button>
    </div>
  );
};
