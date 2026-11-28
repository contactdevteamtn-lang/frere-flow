import { Text, translate, useLanguage } from "@/lib/i18n";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useApp } from "@/store/store";
import { packBalance, upsert } from "@/services/ops";
import type { Client } from "@/types";
import { DataTable } from "@/components/app/DataTable";
import { Field, FormDialog, Edit, NomAutreLangue } from "@/components/app/forms";
import { PageHeader, Panel, Status } from "@/components/app/ui";
import { dt, num } from "@/lib/format";

export const Route = createFileRoute("/_erp/clients/")({
  head: () => ({
    meta: [
      { title: "Clients — Frère Mahjoub" },
      { name: "description", content: "Liste et gestion des clients." },
      { property: "og:title", content: "Clients — Frère Mahjoub" },
      { property: "og:description", content: "Liste et gestion des clients." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Clients,
});

const blank = (): Omit<Client, "id"> & { id?: string } => ({
  code: "",
  name: "",
  phone: "",
  address: "",
  email: "",
  taxId: "",
  active: true,
  createdAt: new Date().toISOString(),
});

function Clients() {
  useLanguage();
  const { state, run } = useApp();
  const nav = useNavigate();
  const [edit, setEdit] = useState<ReturnType<typeof blank> | null>(null);

  // clients des marchés : gérés dans la section Marchés
  const rows = state.clients
    .filter((c) => !c.marketId)
    .map((c) => {
      const sales = state.sales.filter(
        (s) => s.clientId === c.id && s.saleStatusId !== "ss_cancelled",
      );
      const teams = [...new Set(sales.map((s) => s.teamId))]
        .map((t) => translate(state.teams.find((x) => x.id === t)?.name ?? ""))
        .join(", ");
      const credit = state.credits
        .filter(
          (x) => x.clientId === c.id && !["cs_paid", "cs_cancelled"].includes(x.creditStatusId),
        )
        .reduce((a, x) => a + x.remainingAmount, 0);
      return {
        ...c,
        teams,
        total: sales.reduce((a, s) => a + s.totalAmount, 0),
        credit,
        pack: packBalance(state, { clientId: c.id }).remaining,
      };
    });

  const save = () => {
    if (!edit?.name.trim()) return;
    const item = {
      ...edit,
      code: edit.code || `CL-${String(state.clients.length + 1).padStart(4, "0")}`,
    };
    if (run(upsert, "clients", item)) setEdit(null);
  };

  return (
    <div>
      <PageHeader
        title={translate("العملاء")}
        subtitle={translate("يمكن للعميل التعامل مع فيغو 1 أو فيغو 2 أو كليهما")}
        actions={
          <Edit>
            <Button onClick={() => setEdit(blank())}>
              <Plus className="size-4" />
              {<Text>{" عميل جديد"}</Text>}
            </Button>
          </Edit>
        }
      />
      <Panel>
        <DataTable
          rows={rows}
          search={(r) => `${r.code} ${translate(r.name ?? "")} ${r.phone} ${r.address}`}
          onRowClick={(r) => nav({ to: "/clients/$id", params: { id: r.id } })}
          columns={[
            {
              header: translate("الرمز"),
              cell: (r) => <span className="font-mono text-xs">{r.code}</span>,
              sort: (r) => r.code,
            },
            {
              header: translate("الاسم"),
              cell: (r) => <span className="font-medium">{translate(r.name ?? "")}</span>,
              sort: (r) => r.name,
            },
            { header: translate("الهاتف"), cell: (r) => r.phone },
            { header: translate("العنوان"), cell: (r) => r.address },
            { header: translate("فرق فيغو"), cell: (r) => r.teams || "—" },
            {
              header: translate("إجمالي المشتريات"),
              cell: (r) => dt(r.total),
              sort: (r) => r.total,
            },
            {
              header: translate("رصيد الدين"),
              // solde lisible : rouge = dû par le client, vert = soldé
              cell: (r) =>
                r.credit > 0 ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-2.5 py-0.5 text-sm font-bold text-destructive">
                    {dt(r.credit)}
                    <span className="text-xs font-medium">{translate("مستحق")}</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-primary-dark">
                    {translate("مسدد")} · {dt(0)}
                  </span>
                ),
              sort: (r) => r.credit,
            },
            { header: translate("الصناديق"), cell: (r) => num(r.pack), sort: (r) => r.pack },
            {
              header: translate("الحالة"),
              cell: (r) => <Status value={r.active ? "ON" : "OFF"} />,
            },
            {
              header: "",
              cell: (r) => (
                <Edit>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEdit(r);
                    }}
                  >
                    <Pencil className="size-4" />
                  </Button>
                </Edit>
              ),
            },
          ]}
        />
      </Panel>
      {edit && (
        <FormDialog
          open
          onOpenChange={() => setEdit(null)}
          title={edit.id ? translate("تعديل العميل") : translate("عميل جديد")}
          onSubmit={save}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={translate("الاسم الكامل")} className="sm:col-span-2">
              <Input
                required
                maxLength={80}
                autoComplete="off"
                placeholder={translate("مثال: أحمد بن صالح")}
                value={edit.name}
                onChange={(e) => setEdit({ ...edit, name: e.target.value })}
              />
            </Field>
            <NomAutreLangue
              className="sm:col-span-2"
              name={edit.name}
              value={edit.nameAlt}
              onChange={(v) => setEdit({ ...edit, nameAlt: v })}
            />
            <Field label={translate("الهاتف")}>
              <Input
                type="tel"
                inputMode="tel"
                maxLength={20}
                dir="ltr"
                placeholder={translate("مثال: 98 123 456")}
                value={edit.phone}
                onChange={(e) => setEdit({ ...edit, phone: e.target.value })}
              />
            </Field>
            <Field label={translate("البريد الإلكتروني")}>
              <Input
                type="email"
                inputMode="email"
                maxLength={120}
                dir="ltr"
                placeholder={translate("مثال: client@exemple.tn")}
                value={edit.email}
                onChange={(e) => setEdit({ ...edit, email: e.target.value })}
              />
            </Field>
            <Field label={translate("العنوان")} className="sm:col-span-2">
              <Input
                maxLength={200}
                placeholder={translate("مثال: شارع الحبيب بورقيبة، صفاقس")}
                value={edit.address}
                onChange={(e) => setEdit({ ...edit, address: e.target.value })}
              />
            </Field>
            <Field label={translate("المعرف الجبائي")}>
              <Input
                maxLength={25}
                dir="ltr"
                placeholder={translate("مثال: 1234567/A/M/000")}
                value={edit.taxId}
                onChange={(e) => setEdit({ ...edit, taxId: e.target.value })}
              />
            </Field>
            <Field label={translate("نشط")}>
              <div className="pt-1.5">
                <Switch
                  checked={edit.active}
                  onCheckedChange={(v) => setEdit({ ...edit, active: v })}
                />
              </div>
            </Field>
          </div>
        </FormDialog>
      )}
    </div>
  );
}
