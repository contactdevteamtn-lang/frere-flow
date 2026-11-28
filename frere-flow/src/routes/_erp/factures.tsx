import { Text, translate, useLanguage } from "@/lib/i18n";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Ban,
  CheckCircle2,
  Eye,
  FileText,
  MessageSquareWarning,
  Minimize2,
  Pencil,
  Plus,
  Printer,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useApp, useLookups, useTeamScope } from "@/store/store";
import { editSale, setInvoiceStatus, stockOf } from "@/services/ops";
import type { Invoice, InvoiceStatus } from "@/types";
import { DataTable } from "@/components/app/DataTable";
import { Edit, Field, FormDialog, NativeSelect } from "@/components/app/forms";
import { Kpi, PageHeader, Panel, Status } from "@/components/app/ui";
import { dateFr, dt } from "@/lib/format";

export const Route = createFileRoute("/_erp/factures")({
  head: () => ({
    meta: [
      { title: "Factures — Frère Mahjoub" },
      { name: "description", content: "Factures des ventes : validées, à revoir, annulées." },
      { property: "og:title", content: "Factures — Frère Mahjoub" },
      { property: "og:type", content: "website" },
    ],
  }),
  component: Factures,
});

/** Action demandant un motif : « à voir » (ce qu'il faut modifier) ou « annuler » (annule aussi la vente) */
type Motif = { facture: Invoice; status: "A_VOIR" | "ANNULEE"; note: string };

