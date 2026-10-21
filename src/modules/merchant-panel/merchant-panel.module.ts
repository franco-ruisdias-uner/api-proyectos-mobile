import { Module } from '@nestjs/common';
import { ComerciosModulo } from '../businesses/businesses.module.js';
import { PromocionesModulo } from '../promotions/promotions.module.js';
import { UsuariosModulo } from '../users/users.module.js';
import { PanelComercioControlador } from './merchant-panel.controller.js';
import { PanelComercioServicio } from './merchant-panel.service.js';

@Module({
  imports: [ComerciosModulo, PromocionesModulo, UsuariosModulo],
  controllers: [PanelComercioControlador],
  providers: [PanelComercioServicio],
})
export class PanelComercioModulo {}
