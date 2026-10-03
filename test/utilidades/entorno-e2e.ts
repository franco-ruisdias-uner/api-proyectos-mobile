// Se carga antes de cada archivo e2e (vitest.config.e2e.ts → setupFiles). Fija el entorno
// antes de importar las entidades: los helpers de columnas leen DB_MOTOR al cargarse.
// La matriz (scripts/matriz.mjs) cambia DB_MOTOR y DB_URL desde afuera.
process.env.DB_MOTOR ??= 'better-sqlite3';
process.env.ENTORNO = 'test';
