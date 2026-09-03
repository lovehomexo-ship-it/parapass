import { describe, it, expect } from 'vitest';
import { evaluerAptitude, RANG_STATUT, type MotifAptitude } from './aptitude';

const m = (severite: MotifAptitude['severite'], levee = false, code: string = severite): MotifAptitude =>
  ({ code, severite, levee });

describe('P5 — evaluerAptitude', () => {
  it('aucun motif : vert', () => {
    expect(evaluerAptitude([])).toEqual({ statut: 'vert', blocages: 0, vigilances: 0 });
  });

  it('un blocage l’emporte sur toutes les vigilances', () => {
    const a = evaluerAptitude([m('vigilance'), m('vigilance', false, 'v2'), m('blocage')]);
    expect(a.statut).toBe('rouge');
    expect(a.blocages).toBe(1);
    expect(a.vigilances).toBe(2);
  });

  it('une vigilance seule donne orange', () => {
    expect(evaluerAptitude([m('vigilance')]).statut).toBe('orange');
  });

  it('un motif LEVÉ reste affiché mais ne pèse plus', () => {
    // La dérogation du DT est tracée, pas effacée : le motif existe toujours
    // dans la liste, il cesse simplement de colorer la ligne.
    const a = evaluerAptitude([m('blocage', true)]);
    expect(a.statut).toBe('vert');
    expect(a.blocages).toBe(0);
  });

  it('lever UN blocage sur deux ne suffit pas', () => {
    const a = evaluerAptitude([m('blocage', true, 'b1'), m('blocage', false, 'b2')]);
    expect(a.statut).toBe('rouge');
    expect(a.blocages).toBe(1);
  });

  it('« info » ne colore jamais rien', () => {
    // Sinon le DT apprend à ignorer la couleur, et elle ne sert plus à rien.
    expect(evaluerAptitude([m('info'), m('info', false, 'i2')]).statut).toBe('vert');
  });

  it('le briefing non acquitté est une vigilance, pas un blocage', () => {
    // Décision assumée : le briefing s'acquitte le matin. Bloquant, il
    // mettrait tout le monde en rouge chaque jour jusqu'à 9 h.
    const a = evaluerAptitude([{ code: 'briefing_jour', severite: 'vigilance', levee: false }]);
    expect(a.statut).toBe('orange');
  });

  it('le tri met devant ce qui coince', () => {
    const ordre = (['vert', 'rouge', 'orange'] as const)
      .slice().sort((a, b) => RANG_STATUT[a] - RANG_STATUT[b]);
    expect(ordre).toEqual(['rouge', 'orange', 'vert']);
  });
});
