<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

# Project rules

- All data lives in `src/store/store.tsx` (React context), loaded from and saved to the API server `frere-flow-backend` (MongoDB). Pages only use useApp()/run(op, ...). Why: the backend executes the same ops; pages stay unchanged.
- Business logic lives in pure functions in `src/services/ops.ts` and domain service modules (state, input) => state; pages call them via `run(op, ...)`. Why: each op maps 1:1 to a future API endpoint.
- Domain types in `src/types`, seed data in `src/mock/seed.ts` generated through the same ops. Why: seed stays consistent with business rules.
- Stock and packaging balances are derived from movements, never stored. Why: avoids drift and keeps Frigo/Figo separation exact.
- Authenticated pages live under the pathless `src/routes/_erp` layout (ssr: false). Why: session (HttpOnly cookie) and data come from the API at runtime.
- The sign-in route is also client-rendered. Why: its persisted language and demo accounts must not hydrate against server-default language and data.
- Backend connected: `run(op, ...)` applies the op locally (optimistic) then POSTs it to `/api/ops/<name>` (names in OP_NAMES in store.tsx); the server re-runs the same op from its copy of `src/services` (regenerate with `npm run sync-domain` in frere-flow-backend after changing services or seed). Login, sessions and permissions are enforced by the server.
- Keep language selection in LanguageProvider and translations in src/lib/translations.ts; localize presentation without rewriting stored business data, so switching languages preserves user entries and balances.
- Market trips (src/services/markets.ts): goods leave fridges on departure; market sales are normal Sales tagged with marketTripId and draw from the truck, not the fridge; closing returns unsold goods to the source fridge and freezes gaps. Why: keeps fridge stock exact while goods are on the road.
- The market workspace uses focused components under `src/components/markets`, optional client market linkage and selectors in the market service; receipt totals use payment records and closing cutoffs. Why: isolates market reporting without duplicating the sales ledger or altering saved legacy customers.
- Deadlines are views of existing credits with optional source/reminder metadata; payments reuse credit operations, sale-backed amounts stay fixed, and deadline cancellation only suppresses reminders. Why: keeps sales, cash and debt accounting authoritative without destructive financial edits.
