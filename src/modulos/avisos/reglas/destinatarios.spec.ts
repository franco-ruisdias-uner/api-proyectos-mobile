import { usuariosAvisados } from './destinatarios.js';

describe('Espec. §7 — quién recibe la push de un aviso', () => {
  const favoritas = [
    { usuarioId: 'usr-1', lineaId: 'lin-05' },
    { usuarioId: 'usr-1', lineaId: 'lin-07' },
    { usuarioId: 'usr-2', lineaId: 'lin-07' },
    { usuarioId: 'usr-3', lineaId: 'lin-14' },
  ];

  it('quienes tienen alguna de las líneas, una sola vez cada uno', () => {
    expect(usuariosAvisados(favoritas, ['lin-05', 'lin-07'])).toEqual(['usr-1', 'usr-2']);
  });

  it('nadie, si ninguna es favorita', () => {
    expect(usuariosAvisados(favoritas, ['lin-99'])).toEqual([]);
  });
});
