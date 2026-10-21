// El entorno de los tests. Vitest lo pone en process.env antes de importar nada (`test.env` en
// cada vitest.config), porque ConfigModule valida las variables cuando se importa AppModule.
// Lo que cambia de una app a otra lo pasa crearApp({ entorno }).
export const ENTORNO_DE_PRUEBA = {
  APP_ENV: 'test',
  JWT_SECRET: 'secreto-de-los-tests-no-es-de-verdad',
  LOG_LEVEL: 'error',
  // Los tests hacen cientos de pedidos e ingresos por segundo desde la misma IP.
  THROTTLE_LIMIT: '1000000',
  LOGIN_THROTTLE_LIMIT: '1000000',
};
