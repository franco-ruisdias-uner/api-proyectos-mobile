// contrato/tipos.ts — «Transporte Público · Paraná»
// Copia literal de los tipos del PRD (sección «Resumen — qué entidades maneja la app»).
// Es lo que los alumnos tienen en src/tipos/. NO SE MODIFICA.

export interface Coordenadas {
  latitud: number;
  longitud: number;
}

export type Sentido = "ida" | "vuelta";

export interface Recorrido {
  sentido: Sentido;
  destino: string; // "hacia Puerto Viejo"
  trazado: Coordenadas[]; // para dibujar la línea en el mapa
  paradaIds: string[]; // en orden de paso
}

export interface Linea {
  id: string;
  numero: string;
  nombre: string;
  color: string;
  empresa: string;
  recorridos: Recorrido[];
  activa: boolean;
}

export interface Parada {
  id: string;
  nombre: string;
  coordenadas: Coordenadas;
  lineaIds: string[];
  sentido: Sentido;
  refugio: boolean; // si tiene garita
  codigoQr: string | null;
}

export type TipoDeDia = "habil" | "sabado" | "domingo" | "feriado";

export interface Horario {
  id: string;
  lineaId: string;
  paradaId: string;
  sentido: Sentido;
  tipoDeDia: TipoDeDia;
  hora: string; // "HH:MM", hora de tabla
}

export type Gravedad = "informativo" | "desvio" | "suspension";

export interface Aviso {
  id: string;
  titulo: string;
  detalle: string;
  lineaIds: string[];
  desde: string;
  hasta: string | null;
  gravedad: Gravedad;
  trazadoAlternativo: Coordenadas[] | null;
  videoUrl: string | null;
}

export type MotivoDemora =
  | "no_paso" | "paso_lleno" | "demorado" | "unidad_rota" | "calle_cortada";

export interface ReporteDeDemora {
  id: string;
  lineaId: string;
  paradaId: string;
  usuarioId: string;
  motivo: MotivoDemora;
  comentario: string | null;
  fotoUri: string | null;
  confirmaciones: number;
  fechaHora: string;
  sincronizado: boolean;
}

export type Tema = "claro" | "oscuro" | "sistema";

export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  lineasFavoritas: string[];
  paradasFavoritas: string[];
  avisosActivos: boolean;
  tema: Tema;
}
