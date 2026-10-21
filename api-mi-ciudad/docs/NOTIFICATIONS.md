# Notificaciones push: la parte que programan ustedes

La API ya sabe **cuándo** y **a quién** avisar. Lo que falta, y les toca a ustedes, son dos
piezas chicas: **guardar los tokens de Expo** de cada teléfono y **mandar las push** a Expo.

Mientras no las hagan, los flujos de la app no se rompen: cuando el admin suspende un evento, la
API anota en el log `Push pendiente de implementar: Evento suspendido → 3 usuarios` y sigue.
Lo único que responde distinto son los tres endpoints de `/dispositivos`, que dan
**501 `NO_IMPLEMENTADO`** hasta que los completen.

## Qué hace la API y qué hacen ustedes

| La API ya lo hace | Lo programan ustedes |
|---|---|
| Decide **cuándo** se avisa y **a quién** (por ejemplo, a quienes guardaron un evento que se suspendió). | **Guardar** los tokens de Expo de cada usuario, darlos de baja, buscarlos y descartar los inválidos. |
| Escribe el **texto** de cada aviso y los `datos` que lo acompañan. | **Enviar** las push a Expo y leer su respuesta. |
| Los endpoints `/dispositivos`: misma ruta y mismo contrato que en `contract/api.ts`. | |
| No rompe nunca el pedido si algo de esto falla: lo anota en el log y sigue. | |

## Dónde se toca

Todo está en **`src/student-notifications/`**:

| Archivo | Qué hay que hacer |
|---|---|
| `todo-token-store.ts` | Implementar `AlmacenTokensPush` (`src/common/notifications/ports.ts`): `guardar`, `borrar`, `tokensDe` y `descartar`. |
| `todo-sender.ts` | Implementar `EnviadorPush`: `enviar`. |
| `student-notifications.module.ts` | Registrar sus clases y, si usan una tabla nueva, `TypeOrmModule.forFeature([...])`. |

No hace falta tocar nada fuera de esa carpeta. Los comentarios `// TODO(alumnos):` de cada
método explican qué tiene que lograr, sin darles el código.

Les conviene crear **una entidad y una tabla** propias para los tokens (por ejemplo
`dispositivos`). Pistas: el token de Expo es único; un usuario puede tener varios teléfonos; un
teléfono que cambia de dueño (otra cuenta en el mismo aparato) pasa al usuario actual. Las
reglas de columnas y de unicidad son las de siempre (`AGENTS.md` §5 si lo tienen, o miren las
entidades de `src/modules/`).

## Cómo probarlo

```bash
pnpm test:notificaciones
```

Corre contra la API real y contra un servidor que se hace pasar por Expo (no sale a internet ni
necesita un teléfono). Cada `describe` dice en castellano qué tiene que lograr cada parte. Al
principio está **todo en rojo**; el objetivo es que quede en verde. `pnpm verificar` tiene que
seguir en verde todo el tiempo.

Para el servidor falso, la API lee la dirección de Expo de la variable `EXPO_PUSH_URL`
(por defecto `https://exp.host/--/api/v2/push/send`): usen `this.entorno.EXPO_PUSH_URL`, no la
escriban fija en el código. La variable `NOTIFICACIONES` (`expo` o `registro`) sirve para elegir
entre mandar de verdad o sólo escribir en el log.

## Cómo probarlo con un teléfono (Expo Go)

1. En la app, pedí permiso y obtené el token con `expo-notifications`
   (`getExpoPushTokenAsync`). Tiene la forma `ExponentPushToken[xxxx]`.
2. Mandalo a la API: `POST /dispositivos` con `{ "tokenExpo": "...", "plataforma": "android" }` y
   tu sesión (`Authorization: Bearer <token>`).
3. Probá con `POST /dispositivos/prueba`: tiene que sonar el teléfono.
4. Probá el flujo real: guardá un evento, ingresá como admin
   (`turismo@colon.demo.ar`) y suspendelo con `PATCH /eventos/:id/estado`.

En la API publicada, las push sólo llegan a un build con credenciales de Expo (FCM / APNs); en
Expo Go andan los tokens de desarrollo.

## Lo que tienen que respetar de Expo

- Se manda con `POST` a la URL de Expo, con `Content-Type: application/json` y un **arreglo** de
  mensajes: `[{ "to": "<token>", "title": "...", "body": "...", "data": { ... } }]`.
- **Hasta 100 mensajes por pedido.** Con más, Expo rechaza el pedido entero: hay que partir en
  tandas.
- La respuesta es `{ "data": [ticket, ...] }` con **un ticket por mensaje, en el mismo orden**.
  Un ticket `{ "status": "error", "details": { "error": "DeviceNotRegistered" } }` quiere decir
  que ese teléfono ya no existe (desinstalaron la app, por ejemplo): hay que **dejar de mandarle**,
  o sea, devolver ese token en `tokensInvalidos`.
- Un error de red o de Expo **no puede romper el pedido** de quien usa la app: lo anotan en el
  log (`Logger` de Nest) y devuelven lo que puedan.

## `POST /dispositivos`: 201 o 200

`guardar` devuelve `{ nuevo: true }` si el token no existía (la API responde 201) y
`{ nuevo: false }` si ya estaba, sea del mismo usuario o de otro (200).

## Documentación

- Enviar notificaciones: <https://docs.expo.dev/push-notifications/sending-notifications/>
- Obtener el token en la app: <https://docs.expo.dev/push-notifications/push-notifications-setup/>
- Formato de tickets y errores (`DeviceNotRegistered`): misma página de «sending notifications»
- Probar tus push a mano: <https://expo.dev/notifications>
