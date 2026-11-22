// Business services: pure functions (state, input) => new state.
// When a real API exists, each function maps to one endpoint.
import type { AppState, ID, PaymentMethod, StockMovementType, Credit } from "@/types";

export class BusinessError extends Error {}

export const nextId = (s: AppState, p: string) => `${p}_${(++s.seq).toString(36)}`;
const round = (n: number) => Math.round(n * 1000) / 1000;

export const saleStatusId = (s: AppState, code: string) =>
  s.saleStatuses.find((x) => x.code === code)!.id;
export const creditStatusId = (s: AppState, code: string) =>
  s.creditStatuses.find((x) => x.code === code)!.id;

function audit(
  s: AppState,
  userId: ID,
  action: string,
  entity: string,
  entityId: ID | undefined,
  details: string,
  date: string,
) {
  s.auditLogs.unshift({ id: nextId(s, "log"), userId, action, entity, entityId, details, date });
}

// ---------- Selectors ----------
export function stockOf(s: AppState, productId: ID, frigoId: ID) {
  let q = 0;
  for (const m of s.stockMovements) {
    if (m.productId !== productId) continue;
    if (m.movementType === "ENTREE" && m.frigoId === frigoId) q += m.quantity;
    if (m.movementType === "SORTIE" && m.frigoId === frigoId) q -= m.quantity;
    if (m.movementType === "AJUSTEMENT" && m.frigoId === frigoId) q += m.quantity;
    if (m.movementType === "TRANSFERT") {
      if (m.frigoId === frigoId) q -= m.quantity;
      if (m.toFrigoId === frigoId) q += m.quantity;
    }
  }
  return round(q);
}
export const stockTotal = (s: AppState, productId: ID) =>
  round(s.frigos.reduce((a, f) => a + stockOf(s, productId, f.id), 0));

/** Nos caisses (hors caisses appartenant aux clients) : sorties − retours = chez le client */
export function packBalance(s: AppState, f: { clientId?: ID; typeId?: ID; teamId?: ID }) {
  let given = 0,
    returned = 0;
  const own = clientBoxTypeIds(s);
  for (const m of s.packagingMovements) {
    if (own.has(m.packagingTypeId)) continue;
    if (f.clientId && m.clientId !== f.clientId) continue;
    if (f.typeId && m.packagingTypeId !== f.typeId) continue;
    if (f.teamId && m.teamId !== f.teamId) continue;
    if (m.type === "SORTIE") given += m.quantity;
    else returned += m.quantity;
  }
  return { given, returned, remaining: given - returned };
}

export const clientBoxTypeIds = (s: AppState) =>
  new Set(s.packagingTypes.filter((t) => t.clientOwned).map((t) => t.id));
export const isClientBoxType = (s: AppState, typeId: ID) =>
  !!s.packagingTypes.find((t) => t.id === typeId)?.clientOwned;

/** Caisses du client gardées chez nous : reçues − rendues = à lui rendre */
export function clientBoxBalance(s: AppState, f: { clientId?: ID; teamId?: ID }) {
  let received = 0,
    returned = 0;
  const own = clientBoxTypeIds(s);
  for (const m of s.packagingMovements) {
    if (!own.has(m.packagingTypeId)) continue;
    if (f.clientId && m.clientId !== f.clientId) continue;
    if (f.teamId && m.teamId !== f.teamId) continue;
    if (m.type === "RETOUR") received += m.quantity;
    else returned += m.quantity;
  }
  return { received, returned, owed: received - returned };
}

/** Client d'un marché : ses ventes et ses dettes restent dans la section Marchés */
export const isMarketClient = (s: AppState, clientId: ID) =>
  !!s.clients.find((c) => c.id === clientId)?.marketId;
export function isMarketCredit(s: AppState, c: Credit) {
  if (c.marketId || isMarketClient(s, c.clientId)) return true;
  return !!(c.saleId && s.sales.find((x) => x.id === c.saleId)?.marketTripId);
}
export const isMarketSale = (s: AppState, sale: { marketTripId?: ID; clientId: ID }) =>
  !!sale.marketTripId || isMarketClient(s, sale.clientId);

