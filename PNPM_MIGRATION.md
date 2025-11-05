# pnpm Migration Guide

## ✅ What's Been Done

All configuration files have been updated to use pnpm instead of npm:
- ✅ `.npmrc` - pnpm configuration for monorepo
- ✅ `pnpm-workspace.yaml` - workspace configuration
- ✅ `package.json` - updated packageManager and scripts
- ✅ All GitHub Actions workflows - updated to use pnpm
- ✅ App-specific scripts in `apps/*/package.json`
- ✅ Workspace dependencies updated to use `workspace:*` protocol
- ✅ All dependencies installed with pnpm
- ✅ `pnpm-lock.yaml` generated

## 🚀 Migration Steps

### ✅ MIGRATION COMPLETE!

The migration has been completed automatically. Here's what was done:

1. ✅ pnpm 9.15.0 was already installed on your system
2. ✅ Removed all npm artifacts (node_modules, package-lock.json)
3. ✅ Updated workspace dependencies to use `workspace:*` protocol
4. ✅ Installed all dependencies with pnpm
5. ✅ Generated `pnpm-lock.yaml`
6. ✅ Verified packages build successfully

### Next: Verify everything works

```bash
# Test dev servers
pnpm dev

# Test builds
pnpm build

# Test other commands
pnpm typecheck
pnpm lint
```

## 📝 Command Changes

| Old (npm) | New (pnpm) |
|-----------|------------|
| `npm install` | `pnpm install` |
| `npm run dev` | `pnpm dev` |
| `npm run build` | `pnpm build` |
| `npm -w @altitutor/shared run build` | `pnpm --filter @altitutor/shared run build` |
| `npx turbo run build` | `pnpm turbo run build` |

## 🔧 Vercel Configuration

### For admin-web:
1. Go to Vercel project settings → https://vercel.com/[your-team]/admin-web/settings
2. Navigate to "General" → "Build & Development Settings"
3. Update settings:
   - **Framework Preset**: Next.js
   - **Root Directory**: `apps/admin-web`
   - **Build Command**: `cd ../.. && pnpm turbo run build --filter=altitutor-admin-app`
   - **Install Command**: `pnpm install`
   - **Output Directory**: `.next` (default)

### For student-web:
1. Go to Vercel project settings → https://vercel.com/[your-team]/student-web/settings
2. Navigate to "General" → "Build & Development Settings"
3. Update settings:
   - **Framework Preset**: Next.js
   - **Root Directory**: `apps/student-web`
   - **Build Command**: `cd ../.. && pnpm turbo run build --filter=student-web`
   - **Install Command**: `pnpm install`
   - **Output Directory**: `.next` (default)

### Enable Caching on Vercel (Optional but Recommended)
In each project's settings:
1. Go to "Environment Variables"
2. Add: `ENABLE_TURBO_CACHE=1`

## 🎯 Key Benefits You'll See

1. **Faster Installs**: 30-50% faster than npm
2. **Less Disk Space**: Packages stored once globally
3. **Strict Dependencies**: No phantom dependencies
4. **Better Monorepo**: Perfect for React Native apps you'll add later

## 🐛 Troubleshooting

### Issue: "No packages matched filter"
```bash
# Make sure you're in the monorepo root
cd /Users/matthewchua/Documents/Github/altitutor-monorepo
pnpm install
```

### Issue: "command not found: pnpm"
```bash
# Install pnpm globally
npm install -g pnpm@9
```

### Issue: Build fails in CI/CD
- Make sure `pnpm-lock.yaml` is committed to git
- Verify GitHub Actions use `pnpm/action-setup@v4`

### Issue: Vercel build fails
- Ensure Install Command is set to `pnpm install`
- Ensure you're using the full build command from above
- Check that `pnpm-lock.yaml` is in your repo

## 📦 Git Changes

Don't forget to commit the new files:
```bash
git add .npmrc pnpm-workspace.yaml pnpm-lock.yaml
git add package.json apps/*/package.json
git add .github/workflows/*.yml
git rm package-lock.json
git commit -m "chore: migrate from npm to pnpm"
```

## 🔄 Future: Adding React Native Apps

When you add React Native apps, they'll automatically benefit from pnpm's:
- Shared dependency storage
- Fast install times
- Proper hoisting for React Native compatibility

The `.npmrc` is already configured with `node-linker=hoisted` for React Native support!

