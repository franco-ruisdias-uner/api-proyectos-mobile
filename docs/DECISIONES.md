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

### D7 — El `Usuario` no tiene interruptor de avisos
Estado: PROVISORIA
Hueco: AGENTS §9 pide respetar `avisosActivos`, pero el `Usuario` de este PRD no lo tiene.
Opciones: A) notificar siempre; B) agregar un campo (rompe el contrato).
Decisión: A. `Avisos.avisar` no filtra por interruptor. Para dejar de recibir avisos de un
espacio, se lo saca de favoritos (M6).
Consecuencia en el contrato: ninguna.

### M0-1 — Tipos `Dispositivo` y `PruebaDePush` en `contrato/api.ts`
Estado: PROVISORIA (autónomo)
Hueco: AGENTS §9 define `POST /dispositivos` y `POST /dispositivos/prueba` pero no la forma
de su respuesta.
Opciones: A) devolver el dispositivo `{ tokenExpo, plataforma }` y `{ dispositivos: n }`;
B) responder 204 sin cuerpo (rompe la regla de que sólo `DELETE` va sin sobre).
Decisión: A, con los dos tipos publicados en `contrato/api.ts`. `POST /dispositivos` responde
201 también cuando el token ya estaba (idempotente; si era de otro usuario, pasa al actual).
`DELETE /dispositivos/:tokenExpo` responde 204 aunque el token no estuviera. Si el token es
de otro usuario, también 204 pero **no se borra** (descartado: 403 `SIN_PERMISO`, que le
confirmaría a cualquiera que ese token existe y es de alguien).
Consecuencia en el contrato: dos tipos nuevos en `contrato/api.ts`.

### M0-2 — Rango de bytes imposible
Estado: PROVISORIA (autónomo)
Hueco: AGENTS §8 pide `Range` pero no dice qué hacer con un rango fuera del archivo.
Opciones: A) 416 con código propio; B) ignorar el rango y mandar el archivo entero.
Decisión: A. `RANGO_NO_VALIDO` (416), con `Content-Range: bytes */<total>` como pide HTTP.
Consecuencia en el contrato: un código de error nuevo.

### M0-3 — Token válido de un usuario que ya no existe
Estado: PROVISORIA (autónomo)
Hueco: después de `pnpm db:reiniciar` los tokens viejos siguen bien firmados.
Opciones: A) `NO_AUTENTICADO` (401) para que la app pida ingresar de nuevo; B) `USUARIO_NO_ENCONTRADO` (404).
Decisión: A: es lo que la app ya sabe manejar.
Consecuencia en el contrato: ninguna (código existente).

### M0-4 — `PATCH /yo` queda para M6
Estado: PROVISORIA (autónomo)
Hueco: AGENTS §7.1 pone `PATCH /yo` en la base, pero ESPECIFICACION §4 lo pone en M6 con
cuerpo `{ nombre?, telefono? }`.
Decisión: manda la especificación: M0 trae `GET /yo` y `PATCH /yo` llega en M6.
`espaciosFavoritos` sale `[]` hasta que M6 agregue la tabla de favoritos.
Consecuencia en el contrato: ninguna.

### M0-5 — El build queda en `dist/src/main.js`
Estado: PROVISORIA (autónomo)
Hueco: AGENTS §16.1 dice `node dist/main.js`, pero el código importa los tipos de
`contrato/` (fuera de `src/`) y TypeScript no permite eso con `rootDir: src`.
Opciones: A) `rootDir: .` y arrancar con `node dist/src/main.js`; B) copiar los tipos dentro
de `src/` (dos copias del contrato que se pueden desincronizar).
Decisión: A. `Dockerfile`, `start:prod` y `db:reiniciar` usan `dist/src/…`.
Consecuencia en el contrato: ninguna.

### M0-6 — Contraseña de los usuarios de demo
Estado: PROVISORIA (autónomo)
Decisión: todos los usuarios de demo usan `villaguay2026` (está en el README). Los ids de los
que no están en el PRD siguen su formato: `usr-208`, `usr-209` (jugadores), `usr-301`
(encargado) y `usr-302` (administrador).


### M1-1 — Espacios sin complejo
Estado: PROVISORIA (autónomo)
Hueco: `Espacio.complejo` es `string` (no admite `null`) y la especificación marca «—» para los
espacios que no son de un complejo; una cadena vacía rompe la regla de nulos del PRD.
Opciones: A) el texto «—»; B) un nombre inventado por espacio.
Decisión: A, tal cual la especificación. El filtro `complejo` compara sin mayúsculas ni tildes.
Consecuencia en el contrato: ninguna (el tipo sigue siendo `string`).

