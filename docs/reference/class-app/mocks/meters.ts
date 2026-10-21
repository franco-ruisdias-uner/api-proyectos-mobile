import { brasilEntries } from '@/mocks/brasil'
import { neighborhoodEntries } from '@/mocks/neighborhoods'
import { quintasEntries } from '@/mocks/quintas'

import type { Medidor } from '@/types/entities'

export const medidores: Medidor[] = [
  ...brasilEntries.map((entry) => entry.medidor),
  ...quintasEntries.map((entry) => entry.medidor),
  ...neighborhoodEntries.map((entry) => entry.medidor),
]
