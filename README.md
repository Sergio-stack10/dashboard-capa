# Dashboard capacitaire – Roadmap Auchan

Application 100 % statique (HTML/CSS/JS vanilla + Chart.js + SheetJS via CDN), sans build.
Déploiement : Cloudflare Workers (connecté GitHub).

## Contenu du dépôt

| Fichier | Rôle |
|---|---|
| `index.html` | Interface : 6 onglets + dialog d'import (8 sources) |
| `js/app.js` | Logique applicative (données, imports, graphiques, filtres) |
| `data/roadmap.json` | **Onglet Roadmap** : modèle RM complet (1 fichier par onglet) — 21 sections × 12 activités × 113 semaines |
| `data/data.json` | Autres onglets : capacitaire + réalisé (DRM oct. 2026) + DMT (Vonage, 1–25 oct.) + Mail (Export Mail, 1–25 oct.) |
| `favicon.svg` | Icône de l'outil (onglet navigateur) |
| `_headers` | Cloudflare : pas de cache (mises à jour toujours visibles) |
| `scripts/build_roadmap.py` | Régénère `data/roadmap.json` depuis le modèle RM (`.xlsm`, onglet AUCHAN + feuille Congés) |
| `scripts/build_data.py` | Injecte un DRM dans `data/data.json` |
| `scripts/build_dmt.py` | Injecte un Export Vonage Call (DMT) dans `data/data.json` |
| `scripts/build_mail.py` | Injecte un Export Mail (canal mail) dans `data/data.json` |
| `scripts/validate_roadmap.py` | Contrôle `roadmap.json` contre les valeurs du Dashboard RM |

## Les 6 onglets

1. **Roadmap** — *besoin & capacité à partir du modèle RM (S46+)*, semaine analysée + fenêtre
   13/27 semaines ou tout, périmètre Total / Front Office / Back Office / Autres / activité :
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
2. **Capacitaire** — capacitaire journalière (275 jours) **en actes et en heures** :
   - bascule **Unité : Actes ⇄ Heures** ; heures du fichier CAPA ou conversion
     `actes ÷ hypothèse de productivité` ; contractuel + couverture ;
   - bloc **« Hypothèses de productivité »** (actes/heure par activité, éditable, mémorisé).
3. **Capa prévu vs Capa réel** — capacitaire (heures + actes) **vs Planning**
   (import `date · activité · heures`) : heures planifiées → capa réelle, × productivités →
   actes ; réalisés DRM en ligne ; tableau par période avec écarts.
4. **Productivité** — indicateurs **par canal Phone · Mail · Chat** et par activité :
   `QS · QP · QS < 60 s · QE (si QP > 115 % : × 92 %) · T/P · DMT · productivité · TO`
   + nombres (traités, reçus, prévision, heures) ; tableau jour × activité (15 colonnes).
   Phone = DRM + Vonage · Mail = Export Mail · Chat = source à raccordement futur.
5. **DMT** — détail Vonage par jour × activité (communication + after-call, moyennes pondérées).
6. **Mail** — détail canal mail : QS, QP, QS < 60 s, QE, T/P + perdus file -50s (SLA-50 Vonage),
   heures de traitement, DMT, par jour × activité.

## Filtres

Onglets jour (2-6) : filtres **Du / Au + préréglages** (Tout · mois récent · mois précédent ·
7 j · 30 j · personnalisé). Onglet Roadmap : **semaine analysée + fenêtre** (13/27/tout).

## Données & imports (bouton Importer)

- **Roadmap — modèle RM (S46+)** : `.xlsm`, onglet `AUCHAN` (sections Besoin / Capa / Effectif /
  SLA·QE / DMT / Occupation / Absentéisme / Congés) + feuille `Congés` → `data/roadmap.json`.
- **ETP prévus** : colonnes `semaine · activité · etp` (complément).
- **Capacitaire** : onglet `DAILY VISION`, dates ligne 15.
- **Planning** : colonnes `date · activité · heures` (modèle téléchargeable).
- **Réalisé — DRM** : `Traités · Reçus · Traités 60s` × flux (HYPER, C2E, AFR, DRIVE, SAV),
  les mois s'additionnent.
- **DMT — Export Vonage Call** / **Mail — Export Mail** / **Prévision Mail** : comme décrit
  dans le dialog d'import.

Les imports restent dans le navigateur (localStorage). **Exporter** produit le `data.json`
(avec la roadmap importée) à déposer dans `data/`.

## Mise à jour hebdomadaire du modèle RM

Option A (interface, recommandée) : Importer → **Roadmap — modèle RM** → le fichier
`Copie de RM_Sxx.xlsm` est analysé dans le navigateur → Exporter si publication pour tous.

Option B (script) :
```bash
python scripts/build_roadmap.py "chemin/Copie de RM_Auchan_S46.xlsm" data/roadmap.json
python scripts/validate_roadmap.py          # contrôle vs Dashboard RM
git add data/roadmap.json && git commit -m "RM S46" && git push
```

## Mise à jour mensuelle du réalisé / DMT / Mail

```bash
python scripts/build_data.py "chemin/112026 - DRM.xlsx" data/data.json
python scripts/build_dmt.py "chemin/Export Vonage Call.xlsx" data/data.json
python scripts/build_mail.py "chemin/Export Mail.xlsx" data/data.json
git add data/data.json && git commit -m "maj réalisé" && git push
```

## Déploiement Cloudflare Workers (Git integration)

1. GitHub → dépôt (fichiers à la racine ou sous-dossier réglé côté Worker).
2. Chaque `git push` redéploie automatiquement ; `_headers` impose `no-cache`.
3. URL : `https://dashboard-capa.auchan.workers.dev/`
