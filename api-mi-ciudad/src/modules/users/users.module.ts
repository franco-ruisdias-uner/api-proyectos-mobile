import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsuariosActivos } from '../../common/auth/active-users.js';
import { AuthControlador } from './auth.controller.js';
import { CategoriasModulo } from '../categories/categories.module.js';
import { UsuarioEntidad } from './user.entity.js';
import { UsuariosServicio } from './users.service.js';
import { YoControlador } from './me.controller.js';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([UsuarioEntidad]), CategoriasModulo],
  controllers: [AuthControlador, YoControlador],
  providers: [UsuariosServicio, { provide: UsuariosActivos, useExisting: UsuariosServicio }],
  exports: [UsuariosActivos, UsuariosServicio],
})
export class UsuariosModulo {}
