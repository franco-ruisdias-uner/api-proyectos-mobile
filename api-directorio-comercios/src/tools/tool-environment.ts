import '../config/load-env.js';
import { type Entorno, validarEntorno } from '../config/environment.js';

/** El entorno de las herramientas de línea de comandos; si algo está mal, lo dice y sale. */
export function entornoDeHerramienta(): Entorno {
  try {
    // Estas herramientas no firman sesiones: no exigen JWT_SECRETO.
    return validarEntorno({ JWT_SECRETO: 'herramienta', ...process.env });
  } catch (error) {
    console.error(`\n${(error as Error).message}\n`);
    process.exit(1);
  }
}
