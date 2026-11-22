import { useState } from "react";
import { MapPin, Plus, Pencil, Users } from "lucide-react";
import { useApp } from "@/store/store";
import { marketAnalytics, saveMarket, saveMarketClient } from "@/services/markets";
import { translate, useLanguage } from "@/lib/i18n";
import { dt, num } from "@/lib/format";
import { Edit, Field, FormDialog, NativeSelect, NomAutreLangue } from "@/components/app/forms";
import { Empty } from "@/components/app/ui";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/app/DataTable";

export function MarketConfiguration() {
  useLanguage();
  const { state, run, teamFilter } = useApp();
  const [selected, setSelected] = useState(state.markets[0]?.id ?? "");
  const [marketForm, setMarketForm] = useState<{
    id?: string;
    name: string;
    nameAlt?: string;
    city: string;
  } | null>(null);
  const [clientForm, setClientForm] = useState<{
    id?: string;
    marketId: string;
    name: string;
    nameAlt?: string;
    phone: string;
    address: string;
  } | null>(null);
  const clients = state.clients.filter((c) => c.marketId === selected);
  const d = marketAnalytics(state, {
    marketId: selected,
    teamId: teamFilter === "all" ? undefined : teamFilter,
  });
  const balance = (id: string) =>
    d.debts.filter((x) => x.clientId === id).reduce((a, x) => a + x.amount, 0);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{translate("الأسواق")}</h2>
        <Edit>
          <Button onClick={() => setMarketForm({ name: "", city: "" })}>
            <Plus className="size-4" />
            {translate("إضافة سوق")}
          </Button>
        </Edit>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {state.markets.map((m) => (
          <article
            key={m.id}
            className={`rounded-lg border bg-card p-4 ${selected === m.id ? "border-primary ring-1 ring-primary" : ""}`}
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="break-words font-semibold">{translate(m.name)}</h3>
              <Edit>
                <Button
                  size="icon"
                  variant="ghost"
                  title={translate("تعديل")}
                  aria-label={`${translate("تعديل")} ${translate(m.name)}`}
                  onClick={() =>
                    setMarketForm({
                      id: m.id,
                      name: m.name,
                      nameAlt: m.nameAlt ?? "",
                      city: m.city,
                    })
                  }
                >
                  <Pencil className="size-4" />
                </Button>
              </Edit>
            </div>
            <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="size-4 shrink-0" />
              {translate(m.city)}
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-sm">
                <Users className="size-4 text-primary" />
                {num(state.clients.filter((c) => c.marketId === m.id).length)} {translate("عملاء")}
              </span>
              <Button
                size="sm"
                variant={selected === m.id ? "secondary" : "outline"}
                onClick={() => setSelected(m.id)}
              >
                {translate("عملاء هذا السوق")}
              </Button>
            </div>
          </article>
        ))}
      </div>
      {!state.markets.length && <Empty />}
      <section className="space-y-4 border-t pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">
            {translate("عملاء هذا السوق")} ·{" "}
            {translate(state.markets.find((m) => m.id === selected)?.name ?? "")}
          </h2>
          <Edit>
            <Button
              disabled={!selected}
              onClick={() =>
                setClientForm({ marketId: selected, name: "", phone: "", address: "" })
              }
            >
              <Plus className="size-4" />
              {translate("إضافة عميل سوق")}
            </Button>
          </Edit>
        </div>
        <DataTable
          key={selected}
          rows={clients}
          search={(c) => `${c.name} ${c.phone} ${c.address}`}
          columns={[
            {
              header: translate("العميل"),
              cell: (c) => <span className="font-medium">{translate(c.name)}</span>,
              sort: (c) => c.name,
            },
            { header: translate("الهاتف"), cell: (c) => <span dir="ltr">{c.phone || "—"}</span> },
            { header: translate("العنوان في السوق"), cell: (c) => c.address || "—" },
            {
              header: translate("رصيد دين السوق"),
              cell: (c) => (
                <span
                  className={balance(c.id) > 0 ? "font-semibold text-destructive" : "text-primary"}
                >
                  {dt(balance(c.id))}
                </span>
              ),
              sort: (c) => balance(c.id),
            },
            {
              header: "",
              cell: (c) => (
                <Edit>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`${translate("تعديل")} ${c.name}`}
                    onClick={() =>
                      setClientForm({
                        id: c.id,
                        marketId: selected,
                        name: c.name,
                        nameAlt: c.nameAlt ?? "",
                        phone: c.phone,
                        address: c.address,
                      })
                    }
                  >
                    <Pencil className="size-4" />
                  </Button>
                </Edit>
              ),
            },
          ]}
        />
      </section>
      {marketForm && (
        <FormDialog
          open
          onOpenChange={() => setMarketForm(null)}
          title={translate(marketForm.id ? "تعديل السوق" : "إضافة سوق")}
          onSubmit={() => {
            if (run(saveMarket, marketForm)) setMarketForm(null);
          }}
        >
          <Field label="اسم السوق">
            <Input
              aria-label={translate("اسم السوق")}
              required
              maxLength={80}
              placeholder={translate("مثال: سوق صفاقس")}
              value={marketForm.name}
              onChange={(e) => setMarketForm({ ...marketForm, name: e.target.value })}
            />
          </Field>
          <NomAutreLangue
            name={marketForm.name}
            value={marketForm.nameAlt}
            onChange={(v) => setMarketForm({ ...marketForm, nameAlt: v })}
          />
          <Field label="المدينة / الولاية">
            <Input
              aria-label={translate("المدينة / الولاية")}
              required
              maxLength={60}
              placeholder={translate("مثال: صفاقس")}
              value={marketForm.city}
              onChange={(e) => setMarketForm({ ...marketForm, city: e.target.value })}
            />
          </Field>
        </FormDialog>
      )}
      {clientForm && (
        <FormDialog
          open
          onOpenChange={() => setClientForm(null)}
          title={translate(clientForm.id ? "تعديل عميل السوق" : "إضافة عميل سوق")}
          onSubmit={() => {
            if (run(saveMarketClient, clientForm)) {
              setSelected(clientForm.marketId);
              setClientForm(null);
            }
          }}
        >
          <Field label="السوق">
            <NativeSelect
              aria-label={translate("السوق")}
              disabled={!!clientForm.id}
              required
              value={clientForm.marketId}
              onChange={(e) => setClientForm({ ...clientForm, marketId: e.target.value })}
            >
              {state.markets
                .filter((m) => m.active)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {translate(m.name)}
                  </option>
                ))}
            </NativeSelect>
          </Field>
          <Field label="اسم العميل">
            <Input
              aria-label={translate("اسم العميل")}
              required
              maxLength={80}
              autoComplete="off"
              placeholder={translate("مثال: محمد الطرابلسي")}
              value={clientForm.name}
              onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })}
            />
          </Field>
          <NomAutreLangue
            name={clientForm.name}
            value={clientForm.nameAlt}
            onChange={(v) => setClientForm({ ...clientForm, nameAlt: v })}
          />
          <Field label="الهاتف">
            <Input
              aria-label={translate("الهاتف")}
              type="tel"
              inputMode="tel"
              maxLength={20}
              dir="ltr"
              placeholder={translate("مثال: 98 123 456")}
              value={clientForm.phone}
              onChange={(e) => setClientForm({ ...clientForm, phone: e.target.value })}
            />
          </Field>
          <Field label="العنوان في السوق">
            <Input
              aria-label={translate("العنوان في السوق")}
              maxLength={200}
              placeholder={translate("مثال: المحل 12، الجناح ب")}
              value={clientForm.address}
              onChange={(e) => setClientForm({ ...clientForm, address: e.target.value })}
            />
          </Field>
        </FormDialog>
      )}
    </div>
  );
}
