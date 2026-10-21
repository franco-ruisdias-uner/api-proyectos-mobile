export interface Coordenadas {
  latitud: number
  longitud: number
}

export type Categoria = 'residencial' | 'comercial' | 'industrial' | 'rural'

export type ModeloMedidor = 'agujas' | 'agujas_viejo' | 'digital' | 'multiplicador'

export type EstadoRuta = 'asignada' | 'en_curso' | 'cerrada'

export type MotivoNovedad =
  | 'perro_suelto'
  | 'porton_cerrado'
  | 'pasto_alto'
  | 'medidor_tapado'
  | 'medidor_roto'
  | 'deshabitada'
  | 'no_se_encuentra'

export type Rol = 'lector' | 'administracion'

export interface Suministro {
  id: string
  numero: string
  titular: string
  direccion: string
  coordenadas: Coordenadas
  categoria: Categoria
  medidorId: string
  lecturaAnterior: number | null
  fechaLecturaAnterior: string | null
  consumoPromedio: number | null
  activo: boolean
}

export interface Medidor {
  id: string
  serie: string
  modelo: ModeloMedidor
  multiplicador: number
  digitos: number
  videoInstructivoUrl: string | null
  codigoQr: string | null
  instaladoEn: string
}

export interface Ruta {
  id: string
  numero: string
  nombre: string
  bimestre: string
  lectorId: string
  suministroIds: string[]
  estado: EstadoRuta
  descargadaEn: string | null
  cerradaEn: string | null
}

export interface Lectura {
  id: string
  rutaId: string
  suministroId: string
  lectorId: string
  valor: number
  consumo: number
  fotoUri: string
  coordenadas: Coordenadas | null
  fueraDeRango: boolean
  confirmadaPorLector: boolean
  fechaHora: string
  sincronizada: boolean
}

export interface Novedad {
  id: string
  rutaId: string
  suministroId: string
  lectorId: string
  motivo: MotivoNovedad
  comentario: string | null
  audioUri: string | null
  fotoUri: string
  fechaHora: string
  sincronizada: boolean
}

export interface Usuario {
  id: string
  legajo: string
  nombre: string
  rol: Rol
  biometriaActiva: boolean
  rutasAsignadas: string[]
}
