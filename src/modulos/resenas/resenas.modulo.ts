import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ComerciosModulo } from '../comercios/comercios.modulo.js';
import { UsuariosModulo } from '../usuarios/usuarios.modulo.js';
import { ReporteDeResena } from './reporte-de-resena.entidad.js';
import { Resena } from './resena.entidad.js';
import { ResenasControlador } from './resenas.controlador.js';
import { ResenasServicio } from './resenas.servicio.js';

@Module({
  imports: [TypeOrmModule.forFeature([Resena, ReporteDeResena]), ComerciosModulo, UsuariosModulo],
  controllers: [ResenasControlador],
  providers: [ResenasServicio],
  exports: [TypeOrmModule],
})
export class ResenasModulo {}
