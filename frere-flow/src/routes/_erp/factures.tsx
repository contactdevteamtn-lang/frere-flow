import { Text, translate, useLanguage } from "@/lib/i18n";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Ban, CheckCircle2, Eye, FileText, MessageSquareWarning } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useApp, useLookups, useTeamScope } from "@/store/store";
import { setInvoiceStatus } from "@/services/ops";
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
      <Panel>
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
