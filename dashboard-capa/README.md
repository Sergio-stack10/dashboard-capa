# Dashboard capacitaire – Roadmap Auchan

Application 100 % statique (HTML/CSS/JS vanilla + Chart.js + SheetJS via CDN), sans build.
Déploiement : Cloudflare Workers (déploiement manuel ou Git integration).

## Contenu du dépôt

| Fichier | Rôle |
|---|---|
| `index.html` | Interface : 6 onglets + barre de filtres globale + dialog d'import (10 sources) |
| `js/app.js` | Logique applicative (données, imports, graphiques, filtres globaux) |
| `data/roadmap.json` | **Onglet Roadmap** : modèle RM complet (1 fichier par onglet) — 21 sections × 12 activités × 113 semaines |
| `data/prevision.json` | **Onglet Prévision** : prévus mensuels Webhelp (12 mois × 6 flux) + poids journaliers (365 j) + créneaux 30 min (12 mois × flux × profils Lundi-samedi / Dimanche) |
| `data/planning.json` | **Onglet Planification** : feuille Planning du classeur `Planning AUCHAN.xlsx` (10 jours, 80 agents) — personnes planifiées par jour et par créneau 30 min, hors FIM et hors pause repas |
| `data/data.json` | Autres onglets : capacitaire + réalisé (DRM oct. 2026) + DMT (Vonage, 1–25 oct.) + Mail (Export Mail, 1–25 oct.) |
| `favicon.svg` | Icône de l'outil (onglet navigateur) |
| `_headers` | Cloudflare : pas de cache (mises à jour toujours visibles) |
| `scripts/build_roadmap.py` | Régénère `data/roadmap.json` depuis le modèle RM (`.xlsm`, onglet AUCHAN + feuille Congés) |
| `scripts/build_prevision.py` | Régénère `data/prevision.json` depuis le classeur Webhelp (onglets `2026` + `Poids`) |
| `scripts/build_data.py` | Injecte un DRM dans `data/data.json` |
| `scripts/build_dmt.py` | Injecte un Export Vonage Call (DMT) dans `data/data.json` |
| `scripts/build_mail.py` | Injecte un Export Mail (canal mail) dans `data/data.json` |
| `scripts/validate_roadmap.py` | Contrôle `roadmap.json` contre les valeurs du Dashboard RM |

## Les 6 onglets — avec la même barre de filtres partout

**Filtres globaux (au-dessus de chaque onglet)** : Granularité (Jour / Semaine / Mois) ·
**Flux** (multi : Front office / Back office / Autres) · **Channel** (multi : PHONE / MAIL / CHAT) ·
**Activités** (multi : Hyper, C2E, AFR, Drive, SAV, Direct, Chat, Borne/LSA) · **Période**
(préréglages : Tout · mois récent · mois précédent · 7 j · 30 j · personnalisé) ·
**Intervalle de période** (du / au). Chaque groupe de filtres a ses boutons **Tout / Aucun**
(sélectionner ou désélectionner tout) et un code couleur propre (Flux bleu · Channel vert ·
Activités violet). Structure : Front office = PHONE (Hyper, C2E, AFR, Drive, SAV, Direct) ·
Back office = MAIL (Hyper, AFR, Drive) · Autres = CHAT. La sélection Flux restreint les Channels
possibles, qui restreignent les Activités possibles (cascade) ; tout est sélectionné par défaut
et une sélection vide affiche « aucune donnée ». Les filtres sont mémorisés d'un onglet
à l'autre et d'une session à l'autre ; ils sont grisés quand ils ne s'appliquent pas
(Roadmap = hebdo, Prévision = mensuel, Planification = agents).

