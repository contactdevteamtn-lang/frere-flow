// Construit le site pour un hébergement Node.js (VPS, Render, Railway, Docker…) :
//   npm run build:serveur   puis   npm start   (port 3000, ou PORT=…)
// Par défaut le site appelle l'API sur la même adresse (/api), derrière Caddy/Nginx (voir le serveur : deploy/).
// Pour une API sur une autre adresse : VITE_API_URL=https://api.mon-domaine.tn/api npm run build:serveur
import { spawnSync } from "node:child_process";

process.env.NITRO_PRESET ||= "node-server";
process.env.VITE_API_URL ||= "/api";
console.log(`Construction (preset ${process.env.NITRO_PRESET}, API ${process.env.VITE_API_URL})…`);
const r = spawnSync("npx", ["vite", "build"], {
  stdio: "inherit",
  env: process.env,
  shell: process.platform === "win32",
});
process.exit(r.status ?? 1);
