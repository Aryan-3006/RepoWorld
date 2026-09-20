import type { Repository } from '@/types/repository';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include', // Important for session cookies
  });

  if (!response.ok) {
    let errorDetail = 'Unknown error';
    try {
      const errorData = await response.json();
      errorDetail = errorData.detail || errorData.message || response.statusText;
    } catch {
      errorDetail = response.statusText;
    }
    throw new Error(`API Error (${response.status}): ${errorDetail}`);
  }

  return response.json();
}

// -----------------------------------------------------------------------------
// Auth Endpoints
// -----------------------------------------------------------------------------

export interface AuthStatusResponse {
  authenticated: boolean;
  github_user: {
    id: number;
    login: string;
    avatar_url: string;
  } | null;
}

export async function checkAuthStatus(): Promise<AuthStatusResponse> {
  return fetchApi<AuthStatusResponse>('/api/auth/status');
}

export function getGitHubLoginUrl(): string {
  return `${API_BASE_URL}/api/auth/github`;
}

export async function logoutUser(): Promise<{ status: string }> {
  return fetchApi<{ status: string }>('/api/auth/logout', { method: 'POST' });
}

// -----------------------------------------------------------------------------
// Analysis Endpoints
// -----------------------------------------------------------------------------

export interface AnalyzeResponse {
  repository_id: string;
  status: string;
}

export async function submitRepositoryAnalysis(repoUrl: string): Promise<AnalyzeResponse> {
  return fetchApi<AnalyzeResponse>('/api/analyze', {
    method: 'POST',
    body: JSON.stringify({ repo_url: repoUrl }),
  });
}

// We will map the backend's flat RepositoryResponse into our PlanetData later via adapter.
// For now, we return `any` to let the adapter handle the exact structure.
export async function getBackendRepository(repositoryId: string): Promise<any> {
  return fetchApi<any>(`/api/repository/${repositoryId}`);
}

// -----------------------------------------------------------------------------
// Intelligence Endpoints
// -----------------------------------------------------------------------------

export interface AskResponse {
  answer: string;
  targets: Array<{
    file_id: string;
    path: string;
    reason: string;
  }>;
}

export async function askCityAI(repositoryId: string, question: string): Promise<AskResponse> {
  return fetchApi<AskResponse>('/api/ask', {
    method: 'POST',
    body: JSON.stringify({ repository_id: repositoryId, question }),
  });
}

export interface ExplainResponse {
  file_id: string;
  summary: string;
  keyComponents: string[];
  potentialIssues: string[];
}

export async function explainFileAI(repositoryId: string, fileId: string): Promise<ExplainResponse> {
  return fetchApi<ExplainResponse>('/api/explain', {
    method: 'POST',
    body: JSON.stringify({ repository_id: repositoryId, file_id: fileId }),
  });
}
