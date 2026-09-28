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

### D2 — Quién suspende o cancela un evento
Estado: PROVISORIA
Hueco: el `Usuario` del PRD no tiene rol, pero alguien tiene que suspender eventos (§3).
Opciones: A) rol interno `admin` creado por semilla; B) una clave fija de administración;
C) sin endpoint (se edita la base).
Decisión: A. La columna `rol` (`turista` | `admin`) existe en la base y viaja en el token, pero
el mapeador no la devuelve. El registro público siempre crea `turista`. La cuenta de demo es
`turismo@colon.demo.ar`.
Consecuencia en el contrato: ninguna; `Usuario` sale sin `rol`.

### M0-1 — Códigos de error extra del transporte
Estado: PROVISORIA (autónomo)
Hueco: AGENTS §4.6 no tiene código para un cuerpo JSON demasiado grande ni para un `Range`
imposible de cumplir.
Opciones: A) códigos propios; B) reusar `VALIDACION_FALLIDA` / `ERROR_INTERNO`.
Decisión: A, con los estados HTTP estándar: `PEDIDO_DEMASIADO_GRANDE` (413, cuerpo no
multipart que supera el límite de Express) y `RANGO_NO_SATISFACIBLE` (416, `Range` fuera del
archivo). Es agregar códigos, lo que se permite aun con el contrato congelado.
Consecuencia en el contrato: dos códigos más en el catálogo.

### M0-2 — Categorías favoritas antes del catálogo
Estado: PROVISORIA (autónomo)
Hueco: `PATCH /yo` valida `categoriasFavoritas` contra las categorías existentes (R18), pero
las categorías llegan en M1.
Decisión: el chequeo pasa por un puerto (`CategoriasExistentes`); hasta M1, no existe ninguna
categoría, así que cualquier lista no vacía da `CATEGORIA_NO_ENCONTRADA`. La semilla de
`usr-201` ya trae `cat-museos` y `cat-playas`, que existirán cuando M1 siembre el catálogo.
Consecuencia en el contrato: ninguna una vez hecho M1.

### M0-3 — Respuesta de `/dispositivos`
Estado: PROVISORIA (autónomo)
Hueco: AGENTS §9 no fija qué devuelven `POST /dispositivos` y `POST /dispositivos/prueba`.
Decisión: `POST /dispositivos` devuelve `Dispositivo` (`{ tokenExpo, plataforma }`), 201 si es
nuevo y 200 si ya estaba; `POST /dispositivos/prueba` devuelve `{ enviadas }`. Los dos tipos
están en `contrato/api.ts`.
Consecuencia en el contrato: tipos nuevos en `contrato/api.ts`, ninguno en `tipos.ts`.

### M0-4 — Ids de los usuarios de demo que no están en el PRD
Estado: PROVISORIA (autónomo)
Decisión: `usr-nuevo` (nuevo@demo.ar) y `usr-turismo` (turismo@colon.demo.ar), legibles como
las categorías. Los que crea el registro siguen el formato `usr-` + 12 caracteres.

