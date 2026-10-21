// Feriados nacionales de Argentina de 2026 y 2027, de la fuente oficial (Decreto 1027/2025 y
// el calendario de feriados nacionales del Ministerio del Interior; consultados en
// septiembre de 2026 a través de argentinadatos.com, que los publica tal cual).
// Los "puentes turísticos" son días no laborables, no feriados: no están (DECISIONES A21).
export interface FeriadoSemilla {
  fecha: string;
  nombre: string;
}

export const FERIADOS: FeriadoSemilla[] = [
  { fecha: '2026-01-01', nombre: 'Año Nuevo' },
  { fecha: '2026-02-16', nombre: 'Carnaval' },
  { fecha: '2026-02-17', nombre: 'Carnaval' },
  { fecha: '2026-03-24', nombre: 'Día Nacional de la Memoria por la Verdad y la Justicia' },
  { fecha: '2026-04-02', nombre: 'Día del Veterano y de los Caídos en la Guerra de Malvinas' },
  { fecha: '2026-04-03', nombre: 'Viernes Santo' },
  { fecha: '2026-05-01', nombre: 'Día del Trabajador' },
  { fecha: '2026-05-25', nombre: 'Día de la Revolución de Mayo' },
  { fecha: '2026-06-15', nombre: 'Paso a la Inmortalidad del General Martín Güemes' },
  { fecha: '2026-06-20', nombre: 'Paso a la Inmortalidad del General Manuel Belgrano' },
  { fecha: '2026-07-09', nombre: 'Día de la Independencia' },
  { fecha: '2026-08-17', nombre: 'Paso a la Inmortalidad del General José de San Martín' },
  { fecha: '2026-10-12', nombre: 'Día del Respeto a la Diversidad Cultural' },
  { fecha: '2026-11-23', nombre: 'Día de la Soberanía Nacional' },
  { fecha: '2026-12-08', nombre: 'Día de la Inmaculada Concepción de María' },
  { fecha: '2026-12-25', nombre: 'Navidad' },
  { fecha: '2027-01-01', nombre: 'Año Nuevo' },
  { fecha: '2027-02-08', nombre: 'Carnaval' },
  { fecha: '2027-02-09', nombre: 'Carnaval' },
  { fecha: '2027-03-24', nombre: 'Día Nacional de la Memoria por la Verdad y la Justicia' },
  { fecha: '2027-03-26', nombre: 'Viernes Santo' },
  { fecha: '2027-04-02', nombre: 'Día del Veterano y de los Caídos en la Guerra de Malvinas' },
  { fecha: '2027-05-01', nombre: 'Día del Trabajador' },
  { fecha: '2027-05-25', nombre: 'Día de la Revolución de Mayo' },
  { fecha: '2027-06-17', nombre: 'Paso a la Inmortalidad del General Martín Güemes' },
  { fecha: '2027-06-20', nombre: 'Paso a la Inmortalidad del General Manuel Belgrano' },
  { fecha: '2027-07-09', nombre: 'Día de la Independencia' },
  { fecha: '2027-08-17', nombre: 'Paso a la Inmortalidad del General José de San Martín' },
  { fecha: '2027-10-12', nombre: 'Día del Respeto a la Diversidad Cultural' },
  { fecha: '2027-11-20', nombre: 'Día de la Soberanía Nacional' },
  { fecha: '2027-12-08', nombre: 'Día de la Inmaculada Concepción de María' },
  { fecha: '2027-12-25', nombre: 'Navidad' },
];
