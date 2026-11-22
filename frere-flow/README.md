# Frère Flow — site de gestion

Interface web de gestion (ventes, crédits, stock, frigos, emballages, marchés, caisse) de la société des frères Mahjoub.
Le site fonctionne avec l'API **frere-flow-backend** (Node.js + MongoDB), qui conserve les données et contrôle les droits.

## Technologies

React 19 · TanStack Start / Router · Tailwind CSS 4 · Vite · Vitest

## Démarrage en développement

```bash
npm install
npm run dev          # http://localhost:8080
```

L'API doit tourner en parallèle (`npm run dev` dans `frere-flow-backend`, port 4000).
Pour une API sur une autre adresse, copier `.env.example` en `.env` et renseigner `VITE_API_URL`.

## Commandes

| Commande        | Rôle                                                  |
| --------------- | ----------------------------------------------------- |
| `npm run dev`   | serveur de développement                              |
| `npm run build` | build de production (serveur Node.js dans `.output/`) |
| `npm test`      | tests (Vitest)                                        |
| `npm run lint`  | vérification du code (ESLint)                         |

## Production

Construit et servi par Docker derrière Caddy (HTTPS), à la même adresse que l'API (`/api`) :
voir `deploy/` dans `frere-flow-backend`.

## Sécurité

- Session par cookie HttpOnly posé par l'API : aucun jeton lisible par le site.
- Toutes les règles (droits, validation, calculs) sont revérifiées par le serveur.
- Ne jamais placer de secret dans une variable `VITE_*` : elles sont visibles dans le navigateur.
