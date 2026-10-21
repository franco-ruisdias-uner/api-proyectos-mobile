// contract/types.ts — «Lectura de Medidores · Cooperativa de Agua Potable de Chajarí»
// Copia literal de los tipos del PRD (sección «Resumen — qué entidades maneja la app»).
// Es lo que los alumnos tienen en src/tipos/. NO SE MODIFICA.

export interface Coordenadas {
  latitud: number;
  longitud: number;
}

export type Categoria = "residencial" | "comercial" | "industrial" | "rural";

export interface Suministro {
  id: string;
  numero: string;                    // con ceros a la izquierda
  titular: string;
  direccion: string;
  coordenadas: Coordenadas;
  categoria: Categoria;
  medidorId: string;
  lecturaAnterior: number | null;    // null si es conexión nueva
  fechaLecturaAnterior: string | null;
  consumoPromedio: number | null;
  activo: boolean;
}

export type ModeloMedidor = "agujas" | "agujas_viejo" | "digital" | "multiplicador";

export interface Medidor {
  id: string;
  serie: string;
  modelo: ModeloMedidor;
  multiplicador: number;        // el consumo real = (lectura - anterior) * multiplicador
  digitos: number;
  videoInstructivoUrl: string | null;
  codigoQr: string | null;
  instaladoEn: string;
}

export type EstadoRuta = "asignada" | "en_curso" | "cerrada";

export interface Ruta {
  id: string;
  numero: string;
  nombre: string;
  bimestre: string;             // "AAAA-NN"
  lectorId: string;
  suministroIds: string[];      // el orden es el recorrido, no se reordena
  estado: EstadoRuta;
  descargadaEn: string | null;
  cerradaEn: string | null;
}

export interface Lectura {
  id: string;
  rutaId: string;
  suministroId: string;
  lectorId: string;
  valor: number;                   // tal cual se ve en el medidor
  consumo: number;                 // (valor - anterior) * multiplicador
  fotoUri: string;
  coordenadas: Coordenadas | null;
  fueraDeRango: boolean;
  confirmadaPorLector: boolean;    // true si la app avisó y el lector confirmó igual
  fechaHora: string;
  sincronizada: boolean;
}

export type MotivoNovedad =
  | "perro_suelto" | "porton_cerrado" | "pasto_alto" | "medidor_tapado"
  | "medidor_roto" | "deshabitada" | "no_se_encuentra";

export interface Novedad {
  id: string;
  rutaId: string;
  suministroId: string;
  lectorId: string;
  motivo: MotivoNovedad;
  comentario: string | null;
  audioUri: string | null;
  fotoUri: string;
  fechaHora: string;
  sincronizada: boolean;
}

export type Rol = "lector" | "administracion";

export interface Usuario {
  id: string;
  legajo: string;
  nombre: string;
  rol: Rol;
  biometriaActiva: boolean;
  rutasAsignadas: string[];
}
