import { arToFr } from "@/lib/translit";
// Realistic Tunisian mock data, generated through the same business services
// so every sale/credit/payment/stock/packaging row is consistent.
import type { AppState, PaymentMethod } from "@/types";
import { addCreditPayment, addPackMovement, addStockMovement, createSale } from "@/services/ops";

export const ALL_PERMS = [
  "dashboard",
  "clients",
  "produits",
  "ventes",
  "marches",
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
  "lecture",
] as const;
/** Comptes présents dans toute installation (aussi en mode « propre ») */
export const STABLE_USER_IDS = ["u_super", "u_m", "u_l"] as const;
/** « lecture » restreint (consultation seule) : jamais donné au directeur général */
export const SUPER_PERMS = ALL_PERMS.filter((p) => p !== "lecture");
export const MARKET_ROLE = {
  id: "role_marche",
  name: "مسؤول السوق",
  description: "الأسواق فقط: الإرساليات، البيع، عملاء وديون السوق",
  permissions: ["marches"],
} as const;
export const READONLY_ROLE = {
  id: "role_lecture",
  name: "اطلاع فقط",
  description: "مشاهدة المبيعات والديون والمدفوعات والمخزون… دون أي تعديل",
  permissions: [
    "dashboard",
    "clients",
    "produits",
    "ventes",
    "marches",
    "credits",
    "paiements",
    "caisse",
    "stock",
    "frigos",
    "emballages",
    "equipes",
    "rapports",
    "historique",
    "lecture",
  ],
} as const;
export const CLIENT_BOX_TYPE = {
  id: "pkt_client",
  name: "صناديق العميل",
  color: "ملك العميل",
  hex: "#8D6E63",
  description: "صناديق يجلبها العميل: تُحسب لإرجاعها إليه لاحقاً",
  totalAvailable: 0,
  active: true,
  clientOwned: true,
} as const;

