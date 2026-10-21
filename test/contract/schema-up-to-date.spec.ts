import { readFileSync } from 'node:fs';
import { createGenerator } from 'ts-json-schema-generator';

describe('AGENTS §10.3 — contract/schema.json está al día con los tipos', () => {
  it('regenerarlo da exactamente lo que está commiteado (si falla: pnpm contrato:esquema)', () => {
    const generado = createGenerator({
      path: 'contract/*.ts',
      type: '*',
      skipTypeCheck: true,
    }).createSchema('*');
    const guardado = JSON.parse(readFileSync('contract/schema.json', 'utf8')) as unknown;
    expect(guardado).toEqual(JSON.parse(JSON.stringify(generado)));
  });
});
