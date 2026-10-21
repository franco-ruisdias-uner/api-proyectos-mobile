import { usuarios } from '@/mocks/users'

import type { Usuario } from '@/types/entities'

export type LoginAccount = {
  legajo: string
  password: string
  usuario: Usuario
}

// P-13: Usuario has no password. This list exists only so the mock can accept or reject a sign-in.
// Every account uses the same trial password.
export const loginAccounts: LoginAccount[] = usuarios.map((usuario) => ({
  legajo: usuario.legajo,
  password: 'lectura',
  usuario,
}))
