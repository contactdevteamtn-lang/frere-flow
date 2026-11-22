import { translate, useLanguage } from "@/lib/i18n";
import { useState } from "react";
import { KeyRound, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Field, FormDialog } from "@/components/app/forms";
import { useApp } from "@/store/store";

const AIDE_MODE: Record<string, string> = {
  none: "حسابك محمي بكلمة المرور فقط.",
  totp: "حسابك محمي برمز من تطبيق المصادقة على هاتفك.",
  pin: "حسابك محمي برمز PIN شخصي بعد كلمة المرور.",
  email: "حسابك محمي برمز يصلك بالبريد عند كل دخول.",
  device: "لا يمكن الدخول إلى حسابك إلا من الأجهزة المعتمدة.",
};

/** Mon compte : mode de sécurité (choisi par le directeur) et changement de mon mot de passe */
export function MonCompte({ onClose }: { onClose: () => void }) {
  useLanguage();
  const { me, changerMotDePasse } = useApp();
  const [f, setF] = useState({ actuel: "", nouveau: "", confirmation: "" });
  const [envoi, setEnvoi] = useState(false);
  const regles = [
    { ok: f.nouveau.length >= 8, txt: "8 أحرف على الأقل" },
    { ok: /\p{L}/u.test(f.nouveau) && /\d/.test(f.nouveau), txt: "حروف وأرقام" },
    { ok: !!f.nouveau && f.nouveau === f.confirmation, txt: "الكلمتان متطابقتان" },
  ];
  const valider = async () => {
    if (envoi || !regles.every((r) => r.ok)) return;
    setEnvoi(true);
    const ok = await changerMotDePasse(f.actuel, f.nouveau);
    setEnvoi(false);
    if (ok) onClose();
  };
  return (
    <FormDialog
      personnel
      open
      onOpenChange={onClose}
      title={translate("حسابي")}
      submitLabel={translate("تغيير كلمة المرور")}
      onSubmit={() => void valider()}
    >
      <div className="flex items-start gap-2 rounded-lg bg-mint/60 p-3 text-sm">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
        <div>
          <p className="font-medium">
            {translate(me?.name ?? "")}{" "}
            <span dir="ltr" className="text-xs text-muted-foreground">
              {me?.email}
            </span>
          </p>
          <p className="text-muted-foreground">
            {translate(AIDE_MODE[me?.secMode ?? "none"] ?? "")}{" "}
            {translate("يختار المدير العام وضع الحماية.")}
          </p>
        </div>
      </div>
      <p className="flex items-center gap-2 text-sm font-semibold">
        <KeyRound className="size-4 text-primary" />
        {translate("تغيير كلمة المرور")}
      </p>
      <Field label={translate("كلمة المرور الحالية")}>
        <Input
          type="password"
          required
          autoComplete="current-password"
          maxLength={72}
          dir="ltr"
          value={f.actuel}
          onChange={(e) => setF({ ...f, actuel: e.target.value })}
        />
      </Field>
      <Field label={translate("كلمة المرور الجديدة")}>
        <Input
          type="password"
          required
          autoComplete="new-password"
          maxLength={72}
          dir="ltr"
          placeholder={translate("مثال: Zitouna2027")}
          value={f.nouveau}
          onChange={(e) => setF({ ...f, nouveau: e.target.value.replace(/\s/g, "") })}
        />
      </Field>
      <Field label={translate("أعد كتابة كلمة المرور الجديدة")}>
        <Input
          type="password"
          required
          autoComplete="new-password"
          maxLength={72}
          dir="ltr"
          value={f.confirmation}
          onChange={(e) => setF({ ...f, confirmation: e.target.value.replace(/\s/g, "") })}
        />
      </Field>
      <ul className="space-y-1 text-xs">
        {regles.map((r) => (
          <li key={r.txt} className={r.ok ? "text-primary" : "text-muted-foreground"}>
            {r.ok ? "✓" : "○"} {translate(r.txt)}
          </li>
        ))}
      </ul>
    </FormDialog>
  );
}
