# Notificaciones push: la parte que programan ustedes

La API está terminada **salvo dos piezas**, que les tocan a ustedes: **guardar los tokens de Expo** de cada
teléfono y **mandar las push** a Expo. Mientras no las programen, los tres endpoints de `/dispositivos`
responden `501 NO_IMPLEMENTADO` ("Esta parte la programan ustedes. Mirá docs/NOTIFICACIONES.md."). El resto de la
API anda normal: publicar un aviso, por ejemplo, no se rompe; sólo escribe en el log
`Push pendiente de implementar: <título> → <n> usuarios`.

## Qué decide la API y qué les toca a ustedes

| Lo sigue haciendo la API | Lo programan ustedes |
|---|---|
| **Cuándo** y **a quién** se avisa: se publica un aviso → quienes tienen esa línea como favorita y `avisosActivos`. | **Guardar** los tokens de Expo de cada usuario, darlos de baja, buscarlos y descartar los inválidos. |
| El **texto** de cada aviso y los `datos` (a qué pantalla lleva). | **Enviar** las push a Expo y leer su respuesta. |
| Los endpoints `/dispositivos` (misma ruta y mismo contrato que verán en Swagger). | |

Para el resto de la API (`Avisos`) las dos piezas son cajas negras: le piden "dame los tokens de estos usuarios" y
"mandá este mensaje". Por eso lo que programen se enchufa sin tocar nada más.

## Qué archivos tocar

Todo está en `src/notificaciones-alumnos/`:

| Archivo | Qué completar |
|---|---|
| `almacen-tokens-por-hacer.ts` | Los cuatro métodos de `AlmacenTokensPush`: `guardar`, `borrar`, `tokensDe` y `descartar`. |
| `enviador-por-hacer.ts` | El método `enviar` de `EnviadorPush`. |
| `notificaciones-alumnos.modulo.ts` | Si crean una entidad, agréguenla con `TypeOrmModule.forFeature([…])`. |

Cada método tiene un comentario `TODO(alumnos)` que dice qué tiene que lograr. Las interfaces están en
`src/comun/notificaciones/puertos.ts`: **no se cambian**.

Pistas:

- **Qué tabla crear.** Con una entidad de TypeORM alcanza: un token de Expo por fila (el token es único), con el
  usuario dueño y la plataforma. Miren cómo están hechas las otras entidades (`src/modulos/**/*.entidad.ts`) y los
  tipos de columna permitidos en `AGENTS.md` §5.3. El esquema se crea solo al arrancar (`synchronize`).
- **Registrar dos veces el mismo token** no tiene que duplicar nada, y si el token era de otra persona, pasa a la
  actual. Dos pedidos simultáneos tampoco pueden dejar dos filas: piensen qué garantiza eso en la base.
- **Mandar a Expo** es un `POST` con JSON a la dirección que dice la variable `EXPO_PUSH_URL` (en el código:
  `config.expoPushUrl`, inyectando `CONFIGURACION`). Node ya trae `fetch`; no hace falta ninguna librería.
- **Tandas.** Expo acepta hasta 100 mensajes por pedido. Un `MensajePush` trae varios tokens: a Expo le van mensajes
  de a uno por teléfono.
- **La respuesta de Expo** trae un "ticket" por mensaje, en el mismo orden. Los que fallan con
  `DeviceNotRegistered` son teléfonos que ya no existen: devuélvanlos en `tokensInvalidos` y la API los descarta.
- Si Expo no responde bien, que `enviar` **falle con un error**: `Avisos` lo registra y no rompe el pedido.

## Cómo probar

```bash
pnpm test:notificaciones
```

Corre la consigna (`test/notificaciones/`) contra una copia de la API y un **Expo de mentira** que levanta el propio
test, así que no sale a internet. Al empezar da rojo; cuando completan una pieza se ponen verdes los tests de esa
parte. Cada `describe` dice en castellano qué tiene que lograr. `pnpm verificar` (el resto de la API) tiene que seguir
verde todo el tiempo.

### Con el teléfono (Expo Go)

1. Levantá la API (`pnpm dev`) y conectá la app como dice el README.
2. En la app, pedí permiso y obtené el token con `expo-notifications`.
3. `POST /dispositivos` con `{ "tokenExpo": "ExponentPushToken[…]", "plataforma": "android" }` y tu sesión.
4. `POST /dispositivos/prueba`: te tiene que llegar una notificación al teléfono.
5. Para ver un aviso real: entrá con `transporte@parana.demo.ar` (Dirección), publicá un aviso en una línea que tenga
   favorita la cuenta del teléfono (`POST /avisos`) y mirá cómo llega.

## Enlaces

- Enviar notificaciones (formato del pedido, tickets y errores):
  <https://docs.expo.dev/push-notifications/sending-notifications/>
- Obtener el token en la app: <https://docs.expo.dev/push-notifications/push-notifications-setup/>
- Preguntas frecuentes (`DeviceNotRegistered`, recibos): <https://docs.expo.dev/push-notifications/faq/>
- `fetch` en Node: <https://developer.mozilla.org/es/docs/Web/API/Fetch_API>
