import { useCallback, useMemo, useRef, useState, useEffect, type FormEvent } from 'react';
import { askCityAI, explainFileAI } from '@/services/apiClient';
import { WorldViewport, type WorldViewportHandle } from '@/components/three/WorldViewport';
import { Brand } from '@/components/brand';
import type { AiExplanation, AiQueryResult, RepoFile } from '@/types/repository';
import type { BuildingData, FileData, PlanetData } from '@/types/planet';
import { mockPlanet as fallbackMockPlanet } from '@/data/mockPlanet';
import type { WorldState } from '@/components/three/engine/types';
import {
  Activity,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  FileCode2,
  Folder,
  Gauge,
  GitBranch,
  Maximize2,
  RotateCcw,
  Search,
  Settings2,
  X,
  Zap,
} from 'lucide-react';
import { useLocation } from 'wouter';

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US').format(value);
}
function riskClass(risk: FileData['risk']) {
  if (risk === 'high') return 'bg-red-500/20 text-red-300 border-red-500/30';
  if (risk === 'medium') return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
  return 'bg-green-500/20 text-green-300 border-green-500/30';
}

function findFile(planetData: PlanetData, id: string): FileData | undefined {
  for (const c of planetData.countries) {
    for (const city of c.cities) {
      for (const d of city.districts) {
        for (const b of d.buildings) {
          const f = b.files.find(file => file.id === id);
          if (f) return f;
        }
      }
    }
  }
  return undefined;
}

function findBuilding(planetData: PlanetData, id: string): BuildingData | undefined {
  for (const c of planetData.countries) {
    for (const city of c.cities) {
      for (const d of city.districts) {
        const b = d.buildings.find(bld => bld.id === id);
        if (b) return b;
      }
    }
  }
  return undefined;
}

