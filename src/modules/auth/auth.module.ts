import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Usuario } from '../users/user.entity.js';
import { ControladorAuth } from './auth.controller.js';
import { ServicioAuth } from './auth.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Usuario])],
  controllers: [ControladorAuth],
  providers: [ServicioAuth],
})
export class AuthModulo {}