/** Compte « consultation seule » : tous ses rôles portent la permission « lecture » */
export function isReadOnly(s: AppState, user: { roleIds: ID[] } | null | undefined) {
  const roles = s.roles.filter((r) => user?.roleIds.includes(r.id));
  return roles.length > 0 && roles.every((r) => r.permissions.includes("lecture"));
}

export function effectiveCreditCode(s: AppState, c: Credit, today: string) {
  const code = s.creditStatuses.find((x) => x.id === c.creditStatusId)?.code ?? "ACTIVE";
  if ((code === "ACTIVE" || code === "PARTIAL") && c.dueDate < today.slice(0, 10)) return "OVERDUE";
  return code;
}

// ---------- Sales ----------
export interface SaleInput {
  clientId: ID;
  teamId: ID;
  frigoId: ID;
  items: { productId: ID; quantity: number; unitPrice: number }[];
  paid: number;
  method: PaymentMethod;
  notes: string;
  dueDate?: string;
  packaging: { typeId: ID; quantity: number }[];
  marketTripId?: ID;
}

export function createSale(prev: AppState, inp: SaleInput, userId: ID, date: string): AppState {
  const s = structuredClone(prev);
  const items = inp.items.filter((i) => i.productId && i.quantity > 0);
  if (!inp.clientId || !inp.teamId || !inp.frigoId)
    throw new BusinessError("العميل وفريق فيغو وغرفة التبريد مطلوبة");
  if (!items.length) throw new BusinessError("أضف منتجاً واحداً على الأقل");
  if (!inp.marketTripId && isMarketClient(s, inp.clientId))
    throw new BusinessError("هذا العميل تابع لسوق: سجّل البيع من قسم الأسواق");
  const need = new Map<ID, number>();
  items.forEach((i) => need.set(i.productId, (need.get(i.productId) ?? 0) + i.quantity));
  for (const [pid, q] of need) {
    if (inp.marketTripId) break;
    const av = stockOf(s, pid, inp.frigoId);
    if (av < q) {
      const p = s.products.find((x) => x.id === pid);
      throw new BusinessError(
        `مخزون غير كافٍ للمنتج ${p?.name} (${av} ${p?.unit} متوفرة في غرفة التبريد)`,
      );
    }
  }
  const total = round(items.reduce((a, i) => a + i.quantity * i.unitPrice, 0));
  const paid = round(Math.min(Math.max(inp.paid || 0, 0), total));
  const remaining = round(total - paid);
  const id = nextId(s, "sale");
  const number = `FM-${date.slice(0, 4)}-${String(s.sales.length + 1).padStart(4, "0")}`;
  const statusCode = remaining === 0 ? "PAID" : paid > 0 ? "PARTIAL" : "PENDING";
  s.sales.unshift({
    id,
    ...(inp.marketTripId ? { marketTripId: inp.marketTripId } : {}),
    number,
    clientId: inp.clientId,
    teamId: inp.teamId,
    frigoId: inp.frigoId,
    userId,
    saleStatusId: saleStatusId(s, statusCode),
    saleDate: date,
    totalAmount: total,
    paidAmount: paid,
    remainingAmount: remaining,
    paymentType: inp.method,
    notes: inp.notes,
  });
  for (const i of items) {
    s.saleItems.push({
      id: nextId(s, "si"),
      saleId: id,
      productId: i.productId,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      total: round(i.quantity * i.unitPrice),
    });
    if (!inp.marketTripId)
      s.stockMovements.unshift({
        id: nextId(s, "mv"),
        productId: i.productId,
        frigoId: inp.frigoId,
        quantity: i.quantity,
        movementType: "SORTIE",
        date,
        userId,
        reference: number,
        notes: "عملية بيع",
      });
  }
  if (paid > 0) {
    s.payments.unshift({
      id: nextId(s, "pay"),
      saleId: id,
      clientId: inp.clientId,
      teamId: inp.teamId,
      userId,
      amount: paid,
      paymentDate: date,
      paymentMethod: inp.method,
    });
    s.cash.unshift({
      id: nextId(s, "cash"),
      teamId: inp.teamId,
      userId,
      type: "ENCAISSEMENT",
      method: inp.method,
      amount: paid,
      reference: number,
      date,
      description: "دفعة بيع",
    });
  }
  if (remaining > 0) {
    const due =
      inp.dueDate ||
      new Date(new Date(date).getTime() + s.settings.defaultDueDays * 864e5)
        .toISOString()
        .slice(0, 10);
    s.credits.unshift({
      id: nextId(s, "cr"),
      clientId: inp.clientId,
      teamId: inp.teamId,
      saleId: id,
      creditStatusId: creditStatusId(s, paid > 0 ? "PARTIAL" : "ACTIVE"),
      totalAmount: remaining,
      paidAmount: 0,
      remainingAmount: remaining,
      dueDate: due,
      createdAt: date,
    });
  }
  for (const pk of inp.packaging.filter((p) => p.typeId && p.quantity > 0)) {
    // Caisses du client : reçues (à lui rendre) ; nos caisses : sorties (à nous rendre)
    const own = isClientBoxType(s, pk.typeId);
    s.packagingMovements.unshift({
      id: nextId(s, "pk"),
      clientId: inp.clientId,
      packagingTypeId: pk.typeId,
      teamId: inp.teamId,
      saleId: id,
      type: own ? "RETOUR" : "SORTIE",
      quantity: pk.quantity,
      date,
      userId,
      notes: own ? `صناديق العميل — عملية بيع ${number}` : `عملية بيع ${number}`,
    });
  }
  audit(
    s,
    userId,
    "إنشاء عملية بيع",
    "عملية بيع",
    id,
    `${number} — الإجمالي ${total} TND, المدفوع ${paid} TND`,
    date,
  );
  return s;
}

