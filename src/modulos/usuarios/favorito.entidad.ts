import { Entity } from 'typeorm';
import { ColumnaId, ColumnaInstante } from '../../comun/db/columnas.js';

/**
 * Espacio favorito de un usuario. Tabla propia (y no una lista dentro del usuario)
 * porque se consulta al revés: quiénes tienen un espacio de favorito (AGENTS §5.3).
 * La clave primaria compuesta impide repetirlo, también con pedidos simultáneos.
 */
@Entity('espacios_favoritos')
export class FavoritoEntidad {
  @ColumnaId()
  usuarioId: string;

  @ColumnaId()
  espacioId: string;

  @ColumnaInstante()
  creadoEn: Date;
}
