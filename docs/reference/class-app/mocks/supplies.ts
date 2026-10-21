import { brasilEntries } from '@/mocks/brasil'
import { neighborhoodEntries } from '@/mocks/neighborhoods'
import { quintasEntries } from '@/mocks/quintas'

import type { Suministro } from '@/types/entities'

export const suministros: Suministro[] = [
  ...brasilEntries.map((entry) => entry.suministro),
  ...quintasEntries.map((entry) => entry.suministro),
  ...neighborhoodEntries.map((entry) => entry.suministro),
]
