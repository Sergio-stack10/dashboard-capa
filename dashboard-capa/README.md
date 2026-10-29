# Dashboard capacitaire – Roadmap Auchan

Application 100 % statique (HTML/CSS/JS vanilla + Chart.js + SheetJS via CDN), sans build.
Déploiement : Cloudflare Pages (ou Workers).

## Contenu du dépôt

| Fichier | Rôle |
|---|---|
| `index.html` | Interface : 6 onglets + dialog d'import (8 sources) |
| `js/app.js` | Logique applicative (données, imports, graphiques, filtres de période) |
| `data/data.json` | Données intégrées : roadmap (prévisions + ETP) + capacitaire + réalisé (DRM oct. 2026) + DMT (Vonage, 1–25 oct.) + Mail (Export Mail, 1–25 oct.) |
| `favicon.svg` | Icône de l'outil (onglet navigateur) |
| `_headers` | Cloudflare Pages/Workers : pas de cache (mises à jour toujours visibles) |
| `scripts/build_data.py` | Régénère `data/data.json` : fusionne un DRM dans les données existantes |
| `scripts/build_dmt.py` | Injecte un Export Vonage Call (DMT) dans `data/data.json` |
| `scripts/build_mail.py` | Injecte un Export Mail (canal mail) dans `data/data.json` |

## Les 6 onglets

