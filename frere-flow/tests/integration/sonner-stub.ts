type ToastWindow = Window & { __toasts?: { type: string; m: string }[] };
const push = (type: string) => (m: string) => {
  const integrationWindow = window as ToastWindow;
  (integrationWindow.__toasts ||= []).push({ type, m });
};
export const toast = { error: push("error"), success: push("success"), info: push("info") };
export const Toaster = () => null;
