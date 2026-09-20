export type RiskLevel = 'low' | 'medium' | 'high';
export type FileLanguage = 'TypeScript' | 'TSX' | 'CSS' | 'JSON' | 'Markdown' | 'SQL' | 'YAML' | 'Shell';

export interface RepoFile {
  id: string;
  name: string;
  path: string;
  language: FileLanguage;
  lines: number;
  size: number;
  changes: number;
  risk: RiskLevel;
  isTest: boolean;
  imports: string[];
  summary: string;
  lastModified: string;
  exports: string[];
}

export interface RepoFolder {
  id: string;
  path: string;
  name: string;
  files: RepoFile[];
  fileCount: number;
  loc: number;
  kind: 'source' | 'test' | 'config' | 'docs';
}

export interface RepositoryStats {
  files: number;
  folders: number;
  loc: number;
  languages: Record<string, number>;
  contributors: number;
  commits: number;
  hotspots: number;
}

export interface Repository {
  id: string;
  owner: string;
  name: string;
  url: string;
  branch: string;
  description: string;
  stats: RepositoryStats;
  files: RepoFile[];
  folders: RepoFolder[];
  analyzedAt: string;
}

export interface AiQueryResult {
  answer: string;
  references: string[];
  confidence: 'high' | 'medium';
}

export interface AiExplanation {
  fileId: string;
  title: string;
  summary: string;
  sections: { heading: string; body: string }[];
  references: string[];
}

export interface SearchResult {
  file: RepoFile;
  match: string;
  kind: 'file' | 'folder' | 'concept';
}

export type AnalysisStageStatus = 'pending' | 'active' | 'complete';
export interface AnalysisStage {
  id: string;
  label: string;
  detail: string;
  status: AnalysisStageStatus;
}
export interface AnalysisState {
  repositoryUrl: string;
  repositoryId?: string;
  progress: number;
  stages: AnalysisStage[];
  status: 'running' | 'complete' | 'error';
}