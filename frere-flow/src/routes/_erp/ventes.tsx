import { Text, translate, useLanguage } from "@/lib/i18n";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Trash2, Eye, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useApp, useLookups, useTeamScope } from "@/store/store";
import {
  cancelSale,
  createSale,
  saleStatusChoices,
  setSaleStatus,
  stockOf,
  type SaleInput,
} from "@/services/ops";
import type { Sale } from "@/types";
import { DataTable } from "@/components/app/DataTable";
import { Confirm, Field, FormDialog, NativeSelect, Edit } from "@/components/app/forms";
import { PageHeader, Panel, Status } from "@/components/app/ui";
import { METHODES, dateFr, dateTimeFr, dt, methodeLabel, num } from "@/lib/format";

export const Route = createFileRoute("/_erp/ventes")({
  head: () => ({
    meta: [
      { title: "Ventes — Frère Mahjoub" },
      { name: "description", content: "Gestion des ventes par Figo et par frigo." },
      { property: "og:title", content: "Ventes — Frère Mahjoub" },
      { property: "og:description", content: "Gestion des ventes par Figo et par frigo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Ventes,
});

function Ventes() {
  useLanguage();
  const { state, run, can, teamFilter } = useApp();
  const L = useLookups();
  const inScope = useTeamScope();
  const [creating, setCreating] = useState(false);
  const [view, setView] = useState<Sale | null>(null);
  const [cancel, setCancel] = useState<Sale | null>(null);
  const [status, setStatus] = useState("all");
  const [frigo, setFrigo] = useState("all");

  // ventes des marchés : dans la section Marchés
  const rows = state.sales.filter(
    (s) =>
      !s.marketTripId &&
      inScope(s.teamId) &&
      (status === "all" || s.saleStatusId === status) &&
      (frigo === "all" || s.frigoId === frigo),
  );
  const totals = rows
    .filter((s) => s.saleStatusId !== "ss_cancelled")
    .reduce(
      (a, s) => ({ t: a.t + s.totalAmount, p: a.p + s.paidAmount, r: a.r + s.remainingAmount }),
      { t: 0, p: 0, r: 0 },
    );

  return (
    <div>
      <PageHeader
        title={translate("المبيعات")}
        subtitle={translate("كل عملية بيع مرتبطة بفريق فيغو وغرفة تبريد")}
        actions={
          <Edit>
            <Button onClick={() => setCreating(true)}>
              <Plus className="size-4" />
              {<Text>{" عملية بيع جديدة"}</Text>}
            </Button>
          </Edit>
        }
      />
      <div className="mb-4 grid grid-cols-3 gap-3 text-sm">
        <div className="rounded-xl border bg-card p-3 shadow-card">
          <p className="text-muted-foreground">{<Text>{"الإجمالي"}</Text>}</p>
          <p className="font-display text-lg font-semibold">{dt(totals.t)}</p>
        </div>
        <div className="rounded-xl border bg-card p-3 shadow-card">
          <p className="text-muted-foreground">{<Text>{"المقبوض"}</Text>}</p>
          <p className="font-display text-lg font-semibold text-primary">{dt(totals.p)}</p>
        </div>
        <div className="rounded-xl border bg-card p-3 shadow-card">
          <p className="text-muted-foreground">{<Text>{"المتبقي"}</Text>}</p>
          <p className="font-display text-lg font-semibold text-destructive">{dt(totals.r)}</p>
        </div>
      </div>
      <Panel>
        <DataTable
          rows={rows}
          search={(s) => `${s.number} ${L.client.get(s.clientId)?.name}`}
          filters={
            <>
              <NativeSelect
                className="sm:w-48"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="all">{<Text>{"كل الحالات"}</Text>}</option>
                {state.saleStatuses.map((s) => (
                  <option key={s.id} value={s.id}>
                    {translate(s.label ?? "")}
                  </option>
                ))}
              </NativeSelect>
              <NativeSelect
                className="sm:w-40"
                value={frigo}
                onChange={(e) => setFrigo(e.target.value)}
              >
                <option value="all">{<Text>{"كل غرف التبريد"}</Text>}</option>
                {state.frigos.map((f) => (
                  <option key={f.id} value={f.id}>
                    {translate(f.name ?? "")}
                  </option>
                ))}
              </NativeSelect>
            </>
          }
          columns={[
            {
              header: translate("رقم الفاتورة"),
              cell: (s) => <span className="font-mono text-xs">{s.number}</span>,
              sort: (s) => s.number,
            },
            {
              header: translate("التاريخ"),
              cell: (s) => dateFr(s.saleDate),
              sort: (s) => s.saleDate,
            },
            {
              header: translate("العميل"),
              cell: (s) => (
                <span className="font-medium">
                  {translate(L.client.get(s.clientId)?.name ?? "")}
                </span>
              ),
              sort: (s) => L.client.get(s.clientId)?.name ?? "",
            },
            { header: translate("فيغو"), cell: (s) => L.team.get(s.teamId)?.name },
            { header: translate("غرفة التبريد"), cell: (s) => L.frigo.get(s.frigoId)?.name },
            {
              header: translate("الإجمالي"),
              cell: (s) => dt(s.totalAmount),
              sort: (s) => s.totalAmount,
            },
            { header: translate("المدفوع"), cell: (s) => dt(s.paidAmount) },
            {
              header: translate("المتبقي"),
              cell: (s) => (
                <span className={s.remainingAmount > 0 ? "text-destructive" : ""}>
                  {dt(s.remainingAmount)}
                </span>
              ),
              sort: (s) => s.remainingAmount,
            },
            {
              header: translate("الحالة"),
              cell: (s) => (
                <Status
                  value={L.saleStatus.get(s.saleStatusId)!.code}
                  label={L.saleStatus.get(s.saleStatusId)!.label}
                />
              ),
            },
            {
              header: "",
              cell: (s) => (
                <div className="flex">
                  <Button size="icon" variant="ghost" onClick={() => setView(s)}>
                    <Eye className="size-4" />
                  </Button>
                  {can("caisse") && s.saleStatusId !== "ss_cancelled" && (
                    <Edit>
                      <Button size="icon" variant="ghost" onClick={() => setCancel(s)}>
                        <Ban className="size-4 text-destructive" />
                      </Button>
                    </Edit>
                  )}
                </div>
              ),
            },
          ]}
        />
      </Panel>

      {creating && (
        <NewSale
          onClose={() => setCreating(false)}
          defaultTeam={teamFilter === "all" ? state.teams[0].id : teamFilter}
        />
      )}

      {view && (
        <Dialog open onOpenChange={() => setView(null)}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {<Text>{"عملية بيع "}</Text>}
                {view.number}
              </DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
              <p>
                <span className="text-muted-foreground">{<Text>{"العميل:"}</Text>}</span>{" "}
                {translate(L.client.get(view.clientId)?.name ?? "")}
              </p>
              <p>
                <span className="text-muted-foreground">{<Text>{"فيغو:"}</Text>}</span>{" "}
                {translate(L.team.get(view.teamId)?.name ?? "")}
              </p>
              <p>
                <span className="text-muted-foreground">{<Text>{"غرفة التبريد:"}</Text>}</span>{" "}
                {translate(L.frigo.get(view.frigoId)?.name ?? "")}
              </p>
              <p>
                <span className="text-muted-foreground">{<Text>{"البائع:"}</Text>}</span>{" "}
                {translate(L.user.get(view.userId)?.name ?? "")}
              </p>
              <p>
                <span className="text-muted-foreground">{<Text>{"التاريخ:"}</Text>}</span>{" "}
                {dateTimeFr(view.saleDate)}
              </p>
              <p>
                <span className="text-muted-foreground">{<Text>{"طريقة الدفع:"}</Text>}</span>{" "}
                {methodeLabel(view.paymentType)}
              </p>
            </div>
            <table className="mt-2 w-full text-sm">
              <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-2 text-start">{<Text>{"المنتج"}</Text>}</th>
                  <th className="p-2 text-end">{<Text>{"الكمية"}</Text>}</th>
                  <th className="p-2 text-end">{<Text>{"سعر الوحدة"}</Text>}</th>
                  <th className="p-2 text-end">{<Text>{"الإجمالي"}</Text>}</th>
                </tr>
              </thead>
              <tbody>
                {state.saleItems
                  .filter((i) => i.saleId === view.id)
                  .map((i) => (
                    <tr key={i.id} className="border-t">
                      <td className="p-2">{translate(L.product.get(i.productId)?.name ?? "")}</td>
                      <td className="p-2 text-end">{num(i.quantity)}</td>
                      <td className="p-2 text-end">{dt(i.unitPrice)}</td>
                      <td className="p-2 text-end">{dt(i.total)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
            <div className="ms-auto w-60 space-y-1 text-sm">
              <div className="flex justify-between">
                <span>{<Text>{"الإجمالي"}</Text>}</span>
                <b>{dt(view.totalAmount)}</b>
              </div>
              <div className="flex justify-between text-primary">
                <span>{<Text>{"المدفوع"}</Text>}</span>
                <b>{dt(view.paidAmount)}</b>
              </div>
              <div className="flex justify-between text-destructive">
                <span>{<Text>{"المتبقي"}</Text>}</span>
                <b>{dt(view.remainingAmount)}</b>
              </div>
            </div>
            {/* statut : « Payée / Partielle » calculés d'après les paiements, « Annulée » par le bouton
                d'annulation — seul « En attente / Confirmée » se choisit, avant tout paiement */}
            {can("caisse") && saleStatusChoices(state, view).length > 1 && (
              <Field label={translate("تغيير الحالة")}>
                <NativeSelect
                  value={view.saleStatusId}
                  onChange={(e) => {
                    if (run(setSaleStatus, view.id, e.target.value))
                      setView({ ...view, saleStatusId: e.target.value });
                  }}
                >
                  {state.saleStatuses
                    .filter((s) => saleStatusChoices(state, view).includes(s.id))
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {translate(s.label ?? "")}
                      </option>
                    ))}
                </NativeSelect>
              </Field>
            )}
            {view.saleStatusId !== "ss_cancelled" && (
              <p className="text-xs text-muted-foreground">
                {translate("الحالة تُحسب تلقائياً من المدفوعات.")}
              </p>
            )}
          </DialogContent>
        </Dialog>
      )}
      <Confirm
        open={!!cancel}
        onOpenChange={() => setCancel(null)}
        title={translate("إلغاء عملية البيع؟")}
        description={translate("ستُعاد الكمية إلى غرفة التبريد الأصلية ويُلغى الدين المرتبط بها.")}
        label={translate("إلغاء البيع")}
        onConfirm={() => {
          if (cancel) run(cancelSale, cancel.id, translate("إلغاء يدوي"));
          setCancel(null);
        }}
      />
    </div>
  );
}

export function NewSale({ onClose, defaultTeam }: { onClose: () => void; defaultTeam: string }) {
  useLanguage();
  const { state, run, me, can } = useApp();
  const [f, setF] = useState<SaleInput>({
    clientId: "",
    teamId: me?.teamId && !can("administration") ? me.teamId : defaultTeam,
    frigoId: state.frigos[0].id,
    items: [{ productId: "", quantity: 0, unitPrice: 0 }],
    paid: 0,
    method: "ESPECES",
    notes: "",
    packaging: [],
  });
  const total = useMemo(() => f.items.reduce((a, i) => a + i.quantity * i.unitPrice, 0), [f.items]);
  const remaining = Math.max(total - (f.paid || 0), 0);
  const setItem = (i: number, patch: Partial<SaleInput["items"][number]>) =>
    setF({ ...f, items: f.items.map((x, j) => (j === i ? { ...x, ...patch } : x)) });

  return (
    <FormDialog
      wide
      open
      onOpenChange={onClose}
      title={translate("عملية بيع جديدة")}
      description={translate("تُخصم الكمية من غرفة التبريد المحددة فقط.")}
      submitLabel={translate("تأكيد البيع")}
      onSubmit={() => run(createSale, f) && onClose()}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={translate("1. العميل")}>
          <NativeSelect
            required
            value={f.clientId}
            onChange={(e) => setF({ ...f, clientId: e.target.value })}
          >
            <option value="">{<Text>{"اختر…"}</Text>}</option>
            {state.clients
              .filter((c) => c.active && !c.marketId)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {translate(c.name ?? "")}
                </option>
              ))}
          </NativeSelect>
        </Field>
        <Field label={translate("2. فيغو / الفريق")}>
          <NativeSelect
            value={f.teamId}
            disabled={!!me?.teamId && !can("administration")}
            onChange={(e) => setF({ ...f, teamId: e.target.value })}
          >
            {state.teams.map((t) => (
              <option key={t.id} value={t.id}>
                {translate(t.name ?? "")}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label={translate("غرفة التبريد المصدر")}>
          <NativeSelect value={f.frigoId} onChange={(e) => setF({ ...f, frigoId: e.target.value })}>
            {state.frigos
              .filter((x) => x.active)
              .map((x) => (
                <option key={x.id} value={x.id}>
                  {translate(x.name ?? "")}
                </option>
              ))}
          </NativeSelect>
        </Field>
      </div>
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">{<Text>{"3. المنتجات"}</Text>}</p>
        {f.items.map((it, i) => {
          const av = it.productId ? stockOf(state, it.productId, f.frigoId) : null;
          return (
            // libellés fixes au-dessus de chaque case + alignement en haut : les cases ne bougent
            // plus quand le prix se remplit ou que la ligne « disponible » apparaît
            <div key={i} className="grid grid-cols-12 items-start gap-2 rounded-lg bg-muted/50 p-2">
              <Field label="المنتج" className="col-span-12 sm:col-span-4">
                <NativeSelect
                  value={it.productId}
                  onChange={(e) => {
                    const p = state.products.find((x) => x.id === e.target.value);
                    setItem(i, { productId: e.target.value, unitPrice: p?.salePrice ?? 0 });
                  }}
                >
                  <option value="">{<Text>{"اختر المنتج…"}</Text>}</option>
                  {state.products
                    .filter((p) => p.active)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {translate(p.name ?? "")}
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
                    {<Text>{"المتوفر: "}</Text>}
                    {num(av)} kg
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
                  placeholder={translate("مثال: 25")}
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
                  placeholder={translate("مثال: 1.200")}
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
          {<Text>{" إضافة منتج"}</Text>}
        </Button>
      </div>
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">
          {<Text>{"الصناديق المسلّمة (اختياري)"}</Text>}
        </p>
        {f.packaging.map((p, i) => (
          <div key={i} className="flex gap-2">
            <NativeSelect
              value={p.typeId}
              onChange={(e) =>
                setF({
                  ...f,
                  packaging: f.packaging.map((x, j) =>
                    j === i ? { ...x, typeId: e.target.value } : x,
                  ),
                })
              }
            >
              <option value="">{<Text>{"اختر النوع…"}</Text>}</option>
              {state.packagingTypes
                .filter((t) => t.active)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {translate(t.name ?? "")}
                    {t.clientOwned ? ` — ${translate("يجلبها العميل")}` : ""}
                  </option>
                ))}
            </NativeSelect>
            <Input
              type="number"
              min={0}
              step="1"
              inputMode="numeric"
              placeholder={translate("مثال: 5")}
              className="w-28"
              value={p.quantity || ""}
              onChange={(e) =>
                setF({
                  ...f,
                  packaging: f.packaging.map((x, j) =>
                    j === i ? { ...x, quantity: Number(e.target.value) } : x,
                  ),
                })
              }
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => setF({ ...f, packaging: f.packaging.filter((_, j) => j !== i) })}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
        {f.packaging.some(
          (p) => state.packagingTypes.find((t) => t.id === p.typeId)?.clientOwned,
        ) && (
          <p className="text-xs text-muted-foreground">
            {
              <Text>
                {"صناديق العميل: تُسجَّل عندنا لإرجاعها إليه لاحقاً (لا تُحسب ديناً على العميل)."}
              </Text>
            }
          </p>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setF({ ...f, packaging: [...f.packaging, { typeId: "", quantity: 0 }] })}
        >
          <Plus className="size-4" />
          {<Text>{" إضافة صناديق"}</Text>}
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={translate("المبلغ المدفوع (د.ت)")}>
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
        <Field label={translate("طريقة الدفع")}>
          <NativeSelect
            value={f.method}
            onChange={(e) => setF({ ...f, method: e.target.value as SaleInput["method"] })}
          >
            {METHODES.map((m) => (
              <option key={m.value} value={m.value}>
                {translate(m.label ?? "")}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label={translate("استحقاق الدين")}>
          <Input
            type="date"
            value={f.dueDate ?? ""}
            onChange={(e) => setF({ ...f, dueDate: e.target.value })}
          />
        </Field>
      </div>
      <Field label={translate("ملاحظات")}>
        <Textarea
          rows={2}
          maxLength={500}
          placeholder={translate("مثال: التسليم صباح الغد")}
          value={f.notes}
          onChange={(e) => setF({ ...f, notes: e.target.value })}
        />
      </Field>
      <div className="grid grid-cols-3 gap-2 rounded-xl bg-mint p-4 text-center">
        <div>
          <p className="text-xs text-muted-foreground">{<Text>{"الإجمالي"}</Text>}</p>
          <p className="font-display text-lg font-semibold">{dt(total)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{<Text>{"المدفوع"}</Text>}</p>
          <p className="font-display text-lg font-semibold text-primary">
            {dt(Math.min(f.paid || 0, total))}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{<Text>{"المتبقي ← دين"}</Text>}</p>
          <p className="font-display text-lg font-semibold text-destructive">{dt(remaining)}</p>
        </div>
      </div>
    </FormDialog>
  );
}
