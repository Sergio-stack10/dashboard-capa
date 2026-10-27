# Dashboard capacitaire – Roadmap Auchan

Application 100 % statique (HTML/CSS/JS vanilla + Chart.js + SheetJS via CDN), sans build.
Déploiement : Cloudflare Pages (ou Workers).

## Contenu du dépôt

| Fichier | Rôle |
|---|---|
| `index.html` | Interface : 6 onglets + dialog d'import (5 sources) |
| `js/app.js` | Logique applicative (données, imports, graphiques, filtres de période) |
| `data/data.json` | Données intégrées : roadmap + capacité + réalisé (DRM oct. 2026) + **DMT (Vonage, 1–25 oct.)** |
| `favicon.svg` | Icône de l'outil (onglet navigateur) |
| `_headers` | Cloudflare Pages : pas de cache sur `data/data.json` |
| `scripts/build_data.py` | Régénère `data/data.json` : fusionne un DRM dans les données existantes |
| `scripts/build_dmt.py` | Injecte un Export Vonage Call (DMT) dans `data/data.json` |

## Les 6 onglets

1. **Prévu** — roadmap hebdomadaire (10 activités × 52 sem.) : prévu vs capacité + ETP.
2. **Capacité** — capacitaire journalier (275 jours, 8 flux) en vue jour / semaine / mois.
3. **Prévu vs planifié** — comparaison avec le fichier plan (source du prévu : Capacité ou Contractuel).
4. **Planifié vs réalisé** — comparaison par créneau 30 min issue du fichier plan.
5. **Réalisé** — visuel alimenté par les DRM :
   - KPIs de période : Reçus, Traités, Traités < 60 s, Taux < 60 s, Écart reçus − traités ;
   - graphique journalier (reçus / traités / taux < 60 s) ;
   - **cumulé sur la période** ;
   - répartition par flux ;
   - bloc **« Planifié vs Réalisé — journée sélectionnée »** relié à l'onglet 4 (bouton « Ouvrir Planifié vs réalisé ») ;
   - tableau journalier cliquable (les jours à venir restent grisés).
6. **DMT** *(nouveau)* — Durée Moyenne de Traitement issue de l'**Export Vonage Call** :
   - DMT = (durée de communication + after-call work) ÷ **appels répondus**, par jour × activité ;
   - toutes les valeurs DMT (KPIs, axes, infobulles, tableau) sont en **secondes, format nombre** (ex. `300` = 5 min) ;
   - KPIs : DMT moyenne, communication moy., after-call moy., appels répondus, activité la plus lente ;
   - courbe journalière par activité + ligne Global ;
   - barres empilées communication / after-call par activité ;
   - tableau jour × activité en secondes (nombre entier) avec moyennes de période.

## Filtres de période

Chaque onglet dispose de ses propres filtres **Du / Au + préréglages** :
Tout · Mois le plus récent · Mois précédent · 7 derniers jours · 30 derniers jours · Personnalisé.
Sur l'onglet Prévu (données hebdomadaires), la période retient les semaines qui intersectent l'intervalle.
Les filtres sont conservés quand on change d'onglet ; le bouton **Exporter** ne les affecte pas.

## Données & imports (bouton Importer)

- **Roadmap** : `.xlsm`, onglet `AUCHAN`, repère `S1__2026` ligne 3.
- **Capacité** : `.xlsx`, onglet `DAILY VISION`, dates ligne 15, lignes « Capacitaire en actes ».
- **Planifié** : colonnes `date, creneau, flux, prevu, planifie, realise` (un modèle `.xlsx` est téléchargeable dans le dialog).
- **Réalisé — DRM** : table journalière `SEMAINE / JOUR / DATE` + groupes `Traités · Reçus · Traités 60s` × flux (HYPER, C2E, AFR, DRIVE, SAV). La lecture s'arrête automatiquement à la 2e table (QS/QP) et ignore les lignes MTD / Global MTD. **Chaque mois importé s'additionne** aux précédents (même date = valeur remplacée).
- **DMT — Export Vonage Call** *(nouveau)* : une ligne par appel avec `Compétence · Répondu · After Call Work Time · Durée de communication · Date de création`. Seuls les appels répondus comptent ; même jour/activité = valeur remplacée (les exports mensuels se cumulent). Toute activité du fichier est acceptée (BARCELONE incluse).

Les imports sont conservés dans le navigateur (localStorage). Le bouton **Exporter** produit le
`data.json` complet à déposer dans `data/` pour le publier pour tous les utilisateurs.

## Mise à jour mensuelle du réalisé en production

Option A (interface) : Importer → Réalisé DRM → Exporter → remplacer `data/data.json` dans le dépôt → push.

Option B (script) :
```bash
python scripts/build_data.py "chemin/112026 - DRM.xlsx" data/data.json
git add data/data.json && git commit -m "DRM novembre" && git push
```

## Mise à jour de la DMT en production

Option A (interface) : Importer → Export Vonage Call → Exporter → remplacer `data/data.json` → push.

Option B (script) :
```bash
python scripts/build_dmt.py "chemin/Export Vonage Call.xlsx" data/data.json
git add data/data.json && git commit -m "DMT semaine 44" && git push
```

## Déploiement Cloudflare Pages

1. GitHub → dépôt avec ces fichiers à la racine.
2. Cloudflare → Workers & Pages → Create → Pages → **Connect to Git** →
   Build command : *(vide)* · Output directory : `/`.
3. Le site est servi sur `https://<nom-du-projet>.pages.dev` — le sous-domaine DNS est créé
   **au premier déploiement réussi** (si `NXDOMAIN` : vérifier que le nom du projet correspond
   exactement et que le premier build est bien « Success », puis patienter quelques minutes).
4. Chaque `git push` redéploie automatiquement ; l'URL reste inchangée.

> Note : le Worker existant (`*.workers.dev`) continue de fonctionner en parallèle ;
> il peut être supprimé une fois la version Pages validée.
