# Garder les données importées dans la base de données Cloudflare

Deux choses à bien distinguer :

1. **Dans le navigateur** (déjà le cas, rien à faire) : les données importées restent
   enregistrées dans le poste (IndexedDB) et se conservent d'une session à l'autre,
   **jusqu'au prochain import** qui les remplace.
2. **Dans Cloudflare** (ce guide) : une sauvegarde centralisée — vous poussez l'état
   complet de l'outil sur votre compte Cloudflare, puis vous le rechargez depuis
   n'importe quel poste ou navigateur. C'est le dossier `cloudflare/` livré ici :
   - `worker.js` — l'API de sauvegarde (Cloudflare Worker, endpoints GET/POST `/api/state`)
   - `wrangler.toml` — la configuration (base KV `CAPA_STATE`)
   - `GUIDE-CLOUDFLARE.md` — ce guide

L'outil (onglet **Analyse par conseiller**, carte **« ☁ Sauvegarde Cloudflare »**) contient
les boutons **« Sauver dans le cloud »** et **« Charger du cloud »** + champs URL / token.
L'URL et le token saisis y sont mémorisés sur le poste.

---

## Voie A — 100 % navigateur (sans ligne de commande, ~10 minutes)

1. **Créer / ouvrir un compte Cloudflare** → https://dash.cloudflare.com (gratuit).
2. **Créer la base KV** : menu gauche **Workers & Pages → KV → Create a namespace**.
   Nom : `CAPA_STATE`. Copier l'**Namespace ID** affiché.
3. **Créer le Worker** : **Workers & Pages → Create application → Create Worker**.
   Nom : `capa-sync` → **Deploy**, puis **Edit code**.
4. **Coller le contenu de `worker.js`** dans l'éditeur (remplacer tout le code par défaut)
   → **Deploy**.
5. **Lier la base** : dans le Worker → **Settings → Variables & Secrets → KV namespace
   bindings → Add binding** :
   - Variable name : `CAPA_STATE`
   - KV namespace : `CAPA_STATE` (celle créée à l'étape 2)
   → **Save**. (Redéploier si demandé.)
6. *(Optionnel — protection par token)* : **Settings → Variables & Secrets → Add variable**
   → type **Secret**, nom `CAPA_TOKEN`, valeur = votre token secret. Toute sauvegarde/lire
   exigera alors `Authorization: Bearer <token>` — renseignez-le dans l'outil (champ Token).
7. **Récupérer l'URL** : elle s'affiche en haut de la page du Worker :
   `https://capa-sync.<votre-sous-domaine>.workers.dev`
8. **Dans l'outil** : onglet **Analyse par conseiller** → carte **☁ Sauvegarde Cloudflare** :
   - coller l'URL du Worker ;
   - cliquer **Sauver dans le cloud** → « ✓ Sauvegardé · ~2 000 Ko » ;
   - depuis un autre poste : ouvrir l'outil, coller la même URL → **Charger du cloud**.

## Voie B — avec Wrangler (CLI, ~5 minutes)

```bash
npm install -g wrangler          # 1. installer la CLI Cloudflare
wrangler login                   # 2. ouvrir la session (navigateur)
cd cloudflare                    # 3. dans le dossier livré
wrangler kv:namespace create CAPA_STATE   # 4. créer la base KV
#    → copier l'id affiché dans wrangler.toml (ligne id = "…")
wrangler deploy                  # 5. déployer le Worker
wrangler secret put CAPA_TOKEN   # 6. (optionnel) activer le token
#    → URL affichée : https://capa-sync.<sous-domaine>.workers.dev
```

## Ce qui est stocké

| Clé KV | Contenu |
|---|---|
| `state` | L'état complet de l'outil : roadmap, prévision, planification, réalisé, DMT, mail, créneaux, suivi par conseiller, saisies… (~2 Mo) |
| `meta` | Date de sauvegarde, taille, version de l'outil |

- **Un nouvel état remplace l'ancien** (dernière sauvegarde = celle qui fait foi).
- Limite KV : 25 Mo par valeur — l'état actuel (~2 Mo) laisse une large marge.
- Le **chargement** ne remplace que les données ; les garde-fous habituels restent actifs
  (socle intégré rétabli si la sauvegarde contient un suivi « ancien » sans les colonnes Suivi).

## Vérifier l'installation

Ouvrir l'URL du Worker dans un navigateur : le message
`{"ok":true,"app":"dashboard-capa sync","api":["/api/state (GET, POST)"]}` doit s'afficher.
Ensuite : sauvegarder depuis l'outil, puis re-cliquer « Charger du cloud » → le statut
doit afficher « ✓ État chargé du cloud (maj …) ».
