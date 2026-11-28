// Formulaire de vente : chaque case de ligne a un libellé fixe ; choisir un produit remplit le prix
// dans la case « prix » (et jamais dans la case « quantité »), sans changer l'ordre des cases.
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { buildSeed } from "@/mock/seed";

const state = buildSeed();
const me = state.users.find((u) => u.id === "u_super")!;
vi.mock("@/store/store", () => ({
  useApp: () => ({
    state: { ...state, sessionUserId: me.id },
    run: vi.fn(),
    me,
    can: () => true,
    readOnly: false,
  }),
}));

const { NewSale } = await import("@/routes/_erp/ventes");

describe("formulaire de vente : lignes produit", () => {
  it("libellés fixes Produit / Quantité / Prix / Total, prix rempli au bon endroit", () => {
    render(<NewSale onClose={() => {}} defaultTeam={state.teams[0]!.id} />);
    const quantite = screen.getByLabelText("الكمية (كغ)") as HTMLInputElement;
    const prix = screen.getByLabelText("سعر الوحدة (د.ت)") as HTMLInputElement;
    expect(screen.getAllByText("المنتج").length).toBeGreaterThan(0);
    expect(screen.getAllByText("المجموع").length).toBeGreaterThan(0);

    // ordre des cases dans la ligne : produit, quantité, prix (inchangé après le choix du produit)
    const ligne = quantite.closest(".grid") as HTMLElement;
    const ordre = () =>
      [...within(ligne).getAllByRole("spinbutton")].map((e) => e.getAttribute("aria-label"));
    expect(ordre()).toEqual(["الكمية (كغ)", "سعر الوحدة (د.ت)"]);

    const produit = state.products.find((p) => p.active)!;
    fireEvent.change(within(ligne).getByRole("combobox"), { target: { value: produit.id } });
    expect(prix.value).toBe(String(produit.salePrice));
    expect(quantite.value).toBe("1"); // quantité de départ : 1
    expect(ordre()).toEqual(["الكمية (كغ)", "سعر الوحدة (د.ت)"]);

    fireEvent.change(quantite, { target: { value: "10" } });
    expect(quantite.value).toBe("10");
    expect(prix.value).toBe(String(produit.salePrice));
  });
});
