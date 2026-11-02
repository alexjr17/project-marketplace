import { useNavigate } from 'react-router-dom';
import { Home, Search } from 'lucide-react';
import { Button } from '../components/ui';
import { Seo } from '../components/seo/Seo';

export const NotFoundPage = () => {
  const navigate = useNavigate();
  return (
    <div className="bg-gray-50 min-h-[70vh] flex items-center">
      <Seo title="Página no encontrada" />
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <p className="text-sm font-semibold text-app-600 tracking-wide">Error 404</p>
        <h1 className="mt-2 text-3xl md:text-4xl font-bold text-gray-900">Página no encontrada</h1>
        <p className="mt-3 text-base text-gray-500">Lo sentimos, la página que buscas no existe o fue movida.</p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Button size="lg" icon={<Home className="w-5 h-5" />} onClick={() => navigate('/')}>Volver al inicio</Button>
          <Button size="lg" variant="secondary" icon={<Search className="w-5 h-5" />} onClick={() => navigate('/catalog')}>Ver catálogo</Button>
        </div>
      </div>
    </div>
  );
};
