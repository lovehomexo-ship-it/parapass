# Cartographie de l'espace Centre DZ — état des lieux

> Document produit en **lecture seule** (P0). Aucune modification de code,
> aucune migration. Date : 2026-09-02. Base : `parapass-prod`.

---

## 1. Routes réelles et écrans sans URL

L'application déclare **45 routes** dans `src/App.tsx`. L'espace Centre n'en
occupe **qu'une seule** : `/centre/dashboard`.

### Les 16 écrans du Centre ne sont pas adressables

`src/pages/CentreDashboard.tsx` (**3 328 lignes**) pilote toute la navigation
par un état local unique, ligne 2840 :

```ts
const [activeSection, setActiveSection] = useState<string>('dashboard');
```

Écrans montés conditionnellement sur cette variable :

| # | activeSection | # | activeSection |
|---|---|---|---|
| 1 | `dashboard` | 9 | `messages` |
| 2 | `licencies` | 10 | `modules` |
| 3 | `demandes` | 11 | `planning` |
| 4 | `sauts` | 12 | `pliage` |
| 5 | `briefing` | 13 | `tandem` |
| 6 | `equipe` | 14 | `stats` |
| 7 | `academy` | 15 | `finances` |
| 8 | `validations` | 16 | `centre` |

### Onglets internes également volatils

Sous-états perdus au rechargement (lignes 2842-2851) :

| État | Valeurs |
|---|---|
| `messagesTab` | conversations, relances |
| `equipeTab` | encadrement, equipe |
| `academyTab` | quiz, pac, brevets, documents |
| `tab` (fiche licencié) | carte, sauts, messages, actions |
| `tab` (validations) | attente, today, historique |

**Conséquences mesurées** : aucun favori possible, aucun lien partageable, le
bouton retour du navigateur quitte l'application, impossible d'afficher un
écran en mode hangar, impossible d'ouvrir deux écrans dans deux onglets.

**Sections extraites** dans `src/pages/centre/` (14 fichiers) : AcademySection,
BrevetsSection, BriefingRecap, BriefingSection, BriefingSuivi,
EncadrementSection, EquipeUnifiee, FinancesSection, GestionPliage,
ModulesSection, PresencesDZ, RelancesSection, TandemSection, ValidationsCarnet.
Elles sont déjà découpées — **le travail de P1 est du routage, pas du
redécoupage**.

---

## 2. Inventaire Supabase

**85 tables** dans `public`. **RLS active sur les 85** (aucune table exposée).

### Tables centrales de l'espace Centre

| Table | Lignes | Écrite par | Lue par |
|---|---|---|---|
| `licencies_centres` | 66 | CentreDashboard | CentreDashboard, auth, briefing, pac, PasseportCardView |
| `sauts` | 298 | AddSautModal, ImportOCR | partout (via `useJumpCounts`) |
| `dz_presences` | 66 | PresencesDZ | Journée, briefing |
| `dz_briefings` | 12 | BriefingSection | BriefingRecap, BriefingSuivi, TV |
| `briefing_acknowledgements` | 29 | acquittement licencié | BriefingSuivi |
| `licences` | 29 | fiche licencié | conformité |
| `certificats_medicaux` | 29 | fiche licencié | conformité |
| `pliages` | 19 | GestionPliage | GestionPliage, scan QR |
| `materiels` | 11 | Materiel | conformité matériel |
| `incidents` | **0** | — | — (table prête, jamais alimentée) |

---

## 3. Doublons et incohérences de schéma

### 3.1 🔴 CRITIQUE — Deux tables pour la même relation

`licencies_centres` et `centres_licencies` décrivent **la même chose** :
l'affiliation d'un parachutiste à un centre.

| | `licencies_centres` | `centres_licencies` |
|---|---|---|
| Lignes | **66** | **2** |
| Références dans le code | **38** | **3** |
| Colonnes | id, parachutiste_id, centre_id, statut, date_adhesion, moniteur_assigne_id, notes, created_at, **+ 6 colonnes `carnet_*`** | id, parachutiste_id, centre_id, date_adhesion, statut, **numero_adhesion**, created_at |

`centres_licencies` est un **sous-ensemble** de l'autre (seul `numero_adhesion`
lui est propre).

**Le problème n'est pas le doublon, c'est que les deux côtés de
l'application n'utilisent pas la même table :**

| Côté | Fichier | Table |
|---|---|---|
| Parachutiste ajoute son centre | `src/pages/Passeport.tsx:938` (upsert) | `centres_licencies` |
| Parachutiste quitte un centre | `src/pages/Passeport.tsx:951` (delete) | `centres_licencies` |
| DZ liste ses licenciés | `src/pages/CentreDashboard.tsx` (8 requêtes) | `licencies_centres` |

Vérifié : le bloc `Passeport.tsx:900-980` ne référence **jamais**
`licencies_centres` (0 occurrence).

**Conséquence** : un parachutiste qui déclare son centre depuis son passeport
**n'apparaîtra jamais** dans la liste des licenciés de ce centre. Et s'il le
retire, il **reste** visible côté DZ.

*Situation actuelle* : les 2 lignes de `centres_licencies` existent aussi dans
`licencies_centres` — aucune donnée n'est orpheline **aujourd'hui**. Le risque
est structurel et se matérialisera à la prochaine adhésion créée par un
licencié.

**Table faisant autorité : `licencies_centres`.**

### 3.2 Tables mortes (aucune référence dans `src/`)

