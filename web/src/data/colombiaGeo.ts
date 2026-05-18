// Departamentos de Colombia y sus municipios principales.
// Usado por el editor de zonas de envío para seleccionar departamento + ciudades.

export interface DepartmentGeo {
  department: string;
  cities: string[];
}

export const COLOMBIA_GEO: DepartmentGeo[] = [
  { department: 'Bogotá D.C.', cities: ['Bogotá'] },
  {
    department: 'Amazonas',
    cities: ['Leticia', 'Puerto Nariño'],
  },
  {
    department: 'Antioquia',
    cities: [
      'Medellín', 'Bello', 'Itagüí', 'Envigado', 'Sabaneta', 'La Estrella', 'Copacabana',
      'Girardota', 'Rionegro', 'Marinilla', 'El Carmen de Viboral', 'Apartadó', 'Turbo',
      'Caucasia', 'Caldas', 'Yarumal',
    ],
  },
  {
    department: 'Arauca',
    cities: ['Arauca', 'Saravena', 'Tame', 'Arauquita', 'Fortul', 'Puerto Rondón', 'Cravo Norte'],
  },
  {
    department: 'Atlántico',
    cities: [
      'Barranquilla', 'Soledad', 'Malambo', 'Sabanalarga', 'Baranoa', 'Puerto Colombia',
      'Galapa', 'Sabanagrande', 'Santo Tomás', 'Palmar de Varela',
    ],
  },
  {
    department: 'Bolívar',
    cities: [
      'Cartagena', 'Magangué', 'El Carmen de Bolívar', 'Turbaco', 'Arjona', 'Mompós',
      'María la Baja', 'San Juan Nepomuceno', 'San Pablo', 'Simití', 'Mahates',
    ],
  },
  {
    department: 'Boyacá',
    cities: [
      'Tunja', 'Duitama', 'Sogamoso', 'Chiquinquirá', 'Paipa', 'Villa de Leyva',
      'Puerto Boyacá', 'Moniquirá', 'Garagoa',
    ],
  },
  {
    department: 'Caldas',
    cities: ['Manizales', 'La Dorada', 'Chinchiná', 'Villamaría', 'Riosucio', 'Anserma', 'Manzanares', 'Salamina'],
  },
  {
    department: 'Caquetá',
    cities: ['Florencia', 'San Vicente del Caguán', 'Puerto Rico', 'El Doncello', 'La Montañita'],
  },
  {
    department: 'Casanare',
    cities: ['Yopal', 'Aguazul', 'Villanueva', 'Tauramena', 'Monterrey', 'Paz de Ariporo', 'Maní'],
  },
  {
    department: 'Cauca',
    cities: ['Popayán', 'Santander de Quilichao', 'Puerto Tejada', 'Patía', 'Guapi', 'Piendamó', 'Corinto'],
  },
  {
    department: 'Cesar',
    cities: ['Valledupar', 'Aguachica', 'Bosconia', 'Agustín Codazzi', 'La Jagua de Ibirico', 'Curumaní', 'El Copey'],
  },
  {
    department: 'Chocó',
    cities: ['Quibdó', 'Istmina', 'Tadó', 'Condoto', 'Bahía Solano', 'Acandí', 'Riosucio'],
  },
  {
    department: 'Córdoba',
    cities: [
      'Montería', 'Cereté', 'Sahagún', 'Lorica', 'Montelíbano', 'Planeta Rica', 'Tierralta',
      'Ciénaga de Oro', 'Ayapel', 'Puerto Libertador', 'San Antero', 'Chinú', 'Pueblo Nuevo',
    ],
  },
  {
    department: 'Cundinamarca',
    cities: [
      'Soacha', 'Facatativá', 'Zipaquirá', 'Chía', 'Mosquera', 'Madrid', 'Funza', 'Fusagasugá',
      'Girardot', 'Cajicá', 'Cota', 'Sibaté', 'Tocancipá', 'La Calera', 'Tenjo', 'Sopó',
    ],
  },
  { department: 'Guainía', cities: ['Inírida'] },
  { department: 'Guaviare', cities: ['San José del Guaviare', 'El Retorno', 'Calamar'] },
  {
    department: 'Huila',
    cities: ['Neiva', 'Pitalito', 'Garzón', 'La Plata', 'Campoalegre', 'Gigante', 'Aipe'],
  },
  {
    department: 'La Guajira',
    cities: ['Riohacha', 'Maicao', 'Uribia', 'Fonseca', 'San Juan del Cesar', 'Villanueva', 'Manaure', 'Albania'],
  },
  {
    department: 'Magdalena',
    cities: ['Santa Marta', 'Ciénaga', 'Fundación', 'El Banco', 'Plato', 'Aracataca', 'Zona Bananera', 'Pivijay'],
  },
  {
    department: 'Meta',
    cities: ['Villavicencio', 'Acacías', 'Granada', 'Puerto López', 'Cumaral', 'San Martín', 'Restrepo'],
  },
  {
    department: 'Nariño',
    cities: ['Pasto', 'Ipiales', 'Tumaco', 'Túquerres', 'La Unión', 'Samaniego', 'Sandoná', 'Barbacoas'],
  },
  {
    department: 'Norte de Santander',
    cities: ['Cúcuta', 'Ocaña', 'Villa del Rosario', 'Los Patios', 'Pamplona', 'Tibú', 'El Zulia', 'Chinácota'],
  },
  {
    department: 'Putumayo',
    cities: ['Mocoa', 'Puerto Asís', 'Orito', 'Valle del Guamuez', 'Villagarzón', 'Sibundoy'],
  },
  {
    department: 'Quindío',
    cities: ['Armenia', 'Calarcá', 'La Tebaida', 'Montenegro', 'Quimbaya', 'Circasia', 'Filandia', 'Salento'],
  },
  {
    department: 'Risaralda',
    cities: ['Pereira', 'Dosquebradas', 'Santa Rosa de Cabal', 'La Virginia', 'Marsella', 'Belén de Umbría'],
  },
  {
    department: 'San Andrés y Providencia',
    cities: ['San Andrés', 'Providencia'],
  },
  {
    department: 'Santander',
    cities: [
      'Bucaramanga', 'Floridablanca', 'Girón', 'Piedecuesta', 'Barrancabermeja', 'San Gil',
      'Socorro', 'Málaga', 'Vélez', 'Barbosa', 'Lebrija',
    ],
  },
  {
    department: 'Sucre',
    cities: [
      'Sincelejo', 'Corozal', 'Sampués', 'San Marcos', 'Tolú', 'Coveñas', 'San Onofre',
      'Sincé', 'Morroa', 'Los Palmitos', 'Ovejas', 'Galeras', 'San Pedro', 'Tolú Viejo',
      'San Benito Abad', 'Majagual', 'Sucre', 'Buenavista', 'Caimito', 'Chalán', 'Colosó',
      'El Roble', 'Guaranda', 'La Unión', 'Palmito', 'San Juan de Betulia',
    ],
  },
  {
    department: 'Tolima',
    cities: ['Ibagué', 'Espinal', 'Melgar', 'Honda', 'Líbano', 'Mariquita', 'Chaparral', 'Flandes', 'Guamo'],
  },
  {
    department: 'Valle del Cauca',
    cities: [
      'Cali', 'Buenaventura', 'Palmira', 'Tuluá', 'Cartago', 'Buga', 'Jamundí', 'Yumbo',
      'Candelaria', 'Florida', 'Zarzal', 'Sevilla',
    ],
  },
  { department: 'Vaupés', cities: ['Mitú'] },
  { department: 'Vichada', cities: ['Puerto Carreño', 'La Primavera'] },
];

/** Lista plana de nombres de departamentos. */
export const COLOMBIA_DEPARTMENTS = COLOMBIA_GEO.map((d) => d.department);

/** Devuelve los municipios de un departamento. */
export const citiesOfDepartment = (department: string): string[] =>
  COLOMBIA_GEO.find((d) => d.department === department)?.cities ?? [];
