# Listen — Text Reader PWA

A simple progressive web app that reads text files or pasted text aloud, like a lightweight Audible.

## Features
- Pick from available voices on your device (Web Speech API).
- Control speed, pitch, and chunk size.
- Upload `.txt`, `.md`, or `.html` files.
- Save progress between sessions.
- Installable as a PWA; works offline after first load.

## Running Locally
```bash
# Serve locally with Python
python3 -m http.server 8000
# Open in browser
http://localhost:8000
```
Then in Safari on iOS: Share → Add to Home Screen.

## Deployment
Host the contents of `pwa-audible-like/` on any static hosting service (Netlify, GitHub Pages, Vercel, etc.).

## GitHub Pages Deployment

This repo includes a GitHub Actions workflow that deploys the PWA to **GitHub Pages** automatically.

**One-time setup:**
1. Create a new GitHub repo (e.g., `listen-pwa`).
2. Initialize and push:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   # set your repo URL:
   git branch -M main
   git remote add origin https://github.com/<YOUR_USERNAME>/<YOUR_REPO>.git
   git push -u origin main
   ```
3. In your GitHub repo, go to **Settings → Pages** and ensure the build is set to "GitHub Actions".
   The included workflow (`.github/workflows/pages.yml`) handles the rest.
4. After the first push, check the **Actions** tab. When the workflow finishes, your site will be live at:
   `https://<YOUR_USERNAME>.github.io/<YOUR_REPO>/`

**Local changes & redeploy:**
- Push to `main` (or `master`) again; Pages will re-deploy automatically.
