# Deploying Prima Karaoke

The whole app is a single static file: **`index.html`** at the repo root.
No build step, no dependencies. You can open it locally by double-clicking it,
or host it anywhere that serves static files.

## GitHub Pages (automated, via GitHub Actions)

This repo ships a workflow at `.github/workflows/deploy.yml` that publishes the
site to GitHub Pages on every push to `main`. The first run also **enables
Pages automatically** (Settings → Pages → Source is set to *GitHub Actions*).

Once the workflow has run successfully, the site is live at:

    https://jschristensen.github.io/primakaraoke/

To watch a deploy: open the repo's **Actions** tab → **Deploy to GitHub Pages**.
The published URL is shown on the `deploy` job (and under Settings → Pages).

### If the first deploy is blocked

If the run fails with *"Branch is not allowed to deploy to github-pages"*, the
`github-pages` environment is restricted to a specific branch. Either:

- merge this branch into `main` (the workflow also runs on `main`), or
- go to **Settings → Environments → github-pages** and allow the branch.

## Alternative: Deploy from a branch (no Actions)

If you'd rather not use Actions:

1. Make sure `index.html` is at the root of `main`.
2. **Settings → Pages → Source: Deploy from a branch → `main` / `/ (root)` → Save.**
3. ~1 minute later it's live at the URL above.

## Notes

- **Lyric search** uses the free [LRCLIB](https://lrclib.net) API. It works on a
  normal https page (like GitHub Pages); some sandboxed in-app previews block the
  outbound request.
- **Mic check** uses the browser microphone via `getUserMedia`; the browser will
  prompt for permission the first time. Audio is processed locally and never sent
  anywhere.
- The **Songbook** and **Paste lyrics** tabs work entirely offline.
