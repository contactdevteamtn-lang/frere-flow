// Global state, connected to the API server (frere-flow-backend). Pages are unchanged: they only use useApp().
// - Data is loaded from the server after login and refreshed automatically (other users' changes).
// - run(op, ...) validates and applies the business operation locally (instant screen update),
//   then sends it to the server, which executes the same operation on the database.
//   If the server refuses it, the error is shown and the screen reloads the server data.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import type { AppState, ID, PermissionKey, User } from "@/types";
import { buildSeed } from "@/mock/seed";
import { enregistrerNoms, translate, useLanguage } from "@/lib/i18n";
import * as ops from "@/services/ops";
import * as markets from "@/services/markets";
import * as deadlines from "@/services/deadlines";
import { BusinessError } from "@/services/ops";
import { validateOp } from "@/services/validation";
import { api, ApiError, NETWORK_MESSAGE } from "@/lib/api";

type Op<A extends unknown[]> = (s: AppState, ...args: [...A, ID, string]) => AppState;

// Same names as the server operations (frere-flow-backend/src/domain)
/* eslint-disable @typescript-eslint/no-explicit-any */
const OP_NAMES = new Map<(...a: any[]) => AppState, string>([
  [ops.createSale, "createSale"],
  [ops.cancelSale, "cancelSale"],
  [ops.setSaleStatus, "setSaleStatus"],
  [ops.addCreditPayment, "addCreditPayment"],
  [ops.addManualCredit, "addManualCredit"],
  [ops.setCreditStatus, "setCreditStatus"],
  [ops.addStockMovement, "addStockMovement"],
  [ops.addPackMovement, "addPackMovement"],
  [ops.addCash, "addCash"],
  [ops.upsert, "upsert"],
  [ops.saveProduct, "saveProduct"],
  [ops.remove, "remove"],
  [markets.saveMarket, "saveMarket"],
  [markets.saveMarketClient, "saveMarketClient"],
  [markets.createMarketTrip, "createMarketTrip"],
  [markets.createMarketSale, "createMarketSale"],
  [markets.closeMarketTrip, "closeMarketTrip"],
  [deadlines.createDeadline, "createDeadline"],
  [deadlines.updateDeadline, "updateDeadline"],
  [deadlines.payDeadline, "payDeadline"],
  [deadlines.markReminder, "markReminder"],
  [deadlines.cancelDeadline, "cancelDeadline"],
]);
/* eslint-enable @typescript-eslint/no-explicit-any */

const LIST_KEYS = [
  "roles",
  "users",
  "teams",
  "clients",
  "products",
  "frigos",
  "stockMovements",
  "saleStatuses",
  "creditStatuses",
  "sales",
  "saleItems",
  "payments",
  "credits",
  "creditPayments",
  "cash",
  "packagingTypes",
  "packagingMovements",
  "auditLogs",
  "markets",
  "marketTrips",
] as const;

/** Structure de base (statuts, paramètres) sans données : remplacée par celles du serveur */
function emptyState(): AppState {
  const s = buildSeed();
  for (const k of LIST_KEYS)
    if (k !== "saleStatuses" && k !== "creditStatuses") (s[k] as unknown[]) = [];
  s.sessionUserId = null;
  return s;
}

type ServerState = Omit<AppState, "sessionUserId"> & { sessionUserId: ID | null };
type OpResponse = {
  version: number;
  state?: ServerState;
  collections?: Partial<AppState>;
  seq?: number;
  settings?: AppState["settings"];
};
type PublicInfo = {
  users: User[];
  roles: AppState["roles"];
  teams: AppState["teams"];
  settings: AppState["settings"];
  idleMinutes?: number;
  emailDisponible?: boolean;
};
/** 2e étape de la connexion demandée par le serveur (mode de sécurité du compte) */
export type Etape =
  | { type: "totp-setup"; qr: string; cle: string; lien: string }
  | { type: "totp" }
  | { type: "pin" }
  | { type: "pin-setup" }
  | { type: "email"; email: string }
  | { type: "appareil"; message: string };
