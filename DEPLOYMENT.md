# Deployment Guide

## GitHub Pages

GitHub Pages serves static files from the `docs/` folder on the `main` branch.

### Setup

1. Push the repository to GitHub.

2. Go to your repository on GitHub: **Settings > Pages**.

3. Under **Source**, select:
   - Branch: `main`
   - Folder: `/docs`

4. Click **Save**. Your site will be available at:
   ```
   https://YOUR_USERNAME.github.io/network-effects-viz/
   ```

### Updating

After making changes to the React apps:

```bash
cd dashboard && npm run build
cd ../timeline-viz && npm run build
cd ../geo-viz && npm run build
git add docs/
git commit -m "Rebuild production assets"
git push
```

GitHub Pages will automatically redeploy within a few minutes.

## Vercel

### Setup

1. Sign up at [vercel.com](https://vercel.com) and import your GitHub repository.

2. Configure the project:
   - **Framework Preset**: Other
   - **Root Directory**: `docs`
   - **Build Command**: *(leave empty — pre-built static files)*
   - **Output Directory**: `.`

3. Add environment variables in **Settings > Environment Variables** if your app needs them at runtime:
   ```
   SUPABASE_HOST=your_host_here
   SUPABASE_DB=postgres
   SUPABASE_USER=your_user_here
   SUPABASE_PASSWORD=your_password_here
   SUPABASE_PORT=5432
   ```

4. Click **Deploy**.

### Custom Domain

In **Settings > Domains**, add your custom domain and update your DNS records as instructed.

## Netlify

### Setup

1. Sign up at [netlify.com](https://www.netlify.com) and click **Add new site > Import an existing project**.

2. Connect your GitHub repository.

3. Configure build settings:
   - **Base directory**: *(leave empty)*
   - **Build command**: *(leave empty)*
   - **Publish directory**: `docs`

4. Add environment variables in **Site settings > Environment variables** if needed (same as listed above).

5. Click **Deploy site**.

### Custom Domain

In **Domain management**, add your custom domain and configure DNS as instructed.

## Notes

- The `docs/` folder contains pre-built static files. No build step is needed on the hosting platform.
- The visualizations load data from JSON files bundled in the build — no server-side database connection is required for the deployed site.
- Environment variables (`.env`) are only needed for local development and data extraction scripts, not for the static deployment.
