# MORA MIAKANJO — site vitrine et back office

Site vitrine (React + Vite + Tailwind) et back office de gestion, servis par une API Node.js (Express) reliée à **PostgreSQL**.
Hébergement cible : **Render** (site + API) et **Neon** (base PostgreSQL), offres gratuites.

## Démarrer en local

```bash
npm install
npm run dev
```

- Site : http://localhost:5173
- Back office : http://localhost:5173/admin

Sans `DATABASE_URL`, l'API utilise une base PostgreSQL intégrée (PGlite, dossier `storage/pgdata`) : rien à installer.
Pour travailler directement sur la base Neon, renseignez `DATABASE_URL` dans `server/.env` (voir `server/.env.example`).

## Mise en ligne (Render + Neon)

1. **Neon** (https://neon.tech) : créer un projet (région Europe / Frankfurt), copier la *connection string*.
2. **Import des données** depuis ce PC : coller la chaîne dans `server/.env` (`DATABASE_URL=...`) puis
   ```bash
   npm run db:import
   ```
   (importe `storage/export/mora-export.json` et les photos de `storage/uploads`).
3. **GitHub** : créer un dépôt privé et y pousser ce projet.
4. **Render** (https://render.com) : *New > Blueprint*, choisir le dépôt ; renseigner `DATABASE_URL` quand il est demandé.
   Le fichier `render.yaml` configure tout le reste (compilation, démarrage, contrôle de santé `/api/health`).

Le site est alors en ligne sur `https://mora-miakanjo.onrender.com` (ou le nom proposé par Render).
Offre gratuite : le service s'endort après 15 min sans visite, la visite suivante prend ~30 s.
Chaque `git push` sur la branche principale redéploie automatiquement.

## Base de données

| Élément | Détail |
|---|---|
| Moteur | PostgreSQL 16+ (Neon en ligne, PGlite en local) |
| Schéma | `server/sql/NNN_*.sql`, appliqués dans l'ordre au démarrage et tracés dans `schema_migrations` |
| Photos | stockées en base (table `images`), servies par `/uploads/<id>` avec un cache long |
| Volumétrie | identifiants BIGINT, index sur les recherches et tris, index GIN pour les filtres taille/coloris, pagination côté serveur |
| Clients | table `customers` dédoublonnée par e-mail et téléphone, reliée aux commandes et messages |

Pour faire évoluer le schéma : ajouter `server/sql/002_description.sql`, appliqué au prochain démarrage.
Neon gratuit : 0,5 Go de stockage (photos comprises) ; au-delà, passer à l'offre payante ou déplacer les photos vers un stockage d'objets.

Historique : l'ancienne version SQL Server / IIS est archivée dans `C:\projets\archives\MORA_MIAKANJO_SQLServer_IIS_*.zip`.

## Ce que gère le back office

| Menu | Rôle |
|---|---|
| Tableau de bord | Nouvelles commandes, messages non lus, ventes du mois |
| Commandes | Réservations du site, saisie manuelle (boutique, téléphone, WhatsApp), statuts, notes, filtre par client |
| Messages | Demandes de la page Contact, réponse par e-mail / WhatsApp |
| Clients | Fiches clients (une par e-mail ou téléphone), nombre de commandes et montant dépensé |
| Produits | Nom, prix, photo, tailles, coloris, visibilité, à la une, nouveau, stock |
| Catégories | Univers affichés sur l'accueil et dans la collection |
| Promotions | Remises en % ou en montant, sur tout / une catégorie / un produit, avec dates |
| Accueil & À la une | Bandeau d'annonce, textes de la bannière, produits mis en avant, page À propos |
| Nos informations | Coordonnées, WhatsApp, réseaux sociaux, devise |

## Structure

```
server/            API Express (index.js), accès PostgreSQL (db.js), migrations (migrate.js, sql/), scripts/
src/               site public (pages/, components/) et back office (admin/)
render.yaml        configuration du déploiement Render
deploy/            publication locale sous IIS et tunnel Cloudflare (optionnel)
identite-visuelle/ charte graphique et logos
storage/           données locales (base intégrée, export, anciennes photos) — non versionné
```

## Publication locale sous IIS (optionnel)

`npm run build`, créer le site IIS sur `dist/` (port 8080, proxy ARR activé), lancer l'API avec `deploy\start-production.cmd`
et, pour un accès Internet temporaire, `deploy\TUNNEL-INTERNET.cmd` (tunnel Cloudflare, adresse aléatoire).
