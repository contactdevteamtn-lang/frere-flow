// Contrôle de toutes les saisies des formulaires.
// Utilisé par le site (store.run : message immédiat, la fenêtre reste ouverte)
// ET par le serveur (frere-flow-backend : impossible à contourner).
// Chaque règle nettoie la valeur (espaces, format) et ne garde que les champs connus.
import type { AppState, PermissionKey } from "@/types";
import { BusinessError, stockTotal } from "./ops";
import { dansCatalogue, normaliserNom, typeProduit, uniteProduit } from "./catalogue";

/** Messages (arabe ; traduction française dans src/lib/translations.ts). Chacun donne un exemple. */
export const V = {
  name: "الاسم غير صحيح: من 2 إلى 80 حرفاً، مثال: أحمد بن صالح",
  phone: "رقم الهاتف غير صحيح: 8 أرقام، مثال: 98 123 456",
  email: "البريد الإلكتروني غير صحيح، مثال: client@exemple.tn",
  emailRequired: "البريد الإلكتروني مطلوب، مثال: prenom@frere-mahjoub.tn",
  emailUsed: "البريد الإلكتروني مستخدم من قبل",
  taxId: "المعرف الجبائي غير صحيح، مثال: 1234567/A أو 1234567/A/M/000",
  address: "العنوان طويل جداً: 200 حرف كحد أقصى",
  text: "النص طويل جداً: 500 حرف كحد أقصى",
  formula: "لا يمكن أن يبدأ النص بالرموز = + @",
  reference: "المرجع غير صحيح: حروف وأرقام و - / فقط، 30 حرفاً كحد أقصى، مثال: BR-2026-001",
  productRef: "مرجع المنتج غير صحيح، مثال: PDT-008",
  refUsed: "هذا المرجع مستخدم من قبل",
  code: "الرمز غير صحيح: حروف لاتينية وأرقام فقط، مثال: FR4",
  codeUsed: "هذا الرمز مستخدم من قبل",
  amount: "المبلغ غير صحيح: رقم أكبر من 0 بثلاثة أرقام عشرية كحد أقصى، مثال: 125.500",
  paid: "المبلغ المدفوع غير صحيح: رقم موجب، مثال: 50.000",
  price: "السعر غير صحيح: رقم موجب بثلاثة أرقام عشرية كحد أقصى، مثال: 1.250",
  quantity: "الكمية غير صحيحة: رقم أكبر من 0، مثال: 25.5",
  adjust: "كمية التعديل غير صحيحة: رقم غير صفري، مثال: -12 أو 30",
  boxes: "عدد الصناديق غير صحيح: عدد صحيح موجب، مثال: 10",
  capacity: "السعة غير صحيحة: عدد صحيح بالكيلوغرام، مثال: 10000",
  threshold: "حد التنبيه غير صحيح: عدد صحيح موجب، مثال: 150",
  total: "العدد الإجمالي غير صحيح: عدد صحيح موجب، مثال: 500",
  date: "التاريخ غير صحيح، مثال: 2026-12-31",
  dueBeforeToday: "تاريخ الاستحقاق لا يمكن أن يكون قبل اليوم",
  days: "عدد الأيام غير صحيح: من 1 إلى 365، مثال: 30",
  reminderDays: "أيام التذكير غير صحيحة: من 0 إلى 365، مثال: 3",
  password: "كلمة المرور ضعيفة: 8 أحرف على الأقل مع حروف وأرقام، مثال: Ferme2026",
  passwordRequired: "كلمة المرور مطلوبة",
  category: "نوع المنتج غير صحيح: خضروات أو فواكه",
  unit: "وحدة البيع غير صحيحة: kg أو قطعة أو طن أو صندوق",
  nameUsed: "يوجد منتج بنفس الاسم وما زال في المخزون: عدّل المنتج الموجود بدل إنشاء منتج جديد",
  color: "اسم اللون غير صحيح، مثال: أحمر",
  hex: "رمز اللون غير صحيح، مثال: #2E7D32",
  description: "الوصف مطلوب: من 3 إلى 200 حرف، مثال: وقود الشاحنة",
  shortText: "النص طويل جداً: 200 حرف كحد أقصى",
  method: "طريقة الدفع غير صحيحة",
  type: "النوع غير صحيح",
  unknown: "عنصر غير موجود، أعد تحميل الصفحة",
  rows: "عدد الأسطر كبير جداً",
  roles: "اختر دوراً واحداً على الأقل",
  company: "اسم الشركة غير صحيح: من 2 إلى 120 حرفاً، مثال: شركة الإخوة محجوب",
  alert: "حد التنبيه غير صحيح: عدد صحيح من 0 إلى 100000، مثال: 40",
  city: "المدينة غير صحيحة: من 2 إلى 60 حرفاً، مثال: صفاقس",
  marketName: "اسم السوق غير صحيح: من 2 إلى 80 حرفاً، مثال: سوق صفاقس",
  roleName: "اسم الدور غير صحيح: من 2 إلى 50 حرفاً، مثال: محاسب",
  nameAlt: "الاسم باللغة الأخرى غير صحيح: من 2 إلى 80 حرفاً، مثال: Sami Haddad",
  permission: "صلاحية غير معروفة",
  invalid: "بيانات غير صالحة",
} as const;

