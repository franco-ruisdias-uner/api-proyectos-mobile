import {
  createParamDecorator,
  type ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import type { Rol } from '../../../contrato/tipos.js';
import type { SesionActual } from './sesion-actual.js';

export const CLAVE_PUBLICO = 'publico';
export const CLAVE_ROLES = 'roles';

/** Endpoint sin sesión. Todo lo demás la exige (seguro por defecto). */
export const Publico = () => SetMetadata(CLAVE_PUBLICO, true);

/** Sólo para estos roles. */
export const Roles = (...roles: Rol[]) => SetMetadata(CLAVE_ROLES, roles);

/** La sesión del pedido (usuario del token). */
export const Sesion = createParamDecorator(
  (_dato: unknown, contexto: ExecutionContext): SesionActual =>
    contexto.switchToHttp().getRequest<{ sesion: SesionActual }>().sesion,
);
