import { Text, translate, useLanguage } from "@/lib/i18n";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Mail, MapPin, Phone, FileText, AlertTriangle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApp, useLookups } from "@/store/store";
import { effectiveCreditCode, packBalance, clientBoxBalance } from "@/services/ops";
import { Kpi, PageHeader, Panel, Status, Swatch, Empty } from "@/components/app/ui";
import { DataTable } from "@/components/app/DataTable";
import { dateFr, dateTimeFr, dt, methodeLabel, num } from "@/lib/format";
import { CreditCard, ShoppingCart, Boxes, Wallet } from "lucide-react";

export const Route = createFileRoute("/_erp/clients/$id")({
  head: () => ({
    meta: [
      { title: "Fiche client — Frère Mahjoub" },
      { name: "description", content: "Historique complet du client par Figo." },
      { property: "og:title", content: "Fiche client — Frère Mahjoub" },
      { property: "og:description", content: "Historique complet du client par Figo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ClientPage,
});

function ClientPage() {
  useLanguage();
  const { id } = Route.useParams();
  const { state } = useApp();
  const L = useLookups();
  const c = state.clients.find((x) => x.id === id);
  if (!c) return <Empty text={translate("العميل غير موجود")} />;
  const today = new Date().toISOString();
  const sales = state.sales.filter((s) => s.clientId === id);
  const credits = state.credits.filter((x) => x.clientId === id);
  const pays = [
    ...state.payments
      .filter((p) => p.clientId === id)
      .map((p) => ({
        id: p.id,
        date: p.paymentDate,
        amount: p.amount,
        method: p.paymentMethod,
        teamId: p.teamId,
        kind: translate("دفعة بيع"),
      })),
    ...state.creditPayments
      .filter((p) => p.clientId === id)
      .map((p) => ({
        id: p.id,
        date: p.paymentDate,
        amount: p.amount,
        method: p.paymentMethod,
        teamId: p.teamId,
        kind: translate("سداد دين"),
      })),
  ].sort((a, b) => b.date.localeCompare(a.date));
  const open = credits.filter((x) => !["cs_paid", "cs_cancelled"].includes(x.creditStatusId));
  const pack = packBalance(state, { clientId: id });
  const activity = state.auditLogs
    .filter(
      (l) =>
        sales.some((s) => s.id === l.entityId) ||
        credits.some((x) => x.id === l.entityId) ||
        l.entityId === id,
    )
    .slice(0, 30);

  return (
    <div className="space-y-6">
      <Link
        to="/clients"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {<Text>{" العملاء"}</Text>}
      </Link>
      <PageHeader
        title={translate(c.name ?? "")}
        subtitle={translate(`${c.code} · عميل منذ ${dateFr(c.createdAt)}`)}
        actions={<Status value={c.active ? "ON" : "OFF"} />}
      />
      <Panel>
        <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <p className="flex items-center gap-2">
            <Phone className="size-4 text-primary" /> {c.phone || "—"}
          </p>
          <p className="flex items-center gap-2">
            <Mail className="size-4 text-primary" /> {c.email || "—"}
          </p>
          <p className="flex items-center gap-2">
            <MapPin className="size-4 text-primary" /> {translate(c.address ?? "") || "—"}
          </p>
          <p className="flex items-center gap-2">
            <FileText className="size-4 text-primary" /> MF {c.taxId || "—"}
          </p>
        </div>
      </Panel>

      <div className="grid gap-4 md:grid-cols-2">
        {state.teams.map((t) => {
          const ts = sales.filter((s) => s.teamId === t.id && s.saleStatusId !== "ss_cancelled");
          const tc = open.filter((x) => x.teamId === t.id);
          const tp = pays.filter((p) => p.teamId === t.id);
          const pk = packBalance(state, { clientId: id, teamId: t.id });
          return (
            <Panel key={t.id} title={translate(t.name ?? "")}>
              <div className="grid grid-cols-2 gap-3">
                <Kpi
                  label={translate("المبيعات")}
                  value={`${ts.length} · ${dt(ts.reduce((a, s) => a + s.totalAmount, 0))}`}
                  icon={ShoppingCart}
                />
                <Kpi
                  label={translate("الدين المتبقي")}
                  value={dt(tc.reduce((a, x) => a + x.remainingAmount, 0))}
                  hint={translate(`${tc.length} ديون مفتوحة`)}
                  icon={CreditCard}
                  tone="warning"
                />
                <Kpi
                  label={translate("المدفوعات")}
                  value={`${tp.length} · ${dt(tp.reduce((a, p) => a + p.amount, 0))}`}
                  icon={Wallet}
                  tone="leaf"
                />
                <Kpi
                  label={translate("الصناديق المتبقية")}
                  value={num(pk.remaining)}
                  icon={Boxes}
                />
              </div>
            </Panel>
          );
        })}
      </div>

      <Panel>
        <Tabs defaultValue="ventes">
          <TabsList className="flex-wrap">
            <TabsTrigger value="ventes">
              {translate("المبيعات")} ({sales.length})
            </TabsTrigger>
            <TabsTrigger value="credits">
              {translate("الديون")} ({credits.length})
            </TabsTrigger>
            <TabsTrigger value="paiements">
              {translate("المدفوعات")} ({pays.length})
            </TabsTrigger>
            <TabsTrigger value="emballages">{<Text>{"الصناديق"}</Text>}</TabsTrigger>
            <TabsTrigger value="activite">{<Text>{"النشاط"}</Text>}</TabsTrigger>
          </TabsList>
          <TabsContent value="ventes" className="pt-4">
            <DataTable
              rows={sales}
              columns={[
                { header: translate("الرقم"), cell: (s) => s.number },
                { header: translate("التاريخ"), cell: (s) => dateFr(s.saleDate) },
                { header: translate("فيغو"), cell: (s) => L.team.get(s.teamId)?.name },
                { header: translate("غرفة التبريد"), cell: (s) => L.frigo.get(s.frigoId)?.name },
                {
                  header: translate("المنتجات"),
                  cell: (s) =>
                    state.saleItems
                      .filter((i) => i.saleId === s.id)
                      .map((i) => `${L.product.get(i.productId)?.name} ${i.quantity}kg`)
                      .join(", "),
                },
                { header: translate("الإجمالي"), cell: (s) => dt(s.totalAmount) },
                { header: translate("المدفوع"), cell: (s) => dt(s.paidAmount) },
                { header: translate("المتبقي"), cell: (s) => dt(s.remainingAmount) },
                {
                  header: translate("الحالة"),
                  cell: (s) => (
                    <Status
                      value={L.saleStatus.get(s.saleStatusId)!.code}
                      label={L.saleStatus.get(s.saleStatusId)!.label}
                    />
                  ),
                },
              ]}
            />
          </TabsContent>
          <TabsContent value="credits" className="pt-4">
            <DataTable
              rows={credits}
              columns={[
                {
                  header: translate("عملية بيع"),
                  cell: (x) => (x.saleId ? L.sale.get(x.saleId)?.number : translate("يدوي")),
                },
                { header: translate("فيغو"), cell: (x) => L.team.get(x.teamId)?.name },
                { header: translate("الإجمالي"), cell: (x) => dt(x.totalAmount) },
                { header: translate("المدفوع"), cell: (x) => dt(x.paidAmount) },
                { header: translate("المتبقي"), cell: (x) => dt(x.remainingAmount) },
                { header: translate("تاريخ الاستحقاق"), cell: (x) => dateFr(x.dueDate) },
                {
                  header: translate("الحالة"),
                  cell: (x) => <Status value={effectiveCreditCode(state, x, today)} />,
                },
              ]}
            />
          </TabsContent>
          <TabsContent value="paiements" className="pt-4">
            <DataTable
              rows={pays}
              columns={[
                { header: translate("التاريخ"), cell: (p) => dateTimeFr(p.date) },
                { header: translate("النوع"), cell: (p) => p.kind },
                { header: translate("فيغو"), cell: (p) => L.team.get(p.teamId)?.name },
                { header: translate("طريقة الدفع"), cell: (p) => methodeLabel(p.method) },
                {
                  header: translate("المبلغ"),
                  cell: (p) => <span className="font-semibold">{dt(p.amount)}</span>,
                },
              ]}
            />
          </TabsContent>
          <TabsContent value="emballages" className="space-y-4 pt-4">
            {pack.remaining >= state.settings.packagingAlert && (
              <div className="flex gap-2 rounded-lg bg-warning/15 p-3 text-sm text-warning-foreground">
                <AlertTriangle className="size-4" />
                {<Text>{" لدى هذا العميل "}</Text>}
                {pack.remaining}
                {<Text>{" صناديق غير مرجعة."}</Text>}
              </div>
            )}
            {state.teams.map((t) => (
              <div key={t.id}>
                <p className="mb-2 text-sm font-semibold">{translate(t.name ?? "")}</p>
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="p-2 text-start">{<Text>{"النوع"}</Text>}</th>
                        <th className="p-2 text-start">{<Text>{"اللون"}</Text>}</th>
                        <th className="p-2 text-end">{<Text>{"الصادر"}</Text>}</th>
                        <th className="p-2 text-end">{<Text>{"المرتجع"}</Text>}</th>
                        <th className="p-2 text-end">{<Text>{"المتبقي"}</Text>}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.packagingTypes.map((pt) => {
                        const b = packBalance(state, { clientId: id, typeId: pt.id, teamId: t.id });
                        if (!b.given) return null;
                        return (
                          <tr key={pt.id} className="border-t">
                            <td className="p-2">{translate(pt.name ?? "")}</td>
                            <td className="p-2">
                              <span className="inline-flex items-center gap-2">
                                <Swatch hex={pt.hex} />
                                {translate(pt.color ?? "")}
                              </span>
                            </td>
                            <td className="p-2 text-end">{b.given}</td>
                            <td className="p-2 text-end">{b.returned}</td>
                            <td className="p-2 text-end font-semibold">{b.remaining}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {clientBoxBalance(state, { clientId: id, teamId: t.id }).owed > 0 && (
                  <p className="mt-2 rounded-lg bg-secondary px-3 py-2 text-sm">
                    {<Text>{"صناديق العميل عندنا (لإرجاعها إليه): "}</Text>}
                    <b>{clientBoxBalance(state, { clientId: id, teamId: t.id }).owed}</b>
                  </p>
                )}
              </div>
            ))}
          </TabsContent>
          <TabsContent value="activite" className="pt-4">
            {activity.length ? (
              <ul className="space-y-2 text-sm">
                {activity.map((l) => (
                  <li key={l.id} className="flex justify-between gap-3 border-b pb-2">
                    <span>
                      <b>{translate(l.action ?? "")}</b> — {translate(l.details ?? "")}
                    </span>
                    <span className="shrink-0 text-muted-foreground">{dateTimeFr(l.date)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty />
            )}
          </TabsContent>
        </Tabs>
      </Panel>
    </div>
  );
}
