# Decisiones

Huecos del PRD y cómo se resolvieron. Cada entrada tiene un estado:

- **CERRADA**: la decidió la cátedra. Se implementa tal cual.
- **PROVISORIA**: default de `ESPECIFICACION.md`, implementado a la espera de confirmación.
- **PENDIENTE**: no se implementa hasta que se decida.

Formato:

```
### <id> — <título>
Estado: CERRADA | PROVISORIA | PENDIENTE
Hueco: qué no dice el PRD (con sección).
Opciones: A) … B) …
Decisión: …
Consecuencia en el contrato: qué ve la app (ruta, código de error, valor de un campo).
```

---

## Decisiones comunes a los cinco proyectos

### C1 — `meta` en la respuesta de un solo recurso
Estado: CERRADA
Hueco: el PRD muestra el sobre sólo para listas.
Decisión: `{ "datos": { … }, "meta": null }`. `meta` va en `null` y no ausente, por la regla
de nulos del propio PRD.

### C2 — `DELETE` exitoso
Estado: CERRADA
Decisión: 204 sin cuerpo. Es la única respuesta sin sobre.

### C3 — Esquema sin migraciones
Estado: CERRADA
Decisión: el esquema se genera desde las entidades (`synchronize`) y `pnpm db:reiniciar`
reconstruye todo. Las migraciones escritas a mano quedan distintas en cada motor
(verificado); los datos son descartables.

### C4 — Duración de la sesión
Estado: CERRADA
Decisión: JWT de 30 días, sin refresh. El teléfono lo guarda en `expo-secure-store` y el
reingreso con huella lo desbloquea localmente.

### C5 — Archivos en dos pasos
Estado: CERRADA
Decisión: `POST /archivos` devuelve una URL; el recurso se crea después con esa URL. Encaja
con la cola offline: la foto se sube cuando vuelve la señal y recién ahí el recurso.

### C6 — Recordatorios locales
Estado: CERRADA
Decisión: los recordatorios que dependen sólo del usuario ("X minutos antes", proximidad) son
notificaciones locales del teléfono. La API manda push sólo por hechos que ocurren en el
servidor (un cambio de estado, algo nuevo publicado, algo cancelado por otro).

---

## Decisiones de este proyecto

<!-- Copiar acá las entradas "D…" de ESPECIFICACION.md a medida que se implementan. -->

Ninguna de las decisiones D1–D13 de `ESPECIFICACION.md` toca el módulo M0: se copian acá a
medida que los módulos que las usan se implementan.

---

## Decisiones tomadas al implementar (modo autónomo)

Huecos que no estaban en ningún documento. Se eligió la opción más conservadora (no agrega
campos al PRD, no cambia formas) y se dejan las alternativas para que la cátedra decida.

### A1 — Forma de las respuestas de `/dispositivos` (M0)
Estado: PROVISORIA (autónomo)
Hueco: AGENTS §9 define las rutas de `/dispositivos` pero no qué devuelven.
Opciones: A) `POST /dispositivos` → 201 `{ tokenExpo, plataforma }` y `POST /dispositivos/prueba`
→ 200 `{ dispositivos: <cantidad> }`. B) 204 sin cuerpo en los dos. C) devolver el `Usuario`.
Decisión: A. Los tipos `Dispositivo` y `PruebaPush` se agregan a `contrato/api.ts` (no al PRD).
`DELETE /dispositivos/:tokenExpo` → 204 aunque el token no estuviera registrado.
Consecuencia en el contrato: dos tipos nuevos en `contrato/api.ts`.

### A2 — `DELETE /dispositivos/:tokenExpo` con el token de otra cuenta (M0)
Estado: PROVISORIA (autónomo)
Opciones: A) 204 sin efecto. B) 403 `SIN_PERMISO`. C) borrarlo igual.
Decisión: A. No borra el teléfono de otra persona y no revela si ese token existe.

### A3 — La push de prueba ignora `avisosActivos` (M0)
Estado: PROVISORIA (autónomo)
Decisión: `POST /dispositivos/prueba` se manda aunque el usuario tenga los avisos apagados:
es una herramienta para depurar y la pide el propio usuario. Los avisos de negocio sí lo respetan.

### A4 — Formato del token de Expo (M0)
Estado: PROVISORIA (autónomo)
Decisión: se acepta `ExponentPushToken[…]` o `ExpoPushToken[…]`, hasta 200 caracteres. Otro
formato → 400 `VALIDACION_FALLIDA`. Alternativa descartada: aceptar cualquier texto (Expo
respondería error recién al mandar).