export function cancelSale(
  prev: AppState,
  saleId: ID,
  reason: string,
  userId: ID,
  date: string,
): AppState {
  const s = structuredClone(prev);
  const sale = s.sales.find((x) => x.id === saleId)!;
  if (sale.saleStatusId === saleStatusId(s, "CANCELLED")) return prev;
  sale.saleStatusId = saleStatusId(s, "CANCELLED");
  for (const it of s.saleItems.filter((i) => i.saleId === saleId)) {
    s.stockMovements.unshift({
      id: nextId(s, "mv"),
      productId: it.productId,
      frigoId: sale.frigoId,
      quantity: it.quantity,
      movementType: "ENTREE",
      date,
      userId,
      reference: sale.number,
      notes: "إلغاء بيع — إعادة المخزون",
    });
  }
  for (const c of s.credits.filter((c) => c.saleId === saleId))
    c.creditStatusId = creditStatusId(s, "CANCELLED");
  const refunded =
    s.payments.filter((p) => p.saleId === saleId).reduce((a, p) => a + p.amount, 0) +
    s.creditPayments
      .filter((cp) => s.credits.find((c) => c.id === cp.creditId)?.saleId === saleId)
      .reduce((a, p) => a + p.amount, 0);
  if (refunded > 0)
    s.cash.unshift({
      id: nextId(s, "cash"),
      teamId: sale.teamId,
      userId,
      type: "DECAISSEMENT",
      method: "ESPECES",
      amount: round(refunded),
      reference: sale.number,
      date,
      description: "إرجاع مبلغ بيع ملغى",
    });
  audit(
    s,
    userId,
    "إلغاء عملية بيع",
    "عملية بيع",
    saleId,
    `${sale.number} — ${reason || "بدون سبب"}`,
    date,
  );
  return s;
}

