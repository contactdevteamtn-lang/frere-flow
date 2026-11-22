// Formulaires critiques : anti double-soumission (vente en double), confirmation, lecture seule.
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const appState = { readOnly: false };
vi.mock("@/store/store", () => ({ useApp: () => appState }));

import { Confirm, FormDialog } from "@/components/app/forms";

function Formulaire({ onSubmit }: { onSubmit: () => void }) {
  return (
    <FormDialog
      open
      onOpenChange={() => {}}
      title="Nouvelle vente"
      onSubmit={onSubmit}
      submitLabel="حفظ"
    >
      <input aria-label="montant" defaultValue="10" />
    </FormDialog>
  );
}

describe("FormDialog", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    appState.readOnly = false;
  });
  afterEach(() => vi.useRealTimers());

  it("un double-clic n'envoie l'action qu'une seule fois et grise le bouton", () => {
    const onSubmit = vi.fn();
    render(<Formulaire onSubmit={onSubmit} />);
    const bouton = screen.getByRole("button", { name: "حفظ" });
    fireEvent.click(bouton);
    fireEvent.click(bouton);
    fireEvent.submit(bouton.closest("form") ?? document.getElementById("fd")!);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(bouton).toBeDisabled();
  });

  it("le bouton se réactive après le délai (correction après une erreur de saisie)", () => {
    const onSubmit = vi.fn();
    render(<Formulaire onSubmit={onSubmit} />);
    const bouton = screen.getByRole("button", { name: "حفظ" });
    fireEvent.click(bouton);
    act(() => {
      vi.advanceTimersByTime(1300);
    });
    expect(bouton).not.toBeDisabled();
    fireEvent.click(bouton);
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });

  it("compte en lecture seule : pas de bouton d'enregistrement", () => {
    appState.readOnly = true;
    render(<Formulaire onSubmit={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "حفظ" })).toBeNull();
  });
});

describe("Confirm", () => {
  beforeEach(() => {
    appState.readOnly = false;
  });

  it("une confirmation cliquée deux fois n'exécute l'action qu'une fois", () => {
    const onConfirm = vi.fn();
    render(
      <Confirm
        open
        onOpenChange={() => {}}
        title="Annuler la vente ?"
        description="Action définitive"
        onConfirm={onConfirm}
        label="تأكيد"
      />,
    );
    const bouton = screen.getByRole("button", { name: "تأكيد" });
    fireEvent.click(bouton);
    fireEvent.click(bouton);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
