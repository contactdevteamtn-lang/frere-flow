// Market trips: goods leave the fridges on departure, are sold on the market,
// and unsold goods/boxes come back at closing. Pure (state, input) => state.
import type { AppState, ID, MarketTrip, PaymentMethod } from "@/types";
import { BusinessError, createSale, isClientBoxType, nextId, stockOf } from "@/services/ops";

const round = (n: number) => Math.round(n * 1000) / 1000;

// ---------- Selectors ----------
export function tripSales(s: AppState, tripId: ID) {
  return s.sales.filter((x) => x.marketTripId === tripId && x.saleStatusId !== "ss_cancelled");
}

/** Per product: loaded, sold, remaining on the truck. */
export function tripProductBalance(s: AppState, trip: MarketTrip) {
  const saleIds = new Set(tripSales(s, trip.id).map((x) => x.id));
  const map = new Map<ID, { loaded: number; sold: number; remaining: number }>();
  for (const l of trip.loads) {
    const r = map.get(l.productId) ?? { loaded: 0, sold: 0, remaining: 0 };
    r.loaded += l.quantity;
    map.set(l.productId, r);
  }
  for (const i of s.saleItems) {
    if (!saleIds.has(i.saleId)) continue;
    const r = map.get(i.productId);
    if (r) r.sold += i.quantity;
  }
  for (const r of map.values()) {
    r.loaded = round(r.loaded);
    r.sold = round(r.sold);
    r.remaining = round(r.loaded - r.sold);
  }
  return map;
}

/** Per packaging type: loaded, given to clients, remaining on the truck. */
export function tripBoxBalance(s: AppState, trip: MarketTrip) {
  const saleIds = new Set(tripSales(s, trip.id).map((x) => x.id));
  const map = new Map<ID, { loaded: number; given: number; remaining: number }>();
  for (const b of trip.boxes) {
    const r = map.get(b.typeId) ?? { loaded: 0, given: 0, remaining: 0 };
    r.loaded += b.quantity;
    map.set(b.typeId, r);
  }
  for (const m of s.packagingMovements) {
    if (m.type !== "SORTIE" || !m.saleId || !saleIds.has(m.saleId)) continue;
    const r = map.get(m.packagingTypeId);
    if (r) r.given += m.quantity;
  }
  for (const r of map.values()) r.remaining = r.loaded - r.given;
  return map;
}

export function tripTotals(s: AppState, trip: MarketTrip) {
  const sales = tripSales(s, trip.id);
  const ids = new Set(sales.map((x) => x.id));
  const creditIds = new Set(
    s.credits.filter((c) => c.saleId && ids.has(c.saleId)).map((c) => c.id),
  );
  const receipts = [
    ...s.payments.filter((p) => ids.has(p.saleId)),
    ...s.creditPayments.filter((p) => creditIds.has(p.creditId)),
  ].filter((p) => !trip.closing || p.paymentDate <= trip.closing.closedAt);
  const sent = round(trip.loads.reduce((a, l) => a + l.quantity, 0));
  const total = round(sales.reduce((a, x) => a + x.totalAmount, 0));
  const paid = round(receipts.reduce((a, x) => a + x.amount, 0));
  const cash = round(
    receipts.filter((x) => x.paymentMethod === "ESPECES").reduce((a, x) => a + x.amount, 0),
  );
  const cheques = round(
    receipts.filter((x) => x.paymentMethod === "CHEQUE").reduce((a, x) => a + x.amount, 0),
  );
  return { sent, total, paid, remaining: round(total - paid), cash, cheques, count: sales.length };
}

