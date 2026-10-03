import { Module } from '@nestjs/common';
import { UsuariosModulo } from '../usuarios/usuarios.modulo.js';
import { AuthControlador } from './auth.controlador.js';
import { AuthServicio } from './auth.servicio.js';

@Module({
  imports: [UsuariosModulo],
  controllers: [AuthControlador],
  providers: [AuthServicio],
})
export class AuthModulo {}
