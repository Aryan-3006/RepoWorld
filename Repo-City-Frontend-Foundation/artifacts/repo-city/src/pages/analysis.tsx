import { ArrowLeft } from 'lucide-react';
import { useEffect, useState, useMemo } from 'react';
import { Link, useLocation } from 'wouter';
import { AnalysisProgress } from '@/components/analysis-progress';
import { Brand } from '@/components/brand';
import { submitRepositoryAnalysis, getBackendRepository } from '@/services/apiClient';
import { backendToPlanetData } from '@/services/repositoryAdapter';
import type { AnalysisStage } from '@/types/repository';

const initialStages: AnalysisStage[] = [
  { id: 'discover', label: 'Repository discovered', detail: 'Reading branch, metadata, and repository shape.', status: 'active' },
  { id: 'continents', label: 'Mapping continents', detail: 'Grouping packages and application boundaries.', status: 'pending' },
  { id: 'files', label: 'Analyzing files', detail: 'Measuring language, size, and test coverage.', status: 'pending' },
  { id: 'history', label: 'Reading Git history', detail: 'Locating change density and ownership patterns.', status: 'pending' },
  { id: 'dependencies', label: 'Mapping dependencies', detail: 'Building edges between modules and services.', status: 'pending' },
  { id: 'hotspots', label: 'Detecting hotspots', detail: 'Highlighting risk and high-traffic boundaries.', status: 'pending' },
  { id: 'construction', label: 'Constructing world', detail: 'Preparing the navigable repository view.', status: 'pending' },
];

export default function Analysis() {
  const [, setLocation] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const url = params.get('repo') || 'https://github.com/northstar-labs/platform';
  const [stages, setStages] = useState(initialStages);
  const [failed, setFailed] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const activeStage = useMemo(() => stages[activeIndex], [activeIndex, stages]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const analyzeRes = await submitRepositoryAnalysis(url);
        const repoId = analyzeRes.repository_id;

        for (let index = 0; index < initialStages.length; index += 1) {
          if (cancelled) return;
          await new Promise((resolve) => setTimeout(resolve, index === 0 ? 450 : 380));
          setActiveIndex(index);
          setStages((current) => current.map((stage, stageIndex) => ({ ...stage, status: stageIndex < index ? 'complete' : stageIndex === index ? 'active' : 'pending' })));
        }

        const backendData = await getBackendRepository(repoId);
        const planetData = backendToPlanetData(backendData);
        sessionStorage.setItem('repo-city-planet-data', JSON.stringify(planetData));
        sessionStorage.setItem('repo-city-id', repoId);

        if (!cancelled) {
          setStages((current) => current.map((stage) => ({ ...stage, status: 'complete' })));
          setTimeout(() => setLocation(`/world/${repoId}`), 500);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Analysis failed:', err);
          setFailed(true);
        }
      }
    };
    run();
    return () => { cancelled = true; };
  }, [setLocation, url]);

  return (
    <main className="noise min-h-[100dvh] bg-background">
      <header className="mx-auto flex max-w-[1280px] items-center justify-between px-6 py-6 lg:px-10"><Brand /><Link href="/" data-testid="link-cancel-analysis" className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" /> Cancel</Link></header>
      <div className="mx-auto grid max-w-[980px] gap-16 px-6 pb-16 pt-16 lg:grid-cols-[.72fr_1.28fr] lg:pt-24">
        <section className="entrance"><p className="mono text-[10px] tracking-[.2em] text-primary">ANALYSIS / 01</p><h1 className="mt-5 text-4xl font-semibold tracking-[-.045em] text-foreground sm:text-5xl">Building<br />your world</h1><p className="mt-6 max-w-xs text-sm leading-6 text-muted-foreground">A quiet pass over the repository. We are finding the landmarks before you step inside.</p><div className="mt-12 border-t border-border pt-4"><p className="mono truncate text-[10px] text-muted-foreground">{url}</p><p className="mt-2 mono text-[10px] text-primary">{activeStage?.label ?? 'Preparing'} <span className="text-muted-foreground">/ {Math.min(100, Math.round(((activeIndex + 1) / initialStages.length) * 100))}%</span></p></div></section>
        <section className="entrance-delay border-t border-border pt-1"><AnalysisProgress stages={stages} />{failed && <div className="mt-8 border border-destructive/50 bg-destructive/5 p-4"><p className="text-sm text-destructive">We could not map this repository.</p><button type="button" data-testid="button-retry-analysis" onClick={() => window.location.reload()} className="mt-3 text-xs text-foreground underline underline-offset-4">Try again</button></div>}</section>
      </div>
    </main>
  );
}