export interface MarketFilter {
  marketId?: ID;
  from?: string;
  to?: string;
  teamId?: ID;
}
export function marketAnalytics(s: AppState, filter: MarketFilter = {}) {
  const trips = s.marketTrips.filter(
    (t) =>
      (!filter.marketId || t.marketId === filter.marketId) &&
      (!filter.teamId || t.teamId === filter.teamId),
  );
  const tripMarket = new Map(trips.map((t) => [t.id, t.marketId]));
  const inPeriod = (date: string) =>
    (!filter.from || date.slice(0, 10) >= filter.from) &&
    (!filter.to || date.slice(0, 10) <= filter.to);
  const allSales = s.sales.filter(
    (x) => x.marketTripId && tripMarket.has(x.marketTripId) && x.saleStatusId !== "ss_cancelled",
  );
  const sales = allSales.filter((x) => inPeriod(x.saleDate));
  const allIds = new Set(allSales.map((x) => x.id));
  const ids = new Set(sales.map((x) => x.id));
  const creditIds = new Set(
    s.credits.filter((c) => c.saleId && allIds.has(c.saleId)).map((c) => c.id),
  );
  const paid = round(
    [
      ...s.payments.filter((p) => allIds.has(p.saleId)),
      ...s.creditPayments.filter((p) => creditIds.has(p.creditId)),
    ]
      .filter((p) => inPeriod(p.paymentDate))
      .reduce((a, p) => a + p.amount, 0),
  );
  const productMap = new Map<ID, number>();
  for (const item of s.saleItems.filter((i) => ids.has(i.saleId)))
    productMap.set(item.productId, round((productMap.get(item.productId) ?? 0) + item.quantity));
  const debts = new Map<string, { clientId: ID; marketId: ID; amount: number }>();
  const revenues = new Map<ID, number>();
  for (const sale of sales) {
    const marketId = sale.marketTripId ? tripMarket.get(sale.marketTripId) : undefined;
    if (!marketId) continue;
    revenues.set(marketId, round((revenues.get(marketId) ?? 0) + sale.totalAmount));
    const key = `${marketId}|${sale.clientId}`;
    const debt = debts.get(key) ?? { clientId: sale.clientId, marketId, amount: 0 };
    debt.amount = round(debt.amount + sale.remainingAmount);
    debts.set(key, debt);
  }
  return {
    total: round(sales.reduce((a, x) => a + x.totalAmount, 0)),
    paid,
    credit: round(sales.reduce((a, x) => a + x.remainingAmount, 0)),
    volume: round([...productMap.values()].reduce((a, x) => a + x, 0)),
    products: [...productMap]
      .map(([productId, quantity]) => ({ productId, quantity }))
      .sort((a, b) => b.quantity - a.quantity),
    revenues: [...revenues].map(([marketId, amount]) => ({ marketId, amount })),
    debts: [...debts.values()].filter((d) => d.amount > 0).sort((a, b) => b.amount - a.amount),
  };
}

export function saveMarket(
  prev: AppState,
  inp: { id?: ID; name: string; nameAlt?: string; city: string },
  userId: ID,
  date: string,
): AppState {
  if (!inp.name.trim() || !inp.city.trim()) throw new BusinessError("اسم السوق والمدينة مطلوبان");
  const s = structuredClone(prev);
  const existing = inp.id ? s.markets.find((m) => m.id === inp.id) : undefined;
  if (inp.id && !existing) throw new BusinessError("السوق غير موجود");
  const id = existing?.id ?? nextId(s, "mkt");
  if (existing) {
    existing.name = inp.name.trim();
    existing.nameAlt = inp.nameAlt?.trim() ?? "";
    existing.city = inp.city.trim();
  } else
    s.markets.push({
      id,
      name: inp.name.trim(),
      nameAlt: inp.nameAlt?.trim() ?? "",
      city: inp.city.trim(),
      active: true,
    });
  s.auditLogs.unshift({
    id: nextId(s, "log"),
    userId,
    action: "حفظ السوق",
    entity: "السوق",
    entityId: id,
    details: inp.name.trim(),
    date,
  });
  return s;
}

