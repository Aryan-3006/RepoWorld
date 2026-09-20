# Repo City

Repo City turns a GitHub repository into a navigable map of its architecture.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/repo-city run dev` — run the Repo City frontend
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/repo-city/src/pages/` — landing, analysis, and world screens
- `artifacts/repo-city/src/components/three/WorldViewport.tsx` — boundary reserved for the future Three.js engine
- `artifacts/repo-city/src/data/mockRepository.ts` — fictional repository data used by Phase 0
- `artifacts/repo-city/src/services/api.ts` — mock service abstraction for analysis, search questions, and explanations
- `artifacts/repo-city/src/types/repository.ts` — shared repository and analysis contracts
- `artifacts/repo-city/src/index.css` — dark mapping-instrument theme tokens and shared motion

## Architecture decisions

- Phase 0 keeps the world renderer behind `WorldViewport` so a later Three.js engine can replace the placeholder without changing the surrounding UI.
- Repository analysis, Ask the City, and file explanations are mock service calls to preserve the future API seam without adding backend work yet.
- The world shell uses a restrained charcoal/amber visual language so future 3D content remains the focal point.

## Product

The current frontend accepts a GitHub URL, simulates repository analysis, and opens a world shell with local search, Ask the City, file inspection, mock explanations, and visualization controls.

## User preferences

Phase 0 must stay frontend-only: no real GitHub analysis, authentication, database, backend, or Three.js world.

## Gotchas

The frontend workflow provides `PORT` and `BASE_PATH`; run the artifact through its managed workflow rather than starting Vite from the workspace root.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
