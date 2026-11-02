import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { Alert, AppTheme, Button, Field, Spinner, TextInput } from '../components/ui';
import { Lock, Check, X, Eye, EyeOff, ArrowLeft } from 'lucide-react';

export const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { resetPassword, validateResetToken } = useAuth();
  const { settings } = useSettings();

  const token = searchParams.get('token');
  const email = searchParams.get('email');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [tokenValid, setTokenValid] = useState(false);

  // Colores de marca
  const brandColors = settings.appearance?.brandColors || settings.general.brandColors || {
    primary: '#7c3aed',
    secondary: '#ec4899',
    accent: '#f59e0b',
  };

  const gradientStyle = `linear-gradient(to right, ${brandColors.primary}, ${brandColors.secondary}, ${brandColors.accent || brandColors.secondary})`;

  // Validar token al cargar
  useEffect(() => {
    const checkToken = async () => {
      if (!token || !email) {
        setTokenValid(false);
        setValidating(false);
        return;
      }

      try {
        const isValid = await validateResetToken(token, email);
        setTokenValid(isValid);
      } catch {
        setTokenValid(false);
      } finally {
        setValidating(false);
      }
    };

    checkToken();
  }, [token, email, validateResetToken]);

  // Validaciones de contraseña
  const passwordChecks = {
    length: password.length >= 6,
    match: password === confirmPassword && confirmPassword.length > 0,
  };

  const isFormValid = passwordChecks.length && passwordChecks.match;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || !token || !email) return;

    setError('');
    setLoading(true);

    try {
      await resetPassword(token, email, password);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cambiar la contraseña');
    } finally {
      setLoading(false);
    }
  };

  // Contenedor común: fondo gris, franja de marca y tarjeta centrada (la ruta no usa el Layout de la tienda).
  const shell = (children: React.ReactNode) => (
    <AppTheme app="store">
      <div className="min-h-screen flex flex-col bg-gray-50">
        <div className="h-1 w-full" style={{ background: gradientStyle }} />
        <div className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-md">
            {children}
            <div className="text-center mt-6">
              <Link to="/" className="text-sm text-gray-500 hover:text-gray-900 inline-flex items-center gap-1">
                <ArrowLeft className="w-4 h-4" />
                Volver al inicio
              </Link>
            </div>
          </div>
        </div>
      </div>
    </AppTheme>
  );

  // Estado de carga
  if (validating) {
    return shell(<Spinner label="Validando enlace…" />);
  }

  // Token inválido o expirado
  if (!tokenValid) {
    return shell(
      <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <X className="w-6 h-6 text-red-600" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-1">Enlace inválido o expirado</h1>
        <p className="text-sm text-gray-600 mb-5">
          El enlace de recuperación no es válido o ha expirado. Los enlaces expiran después de 1 hora.
        </p>
        <Button fullWidth onClick={() => navigate('/')}>Ir a la tienda</Button>
      </div>,
    );
  }

  // Éxito
  if (success) {
    return shell(
      <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <Check className="w-6 h-6 text-green-600" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-1">Contraseña actualizada</h1>
        <p className="text-sm text-gray-600 mb-5">
          Tu contraseña ha sido cambiada exitosamente. Ya puedes iniciar sesión con tu nueva contraseña.
        </p>
        <Button fullWidth onClick={() => navigate('/')}>Ir a iniciar sesión</Button>
      </div>,
    );
  }

  const check = (ok: boolean, label: string) => (
    <li className={`flex items-center gap-2 ${ok ? 'text-green-700' : 'text-gray-400'}`}>
      {ok ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
      {label}
    </li>
  );

  // Formulario de cambio
  return shell(
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="mb-6">
        <div className="w-11 h-11 rounded-lg bg-app-100 text-app-600 flex items-center justify-center mb-4">
          <Lock className="w-5 h-5" />
        </div>
        <h1 className="text-xl font-bold text-gray-900">Nueva contraseña</h1>
        <p className="text-sm text-gray-500 mt-1">
          Ingresa tu nueva contraseña para <strong className="text-gray-700">{email}</strong>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Nueva contraseña" required>
          <div className="relative">
            <TextInput
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="pr-10"
              autoComplete="new-password"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </Field>

        <Field label="Confirmar contraseña" required>
          <TextInput
            type={showPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="new-password"
            required
          />
        </Field>

        <ul className="space-y-1.5 text-sm">
          {check(passwordChecks.length, 'Mínimo 6 caracteres')}
          {check(passwordChecks.match, 'Las contraseñas coinciden')}
        </ul>

        {error && <Alert tone="error">{error}</Alert>}

        <Button type="submit" size="lg" fullWidth disabled={!isFormValid} isLoading={loading}>
          Cambiar contraseña
        </Button>
      </form>
    </div>,
  );
};
