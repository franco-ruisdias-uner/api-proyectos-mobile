import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

export interface S3Falso {
  endpoint: string;
  buckets: Map<string, Map<string, { cuerpo: Buffer; tipo: string }>>;
  cerrar: () => Promise<void>;
}

/**
 * Servidor mínimo con el protocolo de S3 (rutas tipo path-style): lo justo para probar el adaptador
 * con el SDK real sin Docker. La suite con S3Proxy de verdad corre en la matriz (AGENTS §17.4).
 */
export async function levantarS3Falso(): Promise<S3Falso> {
  const buckets: S3Falso['buckets'] = new Map();
  const error = (res: import('node:http').ServerResponse, estado: number, codigo: string) => {
    res.writeHead(estado, { 'content-type': 'application/xml' });
    res.end(
      `<?xml version="1.0"?><Error><Code>${codigo}</Code><Message>${codigo}</Message></Error>`,
    );
  };

  const servidor: Server = createServer((req, res) => {
    const partes: Buffer[] = [];
    req.on('data', (p: Buffer) => partes.push(p));
    req.on('end', () => {
      const url = new URL(req.url ?? '/', 'http://x');
      const [, bucket = '', ...resto] = url.pathname.split('/');
      const clave = decodeURIComponent(resto.join('/'));
      const objetos = buckets.get(bucket);

      if (clave === '') {
        if (req.method === 'PUT') {
          buckets.set(bucket, objetos ?? new Map());
          res.writeHead(200).end();
        } else if (!objetos) {
          // HEAD no lleva cuerpo: S3 responde 404 pelado.
          if (req.method === 'HEAD') res.writeHead(404).end();
          else error(res, 404, 'NoSuchBucket');
        } else res.writeHead(200).end();
        return;
      }
      if (!objetos) return error(res, 404, 'NoSuchBucket');

      if (req.method === 'PUT') {
        const tipo = String(req.headers['content-type'] ?? 'application/octet-stream');
        objetos.set(clave, { cuerpo: Buffer.concat(partes), tipo });
        res.writeHead(200, { etag: '"x"' }).end();
      } else if (req.method === 'DELETE') {
        objetos.delete(clave);
        res.writeHead(204).end();
      } else if (req.method === 'GET' || req.method === 'HEAD') {
        const o = objetos.get(clave);
        if (!o) {
          if (req.method === 'HEAD') res.writeHead(404).end();
          else error(res, 404, 'NoSuchKey');
          return;
        }
        const rango = /^bytes=(\d+)-(\d+)$/.exec(String(req.headers.range ?? ''));
        const cabeceras: Record<string, string | number> = {
          'content-type': o.tipo,
          'accept-ranges': 'bytes',
        };
        let cuerpo = o.cuerpo;
        let estado = 200;
        if (rango) {
          const inicio = Number(rango[1]);
          const fin = Math.min(Number(rango[2]), o.cuerpo.length - 1);
          cuerpo = o.cuerpo.subarray(inicio, fin + 1);
          cabeceras['content-range'] = `bytes ${inicio}-${fin}/${o.cuerpo.length}`;
          estado = 206;
        }
        cabeceras['content-length'] = cuerpo.length;
        res.writeHead(estado, cabeceras);
        res.end(req.method === 'HEAD' ? undefined : cuerpo);
      } else res.writeHead(405).end();
    });
  });

  await new Promise<void>((ok) => servidor.listen(0, '127.0.0.1', ok));
  const { port } = servidor.address() as AddressInfo;
  return {
    endpoint: `http://127.0.0.1:${port}`,
    buckets,
    cerrar: () =>
      new Promise<void>((ok) => {
        servidor.closeAllConnections();
        servidor.close(() => ok());
      }),
  };
}
