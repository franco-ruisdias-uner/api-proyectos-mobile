import type { Horario } from '../../../contrato/tipos.js';

export interface ComercioSemilla {
  id: string;
  nombre: string;
  rubroId: string;
  descripcion: string;
  direccion: string;
  latitud: number;
  longitud: number;
  telefono: string | null;
  whatsapp: string | null;
  instagram: string | null;
  /** Nombres de archivo de `src/semillas/medios/` (sin extensión). */
  imagenes: string[];
  /** `true` si lleva el video de muestra de `src/semillas/medios/`. */
  video: boolean;
  horarios: Horario[];
  mediosDePago: string[];
  puntaje: number;
  cantidadResenas: number;
  activo: boolean;
  /** Días a partir de hoy que sigue cerrado por vacaciones (D2); `null` si no. */
  vacacionesDias: number | null;
}

const dias = (lista: Horario['dia'][], abre: string, cierra: string): Horario[] =>
  lista.map((dia) => ({ dia, abre, cierra }));

/** El horario cortado típico: 8 a 12 y 16:30 a 20:30, sábados 8 a 13 (ESPECIFICACION §8). */
const CORTADO: Horario[] = [
  ...dias([1, 2, 3, 4, 5], '08:00', '12:00'),
  ...dias([1, 2, 3, 4, 5], '16:30', '20:30'),
  ...dias([6], '08:00', '13:00'),
];
/** Variante: tarde desde las 17 y sábados de corrido hasta las 14. */
const CORTADO_TARDE: Horario[] = [
  ...dias([1, 2, 3, 4, 5], '08:30', '12:30'),
  ...dias([1, 2, 3, 4, 5], '17:00', '21:00'),
  ...dias([6], '08:30', '14:00'),
];
const CORRIDO: Horario[] = dias([1, 2, 3, 4, 5, 6], '09:00', '19:00');
const CORRIDO_LARGO: Horario[] = dias([1, 2, 3, 4, 5, 6], '08:00', '21:00');
const TODOS_LOS_DIAS: Horario[] = [
  ...dias([0, 1, 2, 3, 4, 5, 6], '10:00', '14:00'),
  ...dias([0, 1, 2, 3, 4, 5, 6], '19:30', '23:30'),
];
const SOLO_MANANA: Horario[] = dias([1, 2, 3, 4, 5], '08:00', '14:00');
const FARMACIA: Horario[] = [
  ...dias([0, 1, 2, 3, 4, 5, 6], '08:30', '13:00'),
  ...dias([0, 1, 2, 3, 4, 5, 6], '16:30', '21:30'),
];

type Fila = [
  id: string,
  nombre: string,
  rubroId: string,
  calle: string,
  descripcion: string,
  extras?: Partial<ComercioSemilla> & { tel?: string; ig?: string },
];

