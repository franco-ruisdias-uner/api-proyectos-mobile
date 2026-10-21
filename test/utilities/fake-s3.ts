// Servidor S3 mínimo en memoria (HEAD/PUT/GET/DELETE de objetos, HEAD/PUT de bucket y
// Range), para probar el adaptador S3 sin Docker. La matriz lo repite contra S3Proxy real.
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

export interface S3Falso {
  endpoint: string;
  cerrar: () => Promise<void>;
  /** Cuántas veces se pidió cada método (para verificar el comportamiento). */
  pedidos: string[];
}

export async function levantarS3Falso(bucket = 'archivos'): Promise<S3Falso> {
  const objetos = new Map<string, { cuerpo: Buffer; tipo: string }>();
  const pedidos: string[] = [];
  let bucketCreado = false;

  const servidor: Server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    const partes = url.pathname
      .split('/')
      .filter(Boolean)
      .map(decodeURIComponent);
    const [b, ...resto] = partes;
    const clave = resto.join('/');
    pedidos.push(`${req.method} ${url.pathname}`);
    const xml = (estado: number, codigo: string) => {
      res.writeHead(estado, { 'content-type': 'application/xml' });
      res.end(
        req.method === 'HEAD'
          ? undefined
          : `<?xml version="1.0"?><Error><Code>${codigo}</Code><Message>${codigo}</Message></Error>`,
      );
    };
    const trozos: Buffer[] = [];
    req.on('data', (t: Buffer) => trozos.push(t));
    req.on('end', () => {
      if (b !== bucket) return xml(404, 'NoSuchBucket');
      if (clave === '') {
        if (req.method === 'PUT') bucketCreado = true;
        void bucketCreado;
        res.writeHead(200).end();
        return;
      }
      if (req.method === 'PUT') {
        objetos.set(clave, {
          cuerpo: Buffer.concat(trozos),
          tipo: String(
            req.headers['content-type'] ?? 'application/octet-stream',
          ),
        });
        res.writeHead(200, { etag: '"x"' }).end();
        return;
      }
      if (req.method === 'DELETE') {
        objetos.delete(clave);
        res.writeHead(204).end();
        return;
      }
      const o = objetos.get(clave);
      if (!o) return xml(404, 'NoSuchKey');
      const cabeceras: Record<string, string | number> = {
        'content-type': o.tipo,
        'accept-ranges': 'bytes',
        etag: '"x"',
      };
      const rango = /^bytes=(\d+)-(\d+)$/.exec(String(req.headers.range ?? ''));
      if (req.method === 'GET' && rango) {
        const [inicio, fin] = [
          Number(rango[1]),
          Math.min(Number(rango[2]), o.cuerpo.length - 1),
        ];
        const parte = o.cuerpo.subarray(inicio, fin + 1);
        res.writeHead(206, {
          ...cabeceras,
          'content-length': parte.length,
          'content-range': `bytes ${inicio}-${fin}/${o.cuerpo.length}`,
        });
        res.end(parte);
        return;
      }
      res.writeHead(200, { ...cabeceras, 'content-length': o.cuerpo.length });
      res.end(req.method === 'HEAD' ? undefined : o.cuerpo);
    });
  });
  await new Promise<void>((r) => servidor.listen(0, '127.0.0.1', r));
  const { port } = servidor.address() as AddressInfo;
  return {
    endpoint: `http://127.0.0.1:${port}`,
    pedidos,
    cerrar: () => new Promise((r) => servidor.close(() => r())),
  };
}
