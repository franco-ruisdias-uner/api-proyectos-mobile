# AGENTS.md — API del Trabajo Final (Desarrollo para Móviles · UNER)

Guía para los agentes de código que construyen esta API. Leela entera antes de tocar nada.
Vale para los cinco repos del Trabajo Final 2026; lo propio de cada proyecto está en
`docs/SPECIFICATION.md`.

---

## 0. Qué es esto y por qué no se puede romper

Esta API la consume una app móvil (React Native + Expo) que hace un grupo de alumnos. Los
alumnos **ya escribieron sus tipos** en `src/tipos/`, copiados del PRD, y la consigna les dice
que **no los van a tocar cuando llegue la API**. Hasta ahora trabajaron contra datos
inventados detrás de una capa de servicios; el día que cambian el mock por `fetch`, lo que
devolvés tiene que encajar exacto.

Por eso, la regla que está por encima de todas:

> **El contrato es el PRD.** Un campo de más, uno de menos, un `undefined` donde iba `null`,
> una fecha con `Z` en vez de `-03:00`, un id numérico: cualquiera de esas cosas rompe una
> app que ya estaba terminada.

Cada grupo corre la API en su computadora, con el motor de base de datos que elija:
**SQLite** (por defecto, sin instalar nada), **PostgreSQL**, **MySQL** o **MariaDB**. Tiene
que andar igual en los cuatro.

### Documentos del repo y precedencia

| Documento | Qué tiene | Manda sobre |
|---|---|---|
| `docs/prd.pdf` | El pedido del cliente. Sus tablas, `interface` y JSON de ejemplo **son el contrato**. | todo lo demás, en forma de datos |
| `contract/types.ts` | Copia literal de los tipos del PRD. Es lo que tienen los alumnos. | la implementación |
| `contract/api.ts` | Tipos que agrega la API (sobre, `Sesion`, `ArchivoSubido`, `Salud` y los extras del proyecto). Se publican a los alumnos junto con la API. | la implementación |
| `docs/SPECIFICATION.md` | Endpoints, reglas de negocio, roles, errores, semillas y plan de módulos de **este** proyecto. | este archivo |
| `AGENTS.md` (este) | Reglas comunes a los cinco proyectos. | — |
| `docs/DECISIONS.md` | Huecos del PRD y cómo se resolvieron. | se consulta siempre |

Si `SPECIFICATION.md` contradice a este archivo, gana `SPECIFICATION.md` (por ejemplo, un
proyecto puede tener otro registro de usuarios). Si cualquiera de los dos contradice la forma
de datos del PRD, **frená y preguntá**: no elijas vos.

---

## 1. Cómo trabajás

> Si el pedido empieza con **`MODO AUTÓNOMO`**, leé también la sección 15: reemplaza todo lo
> que acá dice "preguntá" y "esperá el OK".

### Un módulo por vez

`SPECIFICATION.md` trae un plan de módulos numerados (M0, M1, …). Hacés **uno**, lo
verificás, informás y **esperás el OK** antes de arrancar el siguiente. No adelantás trabajo
de otro módulo "porque quedaba cerca", ni ampliás alcance. Eso ya salió mal antes.

### El ciclo de cada módulo

1. **Leer.** La sección del módulo en `SPECIFICATION.md`, las entidades que toca en
   `contract/types.ts` y el pasaje correspondiente del PRD.
2. **Tests de contrato e2e primero** (sección 10.2). Corrélos y **mirá que fallen** por la
   razón correcta (404 porque la ruta no existe, no un error de compilación).
3. **Tests unitarios de las reglas** (sección 10.1), también en rojo.
4. **Implementar lo mínimo** para ponerlos en verde, con la documentación de la versión
   instalada a mano: Context7 y los tipos de `node_modules` (sección 2.3).
5. **Refactor** con todo en verde.
6. **Verificación local**: `pnpm verificar` (tipos + lint + unitarios + e2e en SQLite).
7. **Matriz de motores**: `pnpm test:e2e:matriz` (sección 10.4).
8. **Verificación independiente**: invocá al subagente `verificador-contrato` (sección 12).
   Corregí lo que encuentre y volvé a correrlo hasta que dé verde.
9. **Documentación**: Swagger, `README.md` para alumnos, `docs/DECISIONS.md`, `CHANGELOG.md`.
10. **Informe de cierre** (sección 14) y esperás.

Commit chico después de cada paso en verde (sección 11.6).

### Huecos del PRD: no inventes

Los PRD tienen huecos **a propósito**: están escritos por un "cliente" para que los alumnos
aprendan a preguntar. Vos no sos el cliente. Cuando algo no está definido:

- Si `docs/DECISIONS.md` ya lo resolvió, aplicás eso.
- Si `SPECIFICATION.md` trae un **default provisorio**, lo implementás y lo anotás en
  `DECISIONS.md` como `PROVISORIO`.
- Si no hay nada, lo anotás como `PENDIENTE` con dos o tres opciones y tu recomendación,
  **y preguntás** antes de implementarlo.

Los detalles puramente internos (nombres de clases privadas, cómo partís una función) los
decidís vos sin preguntar.

### Nunca

- Cambiar un tipo de `contract/types.ts` ni agregarle campos a una respuesta.
- Borrar, debilitar o saltear un test para que pase. Nada de `.skip` ni `.only` commiteado.
- Mockear la base de datos o los repositorios en un test e2e.
- Agregar una dependencia sin decir para qué y por qué no alcanza con lo que ya hay.
- Escribir SQL a mano o usar algo que exista en un solo motor (sección 5.4).
- Usar `new Date()` o `Date.now()` fuera de `src/common/clock/` (sección 6).
- Hacer `git push` o abrir PR sin que te lo pidan.

---

## 2. Stack (verificado en septiembre de 2026)

| Pieza | Versión | Nota |
|---|---|---|
| Node.js | **24 LTS** (`.nvmrc` = `24`) | Las schematics de Nest 12 piden `^22.22.3 \|\| >=24.15`. |
| Gestor de paquetes | **pnpm 10** | Con npm 10, `npm install` del template de Nest 12 falla con `Cannot read properties of null (reading 'edgesOut')`. |
| Framework | **NestJS 12** | ESM (`"type": "module"`). Arrancá con `nest new` y elegí ESM (es el default). |
| Tests | **Vitest 4** + supertest | Es lo que genera `nest new` en ESM. No lo cambies por Jest. |
| ORM | **TypeORM 1.1** + `@nestjs/typeorm` 12 | La 1.x rompe cosas de la 0.3: ver 2.1. |
| SQLite | `better-sqlite3@^12` | **No la 13**: TypeORM 1.1 declara `^12` como peer. |
| PostgreSQL | `pg` | |
| MySQL / MariaDB | `mysql2` | El paquete `mysql` ya no está soportado. |
| Validación | `class-validator` + `class-transformer` | `ValidationPipe` global (sección 7.3). |
| Documentación | `@nestjs/swagger` en `/docs` | |
| Configuración | `@nestjs/config` con validación al arrancar | |
| Autenticación | `@nestjs/jwt` + guard propio | Contraseñas con `node:crypto` (`scrypt`), sin dependencias nativas. |
| Fechas | `date-fns` 4 + `@date-fns/tz` | |
| Push | `fetch` nativo a la API de Expo | Sin SDK: detrás de dos puertos (secciones 9 y 19). |
| Archivos | disco o `@aws-sdk/client-s3` | Detrás de un puerto; el proveedor se elige por configuración (sección 17). |
| Contrato | `ts-json-schema-generator` + `ajv` | Sección 10.3. |

En `package.json`, para que pnpm compile el binario de SQLite:

```json
"pnpm": { "onlyBuiltDependencies": ["better-sqlite3"] }
```

Sin eso, pnpm 10 saltea el script de build y la app explota al conectar.

### 2.1 Cosas que la documentación vieja de internet dice mal

La mayoría de los tutoriales son de NestJS 10/11 y TypeORM 0.3. Esto ya no es así:

- **TypeORM 1.x**
  - `type: 'sqlite'` **no existe más**: es `type: 'better-sqlite3'`.
  - `Connection` → `DataSource`. `getRepository()` global, `createConnection()` y compañía
    ya no existen.
  - `findOneById(id)` → `findOneBy({ id })`. `findByIds([...])` → `findBy({ id: In([...]) })`.
  - `relations` y `select` van **en forma de objeto** (`relations: { lugar: true }`), no de array.
  - Un `where` con un valor `undefined` o `null` **tira error**. Armá el `where` solamente con
    los filtros que vinieron, y para buscar nulos usá `IsNull()`.
  - Las relaciones `nullable: false` hacen `INNER JOIN`.
  - `@RelationCount` y `@EntityRepository` no existen más.
- **NestJS 12 es ESM**
  - Los imports relativos llevan extensión `.js` (`import { X } from './x.js'`).
  - No hay `__dirname`: usá `import.meta.dirname`.
  - No cargues entidades con globs (`entities: ['dist/**/*.entity.js']`): usá
    `autoLoadEntities: true` y `TypeOrmModule.forFeature([...])` en cada módulo.
- **pnpm 10** no corre scripts de instalación salvo que estén en `onlyBuiltDependencies`.

### 2.2 Arranque del repo (M0)

El repo ya trae `AGENTS.md`, `CLAUDE.md`, `.claude/`, `docs/` y `contract/`. Generá el proyecto
de Nest en una carpeta temporal y mové lo generado a la raíz **sin pisar** esos archivos:

```bash
npx -y @nestjs/cli@12 new api --package-manager pnpm --skip-git --skip-install --no-observe </dev/null
```

Sin terminal interactiva, `nest new` toma los valores por defecto (ESM + Vitest), así que no
se queda esperando una respuesta (verificado). Después agregá el bloque `"pnpm"` de arriba al
`package.json`, corré `pnpm install` y recién ahí instalá `better-sqlite3@^12`.

### 2.3 Documentación: Context7 antes que la memoria

Lo que sabés de NestJS, TypeORM, Vitest y compañía puede ser de una versión vieja (ya viste la
lista de 2.1). Por eso, **consultar Context7 es obligatorio** antes de usar la API de una
librería: `resolve-library-id` para encontrar la librería y `query-docs` con una pregunta
concreta. Pedí la documentación de **la versión que dice `package.json`**, no la última.

