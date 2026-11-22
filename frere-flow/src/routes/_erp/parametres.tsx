import { Text, translate, useLanguage } from "@/lib/i18n";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { validateSettings } from "@/services/validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApp } from "@/store/store";
import { Confirm, Field } from "@/components/app/forms";
import { PageHeader, Panel, Status } from "@/components/app/ui";

export const Route = createFileRoute("/_erp/parametres")({
  head: () => ({
    meta: [
      { title: "Paramètres — Frère Mahjoub" },
      { name: "description", content: "Paramètres généraux et statuts." },
      { property: "og:title", content: "Paramètres — Frère Mahjoub" },
      { property: "og:description", content: "Paramètres généraux et statuts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Parametres,
});

function Parametres() {
  useLanguage();
  const { state, setState, reset } = useApp();
  const [s, setS] = useState(state.settings);
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="space-y-4">
      <PageHeader title={translate("الإعدادات")} />
      <Panel title={translate("الشركة")}>
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            const clean = (() => {
              try {
                return validateSettings(s);
              } catch (err) {
                toast.error(translate((err as Error).message));
                return null;
              }
            })();
            if (!clean) return;
            setState((x) => ({ ...x, settings: clean }));
            toast.success(translate("تم حفظ الإعدادات"));
          }}
        >
          <Field label={translate("اسم الشركة")}>
            <Input
              required
              maxLength={120}
              placeholder={translate("مثال: شركة الإخوة محجوب")}
              value={s.companyName}
              onChange={(e) => setS({ ...s, companyName: e.target.value })}
            />
          </Field>
          <Field label={translate("العملة")}>
            <Input value={s.currency} disabled />
          </Field>
          <Field label={translate("مهلة سداد الدين الافتراضية (أيام)")}>
            <Input
              type="number"
              min={1}
              max={365}
              step="1"
              required
              inputMode="numeric"
              placeholder={translate("مثال: 30")}
              value={s.defaultDueDays}
              onChange={(e) => setS({ ...s, defaultDueDays: Number(e.target.value) })}
            />
          </Field>
          <Field label={translate("حد التنبيه للصناديق غير المرجعة")}>
            <Input
              type="number"
              min={0}
              step="1"
              required
              inputMode="numeric"
              placeholder={translate("مثال: 40")}
              value={s.packagingAlert}
              onChange={(e) => setS({ ...s, packagingAlert: Number(e.target.value) })}
            />
          </Field>
          <div className="sm:col-span-2">
            <Button type="submit">{<Text>{"حفظ"}</Text>}</Button>
          </div>
        </form>
      </Panel>
      <div className="grid gap-4 md:grid-cols-2">
        <Panel title={translate("حالات البيع")}>
          <div className="flex flex-wrap gap-2">
            {state.saleStatuses.map((x) => (
              <Status key={x.id} value={x.code} label={translate(x.label ?? "")} />
            ))}
          </div>
        </Panel>
        <Panel title={translate("حالات الدين")}>
          <div className="flex flex-wrap gap-2">
            {state.creditStatuses.map((x) => (
              <Status key={x.id} value={x.code} label={translate(x.label ?? "")} />
            ))}
          </div>
        </Panel>
      </div>
      <Panel title={translate("البيانات التجريبية")}>
        <p className="mb-3 text-sm text-muted-foreground">
          {
            <Text>
              {"البيانات محفوظة في هذا المتصفح. يمكنك استعادة البيانات التجريبية في أي وقت."}
            </Text>
          }
        </p>
        <Button variant="outline" onClick={() => setConfirm(true)}>
          <RotateCcw className="size-4" />
          {<Text>{" استعادة البيانات التجريبية"}</Text>}
        </Button>
      </Panel>
      <Confirm
        open={confirm}
        onOpenChange={setConfirm}
        title={translate("استعادة كل البيانات التجريبية؟")}
        description={translate("ستُستبدل كل العمليات التي أدخلتها بالبيانات التجريبية.")}
        label={translate("استعادة")}
        onConfirm={() => {
          reset();
          toast.success(translate("تمت استعادة البيانات التجريبية"));
        }}
      />
    </div>
  );
}