export function setSaleStatus(
  prev: AppState,
  saleId: ID,
  statusId: ID,
  userId: ID,
  date: string,
): AppState {
  const s = structuredClone(prev);
  const sale = s.sales.find((x) => x.id === saleId)!;
  const old = s.saleStatuses.find((x) => x.id === sale.saleStatusId)?.label;
  sale.saleStatusId = statusId;
  audit(
    s,
    userId,
    "تغيير حالة البيع",
    "عملية بيع",
    saleId,
    `${sale.number}: ${old} → ${s.saleStatuses.find((x) => x.id === statusId)?.label}`,
    date,
  );
  return s;
}

// ---------- Credits ----------
export function addCreditPayment(
  prev: AppState,
  inp: { creditId: ID; amount: number; method: PaymentMethod; notes: string },
  userId: ID,
  date: string,
): AppState {
  const s = structuredClone(prev);
  const c = s.credits.find((x) => x.id === inp.creditId);
  if (!c) throw new BusinessError("الدين غير موجود");
  const amount = round(inp.amount);
  if (!(amount > 0)) throw new BusinessError("المبلغ غير صالح");
  if (amount > c.remainingAmount + 1e-9)
    throw new BusinessError(`المبلغ يتجاوز المتبقي للسداد (${c.remainingAmount} TND)`);
  c.paidAmount = round(c.paidAmount + amount);
  c.remainingAmount = round(c.remainingAmount - amount);
  c.creditStatusId = creditStatusId(s, c.remainingAmount === 0 ? "PAID" : "PARTIAL");
  s.creditPayments.unshift({
    id: nextId(s, "cp"),
    creditId: c.id,
    clientId: c.clientId,
    teamId: c.teamId,
    userId,
    amount,
    paymentDate: date,
    paymentMethod: inp.method,
    notes: inp.notes,
  });
  if (c.saleId) {
    const sale = s.sales.find((x) => x.id === c.saleId);
    if (sale) {
      sale.paidAmount = round(sale.paidAmount + amount);
      sale.remainingAmount = round(sale.remainingAmount - amount);
      sale.saleStatusId = saleStatusId(s, sale.remainingAmount === 0 ? "PAID" : "PARTIAL");
    }
  }
  s.cash.unshift({
    id: nextId(s, "cash"),
    teamId: c.teamId,
    userId,
    type: "ENCAISSEMENT",
    method: inp.method,
    amount,
    reference: c.saleId ? (s.sales.find((x) => x.id === c.saleId)?.number ?? "دين") : "دين",
    date,
    description: "سداد دين",
  });
  audit(
    s,
    userId,
    "إضافة دفعة",
    "دين",
    c.id,
    `${amount} TND — المتبقي ${c.remainingAmount} TND`,
    date,
  );
  return s;
}

export function addManualCredit(
  prev: AppState,
  inp: { clientId: ID; teamId: ID; amount: number; dueDate: string; notes: string },
  userId: ID,
  date: string,
): AppState {
  if (isMarketClient(prev, inp.clientId))
    throw new BusinessError("هذا العميل تابع لسوق: ديونه تُدار من قسم الأسواق");
  return manualCredit(prev, inp, userId, date);
}
/** Dette manuelle (aussi utilisée par les échéances, y compris celles d'un marché) */
export function manualCredit(
  prev: AppState,
  inp: { clientId: ID; teamId: ID; amount: number; dueDate: string; notes: string },
  userId: ID,
  date: string,
): AppState {
  const s = structuredClone(prev);
  if (!inp.clientId || !inp.teamId || !(inp.amount > 0))
    throw new BusinessError("العميل وفريق فيغو والمبلغ مطلوبة");
  const id = nextId(s, "cr");
  s.credits.unshift({
    id,
    clientId: inp.clientId,
    teamId: inp.teamId,
    creditStatusId: creditStatusId(s, "ACTIVE"),
    totalAmount: inp.amount,
    paidAmount: 0,
    remainingAmount: inp.amount,
    dueDate: inp.dueDate,
    createdAt: date,
    notes: inp.notes,
  });
  audit(s, userId, "إنشاء دين", "دين", id, `${inp.amount} TND`, date);
  return s;
}

