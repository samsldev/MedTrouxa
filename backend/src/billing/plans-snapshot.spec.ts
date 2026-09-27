import { readFileSync } from 'fs';
import { join } from 'path';
import { PLANS } from './plans';

/**
 * O site embute uma cópia do catálogo (frontend/src/plans.snapshot.json) para mostrar os planos mesmo com a API fora.
 * Se mudar preço/nome/recursos aqui, regenere a cópia: GET /api/billing/plans > frontend/src/plans.snapshot.json
 */
describe('cópia dos planos no site', () => {
  it('é idêntica ao catálogo do servidor', () => {
    const snapshot = JSON.parse(readFileSync(join(__dirname, '../../../frontend/src/plans.snapshot.json'), 'utf8'));
    expect(snapshot).toEqual(JSON.parse(JSON.stringify(PLANS)));
  });
});
