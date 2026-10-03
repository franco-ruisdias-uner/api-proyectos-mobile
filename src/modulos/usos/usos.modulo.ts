import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ComerciosModulo } from '../comercios/comercios.modulo.js';
import { PromocionesModulo } from '../promociones/promociones.modulo.js';
import { UsuariosModulo } from '../usuarios/usuarios.modulo.js';
import { UsoDePromocion } from './uso-de-promocion.entidad.js';
import { UsosControlador } from './usos.controlador.js';
import { UsosServicio } from './usos.servicio.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([UsoDePromocion]),
    ComerciosModulo,
    PromocionesModulo,
    UsuariosModulo,
  ],
  controllers: [UsosControlador],
  providers: [UsosServicio],
  exports: [TypeOrmModule],
})
export class UsosModulo {}
