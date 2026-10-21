# Notificaciones: la parte que programan ustedes

La API ya sabe **cuándo** y **a quién** avisar. A ustedes les toca lo que falta para que la push
llegue de verdad al teléfono: **guardar los tokens de Expo** y **mandar los mensajes a Expo**.

## Qué hace la API y qué les toca a ustedes

| Ya está hecho | Lo programan ustedes |
|---|---|
| Decidir cuándo se avisa (promo nueva de un favorito o de un rubro de interés), a quién, y respetar `avisosActivos`. | **Guardar** los tokens de cada usuario, darlos de baja, buscarlos y descartar los inválidos. |
| El texto de cada aviso y sus `datos`. | **Enviar** las push a Expo y leer qué contestó. |
| Las rutas `/dispositivos`, sus validaciones y su contrato. | |

Hoy `POST /dispositivos`, `DELETE /dispositivos/:tokenExpo` y `POST /dispositivos/prueba` responden
**501 `NO_IMPLEMENTADO`**. El resto de la app anda igual: cuando un comercio crea una promo, la API
escribe en el log `Push pendiente de implementar` y sigue.

## Qué archivos tocar

Todo está en `src/student-notifications/`. No hace falta tocar nada fuera de esa carpeta.

- `almacen-tokens-por-hacer.ts`: cuatro métodos (`guardar`, `borrar`, `tokensDe`, `descartar`). Cada
  uno tiene un `// TODO(alumnos):` que dice qué tiene que lograr. Cuando completen uno, saquen el `throw`.
- `enviador-por-hacer.ts`: un método, `enviar`. Recibe `url` (la dirección de la API de Expo).
- `student-notifications.module.ts`: si guardan los tokens en una tabla, registren ahí su entidad.

**Qué tabla les conviene:** una tabla `dispositivos` con el token de Expo como clave primaria
(no se repite), el id del usuario dueño, la plataforma (`ios` o `android`) y cuándo se actualizó.
Que el token sea la clave hace que el «si ya existía, no se duplica» salga solo. Acuérdense de las
reglas del proyecto: tipos de columna portables (`src/common/db/columns.ts`) y nada de SQL a mano.

## Cómo probar

```bash
pnpm test:notificaciones
```

Corre la consigna en `test/notifications/`. Al principio da **rojo**; cada `describe` dice en
castellano qué tienen que lograr. Cuando todo dé verde, corré también `pnpm verificar` para asegurarse
de que no rompieron nada.

Con el teléfono:

1. Levantá la API (`pnpm dev`) con `NOTIFICACIONES=expo` y entrá desde la app con una cuenta.
2. La app registra su token con `POST /dispositivos`.
3. Probá con `POST /dispositivos/prueba`: tendría que sonar el teléfono.
4. Con el comercio `tornillo@demo.ar`, creá una promo y mirá que le llegue a quien tiene a
   `com-118` en favoritos.

Las push **no llegan al simulador de iOS** ni a Expo Go sin un proyecto de Expo configurado; usen un
teléfono real.

## Pistas

- La API de Expo recibe un `POST` con una lista de mensajes (hasta 100 por pedido) y devuelve un
  «ticket» por cada uno, en el mismo orden. Un ticket con `status: "error"` y
  `details.error: "DeviceNotRegistered"` significa que ese token ya no sirve y hay que borrarlo.
- Los mensajes de Expo usan `to`, `title`, `body`, `data` y `sound`. Nuestros `MensajePush` usan
  otros nombres y traen una lista de tokens: tienen que traducir.
- Un error de Expo (red caída, 500) **no** tiene que romper el pedido de nadie: se anota y se sigue.
- Dos pedidos a la vez con el mismo token no pueden dejar dos filas.

## Documentación

- Cómo mandar notificaciones: <https://docs.expo.dev/push-notifications/sending-notifications/>
- Cómo obtener el token en la app: <https://docs.expo.dev/push-notifications/push-notifications-setup/>
- Códigos de error de los tickets: <https://docs.expo.dev/push-notifications/sending-notifications/#push-ticket-format>
