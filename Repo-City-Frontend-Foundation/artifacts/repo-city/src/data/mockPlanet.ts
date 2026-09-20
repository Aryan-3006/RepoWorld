import type {
  PlanetData,
  CountryData,
  CityData,
  DistrictData,
  BuildingData,
  FileData,
  FileLanguage,
} from '../types/planet';

// ─────────────────────────────────────────────────────────────────────────────
// Deterministic hand-crafted mock data
// Each repo = a country
// Each city = a top-level domain
// Each district = a module/subdomain
// Each building = a FOLDER
// Each file = a FLOOR inside the building
// ─────────────────────────────────────────────────────────────────────────────

import { SeededRandom } from '../components/three/engine/SeededRandom';

function file(
  id: string,
  name: string,
  path: string,
  language: FileLanguage,
  lines: number,
  activity: number,
  risk: 'low' | 'medium' | 'high',
  isTest = false,
): FileData {
  const rng = new SeededRandom(Array.from(id).reduce((acc, char) => acc + char.charCodeAt(0), 0));
  
  const changes = Math.floor(rng.range(5, 200) * activity);
  const contributors = Math.max(1, Math.floor(rng.range(1, 12) * activity));
  
  // Generate a recent date based on activity
  const daysAgo = Math.floor(rng.range(0, 30) * (1 - activity));
  const date = new Date(2026, 8, 18); // Base date: 2026-09-18
  date.setDate(date.getDate() - daysAgo);
  const lastModified = date.toISOString().split('T')[0];

  let testStatus: 'tested' | 'partial' | 'not detected' = 'not detected';
  if (isTest) testStatus = 'tested';
  else if (rng.range(0, 1) > 0.5) testStatus = rng.range(0, 1) > 0.5 ? 'tested' : 'partial';

  return {
    id,
    name,
    path,
    language,
    lines,
    size: lines * 32,
    changes,
    lastModified,
    risk,
    isTest,
    imports: [],
    importedBy: [],
    contributors,
    testStatus,
  };
}

function building(id: string, name: string, path: string, files: FileData[]): BuildingData {
  return { id, name, path, files };
}

function district(id: string, name: string, path: string, buildings: BuildingData[]): DistrictData {
  return { id, name, path, buildings };
}

function city(
  id: string,
  name: string,
  path: string,
  type: CityData['type'],
  districts: DistrictData[],
): CityData {
  return { id, name, path, type, districts };
}

// ─────────────────────────────────────────────────────────────────────────────
// SIGNAL-PLATFORM
// ─────────────────────────────────────────────────────────────────────────────

const signalBackend = city('sp-backend', 'Backend', 'src/backend', 'backend', [
  district('sp-be-auth', 'auth', 'src/backend/auth', [
    building('sp-auth-core', 'core', 'src/backend/auth/core', [
      file('sp-auth-svc',  'auth_service.py',  'src/backend/auth/core/auth_service.py',  'Python', 412, 0.9, 'high'),
      file('sp-auth-jwt',  'jwt.py',           'src/backend/auth/core/jwt.py',           'Python', 188, 0.7, 'medium'),
    ]),
    building('sp-auth-utils', 'utils', 'src/backend/auth/utils', [
      file('sp-auth-perm', 'permissions.py',   'src/backend/auth/utils/permissions.py',  'Python', 241, 0.5, 'medium'),
      file('sp-auth-sess', 'session.py',       'src/backend/auth/utils/session.py',      'Python', 163, 0.6, 'low'),
    ])
  ]),
  district('sp-be-api', 'api', 'src/backend/api', [
    building('sp-api-v1', 'v1', 'src/backend/api/v1', [
      file('sp-api-routes','routes.py',        'src/backend/api/v1/routes.py',           'Python', 538, 0.85,'high'),
      file('sp-api-users', 'users.py',         'src/backend/api/v1/users.py',            'Python', 291, 0.6, 'medium'),
      file('sp-api-msgs',  'messages.py',      'src/backend/api/v1/messages.py',         'Python', 344, 0.75,'medium'),
      file('sp-api-ws',    'websocket.py',     'src/backend/api/v1/websocket.py',        'Python', 217, 0.8, 'high'),
    ])
  ]),
]);

