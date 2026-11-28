import { Text, translate, useLanguage } from "@/lib/i18n";
import {
  createFileRoute,
  Link,
  type LinkProps,
  Navigate,
  Outlet,
  useRouterState,
} from "@tanstack/react-router";
import { useState } from "react";
import {
  LayoutDashboard,
  Users,
  Package,
  ShoppingCart,
  FileText,
  CreditCard,
  Wallet,
  Landmark,
  Warehouse,
  Snowflake,
  ArrowLeftRight,
  Boxes,
  Tags,
  Store,
  Scale,
  UsersRound,
  BarChart3,
  ShieldCheck,
  History,
  Settings,
  LogOut,
  Menu,
  X,
  CalendarClock,
  KeyRound,
  type LucideIcon,
} from "lucide-react";
import { useApp } from "@/store/store";
import type { PermissionKey } from "@/types";
import { cn } from "@/lib/utils";
import logo from "@/assets/logo.png";
import { LanguageSwitch } from "@/components/app/LanguageSwitch";
import { MonCompte } from "@/components/app/MonCompte";

export const Route = createFileRoute("/_erp")({
  ssr: false,
  component: Shell,
});

type Item = {
  to: NonNullable<LinkProps["to"]>;
  label: string;
  icon: LucideIcon;
  perm: PermissionKey;
};
const NAV: { title?: string; items: Item[] }[] = [
  {
    items: [
      {
        to: "/dashboard",
        label: translate("لوحة المتابعة"),
        icon: LayoutDashboard,
        perm: "dashboard",
      },
      { to: "/clients", label: translate("العملاء"), icon: Users, perm: "clients" },
      { to: "/produits", label: translate("المنتجات"), icon: Package, perm: "produits" },
      { to: "/ventes", label: translate("المبيعات"), icon: ShoppingCart, perm: "ventes" },
      { to: "/factures", label: translate("الفواتير"), icon: FileText, perm: "ventes" },
      { to: "/marches", label: translate("الأسواق"), icon: Store, perm: "marches" },
      { to: "/credits", label: translate("الديون"), icon: CreditCard, perm: "credits" },
      { to: "/echeances", label: "تقويم الاستحقاقات", icon: CalendarClock, perm: "credits" },
      { to: "/paiements", label: translate("المدفوعات"), icon: Wallet, perm: "paiements" },
      { to: "/caisse", label: translate("الصندوق المالي"), icon: Landmark, perm: "caisse" },
    ],
  },
  {
    title: translate("المخزون"),
    items: [
      {
        to: "/stock",
        label: translate("المخزون حسب غرفة التبريد"),
        icon: Warehouse,
        perm: "stock",
      },
      { to: "/frigos", label: translate("غرف التبريد"), icon: Snowflake, perm: "frigos" },
      { to: "/mouvements", label: translate("الحركات"), icon: ArrowLeftRight, perm: "stock" },
    ],
  },
  {
    title: translate("الصناديق"),
    items: [
      { to: "/emballages", label: translate("أنواع الصناديق"), icon: Tags, perm: "emballages" },
      {
        to: "/emballages-mouvements",
        label: translate("الحركات"),
        icon: Boxes,
        perm: "emballages",
      },
      {
        to: "/emballages-soldes",
        label: translate("أرصدة العملاء"),
        icon: Scale,
        perm: "emballages",
      },
    ],
  },
  {
    title: translate("المتابعة"),
    items: [
      {
        to: "/equipes",
        label: translate("الفرق / غرفة التبريد"),
        icon: UsersRound,
        perm: "equipes",
      },
      { to: "/rapports", label: translate("التقارير"), icon: BarChart3, perm: "rapports" },
    ],
  },
  {
    title: translate("الإدارة"),
    items: [
      {
        to: "/utilisateurs",
        label: translate("المستخدمون والأدوار"),
        icon: ShieldCheck,
        perm: "administration",
      },
      { to: "/historique", label: translate("السجل"), icon: History, perm: "historique" },
      { to: "/parametres", label: translate("الإعدادات"), icon: Settings, perm: "parametres" },
    ],
  },
];

