import { Text, translate, useLanguage } from "@/lib/i18n";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Truck,
  ShoppingBasket,
  ClipboardCheck,
  Lock,
  Boxes,
  Wallet,
  Scale,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useApp, useLookups } from "@/store/store";
import {
  closeMarketTrip,
  createMarketSale,
  tripBoxBalance,
  tripProductBalance,
  tripSales,
  tripTotals,
  type MarketSaleInput,
} from "@/services/markets";
import type { MarketTrip } from "@/types";
import { Confirm, Edit, Field, FormDialog, NativeSelect } from "@/components/app/forms";
import { Empty, Kpi, Panel, Status, thCls } from "@/components/app/ui";
import { METHODES, dateFr, dateTimeFr, dt, methodeLabel, num } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_erp/marches/$id")({
  head: () => ({
    meta: [
      { title: "Journée de marché — Frère Mahjoub" },
      {
        name: "description",
        content: "Chargement, ventes sur le marché et clôture de la journée.",
      },
      { property: "og:title", content: "Journée de marché — Frère Mahjoub" },
      {
        property: "og:description",
        content: "Chargement, ventes sur le marché et clôture de la journée.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TripPage,
});

function SectionTitle({ n, icon: Icon, title }: { n: number; icon: typeof Truck; title: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className="grid size-7 place-items-center rounded-lg bg-secondary text-primary">
        <Icon className="size-4" />
      </span>
      <span className="text-xs text-muted-foreground">{n}.</span> {translate(title)}
    </span>
  );
}

function TripPage() {
  useLanguage();
  const { id } = Route.useParams();
  const { state } = useApp();
  const L = useLookups();
  const trip = state.marketTrips.find((t) => t.id === id);
  const [selling, setSelling] = useState(false);
  if (!trip)
    return (
      <div className="py-20">
        <Empty text={translate("السوق غير موجود")} />
        <div className="text-center">
          <Link to="/marches" className="text-sm text-primary underline">
            <Text>{"العودة إلى الأسواق"}</Text>
          </Link>
        </div>
      </div>
    );

  const totals = tripTotals(state, trip);
  const bal = tripProductBalance(state, trip);
  const boxBal = tripBoxBalance(state, trip);
  const sales = tripSales(state, trip.id);
  const open = trip.status === "OPEN";

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            to="/marches"
            className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4 rtl:rotate-180" />
            <Text>{"الأسواق"}</Text>
          </Link>
          <h1 className="flex flex-wrap items-center gap-3 text-2xl font-semibold md:text-3xl">
            {translate(L.market.get(trip.marketId)?.name ?? "")} <Status value={trip.status} />
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="font-mono">{trip.number}</span> · {dateFr(trip.date)} ·{" "}
            {translate(L.team.get(trip.teamId)?.name ?? "")}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="البضاعة المرسلة" value={`${num(totals.sent)} kg`} icon={Truck} />
        <Kpi
          label="المبيعات"
          value={dt(totals.total)}
          hint={`${totals.count} ${translate("عمليات")}`}
          icon={ShoppingBasket}
          tone="leaf"
        />
        <Kpi label="المقبوض" value={dt(totals.paid)} icon={Wallet} />
        <Kpi label="المتبقي ← دين" value={dt(totals.remaining)} icon={Scale} tone="destructive" />
      </div>

      <Panel title={<SectionTitle n={1} icon={Truck} title="الحمولة الأولية" />}>
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="overflow-x-auto lg:col-span-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  {["المنتج", "غرفة التبريد", "المرسل", "المباع", "المتبقي في الشاحنة"].map(
                    (h, i) => (
                      <th key={h} className={cn(thCls, "p-2", i > 1 ? "text-end" : "text-start")}>
                        {translate(h)}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {[...bal.entries()].map(([pid, b]) => (
                  <tr key={pid} className="border-b last:border-0">
                    <td className="p-2 font-medium">{translate(L.product.get(pid)?.name ?? "")}</td>
                    <td className="p-2 text-muted-foreground">
                      {[
                        ...new Set(
                          trip.loads.filter((l) => l.productId === pid).map((l) => l.frigoId),
                        ),
                      ]
                        .map((f) => translate(L.frigo.get(f)?.name ?? ""))
                        .join(" + ")}
                    </td>
                    <td className="p-2 text-end">{num(b.loaded, 1)} kg</td>
                    <td className="p-2 text-end text-primary">{num(b.sold, 1)} kg</td>
                    <td className="p-2 text-end font-semibold">{num(b.remaining, 1)} kg</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-2">
            <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Boxes className="size-4" />
              <Text>{"الصناديق المحمّلة"}</Text>
            </p>
            {[...boxBal.entries()].length === 0 && (
              <p className="text-sm text-muted-foreground">
                <Text>{"لا توجد صناديق"}</Text>
              </p>
            )}
            {[...boxBal.entries()].map(([tid, b]) => (
              <div
                key={tid}
                className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm"
              >
                <span className="flex items-center gap-2">
                  <span
                    className="size-3 rounded-full border"
                    style={{ backgroundColor: L.pack.get(tid)?.hex }}
                  />
                  {translate(L.pack.get(tid)?.name ?? "")}
                </span>
                <span className="text-xs text-muted-foreground">
                  {num(b.loaded)} · <Text>{"سُلّم"}</Text> {num(b.given)} ·{" "}
                  <b className="text-foreground">{num(b.remaining)}</b>
                </span>
              </div>
            ))}
          </div>
        </div>
      </Panel>

      <Panel
        title={<SectionTitle n={2} icon={ShoppingBasket} title="المبيعات في السوق" />}
        action={
          open && (
            <Edit>
              <Button size="sm" onClick={() => setSelling(true)}>
                <Plus className="size-4" />
                <Text>{"إضافة بيع في السوق"}</Text>
              </Button>
            </Edit>
          )
        }
      >
        {sales.length === 0 ? (
          <Empty text={translate("لا توجد مبيعات في هذا السوق بعد")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  {[
                    "رقم الفاتورة",
                    "الوقت",
                    "العميل",
                    "المنتجات",
                    "الصناديق",
                    "الإجمالي",
                    "المدفوع",
                    "المتبقي",
                    "طريقة الدفع",
                  ].map((h, i) => (
                    <th
                      key={h}
                      className={cn(thCls, "p-2", i >= 5 && i <= 7 ? "text-end" : "text-start")}
                    >
                      {translate(h)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sales.map((s) => {
                  const items = state.saleItems.filter((i) => i.saleId === s.id);
                  const boxes = state.packagingMovements
                    .filter((m) => m.saleId === s.id && m.type === "SORTIE")
                    .reduce((a, m) => a + m.quantity, 0);
                  return (
                    <tr key={s.id} className="border-b last:border-0">
                      <td className="p-2 font-mono text-xs">{s.number}</td>
                      <td className="p-2 text-muted-foreground">{dateTimeFr(s.saleDate)}</td>
                      <td className="p-2 font-medium">
                        {translate(L.client.get(s.clientId)?.name ?? "")}
                      </td>
                      <td className="p-2 text-xs">
                        {items
                          .map(
                            (i) =>
                              `${translate(L.product.get(i.productId)?.name ?? "")} ${num(i.quantity)}kg`,
                          )
                          .join(translate("، "))}
                      </td>
                      <td className="p-2">{num(boxes)}</td>
                      <td className="p-2 text-end">{dt(s.totalAmount)}</td>
                      <td className="p-2 text-end text-primary">{dt(s.paidAmount)}</td>
                      <td
                        className={cn("p-2 text-end", s.remainingAmount > 0 && "text-destructive")}
                      >
                        {dt(s.remainingAmount)}
                      </td>
                      <td className="p-2">{methodeLabel(s.paymentType)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title={<SectionTitle n={3} icon={ClipboardCheck} title="حصيلة آخر اليوم / الإغلاق" />}>
        {open ? <ClosingForm trip={trip} /> : <ClosingSummary trip={trip} />}
      </Panel>

      {selling && <MarketSaleDialog trip={trip} onClose={() => setSelling(false)} />}
    </div>
  );
}

function MarketSaleDialog({ trip, onClose }: { trip: MarketTrip; onClose: () => void }) {
  useLanguage();
  const { state, run } = useApp();
  const bal = tripProductBalance(state, trip);
  const boxBal = tripBoxBalance(state, trip);
  const [f, setF] = useState<MarketSaleInput>({
    tripId: trip.id,
    clientId: "",
    items: [{ productId: "", quantity: 0, unitPrice: 0 }],
    // caisses du camion + caisses que le client amène (à lui rendre plus tard)
    boxes: [
      ...[...boxBal.keys()].map((typeId) => ({ typeId, quantity: 0 })),
      ...state.packagingTypes
        .filter((t) => t.active && t.clientOwned)
        .map((t) => ({ typeId: t.id, quantity: 0 })),
    ],
    paid: 0,
    method: "ESPECES",
    notes: "",
  });
  const clients = state.clients.filter((c) => c.active && c.marketId === trip.marketId);
  const total = f.items.reduce((a, i) => a + i.quantity * i.unitPrice, 0);
  const paid = Math.min(f.paid || 0, total);
  const setItem = (i: number, patch: Partial<MarketSaleInput["items"][number]>) =>
    setF({ ...f, items: f.items.map((x, j) => (j === i ? { ...x, ...patch } : x)) });

  return (
    <FormDialog
      wide
      open
      onOpenChange={onClose}
      title={translate("إضافة بيع في السوق")}
      description={translate("تُخصم الكمية من حمولة الشاحنة، والمتبقي يُسجّل ديناً على العميل.")}
      submitLabel={translate("تأكيد البيع")}
      onSubmit={() => run(createMarketSale, f) && onClose()}
    >
      <Field label="1. العميل">
        <NativeSelect
          required
          value={f.clientId}
          onChange={(e) => setF({ ...f, clientId: e.target.value })}
        >
          <option value="">{translate("اختر…")}</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {translate(c.name)}
            </option>
          ))}
        </NativeSelect>
        {!clients.length && (
          <p className="text-sm text-warning-foreground">
            {translate("لا يوجد عملاء مرتبطون بهذا السوق")} ·{" "}
            <Link to="/marches" className="text-primary underline">
              {translate("إعداد الأسواق والعملاء")}
            </Link>
          </p>
        )}
      </Field>
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">
          <Text>{"2. المنتجات المباعة"}</Text>
        </p>
        {f.items.map((it, i) => {
          const av = it.productId ? (bal.get(it.productId)?.remaining ?? 0) : null;
          return (
            // libellés fixes au-dessus de chaque case : on sait toujours quelle case est quoi
            <div key={i} className="grid grid-cols-12 items-start gap-2 rounded-lg bg-muted/50 p-2">
              <Field label="المنتج" className="col-span-12 sm:col-span-4">
                <NativeSelect
                  value={it.productId}
                  onChange={(e) => {
                    const p = state.products.find((x) => x.id === e.target.value);
                    setItem(i, { productId: e.target.value, unitPrice: p?.salePrice ?? 0 });
                  }}
                >
                  <option value="">{translate("اختر المنتج…")}</option>
                  {[...bal.keys()].map((pid) => (
                    <option key={pid} value={pid}>
                      {translate(state.products.find((p) => p.id === pid)?.name ?? "")}
                    </option>
                  ))}
                </NativeSelect>
                {av !== null && (
                  <p
                    className={
                      av < it.quantity
                        ? "mt-1 text-xs text-destructive"
                        : "mt-1 text-xs text-muted-foreground"
                    }
                  >
                    <Text>{"في الشاحنة: "}</Text>
                    {num(av, 1)} kg
                  </p>
                )}
              </Field>
              <Field label="الكمية (كغ)" className="col-span-4 sm:col-span-2">
                <Input
                  type="number"
                  min={0}
                  step="0.001"
                  inputMode="decimal"
                  aria-label={translate("الكمية (كغ)")}
                  placeholder={translate("مثال: 20")}
                  value={it.quantity || ""}
                  onChange={(e) => setItem(i, { quantity: Number(e.target.value) })}
                />
              </Field>
              <Field label="سعر الوحدة (د.ت)" className="col-span-4 sm:col-span-2">
                <Input
                  type="number"
                  step="0.001"
                  min={0}
                  inputMode="decimal"
                  aria-label={translate("سعر الوحدة (د.ت)")}
                  placeholder={translate("مثال: 1.500")}
                  value={it.unitPrice || ""}
                  onChange={(e) => setItem(i, { unitPrice: Number(e.target.value) })}
                />
              </Field>
              <Field label="المجموع" className="col-span-3 sm:col-span-3">
                <div className="flex h-9 items-center justify-end text-sm font-semibold">
                  {dt(it.quantity * it.unitPrice)}
                </div>
              </Field>
              <div className="col-span-1 pt-5">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => setF({ ...f, items: f.items.filter((_, j) => j !== i) })}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          );
        })}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            setF({ ...f, items: [...f.items, { productId: "", quantity: 0, unitPrice: 0 }] })
          }
        >
          <Plus className="size-4" />
          <Text>{"إضافة منتج"}</Text>
        </Button>
      </div>
      {f.boxes.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            <Text>{"3. الصناديق (المسلّمة للعميل / صناديق العميل)"}</Text>
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {f.boxes.map((b, i) => (
              <div
                key={b.typeId}
                className="flex items-center gap-2 rounded-lg bg-muted/50 p-2 text-sm"
              >
                <span
                  className="size-3 rounded-full border"
                  style={{
                    backgroundColor: state.packagingTypes.find((t) => t.id === b.typeId)?.hex,
                  }}
                />
                <span className="flex-1">
                  {translate(state.packagingTypes.find((t) => t.id === b.typeId)?.name ?? "")}{" "}
                  <span className="text-xs text-muted-foreground">
                    {state.packagingTypes.find((t) => t.id === b.typeId)?.clientOwned
                      ? `(${translate("يجلبها العميل")})`
                      : `(${num(boxBal.get(b.typeId)?.remaining ?? 0)})`}
                  </span>
                </span>
                <Input
                  type="number"
                  min={0}
                  step="1"
                  inputMode="numeric"
                  placeholder={translate("مثال: 3")}
                  className="w-24"
                  value={b.quantity || ""}
                  onChange={(e) =>
                    setF({
                      ...f,
                      boxes: f.boxes.map((x, j) =>
                        j === i ? { ...x, quantity: Number(e.target.value) } : x,
                      ),
                    })
                  }
                />
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="المبلغ المدفوع (د.ت)">
          <Input
            type="number"
            step="0.001"
            min={0}
            max={total}
            inputMode="decimal"
            placeholder={translate("مثال: 50.000")}
            value={f.paid || ""}
            onChange={(e) => setF({ ...f, paid: Number(e.target.value) })}
          />
        </Field>
        <Field label="طريقة الدفع">
          <NativeSelect
            value={f.method}
            onChange={(e) => setF({ ...f, method: e.target.value as MarketSaleInput["method"] })}
          >
            {METHODES.map((m) => (
              <option key={m.value} value={m.value}>
                {translate(m.label)}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-2 rounded-xl bg-mint p-4 text-center">
        <div>
          <p className="text-xs text-muted-foreground">
            <Text>{"الإجمالي"}</Text>
          </p>
          <p className="font-display text-lg font-semibold">{dt(total)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">
            <Text>{"المدفوع"}</Text>
          </p>
          <p className="font-display text-lg font-semibold text-primary">{dt(paid)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">
            <Text>{"المتبقي ← دين"}</Text>
          </p>
          <p className="font-display text-lg font-semibold text-destructive">{dt(total - paid)}</p>
        </div>
      </div>
    </FormDialog>
  );
}

function Gap({ value, unit }: { value: number; unit: string }) {
  const tone =
    value === 0 ? "text-primary" : value < 0 ? "text-destructive" : "text-warning-foreground";
  return (
    <span className={cn("font-semibold", tone)}>
      {value > 0 ? "+" : ""}
      {unit === "TND" ? dt(value) : `${num(value, 1)} ${unit}`}
    </span>
  );
}

function ClosingForm({ trip }: { trip: MarketTrip }) {
  useLanguage();
  const { state, run } = useApp();
  const bal = tripProductBalance(state, trip);
  const boxBal = tripBoxBalance(state, trip);
  const totals = tripTotals(state, trip);
  const [returns, setReturns] = useState<Record<string, number>>({});
  const [boxes, setBoxes] = useState<Record<string, number>>({});
  const [cash, setCash] = useState(0);
  const [cheques, setCheques] = useState(0);
  const [notes, setNotes] = useState("");
  const [confirm, setConfirm] = useState(false);

  const goodsGap = [...bal.entries()].reduce(
    (a, [pid, b]) => a + (returns[pid] ?? 0) - b.remaining,
    0,
  );
  const boxesGap = [...boxBal.entries()].reduce(
    (a, [tid, b]) => a + (boxes[tid] ?? 0) - b.remaining,
    0,
  );
  const cashGap = cash + cheques - totals.cash - totals.cheques;

  const submit = () => {
    run(closeMarketTrip, {
      tripId: trip.id,
      returns: Object.entries(returns).map(([productId, quantity]) => ({ productId, quantity })),
      boxesReturned: Object.entries(boxes).map(([typeId, quantity]) => ({ typeId, quantity })),
      cashCounted: cash,
      chequesCounted: cheques,
      notes,
    });
    setConfirm(false);
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            <Text>{"البضاعة غير المباعة المرتجعة (kg)"}</Text>
          </p>
          {[...bal.entries()].map(([pid, b]) => (
            <div key={pid} className="flex items-center gap-2 rounded-lg bg-muted/50 p-2 text-sm">
              <span className="flex-1 font-medium">{translate(L(state, pid))}</span>
              <span className="text-xs text-muted-foreground">
                <Text>{"متوقع"}</Text> {num(b.remaining, 1)}
              </span>
              <Input
                type="number"
                min={0}
                max={b.remaining}
                step="0.001"
                inputMode="decimal"
                placeholder={translate("مثال: 5")}
                className="w-24"
                value={returns[pid] ?? ""}
                onChange={(e) => setReturns({ ...returns, [pid]: Number(e.target.value) })}
              />
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            <Text>{"الصناديق المرتجعة"}</Text>
          </p>
          {[...boxBal.entries()].length === 0 && (
            <p className="text-sm text-muted-foreground">
              <Text>{"لا توجد صناديق"}</Text>
            </p>
          )}
          {[...boxBal.entries()].map(([tid, b]) => (
            <div key={tid} className="flex items-center gap-2 rounded-lg bg-muted/50 p-2 text-sm">
              <span
                className="size-3 rounded-full border"
                style={{ backgroundColor: state.packagingTypes.find((t) => t.id === tid)?.hex }}
              />
              <span className="flex-1 font-medium">
                {translate(state.packagingTypes.find((t) => t.id === tid)?.name ?? "")}
              </span>
              <span className="text-xs text-muted-foreground">
                <Text>{"متوقع"}</Text> {num(b.remaining)}
              </span>
              <Input
                type="number"
                min={0}
                step="1"
                inputMode="numeric"
                placeholder={translate("مثال: 3")}
                className="w-24"
                value={boxes[tid] ?? ""}
                onChange={(e) => setBoxes({ ...boxes, [tid]: Number(e.target.value) })}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label={`${translate("عدّ الصندوق: نقداً")} (${translate("متوقع")} ${dt(totals.cash)})`}
        >
          <Input
            type="number"
            step="0.001"
            min={0}
            inputMode="decimal"
            placeholder={translate("مثال: 350.000")}
            value={cash || ""}
            onChange={(e) => setCash(Number(e.target.value))}
          />
        </Field>
        <Field
          label={`${translate("عدّ الصندوق: شيكات")} (${translate("متوقع")} ${dt(totals.cheques)})`}
        >
          <Input
            type="number"
            step="0.001"
            min={0}
            inputMode="decimal"
            placeholder={translate("مثال: 0")}
            value={cheques || ""}
            onChange={(e) => setCheques(Number(e.target.value))}
          />
        </Field>
      </div>
      <Field label="ملاحظات">
        <Textarea
          rows={2}
          maxLength={500}
          placeholder={translate("مثال: 2 كغ طماطم تالفة")}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </Field>
      <div className="grid gap-2 rounded-xl bg-mint p-4 text-center sm:grid-cols-3">
        <div>
          <p className="text-xs text-muted-foreground">
            <Text>{"فارق البضاعة"}</Text>
          </p>
          <Gap value={Math.round(goodsGap * 10) / 10} unit="kg" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">
            <Text>{"فارق الصناديق"}</Text>
          </p>
          <Gap value={boxesGap} unit="" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">
            <Text>{"فارق الصندوق المالي"}</Text>
          </p>
          <Gap value={Math.round(cashGap * 1000) / 1000} unit="TND" />
        </div>
      </div>
      <Edit>
        <div className="flex justify-end">
          <Button onClick={() => setConfirm(true)}>
            <Lock className="size-4" />
            <Text>{"إغلاق يوم السوق"}</Text>
          </Button>
        </div>
      </Edit>
      <Confirm
        open={confirm}
        onOpenChange={setConfirm}
        title={translate("إغلاق يوم السوق؟")}
        description={translate("ستُعاد البضاعة غير المباعة إلى غرف التبريد وتُجمّد بيانات هذا اليوم.")}
        label={translate("إغلاق")}
        onConfirm={submit}
      />
    </div>
  );
}

const L = (s: { products: { id: string; name: string }[] }, pid: string) =>
  s.products.find((p) => p.id === pid)?.name ?? "";

function ClosingSummary({ trip }: { trip: MarketTrip }) {
  useLanguage();
  const { state } = useApp();
  const c = trip.closing;
  const bal = tripProductBalance(state, trip);
  if (!c) return <Empty />;
  const user = state.users.find((u) => u.id === c.closedBy);
  return (
    <div className="space-y-4">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Lock className="size-4" />
        <Text>{"أُغلق في"}</Text> {dateTimeFr(c.closedAt)} · {translate(user?.name ?? "")}
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border p-4">
          <p className="text-xs text-muted-foreground">
            <Text>{"فارق البضاعة"}</Text>
          </p>
          <p className="text-lg">
            <Gap value={c.goodsGap} unit="kg" />
          </p>
        </div>
        <div className="rounded-xl border p-4">
          <p className="text-xs text-muted-foreground">
            <Text>{"فارق الصناديق"}</Text>
          </p>
          <p className="text-lg">
            <Gap value={c.boxesGap} unit="" />
          </p>
        </div>
        <div className="rounded-xl border p-4">
          <p className="text-xs text-muted-foreground">
            <Text>{"فارق الصندوق المالي"}</Text>
          </p>
          <p className="text-lg">
            <Gap value={c.cashGap} unit="TND" />
          </p>
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              {["المنتج", "المتبقي المتوقع", "المرتجع"].map((h, i) => (
                <th key={h} className={cn(thCls, "p-2", i ? "text-end" : "text-start")}>
                  {translate(h)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...bal.entries()].map(([pid, b]) => {
              const r = c.returns.find((x) => x.productId === pid)?.quantity ?? 0;
              return (
                <tr key={pid} className="border-b last:border-0">
                  <td className="p-2">{translate(L(state, pid))}</td>
                  <td className="p-2 text-end">{num(b.remaining, 1)} kg</td>
                  <td
                    className={cn(
                      "p-2 text-end font-semibold",
                      r < b.remaining && "text-destructive",
                    )}
                  >
                    {num(r, 1)} kg
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between rounded-lg bg-muted/50 px-3 py-2">
            <span>
              <Text>{"نقداً"}</Text>
            </span>
            <span>
              {dt(c.cashCounted)}{" "}
              <span className="text-xs text-muted-foreground">/ {dt(c.expectedCash)}</span>
            </span>
          </div>
          <div className="flex justify-between rounded-lg bg-muted/50 px-3 py-2">
            <span>
              <Text>{"شيكات"}</Text>
            </span>
            <span>
              {dt(c.chequesCounted)}{" "}
              <span className="text-xs text-muted-foreground">/ {dt(c.expectedCheques)}</span>
            </span>
          </div>
          {c.boxesReturned.map((b) => (
            <div key={b.typeId} className="flex justify-between rounded-lg bg-muted/50 px-3 py-2">
              <span>
                {translate(state.packagingTypes.find((t) => t.id === b.typeId)?.name ?? "")}
              </span>
              <span>{num(b.quantity)}</span>
            </div>
          ))}
          {c.notes && (
            <p className="flex items-start gap-2 text-muted-foreground">
              <AlertTriangle className="mt-0.5 size-4" />
              {c.notes}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