Context7 está configurado **en la cuenta** con la que corren las sesiones, no en el repo: sus
herramientas aparecen como `mcp__context7__…`. No agregues `.mcp.json` ni otros servidores MCP
al repo. El orquestador cuenta cuántas consultas hiciste en cada módulo y lo muestra en el
resumen: un módulo con dependencias nuevas y cero consultas se nota.

- **Cuándo sí**: la primera vez que usás una API de una librería en el módulo; al configurar
  algo (`TypeOrmModule`, `DataSource`, Vitest, Swagger, `ConfigModule`, `ValidationPipe`,
  la API de push de Expo, `@date-fns/tz`, `ajv`); cuando un error de una librería no se entiende; y
  cada vez que dudes entre dos formas de hacer algo.
- **Cuándo no**: para lo que ya dice este archivo, ni para el código propio del repo.
- **Orden de confianza**: (1) lo instalado: los tipos `.d.ts` de `node_modules/<paquete>` y su
  `CHANGELOG` son la verdad para esa versión; (2) las secciones 2 y 2.1 de este archivo, que
  están verificadas; (3) Context7; (4) tu memoria. Si Context7 contradice a (1) o (2), ganan
  ellos y lo anotás en el informe.
- **Si Context7 no aparece o falla** en la sesión, es un problema de configuración, no una
  excusa: seguís con los tipos de `node_modules`, y lo ponés en la primera línea útil del
  informe ("Context7 no disponible") para que se arregle antes del próximo módulo. No es motivo
  para frenar.
- Las consultas son preguntas técnicas sobre la librería: no mandes código ni datos del repo.

---

## 3. Estructura del repo

```
.
├── AGENTS.md                  ← este archivo
├── CLAUDE.md                  ← importa AGENTS.md
├── README.md                  ← para los alumnos, en castellano (sección 13)
├── CHANGELOG.md
├── .env.example               ← uno comentado, con los cuatro motores
├── Dockerfile                 ← imagen de la API (sección 16)
├── .dockerignore
├── compose.yaml               ← `docker compose up`: API + SQLite + datos de demo
├── compose.postgres.yaml      ← lo mismo con PostgreSQL 17 (y .mysql / .mariadb)
├── compose.storage-s3.yaml    ← se suma a cualquier compose: archivos en S3Proxy (sección 17)
├── compose.storage-localstack.yaml
├── compose.matriz.yaml        ← las tres bases y S3Proxy, para los tests
├── scripts/test-docker.mjs  ← levanta cada compose y lo prueba (sección 16)
├── .github/workflows/ci.yml   ← verificar + matriz de motores
├── contract/
│   ├── types.ts               ← copia literal de los tipos del PRD (no se toca)
│   ├── api.ts                 ← tipos que agrega la API: sobre, Sesion, ArchivoSubido, Salud y los extras del proyecto
│   └── schema.json            ← generado desde los dos anteriores (no se edita a mano)
├── docs/
│   ├── prd.pdf
│   ├── SPECIFICATION.md
│   ├── DECISIONS.md
│   └── reports/               ← un informe de cierre por módulo (modo autónomo, sección 15)
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── config/                ← esquema y validación de variables de entorno
│   ├── common/                ← lo transversal (ver abajo)
│   ├── modules/<modulo>/
│   │   ├── <entidad>.entity.ts
│   │   ├── dto/
│   │   ├── <modulo>.controller.ts
│   │   ├── <modulo>.service.ts
│   │   ├── <modulo>.mapper.ts     ← entidad → tipo del contrato
│   │   ├── rules/                   ← funciones puras, sin Nest ni base
│   │   └── <modulo>.module.ts
│   └── seeds/
│       ├── seed.ts
│       ├── data/
│       └── media/             ← imágenes, audio y video de muestra (generados, sin derechos de terceros)
└── test/
    ├── utilities/             ← crearApp(), relojFijo, usuarios de prueba, esperarContrato()
    ├── e2e/<modulo>.e2e-spec.ts
    └── verification/          ← lo escribe el verificador-contrato (sección 12)
```

`src/common/` tiene, cada cosa en su carpeta: `response/` (sobre y paginación), `errors/`
(catálogo + filtro de excepciones), `clock/`, `dates/`, `ids/`, `db/` (helpers de columnas y
opciones por motor), `geo/`, `text/` (normalización para búsqueda), `auth/`, `files/`,
`notifications/`, `simulation/`. En `files/` van el puerto `AlmacenArchivos` y un driver
por proveedor (sección 17).

**Idioma del código:** el dominio va en castellano y con los mismos nombres que el PRD
(`Lugar`, `Reserva`, `cancelableHasta`, `EstadoTurno`). Lo del framework queda en inglés porque
así se llama (`Controller`, `Module`, `Injectable`). No traduzcas nombres del PRD ni les cambies
la forma (`Resena` es `Resena`, no `Reseña` ni `Review`).

---

## 4. El contrato

### 4.1 Sobre de respuesta

Todas las respuestas tienen **siempre** esta forma:

```jsonc
// lista
{ "datos": [ ... ], "meta": { "total": 42, "pagina": 1, "porPagina": 20 } }
// un solo recurso
{ "datos": { ... }, "meta": null }
// error
{ "error": { "codigo": "LUGAR_NO_ENCONTRADO", "mensaje": "No existe ese lugar." } }
```

- El PRD sólo muestra el caso lista. Para un solo recurso, `meta` va en `null` (no ausente),
  por la regla de nulos del mismo PRD. *(Decisión común; ver `DECISIONS.md`.)*
- Los controladores devuelven el sobre de forma explícita con los helpers
  `respuestaLista(datos, meta)` y `respuestaUno(dato)` de `src/common/response/`. Nada de
  interceptores que "adivinan" si algo es lista o no.
- `DELETE` exitoso: **204 sin cuerpo**. Es la única respuesta sin sobre.
- El error **no lleva otros campos** que `codigo` y `mensaje`: nada de `stack`, `detalles` ni
  `statusCode`. El filtro global de excepciones se encarga de que sea así incluso para
  excepciones de Nest, de validación, de TypeORM o inesperadas.

### 4.2 Paginación

- Toda lista acepta `?pagina=1&porPagina=20`. Default 20; máximo 100 salvo que
  `SPECIFICATION.md` diga otra cosa para un endpoint (los catálogos que el teléfono guarda
  para usar sin señal suelen necesitar más).
- `meta.total` es el total **filtrado**, no el de la tabla.
- Una página fuera de rango devuelve `datos: []` con el `total` correcto, no error.
- Orden siempre determinístico: si el orden pedido empata, desempatá por `id`.

### 4.3 Convenciones de datos (las del PRD, sin excepción)

- **Identificadores**: texto con el prefijo del PRD (`lug-004`, `res-1180`). Nunca números.
  Los nuevos se generan con `nuevoId('lug')` de `src/common/ids/` → `lug-` + 12 caracteres
  aleatorios `[a-z0-9]`. Las semillas usan los ids exactos de los ejemplos del PRD.
- **Instantes** (fecha + hora): texto ISO 8601 **con offset `-03:00`** y sin milisegundos:
  `"2026-11-14T21:00:00-03:00"`. Nunca `Z`, nunca un número, nunca un objeto. La zona es
  `America/Argentina/Buenos_Aires`. Se formatea en el mapeador con `aIsoConZona()`.
  En la entrada aceptás cualquier ISO válido con offset (o `Z`) y lo normalizás.
- **Días sueltos**: `"AAAA-MM-DD"`. **Horas de tabla** que se repiten: `"HH:MM"`. Son texto,
  se guardan como texto, y no se convierten a instante.
- **Claves en `camelCase`**, idénticas al PRD.
- **Nulos**: un campo sin valor viaja como `null`. Nunca ausente, nunca `""`. **Todos** los
  campos del tipo están siempre presentes.
- **Precios**: número en pesos; `0` es gratis; `null` es "no aplica". Descuentos: porcentaje
  entero (`15`, no `0.15`).
- **Sesión**: cabecera `Authorization: Bearer <token>`.

### 4.4 El mapeador: la única puerta de salida

Cada entidad tiene una función `aContrato(entidad): TipoDelPrd` en `<modulo>.mapper.ts`, con
el **tipo de retorno importado de `contract/types.ts`**. Así, si falta un campo o sobra uno,
no compila. Ningún controlador devuelve una entidad de TypeORM directamente.

El mapeador además:
- convierte instantes con `aIsoConZona()`;
- arma las URLs de archivos como absolutas (sección 8);
- devuelve `true` en los campos `sincronizada`/`sincronizado` (si está en el servidor, está
  sincronizado; ese campo es de la cola local del teléfono, y en la entrada se ignora);
- nunca expone datos internos (hash de contraseña, rol cuando el tipo no lo tiene, columnas
  de búsqueda, columnas de ocupación).

### 4.5 Lo que la API NO devuelve

No agregues campos "de regalo" aunque parezcan útiles (`distancia`, `abiertoAhora`,
`esFavorito`). Si el PRD no los tiene, el tipo del alumno no los tiene. Varios PRD aclaran
que cosas como "abierto ahora" se calculan en el teléfono. Si un endpoint necesita ordenar por
distancia, ordena, pero no agrega el número.

### 4.6 Errores

- **Códigos** en `MAYUSCULAS_CON_GUION_BAJO`, en castellano, estables para siempre. Catálogo
  único en `src/common/errors/catalog.ts` con código, estado HTTP y mensaje.
- **Mensajes** en castellano rioplatense, pensados para **mostrarse tal cual en la pantalla**
  de una persona mayor que no es técnica: cortos, sin jerga, sin ids, sin nombres de campos
  en inglés. "Ese turno ya fue reservado." Sí. "Duplicate entry for key IDX_…" Jamás.
- **Estados HTTP**:

| Estado | Cuándo | Código genérico |
|---|---|---|
| 400 | Cuerpo o parámetros mal formados | `VALIDACION_FALLIDA` (el mensaje nombra el campo en castellano) |
| 401 | Falta el token, está vencido o es inválido | `NO_AUTENTICADO` |
| 403 | Autenticado pero sin permiso (rol o dueño) | `SIN_PERMISO` |
| 404 | No existe | `<ENTIDAD>_NO_ENCONTRADO` / `RUTA_NO_ENCONTRADA` |
| 409 | Choca con el estado actual (ocupado, ya existe, ya usado) | específico del proyecto |
| 410 | Existió pero ya no está vigente | específico (p. ej. `PROMO_VENCIDA`) |
| 413 | Archivo demasiado grande | `ARCHIVO_DEMASIADO_GRANDE` |
| 415 | Tipo de archivo no permitido | `TIPO_DE_ARCHIVO_NO_PERMITIDO` |
| 422 | Bien formado pero viola una regla de negocio | específico del proyecto |
| 503 | El proveedor de archivos no responde | `ALMACEN_NO_DISPONIBLE` |
| 500 | Cualquier otra cosa | `ERROR_INTERNO` (mensaje genérico; el detalle va sólo al log) |