type LoginResponse = {
  version?: number;
  state?: ServerState;
  etape?: string;
  qr?: string;
  cle?: string;
  lien?: string;
  email?: string;
};
const POLL_MS = 15000;
const CANAL_SESSION = "frere-flow-session";

interface Ctx {
  state: AppState;
  ready: boolean;
  me: User | null;
  can: (p: PermissionKey) => boolean;
  /** compte « اطلاع فقط » : aucune modification possible */
  readOnly: boolean;
  roleName: string;
  teamFilter: ID | "all";
  setTeamFilter: (t: ID | "all") => void;
  run: <A extends unknown[]>(op: Op<A>, ...args: A) => boolean;
  login: (email: string, password: string) => boolean;
  /** étape de vérification en cours (code, PIN, appareil) — null = aucune */
  etape: Etape | null;
  verifier: (v: { code?: string; pin?: string; pin2?: string }) => Promise<boolean>;
  renvoyerCode: () => void;
  annulerEtape: () => void;
  changerMotDePasse: (actuel: string, nouveau: string) => Promise<boolean>;
  securite: (
    userId: ID,
    action: "approuver" | "retirer" | "reinitialiser",
    deviceId?: string,
  ) => Promise<boolean>;
  /** l'envoi d'emails est configuré sur le serveur (mode « code par email ») */
  emailDisponible: boolean;
  loginAs: (userId: ID) => void;
  logout: () => void;
  reset: () => void;
  setState: (fn: (s: AppState) => AppState) => void;
}

const AppCtx = createContext<Ctx | null>(null);

const errorText = (e: unknown) =>
  translate(e instanceof ApiError || e instanceof BusinessError ? e.message : "تعذر تنفيذ العملية");

