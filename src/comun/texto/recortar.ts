/** Para `@Transform`: saca los espacios de las puntas a los textos y deja lo demás como vino. */
export const recortar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
