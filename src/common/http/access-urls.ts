import { existsSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import type { Logger } from '@nestjs/common';

/**
 * Al arrancar, las direcciones para llegar a la API: el teléfono con Expo Go no llega a
 * localhost, entra por la IP de la computadora en la misma red wifi.
 */
export function logAccessUrls(logger: Logger, port: number): void {
  if (existsSync('/.dockerenv')) {
    logger.log(
      `Estás en Docker: desde el teléfono usá la IP de tu computadora, por ejemplo http://192.168.0.10:${port}`,
    );
  } else {
    for (const addresses of Object.values(networkInterfaces())) {
      for (const address of addresses ?? []) {
        if (address.family === 'IPv4' && !address.internal) {
          logger.log(
            `Desde el teléfono (misma red wifi): http://${address.address}:${port}/salud`,
          );
        }
      }
    }
  }
  logger.log(`En esta computadora: http://localhost:${port}/docs`);
}
