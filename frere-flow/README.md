# Welcome to your Lovable project

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Open your project in the [Lovable editor](https://lovable.dev) and keep building.

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: connect the project to GitHub and every change made in Lovable is committed straight to your repository.
- **Full ownership**: this code is yours. Push to your repository and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS

## Serveur (API) et base de données

Les données ne sont plus enregistrées dans le navigateur : le site est relié au serveur
**frere-flow-backend** (Node.js + MongoDB), qui exécute la même logique métier (`src/services`).

1. Démarrer le serveur (dossier `frere-flow-backend`, voir son README) :
   ```sh
   npm install
   npm run dev        # → « API prête sur http://localhost:4000/api »
   ```
2. Démarrer le site (ce dossier) :
   ```sh
   npm install
   npm run dev
   ```
3. Ouvrir l'adresse affichée par `npm run dev` et se connecter
   (comptes de démonstration, mot de passe `demo`).

L'adresse du serveur se règle dans `.env` (`VITE_API_URL`, voir `.env.example`) ;
par défaut le site appelle le port 4000 de la machine qui l'affiche.

Seul `src/store/store.tsx` a changé (plus `src/lib/api.ts` et quelques traductions de messages du serveur) :
les pages appellent toujours `useApp()` / `run(op, ...)`. Chaque opération est appliquée à l'écran
immédiatement puis exécutée par le serveur ; en cas de refus (règle métier, droits, autre équipe),
le message s'affiche et les données réelles sont rechargées. Les opérations des autres postes
apparaissent automatiquement (toutes les 15 secondes et au retour sur l'onglet).

Si vous modifiez la logique métier (`src/services`, `src/mock/seed.ts`), mettez le serveur à jour :
`npm run sync-domain` dans `frere-flow-backend`.

## Contrôle des saisies

Chaque champ affiche un exemple (ex : `98 123 456`, `1234567/A/M/000`, `125.500`) et chaque saisie est vérifiée
par `src/services/validation.ts` avant l'envoi (message avec exemple, la fenêtre reste ouverte),
puis de nouveau par le serveur. Les formats sont harmonisés (téléphone `+216 98 123 456`, email en minuscules…).

## Session et sécurité

- La connexion est gardée dans un cookie HttpOnly posé par le serveur (aucun jeton dans le navigateur).
- Déconnexion automatique après 30 min sans activité (réglable côté serveur : `IDLE_MINUTES`).
- En production, servez le site et l'API à la même adresse (`VITE_API_URL=/api`) derrière HTTPS :
  voir `frere-flow-backend/SECURITE.md` et `frere-flow-backend/deploy/Caddyfile`.

## Connexion

- Aucun compte ni email affiché sur l'écran de connexion.
- Modes de sécurité choisis par le directeur pour chaque compte (Utilisateurs & rôles) : mot de passe seul,
  code de l'application (QR code à scanner une fois), code PIN, code par email, appareils approuvés.
  L'écran de connexion guide l'utilisateur pas à pas.
- « حسابي » (clic sur l'avatar) : changer son propre mot de passe.

## Tests

| Commande                   | Contenu                                                                                                                                                                     |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test`                 | tests unitaires (règles métier, échéances, marchés, noms FR/AR)                                                                                                             |
| `npm run test:integration` | parcours complet dans Chromium avec la vraie API (48 vérifications) — prérequis : `npx playwright install chromium`, dossier `frere-flow-backend` à côté avec `npm install` |

## Langues

Arabe ou français (bouton en haut). En français, tout s'affiche en français, y compris les noms des clients,
utilisateurs, produits et marchés : chaque formulaire a un champ facultatif « nom en français / en arabe »
(avec bouton « Suggérer »), sinon le nom est translittéré automatiquement.

## Mise en ligne

`npm run build:serveur` puis `npm start` (port 3000), derrière Caddy avec l'API — voir `frere-flow-backend/DEPLOIEMENT.md`.
Un `Dockerfile` est fourni (utilisé par `frere-flow-backend/deploy/docker-compose.yml`).
