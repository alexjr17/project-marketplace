import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';

export const NotFoundPage = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 py-24 text-center">
      <div className="mb-8">
        <span className="text-9xl">404</span>
      </div>
      <h1 className="text-4xl font-bold text-gray-900 mb-4">Página no encontrada</h1>
      <p className="text-xl text-gray-600 mb-8">
        Lo sentimos, la página que buscas no existe.
      </p>
      <Link
        to="/"
        className="bg-blue-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-blue-700 inline-flex items-center gap-2 transition"
      >
        <Home className="w-5 h-5" />
        Volver al Inicio
      </Link>
    </div>
  );
};