function Shell() {
  useLanguage();
  const { me, ready, can, roleName, logout, state, teamFilter, setTeamFilter, readOnly } = useApp();
  const [open, setOpen] = useState(false);
  const [compte, setCompte] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });
  if (!ready) return null;
  if (!me) return <Navigate to="/" />;
  // page non autorisée pour ce rôle (ex. compte « marchés seulement ») → première page autorisée
  const pages = NAV.flatMap((g) => g.items);
  const ici = pages.find((i) => path === i.to || path.startsWith(i.to + "/"));
  if (ici && !can(ici.perm)) {
    const premiere = pages.find((i) => can(i.perm));
    if (premiere) return <Navigate to={premiere.to} />;
  }
  const lockedTeam = !!me.teamId && !can("administration");

  const sidebar = (
    <nav className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-3 px-5 py-5">
        <span className="grid size-10 place-items-center rounded-xl bg-card">
          <img src={logo} alt="" className="size-8" width={32} height={32} />
        </span>
        <div className="leading-tight">
          <p className="font-display text-base font-semibold text-sidebar-accent-foreground">
            {<Text>{"الإخوة محجوب"}</Text>}
          </p>
          <p className="text-xs opacity-70">{<Text>{"الإدارة الزراعية"}</Text>}</p>
        </div>
      </div>
      <div className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        {NAV.map((g, gi) => {
          const items = g.items.filter((i) => can(i.perm));
          if (!items.length) return null;
          return (
            <div key={gi}>
              {g.title && (
                <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider opacity-55">
                  {translate(g.title)}
                </p>
              )}
              <div className="space-y-0.5">
                {items.map((i) => {
                  const active =
                    path === i.to || (i.to !== "/dashboard" && path.startsWith(i.to + "/"));
                  return (
                    <Link
                      key={i.to}
                      to={i.to}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                        active
                          ? "bg-sidebar-primary font-semibold text-sidebar-primary-foreground"
                          : "hover:bg-sidebar-accent",
                      )}
                    >
                      <i.icon className="size-4" /> {translate(i.label)}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div className="border-t border-sidebar-border p-3">
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-sidebar-accent"
        >
          <LogOut className="size-4" />
          {<Text>{" تسجيل الخروج"}</Text>}
        </button>
      </div>
    </nav>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-foreground/40" onClick={() => setOpen(false)} />
          <aside className="relative h-full w-72">
            {sidebar}
            <button
              onClick={() => setOpen(false)}
              className="absolute end-3 top-5 text-sidebar-foreground"
            >
              <X className="size-5" />
            </button>
          </aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex flex-wrap items-center gap-3 border-b bg-card/90 px-4 py-3 backdrop-blur md:px-6">
          <button
            className="lg:hidden"
            onClick={() => setOpen(true)}
            aria-label={translate("القائمة")}
          >
            <Menu className="size-5" />
          </button>
          <div className="flex items-center gap-1 rounded-lg bg-muted p-1 text-sm">
            {!lockedTeam && (
              <button
                onClick={() => setTeamFilter("all")}
                className={cn(
                  "rounded-md px-3 py-1",
                  teamFilter === "all"
                    ? "bg-card font-semibold shadow-card"
                    : "text-muted-foreground",
                )}
              >
                {<Text>{"الكل"}</Text>}
              </button>
            )}
            {state.teams
              .filter((t) => !lockedTeam || t.id === me.teamId)
              .map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTeamFilter(t.id)}
                  className={cn(
                    "rounded-md px-3 py-1",
                    teamFilter === t.id
                      ? "bg-primary font-semibold text-primary-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  {translate(t.name ?? "")}
                </button>
              ))}
          </div>
          <div className="ms-auto flex items-center gap-3">
            <LanguageSwitch />
            <div className="hidden text-end sm:block">
              <p className="text-sm font-semibold leading-tight">{translate(me.name ?? "")}</p>
              <p className="text-xs text-muted-foreground">
                {translate(roleName)}
                {readOnly && (
                  <span className="ms-2 rounded-full bg-warning/15 px-2 py-0.5 font-medium text-warning-foreground">
                    {translate("اطلاع فقط")}
                  </span>
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCompte(true)}
              title={translate("حسابي")}
              aria-label={translate("حسابي")}
              className="grid size-9 place-items-center rounded-full bg-secondary font-semibold text-primary hover:ring-2 hover:ring-primary/40"
            >
              {translate(me.name ?? "")
                .split(" ")
                .map((x) => x[0])
                .slice(0, 2)
                .join("")}
            </button>
          </div>
        </header>
        <main className="flex-1 px-4 py-6 md:px-8">
          {me.passwordInitial && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
              <span className="flex items-center gap-2">
                <KeyRound className="size-4 text-warning-foreground" />
                {translate("أنت تستخدم كلمة المرور الأولية. غيّرها الآن لحماية حسابك.")}
              </span>
              <button
                type="button"
                onClick={() => setCompte(true)}
                className="rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground hover:bg-primary/90"
              >
                {translate("تغيير كلمة المرور")}
              </button>
            </div>
          )}
          <Outlet />
        </main>
        {compte && <MonCompte onClose={() => setCompte(false)} />}
      </div>
    </div>
  );
}
