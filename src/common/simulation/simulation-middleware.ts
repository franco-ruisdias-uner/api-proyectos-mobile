// Simulación de fallas (AGENTS §11.4): con SIMULACION_HABILITADA=true, la cabecera
// `X-Simular: error-500` responde ERROR_INTERNO y `X-Simular: demora-3000` responde 3 s tarde.
import { setTimeout as esperar } from 'node:timers/promises';
import { Inject, Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { ENTORNO } from '../../config/environment.module.js';
import type { Entorno } from '../../config/environment.js';
import { cuerpoError } from '../errors/exception-filter.js';

export const DEMORA_MAXIMA_MS = 30_000;

export type Simulacion =
  { tipo: 'error' } | { tipo: 'demora'; ms: number } | null;

export function leerSimulacion(cabecera: string | undefined): Simulacion {
  const valor = cabecera?.trim().toLowerCase();
  if (valor === 'error-500') return { tipo: 'error' };
  const demora = valor ? /^demora-(\d{1,6})$/.exec(valor) : null;
  if (demora)
    return {
      tipo: 'demora',
      ms: Math.min(Number(demora[1]), DEMORA_MAXIMA_MS),
    };
  return null;
}

@Injectable()
export class MiddlewareSimulacion implements NestMiddleware {
  constructor(@Inject(ENTORNO) private readonly entorno: Entorno) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!this.entorno.SIMULACION_HABILITADA) return next();
    const simulacion = leerSimulacion(req.header('x-simular'));
    if (simulacion?.tipo === 'error') {
      res.status(500).json(cuerpoError('ERROR_INTERNO'));
      return;
    }
    if (simulacion?.tipo === 'demora') await esperar(simulacion.ms);
    next();
  }
}
