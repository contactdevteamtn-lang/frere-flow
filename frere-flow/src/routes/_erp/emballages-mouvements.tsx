import { Text, translate, useLanguage } from "@/lib/i18n";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApp, useLookups, useTeamScope } from "@/store/store";
import { addPackMovement, packBalance, clientBoxBalance } from "@/services/ops";
import { DataTable } from "@/components/app/DataTable";
import { Field, FormDialog, NativeSelect, Edit } from "@/components/app/forms";
import { PageHeader, Panel, Status, Swatch } from "@/components/app/ui";
import { dateTimeFr } from "@/lib/format";

export const Route = createFileRoute("/_erp/emballages-mouvements")({
  head: () => ({
    meta: [
      { title: "Mouvements d'emballages — Frère Mahjoub" },
      { name: "description", content: "Sorties et retours de caisses par client et par Frigo." },
      { property: "og:title", content: "Mouvements d'emballages — Frère Mahjoub" },
      {
        property: "og:description",
        content: "Sorties et retours de caisses par client et par Frigo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Moves,
});

function Moves() {
  useLanguage();
  const { state, run, teamFilter } = useApp();
  const L = useLookups();
  const inScope = useTeamScope();
  const [type, setType] = useState("all");
  const [form, setForm] = useState<null | {
    clientId: string;
    packagingTypeId: string;
    teamId: string;
    type: "SORTIE" | "RETOUR";
    quantity: number;
    notes: string;
  }>(null);
  const open = (t: "SORTIE" | "RETOUR") =>
    setForm({
      clientId: "",
      packagingTypeId: state.packagingTypes[0].id,
      teamId: teamFilter === "all" ? state.teams[0].id : teamFilter,
      type: t,
      quantity: 0,
      notes: "",
    });
  const rows = state.packagingMovements.filter(
    (m) => inScope(m.teamId) && (type === "all" || m.type === type),
  );
  const ownType = !!state.packagingTypes.find((t) => t.id === form?.packagingTypeId)?.clientOwned;
  const ownBal =
    form?.clientId && ownType
      ? clientBoxBalance(state, { clientId: form.clientId, teamId: form.teamId })
      : null;
  const bal =
    form?.clientId && !ownType
      ? packBalance(state, {
          clientId: form.clientId,
          typeId: form.packagingTypeId,
          teamId: form.teamId,
        })
      : null;

  return (
    <div>
      <PageHeader
        title={translate("حركات الصناديق")}
        subtitle={translate("الصادر − المرتجع = الصناديق لدى العميل")}
        actions={
          <Edit>
            <Button variant="outline" onClick={() => open("RETOUR")}>
              <ArrowDownToLine className="size-4" />
              {<Text>{" إرجاع"}</Text>}
            </Button>
            <Button onClick={() => open("SORTIE")}>
              <ArrowUpFromLine className="size-4" />
              {<Text>{" خروج"}</Text>}
            </Button>
          </Edit>
        }
      />
      <Panel>
        <DataTable
          rows={rows}
          search={(m) => `${L.client.get(m.clientId)?.name} ${L.pack.get(m.packagingTypeId)?.name}`}
          filters={
            <NativeSelect
              className="sm:w-40"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="all">{<Text>{"الكل"}</Text>}</option>
              <option value="SORTIE">{<Text>{"الصادر"}</Text>}</option>
              <option value="RETOUR">{<Text>{"المرتجع"}</Text>}</option>
            </NativeSelect>
          }
          columns={[
            { header: translate("التاريخ"), cell: (m) => dateTimeFr(m.date), sort: (m) => m.date },
            { header: translate("الحركة"), cell: (m) => <Status value={m.type} /> },
            {
              header: translate("العميل"),
              cell: (m) => (
                <span className="font-medium">
                  {translate(L.client.get(m.clientId)?.name ?? "")}
                </span>
              ),
            },
            {
              header: translate("النوع"),
              cell: (m) => {
                const t = L.pack.get(m.packagingTypeId);
                return (
                  <span className="inline-flex items-center gap-2">
                    <Swatch hex={t?.hex ?? ""} />
                    {translate(t?.name ?? "")}
                  </span>
                );
              },
            },
            {
              header: translate("الكمية"),
              cell: (m) => <b>{m.quantity}</b>,
              sort: (m) => m.quantity,
            },
            { header: translate("غرفة التبريد"), cell: (m) => L.team.get(m.teamId)?.name },
            {
              header: translate("عملية بيع"),
              cell: (m) => (
                <span className="font-mono text-xs">
                  {m.saleId ? L.sale.get(m.saleId)?.number : "—"}
                </span>
              ),
            },
            { header: translate("المستخدم"), cell: (m) => L.user.get(m.userId)?.name },
          ]}
        />
      </Panel>
      {form && (
        <FormDialog
          open
          onOpenChange={() => setForm(null)}
          title={
            ownType
              ? form.type === "SORTIE"
                ? translate("إرجاع صناديق العميل إليه")
                : translate("استلام صناديق العميل")
              : form.type === "SORTIE"
                ? translate("تسليم صناديق")
                : translate("إرجاع صناديق")
          }
          onSubmit={() => run(addPackMovement, form) && setForm(null)}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={translate("العميل")}>
              <NativeSelect
                required
                value={form.clientId}
                onChange={(e) => setForm({ ...form, clientId: e.target.value })}
              >
                <option value="">{<Text>{"اختر…"}</Text>}</option>
                {state.clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {translate(c.name ?? "")}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label={translate("غرفة التبريد")}>
              <NativeSelect
                value={form.teamId}
                onChange={(e) => setForm({ ...form, teamId: e.target.value })}
              >
                {state.teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {translate(t.name ?? "")}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label={translate("نوع الصندوق")}>
              <NativeSelect
                value={form.packagingTypeId}
                onChange={(e) => setForm({ ...form, packagingTypeId: e.target.value })}
              >
                {state.packagingTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {translate(t.name ?? "")}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label={translate("الكمية")}>
              <Input
                type="number"
                min={1}
                step="1"
                required
                inputMode="numeric"
                placeholder={translate("مثال: 10")}
                value={form.quantity || ""}
                onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
              />
            </Field>
            <Field label={translate("ملاحظات")} className="sm:col-span-2">
              <Input
                maxLength={500}
                placeholder={translate("مثال: صندوقان مكسوران")}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </Field>
          </div>
          {ownBal && (
            <p className="text-sm text-muted-foreground">
              {<Text>{"صناديق هذا العميل عندنا: "}</Text>}
              <b className="text-foreground">{ownBal.owed}</b>
            </p>
          )}
          {bal && (
            <p className="text-sm text-muted-foreground">
              {<Text>{"الرصيد الحالي لهذا الفريق: الصادر "}</Text>}
              {bal.given}
              {<Text>{" · المرتجع "}</Text>}
              {bal.returned} ·{" "}
              <b className="text-foreground">
                {<Text>{"المتبقي "}</Text>}
                {bal.remaining}
              </b>
            </p>
          )}
        </FormDialog>
      )}
    </div>
  );
}