export function saveMarketClient(
  prev: AppState,
  inp: { id?: ID; marketId: ID; name: string; nameAlt?: string; phone: string; address: string },
  userId: ID,
  date: string,
): AppState {
  if (!prev.markets.some((m) => m.id === inp.marketId && m.active) || !inp.name.trim())
    throw new BusinessError("السوق واسم العميل مطلوبان");
  const s = structuredClone(prev);
  const existing = inp.id ? s.clients.find((c) => c.id === inp.id) : undefined;
  if (inp.id && (!existing || existing.marketId !== inp.marketId))
    throw new BusinessError("العميل غير تابع لهذا السوق");
  const id = existing?.id ?? nextId(s, "mc");
  if (existing)
    Object.assign(existing, {
      name: inp.name.trim(),
      nameAlt: inp.nameAlt?.trim() ?? "",
      phone: inp.phone.trim(),
      address: inp.address.trim(),
    });
  else
    s.clients.push({
      id,
      marketId: inp.marketId,
      code: `MC-${s.seq}`,
      name: inp.name.trim(),
      nameAlt: inp.nameAlt?.trim() ?? "",
      phone: inp.phone.trim(),
      address: inp.address.trim(),
      email: "",
      taxId: "",
      active: true,
      createdAt: date,
    });
  s.auditLogs.unshift({
    id: nextId(s, "log"),
    userId,
    action: "حفظ عميل السوق",
    entity: "العميل",
    entityId: id,
    details: inp.name.trim(),
    date,
  });
  return s;
}

// ---------- Operations ----------
export interface TripInput {
  id?: ID;
  marketId: ID;
  newMarketName?: string;
  teamId: ID;
  loads: { productId: ID; frigoId: ID; quantity: number }[];
  boxes: { typeId: ID; quantity: number }[];
  notes: string;
}

export function createMarketTrip(
  prev: AppState,
  inp: TripInput,
  userId: ID,
  date: string,
): AppState {
  const s = structuredClone(prev);
  let marketId = inp.marketId;
  if (!marketId && inp.newMarketName?.trim()) {
    marketId = nextId(s, "mkt");
    s.markets.push({
      id: marketId,
      name: inp.newMarketName.trim(),
      city: inp.newMarketName.trim(),
      active: true,
    });
  }
  if (
    !s.markets.some((m) => m.id === marketId && m.active) ||
    !s.teams.some((t) => t.id === inp.teamId && t.active)
  )
    throw new BusinessError("السوق وغرفة التبريد مطلوبان");
  const loads = inp.loads.filter((l) => l.productId && l.frigoId && l.quantity > 0);
  if (!loads.length) throw new BusinessError("أضف منتجاً واحداً على الأقل");
  const need = new Map<string, number>();
  loads.forEach((l) =>
    need.set(
      `${l.productId}|${l.frigoId}`,
      (need.get(`${l.productId}|${l.frigoId}`) ?? 0) + l.quantity,
    ),
  );
  for (const [k, q] of need) {
    const [pid, fid] = k.split("|") as [ID, ID];
    const av = stockOf(s, pid, fid);
    if (av < q) {
      const p = s.products.find((x) => x.id === pid);
      throw new BusinessError(
        `مخزون غير كافٍ للمنتج ${p?.name} (${av} ${p?.unit} متوفرة في غرفة التبريد)`,
      );
    }
  }
  const id = inp.id || nextId(s, "trip");
  if (s.marketTrips.some((t) => t.id === id)) throw new BusinessError("تعذر تنفيذ العملية");
  const number = `MK-${date.slice(0, 4)}-${String(s.marketTrips.length + 1).padStart(4, "0")}`;
  // les caisses des clients ne partent pas dans le camion
  const boxes = inp.boxes.filter(
    (b) => b.typeId && b.quantity > 0 && !isClientBoxType(s, b.typeId),
  );
  s.marketTrips.unshift({
    id,
    number,
    marketId,
    teamId: inp.teamId,
    date,
    userId,
    status: "OPEN",
    loads,
    boxes,
    notes: inp.notes,
  });
  for (const l of loads) {
    s.stockMovements.unshift({
      id: nextId(s, "mv"),
      productId: l.productId,
      frigoId: l.frigoId,
      quantity: l.quantity,
      movementType: "SORTIE",
      date,
      userId,
      reference: number,
      notes: "إرسال إلى السوق",
    });
  }
  s.auditLogs.unshift({
    id: nextId(s, "log"),
    userId,
    action: "إرسال إلى السوق",
    entity: "السوق",
    entityId: id,
    details: `${number} — ${round(loads.reduce((a, l) => a + l.quantity, 0))} kg`,
    date,
  });
  return s;
}

export interface MarketSaleInput {
  tripId: ID;
  clientId: ID;
  items: { productId: ID; quantity: number; unitPrice: number }[];
  boxes: { typeId: ID; quantity: number }[];
  paid: number;
  method: PaymentMethod;
  notes: string;
}

