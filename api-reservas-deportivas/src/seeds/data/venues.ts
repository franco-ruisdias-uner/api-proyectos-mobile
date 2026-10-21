// Deportes y espacios de demo (ESPECIFICACION §8): once espacios municipales de Villaguay.
export interface DeporteSemilla {
  id: string;
  nombre: string;
  icono: string;
  color: string;
}

export interface EspacioSemilla {
  id: string;
  nombre: string;
  deporteId: string;
  complejo: string;
  superficie: string;
  techado: boolean;
  iluminacion: boolean;
  capacidad: number;
  precioPorHora: number;
  latitud: number;
  longitud: number;
  imagenes: string[];
  videoUrl: string | null;
  reglas: string;
  activo: boolean;
}

/** Íconos de Ionicons que existen. */
export const DEPORTES: DeporteSemilla[] = [
  {
    id: 'dep-futbol5',
    nombre: 'Fútbol 5',
    icono: 'football-outline',
    color: '#2E7D32',
  },
  {
    id: 'dep-futbol11',
    nombre: 'Fútbol 11',
    icono: 'football',
    color: '#1B5E20',
  },
  {
    id: 'dep-basquet',
    nombre: 'Básquet',
    icono: 'basketball-outline',
    color: '#EF6C00',
  },
  {
    id: 'dep-voley',
    nombre: 'Vóley',
    icono: 'ellipse-outline',
    color: '#1565C0',
  },
  {
    id: 'dep-tenis',
    nombre: 'Tenis',
    icono: 'tennisball-outline',
    color: '#9E9D24',
  },
  {
    id: 'dep-gimnasio',
    nombre: 'Gimnasio',
    icono: 'barbell-outline',
    color: '#6A1B9A',
  },
];

const POLI = 'Polideportivo Municipal';
const SIN_COMPLEJO = '—';

type Base = Omit<
  EspacioSemilla,
  'imagenes' | 'videoUrl' | 'activo' | 'reglas'
> &
  Partial<Pick<EspacioSemilla, 'videoUrl' | 'reglas'>>;

// Las imágenes las sube `sembrar` por el puerto de archivos (ver medios.ts) y pisa esta lista.
const espacio = (e: Base): EspacioSemilla => ({
  imagenes: [],
  videoUrl: null,
  reglas: 'Usar calzado deportivo. Dejar el espacio limpio al terminar.',
  activo: true,
  ...e,
});

export const ESPACIOS: EspacioSemilla[] = [
  espacio({
    id: 'esp-01',
    nombre: 'Cancha 1 — Fútbol 5',
    deporteId: 'dep-futbol5',
    complejo: POLI,
    superficie: 'Césped sintético',
    techado: false,
    iluminacion: true,
    capacidad: 12,
    precioPorHora: 12000,
    latitud: -31.8631,
    longitud: -59.0241,
  }),
  espacio({
    id: 'esp-02',
    nombre: 'Cancha 2 — Fútbol 5',
    deporteId: 'dep-futbol5',
    complejo: POLI,
    superficie: 'Césped sintético',
    techado: false,
    iluminacion: true,
    capacidad: 12,
    precioPorHora: 12000,
    latitud: -31.8633,
    longitud: -59.0238,
    reglas:
      'Calzado de césped sintético, sin tapones de metal. Dejar el espacio limpio.',
  }),
  espacio({
    id: 'esp-03',
    nombre: 'Cancha de Fútbol 11',
    deporteId: 'dep-futbol11',
    complejo: POLI,
    superficie: 'Césped natural',
    techado: false,
    iluminacion: true,
    capacidad: 24,
    precioPorHora: 30000,
    latitud: -31.8625,
    longitud: -59.0252,
  }),
  espacio({
    id: 'esp-04',
    nombre: 'Cancha de Básquet 1',
    deporteId: 'dep-basquet',
    complejo: SIN_COMPLEJO,
    superficie: 'Cemento alisado',
    techado: false,
    iluminacion: true,
    capacidad: 10,
    precioPorHora: 6000,
    latitud: -31.8702,
    longitud: -59.0305,
  }),
  espacio({
    id: 'esp-05',
    nombre: 'Cancha de Básquet 2',
    deporteId: 'dep-basquet',
    complejo: SIN_COMPLEJO,
    superficie: 'Cemento alisado',
    techado: false,
    iluminacion: false,
    capacidad: 10,
    precioPorHora: 5000,
    latitud: -31.8581,
    longitud: -59.0189,
  }),
  espacio({
    id: 'esp-06',
    nombre: 'Cancha de Básquet 3',
    deporteId: 'dep-basquet',
    complejo: SIN_COMPLEJO,
    superficie: 'Parquet',
    techado: true,
    iluminacion: true,
    capacidad: 10,
    precioPorHora: 8000,
    latitud: -31.866,
    longitud: -59.033,
  }),
  espacio({
    id: 'esp-07',
    nombre: 'Cancha de Vóley 1',
    deporteId: 'dep-voley',
    complejo: SIN_COMPLEJO,
    superficie: 'Arena',
    techado: false,
    iluminacion: false,
    capacidad: 12,
    precioPorHora: 5000,
    latitud: -31.869,
    longitud: -59.021,
  }),
  espacio({
    id: 'esp-08',
    nombre: 'Cancha de Vóley 2',
    deporteId: 'dep-voley',
    complejo: SIN_COMPLEJO,
    superficie: 'Cemento alisado',
    techado: false,
    iluminacion: true,
    capacidad: 12,
    precioPorHora: 5000,
    latitud: -31.8672,
    longitud: -59.0222,
  }),
  espacio({
    id: 'esp-09',
    nombre: 'Cancha de Tenis 1',
    deporteId: 'dep-tenis',
    complejo: 'Parque Berduc',
    superficie: 'Polvo de ladrillo',
    techado: false,
    iluminacion: true,
    capacidad: 4,
    precioPorHora: 7000,
    latitud: -31.8545,
    longitud: -59.035,
  }),
  espacio({
    id: 'esp-10',
    nombre: 'Cancha de Tenis 2',
    deporteId: 'dep-tenis',
    complejo: 'Parque Berduc',
    superficie: 'Polvo de ladrillo',
    techado: false,
    iluminacion: true,
    capacidad: 4,
    precioPorHora: 7000,
    latitud: -31.8548,
    longitud: -59.0346,
  }),
  espacio({
    id: 'esp-11',
    nombre: 'Gimnasio Cerrado',
    deporteId: 'dep-gimnasio',
    complejo: SIN_COMPLEJO,
    superficie: 'Piso flotante',
    techado: true,
    iluminacion: true,
    capacidad: 30,
    precioPorHora: 15000,
    latitud: -31.865,
    longitud: -59.028,
  }),
];