const signalFrontend = city('sp-frontend', 'Frontend', 'src/frontend', 'frontend', [
  district('sp-fe-ui', 'ui', 'src/frontend/ui', [
    building('sp-ui-views', 'views', 'src/frontend/ui/views', [
      file('sp-comp-dash',   'Dashboard.tsx',  'src/frontend/ui/views/Dashboard.tsx',  'TSX', 487, 0.9, 'medium'),
      file('sp-comp-login',  'Login.tsx',      'src/frontend/ui/views/Login.tsx',      'TSX', 214, 0.6, 'low'),
    ]),
    building('sp-ui-shared', 'shared', 'src/frontend/ui/shared', [
      file('sp-comp-thread', 'Thread.tsx',     'src/frontend/ui/shared/Thread.tsx',    'TSX', 331, 0.7, 'medium'),
      file('sp-comp-msg',    'Message.tsx',    'src/frontend/ui/shared/Message.tsx',   'TSX', 198, 0.65,'low'),
      file('sp-comp-nav',    'Navigation.tsx', 'src/frontend/ui/shared/Navigation.tsx','TSX', 156, 0.4, 'low'),
    ])
  ]),
]);

const signalPlatform: CountryData = {
  repositoryId: 'signal-platform',
  name: 'signal-platform',
  owner: 'comm-net',
  description: 'Real-time messaging platform',
  language: 'Python',
  lat: 50,
  lng: 10,
  stats: { files: 13, folders: 5, loc: 3762, contributors: 18, commits: 2140, stars: 3400, forks: 612 },
  cities: [signalBackend, signalFrontend],
};

// ─────────────────────────────────────────────────────────────────────────────
// ORBIT-ENGINE
// ─────────────────────────────────────────────────────────────────────────────

const orbitCore = city('oe-core', 'Core Engine', 'src/core', 'core', [
  district('oe-core-renderer', 'renderer', 'src/core/renderer', [
    building('oe-rend-gl', 'opengl', 'src/core/renderer/opengl', [
      file('oe-rend-main',  'renderer.rs',      'src/core/renderer/opengl/renderer.rs',  'Rust', 912, 0.9, 'high'),
      file('oe-rend-shader','shader.rs',        'src/core/renderer/opengl/shader.rs',    'Rust', 541, 0.8, 'high'),
    ]),
    building('oe-rend-vk', 'vulkan', 'src/core/renderer/vulkan', [
      file('oe-rend-tex',   'texture.rs',       'src/core/renderer/vulkan/texture.rs',   'Rust', 388, 0.6, 'medium'),
      file('oe-rend-mesh',  'mesh.rs',          'src/core/renderer/vulkan/mesh.rs',      'Rust', 471, 0.75,'medium'),
    ])
  ]),
]);

const orbitEngine: CountryData = {
  repositoryId: 'orbit-engine',
  name: 'orbit-engine',
  owner: 'space-org',
  description: '3D game engine written in Rust',
  language: 'Rust',
  lat: 56,
  lng: -100,
  stats: { files: 4, folders: 2, loc: 2312, contributors: 7, commits: 980, stars: 8200, forks: 410 },
  cities: [orbitCore],
};

// ─────────────────────────────────────────────────────────────────────────────
// ATLAS-API
// ─────────────────────────────────────────────────────────────────────────────

