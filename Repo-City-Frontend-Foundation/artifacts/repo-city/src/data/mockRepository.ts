import type { RepoFile, Repository, RepoFolder } from '@/types/repository';

const definitions: Array<[string, string, number, number, number, 'low' | 'medium' | 'high', boolean, string[]]> = [
  ['apps/web/src/app.tsx','TSX',186,6420,23,'high',true,['react','./routes','./providers']],
  ['apps/web/src/main.tsx','TSX',34,980,4,'low',false,['react','./app']],
  ['apps/web/src/routes/index.tsx','TSX',142,4980,18,'medium',true,['react-router','./dashboard','./settings']],
  ['apps/web/src/routes/dashboard.tsx','TSX',264,8940,31,'high',true,['./components/overview','@repo/api','./hooks/use-metrics']],
  ['apps/web/src/routes/repository.tsx','TSX',218,7340,16,'high',true,['./components/file-tree','@repo/core','./hooks/use-repository']],
  ['apps/web/src/routes/settings.tsx','TSX',171,5810,9,'medium',true,['react-hook-form','./components/form-field']],
  ['apps/web/src/components/file-tree.tsx','TSX',229,7610,38,'high',true,['react','cmdk','./tree-row']],
  ['apps/web/src/components/command-menu.tsx','TSX',156,5220,27,'medium',false,['cmdk','./file-icon','@repo/search']],
  ['apps/web/src/components/overview.tsx','TSX',198,6590,14,'medium',true,['recharts','./metric-card']],
  ['apps/web/src/components/metric-card.tsx','TSX',72,2140,5,'low',true,['react']],
  ['apps/web/src/components/top-nav.tsx','TSX',118,3680,21,'medium',true,['next/link','./user-menu']],
  ['apps/web/src/components/user-menu.tsx','TSX',91,2890,6,'low',false,['@radix-ui/react-dropdown-menu']],
  ['apps/web/src/components/empty-state.tsx','TSX',66,2050,2,'low',false,['react']],
  ['apps/web/src/components/error-boundary.tsx','TSX',89,2770,7,'medium',true,['react']],
  ['apps/web/src/hooks/use-repository.ts','TypeScript',104,3280,12,'high',true,['@tanstack/react-query','@repo/api']],
  ['apps/web/src/hooks/use-search.ts','TypeScript',86,2740,19,'medium',true,['use-debounce','@repo/search']],
  ['apps/web/src/hooks/use-hotspots.ts','TypeScript',64,2010,8,'medium',true,['@repo/api']],
  ['apps/web/src/lib/format.ts','TypeScript',48,1430,3,'low',true,[]],
  ['apps/web/src/lib/permissions.ts','TypeScript',132,4310,11,'high',true,['@repo/auth']],
  ['apps/web/src/styles/globals.css','CSS',302,9010,16,'medium',false,[]],
  ['apps/web/tests/file-tree.test.tsx','TSX',138,4260,22,'medium',true,['vitest','@testing-library/react']],
  ['apps/web/tests/dashboard.test.tsx','TSX',112,3440,8,'low',true,['vitest','@testing-library/react']],
  ['apps/api/src/server.ts','TypeScript',154,4810,17,'high',true,['fastify','./routes','./plugins']],
  ['apps/api/src/app.ts','TypeScript',108,3360,9,'medium',true,['fastify','./server']],
  ['apps/api/src/routes/repositories.ts','TypeScript',242,7760,29,'high',true,['fastify','zod','@repo/db']],
  ['apps/api/src/routes/search.ts','TypeScript',186,5920,25,'high',true,['fastify','@repo/search','zod']],
  ['apps/api/src/routes/health.ts','TypeScript',38,1180,2,'low',true,['fastify']],
  ['apps/api/src/middleware/auth.ts','TypeScript',129,4030,13,'high',true,['jose','@repo/db']],
  ['apps/api/src/middleware/rate-limit.ts','TypeScript',92,2860,6,'medium',true,['fastify-rate-limit']],
  ['apps/api/src/services/repository-service.ts','TypeScript',287,9240,34,'high',true,['@repo/db','@repo/github','./cache-service']],
  ['apps/api/src/services/search-service.ts','TypeScript',218,7030,20,'high',true,['meilisearch','@repo/db']],
  ['apps/api/src/services/cache-service.ts','TypeScript',124,3950,7,'medium',true,['ioredis']],
  ['apps/api/src/services/webhook-service.ts','TypeScript',148,4520,10,'medium',true,['@octokit/webhooks','@repo/db']],
  ['apps/api/src/schemas/repository.ts','TypeScript',96,2960,5,'low',true,['zod']],
  ['apps/api/src/schemas/user.ts','TypeScript',78,2410,4,'low',true,['zod']],
  ['apps/api/src/workers/indexer.ts','TypeScript',231,7380,18,'high',true,['bullmq','@repo/search','@repo/db']],
  ['apps/api/src/workers/snapshot.ts','TypeScript',177,5580,11,'medium',true,['bullmq','@repo/db']],
  ['apps/api/tests/repositories.test.ts','TypeScript',202,6250,15,'medium',true,['vitest','supertest']],
  ['apps/api/tests/search.test.ts','TypeScript',164,5080,9,'medium',true,['vitest','supertest']],
  ['packages/core/src/index.ts','TypeScript',68,2090,6,'low',true,['./repository','./graph']],
  ['packages/core/src/repository.ts','TypeScript',192,6040,16,'high',true,['./file','./folder']],
  ['packages/core/src/file.ts','TypeScript',113,3470,8,'medium',true,[]],
  ['packages/core/src/folder.ts','TypeScript',97,3010,5,'low',true,['./file']],
  ['packages/core/src/graph.ts','TypeScript',264,8410,24,'high',true,['graphology','./repository']],
  ['packages/core/src/hotspots.ts','TypeScript',178,5640,13,'high',true,['./graph','date-fns']],
  ['packages/core/src/serialize.ts','TypeScript',121,3770,7,'medium',true,['superjson']],
  ['packages/core/tests/graph.test.ts','TypeScript',184,5710,12,'medium',true,['vitest','../src/graph']],
  ['packages/db/src/client.ts','TypeScript',44,1360,3,'low',true,['drizzle-orm','postgres']],
  ['packages/db/src/schema.ts','TypeScript',338,10620,31,'high',true,['drizzle-orm']],
  ['packages/db/src/repositories.ts','TypeScript',214,6640,18,'high',true,['./client','./schema']],
  ['packages/db/src/migrations.ts','TypeScript',98,2940,4,'medium',false,['./client']],
  ['packages/db/tests/repositories.test.ts','TypeScript',176,5360,14,'medium',true,['vitest','../src/repositories']],
  ['packages/config/eslint/base.js','Shell',64,1890,5,'low',false,['eslint']],
  ['packages/config/tsconfig/base.json','JSON',31,820,2,'low',false,[]],
  ['packages/config/vitest/base.ts','TypeScript',52,1530,3,'low',false,['vitest']],
  ['docs/architecture.md','Markdown',188,6430,11,'medium',false,[]],
  ['docs/contributing.md','Markdown',112,3510,5,'low',false,[]],
  ['docs/decisions/001-search-index.md','Markdown',89,2860,3,'low',false,[]],
  ['infra/docker-compose.yml','YAML',87,2590,8,'medium',false,['postgres','redis']],
  ['infra/kubernetes/api-deployment.yml','YAML',142,4310,12,'high',false,['api']],
  ['infra/kubernetes/worker-deployment.yml','YAML',128,3940,9,'medium',false,['worker']],
  ['scripts/seed.ts','TypeScript',109,3280,6,'medium',true,['@repo/db']],
  ['scripts/check-dependencies.ts','TypeScript',83,2510,4,'low',true,['npm-package-arg']],
  ['package.json','JSON',76,2180,13,'medium',false,[]],
  ['pnpm-workspace.yaml','YAML',24,610,1,'low',false,[]],
  ['README.md','Markdown',146,4460,9,'low',false,[]],
];