function findBuildingForFile(planetData: PlanetData, fileId: string): BuildingData | undefined {
  for (const c of planetData.countries) {
    for (const city of c.cities) {
      for (const d of city.districts) {
        const b = d.buildings.find(bld => bld.files.some(f => f.id === fileId));
        if (b) return b;
      }
    }
  }
  return undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// Breadcrumb — hierarchical navigation trail
// ─────────────────────────────────────────────────────────────────────────────

function Breadcrumb({
  planetData,
  worldState,
  onBack,
  onReset,
}: {
  planetData: PlanetData;
  worldState: WorldState;
  onBack:  () => void;
  onReset: () => void;
}) {
  const crumbs: { label: string; onClick?: () => void }[] = [
    { label: 'GLOBAL', onClick: onReset },
  ];

  if (worldState.activeRepositoryId) {
    // Repository crumb is not clickable
    crumbs.push({ label: worldState.activeRepositoryId.toUpperCase() });
  }
  if (worldState.activeCityId) {
    crumbs.push({
      label: worldState.activeCityId.replace(/-/g, ' ').toUpperCase(),
      onClick: onBack,
    });
  }
  if (worldState.activeDistrictId) {
    crumbs.push({
      label: worldState.activeDistrictId.replace(/-/g, ' ').toUpperCase(),
      onClick: onBack,
    });
  }
  if (worldState.activeBuildingId) {
    const b = findBuilding(planetData, worldState.activeBuildingId);
    crumbs.push({ label: (b?.name ?? worldState.activeBuildingId).replace(/-/g, ' ').toUpperCase(), onClick: onBack });
  }
  if (worldState.activeFileId) {
    const f = findFile(planetData, worldState.activeFileId);
    crumbs.push({ label: f?.name ?? worldState.activeFileId, onClick: onBack });
  }

  if (crumbs.length <= 1) return null;

  return (
    <div className="pointer-events-auto mt-2 flex items-center gap-1 flex-wrap">
      {crumbs.map((crumb, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="h-2.5 w-2.5 text-muted-foreground/60 flex-shrink-0" />}
          <button
            type="button"
            onClick={crumb.onClick}
            disabled={!crumb.onClick}
            className={`mono text-[9px] tracking-[.13em] transition-colors ${
              !crumb.onClick
                ? 'text-muted-foreground cursor-default'
                : i === crumbs.length - 1
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground cursor-pointer'
            }`}
          >
            {crumb.label}
          </button>
        </span>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// File Inspector — unchanged from Phase 0
// ─────────────────────────────────────────────────────────────────────────────

function Inspector({
  file,
  building,
  onSelectFile,
  onExplain,
  onClose,
}: {
  file:         FileData;
  building:     BuildingData | null;
  onSelectFile: (file: FileData) => void;
  onExplain:    () => void;
  onClose:      () => void;
}) {
  const [isTreeExpanded, setTreeExpanded] = useState(true);

  return (
    <aside className="pointer-events-auto border border-border bg-[#12161b]/95 shadow-[0_14px_50px_rgba(0,0,0,.28)] backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <FileCode2 className="h-3.5 w-3.5 text-primary" />
          <span className="mono text-[9px] uppercase tracking-[.16em] text-muted-foreground">
            File inspector
          </span>
        </div>
        <button
          type="button"
          data-testid="button-close-inspector"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Close file inspector"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="p-4">
        <p className="mono break-all text-xs leading-5 text-foreground">{file.path}</p>
        <p className="mt-3 text-xs leading-5 text-muted-foreground">Source File</p>
        <div className="mt-4 grid grid-cols-2 gap-px border border-border bg-border">
          <div className="bg-card px-3 py-2">
            <p className="mono text-[9px] text-muted-foreground">LINES</p>
            <p className="mt-1 mono text-xs text-foreground">{formatNumber(file.lines)}</p>
          </div>
          <div className="bg-card px-3 py-2">
            <p className="mono text-[9px] text-muted-foreground">CHANGES</p>
            <p className="mt-1 mono text-xs text-foreground">{formatNumber(file.changes)}</p>
          </div>
          <div className="bg-card px-3 py-2">
            <p className="mono text-[9px] text-muted-foreground">LANGUAGE</p>
            <p className="mt-1 mono text-xs text-foreground">{file.language}</p>
          </div>
          <div className="bg-card px-3 py-2">
            <p className="mono text-[9px] text-muted-foreground">RISK</p>
            <p className={`mt-1 mono text-xs uppercase ${riskClass(file.risk)}`}>{file.risk}</p>
          </div>
          <div className="bg-card px-3 py-2">
            <p className="mono text-[9px] text-muted-foreground">CONTRIBUTORS</p>
            <p className="mt-1 mono text-xs text-foreground">{formatNumber(file.contributors)}</p>
          </div>
          <div className="bg-card px-3 py-2">
            <p className="mono text-[9px] text-muted-foreground">MODIFIED</p>
            <p className="mt-1 mono text-xs text-foreground">{file.lastModified}</p>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between text-[10px] text-muted-foreground">
          <span>Tests</span>
          <span className={file.testStatus === 'tested' ? 'text-[#3d8f6a]' : file.testStatus === 'partial' ? 'text-[#c3a45f]' : 'text-[#c1766d]'}>
            {file.testStatus}
          </span>
        </div>
        {(file.imports.length > 0 || file.importedBy.length > 0) && (
          <div className="mt-4 border-t border-border pt-3">
            <p className="mono text-[9px] text-muted-foreground mb-2">DEPENDENCIES</p>
            {file.imports.length > 0 && <p className="text-[10px] text-muted-foreground mb-1">Imports: {file.imports.length}</p>}
            {file.importedBy.length > 0 && <p className="text-[10px] text-muted-foreground">Imported by: {file.importedBy.length}</p>}
          </div>
        )}
        <div className="mt-4 border-t border-border pt-4">
          <p className="mono text-[9px] uppercase tracking-[.16em] text-muted-foreground mb-3">
            File Structure
          </p>
          {building && (
            <div className="text-xs font-mono">
              <div
                className="flex items-center gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground"
                onClick={() => setTreeExpanded(!isTreeExpanded)}
              >
                {isTreeExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                <Folder className="w-3 h-3" />
                <span>{building.name}/</span>
              </div>
              {isTreeExpanded && (
                <div className="ml-5 mt-1 border-l border-border/50 pl-3 flex flex-col gap-1">
                  {building.files.map((f) => {
                    const isActive = f.id === file.id;
                    return (
                      <div
                        key={f.id}
                        onClick={() => onSelectFile(f)}
                        className={`flex items-center gap-1.5 px-2 py-1 cursor-pointer transition-colors ${
                          isActive 
                            ? 'bg-primary/20 text-primary' 
                            : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
                        }`}
                      >
                        <FileCode2 className="w-3 h-3" />
                        <span>{f.name}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
        <button
          type="button"
          data-testid="button-explain-file"
          onClick={onExplain}
          className="mt-4 flex w-full items-center justify-center gap-2 border border-primary/60 bg-primary/10 px-3 py-2.5 text-xs text-primary transition-colors hover:bg-primary/20"
        >
          <Zap className="h-3.5 w-3.5" /> Explain with AI
        </button>
      </div>
    </aside>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Explain Panel
// ─────────────────────────────────────────────────────────────────────────────

function ExplainPanel({
  explanation,
  onClose,
}: {
  explanation: AiExplanation;
  onClose:     () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#080a0d]/80 p-5 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="explain-title"
    >
      <div className="entrance w-full max-w-lg border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <p className="mono text-[9px] tracking-[.16em] text-primary">
              CITY INTELLIGENCE / FILE NOTE
            </p>
            <h2 id="explain-title" className="mt-2 text-base font-medium text-foreground">
              {explanation.title}
            </h2>
          </div>
          <button
            type="button"
            data-testid="button-close-explanation"
            onClick={onClose}
            aria-label="Close explanation"
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5">
          <p className="text-sm leading-6 text-muted-foreground">{explanation.summary}</p>
          <div className="mt-6 space-y-5">
            {explanation.sections.map((section) => (
              <div key={section.heading}>
                <h3 className="mono text-[10px] uppercase tracking-[.14em] text-primary">
                  {section.heading}
                </h3>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{section.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 border-t border-border pt-4">
            <p className="mono text-[9px] uppercase tracking-[.14em] text-muted-foreground">
              References
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {explanation.references.map((reference) => (
                <span
                  key={reference}
                  className="mono border border-border px-2 py-1 text-[9px] text-foreground"
                >
                  {reference}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Search Panel
// ─────────────────────────────────────────────────────────────────────────────

function SearchPanel({
  planetData,
  onSelect,
  onFocusFile,
}: {
  planetData:   PlanetData;
  onSelect:     (file: FileData) => void;
  onFocusFile?: (fileId: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [ask, setAsk]     = useState('');
  const [answer, setAnswer] = useState<AiQueryResult | null>(null);

  const allBuildings = useMemo(() => {
    return planetData.countries.flatMap(c =>
      c.cities.flatMap(city =>
        city.districts.flatMap(d => 
          d.buildings.flatMap(b => b.files)
        )
      )
    );
  }, [planetData]);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const search = query.toLowerCase();
    return allBuildings
      .filter(f => `${f.path} ${f.name} ${f.language}`.toLowerCase().includes(search))
      .slice(0, 6);
  }, [allBuildings, query]);

  const submitAsk = async (event: FormEvent) => {
    event.preventDefault();
    if (!ask.trim()) return;
    
    // Default to the first country if none selected
    const repoId = planetData.countries[0]?.repositoryId || 'unknown';
    
    try {
      const result = await askCityAI(repoId, ask);
      // Adapt AskResponse to AiQueryResult format expected by UI
      setAnswer({
        answer: result.answer,
        references: result.targets.map(t => t.path),
        confidence: 'high'
      });
      
      if (result.targets.length > 0) {
        const refPath = result.targets[0].path;
        const target  = allBuildings.find(f => f.path === refPath || f.path.includes(refPath));
        if (target) onFocusFile?.(target.id);
      }
    } catch (err) {
      console.error("Failed to ask city", err);
      setAnswer({ 
        answer: "Sorry, I couldn't process that question right now.", 
        references: [],
        confidence: 'medium'
      });
    }
  };

  return (
    <div className="pointer-events-auto w-full max-w-[290px] space-y-3">
      <div className="border border-border bg-[#12161b]/95 backdrop-blur-md">
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            data-testid="input-world-search"
            placeholder="Search files, folders, concepts"
            className="min-w-0 flex-1 bg-transparent py-3 text-xs text-foreground outline-none placeholder:text-muted-foreground/55"
          />
        </div>
        {results.length > 0 && (
          <div className="max-h-56 overflow-auto border-t border-border">
            {results.map(file => (
              <button
                type="button"
                key={file.id}
                data-testid={`button-search-result-${file.id}`}
                onClick={() => { onSelect(file); onFocusFile?.(file.id); setQuery(''); }}
                className="flex w-full items-start gap-2 border-b border-border/70 px-3 py-2.5 text-left last:border-0 hover:bg-secondary"
              >
                <FileCode2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="min-w-0">
                  <span className="mono block truncate text-[10px] text-foreground">{file.path}</span>
                  <span className="mt-1 block text-[10px] text-muted-foreground">
                    {file.language} · {file.lines} lines
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
        {query && !results.length && (
          <p className="px-3 py-3 text-xs text-muted-foreground">
            No mapped files match &ldquo;{query}&rdquo;.
          </p>
        )}
      </div>
      <div className="border border-border bg-[#12161b]/95 p-3 backdrop-blur-md">
        <div className="mb-2 flex items-center gap-2">
          <CircleHelp className="h-3.5 w-3.5 text-primary" />
          <span className="mono text-[9px] uppercase tracking-[.15em] text-muted-foreground">
            Ask the City
          </span>
        </div>
        <form onSubmit={submitAsk}>
          <input
            value={ask}
            onChange={e => setAsk(e.target.value)}
            data-testid="input-ask-city"
            placeholder="Ask the City..."
            className="w-full border-b border-border bg-transparent py-2 text-xs text-foreground outline-none placeholder:text-muted-foreground/55 focus:border-primary"
          />
        </form>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {[
            ['button-suggestion-auth',     'Authentication',    'Where are the authentication files?'],
            ['button-suggestion-active',   'Most active',       'Show me the most active code.'],
            ['button-suggestion-largest',  'Largest files',     'What are the largest files?'],
            ['button-suggestion-notests',  'No tests',          'Which files have no tests?'],
            ['button-suggestion-deps',     'Dependencies',      'Show dependencies of auth_service.py.'],
            ['button-suggestion-hotspots', 'Hotspots',          'Where are the high-risk hotspots?'],
          ].map(([testId, label, prompt]) => (
            <button
              key={testId}
              type="button"
              data-testid={testId}
              onClick={() => setAsk(prompt)}
              className="border border-border px-2 py-1 text-[9px] text-muted-foreground hover:border-primary hover:text-primary"
            >
              {label}
            </button>
          ))}
        </div>
        {answer && (
          <div className="mt-3 border-t border-border pt-3">
            <p className="text-[11px] leading-5 text-muted-foreground">{answer.answer}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {answer.references.map(reference => (
                <button
                  key={reference}
                  type="button"
                  className="mono text-[8px] text-primary hover:text-primary/80 break-all text-left max-w-full"
                  onClick={() => {
                    const target = allBuildings.find(
                      f => f.path === reference || f.path.includes(reference),
                    );
                    if (target) { onSelect(target); onFocusFile?.(target.id); }
                  }}
                >
                  {reference}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// World page — main shell
// ─────────────────────────────────────────────────────────────────────────────

export default function World() {
  const [, setLocation] = useLocation();
  const [selected,    setSelected]    = useState<FileData | null>(null);
  const [explanation, setExplanation] = useState<AiExplanation | null>(null);
  const [mode,        setMode]        = useState<'world' | 'activity' | 'hotspots' | 'dependencies' | 'tests'>('world');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showLabels,  setShowLabels]  = useState(true);
  const [worldState,  setWorldState]  = useState<WorldState>({
    view: 'global',
    activeRepositoryId: null,
    activeCityId: null,
    activeDistrictId: null,
    activeBuildingId: null,
    activeFileId: null,
  });

  const [planetData, setPlanetData] = useState<PlanetData>(fallbackMockPlanet);
  const [isLoadingData, setIsLoadingData] = useState(true);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('repo-city-planet-data');
      if (stored) {
        setPlanetData(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to load planet data from session storage", e);
    } finally {
      setIsLoadingData(false);
    }
  }, []);

  const viewportRef = useRef<WorldViewportHandle | null>(null);

  const planetStats = useMemo(() => {
    let files = 0, loc = 0, commits = 0;
    for (const c of planetData.countries) {
      files   += c.stats.files;
      loc     += c.stats.loc;
      commits += c.stats.commits;
    }
    return { files, loc, commits, countries: planetData.countries.length };
  }, [planetData]);

  // Called by the engine every time the hierarchy changes
  const handleStateChange = useCallback((state: WorldState) => {
    setWorldState(state);
  }, []);

  const explain = async () => {
    if (selected) {
      setExplanation({
        fileId:   selected.id,
        title:    selected.name,
        summary:  'Analyzing file with AI...',
        sections: [],
        references: [],
      });
      
      try {
        const repoId = planetData.countries[0]?.repositoryId || 'unknown';
        const result = await explainFileAI(repoId, selected.id);
        
        setExplanation({
          fileId:   selected.id,
          title:    selected.name,
          summary:  result.summary,
          sections: [
            { heading: 'Key Components', body: result.keyComponents.join(', ') || 'None identified' },
            { heading: 'Potential Issues', body: result.potentialIssues.join(', ') || 'None identified' }
          ],
          references: [],
        });
      } catch (err: any) {
        setExplanation({
          fileId:   selected.id,
          title:    selected.name,
          summary:  `Failed to analyze file: ${err.message}`,
          sections: [],
          references: [],
        });
      }
    }
  };

  const reset = () => {
    setSelected(null);
    setMode('world');
    viewportRef.current?.resetCamera();
  };

  const handleBack = () => {
    viewportRef.current?.navigateBack();
    if (worldState.activeFileId) setSelected(null);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  };

  const handleSelectFile = (file: FileData) => setSelected(file);

  const handleFocusFile = (fileId: string) => {
    const file = findFile(planetData, fileId);
    if (file) setSelected(file);
    viewportRef.current?.focusFile(fileId);
  };

  const handleEngineSelect = (fileId: string) => {
    const file = findFile(planetData, fileId);
    if (file) setSelected(file);
  };

  if (isLoadingData) {
    return <div className="flex min-h-[100dvh] items-center justify-center bg-background"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  }

  return (
    <main className="noise relative min-h-[100dvh] overflow-hidden bg-background">
      {/* ── 3D World ────────────────────────────────────────────────────────── */}
      <WorldViewport
        planetData={planetData}
        mode={mode}
        showLabels={showLabels}
        onSelectFile={handleEngineSelect}
        onStateChange={handleStateChange}
        viewportRef={viewportRef}
      />

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="pointer-events-none absolute left-0 right-0 top-0 z-10 flex items-start justify-between p-4 sm:p-6">
        <div className="pointer-events-auto flex flex-col gap-4">
          <div>
            <Brand />
            <p className="mono mt-3 hidden text-[10px] text-muted-foreground sm:block">
              GLOBAL VIEW / <span className="text-foreground">REPO PLANET</span>
            </p>
            {/* Breadcrumb */}
            <Breadcrumb
              planetData={planetData}
              worldState={worldState}
              onBack={handleBack}
              onReset={reset}
            />
          </div>
          
          <SearchPanel
            planetData={planetData}
            onSelect={handleSelectFile}
            onFocusFile={handleFocusFile}
          />
        </div>

        <div className="pointer-events-auto absolute left-1/2 hidden -translate-x-1/2 text-center md:block">
          <p className="mono text-[11px] tracking-[.13em] text-foreground">
            {planetStats.countries} REPOSITORIES
          </p>
          <div className="mt-2 flex items-center gap-4 text-[9px] text-muted-foreground">
            <span>{formatNumber(planetStats.files)} FILES</span>
            <span>{formatNumber(planetStats.loc)} LOC</span>
            <span>{formatNumber(planetStats.commits)} COMMITS</span>
          </div>
        </div>

        <div className="pointer-events-auto flex items-center gap-1 border border-border bg-[#12161b]/90 p-1">
          <button
            type="button"
            data-testid="button-reset-world"
            onClick={reset}
            aria-label="Reset world"
            className="p-2 text-muted-foreground hover:text-primary"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            data-testid="button-fullscreen"
            onClick={toggleFullscreen}
            aria-label="Enter fullscreen"
            className="p-2 text-muted-foreground hover:text-primary"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            data-testid="button-world-settings"
            onClick={() => setSettingsOpen(o => !o)}
            aria-label="World settings"
            className={`p-2 ${settingsOpen ? 'text-primary' : 'text-muted-foreground hover:text-primary'}`}
          >
            <Settings2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>


      {/* ── Legend ──────────────────────────────────────────────────────────── */}
      <div className="absolute bottom-5 left-4 z-10 hidden items-center gap-4 border border-border bg-[#12161b]/90 px-3 py-2 sm:flex">
        <span className="mono text-[9px] uppercase tracking-[.13em] text-muted-foreground">Legend</span>
        <span className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
          <i className="h-2 w-2 rounded-full bg-[#c9a95e]" /> building height / LOC
        </span>
        <span className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
          <i className="h-2 w-2 rounded-full bg-[#c3a45f]" /> activity
        </span>
        <span className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
          <i className="h-2 w-2 rounded-full bg-[#c1766d]" /> hotspot
        </span>
        <span className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
          <i className="h-2 w-2 rounded-full bg-[#3d8f6a]" /> tests
        </span>
      </div>

      {/* ── View mode controls ───────────────────────────────────────────────── */}
      <div className="pointer-events-auto absolute bottom-5 right-4 z-10 flex items-center gap-1 border border-border bg-[#12161b]/90 p-1 sm:right-6">
        <span className="mono hidden px-2 text-[9px] tracking-[.12em] text-muted-foreground sm:inline">VIEW</span>
        {(['world', 'activity', 'hotspots', 'dependencies', 'tests'] as const).map(view => {
          const titles = {
            world: 'Default World View',
            activity: 'Activity Heatmap',
            hotspots: 'Risk Hotspots',
            dependencies: 'File Dependencies',
            tests: 'Test Coverage'
          };
          return (
            <div key={view} className="relative group flex">
              <button
                type="button"
                data-testid={`button-mode-${view}`}
                onClick={() => setMode(view)}
                className={`px-2 py-1.5 text-[9px] uppercase tracking-wider transition-colors ${
                mode === view
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {view === 'world'        ? <Gauge      className="mx-auto h-3.5 w-3.5" />
               : view === 'activity'     ? <Activity   className="mx-auto h-3.5 w-3.5" />
               : view === 'hotspots'     ? <Zap        className="mx-auto h-3.5 w-3.5" />
               : view === 'dependencies' ? <GitBranch  className="mx-auto h-3.5 w-3.5" />
               :                           <CircleHelp className="mx-auto h-3.5 w-3.5" />}
              </button>
              <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap rounded border border-border bg-card px-2 py-1 text-[10px] text-foreground opacity-0 shadow-xl transition-opacity group-hover:opacity-100">
                {titles[view]}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Settings panel ───────────────────────────────────────────────────── */}
      {settingsOpen && (
        <div className="pointer-events-auto absolute right-4 top-16 z-20 w-52 border border-border bg-card p-4 shadow-xl sm:right-6">
          <div className="flex items-center justify-between">
            <p className="mono text-[9px] tracking-[.14em] text-primary">WORLD SETTINGS</p>
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </div>
          <label className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
            <span>Show labels</span>
            <input
              type="checkbox"
              checked={showLabels}
              onChange={e => setShowLabels(e.target.checked)}
              className="accent-[hsl(var(--primary))]"
            />
          </label>
          <label className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>Animate edges</span>
            <input type="checkbox" defaultChecked className="accent-[hsl(var(--primary))]" />
          </label>
        </div>
      )}

      {/* ── File inspector ────────────────────────────────────────────────────── */}
      {selected && (
        <div className="pointer-events-auto absolute bottom-16 right-4 z-10 w-[calc(100%-2rem)] max-w-[330px] sm:bottom-20 sm:right-6">
          <Inspector
            file={selected}
            building={findBuildingForFile(planetData, selected.id) || null}
            onSelectFile={(f) => {
              if (viewportRef.current) {
                viewportRef.current.focusFile(f.id);
              }
            }}
            onExplain={explain}
            onClose={() => setSelected(null)}
          />
        </div>
      )}

      {/* ── AI explain overlay ────────────────────────────────────────────────── */}
      {explanation && (
        <ExplainPanel explanation={explanation} onClose={() => setExplanation(null)} />
      )}

      {/* ── Escape hint (when inside a repo) ─────────────────────────────────── */}
      {worldState.activeRepositoryId && (
        <div className="pointer-events-none absolute bottom-5 left-1/2 z-10 -translate-x-1/2">
          <span className="mono rounded border border-border/60 bg-[#12161b]/80 px-3 py-1.5 text-[9px] text-muted-foreground backdrop-blur-sm">
            ESC to navigate back
          </span>
        </div>
      )}

      {/* ── Mobile repo count ─────────────────────────────────────────────────── */}
      <div className="pointer-events-none absolute bottom-16 left-4 z-10 sm:hidden">
        <div className="flex items-center gap-2 border border-border bg-[#12161b]/90 px-2 py-1.5">
          <Folder className="h-3.5 w-3.5 text-primary" />
          <span className="mono text-[9px] text-muted-foreground">
            {planetStats.countries} REPOSITORIES
          </span>
        </div>
      </div>
    </main>
  );
}
