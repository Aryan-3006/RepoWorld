import { useEffect, useRef } from 'react';
import type { PlanetData } from '@/types/planet';
import type { VisualizationMode, WorldState } from './engine/types';
import type { RepoPlanet } from './engine/RepoPlanet';

// ─────────────────────────────────────────────────────────────────────────────
// Public interface — what world.tsx uses
// ─────────────────────────────────────────────────────────────────────────────

export interface WorldViewportHandle {
  focusFile(fileId: string): void;
  resetCamera(): void;
  setSelectedCountry(id: string | null): void;
  navigateBack(): boolean;
  getWorldState(): WorldState;
}

interface WorldViewportProps {
  planetData:      PlanetData;
  mode:            VisualizationMode;
  showLabels?:     boolean;
  onSelectFile?:   (fileId: string) => void;
  onStateChange?:  (state: WorldState) => void;
  viewportRef?:    React.MutableRefObject<WorldViewportHandle | null>;
}

/**
 * WorldViewport — thin React wrapper around the Three.js RepoPlanet engine.
 *
 * Responsibility: lifecycle management and prop bridging only.
 * All 3D logic lives in RepoPlanet and its engine modules.
 */
export function WorldViewport({
  planetData,
  mode,
  showLabels = true,
  onSelectFile,
  onStateChange,
  viewportRef,
}: WorldViewportProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<RepoPlanet | null>(null);

  // ── Mount / unmount ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!canvasRef.current) return;

    let engine: RepoPlanet | null = null;

    import('./engine/RepoPlanet').then(({ RepoPlanet }) => {
      if (!canvasRef.current) return;

      engine = new RepoPlanet(
        canvasRef.current,
        planetData,
        onSelectFile,
        onStateChange,
      );
      engineRef.current = engine;

      if (viewportRef) {
        viewportRef.current = {
          focusFile:          (id)  => engine?.focusFile(id),
          resetCamera:        ()    => engine?.resetCamera(),
          setSelectedCountry: (id)  => engine?.setSelectedCountry(id),
          navigateBack:       ()    => engine?.navigateBack() ?? false,
          getWorldState:      ()    => engine?.getWorldState() ?? {
            view: 'global',
            activeRepositoryId: null,
            activeCityId: null,
            activeDistrictId: null,
            activeBuildingId: null,
            activeFileId: null,
          },
        };
      }
    });

    return () => {
      engine?.dispose();
      engineRef.current = null;
      if (viewportRef) viewportRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planetData]);

  useEffect(() => { engineRef.current?.setMode(mode); }, [mode]);
  useEffect(() => { engineRef.current?.setShowLabels(showLabels); }, [showLabels]);

  return (
    <section
      className="absolute inset-0 z-0 min-h-[100dvh] overflow-hidden"
      aria-label="Repository world viewport"
    >
      <canvas
        ref={canvasRef}
        style={{
          display:     'block',
          width:       '100%',
          height:      '100%',
          outline:     'none',
          touchAction: 'none',
        }}
        aria-label="3D repository world"
      />
    </section>
  );
}
