// Builders de reservas, fijas y bloqueos para los tests: cada test arma sus propios datos.
import { nuevoId } from '../../src/common/ids/ids.js';
import { BloqueoEntidad } from '../../src/modules/slots/block.entity.js';
import { ReservaEntidad } from '../../src/modules/slots/reserva.entity.js';
import { ReservaFijaEntidad } from '../../src/modules/slots/standing-booking.entity.js';
import { idDeTurno } from '../../src/modules/slots/rules/slot-id.js';
import type { AppDePrueba } from './create-app.js';

export async function crearReserva(
  a: AppDePrueba,
  datos: {
    espacioId: string;
    usuarioId: string;
    fecha: string;
    inicio: string;
  } & Partial<ReservaEntidad>,
): Promise<ReservaEntidad> {
  const repo = a.dataSource.getRepository(ReservaEntidad);
  const estado = datos.estado ?? 'confirmada';
  return repo.save(
    repo.create({
      id: nuevoId('res'),
      turnoId: idDeTurno(datos.espacioId, datos.fecha, datos.inicio),
      cantidadPersonas: 6,
      codigoQr: `VGY-${datos.fecha.slice(5, 7)}${datos.fecha.slice(8)}-${datos.inicio.slice(0, 2)}-${nuevoId('x').slice(2, 8).toUpperCase()}`,
      ingresoEn: null,
      creadaEn: a.reloj.ahora(),
      ocupacion:
        estado === 'cancelada'
          ? null
          : `${datos.espacioId}|${datos.fecha}|${datos.inicio}`,
      ...datos,
      estado,
    }),
  );
}

export async function crearFija(
  a: AppDePrueba,
  datos: { espacioId: string } & Partial<ReservaFijaEntidad>,
): Promise<ReservaFijaEntidad> {
  const repo = a.dataSource.getRepository(ReservaFijaEntidad);
  return repo.save(
    repo.create({
      id: nuevoId('fij'),
      titular: 'Grupo de los martes',
      dia: 2,
      inicio: '21:00',
      fin: '22:00',
      desde: '2026-01-01',
      hasta: null,
      activa: true,
      ...datos,
    }),
  );
}

export async function crearBloqueo(
  a: AppDePrueba,
  datos: { espacioId: string; fecha: string } & Partial<BloqueoEntidad>,
): Promise<BloqueoEntidad> {
  const repo = a.dataSource.getRepository(BloqueoEntidad);
  return repo.save(
    repo.create({
      id: nuevoId('blo'),
      inicio: null,
      fin: null,
      motivo: 'Cancha anegada',
      ...datos,
    }),
  );
}
