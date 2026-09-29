import { Matches } from 'class-validator';
import { patronId } from '../../../comun/ids/ids.js';

export class ParametroIdReporteDto {
  @Matches(patronId('rep'), {
    context: {
      mensaje: 'El identificador del reporte no tiene el formato correcto.',
    },
  })
  id: string;
}
