// Variables de entorno de los tests. `DB_MOTOR` y `DB_URL` pueden venir de afuera (matriz).
process.env.ENTORNO = 'test';
process.env.JWT_SECRETO = 'secreto-solo-para-los-tests-de-la-api';
process.env.DB_MOTOR ??= 'better-sqlite3';
process.env.DB_ARCHIVO = ':memory:';
process.env.DB_SINCRONIZAR = 'true';
process.env.SIMULACION_HABILITADA = 'false';
process.env.NOTIFICACIONES = 'registro';
process.env.SEMBRAR_SI_VACIA = 'false';
delete process.env.RELOJ_FIJO;
delete process.env.URL_PUBLICA;
delete process.env.CONFIAR_PROXY;
