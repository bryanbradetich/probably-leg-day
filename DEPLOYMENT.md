# Deploying Probably Leg Day to Vercel

This guide walks you through deploying the Probably Leg Day workout tracking app to Vercel.

## Prerequisites

- A [Vercel](https://vercel.com) account (sign up with GitHub for easiest integration)
- Your project pushed to a **GitHub** repository (Vercel deploys from Git)
- A [Supabase](https://supabase.com) project (for auth and database)

### If you don’t have a GitHub remote yet

From your project root:

```bash
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

Use your actual GitHub repo URL and branch name.

---

## Step 1: Create a Vercel account and connect GitHub

1. Go to [vercel.com](https://vercel.com) and sign up or log in.
2. Choose **Continue with GitHub** so you can deploy from your repo.
3. When prompted, authorize Vercel to access your GitHub account and repositories.

---

## Step 2: Import the project

1. In the Vercel dashboard, click **Add New…** → **Project**.
2. Select **Import Git Repository** and find your **Probably Leg Day** repo (or the repo name you used).
3. Click **Import**.
4. Vercel will detect Next.js automatically. Leave the default settings:
   - **Framework Preset:** Next.js
   - **Root Directory:** . (leave blank)
   - **Build Command:** `npm run build` (default)
   - **Output Directory:** (Next.js default)

---

## Step 3: Set environment variables

Before deploying, add your Supabase keys so the app can talk to your backend.

1. In the import/settings step, open the **Environment Variables** section.
2. Add these variables (use the same values you have in `.env.local` locally):

   | Name | Value | Notes |
   |------|--------|--------|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://your-project.supabase.co` | From Supabase → Settings → API |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` (long string) | From Supabase → Settings → API → anon public |

3. Apply them to **Production**, **Preview**, and **Development** if you use Vercel previews.
4. Click **Deploy**.

---

## Step 4: Supabase Auth – allow your production URL

After the first deploy, your app will run on a URL like `https://your-app.vercel.app`. Supabase Auth must allow this origin.

1. In [Supabase](https://supabase.com/dashboard), open your project.
2. Go to **Authentication** → **URL Configuration**.
3. Under **Redirect URLs**, add:
   - `https://your-app.vercel.app/**`
   - If you add a custom domain later, also add `https://your-domain.com/**`
4. Under **Site URL**, you can set the production URL (e.g. `https://your-app.vercel.app`) so redirects after sign-in go to the right place.
5. Save.

---

## Step 5: Custom domain (optional)

1. In the Vercel project, go to **Settings** → **Domains**.
2. Enter your domain (e.g. `probablylegday.com`).
3. Follow Vercel’s instructions to add the suggested DNS records at your registrar.
4. After the domain is verified, add the same URL to Supabase **Redirect URLs** and **Site URL** as in Step 4.

---

## Step 6: Redeploy after env or Supabase changes

- **Env vars:** Change them under **Settings** → **Environment Variables**, then trigger a new deploy from the **Deployments** tab (e.g. **Redeploy** on the latest deployment).
- **Supabase:** After changing Redirect URLs or Site URL, no redeploy is needed; the next sign-in will use the new settings.

---

## Checklist

- [ ] Repo is pushed to GitHub and connected to Vercel
- [ ] `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set in Vercel
- [ ] Production URL is added to Supabase **Redirect URLs** and **Site URL**
- [ ] `npm run build` completes successfully (run locally before pushing)
- [ ] Optional: custom domain added in Vercel and in Supabase URL config
