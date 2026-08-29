# MS Project Replica

SvelteKit + Cloudflare Workers project-planning workspace.

## Local development

```sh
cp .dev.vars.example .dev.vars
npm install
npm run db:migrate:local
npm run dev
```

The local D1 database is exposed through the `DB` binding in `wrangler.jsonc`.

## Verification

```sh
npm run check
npm run test -- --run
npm run build
npx wrangler deploy --dry-run
```

Date utility coverage can be checked with:

```sh
npx vitest run src/lib/utils/date.test.ts --coverage --coverage.include=src/lib/utils/date.ts
```

Production deployment requires these GitHub Actions secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `BETTER_AUTH_SECRET`

The deploy workflow passes `BETTER_AUTH_SECRET` through a temporary secrets file so the first Worker deployment can create the required secret. The file is created only on the runner and is removed after deployment.