| Table | Lignes | Commentaire |
|---|---|---|
| `validations_pliage_deprecated` | 0 | déjà renommée, suppression sans risque |
| `centre_invitations` | 0 | jamais branchée |
| `progression_epreuves_historique` | 0 | jamais lue |
| `quiz_seasons` | 0 | jamais lue |
| `tandem_passengers` | 0 | doublon probable de `tandem_bookings` |
| `tandem_waitlist` | 0 | jamais branchée |

`pliages` (19 lignes, activement lue et écrite) est **bien vivante** — à ne pas
confondre avec la table de validation dépréciée.

---

## 4. Chiffres calculés deux fois

### 4.1 ✅ Compteur de sauts — **sain**

`src/lib/useJumpCount.ts` est explicitement la source unique, adossée à la RPC
`get_regulatory_snapshot` (13 références). Elle expose déjà :

- `total` / `valid` (soufflerie exclue)
- **`lastJumpDate`** et `lastValidatedJumpDate`
- `lastJumpIsUnvalidated`

**→ P2 doit consommer `lastJumpDate` de ce hook.** Le point de vigilance que tu
signales est déjà couvert : il ne faut surtout pas recalculer.

### 4.2 🔴 Conformité — **deux chemins contradictoires**

| Chemin | Où | Méthode |
|---|---|---|
| **A — bandeau** | `CentreDashboard.tsx:420` | `(licencesValides + certifOk) / (totalMembers × 2)` |
| **B — liste** | `CentreDashboard.tsx:861` et `:2335` | RPC `get_conformite_licencies` |
| **C — fiche/badge** | `src/lib/compliance.ts` → `getComplianceStatus()` | statut à 4 états : `ok`, `bientot`, `expire`, **`inconnu`** |

`CentreDashboard.tsx` **n'importe pas** `getComplianceStatus`.

**Origine du « 29/29 » incohérent** : le chemin A compte les *documents
existants et valides*. Les tables `licences` et `certificats_medicaux`
contiennent chacune **29 lignes** pour **66 affiliations** — un licencié sans
document n'a pas de ligne, donc n'est **pas** compté comme non conforme dans le
numérateur, alors que le chemin C le classe explicitement `inconnu`.

**Définition à retenir (P11.2)** : *un document non renseigné n'est pas un
document conforme*. C'est déjà la sémantique de `compliance.ts` — il faut
donc **aligner A et B sur C**, pas inventer une quatrième règle.

### 4.3 Présences

`dz_presences` (66 lignes) est la seule source. Pas de doublon détecté.

---

## 5. Risques — ajout d'une table de rotations reliée aux sauts

Analyse préalable à **P3**.

### 5.1 Ce qui casserait

| # | Risque | Détail |
|---|---|---|
| 1 | **Double comptage des sauts** | La création automatique de sauts à la clôture d'une rotation passe par `sauts`, lue par `get_regulatory_snapshot`. Un saut créé par rotation **et** saisi à la main = compteur faux, et le compteur alimente les seuils de brevet. **Il faut une clé d'idempotence** (`place_rotation_id` unique sur `sauts`). |
| 2 | **Statut de validation** | `sauts.statut` gouverne `valid` dans `useJumpCounts`. Créer des sauts déjà `valide` sans passage moniteur contourne le circuit de validation existant (`delegations_validation`, 9 policies). À cadrer explicitement. |
| 3 | **RLS** | `sauts` porte **14 policies**. Une insertion par un service de clôture de rotation doit satisfaire ces policies ou passer par une fonction `security definer` — sinon l'insertion échouera silencieusement côté client. |
| 4 | **Ambiguïté d'affiliation** | Une place de rotation référencera un licencié. Via quelle table — `licencies_centres` ou `centres_licencies` ? **Le doublon 3.1 doit être résolu AVANT P3**, sinon il se propage dans le manifest. |
| 5 | **Tandems** | Un passager tandem n'a pas de `profiles.id`. `places_rotation` doit accepter soit un licencié, soit un passager (`tandem_bookings`), avec une contrainte d'exclusion mutuelle. `tandem_passengers` existe mais est **vide et non utilisée** — décider de son sort avant, pas pendant. |
| 6 | **Fuseau horaire** | `sauts.date_saut` est une `date`. Une rotation porte des heures. Le passage heure → date doit utiliser `ymdLocal` (`src/lib/datetime.ts`), déjà en place, sinon décalage d'un jour en soirée. |

### 5.2 Ce qui ne casserait pas

- Les 14 sections du Centre sont déjà des composants isolés → ajouter un écran
  Rotations n'impacte aucun écran existant.
- `aeronefs` et `rotations` sont des noms libres (aucune collision sur 85 tables).
- La RLS par centre est un motif déjà éprouvé et reproductible tel quel.

### 5.3 Ordre recommandé

**Résoudre 3.1 (fusion des tables jumelles) avant P3.** C'est une correction
courte qui évite de bâtir le manifest sur une fondation ambiguë.

---

## Annexe — méthode

- Routes : `grep -oE '<Route path="[^"]*"' src/App.tsx`
- Écrans internes : `grep -oE "activeSection === '[a-z_-]+'"`
- RLS : `pg_class.relrowsecurity` + `pg_policy` sur les 85 tables
- Tables mortes : croisement `information_schema` × `grep -rF "'<table>'" src/`
- Doublons de calcul : lecture des chemins A/B/C dans `CentreDashboard.tsx`
  et `src/lib/compliance.ts`
