import {
  DisplayLanguageFilter,
  showIn,
  type DisplayLang,
} from "@/components/app/DisplayLanguageFilter";
import { Text, translate, useLanguage } from "@/lib/i18n";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApp, useLookups } from "@/store/store";
import { addStockMovement, stockOf } from "@/services/ops";
import type { StockMovementType } from "@/types";
import { DataTable } from "@/components/app/DataTable";
import { Field, FormDialog, NativeSelect, Edit } from "@/components/app/forms";
import { PageHeader, Panel, Status } from "@/components/app/ui";
import { dateTimeFr, num } from "@/lib/format";
import { FiltreFrigo, dansFrigo, frigoCredit, frigoVente } from "@/components/app/FiltreFrigo";

export const Route = createFileRoute("/_erp/mouvements")({
  head: () => ({
    meta: [
      { title: "Mouvements de stock — Frère Mahjoub" },
      { name: "description", content: "Entrées, sorties, transferts et ajustements de stock." },
      { property: "og:title", content: "Mouvements de stock — Frère Mahjoub" },
      {
        property: "og:description",
        content: "Entrées, sorties, transferts et ajustements de stock.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Mouvements,
});

export function StockMoveButton() {
  useLanguage();
  const { state, run, can } = useApp();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({
    productId: "",
    frigoId: state.frigos[0]?.id ?? "",
    toFrigoId: state.frigos[1]?.id ?? "",
    quantity: 0,
    movementType: "ENTREE" as StockMovementType,
    reference: "",
    notes: "",
  });
  if (!can("frigos")) return null;
  const av = f.productId ? stockOf(state, f.productId, f.frigoId) : null;
  const dest =
    f.productId && f.movementType === "TRANSFERT" ? stockOf(state, f.productId, f.toFrigoId) : null;
  return (
    <>
      <Edit>
        <Button onClick={() => setOpen(true)}>
          <ArrowLeftRight className="size-4" />
          {<Text>{" حركة / نقل"}</Text>}
        </Button>
      </Edit>
      {open && (
        <FormDialog
          open
          onOpenChange={setOpen}
          title={translate("حركة مخزون")}
          onSubmit={() =>
            run(addStockMovement, {
              ...f,
              toFrigoId: f.movementType === "TRANSFERT" ? f.toFrigoId : undefined,
            }) && setOpen(false)
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={translate("النوع")}>
              <NativeSelect
                value={f.movementType}
                onChange={(e) => setF({ ...f, movementType: e.target.value as StockMovementType })}
              >
                <option value="ENTREE">{<Text>{"إدخال"}</Text>}</option>
                <option value="SORTIE">{<Text>{"خروج"}</Text>}</option>
                <option value="TRANSFERT">{<Text>{"نقل"}</Text>}</option>
                <option value="AJUSTEMENT">{<Text>{"تسوية (+/−)"}</Text>}</option>
              </NativeSelect>
            </Field>
            <Field label={translate("المنتج")}>
              <NativeSelect
                required
                value={f.productId}
                onChange={(e) => setF({ ...f, productId: e.target.value })}
              >
                <option value="">{<Text>{"اختر…"}</Text>}</option>
                {state.products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {translate(p.name ?? "")}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field
              label={
                f.movementType === "TRANSFERT"
                  ? translate("غرفة التبريد المصدر")
                  : translate("غرفة التبريد")
              }
            >
              <NativeSelect
                value={f.frigoId}
                onChange={(e) => setF({ ...f, frigoId: e.target.value })}
              >
                {state.frigos.map((x) => (
                  <option key={x.id} value={x.id}>
                    {translate(x.name ?? "")}
                  </option>
                ))}
              </NativeSelect>
              {av !== null && (
                <p className="text-xs text-muted-foreground">
                  {<Text>{"الحالي: "}</Text>}
                  {num(av)} kg
                </p>
              )}
            </Field>
            {f.movementType === "TRANSFERT" && (
              <Field label={translate("غرفة التبريد الوجهة")}>
                <NativeSelect
                  value={f.toFrigoId}
                  onChange={(e) => setF({ ...f, toFrigoId: e.target.value })}
                >
                  {state.frigos.map((x) => (
                    <option key={x.id} value={x.id}>
                      {translate(x.name ?? "")}
                    </option>
                  ))}
                </NativeSelect>
                {dest !== null && (
                  <p className="text-xs text-muted-foreground">
                    {<Text>{"الحالي: "}</Text>}
                    {num(dest)} kg → {num(dest + (f.quantity || 0))} kg
                  </p>
                )}
              </Field>
            )}
            <Field label={translate("الكمية (كغ)")}>
              <Input
                type="number"
                step="0.001"
                required
                inputMode="decimal"
                placeholder={translate("مثال: 250 (تعديل: -12 أو 30)")}
                value={f.quantity || ""}
                onChange={(e) => setF({ ...f, quantity: Number(e.target.value) })}
              />
            </Field>
            <Field label={translate("المرجع")}>
              <Input
                readOnly
                disabled
                dir="ltr"
                className="font-mono"
                value={`MVT-${new Date().getFullYear()}-…`}
              />
              <p className="text-xs text-muted-foreground">{translate("تلقائي")}</p>
            </Field>
            <Field label={translate("ملاحظات")} className="sm:col-span-2">
              <Input
                maxLength={500}
                placeholder={translate("مثال: استلام محصول الحقل 3")}
                value={f.notes}
                onChange={(e) => setF({ ...f, notes: e.target.value })}
              />
            </Field>
          </div>
        </FormDialog>
      )}
    </>
  );
}

function Mouvements() {
  const { language } = useLanguage();
  const { state } = useApp();
  const L = useLookups();
  const [type, setType] = useState("all");
  const [frigo, setFrigo] = useState("all");
  const [lang, setLang] = useState<DisplayLang>(language);
  const rows = state.stockMovements.filter((m) => type === "all" || m.movementType === type);
  return (
    <div>
      <PageHeader
        title={translate("حركات المخزون")}
        subtitle={translate("السجل الكامل حسب غرفة التبريد")}
        actions={<StockMoveButton />}
      />
      <Panel>
        <DataTable
          rows={rows.filter((m) => frigo === "all" || m.frigoId === frigo || m.toFrigoId === frigo)}
          search={(m) => `${showIn(L.product.get(m.productId)?.name ?? "", "both")} ${m.reference}`}
          filters={
            <>
              <FiltreFrigo value={frigo} onChange={setFrigo} />
              <div className="flex flex-col gap-2 sm:flex-row">
                <NativeSelect
                  className="sm:w-44"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                >
                  <option value="all">{<Text>{"كل الأنواع"}</Text>}</option>
                  <option value="ENTREE">{<Text>{"الوارد"}</Text>}</option>
                  <option value="SORTIE">{<Text>{"الصادر"}</Text>}</option>
                  <option value="TRANSFERT">{<Text>{"عمليات النقل"}</Text>}</option>
                  <option value="AJUSTEMENT">{<Text>{"التسويات"}</Text>}</option>
                </NativeSelect>
                <DisplayLanguageFilter value={lang} onChange={setLang} />
              </div>
            </>
          }
          columns={[
            { header: translate("التاريخ"), cell: (m) => dateTimeFr(m.date), sort: (m) => m.date },
            { header: translate("النوع"), cell: (m) => <Status value={m.movementType} /> },
            {
              header: translate("المنتج"),
              cell: (m) => (
                <span className="font-medium">
                  {showIn(L.product.get(m.productId)?.name ?? "", lang)}
                </span>
              ),
            },
            {
              header: translate("غرفة التبريد"),
              cell: (m) =>
                m.toFrigoId
                  ? `${L.frigo.get(m.frigoId)?.name} → ${L.frigo.get(m.toFrigoId)?.name}`
                  : L.frigo.get(m.frigoId)?.name,
            },
            {
              header: translate("الكمية"),
              cell: (m) => <b>{num(m.quantity)} kg</b>,
              sort: (m) => m.quantity,
            },
            {
              header: translate("المرجع"),
              cell: (m) => <span className="font-mono text-xs">{m.reference}</span>,
            },
            { header: translate("المستخدم"), cell: (m) => L.user.get(m.userId)?.name },
            { header: translate("ملاحظات"), cell: (m) => m.notes },
          ]}
        />
      </Panel>
    </div>
  );
}
