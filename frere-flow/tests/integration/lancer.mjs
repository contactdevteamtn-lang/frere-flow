// Test d'intégration du site avec la vraie API, dans Chromium.
//   npm run test:integration
// Prérequis (une seule fois) : npm install  puis  npx playwright install chromium
// Le dossier du serveur doit être à côté de celui du site (../frere-flow-backend) avec « npm install » fait,
// ou indiqué par la variable FF_BACKEND. Le serveur est lancé en mémoire (aucune base touchée), puis arrêté.
import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const ici = path.dirname(fileURLToPath(import.meta.url));
const site = path.resolve(ici, "..", "..");
const backend = path.resolve(process.env.FF_BACKEND || path.join(site, "..", "frere-flow-backend"));
if (!fs.existsSync(path.join(backend, "src", "server.js"))) {
  console.error(
    `Serveur introuvable : ${backend}\nPlacez « frere-flow-backend » à côté de « frere-flow » ou définissez FF_BACKEND.`,
  );
  process.exit(1);
}
const PORT = process.env.FF_PORT || "4777";
const API = `http://localhost:${PORT}/api`;
const bundle = path.join(os.tmpdir(), `frere-flow-integration-${process.pid}.js`);

await build({
  entryPoints: [path.join(ici, "harness.tsx")],
  bundle: true,
  outfile: bundle,
  jsx: "automatic",
  logLevel: "warning",
  alias: { "@": path.join(site, "src"), sonner: path.join(ici, "sonner-stub.ts") },
  define: {
    "import.meta.env": JSON.stringify({ VITE_API_URL: API }),
    "process.env.NODE_ENV": '"development"',
  },
});

const serveur = spawn(process.execPath, ["src/server.js"], {
  cwd: backend,
  stdio: ["ignore", "pipe", "pipe"],
  env: {
    ...process.env,
    STORE: "memory",
    PORT,
    DEMO_LOGIN: "true",
    ALLOW_DEMO_RESET: "true",
    NODE_ENV: "development",
    LOGIN_IP_LIMIT: "100000",
    OPS_USER_LIMIT: "100000",
  },
});
let journal = "";
serveur.stdout.on("data", (d) => {
  journal += d;
});
serveur.stderr.on("data", (d) => {
  journal += d;
});
const pret = await new Promise((res) => {
  const t = setTimeout(() => res(false), 15000);
  serveur.stdout.on("data", () => {
    if (journal.includes("API prête")) {
      clearTimeout(t);
      res(true);
    }
  });
  serveur.on("exit", () => {
    clearTimeout(t);
    res(false);
  });
});
if (!pret) {
  console.error("Le serveur n’a pas démarré :\n" + journal);
  serveur.kill();
  process.exit(1);
}

const test = spawn(process.execPath, [path.join(ici, "parcours.mjs")], {
  stdio: "inherit",
  env: { ...process.env, FF_BUNDLE: bundle, FF_API: API },
});
const code = await new Promise((res) => test.on("exit", res));
serveur.kill();
fs.rmSync(bundle, { force: true });
process.exit(code ?? 1);
