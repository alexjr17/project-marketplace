import type { ReactNode } from 'react';
import { Dialog } from '../ui/Overlay';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: ReactNode;
  children: ReactNode;
  /** Botones del pie (Cancelar + acción principal). */
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

/** Modal estándar (envoltorio de `Dialog` de components/ui con la API de siempre). */
export const Modal = ({ isOpen, onClose, title = '', description, children, footer, size = 'md' }: ModalProps) => (
  <Dialog open={isOpen} onClose={onClose} title={title} description={description} footer={footer} size={size}>
    {children}
  </Dialog>
);