export function setCreditStatus(
  prev: AppState,
  creditId: ID,
  statusId: ID,
  userId: ID,
  date: string,
): AppState {
  const s = structuredClone(prev);
  const c = s.credits.find((x) => x.id === creditId)!;
  c.creditStatusId = statusId;
  audit(
    s,
    userId,
    "تعديل دين",
    "دين",
    creditId,
    `الحالة ← ${s.creditStatuses.find((x) => x.id === statusId)?.label}`,
    date,
  );
  return s;
}

// ---------- Stock ----------
export function addStockMovement(
  prev: AppState,
  inp: {
    productId: ID;
    frigoId: ID;
    toFrigoId?: ID;
    quantity: number;
    movementType: StockMovementType;
    reference: string;
    notes: string;
  },
  userId: ID,
  date: string,
): AppState {
  const s = structuredClone(prev);
  if (!inp.productId || !inp.frigoId || !inp.quantity)
    throw new BusinessError("المنتج وغرفة التبريد والكمية مطلوبة");
  if (inp.movementType !== "AJUSTEMENT" && inp.quantity < 0)
    throw new BusinessError("يجب أن تكون الكمية موجبة");
  if (inp.movementType === "TRANSFERT") {
    if (!inp.toFrigoId || inp.toFrigoId === inp.frigoId)
      throw new BusinessError("اختر غرفة تبريد وجهة مختلفة");
  }
  const av = stockOf(s, inp.productId, inp.frigoId);
  const out =
    inp.movementType === "SORTIE" || inp.movementType === "TRANSFERT"
      ? inp.quantity
      : inp.movementType === "AJUSTEMENT" && inp.quantity < 0
        ? -inp.quantity
        : 0;
  if (out > av) throw new BusinessError(`مخزون غير كافٍ (${av} متوفرة)`);
  const id = nextId(s, "mv");
  s.stockMovements.unshift({ id, ...inp, date, userId });
  const p = s.products.find((x) => x.id === inp.productId)?.name;
  audit(
    s,
    userId,
    "تعديل المخزون",
    "المخزون",
    id,
    `${inp.movementType} ${inp.quantity} — ${p}`,
    date,
  );
  return s;
}

// ---------- Packaging ----------
export function addPackMovement(
  prev: AppState,
  inp: {
    clientId: ID;
    packagingTypeId: ID;
    teamId: ID;
    type: "SORTIE" | "RETOUR";
    quantity: number;
    notes: string;
  },
  userId: ID,
  date: string,
): AppState {
  const s = structuredClone(prev);
  if (!inp.clientId || !inp.packagingTypeId || !inp.teamId || !(inp.quantity > 0))
    throw new BusinessError("كل الحقول مطلوبة");
  const own = isClientBoxType(s, inp.packagingTypeId);
  if (own && inp.type === "SORTIE") {
    const b = clientBoxBalance(s, { clientId: inp.clientId, teamId: inp.teamId });
    if (inp.quantity > b.owed)
      throw new BusinessError(`لدينا فقط ${b.owed} من صناديق هذا العميل لهذا الفريق`);
  }
  if (!own && inp.type === "RETOUR") {
    const b = packBalance(s, {
      clientId: inp.clientId,
      typeId: inp.packagingTypeId,
      teamId: inp.teamId,
    });
    if (inp.quantity > b.remaining)
      throw new BusinessError(`لدى العميل فقط ${b.remaining} صناديق من هذا النوع لهذا الفريق`);
  }
  const id = nextId(s, "pk");
  s.packagingMovements.unshift({ id, ...inp, date, userId });
  const t = s.packagingTypes.find((x) => x.id === inp.packagingTypeId)?.name;
  const action = own
    ? inp.type === "RETOUR"
      ? "استلام صناديق العميل"
      : "إرجاع صناديق العميل إليه"
    : inp.type === "RETOUR"
      ? "إرجاع صناديق"
      : "تسليم صناديق";
  audit(s, userId, action, "صندوق", id, `${inp.quantity} × ${t}`, date);
  return s;
}