### A5 — Pedidos con `Range` raros (M0)
Estado: PROVISORIA (autónomo)
Hueco: AGENTS §8 pide soporte de `Range` pero no dice qué hacer con un rango imposible.
Decisión: según RFC 9110 — un `Range` que no se entiende (o con varios rangos) se ignora y va el
archivo entero (200); uno que empieza después del final da **416 `RANGO_NO_SATISFACIBLE`**
("No pudimos leer esa parte del archivo.") con `Content-Range: bytes */<total>`.
Consecuencia en el contrato: un código de error nuevo en el catálogo.

### A6 — Cuerpo JSON demasiado grande (M0)
Estado: PROVISORIA (autónomo)
Decisión: un cuerpo JSON de más de 1 MB da 400 `VALIDACION_FALLIDA` ("Los datos enviados son
demasiado largos."). Alternativa descartada: 413 `ARCHIVO_DEMASIADO_GRANDE`, cuyo mensaje habla
de fotos y videos.

### A7 — Token inválido en un endpoint público (M0)
Estado: PROVISORIA (autónomo)
Decisión: se ignora (el pedido sigue como anónimo), no da 401. Así un token vencido guardado
en el teléfono no rompe las pantallas que se ven sin cuenta.

### A8 — El vencimiento del token usa el reloj de la API (M0)
Estado: PROVISORIA (autónomo)
Decisión: `iat` y `exp` del JWT se calculan con el `Reloj` (AGENTS §6), y al verificar se usa el
mismo reloj. Con `RELOJ_FIJO`, los tokens emitidos siguen valiendo 30 días "de ese reloj".

### A9 — `favoritos` y `rubrosDeInteres` antes de M3 (M0)
Estado: PROVISORIA (autónomo)
Decisión: hasta M3 (Cuenta y favoritos) el `Usuario` viaja con `favoritos: []` y
`rubrosDeInteres: []`, y `PATCH /yo` acepta sólo `{ nombre? }`. M3 agrega las tablas y
`rubrosDeInteres` / `avisosActivos` en `PATCH /yo`. La forma del `Usuario` no cambia.

### A10 — Usuarios de demo (M0)
Estado: PROVISORIA (autónomo)
Decisión: todos con la contraseña `demo1234`. Ids: `usr-512` (Marta, del PRD), `usr-nuevo`,
`usr-tornillo` (`comercioId: "com-118"`) y `usr-otrocomercio` (`comercioId: "com-201"`, el
comercio que se siembra en M1).

### A11 — La compilación queda en `dist/src/main.js` (M0)
Estado: PROVISORIA (autónomo)
Hueco: AGENTS §16.1 dice `node dist/main.js`, pero el código importa los tipos de
`contrato/`, que está fuera de `src/`; TypeScript no deja compilar con `rootDir: src`.
Opciones: A) `rootDir: .` y arrancar con `node dist/src/main.js`. B) copiar los tipos a `src/`
(dos copias del contrato). C) project references.
Decisión: A. `pnpm start`, el `Dockerfile` y `nest start` ya usan esa ruta.

### A12 — Lo que todavía no está en M0 (M0)
Estado: PROVISORIA (autónomo)
Decisión: `ARCHIVOS_PROVEEDOR` acepta sólo `local` y `ENTORNO` sólo `desarrollo`/`test`; los
proveedores S3, `ENTORNO=publicado`, `DB_PROVEEDOR` y S3Proxy en `compose.matriz.yaml` llegan con
el módulo «Nube» (M8), que es donde los ubica `AGENTS.md` §17.5 y §18.4.


### A13 — Largo máximo de la contraseña (M0)
Estado: PROVISORIA (autónomo)
Hueco: AGENTS §7.2 fija el mínimo (8) pero no un máximo.
Decisión: hasta 100 caracteres ("La contraseña puede tener como máximo 100 caracteres."). Evita
que alguien mande textos enormes para que `scrypt` tarde. Alternativa: sin máximo.

### A14 — Pedido con un `Host` inválido (M0)
Estado: PROVISORIA (autónomo)
Hueco: AGENTS §8 arma las URLs con el `Host` del pedido pero no dice qué hacer si no es una dirección.
Decisión: 400 `VALIDACION_FALLIDA` ("La dirección a la que se hizo el pedido no es válida."),
salvo que esté `URL_PUBLICA`, que no depende del pedido. Vale para cualquier endpoint (también
`/salud`): un Host así no lo manda ningún teléfono. Con `CONFIAR_PROXY=true`, un
`X-Forwarded-Proto` que no es `https` se toma como `http`. Alternativa: usar un origen por defecto
(daría URLs que el teléfono no puede abrir).

### A15 — `X-Simular: demora-N` fuera de rango (M0)
Estado: PROVISORIA (autónomo)
Decisión: la demora tiene un tope de 30 segundos (`demora-99999999` espera 30 s); un valor que
no es un número entero positivo (`demora--5`) se ignora, como cualquier valor que no se entiende.
