export type FileLanguage =
  | 'TypeScript'
  | 'TSX'
  | 'CSS'
  | 'JSON'
  | 'Markdown'
  | 'SQL'
  | 'YAML'
  | 'Shell'
  | 'Python'
  | 'Go'
  | 'Rust';

export interface CodeElement {
  id: string;
  type: 'class' | 'function' | 'interface' | 'variable';
  name: string;
  lineStart: number;
  lineEnd: number;
}

/** A source file — rendered as a FLOOR inside a building */
export interface FileData {
  id: string;
  name: string;
  path: string;
  language: FileLanguage;
  lines: number;
  size: number;
  changes: number;
  lastModified: string;
  risk: 'low' | 'medium' | 'high';
  isTest: boolean;
  imports: string[];
  importedBy: string[];
  contributors: number;
  testStatus: 'tested' | 'partial' | 'not detected';
  elements?: CodeElement[];
}

/** A subfolder — rendered as a BUILDING containing files (floors) */
export interface BuildingData {
  id: string;
  name: string;
  path: string;
  files: FileData[];
}

/** A higher-level module — rendered as a DISTRICT containing buildings */
export interface DistrictData {
  id: string;
  name: string;
  path: string;
  buildings: BuildingData[];
}

/** A top-level code domain (backend, frontend, …) — rendered as a CITY */
export interface CityData {
  id: string;
  name: string;
  path: string;
  type:
    | 'frontend'
    | 'backend'
    | 'database'
    | 'auth'
    | 'tests'
    | 'docs'
    | 'infra'
    | 'core'
    | 'shared';
  districts: DistrictData[];
}

export interface CountryStats {
  files: number;
  folders: number;
  loc: number;
  contributors: number;
  commits: number;
  stars: number;
  forks: number;
}

/** A GitHub repository — rendered as a COUNTRY */
export interface CountryData {
  repositoryId: string;
  name: string;
  owner: string;
  description: string;
  language: FileLanguage;
  lat: number;
  lng: number;
  stats: CountryStats;
  cities: CityData[];
}

export interface PlanetData {
  countries: CountryData[];
}
