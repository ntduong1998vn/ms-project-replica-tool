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

Production deployment requires `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, and a production `BETTER_AUTH_SECRET` configured outside the repository.
