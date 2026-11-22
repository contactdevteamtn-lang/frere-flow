import { Text, translate, useLanguage } from "@/lib/i18n";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  KeyRound,
  Lock,
  Mail,
  MonitorSmartphone,
  ShieldCheck,
  Smartphone,
  Sprout,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/app/forms";
import { useApp, type Etape } from "@/store/store";
import logo from "@/assets/logo.png";
import bg from "@/assets/login-bg.jpg";
import { LanguageSwitch } from "@/components/app/LanguageSwitch";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Connexion — Frère Mahjoub Gestion" },
      {
        name: "description",
        content:
          "Espace de gestion interne de la Société Frère Mahjoub : ventes, crédits, stocks et emballages.",
      },
      { property: "og:title", content: "Connexion — Frère Mahjoub Gestion" },
      {
        property: "og:description",
        content: "Espace de gestion interne de la Société Frère Mahjoub.",
      },
    ],
  }),
  component: Login,
});

function Login() {
  useLanguage();
  const { login, me, can, etape } = useApp();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");

  // compte « marchés seulement » : directement sur les marchés
  useEffect(() => {
    if (me)
      nav({ to: can("dashboard") ? "/dashboard" : can("marches") ? "/marches" : "/dashboard" });
  }, [me, nav, can]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!login(email, pwd)) toast.error(translate("البريد الإلكتروني أو كلمة المرور غير صحيحة"));
    setPwd("");
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden lg:block">
        <img
          src={bg}
          alt={translate("حقول زراعية في تونس")}
          className="absolute inset-0 size-full object-cover"
          width={1024}
          height={1408}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-primary-dark/90 via-primary-dark/40 to-transparent" />
        <div className="absolute bottom-0 p-12 text-primary-foreground">
          <p className="flex items-center gap-2 text-sm font-medium uppercase tracking-widest text-leaf">
            <Sprout className="size-4" />
            {<Text>{" من أرض تونس"}</Text>}
          </p>
          <h2 className="mt-3 max-w-md text-4xl font-semibold leading-tight">
            {<Text>{"المبيعات والديون والتبريد والصناديق — في مكان واحد."}</Text>}
          </h2>
        </div>
      </div>
      <div className="flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex justify-end">
            <LanguageSwitch />
          </div>
          <div className="mb-8 flex items-center gap-3">
            <img
              src={logo}
              alt={translate("شعار شركة الإخوة محجوب")}
              className="size-14"
              width={56}
              height={56}
            />
            <div>
              <h1 className="text-xl font-semibold leading-tight">
                {<Text>{"شركة الإخوة محجوب"}</Text>}
              </h1>
              <p className="text-sm text-muted-foreground">
                {<Text>{"نظام الإدارة الداخلية"}</Text>}
              </p>
            </div>
          </div>
          {etape ? (
            <EtapeConnexion etape={etape} />
          ) : (
            <form
              onSubmit={submit}
              className="space-y-4 rounded-2xl border bg-card p-6 shadow-card"
            >
              <h2 className="text-lg font-semibold">{<Text>{"تسجيل الدخول"}</Text>}</h2>
              <Field label={translate("البريد الإلكتروني")}>
                <div className="relative">
                  <Mail className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="email"
                    required
                    autoComplete="username"
                    maxLength={120}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="ps-9"
                  />
                </div>
              </Field>
              <Field label={translate("كلمة المرور")}>
                <div className="relative">
                  <Lock className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="password"
                    required
                    autoComplete="current-password"
                    maxLength={72}
                    value={pwd}
                    onChange={(e) => setPwd(e.target.value)}
                    className="ps-9"
                  />
                </div>
              </Field>
              <Button type="submit" className="w-full">
                {<Text>{"دخول"}</Text>}
              </Button>
              <button
                type="button"
                onClick={() =>
                  toast.info(translate("تواصل مع المدير العام لإعادة تعيين كلمة المرور."))
                }
                className="w-full text-center text-sm text-primary hover:underline"
              >
                {<Text>{"نسيت كلمة المرور؟"}</Text>}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

/** 2e étape de connexion : explications simples pour chaque mode de sécurité */
function EtapeConnexion({ etape }: { etape: Etape }) {
  useLanguage();
  const { verifier, renvoyerCode, annulerEtape } = useApp();
  const [code, setCode] = useState("");
  const [pin2, setPin2] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const chiffres = (v: string, max: number) => v.replace(/\D/g, "").slice(0, max);
  const valider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (envoi) return;
    setEnvoi(true);
    const ok =
      etape.type === "pin" || etape.type === "pin-setup"
        ? await verifier({ pin: code, pin2 })
        : await verifier({ code });
    setEnvoi(false);
    if (!ok) {
      setCode("");
      setPin2("");
    }
  };
  const retour = (
    <button
      type="button"
      onClick={annulerEtape}
      className="flex w-full items-center justify-center gap-1 text-sm text-primary hover:underline"
    >
      <ArrowLeft className="size-4 rtl:rotate-180" />
      {translate("العودة إلى تسجيل الدخول")}
    </button>
  );
  const champCode = (
    label: string,
    exemple: string,
    max: number,
    type: "text" | "password" = "text",
  ) => (
    <Field label={translate(label)}>
      <Input
        autoFocus
        required
        inputMode="numeric"
        autoComplete="one-time-code"
        type={type}
        maxLength={max}
        value={code}
        onChange={(e) => setCode(chiffres(e.target.value, max))}
        className="text-center font-mono text-2xl tracking-[0.5em]"
        placeholder={exemple}
        aria-label={translate(label)}
      />
    </Field>
  );
  const etapes = (lignes: string[]) => (
    <ol className="space-y-1.5 text-sm text-muted-foreground">
      {lignes.map((l, i) => (
        <li key={i} className="flex gap-2">
          <span className="grid size-5 shrink-0 place-items-center rounded-full bg-secondary text-xs font-semibold text-primary">
            {i + 1}
          </span>
          <span>{translate(l)}</span>
        </li>
      ))}
    </ol>
  );

  if (etape.type === "appareil")
    return (
      <div className="space-y-4 rounded-2xl border bg-card p-6 shadow-card">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <MonitorSmartphone className="size-5 text-primary" />
          {translate("جهاز جديد")}
        </h2>
        <p className="rounded-lg bg-warning/15 p-3 text-sm">{translate(etape.message)}</p>
        {etapes([
          "اطلب من المدير العام فتح صفحة « المستخدمون والأدوار ».",
          "يضغط على « موافقة » أمام هذا الجهاز.",
          "أعد تسجيل الدخول من هذا الجهاز نفسه.",
        ])}
        {retour}
      </div>
    );

  return (
    <form onSubmit={valider} className="space-y-4 rounded-2xl border bg-card p-6 shadow-card">
      {etape.type === "totp-setup" && (
        <>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Smartphone className="size-5 text-primary" />
            {translate("تفعيل الرمز على الهاتف (مرة واحدة)")}
          </h2>
          {etapes([
            "ثبّت على هاتفك تطبيق « Google Authenticator » أو « Microsoft Authenticator » (مجاني).",
            "افتح التطبيق واضغط « + » ثم « مسح رمز QR ».",
            "وجّه الكاميرا إلى هذا المربع.",
            "اكتب أدناه الرمز المكوّن من 6 أرقام الذي يظهر في التطبيق.",
          ])}
          <div className="flex justify-center">
            <img
              src={`data:image/svg+xml;base64,${btoa(etape.qr)}`}
              alt={translate("رمز QR لتطبيق المصادقة")}
              width={200}
              height={200}
              className="rounded-lg border bg-white p-2"
            />
          </div>
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer">{translate("لا تستطيع المسح؟")}</summary>
            <p className="mt-2">
              {translate("على نفس الهاتف:")}{" "}
              <a href={etape.lien} className="text-primary underline">
                {translate("افتح التطبيق مباشرة")}
              </a>
            </p>
            <p className="mt-1">
              {translate("أو أدخل هذا المفتاح يدوياً في التطبيق:")}{" "}
              <span dir="ltr" className="select-all font-mono text-foreground">
                {etape.cle}
              </span>
            </p>
          </details>
          {champCode("الرمز من التطبيق (6 أرقام)", "123456", 6)}
        </>
      )}
      {etape.type === "totp" && (
        <>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Smartphone className="size-5 text-primary" />
            {translate("الرمز من الهاتف")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {translate(
              "افتح تطبيق المصادقة على هاتفك واكتب الرمز المكوّن من 6 أرقام الظاهر تحت « Frère Flow ». الرمز يتغير كل 30 ثانية.",
            )}
          </p>
          {champCode("الرمز من التطبيق (6 أرقام)", "123456", 6)}
        </>
      )}
      {etape.type === "email" && (
        <>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Mail className="size-5 text-primary" />
            {translate("رمز عبر البريد")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {translate("أرسلنا رمزاً من 6 أرقام إلى")}{" "}
            <b dir="ltr" className="text-foreground">
              {etape.email}
            </b>
            . {translate("صالح لمدة 10 دقائق. تحقق أيضاً من مجلد « الرسائل غير المرغوب فيها ».")}
          </p>
          {champCode("الرمز المستلم (6 أرقام)", "123456", 6)}
          <button
            type="button"
            onClick={renvoyerCode}
            className="w-full text-center text-sm text-primary hover:underline"
          >
            {translate("لم يصلك الرمز؟ إعادة الإرسال")}
          </button>
        </>
      )}
      {etape.type === "pin" && (
        <>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <KeyRound className="size-5 text-primary" />
            {translate("رمز PIN")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {translate("اكتب رمز PIN الخاص بك (4 إلى 6 أرقام).")}
          </p>
          {champCode("رمز PIN", "••••", 6, "password")}
        </>
      )}
      {etape.type === "pin-setup" && (
        <>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <KeyRound className="size-5 text-primary" />
            {translate("اختر رمز PIN (مرة واحدة)")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {translate(
              "اختر 4 إلى 6 أرقام تحفظها جيداً، ستُطلب منك عند كل دخول. تجنّب 1234 أو تاريخ ميلادك. مثال: 4827",
            )}
          </p>
          {champCode("رمز PIN الجديد", "4827", 6, "password")}
          <Field label={translate("أعد كتابة رمز PIN")}>
            <Input
              required
              inputMode="numeric"
              type="password"
              maxLength={6}
              value={pin2}
              onChange={(e) => setPin2(chiffres(e.target.value, 6))}
              className="text-center font-mono text-2xl tracking-[0.5em]"
              placeholder="4827"
              aria-label={translate("أعد كتابة رمز PIN")}
            />
          </Field>
        </>
      )}
      <Button type="submit" className="w-full" disabled={envoi}>
        <ShieldCheck className="size-4" />
        {translate("تأكيد")}
      </Button>
      {retour}
    </form>
  );
}