export function AppProvider({ children }: { children: ReactNode }) {
  useLanguage();
  const [state, setStateRaw] = useState<AppState>(() => emptyState());
  const [ready, setReady] = useState(false);
  const [teamFilter, setTeamFilter] = useState<ID | "all">("all");
  const stateRef = useRef(state);
  stateRef.current = state;
  const version = useRef<number | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const pending = useRef(0);
  const acc = useRef<{ full?: ServerState; patch: Partial<AppState> }>({ patch: {} });
  const connecte = useRef(false); // session ouverte (cookie HttpOnly posé par le serveur)
  const idleMinutes = useRef(30);
  const [etape, setEtape] = useState<Etape | null>(null);
  const [emailDisponible, setEmailDisponible] = useState(false);
  const derniereActivite = useRef(Date.now());

  /** Écran de connexion : comptes de démonstration, rôles et équipes publiés par le serveur */
  const loadPublic = useCallback(async () => {
    try {
      const p = await api<PublicInfo>("GET", "/auth/public");
      if (p.idleMinutes) idleMinutes.current = p.idleMinutes;
      setEmailDisponible(!!p.emailDisponible);
      setStateRaw({
        ...emptyState(),
        users: p.users,
        roles: p.roles,
        teams: p.teams,
        settings: p.settings,
      });
    } catch (e) {
      setStateRaw(emptyState());
      toast.error(errorText(e));
    }
  }, []);

  const applyServer = useCallback((r: { version: number; state?: ServerState | null }) => {
    version.current = r.version;
    if (r.state) {
      connecte.current = true;
      derniereActivite.current = Date.now();
      setStateRaw(r.state as AppState);
    }
  }, []);

  const sessionLost = useCallback(
    async (e: unknown) => {
      if (e instanceof ApiError && e.status === 401 && connecte.current) {
        connecte.current = false;
        version.current = null;
        setTeamFilter("all");
        toast.error(errorText(e));
        await loadPublic();
        return true;
      }
      return false;
    },
    [loadPublic],
  );

  /** Recharge tout l'état depuis le serveur (ou rien s'il n'a pas changé) */
  const resync = useCallback(
    async (force = false, auto = false) => {
      if (!connecte.current) return;
      try {
        const since = force || version.current === null ? "" : `?since=${version.current}`;
        const r = await api<{ version: number; state?: ServerState; unchanged?: boolean }>(
          "GET",
          `/state${since}`,
          undefined,
          { auto },
        );
        if (!r.unchanged && pending.current === 0) applyServer(r);
      } catch (e) {
        if (!(await sessionLost(e)) && force) toast.error(errorText(e));
      }
    },
    [applyServer, sessionLost],
  );

  // Démarrage : session encore ouverte (cookie) → données du serveur ; sinon écran de connexion
  useEffect(() => {
    (async () => {
      // anciennes données locales et ancien jeton (avant le serveur / avant le cookie HttpOnly)
      localStorage.removeItem("frere-mahjoub-erp-v1");
      localStorage.removeItem("frere-mahjoub-token");
      await loadPublic();
      try {
        applyServer(await api<{ version: number; state: ServerState }>("GET", "/state"));
      } catch {
        /* pas de session : écran de connexion */
      }
      setReady(true);
    })();
  }, [applyServer, loadPublic]);

  // Mise à jour automatique (opérations des autres postes) — ne prolonge pas la session
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible" && pending.current === 0) void resync(false, true);
    };
    const timer = setInterval(tick, POLL_MS);
    window.addEventListener("focus", tick);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", tick);
    };
  }, [resync]);

  /** Envoie une opération au serveur (une à la fois, dans l'ordre) */
  const failed = useRef(false);
  const send = useCallback(
    (name: string, args: unknown[]) => {
      pending.current += 1;
      queue.current = queue.current.then(async () => {
        try {
          const r = await api<OpResponse>("POST", `/ops/${name}`, {
            args,
            baseVersion: version.current,
          });
          version.current = r.version;
          if (r.state) acc.current = { full: r.state, patch: {} };
          else
            acc.current.patch = {
              ...acc.current.patch,
              ...(r.collections ?? {}),
              ...(r.seq !== undefined ? { seq: r.seq } : {}),
              ...(r.settings ? { settings: r.settings } : {}),
            };
        } catch (e) {
          // Refusé par le serveur (règle métier, droits, réseau) : message puis rechargement des vraies données
          if (!(await sessionLost(e))) {
            toast.error(errorText(e));
            failed.current = true;
          }
        } finally {
          pending.current -= 1;
          if (pending.current === 0) {
            const { full, patch } = acc.current;
            acc.current = { patch: {} };
            if (failed.current) {
              failed.current = false;
              await resync(true);
            } else if (full || Object.keys(patch).length) {
              setStateRaw((s) => ({
                ...(full ? (full as AppState) : s),
                ...patch,
                sessionUserId: full?.sessionUserId ?? s.sessionUserId,
              }));
            }
          }
        }
      });
    },
    [resync, sessionLost],
  );

  const me = state.users.find((u) => u.id === state.sessionUserId) ?? null;
  // noms affichés en français / en arabe selon la langue choisie (avant le rendu des pages)
  useMemo(
    () =>
      enregistrerNoms([
        ...state.clients,
        ...state.users,
        ...state.products,
        ...state.frigos,
        ...state.packagingTypes,
        ...state.roles,
        ...state.markets,
        ...state.teams,
      ]),
    [
      state.clients,
      state.users,
      state.products,
      state.frigos,
      state.packagingTypes,
      state.roles,
      state.markets,
      state.teams,
    ],
  );
  const perms = useMemo(
    () =>
      new Set(state.roles.filter((r) => me?.roleIds.includes(r.id)).flatMap((r) => r.permissions)),
    [state.roles, me],
  );
  const roleName = state.roles
    .filter((r) => me?.roleIds.includes(r.id))
    .map((r) => r.name)
    .join(", ");

  useEffect(() => {
    if (me?.teamId && !perms.has("administration")) setTeamFilter(me.teamId);
  }, [me?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const authenticate = useCallback(
    async (path: string, body: unknown) => {
      try {
        const r = await api<LoginResponse>("POST", path, body);
        if (r.etape === "totp-setup")
          setEtape({ type: "totp-setup", qr: r.qr ?? "", cle: r.cle ?? "", lien: r.lien ?? "" });
        else if (r.etape === "email") setEtape({ type: "email", email: r.email ?? "" });
        else if (r.etape === "totp" || r.etape === "pin" || r.etape === "pin-setup")
          setEtape({ type: r.etape });
        else if (r.state && r.version !== undefined) {
          setEtape(null);
          applyServer({ version: r.version, state: r.state });
        }
      } catch (e) {
        if (e instanceof ApiError && e.code === "APPAREIL_EN_ATTENTE") {
          setEtape({ type: "appareil", message: e.message });
          return;
        }
        const msg =
          e instanceof ApiError && e.status === 0
            ? NETWORK_MESSAGE
            : e instanceof ApiError
              ? e.message
              : "البريد الإلكتروني أو كلمة المرور غير صحيحة";
        toast.error(translate(msg));
      }
    },
    [applyServer],
  );

  /** 2e étape : code de l'application, PIN ou code reçu par email */
  const verifier = useCallback(
    async (v: { code?: string; pin?: string; pin2?: string }) => {
      try {
        const r = await api<{ version: number; state: ServerState }>("POST", "/auth/verifier", v);
        setEtape(null);
        applyServer(r);
        return true;
      } catch (e) {
        toast.error(errorText(e));
        // étape expirée ou trop d'erreurs : retour au mot de passe
        if (e instanceof ApiError && (e.code === "ETAPE" || e.code === "TROP")) setEtape(null);
        return false;
      }
    },
    [applyServer],
  );

  /** Déconnexion : le serveur ferme la session et efface le cookie */
  const fermerSession = useCallback(
    async (message?: string) => {
      connecte.current = false;
      version.current = null;
      setTeamFilter("all");
      setStateRaw((s) => ({ ...s, sessionUserId: null }));
      try {
        await api("POST", "/auth/logout");
      } catch {
        /* serveur injoignable : cookie expirera */
      }
      // les autres onglets ouverts effacent aussi leurs données (poste partagé)
      try {
        new BroadcastChannel(CANAL_SESSION).postMessage("deconnexion");
      } catch {
        /* navigateur sans BroadcastChannel */
      }
      if (message) toast.error(translate(message));
      await loadPublic();
    },
    [loadPublic],
  );

  // Déconnexion faite dans un autre onglet : effacer immédiatement les données affichées ici
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const canal = new BroadcastChannel(CANAL_SESSION);
    canal.onmessage = (e) => {
      if (e.data !== "deconnexion" || !connecte.current) return;
      connecte.current = false;
      version.current = null;
      setTeamFilter("all");
      setEtape(null);
      void loadPublic();
    };
    return () => canal.close();
  }, [loadPublic]);

  // Déconnexion automatique après inactivité (poste partagé, marché…)
  useEffect(() => {
    const actif = () => {
      derniereActivite.current = Date.now();
    };
    const evts = ["pointerdown", "keydown", "touchstart", "scroll"] as const;
    evts.forEach((e) => window.addEventListener(e, actif, { passive: true }));
    const timer = setInterval(() => {
      if (connecte.current && Date.now() - derniereActivite.current > idleMinutes.current * 60000) {
        void fermerSession("انتهت الجلسة بسبب عدم النشاط، يرجى تسجيل الدخول من جديد");
      }
    }, 20000);
    return () => {
      evts.forEach((e) => window.removeEventListener(e, actif));
      clearInterval(timer);
    };
  }, [fermerSession]);

  const value: Ctx = {
    state,
    ready,
    me,
    roleName,
    teamFilter,
    setTeamFilter,
    can: (p) => perms.has(p),
    readOnly: ops.isReadOnly(state, me),
    run: (op, ...args) => {
      if (ops.isReadOnly(state, me)) {
        toast.error(translate("حسابك للاطلاع فقط: لا يمكنك إضافة أو تعديل البيانات"));
        return false;
      }
      const name = OP_NAMES.get(op as never);
      if (!name) {
        toast.error(translate("تعذر تنفيذ العملية"));
        return false;
      }
      const exec = op as unknown as (s: AppState, ...a: unknown[]) => AppState;
      // contrôle des saisies (mêmes règles que le serveur) puis de la règle métier : la fenêtre reste ouverte en cas d'erreur
      const clean = (() => {
        try {
          const c = validateOp(state, name, args, deadlines.dateKey(new Date()));
          exec(state, ...c, state.sessionUserId ?? "system", new Date().toISOString());
          return c;
        } catch (e) {
          toast.error(errorText(e));
          return null;
        }
      })();
      if (!clean) return false;
      setStateRaw((s) => {
        try {
          return exec(s, ...clean, s.sessionUserId ?? "system", new Date().toISOString());
        } catch {
          return s;
        }
      });
      send(name, clean);
      return true;
    },
    // Retourne true tout de suite ; en cas d'échec le message d'erreur est affiché ici
    login: (email, password) => {
      void authenticate("/auth/login", { email: email.trim(), password });
      return true;
    },
    loginAs: (id) => {
      void authenticate("/auth/demo", { userId: id });
    },
    etape,
    verifier,
    renvoyerCode: () => {
      void (async () => {
        try {
          await api("POST", "/auth/renvoyer");
          toast.success(translate("أُرسل رمز جديد إلى بريدك"));
        } catch (e) {
          toast.error(errorText(e));
          if (e instanceof ApiError && (e.code === "ETAPE" || e.code === "TROP")) setEtape(null);
        }
      })();
    },
    annulerEtape: () => setEtape(null),
    changerMotDePasse: async (actuel, nouveau) => {
      try {
        applyServer(
          await api<{ version: number; state: ServerState }>("POST", "/auth/mot-de-passe", {
            actuel,
            nouveau,
          }),
        );
        toast.success(translate("تم تغيير كلمة المرور"));
        return true;
      } catch (e) {
        if (!(await sessionLost(e))) toast.error(errorText(e));
        return false;
      }
    },
    securite: async (userId, action, deviceId) => {
      try {
        applyServer(
          await api<{ version: number; state: ServerState }>("POST", "/admin/securite", {
            userId,
            action,
            deviceId,
          }),
        );
        return true;
      } catch (e) {
        if (!(await sessionLost(e))) toast.error(errorText(e));
        return false;
      }
    },
    emailDisponible,
    logout: () => fermerSession(),
    reset: () => {
      void (async () => {
        try {
          const r = await api<{ version: number; state: ServerState | null }>(
            "POST",
            "/admin/reset",
          );
          if (r.state) applyServer(r);
          else await fermerSession();
        } catch (e) {
          if (!(await sessionLost(e))) {
            toast.error(errorText(e));
            await resync(true);
          }
        }
      })();
    },
    setState: (fn) => {
      const prev = stateRef.current;
      const next = fn(prev);
      setStateRaw(next);
      // Seuls les paramètres de l'entreprise sont modifiés directement par une page (Paramètres)
      if (JSON.stringify(next.settings) !== JSON.stringify(prev.settings))
        send("saveSettings", [next.settings]);
    },
  };
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp outside AppProvider");
  return c;
}

// Lookup helpers
export function useLookups() {
  const { state } = useApp();
  return useMemo(() => {
    const m = <T extends { id: ID }>(a: T[]) => new Map(a.map((x) => [x.id, x]));
    return {
      client: m(state.clients),
      product: m(state.products),
      team: m(state.teams),
      frigo: m(state.frigos),
      user: m(state.users),
      saleStatus: m(state.saleStatuses),
      creditStatus: m(state.creditStatuses),
      pack: m(state.packagingTypes),
      sale: m(state.sales),
      market: m(state.markets ?? []),
    };
  }, [state]);
}

export function useTeamScope() {
  const { teamFilter } = useApp();
  return useCallback((teamId: ID) => teamFilter === "all" || teamFilter === teamId, [teamFilter]);
}
