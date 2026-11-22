import { createRoot } from "react-dom/client";
import { AppProvider, useApp } from "@/store/store";
import * as ops from "@/services/ops";
import * as markets from "@/services/markets";
import * as deadlines from "@/services/deadlines";
type IntegrationWindow = Window & {
  __ops: typeof ops & typeof markets & typeof deadlines;
  __app: ReturnType<typeof useApp>;
};
const integrationWindow = window as unknown as IntegrationWindow;
integrationWindow.__ops = { ...ops, ...markets, ...deadlines };
function Spy() {
  const app = useApp();
  integrationWindow.__app = app;
  return <div id="me">{app.ready ? (app.me?.id ?? "none") : "loading"}</div>;
}
createRoot(document.getElementById("root")!).render(
  <AppProvider>
    <Spy />
  </AppProvider>,
);
