import { useState } from 'react';
import { Modal } from '../shared/Modal';
import { Button } from '../shared/Button';
import { Input } from '../shared/Input';
import { useAuth } from '../../context/AuthContext';
import { LogIn, UserPlus, Mail, ArrowLeft, Check, Eye, EyeOff } from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register';
}

type ModalMode = 'login' | 'register' | 'forgot';

export const LoginModal = ({ isOpen, onClose, initialMode = 'login' }: LoginModalProps) => {
  const { login, register, requestPasswordReset } = useAuth();
  const [mode, setMode] = useState<ModalMode>(initialMode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'login') {
        await login(formData.email, formData.password);
        onClose();
        setFormData({ email: '', password: '', name: '' });
      } else if (mode === 'register') {
        await register(formData.email, formData.password, formData.name);
        onClose();
        setFormData({ email: '', password: '', name: '' });
      } else if (mode === 'forgot') {
        await requestPasswordReset(formData.email);
        setForgotSuccess(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocurrió un error');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (newMode: ModalMode) => {
    setMode(newMode);
    setError('');
    setForgotSuccess(false);
  };

  const handleClose = () => {
    setFormData({ email: '', password: '', name: '' });
    setError('');
    setForgotSuccess(false);
    setMode('login');
    onClose();
  };

  const getTitle = () => {
    if (mode === 'login') return 'Iniciar Sesión';
    if (mode === 'register') return 'Crear Cuenta';
    return 'Recuperar Contraseña';
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={getTitle()}
    >
      {/* Modo: Forgot Password - Éxito */}
      {mode === 'forgot' && forgotSuccess ? (
        <div className="text-center py-4">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Correo enviado
          </h3>
          <p className="text-gray-600 mb-6">
            Hemos enviado un enlace de recuperación a <strong>{formData.email}</strong>.
            Revisa tu bandeja de entrada.
          </p>
          <Button onClick={() => switchMode('login')} className="w-full">
            Volver a Iniciar Sesión
          </Button>
        </div>
      ) : mode === 'forgot' ? (
        /* Modo: Forgot Password - Formulario */
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-gray-600 text-sm">
            Ingresa tu correo electrónico y te enviaremos un enlace para restablecer tu contraseña.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="tu@email.com"
                className="pl-10"
                required
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => switchMode('login')}
              className="flex-1"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="flex-1"
            >
              {loading ? 'Enviando...' : 'Enviar enlace'}
            </Button>
          </div>
        </form>
      ) : (
        /* Modo: Login / Register */
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre Completo
              </label>
              <Input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Tu nombre"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="tu@email.com"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              inputMode="email"
              spellCheck={false}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contraseña
            </label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="••••••••"
                className="pr-10"
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {mode === 'login' && (
              <div className="text-right mt-1">
                <button
                  type="button"
                  onClick={() => switchMode('forgot')}
                  className="text-sm text-violet-600 hover:text-violet-700"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="flex-1"
            >
              {loading ? (
                'Cargando...'
              ) : mode === 'login' ? (
                <>
                  <LogIn className="w-4 h-4 mr-2" />
                  Entrar
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Registrar
                </>
              )}
            </Button>
          </div>

          <div className="text-center pt-2 border-t">
            <button
              type="button"
              onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
              className="text-sm text-violet-600 hover:text-violet-700 font-medium"
            >
              {mode === 'login'
                ? '¿No tienes cuenta? Regístrate'
                : '¿Ya tienes cuenta? Inicia sesión'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};
