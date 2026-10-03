import { avisoDePromocion, destinatariosDePromocion } from './avisos.js';

describe('PRD §3 — Aviso por promo nueva: a quién', () => {
  it.each([
    [['a', 'b'], ['c'], 'x', ['a', 'b', 'c']],
    [['a', 'b'], ['b', 'c'], 'x', ['a', 'b', 'c']], // una sola push por persona
    [[], [], 'x', []],
    [['a', 'x'], ['x'], 'x', ['a']], // el autor no se avisa a sí mismo
  ])('favoritos %j + rubro %j (autor %s) → %j', (favoritos, rubro, autor, esperado) => {
    expect(destinatariosDePromocion(favoritos, rubro, autor)).toEqual(esperado);
  });
});

describe('PRD §3 — Aviso por promo nueva: el texto', () => {
  it('lleva el comercio y el título, y la pantalla de la promo', () => {
    expect(
      avisoDePromocion(
        { id: 'com-118', nombre: 'Ferretería El Tornillo' },
        { id: 'pro-9', titulo: '15% en pinturas' },
      ),
    ).toEqual({
      titulo: 'Ferretería El Tornillo',
      cuerpo: 'Nueva promoción: 15% en pinturas',
      datos: { tipo: 'promocion', promocionId: 'pro-9', comercioId: 'com-118' },
    });
  });
});
