import { useState, useCallback, useRef } from 'react';
import { ModaleSaisie } from './ModaleSaisie';

// ═══════════════════════════════════════════════════════════════════════════
// Équivalents de window.prompt() et window.confirm(), utilisables tels quels.
//
// Les fenêtres natives sont BLOQUÉES en PWA installée et sur nombre de
// navigateurs mobiles : elles renvoient null sans rien afficher, et le bouton
// paraît mort. Ce crochet garde la même ergonomie d'appel — `await
// demanderTexte(...)` remplace `window.prompt(...)` — pour convertir un site
// d'appel sans réécrire la logique autour.
//
//   const { demanderTexte, demanderConfirmation, dialogue } = useDialogues();
//   const nom = await demanderTexte('Nom du circuit', 'ex : main gauche');
//   if (!nom) return;
//   ... et rendre {dialogue} dans le composant.
// ═══════════════════════════════════════════════════════════════════════════

interface EtatDialogue {
  titre: string;
  description?: string;
  label: string;
  placeholder?: string;
  valeurInitiale: string;
  confirmation: boolean;
}

export function useDialogues() {
  const [etat, setEtat] = useState<EtatDialogue | null>(null);
  const resoudre = useRef<((v: string | null) => void) | null>(null);

  const ouvrir = useCallback((e: EtatDialogue) => new Promise<string | null>((res) => {
    resoudre.current = res;
    setEtat(e);
  }), []);

  const fermer = useCallback((valeur: string | null) => {
    setEtat(null);
    resoudre.current?.(valeur);
    resoudre.current = null;
  }, []);

  /** Remplace window.prompt : renvoie la saisie, ou null si annulé. */
  const demanderTexte = useCallback(
    (titre: string, placeholder = '', valeurInitiale = '') =>
      ouvrir({ titre, label: titre, placeholder, valeurInitiale, confirmation: false }),
    [ouvrir]);

  /** Remplace window.confirm : renvoie true si confirmé. */
  const demanderConfirmation = useCallback(
    async (titre: string, description: string) => {
      const r = await ouvrir({
        titre, description, label: '', valeurInitiale: 'ok', confirmation: true,
      });
      return r !== null;
    },
    [ouvrir]);

  const dialogue = etat ? (
    etat.confirmation ? (
      <ModaleSaisie
        titre={etat.titre}
        description={etat.description}
        label=""
        valeurInitiale="ok"
        multiligne={false}
        libelleValider="Confirmer"
        onFermer={() => fermer(null)}
        onValider={() => fermer('ok')}
      />
    ) : (
      <ModaleSaisie
        titre={etat.titre}
        label={etat.label}
        placeholder={etat.placeholder}
        valeurInitiale={etat.valeurInitiale}
        multiligne={false}
        obligatoire
        onFermer={() => fermer(null)}
        onValider={(v) => fermer(v)}
      />
    )
  ) : null;

  return { demanderTexte, demanderConfirmation, dialogue };
}
