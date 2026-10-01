import { ExclusionPorClave } from './exclusion.js';

describe('ExclusionPorClave', () => {
  it('las operaciones de la misma clave corren de a una, en orden', async () => {
    const exclusion = new ExclusionPorClave();
    const eventos: string[] = [];
    const tarea = (nombre: string, ms: number) => async () => {
      eventos.push(`${nombre}:empieza`);
      await new Promise((r) => setTimeout(r, ms));
      eventos.push(`${nombre}:termina`);
    };
    await Promise.all([
      exclusion.ejecutar('a', tarea('1', 20)),
      exclusion.ejecutar('a', tarea('2', 1)),
      exclusion.ejecutar('a', tarea('3', 1)),
    ]);
    expect(eventos).toEqual([
      '1:empieza',
      '1:termina',
      '2:empieza',
      '2:termina',
      '3:empieza',
      '3:termina',
    ]);
  });

  it('claves distintas no se esperan, y un error no frena a la siguiente', async () => {
    const exclusion = new ExclusionPorClave();
    const falla = exclusion.ejecutar('a', () => Promise.reject(new Error('x')));
    const sigue = exclusion.ejecutar('a', () => Promise.resolve('ok'));
    await expect(falla).rejects.toThrow('x');
    await expect(sigue).resolves.toBe('ok');
    await expect(exclusion.ejecutar('b', () => Promise.resolve(1))).resolves.toBe(1);
  });
});
