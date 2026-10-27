import { describe, it, expect } from 'vitest';
import { lireTout } from './lireTout';

describe('lireTout', () => {
  const table = Array.from({ length: 2345 }, (_, i) => i);
  const lire = (debut: number, fin: number) =>
    Promise.resolve({ data: table.slice(debut, fin + 1), error: null });

  it('relit page après page au-delà de la coupe de 1 000 lignes', async () => {
    const { data } = await lireTout(lire);
    expect(data.length).toBe(2345);
    expect(data[data.length - 1]).toBe(2344);
  });

  it('s’arrête sur une page pleine suivie d’une page vide', async () => {
    const exact = Array.from({ length: 2000 }, (_, i) => i);
    const { data } = await lireTout((d, f) => Promise.resolve({ data: exact.slice(d, f + 1), error: null }));
    expect(data.length).toBe(2000);
  });

  it('rend l’erreur sans boucler', async () => {
    const { error } = await lireTout(() => Promise.resolve({ data: null, error: { message: 'boom' } }));
    expect(error?.message).toBe('boom');
  });
});