export function createMarketSale(
  prev: AppState,
  inp: MarketSaleInput,
  userId: ID,
  date: string,
): AppState {
  const trip = prev.marketTrips.find((t) => t.id === inp.tripId);
  if (!trip) throw new BusinessError("السوق غير موجود");
  if (trip.status !== "OPEN") throw new BusinessError("يوم السوق مغلق");
  const client = prev.clients.find((c) => c.id === inp.clientId && c.active);
  if (!client || client.marketId !== trip.marketId)
    throw new BusinessError("العميل غير تابع لهذا السوق");
  const items = inp.items.filter((i) => i.productId && i.quantity > 0);
  if (!items.length) throw new BusinessError("أضف منتجاً واحداً على الأقل");
  const bal = tripProductBalance(prev, trip);
  const need = new Map<ID, number>();
  items.forEach((i) => need.set(i.productId, (need.get(i.productId) ?? 0) + i.quantity));
  for (const [pid, q] of need) {
    const av = bal.get(pid)?.remaining ?? 0;
    if (av < q) {
      const p = prev.products.find((x) => x.id === pid);
      throw new BusinessError(`كمية غير كافية في الشاحنة للمنتج ${p?.name} (${av} ${p?.unit})`);
    }
  }
  const boxBal = tripBoxBalance(prev, trip);
  const boxesNeed = new Map<ID, number>();
  for (const b of inp.boxes.filter((x) => x.quantity > 0 && !isClientBoxType(prev, x.typeId)))
    boxesNeed.set(b.typeId, (boxesNeed.get(b.typeId) ?? 0) + b.quantity);
  for (const [typeId, quantity] of boxesNeed) {
    if ((boxBal.get(typeId)?.remaining ?? 0) < quantity)
      throw new BusinessError("عدد الصناديق يتجاوز المتوفر في الشاحنة");
  }
  const source = trip.loads[0];
  if (!source) throw new BusinessError("أضف منتجاً واحداً على الأقل");
  return createSale(
    prev,
    {
      clientId: inp.clientId,
      teamId: trip.teamId,
      frigoId: source.frigoId,
      items,
      paid: inp.paid,
      method: inp.method,
      notes: inp.notes,
      packaging: inp.boxes,
      marketTripId: trip.id,
    },
    userId,
    date,
  );
}

export interface ClosingInput {
  tripId: ID;
  returns: { productId: ID; quantity: number }[];
  boxesReturned: { typeId: ID; quantity: number }[];
  cashCounted: number;
  chequesCounted: number;
  notes: string;
}

