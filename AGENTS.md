<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules

- UI is Hebrew, right-to-left (`dir="rtl"` on `<html>`); use logical spacing/position utilities (`ps-`, `pe-`, `start-`, `end-`, `text-start`) instead of left/right so layouts mirror correctly.
- Signed-in pages live under `src/routes/_authenticated/` (client-only gate that puts `user` in route context); data is read in the browser with the generated client and protected by owner-only RLS (`user_id = auth.uid()`), so no server functions are needed for per-user CRUD.
- Query definitions live in `src/lib/queries.ts`; routes preload them in `loader` with `ensureQueryData` and read with `useSuspenseQuery`, mutations invalidate by query key.
- Tournament analysis is pure functions in `src/lib/analysis.ts` with tests next to it; keep calculations out of components. Fortnite Tracker exposes no per-event results API, so tournament results are entered manually.
- Training videos are files in the private `training-videos` bucket under `<user_id>/...`, shown through signed URLs.
