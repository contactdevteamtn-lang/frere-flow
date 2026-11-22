// Parcours complet dans un vrai navigateur (Chromium) : site + API réelle.
// Lancé par « npm run test:integration » (voir lancer.mjs) — ne pas exécuter directement.
import { chromium } from "playwright";
import fs from "node:fs";
const bundle = fs.readFileSync(process.env.FF_BUNDLE);
const html =
  '<!doctype html><html><body><div id="root"></div><script src="/bundle.js"></script></body></html>';
const API = process.env.FF_API || "http://localhost:4777/api";
const results = [];
let fails = 0;
const check = (name, cond, extra = "") => {
  results.push(`${cond ? "✔" : "✘"} ${name}${cond ? "" : " " + extra}`);
  if (!cond) fails++;
};

import http from "node:http";
const statique = http
  .createServer((req, res) => {
    if (req.url.startsWith("/bundle.js")) {
      res.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8" });
      return res.end(bundle);
    }
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
  })
  .listen(5199);
const browser = await chromium.launch();
async function newPage() {
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  p.errs = errs;
  await p.goto("http://localhost:5199/");
  await p.waitForFunction(() => window.__app?.ready);
  return p;
}
const settle = (p) => p.waitForTimeout(700);
const toasts = (p) =>
  p.evaluate(() => {
    const t = window.__toasts || [];
    window.__toasts = [];
    return t;
  });
const S = (p, f, arg) => p.evaluate(f, arg);

const p = await newPage();
check(
  "écran de connexion : 6 comptes de démo venant du serveur",
  await S(p, () => window.__app.state.users.length === 6 && !window.__app.me),
);
check(
  "…avec rôles et équipes",
  await S(p, () => window.__app.state.roles.length === 5 && window.__app.state.teams.length === 2),
);

await S(p, () => window.__app.login("direction@frere-mahjoub.tn", "mauvais"));
await settle(p);
let t = await toasts(p);
check(
  "mauvais mot de passe → message du front",
  t.some((x) => x.m === "البريد الإلكتروني أو كلمة المرور غير صحيحة") &&
    (await S(p, () => !window.__app.me)),
  JSON.stringify(t),
);

await S(p, () => window.__app.login("direction@frere-mahjoub.tn", "Direction2026"));
await p.waitForFunction(() => window.__app.me?.id === "u_super");
check(
  "connexion directeur : données du serveur chargées",
  await S(p, () => window.__app.state.sales.length > 30 && window.__app.can("administration")),
);
check(
  "aucun mot de passe dans le navigateur",
  await S(p, () => window.__app.state.users.every((u) => u.password === "")),
);

// Vente : affichage immédiat puis confirmation serveur
const before = await S(p, () => window.__app.state.sales.length);
const r1 = await S(p, () =>
  window.__app.run(window.__ops.createSale, {
    clientId: "cli_1",
    teamId: "team_1",
    frigoId: "frg_1",
    items: [{ productId: "prd_1", quantity: 12, unitPrice: 1.2 }],
    paid: 4.4,
    method: "ESPECES",
    notes: "e2e",
    packaging: [{ typeId: "pkt_1", quantity: 2 }],
  }),
);
const immediate = await S(p, () => window.__app.state.sales.length);
check(
  "run(createSale) renvoie true et la vente apparaît tout de suite",
  r1 === true && immediate === before + 1,
);
await settle(p);
const local = await S(p, () => window.__app.state.sales[0]);
const lireServeur = (pg) =>
  pg.evaluate(
    (api) => fetch(`${api}/state`, { credentials: "include" }).then((r) => r.json()),
    API,
  );
const server = await lireServeur(p);
check(
  "aucun jeton de session lisible par le site (cookie HttpOnly)",
  await S(
    p,
    () =>
      !document.cookie.includes("ff_session") &&
      !Object.keys(localStorage).some((k) => /token/i.test(k)),
  ),
);
check(
  "la vente est enregistrée sur le serveur (même numéro, montants)",
  server.state.sales[0].number === local.number && server.state.sales[0].remainingAmount === 10,
  `${server.state.sales[0].number} vs ${local.number}`,
);
check(
  "crédit et caisse créés côté serveur",
  server.state.credits.some((c) => c.saleId === local.id) &&
    server.state.cash[0].reference === local.number,
);

