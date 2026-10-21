// Foto de demo de un medidor: un JPEG mínimo de 1×1 píxel, generado acá y sin derechos de terceros.
// Alcanza para probar la subida, la descarga y las URLs; la cátedra puede reemplazarla por una real.
const JPEG_MINIMO_BASE64 =
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

export function fotoDeMedidorDeDemo(): Buffer {
  return Buffer.from(JPEG_MINIMO_BASE64, 'base64');
}
