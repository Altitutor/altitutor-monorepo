## Monorepo Guide

### Structure
- apps/
  - admin-web/ (Next.js App Router)
- packages/
  - shared/ (shared utils/hooks/constants)
  - ui/ (shared UI components)
- supabase/ (migrations, functions)

### Install & Develop
```bash
npm install
npm run dev
```
- Runs package builders in watch mode and the Next.js dev server.

### Per-app commands
- From repo root:
  - Build all: `npm run build`
  - Test all: `npm run test`
- From `apps/admin-web/`:
  - Dev: `npm run dev`
  - Build: `npm run build`

### Shared packages
- `packages/shared` and `packages/ui` are TypeScript packages built to `dist/`.
- They are consumed by apps via workspace deps and Next's `transpilePackages`.

### Tailwind & Next config
- `apps/admin-web/tailwind.config.js` includes `../../packages/*/src/**` in `content`.
- `apps/admin-web/next.config.js` sets `transpilePackages: ["@altitutor/shared", "@altitutor/ui"]`.

### TypeScript
- Root `tsconfig.json` defines base settings and path aliases for packages.
- Each package has its own `tsconfig.json` with `composite` and `declaration` output.

### Supabase
- Keep `supabase/` at repo root.
- Examples:
```bash
supabase db push
supabase functions deploy set-user-role
```

### Deploying multiple apps
- Vercel: one project per app; Root Directory = `apps/<app>`; env vars per project.
- Netlify/CF Pages: set Base directory to `apps/<app>`; install at repo root.
- Docker: one `Dockerfile` per app in `apps/<app>`; build with repo root context.

### Adding a new app
1. Create `apps/<new-app>` with its own `package.json` and configs.
2. Add local deps on `@altitutor/shared` / `@altitutor/ui` as needed.
3. Include `packages/*/src` in Tailwind content; set `transpilePackages` in Next config.

### Environment variables
- Each app uses its own `.env.local` (and deploy-time envs per hosting project).
- Shared secrets should not live in packages.

### Common scripts
- Switch env for admin-web:
```bash
npm --workspace apps/admin-web run switch:local
npm --workspace apps/admin-web run switch:remote
```