### M1-2 — Detalle de un espacio inactivo
Estado: PROVISORIA (autónomo)
Hueco: la lista sólo trae los `activo: true`, pero `GET /espacios/:id` no dice qué hacer con uno inactivo.
Opciones: A) 200 con `activo: false`; B) 404.
Decisión: A: el campo `activo` existe en el PRD justamente para eso, y una reserva vieja puede
apuntar a un espacio dado de baja.
Consecuencia en el contrato: ninguna.

### M1-3 — Orden y filtros de la lista de espacios
Estado: PROVISORIA (autónomo)
Hueco: el PRD no dice cómo se ordenan ni qué pasa con filtros mal formados.
Decisión: orden por `id`. `iluminacion` y `techado` aceptan sólo `true` o `false` (si no, 400
`VALIDACION_FALLIDA`). Un `deporteId` que no existe da lista vacía. Un parámetro desconocido da 400.
`/deportes` y `/espacios` paginan como el resto (máximo 100: los once espacios entran de sobra).

### M1-4 — Imágenes y video de las semillas
Estado: PROVISORIA (autónomo)
Hueco: los medios de muestra son de M8 (`src/semillas/medios`).
Decisión: hasta M8, los espacios sembrados llevan `imagenes: []` y `videoUrl: null`. En la base se
guardan las claves de archivo y el mapeador las devuelve como URLs absolutas.

### M1-5 — Deporte del gimnasio cerrado
Estado: PROVISORIA (autónomo)
Hueco: la especificación lista un «gimnasio cerrado» entre los espacios pero no dice de qué deporte es.
Decisión: deporte propio `dep-gimnasio` («Gimnasio», ícono `barbell-outline`). El vóley usa `ellipse-outline` porque Ionicons no tiene ícono de pelota de vóley.

### D1 — Id de turno
Estado: PROVISORIA (autónomo)
Hueco: el id de ejemplo del PRD (`tur-0219-19`) no incluye el espacio ni el año: dos canchas tendrían el mismo id.
Opciones: A) `tur-<espacioId>-<AAAAMMDD>-<HH>`; B) un id guardado en la base.
Decisión: A, el default de la especificación. Es determinístico y el turno no se guarda: `idDeTurno()` / `leerIdDeTurno()`. El tipo es `string`, así que el contrato no cambia; sí cambia el ejemplo del PRD.
Consecuencia en el contrato: ninguna en la forma; el ejemplo del PRD pasa a `tur-esp-02-20260919-19`.

### D5 — Precio del turno
Estado: PROVISORIA
Decisión: `Turno.precio` es el `precioPorHora` actual del espacio.

### D8 — Fin del último turno
Estado: PROVISORIA
Decisión: `"24:00"`. Los 16 turnos van de `08:00–09:00` a `23:00–24:00`.

### M2-1 — Entidades de reservas, fijas y bloqueos desde M2
Estado: PROVISORIA (autónomo)
Hueco: la grilla cruza reservas, fijas y bloqueos, pero sus endpoints son de M3 y M5.
Decisión: M2 crea las tres entidades completas (con la columna `ocupacion` de R8 y su índice único) y las usa sólo para leer; los endpoints que las escriben llegan en sus módulos. Las semillas las cargan para tener qué mostrar. Viven en `src/modulos/turnos/`.

### M2-2 — Grilla de un espacio inactivo, y paginación
Estado: PROVISORIA (autónomo)
Hueco: la especificación no dice qué hace `/espacios/:id/turnos` con un espacio dado de baja, ni si pagina.
Opciones: A) 404 `ESPACIO_NO_ENCONTRADO`; B) grilla igual (como el detalle, M1-2).
Decisión: A: R7 pide que el espacio esté activo para reservar, y mostrar turnos de algo que no se puede reservar confunde. Acepta `pagina` y `porPagina` como toda lista (default 20: entran los 16 turnos; `meta.total` es 16).
Consecuencia en el contrato: ninguna.

### M2-3 — Validaciones de `fecha`
Estado: PROVISORIA (autónomo)
Decisión: una `fecha` que no es un `AAAA-MM-DD` que exista (incluye `2026-02-30` y `""`) da 400 `VALIDACION_FALLIDA`; una válida fuera de hoy…hoy + 6 da 422 `FECHA_FUERA_DE_RANGO`. El espacio se valida antes que el rango (404 antes que 422). "Hoy" se calcula con el reloj en hora argentina.
Consecuencia en el contrato: ninguna.

### M2-4 — Superposición de fijas o bloqueos sobre un mismo turno
Estado: PROVISORIA (autónomo)
Decisión: se resuelve por la prioridad de R2. Con varios bloqueos sobre el mismo turno, se muestra el motivo del de id menor. R19 (M5) evita fijas superpuestas.

