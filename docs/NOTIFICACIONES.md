# Notificaciones: la parte que programan ustedes

La API manda una push cuando un bloqueo cancela una reserva y cuando se libera un turno de un
espacio favorito. **Esa parte ya está decidida**: cuándo avisar, a quién y con qué texto. Lo
que falta, y les toca a ustedes, son dos piezas:

| Ya está hecho (la API) | Lo programan ustedes |
|---|---|
| **Cuándo** y **a quién** se avisa (bloqueos, turnos liberados, que quien canceló no se avise a sí mismo). | **Guardar** los tokens de Expo de cada usuario: anotarlos, darlos de baja, buscarlos y descartar los que ya no sirven. |
| El **texto** de cada aviso y sus `datos`. | **Enviar** las push a la API de Expo y leer su respuesta. |
| Los endpoints `/dispositivos` (rutas, validaciones y respuestas). | |

Mientras no lo programen, `POST /dispositivos`, `DELETE /dispositivos/<tokenExpo>` y
`POST /dispositivos/prueba` responden `501 NO_IMPLEMENTADO`, y los avisos de la app (bloquear un
día, cancelar una reserva) siguen funcionando: en el log de la API aparece
`Push pendiente de implementar: <título> → <n> usuarios`.

## Qué archivos tocar

| Archivo | Qué completar |
|---|---|
| `src/notificaciones-alumnos/almacen-tokens-por-hacer.ts` | `AlmacenTokensPorHacer`: `guardar`, `borrar`, `tokensDe` y `descartar`. |
| `src/notificaciones-alumnos/enviador-por-hacer.ts` | `EnviadorPorHacer`: `enviar`. |
| `src/comun/notificaciones/notificaciones.modulo.ts` | Sumar la entidad con `TypeOrmModule.forFeature([...])` si el almacén usa una tabla. |

Cada método tiene un comentario `// TODO(alumnos):` que dice qué tiene que lograr. **No hace
falta tocar nada más**: los controladores y el servicio `Avisos` ya usan estas dos piezas.

## Las dos piezas

### 1. Guardar los tokens

Cada teléfono tiene un token de Expo (`ExponentPushToken[...]`). Hay que guardarlo para
saber, cuando haya que avisarle a un usuario, a qué teléfonos mandar.

- **Qué guardar:** el token, de qué usuario es y la plataforma (`ios` o `android`). Un usuario
  puede tener varios teléfonos; un token es de un solo usuario a la vez.
- **Qué entidad y qué tabla les conviene crear:** una entidad `DispositivoEntidad` en una tabla
  `dispositivos` con el token como clave primaria (así no puede haber dos filas con el mismo
  token), una columna para el id del usuario (con índice, porque se busca por ahí) y una para la
  plataforma. Mirá cómo están hechas las otras entidades en `src/modulos/` y usá los helpers de
  `src/comun/db/columnas.ts`: tienen que andar igual en SQLite, PostgreSQL, MySQL y MariaDB.
- **Dos pedidos a la vez:** la base tiene que garantizar que no queden filas repetidas, no sólo un
  `if`. Fijate qué ofrece TypeORM para "insertar o actualizar" (`upsert`).
- Si el token ya estaba anotado a nombre de otro usuario, **pasa al usuario actual**.

### 2. Enviar las push

Expo recibe los mensajes por HTTP. Con `fetch` (ya viene con Node, no hace falta ninguna
librería) se le hace un `POST` con una lista de mensajes en JSON a `EXPO_PUSH_URL`, que ya llega
al enviador en `this.url`.

- **Un mensaje por token**, con los campos `to`, `title`, `body` y `data` (Expo usa esos nombres
  en inglés; `MensajePush` usa castellano).
- **Hasta 100 mensajes por pedido.** Si hay más, tandas.
- **La respuesta** trae `data`, una lista de tickets **en el mismo orden** que los mensajes
  mandados. Un ticket con `status: "error"` y `details.error` igual a `DeviceNotRegistered`
  quiere decir que ese teléfono ya no existe: devolvé su token en `tokensInvalidos` y la API lo
  descarta sola con `descartar`.
- Si Expo responde con un error HTTP, **no tires la excepción para arriba sin pensar**: leé
  qué pasa con `Avisos` (`src/comun/notificaciones/avisos.servicio.ts`) cuando algo falla.

## Cómo probar

### Los tests de la consigna

```bash
pnpm test:notificaciones
```

Prueban `/dispositivos` con la API completa y la base real, y el enviador contra un servidor que
se hace pasar por Expo (no sale a internet). Cada `describe` dice en castellano qué tiene que
lograr cada cosa. Están en `test/notificaciones/`. Al principio fallan todos; cuando terminen,
tienen que pasar todos. Estos tests no forman parte de `pnpm verificar`.

### Con el teléfono

1. Levantá la API (`pnpm dev` o `docker compose up`) con `NOTIFICACIONES=expo` en el `.env`
   (con `registro` sólo escribe en el log y no usa su enviador).
2. En la app, con Expo Go, pedí permiso para notificaciones y obtené el token con
   `Notifications.getExpoPushTokenAsync()`. Mandalo con `POST /dispositivos`
   (`{ "tokenExpo": "ExponentPushToken[...]", "plataforma": "android" }`) con la sesión iniciada.
3. Probá con `POST /dispositivos/prueba`: tiene que llegar una notificación al teléfono y la
   respuesta dice a cuántos teléfonos se mandó.
4. Probá el flujo real: con un usuario encargado, bloqueá un turno que tenga una reserva
   confirmada de otra persona (la que tiene el token): le tiene que llegar el aviso.

Una **push de verdad** necesita un teléfono real o un emulador con servicios de Google. Con un
token inventado, Expo contesta `DeviceNotRegistered`.

## Documentación

- Cómo se manda: <https://docs.expo.dev/push-notifications/sending-notifications/>
- Cómo se obtiene el token en la app: <https://docs.expo.dev/push-notifications/push-notifications-setup/>
- Herramienta para probar sin código: <https://expo.dev/notifications>
- Errores de Expo (`DeviceNotRegistered` y compañía): sección "Errors" de la primera página.