export const mockFiles: RepoFile[] = definitions.map(([path, language, lines, size, changes, risk, isTest, imports], index) => {
  const name = path.split('/').pop() ?? path;
  return {
    id: `file-${index + 1}`,
    path, name, language: language as RepoFile['language'], lines, size, changes, risk, isTest, imports,
    exports: index % 3 === 0 ? ['default'] : [`${name.replace(/\W/g, '')}Service`],
    summary: path.includes('search') ? 'Search indexing and query orchestration.' : path.includes('repository') ? 'Repository discovery and graph access layer.' : `Core ${name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')} implementation.`,
    lastModified: `${(index % 9) + 1}d ago`,
  };
});

const folderNames = ['apps/web','apps/api','packages/core','packages/db','packages/config','docs','infra','scripts'];
export const mockFolders: RepoFolder[] = folderNames.map((path, index) => {
  const files = mockFiles.filter((file) => file.path.startsWith(`${path}/`));
  return { id: `folder-${index + 1}`, path, name: path.split('/').pop() ?? path, files, fileCount: files.length, loc: files.reduce((sum, file) => sum + file.lines, 0), kind: index > 5 ? 'docs' : index === 4 ? 'config' : 'source' };
});

export const mockRepository: Repository = {
  id: 'repo-city-platform',
  owner: 'northstar-labs',
  name: 'platform',
  url: 'https://github.com/northstar-labs/platform',
  branch: 'main',
  description: 'The internal platform for turning repository structure into navigable maps.',
  stats: {
    files: mockFiles.length, folders: mockFolders.length, loc: mockFiles.reduce((sum, file) => sum + file.lines, 0),
    languages: { TypeScript: 68, TSX: 16, Markdown: 8, YAML: 5, JSON: 3 },
    contributors: 14, commits: 1248, hotspots: mockFiles.filter((file) => file.risk === 'high').length,
  },
  files: mockFiles, folders: mockFolders, analyzedAt: '2025-02-14T10:42:00Z',
};