1. **Roadmap** — prévisions de contacts par **activité** (10 activités × 52 sem.) :
   - contacts prévisionnels par période (prévu vs capacité du fichier Roadmap) ;
   - **ETP prévus** par semaine (colonne ETP du fichier Roadmap, ou carte d'import « ETP prévus » prioritaire) ;
   - KPIs : prévu total, capacité Roadmap, ETP moyen / sem. (pic), écart max capa − prévu.
2. **Capacitaire** — capacitaire journalière (275 jours) **en actes et en heures** :
   - bascule **Unité : Actes ⇄ Heures** ; les heures proviennent du fichier CAPA
     (lignes « Capacitaire en heures ») ou, à défaut, de la conversion
     `actes ÷ hypothèse de productivité` ;
   - contractuel et couverture conservés ; tableau par période ;
   - bloc **« Hypothèses de productivité »** (actes/heure par activité, éditable, mémorisé).
3. **Capa prévu vs Capa réel** — la capacitaire de l'onglet 2 (heures + actes) **vs la capa réelle
   issue du Planning** (import `date · activité · heures`) :
   - heures planifiées → capa réelle en heures ; × hypothèses de productivité → capa réelle en actes ;
   - **réalisés fusionnés** (traités DRM en ligne du graphique « actes ») ;
   - KPIs : capa prévue, capa réelle planning, écart, heures prévues/planifiées, réalisé (DRM) ;
   - tableau par période avec écarts actes et heures.
4. **Productivité** — tous les indicateurs **par canal Phone · Mail · Chat** et par activité :
   - `QS = traités / reçus` · `QP = reçus / prévision` · `QS < 60 s` ·
     `QE = (traités / prévision) × 92 %` si **QP > 115 %** · `T/P = traités / prévision` ;
   - **DMT** (secondes) · **Productivité = traités / heure de traitement** ·
     **Taux d'occupation = temps de traitement / heures planifiées** (import Planning) ;
   - nombres : traités, reçus, prévision (Phone : Roadmap hebdo ÷ 7 · Mail : « Prévision Mail »),
     heures de traitement ;
   - graphiques journalier + qualité (%) + répartition par activité ; tableau jour × activité
     (15 colonnes) avec total de période ;
   - Phone = DRM (réalisé) + Export Vonage Call (DMT, heures) · Mail = Export Mail ·
     Chat = source à raccordement futur (état vide explicite).
5. **DMT** — détail Durée Moyenne de Traitement (Export Vonage Call) : par jour × activité,
   en secondes format nombre (`300` = 5 min), communication + after-call empilés, moyennes pondérées.
6. **Mail** — détail du canal mail (Export Mail) : indicateurs du projet + nombres (traités, reçus,
   prévision, perdus file -50s via colonne `SLA-50` de l'Export Vonage, heures de traitement, DMT),
   par jour × activité.

## Filtres de période

Chaque onglet dispose de ses propres filtres **Du / Au + préréglages** :
Tout · Mois le plus récent · Mois précédent · 7 derniers jours · 30 derniers jours · Personnalisé.
Sur l'onglet Roadmap (données hebdomadaires), la période retient les semaines qui intersectent l'intervalle.

## Données & imports (bouton Importer)

- **Roadmap** : `.xlsm`, onglet `AUCHAN`, repère `S1__2026` ligne 3 — 3 colonnes par activité
  (prévu · **ETP** · capa).
- **ETP prévus** *(nouveau)* : colonnes `semaine (S42, 42 ou une date) · activité · etp`.
  Prioritaire sur la colonne ETP du fichier Roadmap.
- **Capacitaire** : `.xlsx`, onglet `DAILY VISION`, dates ligne 15, lignes « Capacitaire en actes »
  et « Capacitaire en heures » (si présentes).
- **Planning — heures planifiées** *(nouveau)* : colonnes `date · activité · heures`
  (l'activité peut être « Hyper », « Voix Hyper »…). Alimente la capa réelle (onglet 3)
  et le taux d'occupation. Un modèle `.xlsx` est téléchargeable dans le dialog.
- **Réalisé — DRM** : table journalière `SEMAINE / JOUR / DATE` + groupes `Traités · Reçus · Traités 60s`
  × flux (HYPER, C2E, AFR, DRIVE, SAV). Chaque mois importé s'additionne (même date = valeur remplacée).
- **DMT — Export Vonage Call** : une ligne par appel avec `Compétence · Répondu · After Call Work Time ·
  Durée de communication · Date de création`. Colonne `SLA-50` optionnelle (perdus file -50s).
- **Mail — Export Mail** : une ligne par courriel avec `Personnalisé · Statut · Délai de traitement ·
  Date d'acceptation`. Statut 1 = traité.
- **Prévision Mail** : colonnes `date · flux · prevu` — alimente QP, T/P et QE (Mail + Productivité).

Les imports sont conservés dans le navigateur (localStorage). Le bouton **Exporter** produit le
`data.json` complet à déposer dans `data/` pour le publier pour tous les utilisateurs.

## Mise à jour mensuelle du réalisé en production

Option A (interface) : Importer → Réalisé DRM → Exporter → remplacer `data/data.json` dans le dépôt → push.

Option B (script) :
```bash
python scripts/build_data.py "chemin/112026 - DRM.xlsx" data/data.json
git add data/data.json && git commit -m "DRM novembre" && git push
```

## Mises à jour DMT / Mail / Planning en production

```bash
python scripts/build_dmt.py "chemin/Export Vonage Call.xlsx" data/data.json
python scripts/build_mail.py "chemin/Export Mail.xlsx" data/data.json
git add data/data.json && git commit -m "maj semaines 44" && git push
```

Le Planning, les ETP et les hypothèses de productivité se mettent à jour via l'interface
(Importer → Exporter), puis `data/data.json` est poussé dans le dépôt.

## Déploiement Cloudflare Pages / Workers

1. GitHub → dépôt avec ces fichiers (racine ou sous-dossier — dans ce cas régler
   **Build output directory** sur le nom du sous-dossier, ex. `/dashboard-capa`).
2. Cloudflare → Workers & Pages → Create → **Connect to Git** →
   Build command : *(vide)* · Output directory : `/` (ou `/dashboard-capa`).
3. Chaque `git push` redéploie automatiquement ; `_headers` impose `no-cache` :
   les mises à jour sont visibles immédiatement (sinon Ctrl+Shift+R).
