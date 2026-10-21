# Notificaciones push: la parte que programan ustedes

La API ya sabe **cuándo** y **a quién** avisar. Falta lo que hace que el aviso llegue: guardar los
tokens de Expo de cada teléfono y mandar las push. Eso lo programan ustedes.

## Qué decide la API y qué les toca

| Ya hecho (no lo toquen) | Lo programan ustedes |
|---|---|
| Cuándo se avisa (cambia el estado de un reporte, alguien se suma), a quién (el autor), el interruptor `avisosActivos` y el texto de cada aviso. | **Guardar** los tokens de Expo de cada usuario, darlos de baja, buscarlos y descartar los inválidos. |
| El servicio `Avisos` y los endpoints `/dispositivos` (misma ruta y mismo contrato). | **Enviar** las push a Expo y leer su respuesta. |

Mientras no esté programado, `POST /dispositivos`, `DELETE /dispositivos/:tokenExpo` y
`POST /dispositivos/prueba` responden **501 `NO_IMPLEMENTADO`**, y las push que la API quiere
mandar quedan anotadas en la consola (`Push pendiente de implementar: …`). Lo demás de la API
sigue andando.

## Qué archivos tocar

Todo está en `src/student-notifications/`:

- `todo-token-store.ts` — `AlmacenTokensPorHacer`: `guardar`, `borrar`, `tokensDe` y
  `descartar`. Cada método tiene un `TODO(alumnos)` que dice qué tiene que lograr.
- `todo-sender.ts` — `EnviadorPorHacer`: `enviar`.

Los puertos (las interfaces que tienen que cumplir) están en
`src/common/notificaciones/puertos.ts`, y el cableado en
`src/common/notificaciones/notificaciones.module.ts`. Cuando programen una clase, sacá el
`PuertoSinImplementar` y registrá la clase en ese módulo en lugar de la `...PorHacer`.

## Pistas

- **Dónde guardar los tokens.** Necesitan una tabla propia. Creen una entidad de TypeORM (miren
  cómo son las de `src/modules/`) con, al menos, el token, el usuario dueño y la plataforma. Un
  token es de **un solo usuario a la vez**: si otro usuario lo registra, pasa a ése. Registrá la
  entidad con `TypeOrmModule.forFeature([...])` en el módulo de notificaciones. No hay
  migraciones: el esquema se crea solo al arrancar (`pnpm db:reiniciar` lo vuelve a armar).
- **Que se pueda repetir.** La app puede mandar el mismo token dos veces, incluso a la vez.
  Piensen qué pasa si dos pedidos llegan juntos: ¿alcanza con un `if`?
- **Cómo mandar.** Usen `fetch` (viene con Node) para hacer un `POST` con JSON a `this.url`
  (variable `EXPO_PUSH_URL`). El cuerpo es una lista de mensajes de Expo: `to` (el token),
  `title`, `body` y `data`. Un mensaje por token. Expo acepta **hasta 100 por pedido**.
- **Qué contesta Expo.** `{ "data": [ { "status": "ok", "id": "..." } | { "status": "error",
  "message": "...", "details": { "error": "DeviceNotRegistered" } } ] }`: un "ticket" por
  mensaje, **en el mismo orden**. `DeviceNotRegistered` significa que ese token ya no sirve:
  devolvelo en `tokensInvalidos` y la API lo descarta.
- **Si algo sale mal**, no tiren el error: anótenlo en el log y sigan. Una push que falla nunca
  tiene que romper lo que el usuario estaba haciendo.

## Cómo saber si les salió

```bash
pnpm test:notificaciones
```

Corre la consigna (`test/notifications/`) contra un servidor que se hace pasar por Expo: no
sale a internet. Cada `describe` dice en castellano qué tienen que lograr. Empieza en rojo.
`pnpm verificar` (el resto de la API) tiene que seguir en verde.

## Probar con un teléfono

1. Levantá la API (`pnpm dev`) y abrí la app con Expo Go (un teléfono real: el simulador de iOS
   no recibe push).
2. Ingresá, y que la app registre el token (`getExpoPushTokenAsync()` de `expo-notifications`) con
   `POST /dispositivos`.
3. Pedí `POST /dispositivos/prueba` (en `/docs` o con curl): tiene que sonar el teléfono. Con
   `avisosActivos: false` (`PATCH /yo`) no tiene que llegar nada.
4. Para ver el flujo completo: con una cuenta de operador, cambiá el estado de un reporte del
   usuario con el teléfono registrado.

## Enlaces

- Enviar notificaciones: <https://docs.expo.dev/push-notifications/sending-notifications/>
- API del servicio push de Expo: <https://docs.expo.dev/push-notifications/overview/>
- Errores de los tickets (`DeviceNotRegistered`): sección «Push ticket errors» de la primera
  página.
