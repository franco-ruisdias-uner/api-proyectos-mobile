// Normalización para búsquedas portables (AGENTS §5.5): minúsculas, sin tildes,
// espacios colapsados. "  Colón " → "colon".
export function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Email tal como se guarda: sin espacios alrededor y en minúsculas. */
export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}
