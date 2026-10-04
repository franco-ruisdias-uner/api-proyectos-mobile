// Claves de archivo (AGENTS §17.1): <imagenes|audios|videos>/<AAAA>/<MM>/<id>.<ext>,
// generadas por el servidor y nunca reutilizadas.
import { textoAleatorio } from '../ids/ids.js';
import { origenDelPedido } from '../pedido/contexto-pedido.js';
import { CARPETA, type FormatoDetectado } from './tipos-de-archivo.js';

const FORMATO_CLAVE =
  /^(imagenes|audios|videos)\/\d{4}\/\d{2}\/[a-z0-9-]{8,64}\.(jpg|png|webp|m4a|aac|mp3|mp4)$/;

export function nuevaClave(
  formato: FormatoDetectado,
  anio: string,
  mes: string,
): string {
  return `${CARPETA[formato.tipo]}/${anio}/${mes}/${textoAleatorio(20)}.${formato.extension}`;
}

export function esClaveValida(clave: string): boolean {
  return FORMATO_CLAVE.test(clave);
}

/** URL absoluta de un archivo, con el origen del pedido en curso (o URL_PUBLICA). */
export function urlDeArchivo(clave: string): string {
  const origen = origenDelPedido();
  if (origen === null)
    throw new Error('urlDeArchivo se llamó fuera de un pedido.');
  return `${origen}/archivos/${clave}`;
}
