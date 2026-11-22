import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n";

export function LanguageSwitch() {
  const { language, setLanguage } = useLanguage();
  return (
    <div
      className="inline-flex shrink-0 items-center gap-1 rounded-md border bg-card p-1"
      dir="ltr"
      aria-label="Langue / اللغة"
    >
      <Languages className="mx-1 size-4 text-muted-foreground" />
      <Button
        size="sm"
        variant={language === "ar" ? "default" : "ghost"}
        aria-pressed={language === "ar"}
        onClick={() => setLanguage("ar")}
      >
        العربية
      </Button>
      <Button
        size="sm"
        variant={language === "fr" ? "default" : "ghost"}
        aria-pressed={language === "fr"}
        onClick={() => setLanguage("fr")}
      >
        Français
      </Button>
    </div>
  );
}
