# Telepath Landing Page

Scroll-driven landing page with 3D Jenga tower animation.

## Structure

```
src/           # Source files
  index.html   # Main landing page
  index.js     # Animation/scroll logic
  confirmed.html
  subscribed.html
  public/      # Static assets (copied to dist root)
dist/          # Build output (served by GitHub Pages)
```

## Development

```bash
npm install
npm run dev      # Start dev server
npm run build    # Build to dist/
npm run preview  # Preview built site
```

## Deployment

GitHub Pages serves from `dist/`. After building, commit and push.