- Una violación de índice único en la base se traduce al código de negocio que corresponde
  (por ejemplo `TURNO_OCUPADO`), nunca sale como 500.

---

## 5. Base de datos: cuatro motores, un solo código

### 5.1 Configuración

`DB_MOTOR` = `better-sqlite3` (default) · `postgres` · `mysql` · `mariadb`.

| Motor | Conexión | Notas |
|---|---|---|
| `better-sqlite3` | `DB_ARCHIVO=datos/api.sqlite` | En tests, `:memory:`. |
| `postgres` | `DB_URL=postgres://…` | |
| `mysql` | `DB_URL=mysql://…` | `timezone: 'Z'`, charset `utf8mb4`. |
| `mariadb` | `DB_URL=mysql://…` | Ídem. **XAMPP instala MariaDB, no MySQL.** Con `DB_MOTOR=mysql` contra un servidor MariaDB el esquema no queda estable (verificado): usá `mariadb`. |

Las opciones de TypeORM por motor salen de una sola función en `src/common/db/options.ts`.

Para una base **administrada en la nube** (Supabase, Neon, Aiven) hay presets con
`DB_PROVEEDOR`, más `DB_SSL`, `DB_SSL_CA` y `DB_ESQUEMA`: sección 18.1.

### 5.2 Esquema: se genera desde las entidades

- **No hay migraciones.** El esquema se crea con `synchronize` desde las entidades.
  Razones: (1) se verificó que migraciones escritas a mano con la API de `QueryRunner` quedan
  distintas de las entidades en cada motor (enums, nulos, índices); mantener cuatro juegos
  sería el trabajo más caro del proyecto; (2) los datos son descartables: se reconstruyen con
  las semillas; (3) el contrato se congela al publicar (sección 11.7).
- `pnpm db:reiniciar` borra el esquema, lo crea y siembra. Es el comando que usan los alumnos.
  Contra una base en la nube (`DB_PROVEEDOR` definido) pide `--confirmar` y borra **sólo** el
  esquema de la API (`DB_ESQUEMA`), nunca otros (en Supabase conviven `auth`, `storage`…).
- `synchronize` corre sólo cuando `DB_SINCRONIZAR=true` (el default de desarrollo y tests).
- **Test obligatorio de estabilidad**: después de sincronizar,
  `dataSource.driver.createSchemaBuilder().log()` devuelve **cero** consultas pendientes, en
  los cuatro motores. Si da algo, hay un tipo de columna que no es portable.

### 5.3 Tipos de columna permitidos

Usá **sólo** estos, a través de los helpers de `src/common/db/columns.ts`:

| Dato | Columna | Por qué |
|---|---|---|
| Id | `@PrimaryColumn({ type: 'varchar', length: 40 })` | Los ids son texto con prefijo. |
| Texto corto | `varchar` **con `length` explícito** | MySQL lo exige para `varchar` e índices. |
| Texto largo | `text` | |
| Entero, precio en pesos | `int` | |
| Coordenadas, puntajes | `double precision` | Existe en los cuatro y vuelve como `number`. `decimal` vuelve como `string` en PostgreSQL y MySQL. |
| Booleano | `boolean` | |
| Instante | `ColumnaInstante()` → `timestamptz` en PostgreSQL, `datetime` en el resto | `datetime` no existe en PostgreSQL y `timestamptz` no existe en los otros. Se guarda en UTC. |
| Día `AAAA-MM-DD` | `varchar(10)` | Sin conversiones de zona. |
| Hora `HH:MM` | `varchar(5)` | |
| Enum del PRD | `varchar(20)` + validación en el DTO + tipo unión de TS | `enum` no existe en SQLite y en los otros crea tipos que `synchronize` recrea borrando la columna. |
| Objeto o lista que **no** se filtra (imágenes, horarios de un lugar, trazado, polígono) | `simple-json` | Portable. |
| Lista que **sí** se filtra o se cuenta (favoritos, adhesiones, confirmaciones) | **tabla propia** | No se puede buscar dentro de `simple-json` de forma portable. |

Las tablas van en `snake_case` y en plural (`lugares`, `reservas_fijas`); las columnas, igual
que las propiedades (camelCase).

### 5.4 Prohibido

SQL escrito a mano (`query()`, `createQueryBuilder().where('…ILIKE…')` con funciones de un
motor), `enum`, `json`/`jsonb`, `uuid`, `decimal`, `NOW()`/`CURRENT_TIMESTAMP` en consultas,
PostGIS, búsqueda full-text, vistas, triggers, procedimientos. Si algo parece necesitarlo,
preguntá.

### 5.5 Patrones portables

- **Búsqueda de texto**: cada campo buscable tiene una columna gemela `<campo>Busqueda` con el
  texto normalizado (minúsculas, sin tildes, espacios colapsados) que mantiene el servicio. Se
  busca con `Like('%termino%')` sobre esa columna y con el término normalizado igual. Así
  "colon" encuentra "Colón" en los cuatro motores, que de otro modo se comportan distinto con
  mayúsculas y tildes.
- **Distancias**: nada geoespacial en la base. Prefiltro por caja (`latitud` y `longitud`
  `Between`) en la consulta, y distancia con haversine + orden en TypeScript
  (`src/common/geo/`, testeado unitariamente). Punto dentro de polígono, también ahí.
- **Unicidad con nulos**: un índice único admite **varios `NULL`** en los cuatro motores
  (verificado). Sirve para "sólo puede haber uno activo": una columna que vale una clave
  mientras el registro está activo y `NULL` cuando no.
- **Concurrencia**: toda regla del tipo "no puede haber dos" se garantiza con un **índice
  único en la base**, no sólo con un `if` en el servicio. Dos pedidos simultáneos pasan el
  `if` los dos. Las operaciones de varias escrituras van en `dataSource.transaction()`.
- **Contadores desnormalizados** del PRD (`adhesiones`, `confirmaciones`, `puntaje`,
  `usos`): se recalculan dentro de la misma transacción que modifica lo que cuentan, a partir
  de la tabla real, no con `+1` a ciegas.

---

## 6. Hora, zona y reloj

- Todo lo que depende de "ahora" (hoy, vencida, próximos horarios, turno pasado, cancelable
  hasta) usa el servicio `Reloj` (`ahora(): Date`) inyectado. **Prohibido `new Date()` sin
  argumentos y `Date.now()`** fuera de `src/common/clock/`.
- En tests se usa `RelojFijo`, que se puede mover. En desarrollo, si `RELOJ_FIJO` tiene un
  instante ISO, la API arranca "congelada" en ese momento: sirve para demos y para que los
  alumnos prueben casos como "el último colectivo ya pasó".
- "Hoy", el día de la semana (`0` = domingo) y los cortes de medianoche se calculan en
  `America/Argentina/Buenos_Aires`, nunca en la zona del proceso. Los tests e2e corren con
  `TZ=UTC` **y** con `TZ=America/Argentina/Buenos_Aires` en CI para cazar dependencias de la
  zona de la máquina.
- Casos borde con test propio: 23:59 → 00:00, un horario que cruza la medianoche, el último
  día del mes, el 31/12.

---

## 7. Autenticación, roles y validación (base común)

`SPECIFICATION.md` puede cambiar esto para un proyecto; si no dice nada, vale lo siguiente.

### 7.1 Endpoints

| Método | Ruta | Acceso | Respuesta |
|---|---|---|---|
| `POST` | `/auth/registro` | público | 201 `{ datos: { token, usuario } }` |
| `POST` | `/auth/ingreso` | público | 200 `{ datos: { token, usuario } }` |
| `GET` | `/yo` | con sesión | el `Usuario` del PRD |
| `PATCH` | `/yo` | con sesión | el `Usuario` actualizado |

- `usuario` tiene exactamente la forma del `Usuario` del PRD del proyecto.
- El registro público **siempre** crea el rol común del proyecto (vecino, jugador, turista…).
  Las cuentas con más permisos (operador, comercio, encargado, administrador) se crean por
  semilla o por un administrador, nunca desde el registro.
- Email único sin distinguir mayúsculas (se guarda normalizado): `EMAIL_YA_REGISTRADO` (409).
- Ingreso fallido: `CREDENCIALES_INVALIDAS` (401), con el mismo mensaje exista o no el email.

### 7.2 Tokens y contraseñas

- JWT HS256 con `sub` = id de usuario y `rol`. Vence a los **30 días**: la app lo guarda en
  `expo-secure-store` y el reingreso con huella lo desbloquea en el teléfono; no hay refresh.
  `JWT_SECRETO` es obligatorio (la app no arranca sin él; `.env.example` trae uno de
  desarrollo que dice que es de desarrollo).
- Contraseñas con `scrypt` de `node:crypto`, sal aleatoria por usuario y comparación con
  `timingSafeEqual`. Mínimo 8 caracteres. El hash jamás sale en una respuesta ni en un log.

### 7.3 Guards y validación

- **Seguro por defecto**: un guard global exige token en todo. Lo público se marca con
  `@Publico()`, uno por uno. Los PRD piden que para *mirar* no haga falta cuenta; revisá en
  `SPECIFICATION.md` qué endpoints son públicos.
- Roles con `@Roles('operador')`. Dueño del recurso: se chequea en el servicio y devuelve
  `SIN_PERMISO` (403).
- `ValidationPipe` global con `whitelist: true`, `forbidNonWhitelisted: true`,
  `transform: true`. Los errores de validación salen como `VALIDACION_FALLIDA` con un mensaje
  en castellano que nombra el primer campo con problemas ("Falta la foto del problema.").
- Los ids que llegan por ruta o cuerpo se validan con el prefijo que corresponde antes de ir
  a la base.

---

## 8. Archivos (fotos, audio, video)

