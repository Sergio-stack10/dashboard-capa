# Dashboard capacitaire – Roadmap Auchan

Application 100 % statique (HTML/CSS/JS vanilla + Chart.js + SheetJS via CDN), sans build.
Déploiement : Cloudflare Workers (déploiement manuel ou Git integration).

## Contenu du dépôt

| Fichier | Rôle |
|---|---|
| `index.html` | Interface : 7 onglets + dialog d'import (9 sources) |
| `js/app.js` | Logique applicative (données, imports, graphiques, filtres) |
| `data/roadmap.json` | **Onglet Roadmap** : modèle RM complet (1 fichier par onglet) — 21 sections × 12 activités × 113 semaines |
| `data/prevision.json` | **Onglet Prévision** : prévus mensuels Webhelp (12 mois × 6 flux) + poids journaliers (365 j) + créneaux 30 min (12 mois × flux × profils Lundi-samedi / Dimanche) |
| `data/data.json` | Autres onglets : capacitaire + réalisé (DRM oct. 2026) + DMT (Vonage, 1–25 oct.) + Mail (Export Mail, 1–25 oct.) |
| `favicon.svg` | Icône de l'outil (onglet navigateur) |
| `_headers` | Cloudflare : pas de cache (mises à jour toujours visibles) |
| `scripts/build_roadmap.py` | Régénère `data/roadmap.json` depuis le modèle RM (`.xlsm`, onglet AUCHAN + feuille Congés) |
| `scripts/build_prevision.py` | Régénère `data/prevision.json` depuis le classeur Webhelp (onglets `2026` + `Poids`) |
| `scripts/build_data.py` | Injecte un DRM dans `data/data.json` |
| `scripts/build_dmt.py` | Injecte un Export Vonage Call (DMT) dans `data/data.json` |
| `scripts/build_mail.py` | Injecte un Export Mail (canal mail) dans `data/data.json` |
| `scripts/validate_roadmap.py` | Contrôle `roadmap.json` contre les valeurs du Dashboard RM |

## Les 7 onglets

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
3. **Capacitaire** — capacitaire journalière (275 jours) **en actes et en heures** :
   - bascule **Unité : Actes ⇄ Heures** ; heures du fichier CAPA ou conversion
     `actes ÷ hypothèse de productivité` ; contractuel + couverture ;
   - bloc **« Hypothèses de productivité »** (actes/heure par activité, éditable, mémorisé).
4. **Capa prévu vs Capa réel** — capacitaire (heures + actes) **vs Planning**
   (import `date · activité · heures`) : heures planifiées → capa réelle, × productivités →
   actes ; réalisés DRM en ligne ; tableau par période avec écarts.
5. **Productivité** — indicateurs **par canal Phone · Mail · Chat** et par activité :
   `QS · QP · QS < 60 s · QE (si QP > 115 % : × 92 %) · T/P · DMT · productivité · TO`
   + nombres (traités, reçus, prévision, heures) ; tableau jour × activité (15 colonnes).
   Phone = DRM + Vonage · Mail = Export Mail · Chat = source à raccordement futur.
6. **DMT** — détail Vonage par jour × activité (communication + after-call, moyennes pondérées).
7. **Mail** — détail canal mail : QS, QP, QS < 60 s, QE, T/P + perdus file -50s (SLA-50 Vonage),
   heures de traitement, DMT, par jour × activité.

## Filtres

Onglets jour (3-7) : filtres **Du / Au + préréglages** (Tout · mois récent · mois précédent ·
7 j · 30 j · personnalisé). Onglet Roadmap : **semaine analysée + fenêtre** (13/27/tout).
Onglet Prévision : **mois + flux** et **jour + profil** pour les créneaux.

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
- **Planning** : colonnes `date · activité · heures` (modèle téléchargeable).
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
