/** Espec. §7: los usuarios que tienen alguna de las líneas del aviso como favorita, sin repetir. */
export function usuariosAvisados(
  favoritas: { usuarioId: string; lineaId: string }[],
  lineaIds: string[],
): string[] {
  const lineas = new Set(lineaIds);
  return [...new Set(favoritas.filter((f) => lineas.has(f.lineaId)).map((f) => f.usuarioId))];
}
