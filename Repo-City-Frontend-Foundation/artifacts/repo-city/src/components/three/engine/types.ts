import type { CameraLevel } from './CameraController';

export type { CameraLevel };
export type ZoomLevel = CameraLevel;
export type VisualizationMode = 'world' | 'activity' | 'hotspots' | 'dependencies' | 'tests';

export interface WorldState {
  view:               CameraLevel;
  activeRepositoryId: string | null;
  activeCityId:       string | null;
  activeDistrictId:   string | null;
  activeBuildingId:   string | null;
  activeFileId:       string | null; // NEW: Added file level
}

export interface RepoPlanetAPI {
  setSelectedCountry(id: string | null): void;
  focusCity(cityId: string): void;
  focusDistrict(districtId: string): void;
  focusBuilding(buildingId: string): void;
  focusFile(fileId: string): void;
  focusContinent(continentId: string): void;
  resetCamera(): void;
  navigateBack(): boolean;
  getWorldState(): WorldState;
  setMode(mode: VisualizationMode): void;
  setShowLabels(show: boolean): void;
  dispose(): void;
}
