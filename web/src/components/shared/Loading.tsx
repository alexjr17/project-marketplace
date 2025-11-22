import { Loader2 } from 'lucide-react';

interface LoadingProps {
  size?: 'sm' | 'md' | 'lg';
  fullScreen?: boolean;
  text?: string;
}

export const Loading = ({ size = 'md', fullScreen = false, text }: LoadingProps) => {
  const sizes = {
    sm: 'w-6 h-6',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
  };

  const spinner = (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <Loader2 className={`${sizes[size]} animate-spin text-primary`} />
        <div className="absolute inset-0 bg-primary blur-md opacity-30 animate-pulse"></div>
      </div>
      {text && <p className="text-gray-600 font-medium">{text}</p>}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-violet-50 to-pink-50 bg-opacity-95 flex items-center justify-center z-50 backdrop-blur-sm">
        {spinner}
      </div>
    );
  }

  return spinner;
};
