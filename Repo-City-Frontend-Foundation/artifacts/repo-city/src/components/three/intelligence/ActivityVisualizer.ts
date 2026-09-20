import type { IntelligenceContext, IntelligenceVisualizer } from './IntelligenceMode';
import { findFile } from './IntelligenceMode';
import * as THREE from 'three';

export class ActivityVisualizer implements IntelligenceVisualizer {
  private tempColor = new THREE.Color();
  private indicators: THREE.Mesh[] = [];

  apply(context: IntelligenceContext): void {
    const { cityGen, scene, planetData } = context;

    const highRiskBuildings = new Set<string>();

    for (const [fileId, instanceData] of cityGen.fileIdToInstance.entries()) {
      const file = findFile(planetData, fileId);
      if (!file) continue;

      // Calculate activity intensity based on changes and recency
      // Simple heuristic for mock data: 
      // max changes ~ 200. High activity => changes > 100.
      const activityScore = Math.min(1.0, file.changes / 100);

      this.tempColor.copy(instanceData.baseColor);

      if (activityScore > 0.6) {
        // Highly active: slightly brighter, warmer
        this.tempColor.offsetHSL(0, 0.2, 0.2); // Increase saturation and lightness
      } else if (activityScore > 0.2) {
        // Medium activity: normal
      } else {
        // Low activity: subdued, darker, desaturated
        this.tempColor.offsetHSL(0, -0.4, -0.3);
      }

      instanceData.mesh.setColorAt(instanceData.instanceId, this.tempColor);
    }

    this.markNeedsUpdate(context);
  }

  reset(context: IntelligenceContext): void {
    const { cityGen } = context;
    for (const [_, instanceData] of cityGen.fileIdToInstance.entries()) {
      instanceData.mesh.setColorAt(instanceData.instanceId, instanceData.baseColor);
    }
    this.markNeedsUpdate(context);
  }

  private markNeedsUpdate(context: IntelligenceContext) {
    const meshes = new Set<THREE.InstancedMesh>();
    for (const [_, instanceData] of context.cityGen.fileIdToInstance.entries()) {
      meshes.add(instanceData.mesh);
    }
    for (const mesh of meshes) {
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }
}
