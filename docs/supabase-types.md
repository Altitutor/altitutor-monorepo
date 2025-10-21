### Supabase Database Types (Shared)

This monorepo centralizes Supabase-generated TypeScript types in a shared package so all apps can consume a single source of truth.

#### Where the types live
- File: `packages/shared/src/supabase/generated.ts`
- Re-exported from `@altitutor/shared` so apps can import ergonomically.

#### How to import in apps
- Prefer importing the `Database` (and helper mapped types) from the shared package:

```ts
import type { Database } from '@altitutor/shared';

// Example: create a typed client
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
const supabase = createClientComponentClient<Database>();
```

You can also import specific helpers if needed:

```ts
import type { Tables, TablesInsert, TablesUpdate, Enums } from '@altitutor/shared';
```

#### Local generation (developer workflow)
Generate types from your local Supabase (uses `supabase/config.toml`):

```bash
npm run db:types
```

Generate from a remote project (requires `SUPABASE_PROJECT_ID`):

```bash
SUPABASE_PROJECT_ID=your-project-ref npm run db:types:remote
```

Both scripts write to `packages/shared/src/supabase/generated.ts` and then build `@altitutor/shared` so consumers get updated types.

#### CI generation
Types are regenerated and committed by the deploy workflow after migrations are pushed. Excerpt:

```57:69:.github/workflows/supabase-deploy.yml
- name: Generate TypeScript types (shared package)
  run: |
    mkdir -p packages/shared/src/supabase
    supabase gen types typescript --project-id $SUPABASE_PROJECT_ID --schema public > packages/shared/src/supabase/generated.ts

- name: Commit updated types (if changed)
  run: |
    if [ -n "$(git status --porcelain packages/shared/src/supabase/generated.ts)" ]; then
      git config user.name "github-actions[bot]"
      git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
      git add packages/shared/src/supabase/generated.ts
      git commit -m "chore: update Supabase types [skip ci]"
      git push
    else
      echo "No type changes to commit"
    fi
```

This ensures the type file in the shared package always reflects the latest schema in the selected environment (develop → dev project, main → prod project).

#### Notes
- Keep the generated file committed to the repo so consumers do not need the CLI installed to build.
- If the schema changes, run the local generation script (for local development) or rely on the CI to update it on merge.


