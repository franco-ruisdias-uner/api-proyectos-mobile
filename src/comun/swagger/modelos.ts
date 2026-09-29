// Modelos sólo para Swagger: describen los tipos de contrato/ con los ejemplos del PRD.
// La forma real la garantizan los mapeadores (tipados contra contrato/) y los tests de contrato.
import { ApiProperty } from '@nestjs/swagger';

export class UsuarioDoc {
  @ApiProperty({ example: 'usr-084' }) id: string;
  @ApiProperty({ example: 'Norma Pereyra' }) nombre: string;
  @ApiProperty({ example: 'norma@mail.com' }) email: string;
  @ApiProperty({ type: String, nullable: true, example: '3446 412233' })
  telefono: string | null;
  @ApiProperty({ enum: ['vecino', 'operador'], example: 'vecino' }) rol: string;
  @ApiProperty({
    type: String,
    nullable: true,
    example: null,
    description: 'Sólo operadores: la zona en la que trabajan.',
  })
  zonaId: string | null;
  @ApiProperty({ example: true }) avisosActivos: boolean;
  @ApiProperty({ example: '2026-03-02T09:15:00-03:00' }) creadoEn: string;
}

export class SesionDoc {
  @ApiProperty({
    description:
      'Mandalo en cada pedido: Authorization: Bearer <token>. Dura 30 días.',
  })
  token: string;
  @ApiProperty({ type: UsuarioDoc }) usuario: UsuarioDoc;
}

export class ArchivoSubidoDoc {
  @ApiProperty({
    example:
      'http://192.168.0.10:3000/archivos/imagenes/2026/09/k3x9a8b7c6d5e4f3g2h1i0jz.jpg',
  })
  url: string;
  @ApiProperty({ enum: ['imagen', 'audio', 'video'] }) tipo: string;
  @ApiProperty({ example: 348211 }) bytes: number;
}

export class SaludDoc {
  @ApiProperty({ enum: ['ok'] }) estado: string;
  @ApiProperty({ enum: ['better-sqlite3', 'postgres', 'mysql', 'mariadb'] })
  motor: string;
  @ApiProperty({
    enum: ['local', 'aws', 'supabase', 'r2', 'b2', 's3proxy', 'localstack'],
  })
  almacen: string;
  @ApiProperty({ example: '0.1.0' }) version: string;
}

export class DispositivoDoc {
  @ApiProperty({ example: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]' })
  tokenExpo: string;
  @ApiProperty({ enum: ['ios', 'android'] }) plataforma: string;
}

export class PruebaDePushDoc {
  @ApiProperty({ example: 1, description: 'A cuántos dispositivos se mandó.' })
  enviadas: number;
}