const FILAS: Fila[] = [
  [
    'com-101',
    'Parrilla Don Aurelio',
    'rub-gastronomia',
    '9 de Julio 801',
    'Asado, achuras y minutas. Mesas en la vereda.',
    { horarios: TODOS_LOS_DIAS, puntaje: 4.4, cantidadResenas: 31 },
  ],
  [
    'com-102',
    'Panadería La Espiga',
    'rub-gastronomia',
    'Galarza 745',
    'Pan casero, facturas y sándwiches de miga.',
    { horarios: dias([0, 1, 2, 3, 4, 5, 6], '06:30', '13:00'), puntaje: 4.7, cantidadResenas: 18 },
  ],
  [
    'com-103',
    'Heladería Colón',
    'rub-gastronomia',
    'Rocamora 910',
    'Helado artesanal, postres helados y café.',
    { horarios: dias([0, 1, 2, 3, 4, 5, 6], '15:00', '23:59'), puntaje: 4.2, cantidadResenas: 9 },
  ],
  [
    'com-104',
    'Café del Centro',
    'rub-gastronomia',
    '9 de Julio 702',
    'Café de especialidad, tostadas y medialunas.',
    { horarios: CORRIDO_LARGO },
  ],
  [
    'com-105',
    'Pizzería La Esquina',
    'rub-gastronomia',
    'Sarmiento 655',
    'Pizza a la piedra y empanadas para llevar.',
    { horarios: dias([2, 3, 4, 5, 6, 0], '19:00', '23:59') },
  ],
  [
    'com-106',
    'Rotisería Los Primos',
    'rub-gastronomia',
    'Moreno 420',
    'Comida casera por porción y por kilo.',
    { horarios: CORTADO_TARDE, puntaje: 3.9, cantidadResenas: 5 },
  ],
  [
    'com-107',
    'Boutique Aurora',
    'rub-indumentaria',
    'Galarza 812',
    'Ropa de mujer, talles especiales y accesorios.',
    { horarios: CORTADO, puntaje: 4.1, cantidadResenas: 7 },
  ],
  [
    'com-108',
    'Casa Rivero',
    'rub-indumentaria',
    '9 de Julio 955',
    'Ropa de hombre, trajes y camisas a medida.',
    { horarios: CORTADO, puntaje: 4.5, cantidadResenas: 14 },
  ],
  [
    'com-109',
    'Zapatería El Paso',
    'rub-indumentaria',
    'Rocamora 633',
    'Calzado de cuero, zapatillas y reparaciones.',
    { horarios: CORTADO_TARDE },
  ],
  [
    'com-110',
    'Mundo Bebé',
    'rub-indumentaria',
    'Supremo Entrerriano 340',
    'Ropa y artículos para bebés y chicos.',
    { horarios: CORTADO },
  ],
  [
    'com-111',
    'Blanquería Primavera',
    'rub-hogar',
    'Sarmiento 712',
    'Sábanas, toallas, cortinas y mantelería.',
    { horarios: CORTADO, puntaje: 4, cantidadResenas: 3 },
  ],
  [
    'com-112',
    'Bazar Don Pepe',
    'rub-hogar',
    '3 de Febrero 520',
    'Vajilla, ollas, termos y regalos.',
    { horarios: CORTADO },
  ],
  [
    'com-113',
    'Mueblería Hogar Entrerriano',
    'rub-hogar',
    'Supremo Entrerriano 215',
    'Muebles de madera y colchones.',
    { horarios: CORTADO_TARDE, puntaje: 4.3, cantidadResenas: 11 },
  ],
  [
    'com-114',
    'Vivero Los Ceibos',
    'rub-hogar',
    'Millán 118',
    'Plantas, macetas, tierra y asesoramiento de jardín.',
    { horarios: CORRIDO },
  ],
  [
    'com-115',
    'Pinturería Arco Iris',
    'rub-ferreteria',
    'Galarza 690',
    'Pinturas, esmaltes, rodillos y entonadores.',
    { horarios: CORTADO, puntaje: 4.4, cantidadResenas: 22 },
  ],
  [
    'com-116',
    'Corralón San Martín',
    'rub-ferreteria',
    'San Martín 1020',
    'Materiales de construcción, hierros y cerámicos.',
    { horarios: SOLO_MANANA },
  ],
  [
    'com-117',
    'Electricidad Moreno',
    'rub-ferreteria',
    'Moreno 555',
    'Cables, lámparas, tableros y materiales eléctricos.',
    { horarios: CORTADO },
  ],
  [
    'com-118',
    'Ferretería El Tornillo',
    'rub-ferreteria',
    '9 de Julio 1185',
    'Herramientas, pinturas, bulonería y todo para la obra.',
    {
      horarios: CORTADO,
      tel: '+54 3442 421234',
      whatsapp: '5493442421234',
      ig: '@eltornillo',
      imagenes: ['fachada', 'vidriera'],
      video: true,
      mediosDePago: ['efectivo', 'debito', 'credito', 'transferencia'],
      puntaje: 4.6,
      cantidadResenas: 12,
    },
  ],
  [
    'com-119',
    'Sanitarios Uruguay',
    'rub-ferreteria',
    'Alberdi 305',
    'Grifería, sanitarios y artículos de plomería.',
    { horarios: CORTADO_TARDE },
  ],
  [
    'com-120',
    'Farmacia Central',
    'rub-salud',
    '9 de Julio 640',
    'Farmacia, perfumería y turnos de vacunación.',
    { horarios: FARMACIA, puntaje: 4.6, cantidadResenas: 41, imagenes: ['fachada'] },
  ],
  [
    'com-121',
    'Óptica Visión',
    'rub-salud',
    'Galarza 530',
    'Anteojos recetados, de sol y lentes de contacto.',
    { horarios: CORTADO },
  ],
  [
    'com-122',
    'Farmacia del Pueblo',
    'rub-salud',
    'Rocamora 402',
    'Medicamentos, ortopedia y dermocosmética.',
    { horarios: FARMACIA, puntaje: 4.1, cantidadResenas: 6 },
  ],
  [
    'com-123',
    'Laboratorio Bioanálisis Sur',
    'rub-salud',
    'Sarmiento 280',
    'Análisis clínicos con turno previo.',
    { horarios: dias([1, 2, 3, 4, 5], '07:00', '11:00') },
  ],
  [
    'com-124',
    'Estudio Contable Ferrero',
    'rub-servicios',
    'Moreno 610',
    'Monotributo, ganancias y asesoramiento a comercios.',
    { horarios: dias([1, 2, 3, 4, 5], '09:00', '17:00') },
  ],
  [
    'com-125',
    'Peluquería Estilo',
    'rub-servicios',
    'Galarza 905',
    'Corte, color y peinados. Con turno.',
    { horarios: dias([2, 3, 4, 5, 6], '09:00', '20:00'), puntaje: 4.8, cantidadResenas: 87 },
  ],
  [
    'com-126',
    'Lavadero Burbujas',
    'rub-servicios',
    '3 de Febrero 780',
    'Lavado y secado de ropa, acolchados y alfombras.',
    { horarios: CORRIDO },
  ],
  [
    'com-127',
    'Cerrajería 24 hs',
    'rub-servicios',
    'San Martín 450',
    'Aperturas, copias de llaves y cerraduras.',
    { horarios: dias([0, 1, 2, 3, 4, 5, 6], '00:00', '23:59'), puntaje: 3.8, cantidadResenas: 4 },
  ],
  [
    'com-128',
    'Inmobiliaria del Río',
    'rub-servicios',
    '9 de Julio 520',
    'Alquileres, ventas y tasaciones.',
    { horarios: CORTADO_TARDE },
  ],
  [
    'com-129',
    'Celulandia',
    'rub-tecnologia',
    'Galarza 715',
    'Celulares, fundas, cargadores y servicio técnico.',
    { horarios: CORRIDO_LARGO, puntaje: 4.3, cantidadResenas: 16 },
  ],
  [
    'com-130',
    'Compu Centro',
    'rub-tecnologia',
    'Rocamora 580',
    'Notebooks, impresoras, insumos y reparaciones.',
    { horarios: CORTADO },
  ],
  [
    'com-131',
    'Electro Hogar Sur',
    'rub-tecnologia',
    'Supremo Entrerriano 455',
    'Electrodomésticos, televisores y aires acondicionados.',
    { horarios: CORTADO_TARDE },
  ],
  [
    'com-132',
    'Librería Papelera Moderna',
    'rub-libreria',
    '9 de Julio 880',
    'Útiles escolares, papelería y fotocopias.',
    { horarios: CORTADO, puntaje: 4.2, cantidadResenas: 8 },
  ],
  [
    'com-133',
    'Libros del Sur',
    'rub-libreria',
    'Sarmiento 590',
    'Libros nuevos y usados, textos y novedades.',
    { horarios: CORTADO_TARDE, puntaje: 4.9, cantidadResenas: 13 },
  ],
  [
    'com-134',
    'Juguetería Arco',
    'rub-libreria',
    'Galarza 640',
    'Juguetes, juegos de mesa y cotillón.',
    { horarios: CORTADO },
  ],
  [
    'com-135',
    'Casa de Regalos Ilusión',
    'rub-otros',
    'Moreno 380',
    'Regalos, flores secas y tarjetas.',
    { horarios: CORTADO },
  ],
  [
    'com-136',
    'Veterinaria Mascotas',
    'rub-otros',
    'San Martín 705',
    'Consultas, alimento balanceado y peluquería canina.',
    { horarios: CORTADO, puntaje: 4.5, cantidadResenas: 10 },
  ],
  [
    'com-137',
    'Florería Margarita',
    'rub-otros',
    'Alberdi 210',
    'Ramos, plantas de interior y arreglos para eventos.',
    { horarios: CORRIDO, imagenes: ['interior'] },
  ],
  // Casos feos que pide el PRD
  [
    'com-138',
    'Kiosco Las Vacaciones',
    'rub-otros',
    'Millán 260',
    'Golosinas, cigarrillos y recargas. Cerrado por vacaciones.',
    { horarios: CORTADO, vacacionesDias: 12 },
  ],
  [
    'com-139',
    'Zapatillería Cerrada',
    'rub-indumentaria',
    'Rocamora 777',
    'Dado de baja: ya no es socio del Centro Comercial.',
    { horarios: CORTADO, activo: false },
  ],
  [
    'com-201',
    'Panadería y Confitería Santa Rita',
    'rub-gastronomia',
    'Supremo Entrerriano 680',
    'Tortas, budines y pan del día. Cuenta de comercio de demostración.',
    {
      horarios: CORTADO,
      ig: '@santarita',
      mediosDePago: ['efectivo', 'billetera_virtual'],
      imagenes: ['vidriera', 'interior'],
      video: true,
      puntaje: 4,
      cantidadResenas: 2,
    },
  ],
];

const CENTRO = { latitud: -32.4825, longitud: -58.2372 };

/** Los 40 comercios de demo. Las coordenadas son una grilla alrededor de la plaza Ramírez. */
export const COMERCIOS: ComercioSemilla[] = FILAS.map(
  ([id, nombre, rubroId, direccion, descripcion, extras = {}], i) => {
    const { tel, ig, ...resto } = extras;
    return {
      id,
      nombre,
      rubroId,
      descripcion,
      direccion: `${direccion}, Concepción del Uruguay`,
      latitud: Number((CENTRO.latitud + ((i % 8) - 3.5) * 0.0011).toFixed(6)),
      longitud: Number((CENTRO.longitud + (Math.floor(i / 8) - 2) * 0.0015).toFixed(6)),
      telefono: tel ?? null,
      whatsapp: null,
      instagram: ig ?? null,
      imagenes: [],
      video: false,
      horarios: CORTADO,
      mediosDePago: ['efectivo', 'debito'],
      puntaje: 0,
      cantidadResenas: 0,
      activo: true,
      vacacionesDias: null,
      ...resto,
    };
  },
);