1. **Roadmap** — *besoin & capacité à partir du modèle RM (S46+)*, semaine analysée + fenêtre
   13/27 semaines ou tout, périmètre piloté par les filtres globaux (somme ou moyenne pondérée
   des activités retenues) :
   - **KPIs semaine analysée** : SLA/QE (Δ vs S-1, cible), prévision finale, capacité actes
     (couverture), heures de log (besoin + capa prod), écart ETP, effectif productif,
     absentéisme, taux d'occupation ;
   - **9 blocs** : ① heures (capa vs besoin, bascule log ⇄ prod) · ② actes (capa vs
     prévision finale + initiale) · ③ ETP (besoin vs effectif productif + écart) ·
     ④ effectif (ETP répartis + effectif saisi) · ⑤ SLA/QE vs cible avec seuils 95 %/90 % ·
     ⑥ DMT (s, pondéré + activités masquées) · ⑦ taux d'occupation · ⑧ absentéisme ·
     ⑨ congés (ETP feuille Congés, sinon taux) ;
   - **détail hebdomadaire** : 20 colonnes (prévu final/init., capa actes, heures log/prod,
     besoin ETP, effectif, écarts, QE, cible, DMT, occupation, absentéisme, congés) ;
   - les lignes « --- » du fichier sont reconnues comme **C2E** et **Direct (LAD)** ;
     **QE = capacité actes ÷ prévision finale** (identique au Dashboard du fichier RM) ;
   - import : carte « Roadmap — modèle RM (S46+) » (`Copie de RM_*.xlsm`) —
     les données RM sont lues directement dans le navigateur (SheetJS).
