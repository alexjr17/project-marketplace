import { useState } from 'react';
import { Alert, Button, Dialog, Field, TextInput } from '../ui';
import { useAuth } from '../../context/AuthContext';
import { LogIn, UserPlus, ArrowLeft, Check, Eye, EyeOff } from 'lucide-react';

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
    if (mode === 'login') return 'Iniciar sesión';
    if (mode === 'register') return 'Crear cuenta';
    return 'Recuperar contraseña';
  };

  return (
    <Dialog
      open={isOpen}
      onClose={handleClose}
      title={getTitle()}
      description={mode === 'login' ? 'Accede a tu cuenta para comprar y ver tus pedidos.' : mode === 'register' ? 'Crea tu cuenta en segundos.' : undefined}
      size="sm"
    >
      {/* Recuperar contraseña: éxito */}
      {mode === 'forgot' && forgotSuccess ? (
        <div className="text-center py-2">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Check className="w-6 h-6 text-green-600" />
          </div>
          <h3 className="text-base font-semibold text-gray-900 mb-1">Correo enviado</h3>
          <p className="text-sm text-gray-600 mb-5">
            Hemos enviado un enlace de recuperación a <strong>{formData.email}</strong>. Revisa tu bandeja de entrada.
          </p>
          <Button onClick={() => switchMode('login')} fullWidth>
            Volver a iniciar sesión
          </Button>
        </div>
      ) : mode === 'forgot' ? (
        /* Recuperar contraseña: formulario */
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-gray-600">
            Ingresa tu correo electrónico y te enviaremos un enlace para restablecer tu contraseña.
          </p>

          <Field label="Correo electrónico" required>
            <TextInput
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="tu@email.com"
              autoComplete="email"
              required
            />
          </Field>

          {error && <Alert tone="error">{error}</Alert>}

          <div className="flex flex-col-reverse sm:flex-row gap-2 pt-1">
            <Button variant="secondary" onClick={() => switchMode('login')} icon={<ArrowLeft className="w-4 h-4" />} className="sm:flex-1">
              Volver
            </Button>
            <Button type="submit" isLoading={loading} className="sm:flex-1">
              Enviar enlace
            </Button>
          </div>
        </form>
      ) : (
        /* Iniciar sesión / registrarse */
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <Field label="Nombre completo" required>
              <TextInput
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Tu nombre"
                autoComplete="name"
                required
              />
            </Field>
          )}

          <Field label="Correo electrónico" required>
            <TextInput
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
          </Field>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">
                Contraseña<span className="text-red-500"> *</span>
              </label>
              {mode === 'login' && (
                <button type="button" onClick={() => switchMode('forgot')} className="text-xs font-medium text-app-700 hover:underline">
                  ¿Olvidaste tu contraseña?
                </button>
              )}
            </div>
            <div className="relative">
              <TextInput
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
                title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && <Alert tone="error">{error}</Alert>}

          <Button
            type="submit"
            size="lg"
            fullWidth
            isLoading={loading}
            icon={mode === 'login' ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
          >
            {mode === 'login' ? 'Entrar' : 'Crear cuenta'}
          </Button>

          <p className="text-center text-sm text-gray-500 pt-3 border-t border-gray-100">
            {mode === 'login' ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}{' '}
            <button
              type="button"
              onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
              className="font-medium text-app-700 hover:underline"
            >
              {mode === 'login' ? 'Regístrate' : 'Inicia sesión'}
            </button>
          </p>
        </form>
      )}
    </Dialog>
  );
};