const atlasHandlers = city('aa-handlers', 'Handlers', 'internal/handlers', 'backend', [
  district('aa-hand-geo', 'geo', 'internal/handlers/geo', [
    building('aa-geo-core', 'core', 'internal/handlers/geo/core', [
      file('aa-geo-search',  'search.go',       'internal/handlers/geo/core/search.go',  'Go', 334, 0.8, 'medium'),
      file('aa-geo-places',  'places.go',       'internal/handlers/geo/core/places.go',  'Go', 281, 0.7, 'medium'),
    ]),
    building('aa-geo-util', 'util', 'internal/handlers/geo/util', [
      file('aa-geo-routes',  'routes.go',       'internal/handlers/geo/util/routes.go',  'Go', 198, 0.6, 'low'),
    ])
  ]),
]);

const atlasApi: CountryData = {
  repositoryId: 'atlas-api',
  name: 'atlas-api',
  owner: 'map-corp',
  description: 'Geospatial mapping API',
  language: 'Go',
  lat: -28,
  lng: 135,
  stats: { files: 3, folders: 2, loc: 813, contributors: 12, commits: 1560, stars: 1900, forks: 240 },
  cities: [atlasHandlers],
};

// ─────────────────────────────────────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────────────────────────────────────

export const mockPlanet: PlanetData = {
  countries: [signalPlatform, orbitEngine, atlasApi],
};

export function allFiles(): FileData[] {
  return mockPlanet.countries.flatMap(c =>
    c.cities.flatMap(city =>
      city.districts.flatMap(d =>
        d.buildings.flatMap(b => b.files)
      )
    )
  );
}

export function findFile(id: string): FileData | undefined {
  return allFiles().find(f => f.id === id);
}

export function findBuilding(id: string): BuildingData | undefined {
  return mockPlanet.countries
    .flatMap(c => c.cities.flatMap(city => city.districts.flatMap(d => d.buildings)))
    .find(b => b.id === id);
}

export function findBuildingForFile(fileId: string): BuildingData | undefined {
  return mockPlanet.countries
    .flatMap(c => c.cities.flatMap(city => city.districts.flatMap(d => d.buildings)))
    .find(b => b.files.some(f => f.id === fileId));
}

// ─────────────────────────────────────────────────────────────────────────────
// Post-process Dependency Linkages
// ─────────────────────────────────────────────────────────────────────────────

// Add some deterministic dependencies for the dependency visualizer
const fMap = new Map<string, FileData>();
allFiles().forEach(f => fMap.set(f.id, f));

function link(fromId: string, toId: string) {
  const from = fMap.get(fromId);
  const to = fMap.get(toId);
  if (from && to) {
    if (!from.imports.includes(toId)) from.imports.push(toId);
    if (!to.importedBy.includes(fromId)) to.importedBy.push(fromId);
  }
}

// Signal Platform Dependencies
link('sp-api-routes', 'sp-auth-svc');
link('sp-api-routes', 'sp-api-users');
link('sp-api-routes', 'sp-api-msgs');
link('sp-api-routes', 'sp-auth-perm');
link('sp-auth-svc', 'sp-auth-jwt');
link('sp-auth-svc', 'sp-auth-sess');
link('sp-comp-dash', 'sp-api-routes');
link('sp-comp-login', 'sp-api-routes');
link('sp-comp-thread', 'sp-comp-msg');

// Orbit Engine Dependencies
link('oe-rend-main', 'oe-rend-shader');
link('oe-rend-main', 'oe-rend-vk'); // wait, oe-rend-vk is a building, we need file
link('oe-rend-main', 'oe-rend-mesh');
link('oe-rend-main', 'oe-rend-tex');
link('oe-rend-mesh', 'oe-rend-tex');

// Atlas API Dependencies
link('aa-geo-search', 'aa-geo-places');
link('aa-geo-search', 'aa-geo-routes');
link('aa-geo-places', 'aa-geo-routes');

export function findCountryForFile(id: string): CountryData | undefined {
  return mockPlanet.countries.find(c =>
    c.cities.some(city =>
      city.districts.some(d =>
        d.buildings.some(b => b.files.some(f => f.id === id))
      )
    )
  );
}
