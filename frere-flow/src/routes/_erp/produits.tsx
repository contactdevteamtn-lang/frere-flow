import {
  DisplayLanguageFilter,
  showIn,
  type DisplayLang,
} from "@/components/app/DisplayLanguageFilter";
import { Text, translate, useLanguage } from "@/lib/i18n";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useApp } from "@/store/store";
import { remove, stockOf, stockTotal, upsert } from "@/services/ops";
import type { Product } from "@/types";
import { DataTable } from "@/components/app/DataTable";
import { Confirm, Field, FormDialog, NomAutreLangue } from "@/components/app/forms";
import { PageHeader, Panel, Status } from "@/components/app/ui";
import { dt, num } from "@/lib/format";

export const Route = createFileRoute("/_erp/produits")({
  head: () => ({
    meta: [
      { title: "Produits — Frère Mahjoub" },
      { name: "description", content: "Catalogue des produits partagés entre les Figos." },
      { property: "og:title", content: "Produits — Frère Mahjoub" },
      { property: "og:description", content: "Catalogue des produits partagés entre les Figos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Produits,
});

type Draft = Omit<Product, "id"> & { id?: string };
const blank = (): Draft => ({
  reference: "",
  name: "",
  category: translate("خضروات"),
  unit: "kg",
  salePrice: 0,
  alertThreshold: 150,
  active: true,
});

function Produits() {
  const { language } = useLanguage();
  const { state, run, can, readOnly } = useApp();
  const manage = can("administration") || can("caisse");
  const [edit, setEdit] = useState<Draft | null>(null);
  const [del, setDel] = useState<string | null>(null);
  const [lang, setLang] = useState<DisplayLang>(language);
  const rows = state.products.map((p) => ({ ...p, total: stockTotal(state, p.id) }));

  return (
    <div>
      <PageHeader
        title={translate("المنتجات")}
        subtitle={translate("منتجات مشتركة بين فيغو 1 وفيغو 2 — مخزون مستقل لكل غرفة تبريد")}
        actions={
          manage && (
            <Button onClick={() => setEdit(blank())}>
              <Plus className="size-4" />
              {<Text>{" منتج جديد"}</Text>}
            </Button>
          )
        }
      />
      <Panel>
        <DataTable
          rows={rows}
          filters={<DisplayLanguageFilter value={lang} onChange={setLang} />}
          search={(r) => `${r.reference} ${showIn(r.name, "both")} ${showIn(r.category, "both")}`}
          columns={[
            {
              header: translate("المرجع"),
              cell: (r) => <span className="font-mono text-xs">{r.reference}</span>,
              sort: (r) => r.reference,
            },
            {
              header: translate("المنتج"),
              cell: (r) => <span className="font-medium">{showIn(r.name, lang)}</span>,
              sort: (r) => r.name,
            },
            {
              header: translate("الفئة"),
              cell: (r) => showIn(r.category, lang),
              sort: (r) => r.category,
            },
            {
              header: translate("السعر"),
              cell: (r) => `${dt(r.salePrice)} / ${r.unit}`,
              sort: (r) => r.salePrice,
            },
            ...state.frigos.map((f) => ({
              header: f.name,
              cell: (r: (typeof rows)[number]) => {
                const q = stockOf(state, r.id, f.id);
                return (
                  <span className={q < r.alertThreshold ? "font-semibold text-destructive" : ""}>
                    {num(q)}
                  </span>
                );
              },
            })),
            {
              header: translate("الإجمالي"),
              cell: (r) => (
                <span className="font-semibold">
                  {num(r.total)} {translate(r.unit ?? "")}
                </span>
              ),
              sort: (r) => r.total,
            },
            {
              header: translate("الحالة"),
              cell: (r) => <Status value={r.active ? "ON" : "OFF"} />,
            },
            ...(manage
              ? [
                  {
                    header: "",
                    cell: (r: (typeof rows)[number]) => (
                      <div className="flex">
                        <Button size="icon" variant="ghost" onClick={() => setEdit(r)}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setDel(r.id)}>
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    ),
                  },
                ]
              : []),
          ]}
        />
      </Panel>
      {edit && (
        <FormDialog
          open
          onOpenChange={() => setEdit(null)}
          title={edit.id ? translate("تعديل المنتج") : translate("منتج جديد")}
          onSubmit={() =>
            edit.name &&
            run(upsert, "products", {
              ...edit,
              reference:
                edit.reference || `PDT-${String(state.products.length + 1).padStart(3, "0")}`,
            }) &&
            setEdit(null)
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={translate("الاسم")} className="sm:col-span-2">
              <Input
                required
                maxLength={80}
                autoComplete="off"
                placeholder={translate("مثال: كوسة")}
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
            <Field label={translate("المرجع")}>
              <Input
                maxLength={20}
                dir="ltr"
                placeholder={translate("مثال: PDT-008 (فارغ = تلقائي)")}
                value={edit.reference}
                onChange={(e) => setEdit({ ...edit, reference: e.target.value })}
              />
            </Field>
            <Field label={translate("الفئة")}>
              <Input
                maxLength={40}
                placeholder={translate("مثال: خضروات")}
                value={edit.category}
                onChange={(e) => setEdit({ ...edit, category: e.target.value })}
              />
            </Field>
            <Field label={translate("سعر البيع (د.ت)")}>
              <Input
                type="number"
                step="0.001"
                min={0.001}
                required
                inputMode="decimal"
                placeholder={translate("مثال: 1.250")}
                value={edit.salePrice || ""}
                onChange={(e) => setEdit({ ...edit, salePrice: Number(e.target.value) })}
              />
            </Field>
            <Field label={translate("الوحدة")}>
              <Input
                maxLength={10}
                dir="ltr"
                placeholder={translate("مثال: kg")}
                value={edit.unit}
                onChange={(e) => setEdit({ ...edit, unit: e.target.value })}
              />
            </Field>
            <Field label={translate("حد التنبيه لكل غرفة تبريد")}>
              <Input
                type="number"
                min={0}
                step="1"
                inputMode="numeric"
                placeholder={translate("مثال: 150")}
                value={edit.alertThreshold}
                onChange={(e) => setEdit({ ...edit, alertThreshold: Number(e.target.value) })}
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
      <Confirm
        open={!!del}
        onOpenChange={() => setDel(null)}
        title={translate("حذف هذا المنتج؟")}
        description={translate("لا يمكن التراجع عن هذا الإجراء.")}
        label={translate("حذف")}
        onConfirm={() => {
          if (del) run(remove, "products", del);
          setDel(null);
        }}
      />
    </div>
  );
}
