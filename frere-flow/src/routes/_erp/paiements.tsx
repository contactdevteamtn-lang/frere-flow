import { Text, translate, useLanguage } from "@/lib/i18n";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isMarketClient, isMarketCredit } from "@/services/ops";
import { useApp, useLookups, useTeamScope } from "@/store/store";
import { DataTable } from "@/components/app/DataTable";
import { Field, FormDialog, NativeSelect, Edit } from "@/components/app/forms";
import { PageHeader, Panel } from "@/components/app/ui";
import { METHODES, dateTimeFr, dt, methodeLabel } from "@/lib/format";
import { PayCreditDialog } from "./credits";
import type { Credit } from "@/types";
import { FiltreFrigo, dansFrigo, frigoCredit, frigoVente } from "@/components/app/FiltreFrigo";

export const Route = createFileRoute("/_erp/paiements")({
  head: () => ({
    meta: [
      { title: "Paiements — Frère Mahjoub" },
      {
        name: "description",
        content: "Historique des paiements de ventes et règlements de crédits.",
      },
      { property: "og:title", content: "Paiements — Frère Mahjoub" },
      {
        property: "og:description",
        content: "Historique des paiements de ventes et règlements de crédits.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Paiements,
});

function Paiements() {
  useLanguage();
  const { state } = useApp();
  const L = useLookups();
  const inScope = useTeamScope();
  const [method, setMethod] = useState("all");
  const [frigo, setFrigo] = useState("all");
  const [pick, setPick] = useState(false);
  const [creditId, setCreditId] = useState("");
  const [credit, setCredit] = useState<Credit | null>(null);

  const rows = [
    ...state.payments.map((p) => ({
      id: p.id,
      date: p.paymentDate,
      clientId: p.clientId,
      teamId: p.teamId,
      userId: p.userId,
      amount: p.amount,
      method: p.paymentMethod,
      kind: translate("دفعة بيع"),
      ref: L.sale.get(p.saleId)?.number ?? "",
    })),
    ...state.creditPayments.map((p) => {
      const c = state.credits.find((x) => x.id === p.creditId);
      return {
        id: p.id,
        date: p.paymentDate,
        clientId: p.clientId,
        teamId: p.teamId,
        userId: p.userId,
        amount: p.amount,
        method: p.paymentMethod,
        kind: translate("سداد دين"),
        ref: c?.saleId ? (L.sale.get(c.saleId)?.number ?? "") : translate("دين يدوي"),
      };
    }),
  ]
    .filter(
      (p) =>
        !isMarketClient(state, p.clientId) &&
        inScope(p.teamId) &&
        (method === "all" || p.method === method),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  const openCredits = state.credits.filter(
    (c) =>
      !isMarketCredit(state, c) &&
      inScope(c.teamId) &&
      c.remainingAmount > 0 &&
      c.creditStatusId !== "cs_cancelled",
  );

  return (
    <div>
      <PageHeader
        title={translate("المدفوعات")}
        subtitle={translate(`${rows.length} دفعات · ${dt(rows.reduce((a, p) => a + p.amount, 0))}`)}
        actions={
          <Edit>
            <Button onClick={() => setPick(true)}>
              <Plus className="size-4" />
              {<Text>{" تحصيل دين"}</Text>}
            </Button>
          </Edit>
        }
      />
      <Panel>
        <DataTable
          rows={rows.filter((r) => {
            // frigo du paiement : celui de la vente payée (ou de la vente du crédit remboursé)
            const p = state.payments.find((x) => x.id === r.id);
            if (p) return dansFrigo(frigo, frigoVente(state, p.saleId));
            const cp = state.creditPayments.find((x) => x.id === r.id);
            const c = cp && state.credits.find((x) => x.id === cp.creditId);
            return dansFrigo(frigo, c ? frigoCredit(state, c) : undefined);
          })}
          search={(p) => `${L.client.get(p.clientId)?.name} ${p.ref}`}
          filters={
            <>
              <FiltreFrigo value={frigo} onChange={setFrigo} />
              <NativeSelect
                className="sm:w-44"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              >
                <option value="all">{<Text>{"كل طرق الدفع"}</Text>}</option>
                {METHODES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {translate(m.label ?? "")}
                  </option>
                ))}
              </NativeSelect>
            </>
          }
          columns={[
            { header: translate("التاريخ"), cell: (p) => dateTimeFr(p.date), sort: (p) => p.date },
            {
              header: translate("العميل"),
              cell: (p) => (
                <span className="font-medium">
                  {translate(L.client.get(p.clientId)?.name ?? "")}
                </span>
              ),
            },
            { header: translate("النوع"), cell: (p) => p.kind },
            {
              header: translate("المرجع"),
              cell: (p) => <span className="font-mono text-xs">{p.ref}</span>,
            },
            { header: translate("غرفة التبريد"), cell: (p) => L.team.get(p.teamId)?.name },
            { header: translate("المستخدم"), cell: (p) => L.user.get(p.userId)?.name },
            { header: translate("طريقة الدفع"), cell: (p) => methodeLabel(p.method) },
            {
              header: translate("المبلغ"),
              cell: (p) => <b className="text-primary">{dt(p.amount)}</b>,
              sort: (p) => p.amount,
            },
          ]}
        />
      </Panel>
      {pick && (
        <FormDialog
          open
          onOpenChange={() => setPick(false)}
          title={translate("اختيار الدين")}
          submitLabel={translate("متابعة")}
          onSubmit={() => {
            const c = openCredits.find((x) => x.id === creditId);
            if (c) {
              setCredit(c);
              setPick(false);
            }
          }}
        >
          <Field label={translate("دين مفتوح")}>
            <NativeSelect required value={creditId} onChange={(e) => setCreditId(e.target.value)}>
              <option value="">{<Text>{"اختر…"}</Text>}</option>
              {openCredits.map((c) => (
                <option key={c.id} value={c.id}>
                  {translate(L.client.get(c.clientId)?.name ?? "")} ·{" "}
                  {translate(L.team.get(c.teamId)?.name ?? "")}
                  {<Text>{" · المتبقي "}</Text>}
                  {dt(c.remainingAmount)}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </FormDialog>
      )}
      {credit && <PayCreditDialog credit={credit} onClose={() => setCredit(null)} />}
    </div>
  );
}
