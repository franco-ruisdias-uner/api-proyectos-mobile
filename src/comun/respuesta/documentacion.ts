import { applyDecorators } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import type { Rol } from '../../../contrato/tipos.js';
import { CATALOGO, type CodigoError } from '../errores/catalogo.js';

interface OpcionesDoc {
  resumen: string;
  descripcion?: string;
  /** `null` = público; [] = cualquier usuario con sesión; [...] = sólo esos roles. */
  roles: Rol[] | null;
  estado?: number;
  /** Ejemplo del cuerpo de éxito (sin el sobre: se agrega solo). */
  ejemplo?: unknown;
  /** Para listas: el ejemplo es un elemento y se envuelve en `datos: [...]` con `meta`. */
  lista?: boolean;
  sinCuerpo?: boolean;
  errores?: CodigoError[];
}

/** Documenta un endpoint en Swagger con el ejemplo, quién puede usarlo y cada error posible. */
export function Doc(opciones: OpcionesDoc) {
  const estado = opciones.estado ?? 200;
  const acceso =
    opciones.roles === null
      ? 'Público: no hace falta sesión.'
      : opciones.roles.length === 0
        ? 'Con sesión (cualquier rol).'
        : `Sólo con rol: ${opciones.roles.join(', ')}.`;

  const errores = new Set<CodigoError>(opciones.errores ?? []);
  if (opciones.roles !== null) errores.add('NO_AUTENTICADO');
  if (opciones.roles !== null && opciones.roles.length > 0)
    errores.add('SIN_PERMISO');

  const porEstado = new Map<number, CodigoError[]>();
  for (const codigo of errores) {
    const s = CATALOGO[codigo].estado;
    porEstado.set(s, [...(porEstado.get(s) ?? []), codigo]);
  }

  const cuerpoExito = opciones.sinCuerpo
    ? undefined
    : opciones.lista
      ? {
          datos: [opciones.ejemplo],
          meta: { total: 1, pagina: 1, porPagina: 20 },
        }
      : { datos: opciones.ejemplo, meta: null };

  const decoradores = [
    ApiOperation({
      summary: opciones.resumen,
      description: [opciones.descripcion, `**Acceso:** ${acceso}`]
        .filter(Boolean)
        .join('\n\n'),
    }),
    ApiResponse({
      status: estado,
      description: opciones.sinCuerpo ? 'Listo, sin cuerpo.' : 'Listo.',
      ...(cuerpoExito === undefined
        ? {}
        : { content: { 'application/json': { example: cuerpoExito } } }),
    }),
    ...[...porEstado.entries()].map(([s, codigos]) =>
      ApiResponse({
        status: s,
        description: codigos
          .map((c) => `\`${c}\`: ${CATALOGO[c].mensaje}`)
          .join('<br>'),
        content: {
          'application/json': {
            examples: Object.fromEntries(
              codigos.map((c) => [
                c,
                {
                  value: { error: { codigo: c, mensaje: CATALOGO[c].mensaje } },
                },
              ]),
            ),
          },
        },
      }),
    ),
  ];
  if (opciones.roles !== null) decoradores.push(ApiBearerAuth());
  return applyDecorators(...decoradores);
}
