// El README (AGENTS §13.6) tiene que listar a cada usuario de demo, con la contraseña y los casos de prueba.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPORTES_DEMO } from './reportes.js';
import { CONTRASENA_DEMO, USUARIOS_DEMO } from './usuarios.js';

const README = readFileSync(
  join(import.meta.dirname, '../../../README.md'),
  'utf8',
);

describe('AGENTS §13.6 — el README describe los datos de demo', () => {
  it('dice la contraseña de demo', () => {
    expect(README).toContain(`\`${CONTRASENA_DEMO}\``);
  });

  it.each(USUARIOS_DEMO.map((u) => [u.email]))('lista a %s', (email) => {
    expect(README).toContain(email);
  });

  it('los reportes que nombra el README existen en las semillas y son al menos seis', () => {
    const nombrados = [...README.matchAll(/`(rep-\d+)`/g)];
    expect(nombrados.length).toBeGreaterThanOrEqual(6);
    const ids = new Set(REPORTES_DEMO.map((r) => r.id));
    for (const m of README.matchAll(/`(rep-\d+)`/g)) {
      expect(ids.has(m[1]), m[1]).toBe(true);
    }
  });
});
