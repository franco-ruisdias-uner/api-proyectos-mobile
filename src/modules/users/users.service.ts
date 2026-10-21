import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { Usuario } from './user.entity.js';
import type { ActualizarYoDto } from './dto/update-me.dto.js';

@Injectable()
export class ServicioUsuarios {
  constructor(
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
  ) {}

  /** Cambia sólo lo que vino. `telefono: null` lo borra. */
  async actualizar(usuario: Usuario, dto: ActualizarYoDto): Promise<Usuario> {
    const cambios: Partial<
      Pick<Usuario, 'nombre' | 'telefono' | 'avisosActivos'>
    > = {};
    if (dto.nombre !== undefined) cambios.nombre = dto.nombre;
    if (dto.telefono !== undefined) cambios.telefono = dto.telefono;
    if (dto.avisosActivos !== undefined)
      cambios.avisosActivos = dto.avisosActivos;
    if (Object.keys(cambios).length > 0)
      await this.usuarios.update({ id: usuario.id }, cambios);
    return this.usuarios.findOneByOrFail({ id: usuario.id });
  }
}
