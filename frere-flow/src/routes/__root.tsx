import { Text, translate, useLanguage } from "@/lib/i18n";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AppProvider } from "@/store/store";
import { Toaster } from "@/components/ui/sonner";
import { LanguageProvider } from "@/lib/i18n";

function NotFoundComponent() {
  useLanguage();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">
          {<Text>{"الصفحة غير موجودة"}</Text>}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {<Text>{"\n          الصفحة المطلوبة غير موجودة أو تم نقلها.\n        "}</Text>}
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {<Text>{"\n            العودة إلى الرئيسية\n          "}</Text>}
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  useLanguage();
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {<Text>{"\n          تعذر تحميل الصفحة\n        "}</Text>}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {
            <Text>
              {"\n          حدث خطأ. يمكنك إعادة المحاولة أو العودة إلى الصفحة الرئيسية.\n        "}
            </Text>
          }
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {<Text>{"\n            إعادة المحاولة\n          "}</Text>}
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            {<Text>{"\n            العودة إلى الرئيسية\n          "}</Text>}
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Frère Mahjoub — Gestion" },
      {
        name: "description",
        content: "Application de gestion interne de la Société Frère Mahjoub.",
      },
      { property: "og:title", content: "Frère Mahjoub — Gestion" },
      {
        property: "og:description",
        content: "Application de gestion interne de la Société Frère Mahjoub.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  useLanguage();
  return (
    <html lang="ar" dir="rtl">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  useLanguage();
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <LanguageProvider>
        <AppProvider>
          <Outlet />
          <LocalizedToaster />
        </AppProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

function LocalizedToaster() {
  const { language } = useLanguage();
  return (
    <Toaster
      richColors
      position={language === "ar" ? "top-left" : "top-right"}
      dir={language === "ar" ? "rtl" : "ltr"}
    />
  );
}
