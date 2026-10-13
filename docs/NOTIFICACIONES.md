# Notificaciones push: la parte que programan ustedes

La API ya sabe **cuándo** y **a quién** avisar. Lo que falta, y les toca a ustedes, son dos piezas:

1. **Guardar los tokens de Expo** de cada usuario (un teléfono = un token).
2. **Mandar las push** a Expo.

Mientras no estén hechas, `POST /dispositivos`, `POST /dispositivos/prueba` y
`DELETE /dispositivos/:tokenExpo` responden **501 `NO_IMPLEMENTADO`** ("Esta parte la programan
ustedes. Mirá docs/NOTIFICACIONES.md."), y la API escribe en el log
`Push pendiente de implementar: Ruta nueva → 1 usuarios`. Todo lo demás (crear rutas, cargar
lecturas, cerrar) sigue andando: un aviso que no sale nunca rompe un pedido.

## Qué decide la API y qué les toca

| Lo hace la API (no lo toquen) | Lo programan ustedes |
|---|---|
| Cuándo y a quién se avisa (`Avisos`): hoy, al asignar una ruta a un lector. | Guardar los tokens, darlos de baja, buscarlos por usuario y descartar los inválidos. |
| El texto y los `datos` de cada aviso. | Mandar las push a Expo y leer su respuesta. |
| Los endpoints `/dispositivos`: la ruta, la validación del cuerpo y el contrato (`Dispositivo`, `PruebaPush`, en `contrato/api.ts`). | |

## Qué archivos tocar

Todo está en `src/notificaciones-alumnos/` y en el módulo de dispositivos:

| Archivo | Qué hacer |
|---|---|
| `src/notificaciones-alumnos/almacen-tokens-por-hacer.ts` | `AlmacenTokensPorHacer`: completar `guardar`, `borrar`, `tokensDe` y `descartar`. Cada método tiene un `TODO(alumnos)` que explica qué tiene que lograr. |
| `src/notificaciones-alumnos/enviador-por-hacer.ts` | `EnviadorPorHacer`: completar `enviar`. Recibe la URL de Expo (`EXPO_PUSH_URL`) en el constructor. |
| `src/modulos/dispositivos/dispositivos.modulo.ts` | Registrar la entidad que creen con `TypeOrmModule.forFeature([...])`. |

Van a necesitar **una entidad nueva** de TypeORM para los dispositivos. Una tabla `dispositivos` alcanza.
Pensala con estas reglas:

- el **token** es único (no puede haber dos filas con el mismo);
- cada token pertenece a **un** usuario: si dos usuarios comparten el teléfono (turnos), el token pasa al
  que ingresó último;
- dos pedidos simultáneos con el mismo token tienen que dejar **una** sola fila (pista: un índice único
  en la base, no sólo un `if`);
- usá sólo tipos de columna portables, los de `src/comun/db/columnas.js` (`ColumnaTexto`, `ColumnaEnum`,
  `ColumnaInstante`): la API tiene que andar igual en SQLite, PostgreSQL, MySQL y MariaDB;
- la fecha de actualización sale de `Reloj` (`src/comun/reloj/`), nunca de `new Date()`.

Para el envío, **no instalen librerías**: alcanza con `fetch`. Mirá la documentación de Expo (enlaces abajo):
los mensajes van en una lista, hay un máximo de mensajes por pedido, y la respuesta trae un "ticket" por
mensaje que dice si salió bien o si el token ya no existe.

## Cómo comprobar que lo lograron

```bash
pnpm test:notificaciones
```

Corre la consigna, que está en `test/notificaciones/`. Al principio da **rojo** y es lo esperado. Cada
`describe` dice en castellano qué tiene que lograr:

- **Consigna 1** (`dispositivos.e2e-spec.ts`, `verificacion-dispositivos.e2e-spec.ts`): los tres endpoints
  de `/dispositivos`: alta (201), idempotente, el token pasa al usuario actual, baja (204), la prueba y los
  errores de validación.
- **Consigna 2** (`enviador.spec.ts`): el enviador contra un servidor falso de Expo: la forma de cada
  mensaje, las tandas y los tokens inválidos (`DeviceNotRegistered`).

No cambien esos tests. `pnpm verificar` tiene que seguir en verde: no lo rompan.

## Cómo probarlo con un teléfono

1. Levantá la API (`pnpm dev`) con `NOTIFICACIONES=expo` en el `.env` (con `registro` sólo se escribe en
   la consola).
2. En la app, con Expo Go en un teléfono real (los simuladores no reciben push), pedí el token con
   `expo-notifications` y mandalo con `POST /dispositivos` `{ tokenExpo, plataforma }`.
3. Probá con `POST /dispositivos/prueba`: tiene que sonar el teléfono, y la respuesta dice a cuántos
   dispositivos se mandó.
4. Para ver el aviso real: como administración, creá una ruta con `POST /rutas` asignada a ese lector.

## Enlaces

- Cómo mandar notificaciones y qué responde Expo (tickets y errores):
  https://docs.expo.dev/push-notifications/sending-notifications/
- Pedir el token en la app: https://docs.expo.dev/push-notifications/push-notifications-setup/
- Probar sin código con la herramienta de Expo: https://expo.dev/notifications
- Entidades de TypeORM: https://typeorm.io/docs/entity/entities
