import { Text, translate, useLanguage } from "@/lib/i18n";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  Plus,
  Trash2,
  Truck,
  Store,
  Wallet,
  PackageCheck,
  Eye,
  BarChart3,
  Settings,
  CreditCard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useApp, useLookups, useTeamScope } from "@/store/store";
import { stockOf } from "@/services/ops";
import { createMarketTrip, tripTotals, type TripInput } from "@/services/markets";
import { DataTable } from "@/components/app/DataTable";
import { Edit, Field, FormDialog, NativeSelect } from "@/components/app/forms";
import { Kpi, PageHeader, Panel, Status } from "@/components/app/ui";
import { dateFr, dt, num } from "@/lib/format";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MarketAnalytics } from "@/components/markets/MarketAnalytics";
import { MarketConfiguration } from "@/components/markets/MarketConfiguration";
import { MarketCredits } from "@/components/markets/MarketCredits";

export const Route = createFileRoute("/_erp/marches/")({
  head: () => ({
    meta: [
      { title: "Marchés — Frère Mahjoub" },
      {
        name: "description",
        content: "Expéditions vers les marchés, ventes sur place et bilan de fin de journée.",
      },
      { property: "og:title", content: "Marchés — Frère Mahjoub" },
      {
        property: "og:description",
        content: "Expéditions vers les marchés, ventes sur place et bilan de fin de journée.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Marches,
});

function Marches() {
  useLanguage();
  const { state, teamFilter } = useApp();
  const L = useLookups();
  const inScope = useTeamScope();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [status, setStatus] = useState("all");
  const [market, setMarket] = useState("all");

  const rows = state.marketTrips
    .filter(
      (t) =>
        inScope(t.teamId) &&
        (status === "all" || t.status === status) &&
        (market === "all" || t.marketId === market),
    )
    .map((t) => ({ ...t, totals: tripTotals(state, t) }));
  const open = rows.filter((r) => r.status === "OPEN").length;
  const sent = rows.reduce((a, r) => a + r.totals.sent, 0);
  const sales = rows.reduce((a, r) => a + r.totals.total, 0);
  const paid = rows.reduce((a, r) => a + r.totals.paid, 0);

  return (
    <div>
      <PageHeader title={translate("إدارة الأسواق")} />
      <Tabs defaultValue="analytics">
        <TabsList className="mb-5 grid h-auto w-full grid-cols-1 gap-1 md:grid-cols-4">
          <TabsTrigger value="analytics" className="gap-2 whitespace-normal py-2">
            <BarChart3 className="size-4 shrink-0" />
            {translate("لوحة تحليل الأسواق")}
          </TabsTrigger>
          <TabsTrigger value="sessions" className="gap-2 whitespace-normal py-2">
            <Truck className="size-4 shrink-0" />
            {translate("جلسات ومبيعات الأسواق")}
          </TabsTrigger>
          <TabsTrigger value="credits" className="gap-2 whitespace-normal py-2">
            <CreditCard className="size-4 shrink-0" />
            {translate("ديون الأسواق")}
          </TabsTrigger>
          <TabsTrigger value="configuration" className="gap-2 whitespace-normal py-2">
            <Settings className="size-4 shrink-0" />
            {translate("إعداد الأسواق والعملاء")}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="analytics">
          <MarketAnalytics />
        </TabsContent>
        <TabsContent value="credits">
          <MarketCredits />
        </TabsContent>
        <TabsContent value="configuration">
          <MarketConfiguration />
        </TabsContent>
        <TabsContent value="sessions">
          <Edit>
            <div className="mb-4 flex justify-end">
              <Button
                disabled={!state.teams.length || !state.frigos.some((f) => f.active)}
                onClick={() => setCreating(true)}
              >
                <Plus className="size-4" />
                <Text>{"إرسالية سوق جديدة"}</Text>
              </Button>
            </div>
          </Edit>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="أسواق جارية" value={num(open)} icon={Truck} tone="warning" />
            <Kpi label="البضاعة المرسلة" value={`${num(sent)} kg`} icon={PackageCheck} />
            <Kpi label="مبيعات الأسواق" value={dt(sales)} icon={Store} tone="leaf" />
            <Kpi label="المبلغ المقبوض" value={dt(paid)} icon={Wallet} />
          </div>
          <Panel>
            <DataTable
              rows={rows}
              search={(t) => `${t.number} ${translate(L.market.get(t.marketId)?.name ?? "")}`}
              onRowClick={(t) => navigate({ to: "/marches/$id", params: { id: t.id } })}
              filters={
                <>
                  <NativeSelect
                    className="sm:w-44"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="all">{translate("كل الحالات")}</option>
                    <option value="OPEN">{translate("جارية")}</option>
                    <option value="CLOSED">{translate("مغلقة")}</option>
                  </NativeSelect>
                  <NativeSelect
                    className="sm:w-44"
                    value={market}
                    onChange={(e) => setMarket(e.target.value)}
                  >
                    <option value="all">{translate("كل الأسواق")}</option>
                    {state.markets.map((m) => (
                      <option key={m.id} value={m.id}>
                        {translate(m.name)}
                      </option>
                    ))}
                  </NativeSelect>
                </>
              }
              columns={[
                {
                  header: translate("الرقم"),
                  cell: (t) => <span className="font-mono text-xs">{t.number}</span>,
                  sort: (t) => t.number,
                },
                { header: translate("التاريخ"), cell: (t) => dateFr(t.date), sort: (t) => t.date },
                {
                  header: translate("السوق"),
                  cell: (t) => (
                    <span className="font-medium">
                      {translate(L.market.get(t.marketId)?.name ?? "")}
                    </span>
                  ),
                },
                {
                  header: translate("غرفة التبريد المصدر"),
                  cell: (t) =>
                    [...new Set(t.loads.map((l) => l.frigoId))]
                      .map((f) => translate(L.frigo.get(f)?.name ?? ""))
                      .join(" + "),
                },
                {
                  header: translate("البضاعة المرسلة"),
                  cell: (t) => `${num(t.totals.sent)} kg`,
                  sort: (t) => t.totals.sent,
                },
                {
                  header: translate("المبيعات"),
                  cell: (t) => dt(t.totals.total),
                  sort: (t) => t.totals.total,
                },
                {
                  header: translate("المقبوض"),
                  cell: (t) => <span className="text-primary">{dt(t.totals.paid)}</span>,
                  sort: (t) => t.totals.paid,
                },
                { header: translate("الحالة"), cell: (t) => <Status value={t.status} /> },
                { header: "", cell: () => <Eye className="size-4 text-muted-foreground" /> },
              ]}
            />
          </Panel>
        </TabsContent>
      </Tabs>
      {creating && (
        <NewTrip
          onClose={() => setCreating(false)}
          defaultTeam={teamFilter === "all" ? (state.teams[0]?.id ?? "") : teamFilter}
        />
      )}
    </div>
  );
}

function NewTrip({ onClose, defaultTeam }: { onClose: () => void; defaultTeam: string }) {
  useLanguage();
  const { state, run, me, can } = useApp();
  const navigate = useNavigate();
  const frigos = state.frigos.filter((f) => f.active);
  const [srcFrigos, setSrcFrigos] = useState<string[]>(frigos[0] ? [frigos[0].id] : []);
  const [f, setF] = useState<TripInput>({
    marketId: state.markets[0]?.id ?? "",
    newMarketName: "",
    teamId: me?.teamId && !can("administration") ? me.teamId : defaultTeam,
    loads: [{ productId: "", frigoId: frigos[0]?.id ?? "", quantity: 0 }],
    // les caisses des clients ne partent pas dans le camion
    boxes: state.packagingTypes
      .filter((t) => t.active && !t.clientOwned)
      .map((t) => ({ typeId: t.id, quantity: 0 })),
    notes: "",
  });
  const setLoad = (i: number, patch: Partial<TripInput["loads"][number]>) =>
    setF({ ...f, loads: f.loads.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const toggleFrigo = (id: string) => {
    const next = srcFrigos.includes(id) ? srcFrigos.filter((x) => x !== id) : [...srcFrigos, id];
    if (!next.length) return;
    setSrcFrigos(next);
    setF({
      ...f,
      loads: f.loads.map((l) => (next.includes(l.frigoId) ? l : { ...l, frigoId: next[0] ?? "" })),
    });
  };
  const totalKg = f.loads.reduce((a, l) => a + (l.quantity || 0), 0);
  const totalBoxes = f.boxes.reduce((a, b) => a + (b.quantity || 0), 0);

  const submit = () => {
    const id = `trip_${Date.now().toString(36)}`;
    if (run(createMarketTrip, { ...f, id })) {
      onClose();
      navigate({ to: "/marches/$id", params: { id } });
    }
  };

  return (
    <FormDialog
      wide
      open
      onOpenChange={onClose}
      title={translate("إرسالية سوق جديدة")}
      description={translate("تُخصم الكميات من غرف التبريد المختارة عند الانطلاق.")}
      submitLabel={translate("تأكيد الانطلاق")}
      onSubmit={submit}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="1. السوق">
          <NativeSelect
            value={f.marketId}
            onChange={(e) => setF({ ...f, marketId: e.target.value })}
          >
            {state.markets
              .filter((m) => m.active)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {translate(m.name)}
                </option>
              ))}
            <option value="">{translate("سوق آخر…")}</option>
          </NativeSelect>
          {!f.marketId && (
            <Input
              className="mt-2"
              required
              maxLength={80}
              placeholder={translate("اسم السوق، مثال: سوق صفاقس")}
              value={f.newMarketName}
              onChange={(e) => setF({ ...f, newMarketName: e.target.value })}
            />
          )}
        </Field>
        <Field label="2. فيغو / الفريق">
          <NativeSelect
            value={f.teamId}
            disabled={!!me?.teamId && !can("administration")}
            onChange={(e) => setF({ ...f, teamId: e.target.value })}
          >
            {state.teams.map((t) => (
              <option key={t.id} value={t.id}>
                {translate(t.name)}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="3. غرفة التبريد المصدر">
          <div className="flex flex-wrap gap-1.5">
            {frigos.map((fr) => (
              <Button
                key={fr.id}
                type="button"
                size="sm"
                variant={srcFrigos.includes(fr.id) ? "default" : "outline"}
                onClick={() => toggleFrigo(fr.id)}
              >
                {translate(fr.name)}
              </Button>
            ))}
          </div>
        </Field>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">
          <Text>{"4. المنتجات المرسلة (kg)"}</Text>
        </p>
        {f.loads.map((l, i) => {
          const av = l.productId ? stockOf(state, l.productId, l.frigoId) : null;
          return (
            <div key={i} className="grid grid-cols-12 items-start gap-2 rounded-lg bg-muted/50 p-2">
              <div className="col-span-12 sm:col-span-5">
                <NativeSelect
                  value={l.productId}
                  onChange={(e) => setLoad(i, { productId: e.target.value })}
                >
                  <option value="">{translate("اختر المنتج…")}</option>
                  {state.products
                    .filter((p) => p.active)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {translate(p.name)}
                      </option>
                    ))}
                </NativeSelect>
                {av !== null && (
                  <p
                    className={
                      av < l.quantity
                        ? "mt-1 text-xs text-destructive"
                        : "mt-1 text-xs text-muted-foreground"
                    }
                  >
                    <Text>{"المتوفر: "}</Text>
                    {num(av)} kg
                  </p>
                )}
              </div>
              <div className="col-span-6 sm:col-span-3">
                <NativeSelect
                  value={l.frigoId}
                  onChange={(e) => setLoad(i, { frigoId: e.target.value })}
                >
                  {srcFrigos.map((id) => (
                    <option key={id} value={id}>
                      {translate(state.frigos.find((x) => x.id === id)?.name ?? "")}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="col-span-5 sm:col-span-3">
                <Input
                  type="number"
                  min={0}
                  step="0.001"
                  inputMode="decimal"
                  placeholder={translate("كغ، مثال: 50")}
                  value={l.quantity || ""}
                  onChange={(e) => setLoad(i, { quantity: Number(e.target.value) })}
                />
              </div>
              <div className="col-span-1">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => setF({ ...f, loads: f.loads.filter((_, j) => j !== i) })}
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
            setF({
              ...f,
              loads: [...f.loads, { productId: "", frigoId: srcFrigos[0] ?? "", quantity: 0 }],
            })
          }
        >
          <Plus className="size-4" />
          <Text>{"إضافة منتج"}</Text>
        </Button>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">
          <Text>{"5. الصناديق المحمّلة"}</Text>
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {f.boxes.map((b, i) => {
            const t = state.packagingTypes.find((x) => x.id === b.typeId);
            return (
              <div key={b.typeId} className="flex items-center gap-2 rounded-lg bg-muted/50 p-2">
                <span
                  className="size-3 shrink-0 rounded-full border"
                  style={{ backgroundColor: t?.hex }}
                />
                <span className="flex-1 text-sm">{translate(t?.name ?? "")}</span>
                <Input
                  type="number"
                  min={0}
                  step="1"
                  inputMode="numeric"
                  placeholder={translate("مثال: 10")}
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
            );
          })}
        </div>
      </div>
      <Field label="ملاحظات">
        <Textarea
          rows={2}
          maxLength={500}
          placeholder={translate("مثال: الشاحنة 2، السائق علي")}
          value={f.notes}
          onChange={(e) => setF({ ...f, notes: e.target.value })}
        />
      </Field>
      <div className="grid grid-cols-2 gap-2 rounded-xl bg-mint p-4 text-center">
        <div>
          <p className="text-xs text-muted-foreground">
            <Text>{"إجمالي البضاعة"}</Text>
          </p>
          <p className="font-display text-lg font-semibold">{num(totalKg)} kg</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">
            <Text>{"إجمالي الصناديق"}</Text>
          </p>
          <p className="font-display text-lg font-semibold">{num(totalBoxes)}</p>
        </div>
      </div>
    </FormDialog>
  );
}
