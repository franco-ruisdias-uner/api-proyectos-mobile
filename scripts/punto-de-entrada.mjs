// El build compila desde la raíz (los mapeadores importan los tipos de contrato/), así que
// el código queda en dist/src/. Este archivo deja dist/main.js como punto de entrada, que
// es el que usan el Dockerfile y los hosts: `node dist/main.js`.
import { writeFileSync } from 'node:fs';

writeFileSync(
  new URL('../dist/main.js', import.meta.url),
  "// Generado por scripts/punto-de-entrada.mjs\nimport './src/main.js';\n",
);
