import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsuariosActivos } from '../../comun/auth/usuarios-activos.js';
import { AuthControlador } from './auth.controlador.js';
import { CategoriasExistentes, SinCategorias } from './categorias-existentes.js';
import { UsuarioEntidad } from './usuario.entidad.js';
import { UsuariosServicio } from './usuarios.servicio.js';
import { YoControlador } from './yo.controlador.js';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([UsuarioEntidad])],
  controllers: [AuthControlador, YoControlador],
  providers: [
    UsuariosServicio,
    { provide: UsuariosActivos, useExisting: UsuariosServicio },
    { provide: CategoriasExistentes, useClass: SinCategorias },
  ],
  exports: [UsuariosActivos, UsuariosServicio],
})
export class UsuariosModulo {}
