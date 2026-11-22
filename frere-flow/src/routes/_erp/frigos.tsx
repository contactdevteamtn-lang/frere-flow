import { Text, translate, useLanguage } from "@/lib/i18n";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Pencil, Snowflake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useApp } from "@/store/store";
import { stockOf, upsert } from "@/services/ops";
import type { Frigo } from "@/types";
import { Field, FormDialog, NomAutreLangue } from "@/components/app/forms";
import { PageHeader, Status } from "@/components/app/ui";
import { dt, num } from "@/lib/format";

export const Route = createFileRoute("/_erp/frigos")({
  head: () => ({
    meta: [
      { title: "Frigos — Frère Mahjoub" },
      { name: "description", content: "Chambres froides et leurs performances." },
      { property: "og:title", content: "Frigos — Frère Mahjoub" },
      { property: "og:description", content: "Chambres froides et leurs performances." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Frigos,
});

type Draft = Omit<Frigo, "id"> & { id?: string };

function Frigos() {
  useLanguage();
  const { state, run, can: canPerm, readOnly } = useApp();
  const can = (x: Parameters<typeof canPerm>[0]) => canPerm(x) && !readOnly;
  const [edit, setEdit] = useState<Draft | null>(null);
  return (
    <div>
      <PageHeader
        title={translate("غرف التبريد")}
        subtitle={translate("غرف التبريد والتخزين")}
        actions={
          can("frigos") && (
            <Button
              onClick={() =>
                setEdit({
                  name: "",
                  code: "",
                  capacity: 10000,
                  location: "",
                  description: "",
                  active: true,
                })
              }
            >
              <Plus className="size-4" />
              {<Text>{" غرفة تبريد جديدة"}</Text>}
            </Button>
          )
        }
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {state.frigos.map((f) => {
          const tot = state.products.reduce((a, p) => a + stockOf(state, p.id, f.id), 0);
          const sales = state.sales.filter(
            (s) => s.frigoId === f.id && s.saleStatusId !== "ss_cancelled",
          );
          return (
            <div key={f.id} className="rounded-xl border bg-card p-5 shadow-card">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-lg bg-secondary text-primary">
                    <Snowflake className="size-5" />
                  </span>
                  <div>
                    <p className="font-display font-semibold">
                      {translate(f.name ?? "")}{" "}
                      <span className="text-xs text-muted-foreground">({f.code})</span>
                    </p>
                    <p className="text-xs text-muted-foreground">{translate(f.location ?? "")}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Status value={f.active ? "ON" : "OFF"} />
                  {can("frigos") && (
                    <Button size="icon" variant="ghost" onClick={() => setEdit(f)}>
                      <Pencil className="size-4" />
                    </Button>
                  )}
                </div>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{translate(f.description ?? "")}</p>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
                <div className="rounded-lg bg-muted p-2">
                  <p className="text-xs text-muted-foreground">{<Text>{"المخزون"}</Text>}</p>
                  <b>{num(tot)} kg</b>
                </div>
                <div className="rounded-lg bg-muted p-2">
                  <p className="text-xs text-muted-foreground">{<Text>{"المبيعات"}</Text>}</p>
                  <b>{sales.length}</b>
                </div>
                <div className="rounded-lg bg-muted p-2">
                  <p className="text-xs text-muted-foreground">{<Text>{"رقم المعاملات"}</Text>}</p>
                  <b>{dt(sales.reduce((a, s) => a + s.totalAmount, 0))}</b>
                </div>
              </div>
              <div className="mt-3 h-2 rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-primary"
                  style={{ width: `${Math.min(100, (tot / f.capacity) * 100)}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {<Text>{"السعة "}</Text>}
                {num(f.capacity)} kg
              </p>
            </div>
          );
        })}
      </div>
      {edit && (
        <FormDialog
          open
          onOpenChange={() => setEdit(null)}
          title={edit.id ? translate("تعديل غرفة التبريد") : translate("غرفة تبريد جديدة")}
          onSubmit={() => edit.name && run(upsert, "frigos", edit) && setEdit(null)}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={translate("الاسم")}>
              <Input
                required
                maxLength={60}
                placeholder={translate("مثال: غرفة التبريد 4")}
                value={edit.name}
                onChange={(e) => setEdit({ ...edit, name: e.target.value })}
              />
            </Field>
            <NomAutreLangue
              name={edit.name}
              value={edit.nameAlt}
              onChange={(v) => setEdit({ ...edit, nameAlt: v })}
            />
            <Field label={translate("الرمز")}>
              <Input
                maxLength={10}
                dir="ltr"
                placeholder={translate("مثال: FR4")}
                value={edit.code}
                onChange={(e) => setEdit({ ...edit, code: e.target.value })}
              />
            </Field>
            <Field label={translate("السعة (كغ)")}>
              <Input
                type="number"
                min={1}
                step="1"
                required
                inputMode="numeric"
                placeholder={translate("مثال: 10000")}
                value={edit.capacity || ""}
                onChange={(e) => setEdit({ ...edit, capacity: Number(e.target.value) })}
              />
            </Field>
            <Field label={translate("الموقع")}>
              <Input
                maxLength={120}
                placeholder={translate("مثال: المنطقة الصناعية، صفاقس")}
                value={edit.location}
                onChange={(e) => setEdit({ ...edit, location: e.target.value })}
              />
            </Field>
            <Field label={translate("الوصف")} className="sm:col-span-2">
              <Input
                maxLength={200}
                placeholder={translate("مثال: فواكه وخضروات ورقية")}
                value={edit.description}
                onChange={(e) => setEdit({ ...edit, description: e.target.value })}
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