- `POST /archivos` (con sesión, `multipart/form-data`, campo `archivo`) →
  201 `{ datos: { url, tipo, bytes }, meta: null }`. La app sube primero el archivo y después
  manda la URL en el recurso. Funciona bien con la cola offline: la foto se sube cuando vuelve
  la señal y recién ahí se manda el recurso.
- Límites: imagen `jpeg/png/webp` hasta 5 MB; audio `m4a/aac/mp3` hasta 10 MB; video `mp4`
  hasta 30 MB. Se chequea la firma del archivo, no sólo la extensión.
- Se guardan a través del puerto `AlmacenArchivos` (sección 17): en disco o en cualquier
  servicio compatible con S3, según la configuración. La clave la genera el servidor (nunca el nombre que
  mandó el usuario). La API los sirve siempre ella misma en `/archivos/<clave>`, **con soporte
  de `Range`** (206), que es lo que necesitan `expo-audio` y `expo-video` para adelantar y para
  reproducir mientras descargan. Hay un test que pide un rango y espera 206.
- En la base se guarda la **clave**, no una URL; el mapeador la hace absoluta con `URL_PUBLICA` si
  está definida y, si no, con el protocolo y el `Host` **del pedido**: la dirección que usó el
  teléfono para llegar (`http://192.168.0.10:3000`). Así anda sin configurar nada, también
  dentro de Docker, donde la API no conoce la IP de la computadora. El origen se guarda por
  pedido con `AsyncLocalStorage` de `node:async_hooks`, para que el mapeador no reciba el
  request. Hay un test que pide con `Host: 10.0.0.5:3000` y espera URLs con ese origen.
  Una URL que llega en un recurso y no es de esta API se rechaza con `ARCHIVO_NO_SUBIDO`
  (422), salvo que `SPECIFICATION.md` diga lo contrario. Un `file://` también.

---

## 9. Notificaciones push

- `POST /dispositivos` `{ tokenExpo, plataforma }` registra el token de Expo del teléfono
  (idempotente por token; si otro usuario lo tenía, pasa al actual). `DELETE
  /dispositivos/:tokenExpo` lo da de baja. `POST /dispositivos/prueba` le manda una push de
  prueba a los dispositivos del usuario: sirve para que los alumnos depuren.
- Los tokens y el envío pasan por dos puertos, `AlmacenTokensPush` y `EnviadorPush`
  (sección 19.2), y el dominio sólo usa el servicio `Avisos`. Enviadores: `EnviadorExpo`
  (`fetch` a la API de Expo, sin `expo-server-sdk`), `EnviadorMemoria` (tests; guarda lo que
  "se mandó") y `EnviadorRegistro` (sólo escribe en el log). `NOTIFICACIONES=expo|registro`
  elige.
- Se notifica **después de confirmar la transacción**, sin bloquear la respuesta. Un error de
  Expo se loguea y no rompe el pedido. Los tokens que Expo informa como inválidos se borran.
