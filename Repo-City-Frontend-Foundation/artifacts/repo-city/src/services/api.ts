import { mockRepository } from '@/data/mockRepository';
import type { AiExplanation, AiQueryResult, Repository } from '@/types/repository';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
let activeRepository = mockRepository;

export async function analyzeRepository(url: string): Promise<Repository> {
  await wait(350);
  const normalized = url.replace('https://github.com/', '').replace(/\/$/, '');
  const [owner = 'northstar-labs', name = 'platform'] = normalized.split('/');
  activeRepository = { ...mockRepository, id: `${owner}-${name}`, owner, name, url: `https://github.com/${owner}/${name}` };
  return activeRepository;
}

export async function getRepository(id: string): Promise<Repository> {
  await wait(180);
  return activeRepository.id === id ? activeRepository : mockRepository;
}

export async function askCity(question: string, _repositoryId: string): Promise<AiQueryResult> {
  await wait(500);
  const normalized = question.toLowerCase();
  if (normalized.includes('authentication') || normalized.includes('auth')) {
    return { answer: 'Authentication is handled in the signal-platform backend core.', references: ['src/backend/auth/core/auth_service.py', 'src/backend/auth/core/jwt.py'], confidence: 'high' };
  }
  if (normalized.includes('active') || normalized.includes('activity')) {
    return { answer: 'The most active file is routes.py in the Signal Platform API v1, with significant recent modifications.', references: ['src/backend/api/v1/routes.py'], confidence: 'high' };
  }
  if (normalized.includes('largest')) {
    return { answer: 'The largest files are the OpenGL renderer in Orbit Engine and the API routes in Signal Platform.', references: ['src/core/renderer/opengl/renderer.rs', 'src/backend/api/v1/routes.py'], confidence: 'medium' };
  }
  if (normalized.includes('test')) {
    return { answer: 'I found no dedicated test files in the primary mock data, but coverage status suggests partial test linkage for some services.', references: ['src/backend/auth/core/auth_service.py'], confidence: 'high' };
  }
  if (normalized.includes('dependencies') || normalized.includes('depend')) {
    return { answer: 'auth_service.py imports jwt.py and session.py. It is imported by the main API routes.', references: ['src/backend/auth/core/auth_service.py', 'src/backend/auth/core/jwt.py', 'src/backend/api/v1/routes.py'], confidence: 'high' };
  }
  if (normalized.includes('risk') || normalized.includes('hotspot')) {
    return { answer: 'High-risk hotspots include the auth service, API routes, and websocket handler in Signal Platform, plus the core OpenGL renderer in Orbit Engine.', references: ['src/backend/auth/core/auth_service.py', 'src/backend/api/v1/routes.py', 'src/backend/api/v1/websocket.py', 'src/core/renderer/opengl/renderer.rs'], confidence: 'high' };
  }
  return { answer: 'I found some matching files for your query.', references: ['src/backend/api/v1/routes.py'], confidence: 'medium' };
}

export async function explainFile(fileId: string, _repositoryId: string): Promise<AiExplanation> {
  await wait(450);
  const file = mockRepository.files.find((candidate) => candidate.id === fileId) ?? mockRepository.files[0];
  return {
    fileId: file.id, title: `How ${file.name} fits together`,
    summary: `${file.name} is a ${file.risk}-risk ${file.language} module with ${file.lines} lines. It coordinates a meaningful boundary in the repository and is covered by ${file.isTest ? 'nearby tests' : 'no dedicated tests'}.`,
    sections: [
      { heading: 'Role in the map', body: file.path.includes('service') ? 'This is a service boundary: it translates product intent into infrastructure calls and is a useful place to trace behavior.' : 'This module is part of the application spine. Follow its imports to see where data enters, changes shape, and leaves the system.' },
      { heading: 'What to inspect next', body: file.imports.length ? `Start with ${file.imports.slice(0, 2).join(' and ')}, then compare the tests with the most recent changes.` : 'Pair this file with its nearest consumer and the last commit that changed its public shape.' },
    ],
    references: file.imports.slice(0, 3),
  };
}