# Dashboard capacitaire – Roadmap Auchan

Application 100 % statique (HTML/CSS/JS vanilla + Chart.js 4.4.1 + SheetJS via CDN), sans build.
Déploiement : Cloudflare Workers (déploiement manuel par upload d'assets).

## Contenu du dépôt

| Fichier | Rôle |
|---|---|
| `index.html` | Interface : 4 onglets (dont 3 sous-onglets Roadmap et 2 sous-onglets Planification) + barre de filtres globale + dialog d'import (3 fichiers) |
| `js/app.js` | Logique applicative (données, imports, répartition Skills, graphiques, filtres globaux) |
| `data/roadmap.json` | **Onglet Roadmap** : modèle RM complet — 21 sections × 12 activités × 113 semaines |
| `data/prevision.json` | **Prévision Webhelp** : prévus mensuels (12 mois × 6 flux) + poids journaliers + créneaux 30 min (profils Lundi-samedi / Dimanche) — sert à répartir le capacitaire par jour et par créneau |
| `data/dashcapa.json` | **Données DASHBOARD CAPA AUCHAN** : feuille Planning (heures planifiées, 10 jours × 80 agents + lignes brutes), feuille Skills (60 compétences), EXT_Agent (heures de log réalisées), EXT_Entrant (réalisé voix + DMT), EXT_Email (réalisé mail) |
| `data/data.json` | Métadonnées (dates de mise à jour et noms de fichiers) |
| `favicon.svg` | Icône de l'outil (onglet navigateur) |
| `_headers` | Cloudflare : pas de cache (mises à jour toujours visibles) |
| `scripts/` | Scripts de génération des JSON (roadmap, prévision, dashcapa) |

## Sources de données — 3 fichiers uniquement

| Fichier importé | Alimente |
|---|---|
| **Roadmap — modèle RM** (.xlsm, onglet AUCHAN) | Onglet Roadmap (les 3 vues) + capa roadmap de l'Analyse capa |
| **Prévision Webhelp** (.xlsx, onglets `2026` + `Poids`) | Répartition journalière et par créneau du capacitaire + prévision finale |
| **Données DASHBOARD CAPA AUCHAN** (.xlsx, feuilles `Planning`, `Skills`, `EXT_Agent`, `EXT_Entrant`, `EXT_Email`) | Onglet Planification + capa planif (Analyse capa) + réalisé de l'onglet Analyse réalisé |

Les anciens imports (ETP, Planning heures, Réalisé DRM, DMT Vonage, Export Mail, Prévision Mail,
Planning agents) ont été retirés : le fichier « Données DASHBOARD CAPA » est désormais la source
unique de la planification et de la réalisation.

## Les 4 onglets

**Filtres globaux (au-dessus de chaque onglet)** : Granularité (Jour / Semaine / Mois) ·
**Flux** (multi : Front office / Back office / Autres) · **Channel** (multi : PHONE / MAIL / CHAT) ·
**Activités** (multi) · **Période** · **Intervalle de période**. Chaque groupe a ses boutons
**Tout sélectionner / Tout désélectionner** et un code couleur propre (Flux bleu · Channel vert ·
Activités violet). Cascade : Flux → Channels possibles → Activités possibles. Les filtres sont
grisés quand ils ne s'appliquent pas (ex. : les vues Roadmap/Planification ont leurs propres
filtres de période).

1. **Roadmap** — 3 sous-onglets :
   - **Vue annuelle — par semaine** (filtres Année + Mois) : le modèle RM hebdomadaire —
     capacitaires (heures de log / prod, actes), prévisions, ETP, effectif, SLA/QE vs cible,
     DMT, taux d'occupation, absentéisme, congés + tableau hebdomadaire.
   - **Vue journalière** (filtres Année, Mois, Semaine + Personnalisé du/au) : capa hebdo du
     modèle RM répartie par jour au prorata des **poids de la Prévision Webhelp** — mêmes
     indicateurs par jour (QE du jour = capa actes ÷ prévision finale).
   - **Vue par créneaux** (mêmes filtres + Moyenne période / Jour précis) : capa journalière
     répartie par créneaux 30 min selon les **poids créneaux** de la prévision (profil
     « Lundi au samedi » / « Dimanche ») — actes, heures, ETP à la pointe, QE.

2. **Planification** — 2 sous-onglets. Les heures planifiées (feuille `Planning`, hors FIM et
   hors pause repas) sont réparties par activité × canal selon la feuille `Skills` :
   - **HYPER/DRIVE** → 50/50 sur les activités Hyper et Drive × 50/50 sur les canaux MAIL et PHONE ;
   - **ALL** (LOT UNIQUE) → toutes les activités et tous les canaux (répartition uniforme) ;
   - **SAV** → mono-compétence sur le PHONE · **CHAT** (LOT 4) → mono-compétence sur le CHAT.
   - **Vue journalière** : heures par activité par jour + personnes planifiées (prod / FIM) +
     heures de log réalisées (EXT_Agent : Busy, Wrap Up, Hold, Chat, Panier — hors agents FIM).
   - **Vue par créneaux** : personnes et heures par créneau 30 min + matrice créneau × activité.

3. **Analyse capa** — **capa roadmap vs capa planif** (l'ancien « réalisé » a été retiré) :
   - capa roadmap = capa hebdo du modèle RM répartie par jour (poids prévision) ;
   - capa planif = heures planifiées hors FIM × (1 − absentéisme RM) → actes = heures de log
     × productivité (modèle RM ou hypothèses éditables dans l'onglet) ;
   - **seuls les jours couverts par la planification sont analysés** (les jours sans planif sont
     exclus pour ne pas fausser les écarts).

4. **Analyse réalisé** (ex-Productivité) — sections Phone / Mail / Chat : QS, QP, QE, T/P, DMT,
   productivité, taux d'occupation, d'après EXT_Entrant et EXT_Email. *Rework prévu avec l'équipe.*

## Mise à jour des données préchargées (avancer les données du site)

Les données du site sont celles des JSON de `data/`. Pour les rafraîchir :
1. soit importer les nouveaux fichiers via le bouton **Importer** puis **Exporter data.json** ;
2. soit régénérer les JSON en local avec les scripts de `scripts/` et pousser le dépôt.

## Déploiement Cloudflare (manuel)

1. Ouvrir le dashboard Cloudflare → **Workers & Pages** → worker `dashboard-capa`.
2. **Edit code** → **Create new deployment** → **Upload assets**.
3. Glisser le dossier `dashboard-capa` (contenant `index.html`, `js/`, `data/`…).
4. **Deploy** — ⚠️ ne jamais cliquer « Retry deployment » sur un ancien déploiement
   (cela re-déploie l'ancienne version).
5. Vérification : ouvrir l'URL en **navigation privée** et Ctrl+Shift+R ;
   la ligne d'entête doit afficher `maj 2026-11-12` et les sources
   « Données DASHBOARD CAPA AUCHAN.xlsx ».

En cas de « rien n'a changé » : vérifier dans **Deployments** que la date du déploiement est
du jour, vérifier que l'URL utilisée correspond bien au compte qui héberge le worker
(`dashboard-capa.<compte>.workers.dev` — plusieurs sous-domaines = plusieurs comptes),
puis vider le cache (navigation privée).
