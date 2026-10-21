import { Module } from '@nestjs/common';
import { UsuariosModulo } from '../users/users.module.js';
import { AuthControlador } from './auth.controller.js';
import { AuthServicio } from './auth.service.js';

@Module({
  imports: [UsuariosModulo],
  controllers: [AuthControlador],
  providers: [AuthServicio],
})
export class AuthModulo {}
