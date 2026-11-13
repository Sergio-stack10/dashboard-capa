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
| `data/dashcapa.json` | **Données DASHBOARD CAPA AUCHAN** : feuille Planning (heures planifiées, allaitement, 10 jours × 80 agents + lignes brutes), feuille Skills (60 compétences), EXT_Agent (heures de log réalisées), EXT_Entrant (réalisé voix + DMT), EXT_Email (réalisé mail) |
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

2. **Planification** — 2 sous-onglets. La capa en heures de contrat (effectif planifié hors FIM
   × 8 h/jour, 7 h si allaitement — colonne « Allaitement » du `Planning`) est répartie par
   activité × canal selon la feuille `Skills` :
   - **HYPER/DRIVE** → 50/50 sur les activités Hyper et Drive × 50/50 sur les canaux MAIL et PHONE ;
   - **ALL** (LOT UNIQUE) → toutes les activités et tous les canaux (répartition uniforme) ;
   - **SAV** → mono-compétence sur le PHONE · **CHAT** (LOT 4) → mono-compétence sur le CHAT.
   - **Vue journalière** : capa contrat par activité par jour + effectif planifié (prod / FIM /
     allaitement) + heures de log réalisées (EXT_Agent : Busy, Wrap Up, Hold, Chat, Panier — hors agents FIM).
   - **Vue par créneaux** : personnes et heures de contrat par créneau 30 min + matrice créneau × activité.

3. **Analyse capa** — **capa roadmap vs capa planif** (l'ancien « réalisé » a été retiré) :
   - capa roadmap = capa hebdo du modèle RM répartie par jour (poids prévision) ;
   - capa planif = **capa en heures de contrat** hors FIM × (1 − absentéisme RM) → actes = capa
     heures × **productivité du modèle RM** (par activité **et par canal** : `Mail Hyper` / `Mail AFR` /
     `Mail Drive` pour le canal MAIL, `Direct (LAD)` pour Direct, etc.) ;
   - **seuls les jours couverts par la planification sont analysés** (les jours sans planif sont
     exclus pour ne pas fausser les écarts).

## Ventilation de la prévision, fuseau et agrégat horaire (nouveau)

- **Ventilation « Calcul prévision »** — la prévision affichée dans les vues journalière et par
  créneaux est désormais la **prévision Webhelp** ventilée exactement comme le fichier de calcul :
  **prévu du MOIS × poids journalier du jour** (Σ poids = 1 par mois × flux) puis **× poids
  intraday du créneau** (Σ = 1). Repli : prévision finale RM quand un mois/flux n'a pas de
  prévision Webhelp (signalé dans le KPI). Le QE = capa ÷ prévision Webhelp (repli prévision RM).
- **Codes créneaux = fin de créneau** — comme dans le fichier de calcul (`P(O) = M(O) + M(O−30)`) :
  le code 800 couvre **[07:30 → 08:00)** Paris ; l'**heure pleine** « 07:00 » = codes 730 + 800.
  L'affichage montre toujours l'intervalle complet (ex. « 09:00 → 10:00 »).
- **Heure Paris → Mada** — la prévision est en heure Paris, le planning en heure Madagascar :
  un sélecteur **« Heure Paris → Mada »** (vision Mada **+2 h** par défaut, +1 h l'été, ou
  Paris 0 h) décale les créneaux de la vue par créneaux (prévision **et** capa roadmap) pour
  les aligner sur le planning. Choix persisté (localStorage).
- **Agrégat** — sélecteur **« Créneaux 30 min » / « Heures pleines »** : le mode heures pleines
  somme 2 créneaux consécutifs (13 lignes + le reste de la dernière demi-heure, comme le
  tableau O-P du fichier). Choix persisté.
- **Notes retirées** — les blocs de notes / notes de formules sous les tableaux ont été
  supprimés de toutes les pages.

## Persistance, productivité et actualisation (nouveau)

- **Sauvegarde automatique** — tout import (et la démo) est enregistré immédiatement dans le
  navigateur (**IndexedDB**, repli localStorage). Les données **restent après actualisation ou
  fermeture de la page**, même pour de gros fichiers : localStorage seul était limité à ~5 Mo et
  la sauvegarde échouait en silence (cause des pertes constatées). L'entête affiche l'état
  (« Sauvegarde locale active » / « Sauvegardé à HH:MM » / « ⚠ Sauvegarde impossible »).
  « Réinitialiser » efface IndexedDB + localStorage et recharge les données préchargées.
- **Capa en heures de contrat (Planification)** — la capa en heures n'est plus la présence
  du fichier : elle vaut **effectif planifié hors FIM × heure contrat** (8 h/jour · 40 h/semaine,
  **7 h si allaitement** — colonne « Allaitement » du Planning). Ces heures de contrat sont
  ramenées sur la présence [Shift In, Shift Out) − pause repas au prorata des créneaux, puis
  réparties par activité × canal selon la feuille Skills (Σ créneaux = Σ activités = capa
  contrat du jour). KPI « Capa en heures (contrat) », colonnes « Allait. » et
  « Capa contrat (h) » du tableau journalier, ligne « Capa contrat (effectif × 8 h) » du
  graphique, et sous-onglet créneaux cohérent.
- **Capa planif et productivité du roadmap** — la capa planif (onglet Analyse capa) est
  calculée sur ces **heures de contrat** : capa heures × (1 − absentéisme RM) × productivité
  **du modèle RM** (section `Productivité`, valeur hebdomadaire de la semaine concernée),
  avec la clé exacte par activité et canal ; les hypothèses manuelles ci-dessous restent
  prioritaires.
- **Hypothèses de productivité manuelles** (onglet Analyse capa, section « Hypothèses de
  productivité — actes / heure ») — une ligne par activité × canal ; la valeur RM courante est
  affichée sous chaque champ. Saisir une valeur **remplace** l'hypothèse RM (badge
  « manuel — prioritaire », le KPI « Capa planif » le précise) ; vider le champ pour revenir au
  modèle RM. Les valeurs saisies sont **sauvegardées automatiquement** et retrouvées après
  actualisation.
- **Bouton ↻ Actualiser sur chaque page** (Roadmap, Planification, Analyse capa, Analyse
  réalisé) — recharge les fichiers préchargés du site (sans jamais écraser les données importées
  localement), ré-affiche la page courante et met à jour l'entête.

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
