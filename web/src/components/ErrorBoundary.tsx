import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Captura errores de render en toda la app para evitar la "pantalla en blanco".
 * Muestra el error (útil para diagnosticar) y un botón para limpiar el estado
 * guardado (localStorage/sessionStorage) y recargar — esto resuelve los casos
 * en que datos viejos guardados rompen la app tras un deploy.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Queda en la consola para depurar.
    console.error('ErrorBoundary capturó un error:', error, info);
  }

  private handleReset = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      // ignore
    }
    window.location.href = '/';
  };

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-6 text-center">
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Algo salió mal
          </h1>
          <p className="text-gray-600 text-sm mb-4">
            Ocurrió un error al cargar la aplicación. Si acabas de actualizar,
            limpia los datos guardados y vuelve a cargar.
          </p>

          <div className="flex flex-col gap-2">
            <button
              onClick={this.handleReset}
              className="w-full bg-violet-600 hover:bg-violet-700 text-white font-medium py-2 px-4 rounded-xl transition-colors"
            >
              Borrar datos y recargar
            </button>
            <button
              onClick={() => window.location.reload()}
              className="w-full border-2 border-gray-300 hover:bg-gray-100 text-gray-700 font-medium py-2 px-4 rounded-xl transition-colors"
            >
              Solo recargar
            </button>
          </div>

          <pre className="mt-4 text-left text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 overflow-auto max-h-40 whitespace-pre-wrap">
            {this.state.error.message}
          </pre>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
