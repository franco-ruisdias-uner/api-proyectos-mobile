import { Module } from '@nestjs/common';
import { ComerciosModulo } from '../comercios/comercios.modulo.js';
import { PromocionesModulo } from '../promociones/promociones.modulo.js';
import { UsuariosModulo } from '../usuarios/usuarios.modulo.js';
import { PanelComercioControlador } from './panel-comercio.controlador.js';
import { PanelComercioServicio } from './panel-comercio.servicio.js';

@Module({
  imports: [ComerciosModulo, PromocionesModulo, UsuariosModulo],
  controllers: [PanelComercioControlador],
  providers: [PanelComercioServicio],
})
export class PanelComercioModulo {}
