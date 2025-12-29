# Active Work - In Progress Deployment

## Status: Mid-Deployment - Waiting for GitHub Pages Configuration

We have successfully migrated the Jenga tower landing page from the jenga-sim development repo into this stlhood.github.io production repo with a clean Vite build system.

## What's Been Done

### Migration Complete
- ✅ All source files moved to `src/` directory:
  - `index.html` (renamed from landing3.html)
  - `index.js` (renamed from landing3.js) - includes all Jenga tower physics/animation code
  - `confirmed.html` - email confirmation success page
  - `subscribed.html` - waitlist signup redirect page
  - `animation-compressed.json` - physics simulation data for Jenga tower
  - All static assets (favicons, images, CNAME, etc.) in `src/public/`

- ✅ Vite build system configured:
  - `vite.config.js` - multi-page build, outputs to `docs/`
  - `package.json` - dependencies (three.js, vite)
  - Builds all three HTML pages and bundles JS/assets

- ✅ Built to `docs/` folder - complete and ready to serve

- ✅ Cleaned up old files:
  - Removed all test folders (test1-7)
  - Removed old/ directory
  - Removed stale assets from root

- ✅ Git commits pushed:
  - Commit 1: Clean migration with src/docs structure
  - Commit 2: Temporary duplication (docs/* copied to root for zero-downtime transition)
  - Commit 3: Changed build output from dist/ to docs/ (GitHub Pages requirement)

## Current State

**Files exist in TWO locations:**
- Root: index.html, confirmed.html, subscribed.html, assets/, etc. (TEMPORARY)
- docs/: Same files (PERMANENT)

**Why:** This allows switching GitHub Pages configuration without downtime. GitHub Pages only supports serving from root or `/docs` folder (not `/dist`).

## Next Steps (IN ORDER)

### Step 1: Configure GitHub Pages (YOU MUST DO)
1. Go to: https://github.com/stlhood/stlhood.github.io/settings/pages
2. Under "Build and deployment" > "Source"
3. Change from `/` (root) to `/docs` folder
4. Save and wait 1-2 minutes for GitHub Pages to rebuild
5. Test https://telepath.computer to confirm it works

### Step 2: Clean Up Duplicates (AFTER CONFIRMING STEP 1 WORKS)
Once site is confirmed working from docs/:
```bash
cd ~/repos/stlhood.github.io
# Remove duplicates from root
rm -rf index.html confirmed.html subscribed.html assets/ animation-compressed.json \
  CNAME announcement.jpg logo-*.png telepath-*.png telepath_large.png web-app-manifest-*.png
# Commit cleanup
git add -A
git commit -m "Clean up: remove duplicates from root, now serving from docs/"
git push
```

## Important Notes

- All content from deployed site has been preserved (confirmed.html, subscribed.html subscription workflow intact)
- Buttondown email redirects point to /subscribed.html and /confirmed.html - these will continue working from docs/
- The blog link (uniquehazards.com) has been corrected in src/index.html and built to docs/
- Debug mode code is still present but disabled (DEBUG_TIMELINE = false)

## Development Workflow Going Forward

```bash
# Start dev server
npm run dev

# Build for production
npm run build

# Preview built site
npm run preview
```

All changes should be made in `src/`, then built to `docs/`, then committed and pushed (both src/ and docs/ are tracked in git).