2. **Prévision** — *prévus Webhelp par jour et par créneau 30 min* (classeur Webhelp,
   onglets `2026` + `Poids`) :
   - **KPIs du mois** : prévu du périmètre, moyenne / jour, jour le plus chargé,
     pointe 30 min du jour choisi, répartition appels / mails ;
   - **vue par jour** : volume = prévu du mois × poids journalier (col. B-F appels,
     J-L mails de l'onglet `Poids`) — graphe empilé + tableau jour × flux (30 j) ;
   - **vue par créneau 30 min** : volume = volume du jour × poids du créneau
     (col. R, format 730 = 07:30) — profil « Lundi au samedi » ou « Dimanche (matin) »
     selon le jour choisi (ou forcé), graphe + tableau créneau × flux avec % du jour ;
   - **synthèse mensuelle** : 12 mois × 6 flux (appels Hyper, C2E, AFR, Drive, SAV, Direct ;
     mails Hyper/C2E, AFR, Drive) ;
   - sélecteurs : mois (janv. 2026 → déc. 2026) + flux (Total, Appels, Mails, ou un flux) ;
   - import : carte « Prévision Webhelp — jour & 30 min » (`04_Webhelp_*.xlsx`).
3. **Capacitaire** — capacitaire journalière (546 jours) **en actes et en heures** :
   bascule **Unité : Actes ⇄ Heures** ; heures du fichier CAPA ou conversion
   `actes ÷ hypothèse de productivité` ; **Prévu = prévision Webhelp × poids journaliers**
   (répartition journalière pondérée par la prev ; repli sur le prévu du fichier capacitaire) ;
   contractuel + couverture ; bloc **« Hypothèses de productivité »** (actes/heure par activité,
   éditable, mémorisé).
4. **Planification** — personnes planifiées par jour et par créneau 30 min (feuille Planning) :
   - **règles** : lignes Statut = Planifié uniquement ; **FIM** (Compétences = FIM ou
     Total FIM = HP) = personnes hors prod, comptées à part ; **pause repas** exclue des
     créneaux (fenêtre exacte Début/Fin Pause Repas) ; HP du fichier = shift − pause repas ;
     **Heures de log = HP − Total FIM** ;
   - **KPIs** : agents planifiés, personnes planifiées / jour (dont FIM), HP, Heures de log,
     pointe (moyenne période ou jour précis) ;
   - **graphiques** : personnes par jour (prod + FIM + Heures de log), personnes par créneau
     30 min (moyenne période ou jour précis au choix), heures par jour (log / FIM + HP) ;
   - **tableaux** : détail par jour (planifiés, dont FIM, HP, pause repas, Heures de log, FIM)
     et **matrice créneau × jour** (personnes planifiées en prod, moyenne / jour) ;
   - import : carte « Planification — agents & créneaux » (feuille `Planning`) ;
     les données 01/11 → 10/11/2026 du fichier reçu sont préchargées dans `data/planning.json`.
5. **Analyse capa** — capacitaire (heures + actes) **vs réel** :
   - **réel en heures** = heures de log planifiées (feuille Planning, hors FIM)
     **× (1 − absentéisme du modèle RM)** ;
   - **réel en actes** = heures réelles **× productivité du modèle RM** (repli : hypothèses
     saisies dans l'onglet Capacitaire) ; répartition par activité affinée si le
     « Planning heures » (date · activité · heures) est importé ;
   - graphiques : capa en actes prévu vs réel vs réalisé (DRM), capa en heures prévu vs réel
     (+ planifié brut) ; tableau par période avec écarts ;
   - nécessite la Planification ; absentéisme & productivité lus par semaine du modèle RM.
6. **Productivité** — **une section par canal retenu dans les filtres globaux** (Phone et/ou Mail,
   Chat tant que non raccordé) : par activité
   `QS · QP · QS < 60 s · QE (si QP > 115 % : × 92 %) · T/P · DMT · productivité · TO`
   + nombres (traités, reçus, prévision, heures) ; tableau jour × activité (15 colonnes) ;
   prévision Phone = Webhelp × poids journaliers (repli Roadmap hebdo ÷ 7), prévision Mail = import dédié.

> Les onglets **DMT** et **Mail** ont été retirés : les imports correspondants restent disponibles
> et alimentent l'onglet Productivité (Phone = DRM + Export Vonage Call, Mail = Export Mail +
> Prévision Mail).

## Données & imports (bouton Importer)

- **Roadmap — modèle RM (S46+)** : `.xlsm`, onglet `AUCHAN` (sections Besoin / Capa / Effectif /
  SLA·QE / DMT / Occupation / Absentéisme / Congés) + feuille `Congés` → `data/roadmap.json`.
- **Prévision Webhelp — jour & 30 min** : `.xlsx`, onglet `2026` (prévus mensuels par flux)
  + onglet `Poids` (poids journaliers, poids par jour de semaine et créneaux 30 min,
  col. R — format 730 = 07:30 ; profils Lundi-samedi / Dimanche par flux) → `data/prevision.json`.
  Les poids sont normalisés (Σ = 1 par mois × flux) : la somme des jours = prévu du mois
  et la somme des créneaux = volume du jour, à l'identique du fichier.
- **ETP prévus** : colonnes `semaine · activité · etp` (complément).
- **Capacitaire** : onglet `DAILY VISION`, dates ligne 15.
- **Planning (heures)** : colonnes `date · activité · heures` (modèle téléchargeable).
- **Planification — agents & créneaux** : `.xlsx`, feuille `Planning` (Statut, Nice IEX,
  Shift In/Out, Début/Fin Pause Repas, HP, Allaitement, Total FIM, Compétences) →
  `data/planning.json` ; même jour/agent = remplacé.
- **Réalisé — DRM** : `Traités · Reçus · Traités 60s` × flux (HYPER, C2E, AFR, DRIVE, SAV),
  les mois s'additionnent.
- **DMT — Export Vonage Call** / **Mail — Export Mail** / **Prévision Mail** : comme décrit
  dans le dialog d'import.

Les imports restent dans le navigateur (localStorage). **Exporter** produit le `data.json`
(avec la roadmap et la prévision importées) à déposer dans `data/`.

## Mise à jour hebdomadaire du modèle RM

Option A (interface, recommandée) : Importer → **Roadmap — modèle RM** → le fichier
`Copie de RM_Sxx.xlsm` est analysé dans le navigateur → Exporter si publication pour tous.

Option B (script) :
```bash
python scripts/build_roadmap.py "chemin/Copie de RM_Auchan_S46.xlsm" data/roadmap.json
python scripts/validate_roadmap.py          # contrôle vs Dashboard RM
git add data/roadmap.json && git commit -m "RM S46" && git push
```

## Mise à jour de la prévision Webhelp

Option A (interface) : Importer → **Prévision Webhelp — jour & 30 min** → le classeur
`04_Webhelp_*.xlsx` est analysé dans le navigateur (onglets `2026` + `Poids`).

Option B (script) :
```bash
python scripts/build_prevision.py "chemin/04_Webhelp_2026.xlsx" data/prevision.json
git add data/prevision.json && git commit -m "Prévision Webhelp" && git push
```

## Mise à jour mensuelle du réalisé / DMT / Mail

```bash
python scripts/build_data.py "chemin/112026 - DRM.xlsx" data/data.json
python scripts/build_dmt.py "chemin/Export Vonage Call.xlsx" data/data.json
python scripts/build_mail.py "chemin/Export Mail.xlsx" data/data.json
git add data/data.json && git commit -m "maj réalisé" && git push
```

## Déploiement Cloudflare Workers

1. GitHub → dépôt `Sergio-stack10/dashboard-capa` (fichiers à la racine).
2. Déploiement **manuel** : Workers & Pages → dashboard-capa → Deployments →
   **New deployment → Upload assets** → glisser le dossier (ou Git integration si connectée :
   chaque `git push` redéploie). `_headers` impose `no-cache`.
3. URL : `https://dashboard-capa.auchan.workers.dev/`
