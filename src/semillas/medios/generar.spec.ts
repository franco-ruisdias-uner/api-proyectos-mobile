import { detectarTipoArchivo } from '../../comun/archivos/tipos-archivo.js';
import { audioDeMuestra, fotoDeMuestra } from './generar.js';

describe('Semillas — los medios generados son archivos que la API acepta', () => {
  it('la foto se reconoce como imagen PNG y pesa poco', () => {
    const foto = fotoDeMuestra([200, 80, 40]);
    expect(detectarTipoArchivo(foto, 'image/png', 'a.png')?.extension).toBe(
      'png',
    );
    expect(foto.length).toBeLessThan(20_000);
  });

  it('el audio se reconoce como audio mp3', () => {
    const audio = audioDeMuestra();
    expect(detectarTipoArchivo(audio, 'audio/mpeg', 'a.mp3')).toMatchObject({
      tipo: 'audio',
      extension: 'mp3',
    });
  });
});
