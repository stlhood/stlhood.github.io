# Telepath Landing Page

Scroll-driven landing page with 3D Jenga tower animation.

## Structure

```
src/           # Source files
  index.html   # Main landing page
  index.js     # Animation/scroll logic
  confirmed.html
  subscribed.html
  public/      # Static assets (copied to docs/ root)
docs/          # Build output (served by GitHub Pages -- which only supports
               # root or docs/, no other folders can serve as web root)
```

## CNAME file

I **believe** that github expects this file `CNAME`, which is for custom domain
serving, to exist in the root of the repo, so it's there. However it was
unclear, so I also set it up to exist at the **web** root which is `docs/` so
there is also `src/public/CNAME` and thus `docs/CNAME` just to be safe.

## Development

```bash
npm install
npm run dev      # Start dev server
npm run build    # Build to docs/
npm run preview  # Preview built site
```

## Deployment

GitHub Pages serves from `docs/`. After building, commit and push.
