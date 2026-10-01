import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ErrorDeApi } from '../errores/error-de-api.js';
import { UsuarioEntidad } from '../../modulos/usuarios/usuario.entidad.js';
import { AlmacenTokensPush, EnviadorPush } from './puertos.js';

export interface Aviso {
  titulo: string;
  cuerpo: string;
  datos?: Record<string, string>;
}

const esNoImplementado = (error: unknown): boolean =>
  error instanceof ErrorDeApi && error.codigo === 'NO_IMPLEMENTADO';

/**
 * Lo único que usa el dominio para notificar (AGENTS §19.2). Decide a quién se avisa
 * (sólo a quienes tienen `avisosActivos`) y con qué texto; guardar tokens y mandar a Expo lo
 * hacen los dos puertos. Un error de cualquiera de los dos se loguea y nunca rompe el pedido.
 */
@Injectable()
export class Avisos {
  private readonly registro = new Logger('Push');
  private readonly enCurso = new Set<Promise<void>>();

  constructor(
    @InjectRepository(UsuarioEntidad) private readonly usuarios: Repository<UsuarioEntidad>,
    private readonly almacen: AlmacenTokensPush,
    private readonly enviador: EnviadorPush,
  ) {}

  /** Se llama después de confirmar la transacción y no bloquea la respuesta. */
  avisar(usuarioIds: string[], aviso: Aviso): void {
    const envio = this.despachar(usuarioIds, aviso, false)
      .then(() => undefined)
      .catch((error: unknown) => this.registro.error(`No se pudo notificar: ${String(error)}`))
      .finally(() => this.enCurso.delete(envio));
    this.enCurso.add(envio);
  }

  /** Push de prueba: a diferencia de `avisar`, espera el envío y devuelve a cuántos teléfonos llegó. */
  probar(usuarioId: string): Promise<number> {
    return this.despachar(
      [usuarioId],
      {
        titulo: 'Prueba de notificaciones',
        cuerpo: 'Si ves esto, las notificaciones de la app andan bien.',
        datos: { tipo: 'prueba' },
      },
      true,
    );
  }

  /** Para los tests: espera a que terminen los envíos en segundo plano. */
  async esperarEnvios(): Promise<void> {
    while (this.enCurso.size > 0) await Promise.all(this.enCurso);
  }

  /** Devuelve a cuántos teléfonos se mandó (sin contar los tokens inválidos). */
  private async despachar(
    usuarioIds: string[],
    aviso: Aviso,
    propagarNoImplementado: boolean,
  ): Promise<number> {
    const destinatarios = await this.conAvisosActivos(usuarioIds);
    if (destinatarios.length === 0) return 0;
    try {
      const tokens = [...new Set(await this.almacen.tokensDe(destinatarios))].sort();
      if (tokens.length === 0) return 0;
      const { tokensInvalidos } = await this.enviador.enviar([
        { tokens, titulo: aviso.titulo, cuerpo: aviso.cuerpo, datos: aviso.datos ?? {} },
      ]);
      const invalidos = tokens.filter((t) => tokensInvalidos.includes(t));
      if (invalidos.length > 0) await this.almacen.descartar(invalidos);
      return tokens.length - invalidos.length;
    } catch (error) {
      if (esNoImplementado(error)) {
        if (propagarNoImplementado) throw error;
        this.registro.log(
          `Push pendiente de implementar: ${aviso.titulo} → ${destinatarios.length} usuarios`,
        );
        return 0;
      }
      this.registro.error(`Falló el envío de push: ${String(error)}`);
      return 0;
    }
  }

  private async conAvisosActivos(usuarioIds: string[]): Promise<string[]> {
    if (usuarioIds.length === 0) return [];
    const filas = await this.usuarios.find({
      select: { id: true },
      where: { id: In([...new Set(usuarioIds)]), avisosActivos: true },
    });
    return filas.map((u) => u.id);
  }
}