// Erreur métier détectée localement
const r2 = await S(p, () =>
  window.__app.run(window.__ops.createSale, {
    clientId: "cli_1",
    teamId: "team_1",
    frigoId: "frg_1",
    items: [{ productId: "prd_6", quantity: 999999, unitPrice: 1 }],
    paid: 0,
    method: "ESPECES",
    notes: "",
    packaging: [],
  }),
);
t = await toasts(p);
check(
  "stock insuffisant → false + message (comme avant)",
  r2 === false && t.some((x) => /مخزون غير كافٍ/.test(x.m)),
);

// Formulaires : contrôle immédiat dans le site (la fenêtre reste ouverte), sans appel au serveur
await toasts(p);
const client = {
  code: "",
  name: "كريم السعيدي",
  phone: "12345",
  address: "",
  email: "",
  taxId: "",
  active: true,
  createdAt: new Date().toISOString(),
};
const nbClients = await S(p, () => window.__app.state.clients.length);
const rBad = await S(p, (c) => window.__app.run(window.__ops.upsert, "clients", c), client);
t = await toasts(p);
check(
  "téléphone invalide → refus immédiat avec exemple",
  rBad === false && t.some((x) => x.m === "رقم الهاتف غير صحيح: 8 أرقام، مثال: 98 123 456"),
  JSON.stringify(t),
);
const rBad2 = await S(
  p,
  (c) =>
    window.__app.run(window.__ops.upsert, "clients", { ...c, phone: "98123456", taxId: "n/a" }),
  client,
);
t = await toasts(p);
check(
  "matricule fiscal invalide → refus avec exemple",
  rBad2 === false && t.some((x) => x.m.includes("1234567/A/M/000")),
);
const rBad3 = await S(p, () =>
  window.__app.run(window.__ops.createSale, {
    clientId: "cli_1",
    teamId: "team_1",
    frigoId: "frg_1",
    items: [{ productId: "prd_1", quantity: -3, unitPrice: 1 }],
    paid: 0,
    method: "ESPECES",
    notes: "",
    packaging: [],
  }),
);
t = await toasts(p);
check(
  "quantité négative → refus avec exemple",
  rBad3 === false && t.some((x) => x.m.includes("مثال: 25.5")),
);
check(
  "aucun client créé par les saisies refusées",
  (await S(p, () => window.__app.state.clients.length)) === nbClients,
);
const rOk = await S(
  p,
  (c) =>
    window.__app.run(window.__ops.upsert, "clients", {
      ...c,
      phone: "98-123-456",
      taxId: "1234567a",
    }),
  client,
);
await settle(p);
const cree = await S(p, () => window.__app.state.clients.find((c) => c.name === "كريم السعيدي"));
check(
  "saisie correcte : format harmonisé (+216 98 123 456, 1234567/A)",
  rOk === true && cree?.phone === "+216 98 123 456" && cree?.taxId === "1234567/A",
  JSON.stringify(cree),
);
const srvC = await lireServeur(p);
check(
  "…et enregistrée telle quelle sur le serveur",
  srvC.state.clients.some((c) => c.name === "كريم السعيدي" && c.phone === "+216 98 123 456"),
);

// Paramètres (setState) → enregistrés sur le serveur
await S(p, () =>
  window.__app.setState((x) => ({ ...x, settings: { ...x.settings, defaultDueDays: 60 } })),
);
await settle(p);
const srv2 = await lireServeur(p);
check("page Paramètres : enregistrés sur le serveur", srv2.state.settings.defaultDueDays === 60);