const PERMS: PermissionKey[] = [
  "dashboard",
  "clients",
  "produits",
  "ventes",
  "credits",
  "paiements",
  "caisse",
  "stock",
  "frigos",
  "emballages",
  "equipes",
  "rapports",
  "administration",
  "historique",
  "parametres",
  "marches",
  "lecture",
];
const METHODS = ["ESPECES", "CHEQUE", "VIREMENT", "AUTRE"];
const MAX_AMOUNT = 10_000_000;
const MAX_QTY = 1_000_000;
const MAX_ROWS = 100;

type R = Record<string, unknown>;
const fail = (m: string): never => {
  throw new BusinessError(m);
};
const obj = (v: unknown): R =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as R) : fail(V.invalid);
const list = (v: unknown, max = MAX_ROWS): unknown[] =>
  Array.isArray(v) ? (v.length <= max ? v : fail(V.rows)) : fail(V.invalid);
const bool = (v: unknown) => v === true;

/* eslint-disable no-control-regex */
const INVISIBLES = new RegExp(
  "[\\u0000-\\u001F\\u007F\\u200B-\\u200F\\u202A-\\u202E\\u2066-\\u2069]",
  "g",
);
/* eslint-enable no-control-regex */

/** Texte nettoyé : espaces, caractères invisibles, longueur, pas de formule tableur (= + @) */
function text(
  v: unknown,
  { min = 0, max = 500, msg = V.text as string, noFormula = true } = {},
): string {
  if (v === undefined || v === null) v = "";
  if (typeof v !== "string" && typeof v !== "number") fail(msg);
  // caractères de contrôle et invisibles, écrits en codes \uXXXX (fichier 100 % ASCII)
  const s = String(v).normalize("NFC").replace(INVISIBLES, " ").replace(/\s+/g, " ").trim();
  if (s.length < min || s.length > max) fail(msg);
  if (noFormula && /^[=+@]/.test(s)) fail(V.formula);
  return s;
}
const personName = (v: unknown, max = 80, msg: string = V.name) => {
  const s = text(v, { min: 2, max, msg });
  if (!/\p{L}/u.test(s) || /[<>{}[\]\\|^`$]/.test(s)) fail(msg);
  return s;
};

/** Téléphone tunisien : 8 chiffres (2–9 en tête), +216 facultatif → « +216 98 123 456 » */
export function phone(v: unknown, required = false): string {
  const raw = text(v, { max: 25, msg: V.phone, noFormula: false });
  if (!raw) return required ? fail(V.phone) : "";
  let d = raw.replace(/[\s.\-()/]/g, "");
  if (d.startsWith("00216")) d = d.slice(5);
  else if (d.startsWith("+216")) d = d.slice(4);
  else if (d.startsWith("216") && d.length === 11) d = d.slice(3);
  if (!/^[2-9]\d{7}$/.test(d)) fail(V.phone);
  return `+216 ${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5)}`;
}

export function email(v: unknown, required = false): string {
  const s = text(v, { max: 120, msg: V.email, noFormula: false }).toLowerCase();
  if (!s) return required ? fail(V.emailRequired) : "";
  if (!/^[^\s@<>()[\]\\,;:"']+@[^\s@<>()[\]\\,;:"']+\.[^\s@<>()[\]\\,;:"'.]{2,}$/u.test(s))
    fail(V.email);
  return s;
}

/** Matricule fiscal tunisien : 1234567/A ou 1234567/A/M/000 (espaces et / facultatifs à la saisie) */
export function taxId(v: unknown): string {
  const s = text(v, { max: 25, msg: V.taxId }).toUpperCase().replace(/\s+/g, "");
  if (!s) return "";
  const m = /^(\d{7})\/?([A-Z])(?:\/?([ABDNP])\/?([CMNPE])\/?(\d{3}))?$/.exec(s);
  if (!m) return fail(V.taxId);
  return m[3] ? `${m[1]}/${m[2]}/${m[3]}/${m[4]}/${m[5]}` : `${m[1]}/${m[2]}`;
}

function num(
  v: unknown,
  msg: string,
  { min = 0, max = MAX_AMOUNT, minExclusive = false, integer = false, decimals = 3 } = {},
): number {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
  if (typeof n !== "number" || !Number.isFinite(n)) return fail(msg);
  if (minExclusive ? n <= min : n < min) fail(msg);
  if (n > max) fail(msg);
  if (integer && !Number.isInteger(n)) fail(msg);
  if (!integer && Math.abs(n * 10 ** decimals - Math.round(n * 10 ** decimals)) > 1e-6) fail(msg);
  return n;
}
const amount = (v: unknown) => num(v, V.amount, { min: 0, minExclusive: true });
const paid = (v: unknown) => num(v ?? 0, V.paid, { min: 0 });
const qty = (v: unknown) => num(v, V.quantity, { min: 0, minExclusive: true, max: MAX_QTY });
const boxCount = (v: unknown) => num(v ?? 0, V.boxes, { min: 0, max: 100_000, integer: true });

/** Date AAAA-MM-JJ valide entre 2000 et 2100 */
export function day(v: unknown, required = true): string {
  const s = text(v, { max: 10, msg: V.date });
  if (!s) return required ? fail(V.date) : "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return fail(V.date);
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (y < 2000 || y > 2100 || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) fail(V.date);
  return s;
}
const isoDate = (v: unknown, fallback: string) =>
  typeof v === "string" && !Number.isNaN(Date.parse(v)) && v.length <= 40 ? v : fallback;
const method = (v: unknown) =>
  METHODS.includes(String(v)) ? (String(v) as "ESPECES") : fail(V.method);
const oneOf = <T extends string>(v: unknown, values: readonly T[]): T =>
  values.includes(v as T) ? (v as T) : fail(V.type);
const reference = (v: unknown) => {
  const s = text(v, { max: 30, msg: V.reference });
  if (s && !/^[\p{L}\p{N}][\p{L}\p{N} \-_/.#]*$/u.test(s)) fail(V.reference);
  return s;
};
const code = (v: unknown, required = true) => {
  const s = text(v, { max: 10, msg: V.code }).toUpperCase().replace(/\s+/g, "");
  if (!s) return required ? fail(V.code) : "";
  if (!/^[A-Z0-9][A-Z0-9-]{0,9}$/.test(s)) fail(V.code);
  return s;
};

/** Identifiant existant dans une liste de l'état */
function ref<K extends keyof AppState>(
  s: AppState,
  key: K,
  id: unknown,
  { optional = false, active = false } = {},
): string {
  if (optional && (id === undefined || id === null || id === "")) return "";
  const items = s[key] as unknown as { id: string; active?: boolean }[];
  const x = typeof id === "string" ? items.find((i) => i.id === id) : undefined;
  if (!x || (active && x.active === false)) fail(V.unknown);
  return id as string;
}

/* ---------------- Référentiels (formulaires « upsert ») ---------------- */

function existing<K extends keyof AppState>(s: AppState, key: K, item: R) {
  if (item["id"] === undefined || item["id"] === "") return null;
  ref(s, key, item["id"]);
  return (s[key] as unknown as R[]).find((x) => x["id"] === item["id"]) as R;
}
const withId = (item: R, out: R) => (item["id"] ? { id: item["id"], ...out } : out);
function nextCode(used: string[], prefix: string, width: number) {
  const n = used.map((c) => Number(c.slice(prefix.length))).filter(Number.isFinite);
  return `${prefix}${String(Math.max(0, ...n) + 1).padStart(width, "0")}`;
}

/** Nom dans l'autre langue : facultatif, mêmes règles que le nom */
const nomAlt = (v: unknown) =>
  v === undefined || v === null || String(v).trim() === "" ? "" : personName(v, 80, V.nameAlt);

function client(s: AppState, item: R) {
  const old = existing(s, "clients", item);
  let c = text(item["code"] ?? old?.["code"] ?? "", { max: 12, msg: V.code }).toUpperCase();
  const others = s.clients.filter((x) => x.id !== item["id"]).map((x) => x.code);
  // code attribué automatiquement (CL-0001…) : jamais en double
  if (!c || others.includes(c))
    c =
      old && !others.includes(String(old["code"]))
        ? String(old["code"])
        : nextCode(
            others.filter((x) => x.startsWith("CL-")),
            "CL-",
            4,
          );
  if (!/^[A-Z0-9][A-Z0-9-]{1,11}$/.test(c)) fail(V.code);
  return withId(item, {
    code: c,
    name: personName(item["name"]),
    nameAlt: nomAlt(item["nameAlt"]),
    phone: phone(item["phone"]),
    address: text(item["address"], { max: 200, msg: V.address }),
    email: email(item["email"]),
    taxId: taxId(item["taxId"]),
    active: item["active"] === undefined ? true : bool(item["active"]),
    createdAt: isoDate(item["createdAt"] ?? old?.["createdAt"], new Date().toISOString()),
    ...(item["marketId"] || old?.["marketId"]
      ? { marketId: ref(s, "markets", item["marketId"] ?? old?.["marketId"]) }
      : {}),
  });
}

/** Produit (autre que lui-même) portant le même nom, en arabe ou en français */
function memeNom(s: AppState, p: { id: unknown; name: string; nameAlt?: string }) {
  const noms = [p.name, p.nameAlt].map(normaliserNom).filter(Boolean);
  return s.products.find(
    (x) =>
      x.id !== p.id && [x.name, x.nameAlt].map(normaliserNom).some((n) => n && noms.includes(n)),
  );
}

function product(s: AppState, item: R) {
  const old = existing(s, "products", item);
  const others = s.products
    .filter((x) => x.id !== item["id"])
    .map((x) => x.reference.toUpperCase());
  // Référence toujours attribuée par le système (jamais saisie) :
  //  - nouveau produit : PDT-001, PDT-002… (suivante libre, jamais en double)
  //  - modification : la référence existante est conservée (toute valeur envoyée est ignorée)
  const r = old
    ? String(old["reference"])
    : nextCode(
        others.filter((x) => /^PDT-\d+$/.test(x)),
        "PDT-",
        3,
      );
  // type strict (خضروات / فواكه) et unité de vente (kg, قطعة, طن, صندوق), alias acceptés (« légume », « pièce »…)
  const unit = uniteProduit(item["unit"] || "kg") ?? fail(V.unit);
  const name = personName(item["name"]);
  const nameAlt = nomAlt(item["nameAlt"]);
  // jamais deux produits du même nom (casse, espaces et variantes d'écriture ignorées, dans les deux langues)
  if (memeNom(s, { id: item["id"], name, nameAlt })) fail(V.nameUsed);
  return withId(item, {
    reference: r,
    name,
    nameAlt,
    // type donné : doit être « خضروات » ou « فواكه » ; type vide : d'après le catalogue
    category: item["category"]
      ? (typeProduit(item["category"]) ?? fail(V.category))
      : (dansCatalogue(name)?.type ?? fail(V.category)),
    unit,
    salePrice: num(item["salePrice"], V.price, { min: 0, minExclusive: true, max: 100_000 }),
    alertThreshold: num(item["alertThreshold"] ?? 0, V.threshold, {
      min: 0,
      max: MAX_QTY,
      integer: true,
    }),
    active: item["active"] === undefined ? true : bool(item["active"]),
  });
}

function frigo(s: AppState, item: R) {
  existing(s, "frigos", item);
  const c = code(item["code"], false);
  if (c && s.frigos.some((f) => f.id !== item["id"] && f.code.toUpperCase() === c))
    fail(V.codeUsed);
  return withId(item, {
    name: personName(item["name"], 60),
    nameAlt: nomAlt(item["nameAlt"]),
    code: c,
    capacity: num(item["capacity"], V.capacity, {
      min: 0,
      minExclusive: true,
      max: 10_000_000,
      integer: true,
    }),
    location: text(item["location"], { max: 120, msg: V.shortText }),
    description: text(item["description"], { max: 200, msg: V.shortText }),
    active: item["active"] === undefined ? true : bool(item["active"]),
  });
}

function packagingType(s: AppState, item: R) {
  const old = existing(s, "packagingTypes", item);
  const hex = text(item["hex"] || "#2E7D32", {
    max: 7,
    msg: V.hex,
    noFormula: false,
  }).toUpperCase();
  if (!/^#[0-9A-F]{6}$/.test(hex)) fail(V.hex);
  const color = text(item["color"], { max: 30, msg: V.color });
  if (color && !/\p{L}/u.test(color)) fail(V.color);
  return withId(item, {
    name: personName(item["name"], 60),
    nameAlt: nomAlt(item["nameAlt"]),
    color,
    hex,
    description: text(item["description"], { max: 200, msg: V.shortText }),
    totalAvailable: num(item["totalAvailable"], V.total, { min: 0, max: MAX_QTY, integer: true }),
    active: item["active"] === undefined ? true : bool(item["active"]),
    // « caisses du client » : fixé à la création (le changer fausserait les soldes)
    clientOwned: old ? !!old["clientOwned"] : bool(item["clientOwned"]),
  });
}

function team(s: AppState, item: R) {
  existing(s, "teams", item);
  const c = code(item["code"]);
  if (s.teams.some((t) => t.id !== item["id"] && t.code.toUpperCase() === c)) fail(V.codeUsed);
  return withId(item, {
    name: personName(item["name"], 60),
    nameAlt: nomAlt(item["nameAlt"]),
    code: c,
    description: text(item["description"], { max: 200, msg: V.shortText }),
    responsable: text(item["responsable"], { max: 80, msg: V.name }),
    active: item["active"] === undefined ? true : bool(item["active"]),
  });
}

/** Mot de passe : 8 à 72 caractères, au moins une lettre et un chiffre */
export function password(v: unknown): string {
  if (
    typeof v !== "string" ||
    v.length < 8 ||
    v.length > 72 ||
    !/\p{L}/u.test(v) ||
    !/\d/.test(v) ||
    /\s/.test(v)
  )
    fail(V.password);
  return v as string;
}

function user(s: AppState, item: R) {
  const old = existing(s, "users", item);
  const mail = email(item["email"], true);
  if (s.users.some((u) => u.id !== item["id"] && u.email.toLowerCase() === mail)) fail(V.emailUsed);
  const pwd = typeof item["password"] === "string" ? item["password"] : "";
  // Modification : vide = mot de passe inchangé
  if (!old && !pwd) fail(V.passwordRequired);
  const roleIds = list(item["roleIds"], 10).map((r) => ref(s, "roles", r));
  if (!roleIds.length) fail(V.roles);
  const teamId = ref(s, "teams", item["teamId"], { optional: true });
  return withId(item, {
    name: personName(item["name"]),
    nameAlt: nomAlt(item["nameAlt"]),
    email: mail,
    phone: phone(item["phone"]),
    password: pwd ? password(pwd) : "",
    active: item["active"] === undefined ? true : bool(item["active"]),
    createdAt: isoDate(item["createdAt"] ?? old?.["createdAt"], new Date().toISOString()),
    roleIds: [...new Set(roleIds)],
    // clé toujours présente : « aucune équipe » efface bien l'ancienne
    teamId: teamId || undefined,
    secMode: oneOf(item["secMode"] ?? old?.["secMode"] ?? "none", [
      "none",
      "totp",
      "pin",
      "email",
      "device",
    ] as const),
  });
}

function role(s: AppState, item: R) {
  existing(s, "roles", item);
  const perms = list(item["permissions"], 30).map((p) =>
    PERMS.includes(p as PermissionKey) ? (p as PermissionKey) : fail(V.permission),
  );
  return withId(item, {
    name: personName(item["name"], 50, V.roleName),
    nameAlt: nomAlt(item["nameAlt"]),
    description: text(item["description"], { max: 200, msg: V.shortText }),
    permissions: [...new Set(perms)],
  });
}

const COLLS = {
  clients: client,
  products: product,
  frigos: frigo,
  packagingTypes: packagingType,
  teams: team,
  users: user,
  roles: role,
};

/* ---------------- Opérations ---------------- */

const notes = (v: unknown) => text(v, { max: 500 });
const reason = (v: unknown) => text(v, { max: 200, msg: V.shortText });

function saleItems(s: AppState, v: unknown) {
  // lignes vides du formulaire (sans produit) ignorées ; produit choisi = quantité obligatoire
  return list(v)
    .map((x) => obj(x))
    .filter((x) => x["productId"])
    .map((x) => ({
      productId: ref(s, "products", x["productId"], { active: true }),
      quantity: qty(x["quantity"]),
      unitPrice: num(x["unitPrice"] ?? 0, V.price, { min: 0, max: 100_000 }),
      // frigo de la ligne (vente depuis les deux frigos : une facture par frigo)
      ...(x["frigoId"] ? { frigoId: ref(s, "frigos", x["frigoId"], { active: true }) } : {}),
    }));
}
function boxRows(s: AppState, v: unknown, key = "typeId") {
  return list(v ?? [])
    .map((x) => obj(x))
    .filter((x) => x[key] && Number(x["quantity"] ?? 0) !== 0)
    .map((x) => ({ [key]: ref(s, "packagingTypes", x[key]), quantity: boxCount(x["quantity"]) }));
}

export function validateSettings(v: unknown) {
  const x = obj(v);
  return {
    companyName: text(x["companyName"], { min: 2, max: 120, msg: V.company }),
    currency: "TND",
    defaultDueDays: num(x["defaultDueDays"], V.days, { min: 1, max: 365, integer: true }),
    packagingAlert: num(x["packagingAlert"], V.alert, { min: 0, max: 100_000, integer: true }),
    creditAlert: num(x["creditAlert"] ?? 1000, V.alert, { min: 0, max: 10_000_000 }),
  };
}

type Rule = (s: AppState, a: unknown[], today: string) => unknown[];
const RULES: Record<string, Rule> = {
  createSale: (s, [i], today) => {
    const x = obj(i);
    const due = day(x["dueDate"], false);
    if (due && due < today) fail(V.dueBeforeToday);
    // marketTripId n'est JAMAIS accepté ici (il désactiverait le contrôle du stock)
    return [
      {
        clientId: ref(s, "clients", x["clientId"], { active: true }),
        // équipe facultative : sinon celle du frigo de chaque facture (voir createSale)
        teamId: x["teamId"] ? ref(s, "teams", x["teamId"], { active: true }) : "",
        frigoId: ref(s, "frigos", x["frigoId"], { active: true }),
        items: saleItems(s, x["items"]),
        paid: paid(x["paid"]),
        method: method(x["method"]),
        notes: notes(x["notes"]),
        ...(due ? { dueDate: due } : {}),
        packaging: boxRows(s, x["packaging"]),
      },
    ];
  },
  cancelSale: (s, [id, r]) => [ref(s, "sales", id), reason(r)],
  setSaleStatus: (s, [id, st]) => [ref(s, "sales", id), ref(s, "saleStatuses", st)],
  editSale: (s, [id, i]) => {
    const x = obj(i);
    return [
      ref(s, "sales", id),
      {
        items: saleItems(s, x["items"]).map(({ productId, quantity, unitPrice }) => ({
          productId,
          quantity,
          unitPrice,
        })),
        ...(x["notes"] !== undefined ? { notes: notes(x["notes"]) } : {}),
      },
    ];
  },
  setInvoiceStatus: (s, [id, st, note]) => [
    ref(s, "invoices", id),
    oneOf(st, ["VALIDEE", "A_VOIR", "ANNULEE"] as const),
    reason(note),
  ],
  addCreditPayment: (s, [i]) => {
    const x = obj(i);
    return [
      {
        creditId: ref(s, "credits", x["creditId"]),
        amount: amount(x["amount"]),
        method: method(x["method"]),
        notes: notes(x["notes"]),
      },
    ];
  },
  payDeadline: (s, a, t) => RULES["addCreditPayment"]!(s, a, t),
  addManualCredit: (s, [i]) => {
    const x = obj(i);
    return [
      {
        clientId: ref(s, "clients", x["clientId"], { active: true }),
        teamId: ref(s, "teams", x["teamId"], { active: true }),
        amount: amount(x["amount"]),
        dueDate: day(x["dueDate"]),
        notes: notes(x["notes"]),
      },
    ];
  },
  setCreditStatus: (s, [id, st]) => [ref(s, "credits", id), ref(s, "creditStatuses", st)],
  addStockMovement: (s, [i]) => {
    const x = obj(i);
    const type = oneOf(x["movementType"], ["ENTREE", "SORTIE", "TRANSFERT", "AJUSTEMENT"] as const);
    const quantity =
      type === "AJUSTEMENT"
        ? num(x["quantity"], V.adjust, { min: -MAX_QTY, max: MAX_QTY })
        : qty(x["quantity"]);
    if (quantity === 0) fail(V.adjust);
    return [
      {
        productId: ref(s, "products", x["productId"]),
        frigoId: ref(s, "frigos", x["frigoId"], { active: true }),
        ...(type === "TRANSFERT"
          ? { toFrigoId: ref(s, "frigos", x["toFrigoId"], { active: true }) }
          : {}),
        quantity,
        movementType: type,
        reference: "", // attribuée automatiquement par l'opération
        notes: notes(x["notes"]),
      },
    ];
  },
  addPackMovement: (s, [i]) => {
    const x = obj(i);
    return [
      {
        clientId: ref(s, "clients", x["clientId"]),
        packagingTypeId: ref(s, "packagingTypes", x["packagingTypeId"]),
        teamId: ref(s, "teams", x["teamId"], { active: true }),
        type: oneOf(x["type"], ["SORTIE", "RETOUR"] as const),
        quantity: num(x["quantity"], V.boxes, { min: 1, max: 100_000, integer: true }),
        notes: notes(x["notes"]),
      },
    ];
  },
  addCash: (s, [i]) => {
    const x = obj(i);
    return [
      {
        teamId: ref(s, "teams", x["teamId"], { active: true }),
        type: oneOf(x["type"], ["ENCAISSEMENT", "DECAISSEMENT"] as const),
        method: method(x["method"]),
        amount: amount(x["amount"]),
        reference: "", // attribuée automatiquement par l'opération
        description: text(x["description"], { min: 3, max: 200, msg: V.description }),
      },
    ];
  },
  upsert: (s, [c, item]) => {
    const rule = COLLS[c as keyof typeof COLLS];
    if (!rule) fail(V.invalid);
    return [c, rule(s, obj(item))];
  },
  // produit + (facultatif) quantité entrée dans un frigo actif
  saveProduct: (s, [item, st]) => {
    let it = obj(item);
    // nouveau produit dont le nom existe déjà : si ce produit n'a plus de stock, le nouveau stock lui est
    // affecté (même produit, même référence) ; s'il a encore du stock, c'est un doublon → refusé
    if (!it["id"]) {
      const meme = memeNom(s, {
        id: undefined,
        name: String(it["name"] ?? ""),
        nameAlt: String(it["nameAlt"] ?? ""),
      });
      if (meme) {
        if (stockTotal(s, meme.id) > 0) fail(V.nameUsed);
        it = { ...it, id: meme.id, active: true };
      }
    }
    const p = product(s, it);
    if (st === null || st === undefined) return [p, null];
    const x = obj(st);
    if (
      x["quantity"] === undefined ||
      x["quantity"] === null ||
      x["quantity"] === "" ||
      x["quantity"] === 0
    )
      return [p, null];
    return [
      p,
      { frigoId: ref(s, "frigos", x["frigoId"], { active: true }), quantity: qty(x["quantity"]) },
    ];
  },
  remove: (s, [c, id]) => {
    if (!(String(c) in COLLS)) fail(V.invalid);
    return [c, ref(s, c as keyof typeof COLLS, id)];
  },
  saveMarket: (s, [i]) => {
    const x = obj(i);
    return [
      {
        ...(x["id"] ? { id: ref(s, "markets", x["id"]) } : {}),
        name: personName(x["name"], 80, V.marketName),
        nameAlt: nomAlt(x["nameAlt"]),
        city: personName(x["city"], 60, V.city),
      },
    ];
  },
  saveMarketClient: (s, [i]) => {
    const x = obj(i);
    return [
      {
        ...(x["id"] ? { id: ref(s, "clients", x["id"]) } : {}),
        marketId: ref(s, "markets", x["marketId"], { active: true }),
        name: personName(x["name"]),
        nameAlt: nomAlt(x["nameAlt"]),
        phone: phone(x["phone"]),
        address: text(x["address"], { max: 200, msg: V.address }),
      },
    ];
  },
  createMarketTrip: (s, [i]) => {
    const x = obj(i);
    const id = text(x["id"], { max: 40, msg: V.invalid });
    if (!/^trip_[a-z0-9]{4,30}$/.test(id) || s.marketTrips.some((t) => t.id === id))
      fail(V.invalid);
    const marketId = x["marketId"] ? ref(s, "markets", x["marketId"], { active: true }) : "";
    return [
      {
        id,
        marketId,
        ...(!marketId ? { newMarketName: personName(x["newMarketName"], 80, V.marketName) } : {}),
        teamId: ref(s, "teams", x["teamId"], { active: true }),
        loads: list(x["loads"])
          .map((l) => obj(l))
          .filter((l) => l["productId"])
          .map((l) => ({
            productId: ref(s, "products", l["productId"], { active: true }),
            frigoId: ref(s, "frigos", l["frigoId"], { active: true }),
            quantity: qty(l["quantity"]),
          })),
        boxes: boxRows(s, x["boxes"]),
        notes: notes(x["notes"]),
      },
    ];
  },
  createMarketSale: (s, [i]) => {
    const x = obj(i);
    return [
      {
        tripId: ref(s, "marketTrips", x["tripId"]),
        clientId: ref(s, "clients", x["clientId"], { active: true }),
        items: saleItems(s, x["items"]),
        boxes: boxRows(s, x["boxes"]),
        paid: paid(x["paid"]),
        method: method(x["method"]),
        notes: notes(x["notes"]),
      },
    ];
  },
  closeMarketTrip: (s, [i]) => {
    const x = obj(i);
    return [
      {
        tripId: ref(s, "marketTrips", x["tripId"]),
        returns: list(x["returns"])
          .map((r) => obj(r))
          .map((r) => ({
            productId: ref(s, "products", r["productId"]),
            quantity: num(r["quantity"] ?? 0, V.quantity, { min: 0, max: MAX_QTY }),
          })),
        boxesReturned: list(x["boxesReturned"])
          .map((b) => obj(b))
          .map((b) => ({
            typeId: ref(s, "packagingTypes", b["typeId"]),
            quantity: boxCount(b["quantity"]),
          })),
        cashCounted: paid(x["cashCounted"]),
        chequesCounted: paid(x["chequesCounted"]),
        notes: notes(x["notes"]),
      },
    ];
  },
  createDeadline: (s, [i]) => {
    const x = obj(i);
    return [
      {
        clientId: ref(s, "clients", x["clientId"], { active: true }),
        teamId: ref(s, "teams", x["teamId"], { active: true }),
        ...(x["frigoId"] ? { frigoId: ref(s, "frigos", x["frigoId"]) } : {}),
        ...(x["marketId"] ? { marketId: ref(s, "markets", x["marketId"]) } : {}),
        amount: amount(x["amount"]),
        dueDate: day(x["dueDate"]),
        reminderDays: num(x["reminderDays"] ?? 0, V.reminderDays, {
          min: 0,
          max: 365,
          integer: true,
        }),
        notes: notes(x["notes"]),
      },
    ];
  },
  updateDeadline: (s, [i]) => {
    const x = obj(i);
    return [
      {
        creditId: ref(s, "credits", x["creditId"]),
        dueDate: day(x["dueDate"]),
        amount: amount(x["amount"]),
        reminderDays: num(x["reminderDays"] ?? 0, V.reminderDays, {
          min: 0,
          max: 365,
          integer: true,
        }),
        notes: notes(x["notes"]),
        reason: reason(x["reason"]),
      },
    ];
  },
  markReminder: (s, [id]) => [ref(s, "credits", id)],
  cancelDeadline: (s, [id, r]) => [ref(s, "credits", id), reason(r)],
  saveSettings: (_s, [x]) => [validateSettings(x)],
};

/**
 * Vérifie et nettoie les arguments d'une opération.
 * @returns les arguments nettoyés (champs inconnus supprimés, formats normalisés)
 * @throws BusinessError avec un message qui contient un exemple
 */
export function validateOp(s: AppState, name: string, args: unknown[], today: string): unknown[] {
  const rule = RULES[name];
  if (!rule || !Array.isArray(args)) fail(V.invalid);
  return rule!(s, args, today);
}