function Factures() {
  useLanguage();
  const { state, run, can } = useApp();
  const L = useLookups();
  const inScope = useTeamScope();
  const [filtre, setFiltre] = useState<"all" | InvoiceStatus>("all");
  const [motif, setMotif] = useState<Motif | null>(null);
  const [annuler, setAnnuler] = useState<Motif | null>(null);
  const [voir, setVoir] = useState<Invoice | null>(null);
  const [modifier, setModifier] = useState<Invoice | null>(null);
  // mode compressé : lignes denses, lecture rapide et impression compacte
  const [compact, setCompact] = useState(false);
  const gerer = can("ventes");

  const toutes = (state.invoices ?? []).filter((f) => inScope(f.teamId));
  const lignes = toutes.filter((f) => filtre === "all" || f.status === filtre);
  const compte = (st: InvoiceStatus) => toutes.filter((f) => f.status === st).length;
  const montant = (st: InvoiceStatus) =>
    toutes.filter((f) => f.status === st).reduce((a, f) => a + f.amount, 0);
  const valider = (f: Invoice) => run(setInvoiceStatus, f.id, "VALIDEE", "");

  return (
    <div>
      <PageHeader
        title={translate("الفواتير")}
        subtitle={translate("فاتورة لكل عملية بيع: صالحة، للمراجعة أو ملغاة")}
        actions={
          <>
            <Button
              variant={compact ? "default" : "outline"}
              aria-pressed={compact}
              onClick={() => setCompact(!compact)}
            >
              <Minimize2 className="size-4" />
              {translate("عرض مضغوط")}
            </Button>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="size-4" /> {translate("طباعة")}
            </Button>
          </>
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Kpi
          label={translate("فواتير صالحة")}
          value={String(compte("VALIDEE"))}
          hint={dt(montant("VALIDEE"))}
          icon={CheckCircle2}
        />
        <Kpi
          label={translate("فواتير للمراجعة")}
          value={String(compte("A_VOIR"))}
          hint={dt(montant("A_VOIR"))}
          icon={MessageSquareWarning}
        />
        <Kpi
          label={translate("فواتير ملغاة")}
          value={String(compte("ANNULEE"))}
          hint={dt(montant("ANNULEE"))}
          icon={Ban}
        />
      </div>
      <Panel
        className={
          compact
            ? "text-xs [&_td]:!px-1.5 [&_td]:!py-1 [&_th]:!py-1 print:[&_td]:!py-0.5"
            : undefined
        }
      >
        <DataTable
          rows={lignes}
          search={(f) =>
            `${f.number} ${L.sale.get(f.saleId)?.number ?? ""} ${translate(L.client.get(f.clientId)?.name ?? "")}`
          }
          filters={
            <NativeSelect
              className="sm:w-44"
              aria-label={translate("الحالة")}
              value={filtre}
              onChange={(e) => setFiltre(e.target.value as "all" | InvoiceStatus)}
            >
              <option value="all">{translate("كل الحالات")}</option>
              <option value="VALIDEE">{translate("صالحة")}</option>
              <option value="A_VOIR">{translate("للمراجعة")}</option>
              <option value="ANNULEE">{translate("ملغاة")}</option>
            </NativeSelect>
          }
          columns={[
            {
              header: translate("رقم الفاتورة"),
              cell: (f) => <span className="font-mono text-xs">{f.number}</span>,
              sort: (f) => f.number,
            },
            { header: translate("التاريخ"), cell: (f) => dateFr(f.date), sort: (f) => f.date },
            {
              header: translate("العميل"),
              cell: (f) => translate(L.client.get(f.clientId)?.name ?? "—"),
              sort: (f) => L.client.get(f.clientId)?.name ?? "",
            },
            {
              header: translate("عملية البيع"),
              cell: (f) => (
                <span className="font-mono text-xs">{L.sale.get(f.saleId)?.number ?? "—"}</span>
              ),
            },
            { header: translate("المبلغ"), cell: (f) => dt(f.amount), sort: (f) => f.amount },
            {
              header: translate("المتبقي"),
              cell: (f) => dt(L.sale.get(f.saleId)?.remainingAmount ?? 0),
            },
            { header: translate("الحالة"), cell: (f) => <Status value={f.status} /> },
            {
              header: translate("ملاحظات"),
              cell: (f) => <span className="text-xs text-muted-foreground">{f.notes || "—"}</span>,
            },
            {
              header: "",
              cell: (f) => (
                <div className="flex">
                  <Button
                    size="icon"
                    variant="ghost"
                    title={translate("عرض")}
                    aria-label={translate("عرض")}
                    onClick={() => setVoir(f)}
                  >
                    <Eye className="size-4" />
                  </Button>
                  {gerer && f.status !== "ANNULEE" && !L.sale.get(f.saleId)?.marketTripId && (
                    <Edit>
                      <Button
                        size="icon"
                        variant="ghost"
                        title={translate("تعديل الفاتورة")}
                        aria-label={translate("تعديل الفاتورة")}
                        onClick={() => setModifier(f)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                    </Edit>
                  )}
                  {gerer && f.status !== "ANNULEE" && (
                    <Edit>
                      {f.status === "A_VOIR" ? (
                        <Button
                          size="icon"
                          variant="ghost"
                          title={translate("تأكيد الفاتورة")}
                          aria-label={translate("تأكيد الفاتورة")}
                          onClick={() => valider(f)}
                        >
                          <CheckCircle2 className="size-4 text-primary" />
                        </Button>
                      ) : (
                        <Button
                          size="icon"
                          variant="ghost"
                          title={translate("وضعها للمراجعة")}
                          aria-label={translate("وضعها للمراجعة")}
                          onClick={() => setMotif({ facture: f, status: "A_VOIR", note: "" })}
                        >
                          <MessageSquareWarning className="size-4 text-warning-foreground" />
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        title={translate("إلغاء الفاتورة")}
                        aria-label={translate("إلغاء الفاتورة")}
                        onClick={() => setAnnuler({ facture: f, status: "ANNULEE", note: "" })}
                      >
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

      {/* « À voir » : motif obligatoire (ce qu'il faut revoir ou modifier) */}
      {motif && (
        <FormDialog
          open
          onOpenChange={() => setMotif(null)}
          title={`${translate("وضع الفاتورة للمراجعة")} — ${motif.facture.number}`}
          onSubmit={() =>
            run(setInvoiceStatus, motif.facture.id, "A_VOIR", motif.note) && setMotif(null)
          }
        >
          <Field label={translate("ما الذي يجب مراجعته أو تعديله؟")}>
            <Input
              required
              minLength={3}
              maxLength={200}
              autoFocus
              placeholder={translate("مثال: خطأ في سعر المنتج")}
              value={motif.note}
              onChange={(e) => setMotif({ ...motif, note: e.target.value })}
            />
          </Field>
        </FormDialog>
      )}

      {/* « Annuler » : annule aussi la vente (stock rendu, dette annulée, remboursement) */}
      {annuler && (
        <FormDialog
          open
          onOpenChange={() => setAnnuler(null)}
          title={`${translate("إلغاء الفاتورة")} — ${annuler.facture.number}`}
          submitLabel={translate("إلغاء الفاتورة")}
          onSubmit={() =>
            run(setInvoiceStatus, annuler.facture.id, "ANNULEE", annuler.note) && setAnnuler(null)
          }
        >
          <p className="text-sm text-destructive">
            {translate(
              "إلغاء الفاتورة يلغي أيضاً عملية البيع: تُعاد الكمية إلى المخزون، ويُلغى الدين، ويُرجع المبلغ المدفوع. لا يمكن التراجع.",
            )}
          </p>
          <Field label={translate("سبب الإلغاء")}>
            <Input
              required
              minLength={3}
              maxLength={200}
              autoFocus
              placeholder={translate("مثال: العميل رفض البضاعة")}
              value={annuler.note}
              onChange={(e) => setAnnuler({ ...annuler, note: e.target.value })}
            />
          </Field>
        </FormDialog>
      )}

      {voir && <FactureDetail facture={voir} onClose={() => setVoir(null)} />}
      {modifier && <ModifierFacture facture={modifier} onClose={() => setModifier(null)} />}
    </div>
  );
}

function FactureDetail({ facture, onClose }: { facture: Invoice; onClose: () => void }) {
  useLanguage();
  const { state } = useApp();
  const L = useLookups();
  const f = state.invoices.find((x) => x.id === facture.id) ?? facture;
  const vente = L.sale.get(f.saleId);
  const items = state.saleItems.filter((i) => i.saleId === f.saleId);
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{`${translate("الفاتورة")} ${f.number}`}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <FileText className="size-4 text-primary" />
              {translate(L.client.get(f.clientId)?.name ?? "—")} · {dateFr(f.date)}
            </span>
            <Status value={f.status} />
          </div>
          <p className="text-muted-foreground">
            <Text>{"عملية البيع: "}</Text>
            <span className="font-mono">{vente?.number ?? "—"}</span>
          </p>
          <div className="space-y-1 rounded-lg bg-muted/50 p-3">
            {items.map((i) => (
              <div key={i.id} className="flex justify-between">
                <span>
                  {translate(L.product.get(i.productId)?.name ?? "")} · {i.quantity} kg ×{" "}
                  {dt(i.unitPrice)}
                </span>
                <b>{dt(i.total)}</b>
              </div>
            ))}
            <div className="flex justify-between border-t pt-2 font-semibold">
              <span>{translate("الإجمالي")}</span>
              <span>{dt(f.amount)}</span>
            </div>
            {vente && (
              <>
                <div className="flex justify-between">
                  <span>{translate("المدفوع")}</span>
                  <span>{dt(vente.paidAmount)}</span>
                </div>
                <div className="flex justify-between text-destructive">
                  <span>{translate("المتبقي")}</span>
                  <span>{dt(vente.remainingAmount)}</span>
                </div>
              </>
            )}
          </div>
          {f.notes && (
            <p className="rounded-md bg-warning/10 p-2 text-xs">
              <Text>{"ملاحظة: "}</Text>
              {f.notes}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Modification complète : lignes, quantités, prix — stock, crédit, remboursement recalculés par le serveur */
function ModifierFacture({ facture, onClose }: { facture: Invoice; onClose: () => void }) {
  useLanguage();
  const { state, run } = useApp();
  const vente = state.sales.find((x) => x.id === facture.saleId);
  const [lignes, setLignes] = useState(
    state.saleItems
      .filter((i) => i.saleId === facture.saleId)
      .map((i) => ({ productId: i.productId, quantity: i.quantity, unitPrice: i.unitPrice })),
  );
  if (!vente) return null;
  const avant = (pid: string) =>
    state.saleItems
      .filter((i) => i.saleId === vente.id && i.productId === pid)
      .reduce((a, i) => a + i.quantity, 0);
  const total = lignes.reduce((a, l) => a + l.quantity * l.unitPrice, 0);
  const rembourse = Math.max(vente.paidAmount - total, 0);
  const maj = (k: number, p: Partial<(typeof lignes)[number]>) =>
    setLignes(lignes.map((l, j) => (j === k ? { ...l, ...p } : l)));
  return (
    <FormDialog
      wide
      open
      onOpenChange={onClose}
      title={`${translate("تعديل الفاتورة")} — ${facture.number}`}
      onSubmit={() => run(editSale, vente.id, { items: lignes }) && onClose()}
    >
      <div className="space-y-2">
        {lignes.map((l, k) => {
          // disponible pour cette ligne = stock du frigo + quantité déjà dans la facture
          const dispo = l.productId
            ? stockOf(state, l.productId, vente.frigoId) + avant(l.productId)
            : null;
          return (
            <div key={k} className="grid grid-cols-12 items-start gap-2 rounded-lg bg-muted/50 p-2">
              <Field label="المنتج" className="col-span-12 sm:col-span-5">
                <NativeSelect
                  value={l.productId}
                  onChange={(e) => {
                    const p = state.products.find((x) => x.id === e.target.value);
                    maj(k, {
                      productId: e.target.value,
                      unitPrice: p?.salePrice ?? 0,
                      quantity: l.quantity || 1,
                    });
                  }}
                >
                  <option value="">{translate("اختر المنتج…")}</option>
                  {state.products
                    .filter((p) => p.active || p.id === l.productId)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {translate(p.name ?? "")}
                      </option>
                    ))}
                </NativeSelect>
                {dispo !== null && (
                  <p
                    className={
                      dispo < l.quantity
                        ? "text-xs text-destructive"
                        : "text-xs text-muted-foreground"
                    }
                  >
                    {translate("المتوفر: ")}
                    {dispo}
                  </p>
                )}
              </Field>
              <Field label="الكمية (كغ)" className="col-span-4 sm:col-span-2">
                <Input
                  type="number"
                  min={0}
                  step="any"
                  aria-label={translate("الكمية (كغ)")}
                  value={l.quantity || ""}
                  onChange={(e) => maj(k, { quantity: Number(e.target.value) })}
                />
              </Field>
              <Field label="سعر الوحدة (د.ت)" className="col-span-4 sm:col-span-2">
                <Input
                  type="number"
                  min={0}
                  step="0.001"
                  aria-label={translate("سعر الوحدة (د.ت)")}
                  value={l.unitPrice || ""}
                  onChange={(e) => maj(k, { unitPrice: Number(e.target.value) })}
                />
              </Field>
              <Field label="المجموع" className="col-span-3 sm:col-span-2">
                <div className="flex h-9 items-center justify-end text-sm font-semibold">
                  {dt(l.quantity * l.unitPrice)}
                </div>
              </Field>
              <div className="col-span-1 pt-5">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={translate("حذف")}
                  onClick={() => setLignes(lignes.filter((_, j) => j !== k))}
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
          onClick={() => setLignes([...lignes, { productId: "", quantity: 1, unitPrice: 0 }])}
        >
          <Plus className="size-4" /> {translate("إضافة منتج")}
        </Button>
        <div className="space-y-1 rounded-lg border p-3 text-sm">
          <div className="flex justify-between">
            <span>{translate("الإجمالي السابق")}</span>
            <span>{dt(vente.totalAmount)}</span>
          </div>
          <div className="flex justify-between font-semibold">
            <span>{translate("الإجمالي الجديد")}</span>
            <span>{dt(total)}</span>
          </div>
          <div className="flex justify-between">
            <span>{translate("المدفوع")}</span>
            <span>{dt(vente.paidAmount)}</span>
          </div>
          {rembourse > 0 ? (
            <p className="text-xs text-warning-foreground">
              {translate("الإجمالي الجديد أقل من المدفوع: يُرجع الفرق للعميل من الصندوق")} (
              {dt(rembourse)})
            </p>
          ) : (
            <div className="flex justify-between text-destructive">
              <span>{translate("المتبقي")}</span>
              <span>{dt(total - vente.paidAmount)}</span>
            </div>
          )}
        </div>
      </div>
    </FormDialog>
  );
}
