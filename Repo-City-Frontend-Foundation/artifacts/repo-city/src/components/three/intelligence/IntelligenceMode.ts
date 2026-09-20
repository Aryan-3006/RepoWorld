import type { CityGenerator } from '../engine/CityGenerator';
import type { PlanetData } from '../../../types/planet';
import * as THREE from 'three';

export interface IntelligenceContext {
  planetData: PlanetData;
  cityGen: CityGenerator;
  scene: THREE.Scene;
  activeFileId: string | null;
}

export interface IntelligenceVisualizer {
  apply(context: IntelligenceContext): void;
  reset(context: IntelligenceContext): void;
}

export function findFile(planetData: PlanetData, id: string) {
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

export function allFiles(planetData: PlanetData) {
  return planetData.countries.flatMap(c =>
    c.cities.flatMap(city =>
      city.districts.flatMap(d => 
        d.buildings.flatMap(b => b.files)
      )
    )
  );
}