export function closeMarketTrip(
  prev: AppState,
  inp: ClosingInput,
  userId: ID,
  date: string,
): AppState {
  const s = structuredClone(prev);
  const trip = s.marketTrips.find((t) => t.id === inp.tripId);
  if (!trip) throw new BusinessError("السوق غير موجود");
  if (trip.status !== "OPEN") throw new BusinessError("يوم السوق مغلق");
  const bal = tripProductBalance(s, trip);
  const boxBal = tripBoxBalance(s, trip);
  const totals = tripTotals(s, trip);
  const returns: { productId: ID; frigoId: ID; quantity: number }[] = [];
  let goodsGap = 0;
  for (const [pid, b] of bal) {
    const q = Math.max(inp.returns.find((r) => r.productId === pid)?.quantity ?? 0, 0);
    if (q > b.remaining) {
      const p = s.products.find((x) => x.id === pid);
      throw new BusinessError(`الكمية المرتجعة أكبر من المتبقي للمنتج ${p?.name}`);
    }
    goodsGap += q - b.remaining;
    // Allocate sold goods in load order, then return each source's unsold goods.
    let sold = b.sold;
    let left = q;
    for (const load of trip.loads.filter((l) => l.productId === pid)) {
      const consumed = Math.min(sold, load.quantity);
      sold = round(sold - consumed);
      const quantity = round(Math.min(left, load.quantity - consumed));
      if (quantity > 0) returns.push({ productId: pid, frigoId: load.frigoId, quantity });
      left = round(left - quantity);
    }
  }
  let boxesGap = 0;
  const boxesReturned: { typeId: ID; quantity: number }[] = [];
  for (const [tid, b] of boxBal) {
    const q = Math.max(inp.boxesReturned.find((r) => r.typeId === tid)?.quantity ?? 0, 0);
    boxesGap += q - b.remaining;
    boxesReturned.push({ typeId: tid, quantity: q });
  }
  const cashCounted = round(Math.max(inp.cashCounted || 0, 0));
  const chequesCounted = round(Math.max(inp.chequesCounted || 0, 0));
  const cashGap = round(cashCounted + chequesCounted - totals.cash - totals.cheques);
  for (const r of returns) {
    s.stockMovements.unshift({
      id: nextId(s, "mv"),
      productId: r.productId,
      frigoId: r.frigoId,
      quantity: r.quantity,
      movementType: "ENTREE",
      date,
      userId,
      reference: trip.number,
      notes: "مرتجع السوق",
    });
  }
  trip.status = "CLOSED";
  trip.closing = {
    returns,
    boxesReturned,
    cashCounted,
    chequesCounted,
    expectedCash: totals.cash,
    expectedCheques: totals.cheques,
    goodsGap: round(goodsGap),
    boxesGap,
    cashGap,
    notes: inp.notes,
    closedAt: date,
    closedBy: userId,
  };
  s.auditLogs.unshift({
    id: nextId(s, "log"),
    userId,
    action: "إغلاق يوم السوق",
    entity: "السوق",
    entityId: trip.id,
    details: `${trip.number} — فارق البضاعة ${round(goodsGap)} kg، فارق الصندوق ${cashGap} TND`,
    date,
  });
  return s;
}

/**
 * Bilan de fin de journée d'une expédition, à partir des données réelles :
 *  - par frigo : quantité chargée, vendue (ventes réparties dans l'ordre des chargements), montant estimé ;
 *  - argent : total des ventes, encaissé (espèces / chèques), laissé à crédit, nombre de factures ;
 *  - retours au frigo et écarts constatés à la clôture.
 */
export function bilanJournee(s: AppState, trip: MarketTrip) {
  const totals = tripTotals(s, trip);
  const bal = tripProductBalance(s, trip);
  const saleIds = new Set(tripSales(s, trip.id).map((x) => x.id));
  // prix moyen vendu par produit (montant / quantité)
  const prix = new Map<ID, number>();
  for (const pid of bal.keys()) {
    const lignes = s.saleItems.filter((i) => saleIds.has(i.saleId) && i.productId === pid);
    const q = lignes.reduce((a, i) => a + i.quantity, 0);
    prix.set(pid, q ? lignes.reduce((a, i) => a + i.total, 0) / q : 0);
  }
  const parFrigo = new Map<
    ID,
    { chargé: number; vendu: number; montant: number; retour: number }
  >();
  for (const [pid, b] of bal) {
    let resteVendu = b.sold;
    for (const load of trip.loads.filter((l) => l.productId === pid)) {
      const vendu = Math.min(resteVendu, load.quantity);
      resteVendu = round(resteVendu - vendu);
      const r = parFrigo.get(load.frigoId) ?? { chargé: 0, vendu: 0, montant: 0, retour: 0 };
      r.chargé = round(r.chargé + load.quantity);
      r.vendu = round(r.vendu + vendu);
      r.montant = round(r.montant + vendu * (prix.get(pid) ?? 0));
      parFrigo.set(load.frigoId, r);
    }
  }
  for (const ret of trip.closing?.returns ?? []) {
    const r = parFrigo.get(ret.frigoId);
    if (r) r.retour = round(r.retour + ret.quantity);
  }
  return {
    parFrigo: [...parFrigo.entries()].map(([frigoId, v]) => ({ frigoId, ...v })),
    ventes: totals.total,
    encaisse: totals.paid,
    especes: totals.cash,
    cheques: totals.cheques,
    credit: totals.remaining,
    factures: totals.count,
    charge: totals.sent,
    vendu: round([...bal.values()].reduce((a, b) => a + b.sold, 0)),
    ecartMarchandise: trip.closing?.goodsGap ?? null,
    ecartCaisse: trip.closing?.cashGap ?? null,
  };
}
