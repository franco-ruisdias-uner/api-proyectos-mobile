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

### P1 — `PATCH /yo` con un campo en `null`
Estado: PROVISORIA (autónomo)
Hueco: la especificación (§4 M5) dice `{ nombre?, telefono?, avisosActivos? }` pero no qué
pasa si llega `null`. En el tipo `Usuario`, `telefono` admite `null`; `nombre` y
`avisosActivos`, no.
Opciones: A) `null` en un campo que no lo admite → `VALIDACION_FALLIDA`. B) Tratar `null` como
"no lo cambies". C) Guardarlo igual (rompe el contrato).
Decisión: A. Es lo más conservador: no inventa semántica y no deja pasar un valor que el tipo
no admite. `telefono: null` (o `""`) borra el teléfono.
Consecuencia en el contrato: `PATCH /yo` con `{ "nombre": null }` o
`{ "avisosActivos": null }` → 400 `VALIDACION_FALLIDA`.

### P2 — Un rango de bytes que no existe
Estado: PROVISORIA (autónomo)
Hueco: AGENTS §8 y §17 piden soporte de `Range` en `GET /archivos/<clave>`, pero la tabla de
errores no dice qué hacer con un rango fuera del archivo.
Opciones: A) 416 `RANGO_NO_SATISFACIBLE` con `Content-Range: bytes */<total>` (lo que dice
HTTP). B) Ignorar el rango y mandar el archivo entero con 200.
Decisión: A. Es lo que esperan `expo-audio` y `expo-video`; se agrega un código al catálogo
(agregar códigos está permitido).
Consecuencia en el contrato: 416 `RANGO_NO_SATISFACIBLE` en `GET /archivos/<clave>`.

### P3 — Forma de las zonas sembradas
Estado: PROVISORIA (autónomo)
Hueco: la especificación (§8) pide cuatro zonas que cubran la planta urbana real sin
superponerse ni dejar huecos, pero no dice cómo se reparten ni sus nombres.
Opciones: A) Un rectángulo sobre la ciudad repartido en cuatro triángulos (Norte, Este, Sur,
Oeste) que comparten el centro. B) Polígonos irregulares calcados de los barrios. C) Cuadrantes.
Decisión: A. Garantiza por construcción que no hay superposición ni huecos (lo verifica un
test con una grilla de puntos) y el ejemplo del PRD (Rocamora 1240) cae en la zona norte. Es
una aproximación de la ciudad, no un plano oficial.
Consecuencia en el contrato: `GET /zonas` devuelve polígonos de tres puntos.

### P4 — Orden y paginación de los catálogos
Estado: PROVISORIA (autónomo)
Hueco: la especificación no dice cómo se ordenan los catálogos ni si tienen otro máximo de
`porPagina`.
Decisión: tipos y zonas por `nombre` y luego `id`; cuadrillas por `id`. Paginación común
(máximo 100): con ocho tipos y cuatro zonas alcanza.
Consecuencia en el contrato: un vecino que quiera "Otro problema" al final lo ordena en el
teléfono.

### P5 — Filtro de cuadrillas sin coincidencias
Estado: PROVISORIA (autónomo)
Hueco: qué devuelve `GET /cuadrillas?zonaId=` con una zona que no existe.
Decisión: lista vacía con 200 si el id tiene la forma correcta (`zon-…`); 400 si no la tiene.
Consecuencia en el contrato: no hay código `ZONA_NO_ENCONTRADA` en este endpoint.