- Se respeta siempre el interruptor de avisos del usuario (`avisosActivos` o equivalente).
- Los recordatorios que dependen sólo del usuario ("avisame 10 minutos antes", "dos horas
  antes del turno", avisos de proximidad) son **notificaciones locales del teléfono**: la API
  no los manda. `SPECIFICATION.md` lista cuáles son del servidor.
- **El guardado de tokens y el envío los terminan programando los alumnos** (sección 19): se
  construyen completos módulo a módulo y en el último módulo del plan se vacían. Por eso, desde
  M0, el código de dominio **nunca** toca tokens ni Expo: llama a `Avisos.avisar(…)` y nada más.

---

## 10. Tests

Hay tres niveles y los tres son obligatorios. La cobertura no es la meta; la meta es que
**cada regla del PRD y cada código de error tenga un test que la nombre**:

```ts
describe('PRD §3 — Un máximo de tres reservas activas por persona', () => { … });
```

### 10.1 Unitarios: reglas puras, con TDD estricto

- Viven al lado del código: `src/**/reglas/*.spec.ts`.
- Las reglas de negocio son **funciones puras** (sin Nest, sin base, sin reloj global: reciben
  `ahora` como parámetro). Ejemplos: armar la grilla de turnos, próximos horarios de una
  parada, transiciones de estado válidas, punto dentro de una zona, distancia, vigencia de una
  promoción, recálculo de un puntaje.
- Primero el test, lo ves fallar, después el código. Tabla de casos (`it.each`) con los bordes.

### 10.2 E2E por endpoint: la app real contra una base real

- `test/e2e/<modulo>.e2e-spec.ts`, con supertest contra la app de Nest completa y la base del
  motor elegido (SQLite en memoria por defecto). **Nada de mocks de repositorios.**
- `crearApp()` en `test/utilities/` levanta la app con `RelojFijo`, `NotificadorMemoria` y
  una base limpia por archivo. Cada test arma sus propios datos con *builders*
  (`crearLugar({ … })`); **no dependen de las semillas de demo** ni del orden.
- Por cada endpoint, como mínimo:
  - camino feliz, con el cuerpo validado contra el contrato (10.3) **y** asserts de los
    valores que importan;
  - 400 por cada validación relevante;
  - 401 sin token y 403 con el rol equivocado o sin ser dueño, si es protegido;
  - 404 del recurso que no existe;
  - **cada código de error** del catálogo que ese endpoint puede devolver;
  - listas: vacía, paginación (`meta` correcto) y cada filtro.
- Idempotencia: el mismo `POST` dos veces deja **un** registro (sección 10.5).
- Concurrencia donde el PRD tiene un "no puede haber dos": `Promise.all` de dos pedidos
  iguales → uno pasa y el otro devuelve el código de conflicto.
- Push: después de la acción, el `NotificadorMemoria` tiene exactamente las notificaciones
  esperadas, y ninguna para quien tiene los avisos apagados.
- Nada de snapshots de respuestas completas: se rompen por cualquier cosa y no dicen qué.

### 10.3 Contrato: el cuerpo tiene la forma exacta del PRD

- `pnpm contrato:esquema` genera `contract/schema.json` desde `contract/types.ts` y
  `contract/api.ts` con
  `ts-json-schema-generator --path 'contract/*.ts' --type '*' --no-type-check`. Da
  `additionalProperties: false` y todos los campos como requeridos, así que un campo ausente
  o uno de más falla. (Avisa un peer de TypeScript 5 contra el 6 del proyecto; con
  `--no-type-check` funciona, verificado.)
- `esperarContrato(cuerpo, 'Lugar')` en `test/utilities/` valida con `ajv`:
  - el sobre (`datos` + `meta`, o `error` con exactamente `codigo` y `mensaje`);
  - cada elemento de `datos` contra la definición pedida;
  - que **todo string con forma de fecha y hora** sea `AAAA-MM-DDTHH:MM:SS-03:00`;
  - que ningún id sea número y que ningún string sea `""` donde el tipo admite `null`.
- Todo test e2e de éxito pasa por `esperarContrato`. Todo test de error valida el sobre de
  error.
- Hay un test que recorre las definiciones de `contract/schema.json` y falla si alguna
  entidad que la API devuelve no aparece en ningún `esperarContrato(…, '<Entidad>')` de
  `test/` (lo busca en el texto de los archivos). Así ningún tipo queda sin cubrir.

### 10.4 Matriz de motores

- `pnpm test:e2e` usa SQLite en memoria: es el ciclo rápido de cada cambio.
- `pnpm test:e2e:matriz` corre **la misma suite** contra PostgreSQL 17, MySQL 8.4 y
  MariaDB 11 levantados con `docker compose -f compose.matriz.yaml`, y los tests de archivos
  contra S3Proxy, del mismo archivo (sección 17.4). Antes de cerrar un módulo, los
  cuatro en verde. Si no tenés Docker disponible, decilo en el informe: la CI lo corre igual.
- La CI (`.github/workflows/ci.yml`) corre `verificar` y la matriz como *service containers*
  de GitHub Actions, con `TZ=UTC` y con `TZ=America/Argentina/Buenos_Aires`.
- En la matriz también corre el test de estabilidad del esquema (5.2) y un test que siembra
  los datos de demo y valida **cada** registro sembrado contra el contrato.

### 10.5 Sincronización offline e idempotencia

Las entidades del PRD que tienen `sincronizada`/`sincronizado` se crean en el teléfono sin
señal y se suben después, a veces más de una vez (la conexión se corta a mitad del envío). Para
esas:

- El `POST` acepta un `id` generado por el cliente con el prefijo correcto
  (`/^<prefijo>-[A-Za-z0-9_-]{3,36}$/`). Si no viene, lo genera el servidor.
- Si ya existe un registro con ese `id` **del mismo usuario**: 200 con el existente, sin
  duplicar ni dar error. Si es de otro usuario: 409 `ID_EN_USO`.
- La fecha del hecho la manda el cliente (cuándo se sacó la foto, no cuándo se subió). Se
  acepta si no está en el futuro (tolerancia: 5 minutos por relojes desfasados).
- Test obligatorio: mismo cuerpo dos veces → un registro, las dos respuestas iguales.

---

## 11. Calidad y proceso

### 11.1 Comandos

| Comando | Qué hace |
|---|---|
| `pnpm dev` | Levanta la API en `0.0.0.0:3000` con recarga. |
| `pnpm db:reiniciar` | Borra, crea el esquema y siembra. |
| `pnpm contrato:esquema` | Regenera `contract/schema.json`. |
| `pnpm test` | Unitarios. |
| `pnpm test:e2e` | E2E en SQLite en memoria. |
| `pnpm test:e2e:matriz` | E2E en los cuatro motores. |
| `pnpm verificar` | `tsc --noEmit` + lint + `test` + `test:e2e`. Tiene que dar verde antes de cada commit. |
| `pnpm docker:probar` | Levanta los cuatro compose y los prueba (sección 16.3). |

### 11.2 Código

- TypeScript `strict`. Sin `any` (la excepción son los helpers de columnas, con un comentario
  que diga por qué). Sin `@ts-ignore`.
- Lint y formato con lo que trae `nest new` (oxlint + prettier). Cero advertencias.
- Capas: **controlador** (HTTP, DTO, sin lógica) → **servicio** (orquesta, transacciones,
  notificaciones) → **reglas** (funciones puras). El **mapeador** es la única salida hacia el
  cliente.
- Nada de lógica en las entidades más allá de lo que TypeORM necesita.

### 11.3 Configuración

`@nestjs/config` con un esquema que valida el entorno al arrancar. Si falta algo o está mal,
la app **no arranca** y dice en castellano qué falta y cómo arreglarlo. Variables comunes:
`PUERTO` (o `PORT`, que es lo que inyectan los hosts), `ENTORNO`, `CONFIAR_PROXY`, `URL_PUBLICA`,
`DB_MOTOR`, `DB_URL`, `DB_ARCHIVO`, `DB_SINCRONIZAR`, `DB_PROVEEDOR`, `DB_SSL`, `DB_SSL_CA`,
`DB_ESQUEMA`, `JWT_SECRETO`,
`DIRECTORIO_ARCHIVOS`, `NOTIFICACIONES`, `RELOJ_FIJO`, `SIMULACION_HABILITADA`,
`SEMBRAR_SI_VACIA`, y las de archivos de la sección 17.2.

### 11.4 Pensado para que lo corran alumnos

- Escucha en `0.0.0.0`: el teléfono con Expo Go no llega a `localhost`, entra por la IP de la
  computadora (`http://192.168.0.10:3000`). Al arrancar, la API imprime las URLs de las
  interfaces de red que encontró (dentro de Docker, avisa que hay que usar la IP de la
  computadora, no la del contenedor). `URL_PUBLICA` no hace falta (sección 8).
- CORS abierto (la app puede correr también en Expo web).
- `GET /salud` (público) → `{ datos: { estado: "ok", motor, almacen, version }, meta: null }`: lo
  primero que prueban desde el teléfono.
- **Simulación de fallas**: si `SIMULACION_HABILITADA=true` (default en desarrollo, siempre
  `false` en tests salvo el test de la propia simulación), la cabecera
  `X-Simular: error-500` devuelve un `ERROR_INTERNO` y `X-Simular: demora-3000` responde tres
  segundos tarde. Los PRD les piden a los alumnos manejar errores de red y estados de carga;
  esto les deja probarlo sin apagar el wifi.
- Sin dependencias nativas además de `better-sqlite3`: en Windows es lo primero que se rompe.

### 11.5 Swagger

`/docs` documenta cada endpoint con el ejemplo del PRD, los parámetros, qué rol necesita y
cada código de error posible. Los textos, en castellano. Es la referencia que usan los alumnos
para pasar de mock a `fetch`.

### 11.6 Git

- Commits chicos, uno por paso en verde, en castellano con Conventional Commits:
  `feat(reservas): rechaza turnos pasados`, `test(reservas): …`, `fix(…)`.
- Todo en `main`, un commit por paso en verde: no se abren ramas por módulo (la única rama
  aparte es `solucion-notificaciones`, sección 19). Cada módulo cerrado queda con la etiqueta
  `modulo-Mx`, que pone el orquestador.
- `pnpm verificar` en verde antes de cada commit. Nunca `--no-verify`.

### 11.7 Congelamiento del contrato

Cuando la cátedra publica la API a los alumnos se etiqueta `v1.0.0`. Desde ahí:
- se pueden **agregar** endpoints y códigos de error;
- **no** se puede cambiar la forma de una respuesta, renombrar una ruta, cambiar un código de
  error existente ni la semántica de un filtro;
- todo cambio va a `CHANGELOG.md` en castellano, escrito para los alumnos.

---

## 12. Verificación independiente: el subagente `verificador-contrato`

El que escribe el código escribe tests que confirman **su propia lectura** del PRD. Por eso,
al cerrar cada módulo, lo revisa un agente con contexto limpio que no vio la implementación.

- Definición: `.claude/agents/verificador-contrato.md`.
- Lee `docs/SPECIFICATION.md`, `contract/types.ts`, `docs/prd.pdf`, `docs/DECISIONS.md` y
  los tests existentes. **No lee `src/`**: prueba la API como caja negra.
- Escribe tests adversariales sólo en `test/verification/<modulo>.e2e-spec.ts`: bordes de
  fechas, nulos, campos de más, roles cruzados, ids de otro usuario, pedidos repetidos y
  simultáneos, cada código de error.
- Corre todo (incluida la matriz si hay Docker) y devuelve un informe con lo que falló y cómo
  reproducirlo. **No toca `src/`.**
- Vos corregís `src/` (nunca sus tests, salvo que demuestres que el test contradice la
  especificación; en ese caso lo anotás en el informe y se decide) y lo volvés a invocar
  hasta que dé verde.

Si tu herramienta no tiene subagentes, abrí una sesión nueva, sin el historial de esta, y
pasale el contenido de ese archivo como instrucción.

---

## 13. README para los alumnos

En castellano rioplatense, con voseo, y sin suponer que saben de backend. Tiene que traer:

1. Qué es la API y de qué PRD sale.
2. **Con Docker, un solo comando** (va primero): `docker compose up`, y la tabla de la
   sección 16 para cada motor. Cómo volver a cero (`docker compose down -v`).
3. Sin Docker: requisitos (Node 24, pnpm), cómo instalarlos y arrancar en tres comandos con
   SQLite: `pnpm install`, `pnpm db:reiniciar`, `pnpm dev`.
4. Sin Docker con PostgreSQL, MySQL o MariaDB instalados a mano, incluida la advertencia de
   XAMPP → `mariadb`.
5. Cómo conectarse desde el teléfono: misma red, IP de la computadora, firewall de Windows y
   del antivirus, prueba con `/salud`.
6. Usuarios de demo por rol, con email y contraseña.
7. Tabla de endpoints y tabla de códigos de error (generadas del catálogo, no a mano).
8. Cómo simular errores y demoras; cómo congelar el reloj.
9. Cómo volver los datos al estado inicial.
10. Problemas frecuentes.

---

## 14. Definición de terminado (por módulo) e informe de cierre

Un módulo está terminado cuando:

- [ ] Cada endpoint del módulo en `SPECIFICATION.md` existe, con la ruta y el método exactos.
- [ ] Cada regla del módulo tiene un test que la nombra, y cada código de error, el suyo.
- [ ] `pnpm verificar` en verde.
- [ ] Matriz de cuatro motores en verde (o se dice que no hubo Docker).
- [ ] Test de estabilidad del esquema en verde.
- [ ] En M0 y en el último módulo del plan: `pnpm docker:probar` en verde con los cuatro
      compose (o se dice que no hubo Docker). En el resto, si cambiaron dependencias o el
      arranque, también.
- [ ] `verificador-contrato` en verde.
- [ ] Semillas del módulo cargadas, incluidos los casos feos que pide el PRD, y validadas
      contra el contrato.
- [ ] Swagger, README, `DECISIONS.md` y `CHANGELOG.md` al día.
- [ ] `grep -rn "new Date()\|Date.now()" src/` sólo encuentra `src/common/clock/`.
- [ ] Los mensajes de error y los textos del README están en castellano rioplatense.

Informe de cierre (en el chat; en modo autónomo, además en `docs/reports/<Mx>.md`, sección 15):

```
## Módulo Mx — <nombre>: terminado

Endpoints: <lista método + ruta>
Tests: <n> unitarios, <n> e2e, <n> de verificación · matriz: sqlite ✓ postgres ✓ mysql ✓ mariadb ✓
Documentación consultada: <librerías vía Context7, o "Context7 no disponible: tipos de node_modules">
Decisiones tomadas: <ids de DECISIONS.md, con una línea cada una>
Pendientes que necesitan respuesta: <lista o "ninguno">
Lo que no hice y por qué: <lista o "nada">
Siguiente módulo propuesto: Mx+1 — <nombre>. Espero el OK.
```

---

## 15. Modo autónomo

Cuando el pedido empieza con `MODO AUTÓNOMO`, te lanzó `orquestar.mjs`: una sesión por módulo,
sin nadie mirando. Nadie va a leer una pregunta ni a darte el OK. Esta sección reemplaza lo que
las secciones 1 y 14 dicen de preguntar y esperar.

- Hacés **sólo** el módulo que te pidieron, completo (sección 1, pasos 1 a 10), y terminás. No
  arrancás el siguiente: lo lanza el orquestador cuando el tuyo pase sus controles.
- **No preguntes.** Las herramientas para preguntar no están disponibles.
  - Decisión `PENDIENTE` de la especificación → implementás el default de su tabla y la anotás
    en `docs/DECISIONS.md` como `PROVISORIA (autónomo)`.
  - Hueco nuevo, que no está en ningún documento → elegís la opción más conservadora compatible
    con el PRD (la que no agrega campos, no cambia formas y deja más puertas abiertas), la
    implementás y la anotás como `PROVISORIA (autónomo)` con las alternativas que descartaste.
  - La especificación contradice la forma de datos del PRD → **no** lo resolvés vos:
    implementás el resto del módulo, anotás `BLOQUEANTE` en `docs/DECISIONS.md` y terminás con
    estado `BLOQUEADO`.
- El pedido dice si hay Docker. Si no hay, la matriz corre sólo en SQLite y lo anotás en el
  informe: no es motivo para no terminar.
- Al `verificador-contrato` lo invocás **en primer plano** y esperás su informe.
- El informe de cierre (sección 14) va también a `docs/reports/<Mx>.md`, y su **primera línea**
  es exactamente una de estas:

  ```
  Estado: TERMINADO
  Estado: INCOMPLETO
  Estado: BLOQUEADO
  ```

  `TERMINADO` sólo si se cumple **toda** la definición de terminado. Si algo quedó afuera,
  `INCOMPLETO` y la lista de qué falta: el orquestador te vuelve a lanzar con esa lista. Un
  `TERMINADO` falso no sirve: el orquestador corre `pnpm verificar` por su cuenta antes de
  aceptarlo.
- Al terminar, **todo commiteado** (`git status` limpio). Lo generado (`node_modules`, `dist`,
  `coverage`, la base SQLite, `archivos/`, `.env`) va en `.gitignore`.
- **No modifiques** `AGENTS.md`, `CLAUDE.md`, `docs/SPECIFICATION.md`, `docs/prd.pdf`,
  `contract/types.ts` ni `.claude/agents/`, y **no crees** un `.mcp.json`. El orquestador
  compara esos archivos con la versión inicial y rechaza el módulo si cambiaron.
- Si te lanzan de nuevo sobre un módulo que no pasó, puede haber trabajo a medias: empezá por
  `git status`, `git log` y el informe anterior, y seguí desde ahí.
- Trabajás en `main` (sección 11.6). Si terminás en otra rama, el orquestador intenta llevar
  `main` hasta ahí y rechaza el módulo si no puede.
- Nada de `git push`, y nada fuera de la carpeta del repo.

---

## 16. Docker: todo con un solo comando

Para el grupo que no quiere instalar Node ni una base de datos: con Docker Desktop, un comando
levanta la API, la base y los datos de demo.

| Comando | Qué levanta |
|---|---|
| `docker compose up` | API + SQLite (en un volumen) |
| `docker compose -f compose.postgres.yaml up` | API + PostgreSQL 17 |
| `docker compose -f compose.mysql.yaml up` | API + MySQL 8.4 |
| `docker compose -f compose.mariadb.yaml up` | API + MariaDB 11 |

Se arma en **M0**, junto con el resto de la base, y el **último módulo** del plan lo prueba de
punta a punta con los datos de demo completos.

### 16.1 La imagen (`Dockerfile`)

Multietapa, sobre `node:24-bookworm-slim`, con `corepack enable` y `"packageManager"` en
`package.json` fijando la versión de pnpm:

1. **deps**: instala `python3 make g++` (por si `better-sqlite3` no encuentra binario
   precompilado para esa plataforma) y corre `pnpm install --frozen-lockfile` copiando sólo
   `package.json` y `pnpm-lock.yaml`, para aprovechar la caché.
2. **build**: copia el resto, `pnpm build` y `pnpm prune --prod`.
3. **final**: sólo `dist/`, el `node_modules` de producción, `package.json` y los medios de las
   semillas; crea `/app/datos` y `/app/archivos` con dueño `node` **antes** de `USER node` (si
   no, los volúmenes se montan como root y la API no puede escribir la base ni las fotos);
   usuario `node`; `EXPOSE 3000`; `HEALTHCHECK` con
   `node -e "fetch('http://127.0.0.1:3000/salud').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"`;
   `CMD ["node", "dist/main.js"]`. Nada de scripts `.sh` como punto de entrada: con finales de
   línea de Windows se rompen.

Verificado: el build ESM de Nest 12 arranca con `node dist/main.js`, y después de
`pnpm prune --prod` sigue andando, incluido `better-sqlite3`.

`.dockerignore`: `node_modules`, `dist`, `coverage`, `datos`, `archivos`, `.git`, `.env`,
`test`.

### 16.2 Los compose

`compose.yaml` (verificado con `docker compose config`):

```yaml
name: <nombre-del-repo>
services:
  api:
    build: .
    ports:
      - "${PUERTO:-3000}:3000"
    environment:
      PUERTO: "3000"
      DB_MOTOR: better-sqlite3
      DB_ARCHIVO: /app/datos/api.sqlite
      DB_SINCRONIZAR: "true"
      SEMBRAR_SI_VACIA: "true"
      JWT_SECRETO: solo-para-desarrollo-no-usar-en-produccion
      DIRECTORIO_ARCHIVOS: /app/archivos
      NOTIFICACIONES: expo
      SIMULACION_HABILITADA: "true"
      URL_PUBLICA: ${URL_PUBLICA:-}
    volumes:
      - datos:/app/datos
      - archivos:/app/archivos
    restart: unless-stopped
volumes:
  datos:
  archivos:
```

`compose.postgres.yaml` extiende ese servicio y agrega la base:

```yaml
name: <nombre-del-repo>-postgres
services:
  api:
    extends: { file: compose.yaml, service: api }
    environment:
      DB_MOTOR: postgres
      DB_URL: postgres://api:api@postgres:5432/api
    depends_on:
      postgres: { condition: service_healthy }
  postgres:
    image: postgres:17
    environment: { POSTGRES_USER: api, POSTGRES_PASSWORD: api, POSTGRES_DB: api }
    ports: ["${PUERTO_DB:-5433}:5432"]
    volumes: [postgres:/var/lib/postgresql/data]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U api -d api"]
      interval: 3s
      timeout: 3s
      retries: 40
volumes:
  datos:
  archivos:
  postgres:
```

Los otros dos, igual:

| Archivo | Imagen | `DB_MOTOR` | Puerto en la compu | Healthcheck |
|---|---|---|---|---|
| `compose.mysql.yaml` | `mysql:8.4` | `mysql` | 3307 | `mysqladmin ping -h 127.0.0.1 -uapi -papi` |
| `compose.mariadb.yaml` | `mariadb:11` | `mariadb` | 3308 | `healthcheck.sh --connect --innodb_initialized` |

Reglas:

- Cada archivo tiene su `name:` propio, para que los cuatro no se pisen los contenedores ni
  los volúmenes.
- Las bases se publican en 5433, 3307 y 3308, no en los puertos de siempre: así no chocan con
  una base instalada (XAMPP usa 3306) y se pueden mirar con DBeaver.
- **Datos de demo solos**: con `SEMBRAR_SI_VACIA=true`, al arrancar la API crea el esquema y
  siembra si la base no tiene datos; si ya tiene, no toca nada. Volver a cero:
  `docker compose down -v` y `up` de nuevo.
- La API espera a la base (`depends_on` con `service_healthy`) y además reintenta la conexión
  (`retryAttempts` / `retryDelay` de `TypeOrmModule`), porque "healthy" no siempre quiere decir
  "acepta conexiones".
- Sin secretos reales: el `JWT_SECRETO` de los compose dice que es de desarrollo.
- Imágenes oficiales multiarquitectura: anda en Mac con Apple Silicon, Windows y Linux.

`compose.matriz.yaml` es otra cosa: sólo las tres bases, en `tmpfs` (rápidas y descartables),
en los puertos 55432, 53306 y 53307, más S3Proxy (sección 17.3), para
`pnpm test:e2e:matriz`.

### 16.3 La prueba (`pnpm docker:probar`)

`scripts/test-docker.mjs`, sin dependencias. Para cada uno de los cuatro compose, con un
nombre de proyecto propio y puertos que no choquen (`PUERTO=39990`, `PUERTO_DB=39991`):

1. `docker compose up -d --build --wait`;
2. `GET /salud` → 200, sobre correcto y el `motor` que corresponde a ese archivo;
3. `GET` a un listado público del proyecto → 200 y **con datos** (las semillas se cargaron);
4. `docker compose down -v`, siempre, aunque algo haya fallado (y antes de bajar, si falló,
   imprime las últimas líneas de `docker compose logs`).

Corre en la CI como un trabajo aparte y, si hay Docker, en M0 y en el último módulo. El
orquestador, además, levanta los compose por su cuenta y prueba `/salud` antes de aceptar esos
módulos.

---

## 17. Archivos: almacenamiento intercambiable

Las fotos, los audios y los videos se guardan detrás de un puerto. Cambiar de proveedor es
cambiar variables de entorno, no código, y **la app no se entera**: las URLs son siempre
`<origen>/archivos/<clave>` (sección 8), y la API sirve el archivo ella misma sea cual sea el
proveedor.

Hay **dos adaptadores**: disco y S3. Todos los proveedores en la nube que soportamos hablan el
protocolo de S3, así que no hay un adaptador por proveedor: hay **un preset por proveedor**,
que completa endpoint, región y estilo de ruta, y valida que estén las variables que ese
proveedor necesita.

### 17.1 El puerto

```ts
// src/common/files/file-storage.ts
export interface LecturaArchivo {
  flujo: Readable;          // node:stream
  bytesTotales: number;     // tamaño completo del archivo
  tipoMime: string;
}

export interface AlmacenArchivos {
  readonly proveedor: ProveedorArchivos;        // lo que informa /salud
  prepararse(): Promise<void>;                  // al arrancar: verifica acceso (reintenta unos segundos); con emulador crea el bucket
  guardar(clave: string, contenido: Buffer, tipoMime: string): Promise<void>;
  leer(clave: string, rango?: { inicio: number; fin: number }): Promise<LecturaArchivo>;
  existe(clave: string): Promise<boolean>;
  borrar(clave: string): Promise<void>;
}
```

- **Clave**: `<imagenes|audios|videos>/<AAAA>/<MM>/<id aleatorio>.<ext>`, generada por el
  servidor. Nunca se reutiliza.
- **Un solo controlador** para `GET /archivos/*clave`, sea cual sea el proveedor: valida la
  clave, llama a `leer` con el rango de la cabecera `Range` y responde 200 o 206 con
  `Content-Range`, `Accept-Ranges: bytes`, `Content-Type`, `Content-Length`, `ETag` y
  `Cache-Control: public, max-age=31536000, immutable` (la clave no cambia nunca). El soporte de
  `Range` se escribe una vez, no una por adaptador.
- `ARCHIVOS_REDIRIGIR=true` (opcional, sólo proveedores en la nube): en vez de pasar el archivo
  por la API, responde 302 a una URL firmada de 15 minutos. Por defecto `false`: con los
  emuladores dentro de Docker, la URL firmada apunta a un host que el teléfono no ve.
- `/salud` informa el proveedor en `almacen`.
- **Errores**: clave inexistente → 404 `ARCHIVO_NO_ENCONTRADO`; proveedor caído → 503
  `ALMACEN_NO_DISPONIBLE` ("No pudimos acceder a los archivos. Probá de nuevo en un rato."). Si
  `prepararse` falla al arrancar, o falta una variable del proveedor elegido, la API no arranca
  y dice en castellano **qué variable falta y dónde se consigue**.
- **Nunca** credenciales reales en el repo, en los compose ni en los tests.

### 17.2 Proveedores

Se elige con **una sola variable**, `ARCHIVOS_PROVEEDOR`:

| `ARCHIVOS_PROVEEDOR` | Adaptador | Endpoint | `S3_REGION` | Ruta | Variables que pide |
|---|---|---|---|---|---|
| `local` (default) | disco | — | — | — | `DIRECTORIO_ARCHIVOS` (default `./archivos`) |
| `aws` | S3 | el de AWS | la del bucket | virtual | `S3_BUCKET`, `S3_REGION`, claves |
| `supabase` | S3 | `https://<SUPABASE_PROYECTO>.storage.supabase.co/storage/v1/s3` | la del proyecto | **path** | `SUPABASE_PROYECTO`, `S3_BUCKET`, `S3_REGION`, claves |
| `r2` | S3 | `https://<R2_CUENTA>.r2.cloudflarestorage.com` | `auto` (fija) | virtual | `R2_CUENTA`, `S3_BUCKET`, claves |
| `b2` | S3 | `https://s3.<S3_REGION>.backblazeb2.com` | la del bucket (p. ej. `us-west-004`) | virtual | `S3_BUCKET`, `S3_REGION`, claves |
| `s3proxy` | S3 | `http://s3:8080` | `us-east-1` | **path** | nada (emulador local; sección 17.3) |
| `localstack` | S3 | `http://localstack:4566` | `us-east-1` | **path** | nada (emulador local; sección 17.3) |

- "Claves" son `S3_ACCESS_KEY_ID` y `S3_SECRET_ACCESS_KEY`.
- `S3_ENDPOINT` y `S3_FORZAR_PATH_STYLE`, si están, **pisan** lo que diga el preset (sirve para
  cualquier otro servicio compatible con S3 sin tocar código).
- Los presets son una **tabla de datos** en `src/common/files/providers.ts` y una función
  pura `configuracionS3(entorno) → { endpoint, region, forcePathStyle, … } | error` con test
  unitario por proveedor (incluidas las variables que faltan y el mensaje que da).
- Endpoints verificados en la documentación de cada proveedor (septiembre de 2026): Supabase
  (`storage.supabase.co`, región del proyecto, `forcePathStyle: true`), R2 (región `auto`) y
  B2 (región igual a la del endpoint).

Cosas que la documentación vieja dice mal o no dice:

- Desde principios de 2025, `@aws-sdk/client-s3` calcula y valida *checksums* por defecto, y
  varios servicios compatibles (R2, B2, emuladores) los rechazan o los calculan distinto. Con
  cualquier proveedor que no sea `aws`, el cliente va con
  `requestChecksumCalculation: 'WHEN_REQUIRED'` y `responseChecksumValidation: 'WHEN_REQUIRED'`.
  Confirmalo con Context7 para la versión instalada (sección 2.3).
- **Supabase**: las claves S3 se generan en la configuración S3 del proyecto, saltean las
  políticas de RLS y dan acceso a todos los buckets: sólo del lado del servidor, como acá. En el
  plan gratis, cada archivo puede pesar hasta 50 MB (los límites de la sección 8 entran).
- **LocalStack** pide cuenta y `LOCALSTACK_AUTH_TOKEN` desde marzo de 2026 (el plan gratis es
  para uso no comercial). Por eso los tests y la CI usan S3Proxy, que no pide nada; LocalStack
  queda como opción para quien quiera "AWS local".
- **Firebase Storage no se soporta**: desde septiembre de 2024 exige el plan Blaze, con cuenta
  de facturación, y no habla S3.

### 17.3 Emuladores y Docker

Dos compose que **se suman** a cualquiera de los de la sección 16 (no llevan `name:` propio):

```bash
docker compose -f compose.yaml -f compose.storage-s3.yaml up
LOCALSTACK_AUTH_TOKEN=… docker compose -f compose.postgres.yaml -f compose.storage-localstack.yaml up
```

| Archivo | Servicio | Y en `api` |
|---|---|---|
| `compose.storage-s3.yaml` | `s3`: `andrewgaul/s3proxy`, puerto 8080, `S3PROXY_AUTHORIZATION=none`, `JCLOUDS_PROVIDER=filesystem`, `JCLOUDS_FILESYSTEM_BASEDIR=/data` en un volumen | `ARCHIVOS_PROVEEDOR=s3proxy`, `ARCHIVOS_CREAR_BUCKET=true`, `S3_BUCKET=archivos`, claves de mentira |
| `compose.storage-localstack.yaml` | `localstack`: `localstack/localstack`, puerto 4566, `SERVICES=s3`, `LOCALSTACK_AUTH_TOKEN: "${LOCALSTACK_AUTH_TOKEN:?Falta LOCALSTACK_AUTH_TOKEN. …}"`, **entre comillas** (sin comillas, el mensaje rompe el YAML; verificado), para que compose falle con un mensaje claro si falta | `ARCHIVOS_PROVEEDOR=localstack`, lo mismo que arriba |

Para los proveedores en la nube no hay compose: se ponen las variables en `.env` (el
`.env.example` trae un bloque comentado por proveedor, con dónde conseguir cada dato).

Cada emulador tiene *healthcheck* y la API lo espera con `depends_on: service_healthy`. Se
verificó con `docker compose config` que estos archivos se combinan bien con los de la sección 16
(la API queda con la base de uno y los archivos del otro, y espera a los dos). Las versiones de
las imágenes van fijas, verificadas contra el registro. `compose.matriz.yaml` levanta S3Proxy
(sin volumen) en un puerto fijo para los tests.

### 17.4 Tests

- **Suite de contrato del puerto** (`test/storage/contrato-almacen.ts`), **la misma** para los
  dos adaptadores: guardar y leer devuelve los mismos bytes y el mismo tipo; un rango (bytes 10
  a 19) devuelve esos 10 bytes con `bytesTotales` correcto; el último byte; una clave que no
  existe tira `ArchivoNoEncontrado`; `existe`; `borrar`; claves con varias `/`; un archivo de
  5 MB. `pnpm test` la corre con `local`; `pnpm test:e2e:matriz`, además, con S3 (S3Proxy).
- **E2E** en la matriz, con S3Proxy: subir con `POST /archivos`, bajar con la URL devuelta
  (mismos bytes) y pedir un rango (206).
- **Presets**: test unitario de `configuracionS3` por proveedor (sección 17.2).
- **Proveedores reales**: `pnpm archivos:probar` usa la configuración del `.env` y, contra el
  proveedor que sea, sube un archivo chico, lo lee entero y por rango, y lo borra; dice en
  castellano qué salió mal (credenciales, bucket, región). No corre en la CI (necesita cuentas):
  es para que la cátedra o un grupo comprueben su configuración.
- **Semillas**: los medios de demo se suben **por el puerto** al sembrar, así existen en
  cualquier proveedor.
- `pnpm docker:probar` suma `compose.yaml` + `compose.storage-s3.yaml` (sube un archivo y lo
  baja), y `compose.storage-localstack.yaml` sólo si hay `LOCALSTACK_AUTH_TOKEN`.

### 17.5 Cuándo se hace

- **M0**: el puerto, el adaptador de disco, el controlador de `/archivos` con `Range` y la suite
  de contrato corriendo con `local`. Todos los módulos guardan archivos por el puerto desde el
  principio.
- **Módulo «Nube»** (el anteúltimo del plan): el adaptador S3 con los
  presets, S3Proxy y LocalStack en Docker, `pnpm archivos:probar` y la suite contra los dos
  adaptadores. Si hace falta tocar algo fuera de `src/common/files/`, es que el puerto quedó
  mal diseñado en M0: se corrige ahí y se anota en el informe. En el mismo módulo van los
  presets de base de datos y la publicación (sección 18).

---

## 18. La nube: base de datos administrada y publicación

Con Docker la API corre en la computadora del grupo; publicada, tiene una URL `https://` que
anda desde cualquier red. Eso importa: el PRD pide **build de producción con EAS**, y una app
instalada no puede apuntar a la IP de una notebook.

La combinación de referencia, gratis y sin tarjeta (septiembre de 2026):

| Pieza | Servicio | Por qué |
|---|---|---|
| La API (la imagen de la sección 16) | **Render**, web service desde el `Dockerfile` | Plan gratis sin tarjeta, soporta Docker. |
| Base de datos | **Supabase** (Postgres) | 500 MB en el plan gratis. |
| Archivos | **Supabase Storage** (`ARCHIVOS_PROVEEDOR=supabase`, sección 17) | 1 GB; mismo proyecto que la base. |

Supabase no corre contenedores (sus Edge Functions son otra cosa), por eso la API va en Render.
Alternativas que entran igual: Koyeb para la API; Neon o Aiven para la base; R2 o B2 para los
archivos.

### 18.1 Presets de base de datos

Igual que con los archivos: una variable, `DB_PROVEEDOR`, que completa y valida lo que cada
servicio necesita. Sin `DB_PROVEEDOR`, todo sigue como en la sección 5.1.

| `DB_PROVEEDOR` | Motor | SSL | `DB_ESQUEMA` | Qué valida de `DB_URL` |
|---|---|---|---|---|
| `supabase` | `postgres` | cifrado (como `sslmode=require`) | `api` | Que sea la del **pooler en modo sesión**: host `…pooler.supabase.com`, puerto **5432**, usuario `postgres.<ref>`. |
| `neon` | `postgres` | cifrado y verificado | `public` | Host `….neon.tech`. |
| `aiven-postgres` | `postgres` | cifrado (verificado si hay `DB_SSL_CA`) | `public` | Host `….aivencloud.com`. |
| `aiven-mysql` | `mysql` | cifrado (verificado si hay `DB_SSL_CA`) | — | Host `….aivencloud.com`. |

- `DB_SSL` = `no` · `si` (cifra y verifica el certificado) · `si-sin-verificar` (cifra sin
  verificar, lo mismo que `sslmode=require`). Supabase y Aiven firman con una CA propia, así
  que su preset usa `si-sin-verificar`; con `DB_SSL_CA` (ruta al certificado de la CA que da el
  proveedor, fuera de git) pasa a verificar contra esa CA. Neon usa un certificado público:
  `si`. Un error de certificado se traduce a un mensaje que dice cuál de las dos opciones usar.
- `DB_ESQUEMA` (sólo PostgreSQL) es el esquema donde van las tablas. La API lo crea al arrancar
  si no existe (`queryRunner.createSchema(nombre, true)`, sin SQL a mano) y le dice a TypeORM
  que use ése.
- Los presets son una tabla en `src/common/db/providers.ts` y una función pura
  `configuracionBase(entorno)` con test unitario por proveedor: URLs buenas, URLs equivocadas y
  el mensaje en castellano de cada error.
- `DB_URL` puede traer caracteres raros en la contraseña: se parsea con `URL` y se decodifica,
  nunca con una expresión regular.

**Supabase, lo que hay que saber** (de su documentación):

- La conexión directa (`db.<ref>.supabase.co`) es **sólo IPv6**, y Render y la mayoría de los
  hosts salen por IPv4. Para un servidor que queda corriendo, Supabase recomienda el **pooler
  compartido en modo sesión** (IPv4, puerto 5432). El modo transacción (6543) no admite
  *prepared statements*: el preset lo rechaza con un mensaje que explica cuál usar.
- Las tablas van en el esquema **`api`**, no en `public`: lo que está en `public` puede quedar
  expuesto por la Data API de Supabase. Desde 2026 Supabase ya no expone tablas nuevas de
  `public` sin un `GRANT` explícito (proyectos nuevos desde mayo; todos desde el 30/10/2026),
  pero un esquema propio evita depender de eso. Nunca se hace `GRANT` a `anon` ni a
  `authenticated`.
- El plan gratis **pausa el proyecto después de una semana sin uso**; se reactiva desde el
  panel. Va en el README.

**Neon** suspende la base a los 5 minutos sin uso y la primera conexión tarda un poco más; el
reintento de conexión de la sección 16.2 lo cubre. **Aiven** apaga el servicio gratis después de
un tiempo sin uso (avisa por mail) y, en MySQL, suele exigir clave primaria en todas las tablas
(las nuestras la tienen; si `synchronize` falla por eso, ésa es la causa). La base gratis de **Render** vence a los 30 días: no se usa.

### 18.2 Publicar en Render

- **`render.yaml`** en la raíz (Blueprint de Render): un web service con `runtime: docker`,
  plan gratis, `healthCheckPath: /salud`, y las variables: las fijas con su valor
  (`ENTORNO=publicado`, `CONFIAR_PROXY=true`, `DB_PROVEEDOR=supabase`,
  `ARCHIVOS_PROVEEDOR=supabase`, `SEMBRAR_SI_VACIA=true`, `DB_SINCRONIZAR=true`) y los secretos
  sin valor, para que Render los pida (`DB_URL`, `JWT_SECRETO`, `SUPABASE_PROYECTO`,
  `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`). Verificá el formato
  del Blueprint con Context7 antes de escribirlo.
- El README trae el botón **"Deploy to Render"** que apunta al repo del grupo, y un paso a paso:
  crear el proyecto de Supabase, copiar la cadena del pooler de sesión, crear el bucket, generar
  las claves S3, pegar todo en Render.
- **Puerto**: la API escucha en `PUERTO`, o si no está, en `PORT` (Render y Koyeb inyectan
  `PORT`).
- **HTTPS en las URLs**: detrás del proxy del host, `req.protocol` dice `http`. Con
  `CONFIAR_PROXY=true`, Express confía en `X-Forwarded-Proto` y `X-Forwarded-Host` (`trust
  proxy`), y las URLs de los archivos (sección 8) salen `https://…`. iOS bloquea `http` en una
  app publicada: hay un test que manda esas cabeceras y espera URLs `https`.
- **`ENTORNO=publicado`** hace que la API **no arranque** (con un mensaje en castellano que dice
  qué cambiar) si: la base es SQLite (el disco del host se borra en cada reinicio), los archivos
  son `local` (ídem), `JWT_SECRETO` es el de desarrollo o tiene menos de 32 caracteres, o
  `SIMULACION_HABILITADA=true`.
- **Arranque en frío**: el servicio gratis de Render se duerme a los 15 minutos sin tráfico y
  tarda alrededor de un minuto en despertar. El README se lo avisa a los alumnos: la primera
  llamada puede tardar, y la app tiene que mostrar que está cargando (los PRD ya lo piden).
- **`pnpm publicado:probar <url>`**: contra una API publicada, pide `/salud` (motor `postgres`,
  el almacen esperado) y un listado con imágenes, y verifica que sus URLs empiecen con
  `https://` y respondan. Es lo que corre el grupo después de publicar.
- **`pnpm db:probar`**: con la configuración del `.env`, se conecta, muestra motor, versión y
  esquema, crea y borra una tabla de prueba en ese esquema, y dice en castellano qué salió mal
  (contraseña, pooler equivocado, SSL). Como `archivos:probar`, no corre en la CI.

### 18.3 Tests

- `configuracionBase` y `configuracionS3`: unitarios, un caso por proveedor y por error.
- En la matriz, con PostgreSQL: las tablas quedan en `DB_ESQUEMA` y `db:reiniciar` no toca
  otro esquema (el test crea una tabla ajena en `public` y verifica que sobrevive).
- `ENTORNO=publicado`: un test por cada condición que impide arrancar.
- `CONFIAR_PROXY`: con y sin las cabeceras `X-Forwarded-*`.
- Lo que necesita cuentas reales (Supabase, Render) no corre en la CI: para eso están
  `db:probar`, `archivos:probar` y `publicado:probar`.

### 18.4 Cuándo se hace

En el módulo «Nube», junto con el almacenamiento (sección 17.5).

---

## 19. Notificaciones: la parte que programan los alumnos

La cátedra quiere que los alumnos programen **el guardado de los tokens de Expo y el envío de
las push**. La API se construye completa (así todo lo demás se prueba de verdad) y en el último
módulo del plan, «Notificaciones para completar», se vacían esas dos piezas. La solución queda
en una rama aparte.

### 19.1 Qué decide la API y qué programan los alumnos

| Lo sigue haciendo la API | Lo programan los alumnos |
|---|---|
| **Cuándo** y **a quién** se avisa: las reglas de la sección 7 de cada especificación, el interruptor `avisosActivos`, que el autor no se avise a sí mismo, etc. | **Guardar** los tokens de Expo de cada usuario, darlos de baja, buscarlos y descartar los inválidos. |
| El **texto** de cada aviso y los `datos` (por ejemplo, a qué pantalla lleva). | **Enviar** las push a Expo y leer su respuesta. |
| Los endpoints `/dispositivos` (misma ruta y mismo contrato que hoy). | |

### 19.2 El diseño (desde M0)

En `src/common/notifications/`:

```ts
export interface MensajePush {
  tokens: string[];
  titulo: string;
  cuerpo: string;
  datos: Record<string, string>;
}

// Lo que completan los alumnos (1): dónde viven los tokens.
export interface AlmacenTokensPush {
  guardar(usuarioId: string, tokenExpo: string, plataforma: 'ios' | 'android'): Promise<void>;
  borrar(tokenExpo: string): Promise<void>;
  tokensDe(usuarioIds: string[]): Promise<string[]>;
  descartar(tokens: string[]): Promise<void>;
}

// Lo que completan los alumnos (2): cómo se mandan.
export interface EnviadorPush {
  enviar(mensajes: MensajePush[]): Promise<{ tokensInvalidos: string[] }>;
}
```

- El servicio `Avisos` (de la API, no se vacía) es lo único que usa el dominio:
  `avisar(usuarioIds, { titulo, cuerpo, datos })` filtra por `avisosActivos`, busca los tokens
  en el almacén, llama al enviador **después** de confirmar la transacción, y descarta los
  inválidos. Un error del almacén o del enviador se loguea y **nunca** rompe el pedido.
- El enviador hace `fetch` a `EXPO_PUSH_URL` (default `https://exp.host/--/api/v2/push/send`),
  en tandas de 100 mensajes, y marca como inválidos los tokens que Expo responde con
  `DeviceNotRegistered`. Confirmá el formato de la respuesta de Expo con Context7. Con
  `EXPO_PUSH_URL` configurable, los tests usan un servidor HTTP falso y no salen a internet.
- Los tests de dominio verifican **qué decidió `Avisos`** (a quién y con qué texto) con dobles
  en memoria de los dos puertos (están en `test/utilities/`), no lo que llegó a Expo. Así
  siguen en verde cuando el almacén y el enviador quedan vacíos.

**Repos que ya estaban construidos con otro diseño** (un puerto `Notificador`,
`expo-server-sdk`, el servicio de avisos mezclado con el de dispositivos): el primer paso del
último módulo es llevarlos a este diseño **sin cambiar el contrato**, con `pnpm verificar` en
verde y un commit propio (`refactor: notificaciones en dos puertos`). Recién después se vacía.

### 19.3 El último módulo: vaciar

1. Con todo en verde, se escribe la **consigna ejecutable**: `test/notifications/`, con su
   propia configuración de Vitest y el script `pnpm test:notificaciones` (**afuera** de
   `pnpm verificar`). Prueba los endpoints `/dispositivos` (alta 201, idempotente, el token pasa
   al usuario actual, baja 204, `prueba`) y el enviador contra el servidor falso de Expo (forma
   de cada mensaje, tandas de 100, `DeviceNotRegistered` → descartado). Cada `describe` dice en
   castellano qué tiene que lograr el alumno.
2. Con la solución completa y esa consigna en verde, se crea la rama
   **`solucion-notificaciones`** en ese commit.
3. En `main`, las dos implementaciones se reemplazan por `AlmacenTokensPorHacer` y
   `EnviadorPorHacer`, en `src/student-notifications/`, con comentarios
   `// TODO(alumnos):` que explican qué hace cada método **sin darles el código**. Mientras
   estén vacías:
   - `POST /dispositivos`, `DELETE /dispositivos/:tokenExpo` y `POST /dispositivos/prueba`
     responden **501 `NO_IMPLEMENTADO`**: "Esta parte la programan ustedes. Mirá
     docs/NOTIFICATIONS.md.";
   - `Avisos.avisar` escribe en el log `Push pendiente de implementar: <título> → <n> usuarios`
     y sigue: los flujos de la app nunca se rompen.
   - Los tests de `/dispositivos` y del enviador que estaban en `test/e2e/`, `test/integracion/`
     o `test/verification/` **se mudan** a `test/notifications/` (no se borran: son parte de
     la consigna). En `main` queda un test e2e que comprueba los 501 con el sobre de error.
     Al cerrar el módulo, el verificador comprueba eso mismo: los 501, y que los demás flujos
     que avisan sigan respondiendo bien.
4. Se borra lo que ya no se usa en `main` (`expo-server-sdk` si había, el modelo de dispositivos si
   quedó, variables de entorno sin uso), salvo lo que la consigna necesita.
5. **`docs/NOTIFICATIONS.md`**, para los alumnos, en castellano rioplatense: qué decide la
   API y qué les toca a ellos, qué archivos tocar, qué entidad y qué tabla les conviene crear,
   cómo correr `pnpm test:notificaciones`, cómo probar con Expo Go y
   `POST /dispositivos/prueba`, y enlaces a la documentación de Expo. Pistas, no solución.
6. Swagger y el README marcan los tres endpoints como "los completan ustedes".
7. Resultado: en `main`, `pnpm verificar` en **verde** y `pnpm test:notificaciones` en
   **rojo**; en `solucion-notificaciones`, los dos en **verde**. El orquestador controla las
   tres cosas y que el repo quede en `main`.

La cátedra decide cuándo mostrar la rama. Si el repo se sube a GitHub para los alumnos, se
sube **sólo `main`** (`git push origin main`).

