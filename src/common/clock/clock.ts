// "Ahora" se pide siempre al Reloj inyectado (AGENTS §6). Es clase abstracta para usarla de token.
export abstract class Reloj {
  abstract ahora(): Date;
}