// ---------- Cash ----------
export function addCash(
  prev: AppState,
  inp: {
    teamId: ID;
    type: "ENCAISSEMENT" | "DECAISSEMENT";
    method: PaymentMethod;
    amount: number;
    reference: string;
    description: string;
  },
  userId: ID,
  date: string,
): AppState {
  const s = structuredClone(prev);
  if (!inp.teamId || !(inp.amount > 0)) throw new BusinessError("فريق فيغو والمبلغ مطلوبان");
  const id = nextId(s, "cash");
  s.cash.unshift({ id, ...inp, userId, date });
  audit(
    s,
    userId,
    inp.type === "ENCAISSEMENT" ? "قبض يدوي" : "صرف",
    "الصندوق المالي",
    id,
    `${inp.amount} TND — ${inp.description}`,
    date,
  );
  return s;
}

// ---------- Generic CRUD ----------
/* eslint-disable @typescript-eslint/no-explicit-any */
export type Coll =
  "clients" | "products" | "frigos" | "packagingTypes" | "teams" | "users" | "roles";
const LABEL: Record<Coll, string> = {
  clients: "العميل",
  products: "المنتج",
  frigos: "غرفة التبريد",
  packagingTypes: "نوع الصندوق",
  teams: "فيغو",
  users: "المستخدم",
  roles: "الدور",
};

export function upsert(prev: AppState, coll: Coll, item: any, userId: ID, date: string): AppState {
  type T = { id: ID };
  const s = structuredClone(prev);
  const list = s[coll] as unknown as T[];
  if (item.id) {
    const i = list.findIndex((x) => x.id === item.id);
    const old = list[i] as unknown as Record<string, unknown>;
    let details = "تحديث";
    if (
      coll === "products" &&
      old["salePrice"] !== (item as unknown as Record<string, unknown>)["salePrice"]
    ) {
      details = `السعر ${old["salePrice"]} → ${(item as unknown as Record<string, unknown>)["salePrice"]} TND`;
      audit(s, userId, "تعديل سعر المنتج", LABEL[coll], item.id, details, date);
    } else
      audit(s, userId, `تعديل ${LABEL[coll].toLowerCase()}`, LABEL[coll], item.id, details, date);
    list[i] = { ...list[i], ...item } as T;
  } else {
    const id = nextId(s, coll.slice(0, 3));
    list.unshift({ ...(item as object), id } as T);
    audit(
      s,
      userId,
      `إنشاء ${LABEL[coll].toLowerCase()}`,
      LABEL[coll],
      id,
      String((item as Record<string, unknown>)["name"] ?? ""),
      date,
    );
  }
  return s;
}

export function remove(prev: AppState, coll: Coll, id: ID, userId: ID, date: string): AppState {
  const s = structuredClone(prev);
  const used =
    (coll === "clients" &&
      (s.sales.some((x) => x.clientId === id) ||
        s.packagingMovements.some((x) => x.clientId === id))) ||
    (coll === "products" && s.saleItems.some((x) => x.productId === id)) ||
    (coll === "frigos" && s.stockMovements.some((x) => x.frigoId === id || x.toFrigoId === id)) ||
    (coll === "packagingTypes" && s.packagingMovements.some((x) => x.packagingTypeId === id)) ||
    (coll === "teams" && s.sales.some((x) => x.teamId === id));
  if (used) throw new BusinessError("العنصر مستخدم في عمليات: عطّله بدلاً من حذفه");
  (s[coll] as { id: ID }[]) = (s[coll] as { id: ID }[]).filter((x) => x.id !== id);
  audit(s, userId, `حذف ${LABEL[coll].toLowerCase()}`, LABEL[coll], id, "", date);
  return s;
}
