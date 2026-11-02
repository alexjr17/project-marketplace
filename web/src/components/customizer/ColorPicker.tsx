import { useSettings } from '../../context/SettingsContext';

interface ColorPickerProps {
  colors: string[];
  selectedColor: string;
  onColorChange: (color: string) => void;
  label?: string;
}

export const ColorPicker = ({ colors, selectedColor, onColorChange, label = 'Color' }: ColorPickerProps) => {
  const { settings } = useSettings();

  // Colores de marca dinámicos
  const brandColors = settings.appearance?.brandColors || settings.general.brandColors || {
    primary: '#7c3aed',
    secondary: '#ec4899',
    accent: '#f59e0b',
  };

  return (
    <div>
      <span className="text-sm font-semibold text-gray-900 mb-2 block">{label}</span>
      <div className="flex flex-wrap gap-2">
        {colors.map((color) => (
          <button
            key={color}
            onClick={() => onColorChange(color)}
            className={`w-9 h-9 rounded-lg border-2 transition-all flex-shrink-0 ${
              selectedColor === color
                ? ''
                : 'border-gray-300 hover:border-gray-400'
            }`}
            style={{
              backgroundColor: color,
              ...(selectedColor === color ? {
                borderColor: brandColors.primary,
                boxShadow: `0 0 0 2px white, 0 0 0 4px ${brandColors.primary}`
              } : {})
            }}
            title={color}
          >
            {selectedColor === color && (
              <div className="w-full h-full flex items-center justify-center">
                <svg
                  className="w-4 h-4 text-white drop-shadow-lg"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="3"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path d="M5 13l4 4L19 7"></path>
                </svg>
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};
