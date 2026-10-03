/** PRD §3 / ESPECIFICACION §7: quién recibe el aviso de una promo nueva. Una sola vez por persona, sin el autor. */
export function destinatariosDePromocion(
  quienLoTieneDeFavorito: string[],
  quienTieneSuRubro: string[],
  autorId: string,
): string[] {
  return [...new Set([...quienLoTieneDeFavorito, ...quienTieneSuRubro])].filter(
    (id) => id !== autorId,
  );
}

/** El texto del aviso y a qué pantalla lleva (la app abre la promo). */
export function avisoDePromocion(
  comercio: { id: string; nombre: string },
  promo: { id: string; titulo: string },
) {
  return {
    titulo: comercio.nombre,
    cuerpo: `Nueva promoción: ${promo.titulo}`,
    datos: { tipo: 'promocion', promocionId: promo.id, comercioId: comercio.id },
  };
}
