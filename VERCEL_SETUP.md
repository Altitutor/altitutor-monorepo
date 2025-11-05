# Vercel Configuration for pnpm Monorepo

## 🎯 Overview

Your apps are deployed on Vercel from a pnpm monorepo. This guide shows you exactly what settings to configure.

## 📱 Projects to Configure

You have **2 Next.js apps** that need configuration:
1. **admin-web** - Admin/CRM application
2. **student-web** - Student-facing application

---

## ⚙️ Configuration for Each Project

### 1. admin-web

**Access Settings:**
```
https://vercel.com/[your-team]/[admin-web-project]/settings/general
```

**Build & Development Settings:**

| Setting | Value |
|---------|-------|
| **Framework Preset** | `Next.js` |
| **Root Directory** | `apps/admin-web` |
| **Build Command** | `cd ../.. && pnpm turbo run build --filter=altitutor-admin-app` |
| **Install Command** | `pnpm install` |
| **Output Directory** | `.next` (leave default) |

**Screenshot of what to change:**
- Navigate to: Settings → General → Build & Development Settings
- Click "Override" for Build Command and Install Command
- Enter the values above

---

### 2. student-web

**Access Settings:**
```
https://vercel.com/[your-team]/[student-web-project]/settings/general
```

**Build & Development Settings:**

| Setting | Value |
|---------|-------|
| **Framework Preset** | `Next.js` |
| **Root Directory** | `apps/student-web` |
| **Build Command** | `cd ../.. && pnpm turbo run build --filter=student-web` |
| **Install Command** | `pnpm install` |
| **Output Directory** | `.next` (leave default) |

---

## 🚀 Optional Performance Optimizations

### Enable Turborepo Remote Caching (Recommended)

Add this environment variable to **both projects**:

**Navigate to:** Settings → Environment Variables

| Key | Value | Environment |
|-----|-------|-------------|
| `TURBO_TOKEN` | `[Get from Vercel]` | All (Production, Preview, Development) |
| `TURBO_TEAM` | `[Your team slug]` | All (Production, Preview, Development) |

**How to get these values:**
1. Go to your Vercel dashboard
2. Click on your team → Settings → Tokens
3. Create a new token for Turborepo
4. Copy the token and team slug

This enables build caching across deployments, speeding up builds by **50-70%**.

---

## ✅ Verification Steps

After updating the settings:

### 1. Trigger a Deploy
```bash
git commit -m "chore: update vercel config for pnpm"
git push
```

### 2. Check the Build Logs

Look for these indicators in your Vercel build logs:
```
✓ Installing dependencies with pnpm
✓ pnpm install
✓ cd ../.. && pnpm turbo run build --filter=...
```

### 3. Common Success Indicators
- Build time should be **faster** than npm (after first build)
- You'll see "Installing dependencies with pnpm" in logs
- Turbo cache hits will show in subsequent builds

---

## 🐛 Troubleshooting

### Issue: "pnpm: command not found"

**Fix:** Vercel automatically detects pnpm if:
1. You have `"packageManager": "pnpm@9.15.0"` in root `package.json` ✅ (Already done)
2. You have `pnpm-lock.yaml` in your repo ✅ (Already done)

If still failing, explicitly set Install Command: `npm install -g pnpm@9 && pnpm install`

---

### Issue: "No package matched filter"

**Fix:** Make sure your Build Command uses the correct filter name:
- admin-web: `--filter=altitutor-admin-app` (matches package.json name)
- student-web: `--filter=student-web` (matches package.json name)

To verify filter names:
```bash
cat apps/admin-web/package.json | grep '"name"'
cat apps/student-web/package.json | grep '"name"'
```

---

### Issue: Workspace dependencies not resolving

This should be fixed now that we're using `workspace:*` protocol in package.json files.

Verify in your package.json files:
```json
"dependencies": {
  "@altitutor/shared": "workspace:*",
  "@altitutor/ui": "workspace:*"
}
```

---

### Issue: Build works locally but fails on Vercel

**Common causes:**
1. Missing environment variables
2. Different Node version

**Fix:**
- Check Environment Variables in Vercel settings
- Set Node version in package.json: `"engines": { "node": ">=20.0.0" }`

---

## 📝 Quick Reference: Build Commands

Copy-paste these exact commands into Vercel:

**admin-web Build Command:**
```bash
cd ../.. && pnpm turbo run build --filter=altitutor-admin-app
```

**student-web Build Command:**
```bash
cd ../.. && pnpm turbo run build --filter=student-web
```

**Install Command (same for both):**
```bash
pnpm install
```

---

## 🔄 Future: Adding More Apps

When you add new apps (including React Native):

1. **Create new Vercel project** (for web apps only)
2. Set **Root Directory**: `apps/[app-name]`
3. Set **Build Command**: `cd ../.. && pnpm turbo run build --filter=[package-name]`
4. Set **Install Command**: `pnpm install`

React Native apps won't deploy to Vercel, but will benefit from the pnpm setup locally and in other CI/CD pipelines.

---

## 🎉 Next Steps

1. ✅ Update admin-web Vercel settings
2. ✅ Update student-web Vercel settings
3. ✅ Push `pnpm-lock.yaml` to trigger new deploy
4. ✅ Verify builds succeed in Vercel dashboard
5. ✅ (Optional) Set up Turborepo remote caching for faster builds

---

## 📞 Need Help?

If builds are failing:
1. Check Vercel build logs for specific error
2. Compare with successful local build: `pnpm turbo run build`
3. Verify all settings match this guide exactly