export function buildSeed(): AppState {
  let s: AppState = {
    seq: 0,
    sessionUserId: null,
    roles: [
      {
        id: "role_super",
        name: "المدير العام",
        description: "صلاحية كاملة لجميع الأقسام",
        permissions: [...SUPER_PERMS],
      },
      {
        id: "role_admin",
        name: "مدير",
        description: "إدارة العمليات اليومية",
        permissions: [
          "dashboard",
          "clients",
          "produits",
          "ventes",
          "marches",
          "credits",
          "paiements",
          "caisse",
          "stock",
          "frigos",
          "emballages",
          "equipes",
          "rapports",
        ],
      },
      {
        id: "role_emp",
        name: "موظف",
        description: "صلاحيات تشغيلية محدودة",
        permissions: [
          "dashboard",
          "clients",
          "ventes",
          "marches",
          "paiements",
          "emballages",
          "produits",
          "stock",
        ],
      },
      { ...MARKET_ROLE, permissions: [...MARKET_ROLE.permissions] },
      { ...READONLY_ROLE, permissions: [...READONLY_ROLE.permissions] },
    ],
    // 3 comptes stables (identiques à chaque installation, à changer ensuite par le client) + comptes de démonstration
    users: [
      {
        id: "u_super",
        name: "محجوب بن محجوب",
        email: "direction@frere-mahjoub.tn",
        phone: "+216 74 400 100",
        password: "Direction2026",
        active: true,
        createdAt: "2025-01-05",
        roleIds: ["role_super"],
        secMode: "none",
        passwordInitial: true,
      },
      {
        id: "u_m",
        name: "سامي الحداد",
        email: "marche@frere-mahjoub.tn",
        phone: "+216 50 220 118",
        password: "Marche2026",
        active: true,
        createdAt: "2025-04-01",
        roleIds: ["role_marche"],
        secMode: "none",
        passwordInitial: true,
      },
      {
        id: "u_l",
        name: "ليلى المحجوب",
        email: "consultation@frere-mahjoub.tn",
        phone: "+216 29 640 512",
        password: "Consultation2026",
        active: true,
        createdAt: "2025-04-01",
        roleIds: ["role_lecture"],
        secMode: "none",
        passwordInitial: true,
      },
      {
        id: "u_admin",
        name: "نادية محجوب",
        email: "admin@frere-mahjoub.tn",
        phone: "+216 98 300 200",
        password: "Demo2026",
        active: true,
        createdAt: "2025-02-11",
        roleIds: ["role_admin"],
        secMode: "none",
        passwordInitial: true,
      },
      {
        id: "u_x",
        name: "وليد كمون",
        email: "walid@frere-mahjoub.tn",
        phone: "+216 22 110 330",
        password: "Demo2026",
        active: true,
        createdAt: "2025-03-01",
        roleIds: ["role_emp"],
        teamId: "team_1",
        secMode: "none",
        passwordInitial: true,
      },
      {
        id: "u_y",
        name: "رياض شعبان",
        email: "riadh@frere-mahjoub.tn",
        phone: "+216 55 870 441",
        password: "Demo2026",
        active: true,
        createdAt: "2025-03-01",
        roleIds: ["role_emp"],
        teamId: "team_2",
        secMode: "none",
        passwordInitial: true,
      },
    ],
    teams: [
      {
        id: "team_1",
        name: "فيغو 1",
        code: "F1",
        description: "الفريق التجاري الأول",
        responsable: "وليد كمون",
        active: true,
      },
      {
        id: "team_2",
        name: "فيغو 2",
        code: "F2",
        description: "الفريق التجاري الثاني",
        responsable: "رياض شعبان",
        active: true,
      },
    ],
    clients: [
      ["أحمد بن صالح", "+216 98 123 456", "مدينة صفاقس", "1234567/A"],
      ["محمد الطرابلسي", "+216 22 456 789", "ساقية الزيت، صفاقس", "2345678/B"],
      ["يوسف الجلاصي", "+216 55 987 321", "المحرس", "3456789/C"],
      ["سامي بن عمر", "+216 97 654 120", "عقارب", "4567890/D"],
      ["حاتم الغربي", "+216 26 300 412", "سوق الجملة، تونس", "5678901/E"],
      ["شركة الإخوة حمدي", "+216 74 220 110", "صفاقس الجنوبية", "6789012/F"],
      ["ليلى المنصوري", "+216 50 741 963", "قابس", "7890123/G"],
    ].map(([name, phone, address, taxId], i) => ({
      id: `cli_${i + 1}`,
      code: `CL-${String(i + 1).padStart(4, "0")}`,
      name,
      phone,
      address,
      email: `${arToFr(name.split(" ")[0]!)
        .normalize("NFD")
        .replace(/[^A-Za-z]/g, "")
        .toLowerCase()}@mail.tn`,
      taxId,
      active: true,
      createdAt: `2025-0${(i % 8) + 1}-1${i}`,
    })),
    products: [
      ["PDT-001", "بطاطا", "خضروات", 1.2],
      ["PDT-002", "جزر", "خضروات", 1.1],
      ["PDT-003", "بصل", "خضروات", 0.9],
      ["PDT-004", "طماطم", "خضروات", 1.5],
      ["PDT-005", "فلفل", "خضروات", 2.2],
      ["PDT-006", "تفاح", "فواكه", 3.8],
      ["PDT-007", "برتقال مالطي", "فواكه", 2.5],
    ].map(([reference, name, category, salePrice], i) => ({
      id: `prd_${i + 1}`,
      reference: String(reference),
      name: String(name),
      category: String(category),
      unit: "kg",
      salePrice: Number(salePrice),
      alertThreshold: 150,
      active: true,
    })),
    frigos: [
      {
        id: "frg_1",
        name: "غرفة تبريد فوزي",
        nameAlt: "Frigo Fawzi",
        code: "FR1",
        capacity: 20000,
        location: "المنطقة الصناعية، صفاقس",
        description: "غرفة التبريد الرئيسية",
        active: true,
      },
      {
        id: "frg_2",
        name: "غرفة تبريد حسام",
        nameAlt: "Frigo Houssem",
        code: "FR2",
        capacity: 12000,
        location: "طريق قابس كلم 4",
        description: "الخضروات الجذرية",
        active: true,
      },
    ],
    stockMovements: [],
    saleStatuses: [
      { id: "ss_pending", code: "PENDING", label: "قيد الانتظار" },
      { id: "ss_confirmed", code: "CONFIRMED", label: "مؤكدة" },
      { id: "ss_paid", code: "PAID", label: "مدفوعة" },
      { id: "ss_partial", code: "PARTIAL", label: "مدفوعة جزئياً" },
      { id: "ss_cancelled", code: "CANCELLED", label: "ملغاة" },
    ],
    creditStatuses: [
      { id: "cs_active", code: "ACTIVE", label: "نشط" },
      { id: "cs_partial", code: "PARTIAL", label: "مدفوع جزئياً" },
      { id: "cs_paid", code: "PAID", label: "المدفوع" },
      { id: "cs_overdue", code: "OVERDUE", label: "متأخر" },
      { id: "cs_cancelled", code: "CANCELLED", label: "ملغى" },
    ],
    markets: [
      { id: "mkt_sousse", name: "سوق سوسة", city: "سوسة", active: true },
      { id: "mkt_mahdia", name: "سوق المهدية", city: "المهدية", active: true },
      { id: "mkt_monastir", name: "سوق المنستير", city: "المنستير", active: true },
    ],
    marketTrips: [],
    sales: [],
    saleItems: [],
    payments: [],
    credits: [],
    creditPayments: [],
    cash: [],
    packagingTypes: [
      {
        id: "pkt_1",
        name: "صندوق أحمر",
        color: "أحمر",
        hex: "#C62828",
        description: "صندوق بلاستيكي 20 كغ",
        totalAvailable: 1500,
        active: true,
      },
      {
        id: "pkt_2",
        name: "صندوق أخضر",
        color: "أخضر",
        hex: "#2E7D32",
        description: "صندوق بلاستيكي 25 كغ",
        totalAvailable: 1200,
        active: true,
      },
      {
        id: "pkt_3",
        name: "صندوق أزرق",
        color: "أزرق",
        hex: "#1565C0",
        description: "صندوق بلاستيكي 15 كغ",
        totalAvailable: 800,
        active: true,
      },
      {
        id: "pkt_4",
        name: "صندوق أصفر",
        color: "أصفر",
        hex: "#F9A825",
        description: "صندوق فواكه 10 كغ",
        totalAvailable: 600,
        active: true,
      },
      { ...CLIENT_BOX_TYPE },
    ],
    packagingMovements: [],
    auditLogs: [],
    settings: {
      companyName: "شركة الإخوة محجوب",
      currency: "TND",
      defaultDueDays: 30,
      packagingAlert: 40,
    },
  };

  // Deterministic PRNG
  let r = 42;
  const rnd = () => (r = (r * 1103515245 + 12345) % 2147483648) / 2147483648;
  const pick = <T>(a: T[]) => a[Math.floor(rnd() * a.length)];
  const day = (offset: number) =>
    new Date(Date.UTC(2026, 9, 8, 9 + Math.floor(rnd() * 8)) - offset * 864e5).toISOString();

  // Initial stock entries per frigo
  const base = [6000, 3500, 2000];
  s.products.forEach((p, pi) =>
    s.frigos.forEach((f, fi) => {
      s = addStockMovement(
        s,
        {
          productId: p.id,
          frigoId: f.id,
          quantity: Math.round((base[fi] * (0.4 + rnd() * 0.6)) / ((pi % 3) + 1)),
          movementType: "ENTREE",
          reference: `BR-${100 + pi * 3 + fi}`,
          notes: "استلام المحصول",
        },
        "u_admin",
        day(190),
      );
    }),
  );
  s = addStockMovement(
    s,
    {
      productId: "prd_1",
      frigoId: "frg_1",
      toFrigoId: "frg_2",
      quantity: 300,
      movementType: "TRANSFERT",
      reference: "TR-001",
      notes: "إعادة توزيع",
    },
    "u_admin",
    day(60),
  );

  const ourTypes = s.packagingTypes.filter((t) => !t.clientOwned);
  const methods: PaymentMethod[] = ["ESPECES", "ESPECES", "ESPECES", "CHEQUE", "VIREMENT"];
  for (let i = 0; i < 46; i++) {
    const offset = 180 - Math.floor(i * 3.9) - Math.floor(rnd() * 3);
    const teamId = i % 2 ? "team_2" : "team_1";
    const userId = teamId === "team_1" ? "u_x" : "u_y";
    const client = pick(s.clients);
    const frigoId = pick(s.frigos).id;
    const lines = Array.from({ length: 1 + Math.floor(rnd() * 3) }, () => {
      const p = pick(s.products);
      return {
        productId: p.id,
        quantity: 20 + Math.floor(rnd() * 12) * 10,
        unitPrice: p.salePrice,
      };
    });
    const total = lines.reduce((a, l) => a + l.quantity * l.unitPrice, 0);
    const mode = rnd();
    const paid = mode < 0.5 ? total : mode < 0.82 ? Math.round(total * (0.3 + rnd() * 0.4)) : 0;
    const date = day(Math.max(offset, 0));
    try {
      s = createSale(
        s,
        {
          clientId: client.id,
          teamId,
          frigoId,
          items: lines,
          paid,
          method: pick(methods),
          notes: "",
          packaging:
            rnd() < 0.7
              ? [{ typeId: pick(ourTypes).id, quantity: 5 + Math.floor(rnd() * 20) }]
              : [],
          dueDate: new Date(new Date(date).getTime() + 30 * 864e5).toISOString().slice(0, 10),
        },
        userId,
        date,
      );
    } catch {
      /* skip if stock insufficient */
    }
  }
  // Some credit repayments and packaging returns
  for (const c of [...s.credits].reverse().slice(0, 12)) {
    const amount = Math.round(c.remainingAmount * (rnd() < 0.4 ? 1 : 0.5) * 1000) / 1000;
    const created = new Date(c.createdAt).getTime();
    const d = new Date(Math.min(created + 15 * 864e5, Date.UTC(2026, 9, 8))).toISOString();
    if (amount > 0)
      s = addCreditPayment(
        s,
        { creditId: c.id, amount, method: "ESPECES", notes: "دفعة" },
        c.teamId === "team_1" ? "u_x" : "u_y",
        d,
      );
  }
  for (const m of [...s.packagingMovements].reverse().slice(0, 18)) {
    if (m.type !== "SORTIE") continue;
    const d = new Date(
      Math.min(new Date(m.date).getTime() + 7 * 864e5, Date.UTC(2026, 9, 8)),
    ).toISOString();
    try {
      s = addPackMovement(
        s,
        {
          clientId: m.clientId,
          packagingTypeId: m.packagingTypeId,
          teamId: m.teamId,
          type: "RETOUR",
          quantity: Math.ceil(m.quantity * 0.6),
          notes: "مرتجع العميل",
        },
        "u_x",
        d,
      );
    } catch {
      /* ignore */
    }
  }
  // Caisses appartenant aux clients, gardées chez nous
  for (const [ci, q] of [
    [0, 12],
    [2, 8],
  ] as const) {
    const c = s.clients[ci];
    if (c)
      s = addPackMovement(
        s,
        {
          clientId: c.id,
          packagingTypeId: CLIENT_BOX_TYPE.id,
          teamId: ci ? "team_2" : "team_1",
          type: "RETOUR",
          quantity: q,
          notes: "صناديق العميل",
        },
        "u_admin",
        day(5),
      );
  }
  // Clients des marchés (séparés des clients normaux)
  (
    [
      ["mkt_sousse", "عادل الصغير", "+216 97 410 220", "سوق سوسة"],
      ["mkt_sousse", "منير القاسمي", "+216 24 118 903", "سوق سوسة"],
      ["mkt_mahdia", "حمدي بن عمر", "+216 53 707 641", "سوق المهدية"],
    ] as const
  ).forEach(([marketId, name, phone, address], i) =>
    s.clients.push({
      id: `mc_${i + 1}`,
      marketId,
      code: `MC-${i + 1}`,
      name,
      phone,
      address,
      email: "",
      taxId: "",
      active: true,
      createdAt: "2025-05-01",
    }),
  );
  // Sort chronological lists descending
  const desc = (
    a: { date?: string; saleDate?: string; paymentDate?: string; createdAt?: string },
    b: typeof a,
  ) =>
    String(b.date ?? b.saleDate ?? b.paymentDate ?? b.createdAt).localeCompare(
      String(a.date ?? a.saleDate ?? a.paymentDate ?? a.createdAt),
    );
  s.sales.sort(desc);
  s.credits.sort(desc);
  s.payments.sort(desc);
  s.creditPayments.sort(desc);
  s.cash.sort(desc);
  s.packagingMovements.sort(desc);
  s.stockMovements.sort(desc);
  s.auditLogs.sort(desc);
  return s;
}