// Utilisateur créé depuis le front puis connexion avec son mot de passe
await S(p, () =>
  window.__app.run(window.__ops.upsert, "users", {
    name: "سامي",
    email: "sami@frere-mahjoub.tn",
    phone: "",
    password: "Secret2026",
    active: true,
    createdAt: new Date().toISOString(),
    roleIds: ["role_emp"],
    teamId: "team_2",
  }),
);
await settle(p);
check(
  "utilisateur créé : mot de passe effacé côté navigateur après confirmation",
  await S(
    p,
    () =>
      window.__app.state.users.find((u) => u.email === "sami@frere-mahjoub.tn")?.password === "",
  ),
);
const loginSami = await fetch(`${API}/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "sami@frere-mahjoub.tn", password: "Secret2026" }),
});
check("…et il peut se connecter", loginSami.status === 200);

// Deuxième poste : voit les opérations du premier
const p2 = await newPage();
await S(p2, () => window.__app.loginAs("u_admin"));
await p2.waitForFunction(() => window.__app.me?.id === "u_admin");
const cash2 = await S(p2, () => window.__app.state.cash.length);
await S(p, () =>
  window.__app.run(window.__ops.addCash, {
    teamId: "team_1",
    type: "ENCAISSEMENT",
    method: "ESPECES",
    amount: 7,
    reference: "P2",
    description: "autre poste",
  }),
);
await settle(p);
await p2.evaluate(() => window.dispatchEvent(new Event("focus")));
await p2.waitForTimeout(800);
check(
  "2e poste : mise à jour automatique avec l’opération du 1er",
  (await S(p2, () => window.__app.state.cash.length)) === cash2 + 1,
);

// Employé : refus côté serveur (autre Figo) → message + retour aux vraies données
await S(p, () => window.__app.logout());
await p.waitForFunction(() => window.__app.me === null && window.__app.state.users.length === 6);
check("déconnexion → retour à l’écran de connexion", true);
await S(p, () => window.__app.loginAs("u_x"));
await p.waitForFunction(() => window.__app.me?.id === "u_x");
check(
  "employé Walid : filtre Figo verrouillé sur son équipe",
  await S(p, () => window.__app.teamFilter === "team_1" && !window.__app.can("administration")),
);
const n0 = await S(p, () => window.__app.state.sales.length);
const r3 = await S(p, () =>
  window.__app.run(window.__ops.createSale, {
    clientId: "cli_2",
    teamId: "team_2",
    frigoId: "frg_1",
    items: [{ productId: "prd_1", quantity: 1, unitPrice: 1.2 }],
    paid: 1.2,
    method: "ESPECES",
    notes: "",
    packaging: [],
  }),
);
await settle(p);
t = await toasts(p);
check(
  "vente pour un autre Figo refusée par le serveur → message",
  r3 === true && t.some((x) => x.m === "هذه العملية تخص فريقاً آخر"),
  JSON.stringify(t),
);
check(
  "…et l’écran revient aux données réelles (vente retirée)",
  (await S(p, () => window.__app.state.sales.length)) === n0,
);
const r4 = await S(p, () =>
  window.__app.run(window.__ops.addCash, {
    teamId: "team_1",
    type: "DECAISSEMENT",
    method: "ESPECES",
    amount: 1,
    reference: "",
    description: "Dépense test",
  }),
);
await settle(p);
t = await toasts(p);
check(
  "action sans permission (caisse) refusée par le serveur",
  r4 === true && t.some((x) => x.m === "ليست لديك صلاحية لهذه العملية"),
);

// Données filtrées pour l'employé : rien du Figo 2
check(
  "Walid ne reçoit aucune vente ni caisse du Figo 2",
  await S(
    p,
    () =>
      window.__app.state.sales.every((x) => x.teamId === "team_1") &&
      window.__app.state.cash.every((x) => x.teamId === "team_1"),
  ),
);
check(
  "…ni les emails/téléphones des autres utilisateurs",
  await S(p, () =>
    window.__app.state.users.filter((u) => u.id !== "u_x").every((u) => !u.email && !u.phone),
  ),
);
// Déconnexion : la session est fermée côté serveur, même en rechargeant la page
await S(p, () => window.__app.logout());
await p.waitForFunction(() => window.__app.me === null && window.__app.state.users.length === 6);
await p.reload();
await p.waitForFunction(() => window.__app?.ready);
check("après déconnexion + rechargement → écran de connexion", await S(p, () => !window.__app.me));
const apres = await p.evaluate(
  (api) => fetch(`${api}/state`, { credentials: "include" }).then((r) => r.status),
  API,
);
check("…et le serveur refuse l’accès aux données", apres === 401);

// Compte « اطلاع فقط » : tout voir, rien modifier
await S(p, () => window.__app.loginAs("u_l"));
await p.waitForFunction(() => window.__app.me?.id === "u_l");
check(
  "consultation : marqué « اطلاع فقط » et voit ventes/dettes/caisse",
  await S(
    p,
    () =>
      window.__app.readOnly &&
      window.__app.state.sales.length > 30 &&
      window.__app.state.credits.length > 0 &&
      window.__app.state.cash.length > 0,
  ),
);
await toasts(p);
const nCash = await S(p, () => window.__app.state.cash.length);
const okLecture = await S(p, () =>
  window.__app.run(window.__ops.addCash, {
    teamId: "team_1",
    type: "ENCAISSEMENT",
    method: "ESPECES",
    amount: 10,
    reference: "X",
    description: "essai lecture",
  }),
);
t = await toasts(p);
check(
  "consultation : toute modification refusée avec message",
  okLecture === false &&
    t.some((x) => x.m.includes("للاطلاع فقط")) &&
    (await S(p, () => window.__app.state.cash.length)) === nCash,
  JSON.stringify(t),
);
await S(p, () => window.__app.logout());
await p.waitForFunction(() => window.__app.me === null && window.__app.state.users.length === 6);
// Compte « مسؤول السوق » : seulement les marchés
await S(p, () => window.__app.loginAs("u_m"));
await p.waitForFunction(() => window.__app.me?.id === "u_m");
check(
  "marché : seulement la permission « الأسواق »",
  await S(
    p,
    () =>
      window.__app.can("marches") && !window.__app.can("ventes") && !window.__app.can("dashboard"),
  ),
);
check(
  "marché : ne reçoit que les clients des marchés, aucune vente normale ni caisse",
  await S(
    p,
    () =>
      window.__app.state.clients.length > 0 &&
      window.__app.state.clients.every((c) => c.marketId) &&
      window.__app.state.sales.every((x) => x.marketTripId) &&
      window.__app.state.cash.length === 0,
  ),
);
const tripId = "trip_e2emarche1";
const pid = await S(p, () => {
  const a = window.__app.state;
  return a.products.find((x) => window.__ops.stockOf(a, x.id, "frg_1") >= 30).id;
});
const okTrip = await S(
  p,
  ([id, pr]) =>
    window.__app.run(window.__ops.createMarketTrip, {
      id,
      marketId: "mkt_sousse",
      teamId: "team_1",
      loads: [{ productId: pr, frigoId: "frg_1", quantity: 30 }],
      boxes: [{ typeId: "pkt_1", quantity: 5 }],
      notes: "",
    }),
  [tripId, pid],
);
await p.waitForTimeout(600);
const okVenteM = await S(
  p,
  ([id, pr]) =>
    window.__app.run(window.__ops.createMarketSale, {
      tripId: id,
      clientId: "mc_1",
      items: [{ productId: pr, quantity: 10, unitPrice: 3 }],
      boxes: [
        { typeId: "pkt_1", quantity: 2 },
        { typeId: "pkt_client", quantity: 3 },
      ],
      paid: 10,
      method: "ESPECES",
      notes: "",
    }),
  [tripId, pid],
);
await p.waitForTimeout(800);
const srvM = await lireServeur(p);
const venteM = srvM.state.sales.find((x) => x.marketTripId === tripId);
check(
  "marché : sortie + vente enregistrées sur le serveur",
  okTrip && okVenteM && !!venteM && venteM.totalAmount === 30,
);
check(
  "marché : caisses du client comptées à part (3 reçues)",
  srvM.state.packagingMovements.some(
    (m) =>
      m.saleId === venteM?.id &&
      m.packagingTypeId === "pkt_client" &&
      m.type === "RETOUR" &&
      m.quantity === 3,
  ),
);
const detteM = srvM.state.credits.find((c) => c.saleId === venteM?.id);
const okPayM = await S(
  p,
  (id) =>
    window.__app.run(window.__ops.addCreditPayment, {
      creditId: id,
      amount: 20,
      method: "ESPECES",
      notes: "",
    }),
  detteM?.id,
);
await p.waitForTimeout(800);
check(
  "marché : dette du marché encaissée",
  okPayM &&
    (await lireServeur(p)).state.credits.find((c) => c.id === detteM.id).remainingAmount === 0,
);
await S(p, () => window.__app.logout());
await p.waitForFunction(() => window.__app.me === null && window.__app.state.users.length === 6);

// Mode de sécurité « code PIN » choisi par le directeur pour Walid, puis connexion guidée en 2 étapes
await S(p, () => window.__app.loginAs("u_super"));
await p.waitForFunction(() => window.__app.me?.id === "u_super");
await S(p, () => {
  const a = window.__app;
  const w = a.state.users.find((u) => u.id === "u_x");
  return a.run(window.__ops.upsert, "users", { ...w, secMode: "pin" });
});
await p.waitForTimeout(800);
check(
  "directeur : mode « رمز PIN » enregistré pour Walid",
  (await lireServeur(p)).state.users.find((u) => u.id === "u_x").secMode === "pin",
);
await S(p, () => window.__app.logout());
await p.waitForFunction(() => window.__app.me === null);
await S(p, () => window.__app.login("walid@frere-mahjoub.tn", "Demo2026"));
await p.waitForFunction(() => window.__app.etape);
check(
  "connexion : 2e étape « choisir un PIN » sans aucune donnée chargée",
  await S(
    p,
    () =>
      window.__app.etape.type === "pin-setup" &&
      !window.__app.me &&
      window.__app.state.sales.length === 0,
  ),
);
await toasts(p);
await S(p, () => window.__app.verifier({ pin: "1234", pin2: "1234" }));
t = await toasts(p);
check(
  "PIN trop facile refusé avec un exemple",
  t.some((x) => x.m.includes("4827")),
  JSON.stringify(t),
);
await S(p, () => window.__app.verifier({ pin: "4827", pin2: "4827" }));
await p.waitForFunction(() => window.__app.me?.id === "u_x");
check(
  "PIN créé → connecté",
  await S(p, () => !window.__app.etape && window.__app.state.sales.length > 0),
);
await S(p, () => window.__app.logout());
await p.waitForFunction(() => window.__app.me === null);
await S(p, () => window.__app.login("walid@frere-mahjoub.tn", "Demo2026"));
await p.waitForFunction(() => window.__app.etape?.type === "pin");
await S(p, () => window.__app.verifier({ pin: "9999" }));
await p.waitForTimeout(300);
check(
  "mauvais PIN → toujours à l’étape PIN",
  await S(p, () => !window.__app.me && window.__app.etape?.type === "pin"),
);
await S(p, () => window.__app.verifier({ pin: "4827" }));
await p.waitForFunction(() => window.__app.me?.id === "u_x");
check("bon PIN → connecté", true);
// mot de passe initial : bandeau puis changement par l'utilisateur lui-même
check("mot de passe initial signalé", await S(p, () => window.__app.me.passwordInitial === true));
const okMdp = await S(p, () => window.__app.changerMotDePasse("Demo2026", "Walid2027x"));
await p.waitForTimeout(300);
check(
  "changer mon mot de passe → bandeau retiré, session conservée",
  okMdp && (await S(p, () => window.__app.me?.passwordInitial === false)),
);
await S(p, () => window.__app.logout());
await p.waitForFunction(() => window.__app.me === null);

// Session conservée au rechargement de la page
await S(p2, () => location.reload());
await p2.waitForFunction(() => window.__app?.ready && window.__app.me);
check(
  "rechargement de la page : session et données conservées",
  await S(p2, () => window.__app.me.id === "u_admin" && window.__app.state.sales.length > 30),
);

// Restauration des données de démonstration
await toasts(p2);
await S(p2, () => window.__app.reset());
await p2.waitForTimeout(800);
t = await toasts(p2);
check(
  "restauration refusée pour un rôle sans « paramètres »",
  t.some((x) => x.m === "ليست لديك صلاحية لهذه العملية"),
  JSON.stringify(t),
);
await S(p2, () => window.__app.logout());
await p2.waitForFunction(() => window.__app.me === null);
await S(p2, () => window.__app.loginAs("u_super"));
await p2.waitForFunction(() => window.__app.me?.id === "u_super");
await S(p2, () => window.__app.reset());
await p2.waitForTimeout(800);
check(
  "restauration démo depuis Paramètres (directeur)",
  await S(
    p2,
    () =>
      window.__app.state.settings.defaultDueDays === 30 &&
      !window.__app.state.users.some((u) => u.email === "sami@frere-mahjoub.tn"),
  ),
);

check(
  "aucune erreur JavaScript",
  !p.errs.length && !p2.errs.length,
  JSON.stringify([...p.errs, ...p2.errs]),
);
console.log(results.join("\n"));
console.log(`\n${results.length - fails}/${results.length} vérifications`);
await browser.close();
statique.close();
process.exit(fails ? 1 : 0);
