import type { IntelligenceContext, IntelligenceVisualizer } from './IntelligenceMode';
import { findFile } from './IntelligenceMode';
import * as THREE from 'three';

export class TestVisualizer implements IntelligenceVisualizer {
  private tempColor = new THREE.Color();

  apply(context: IntelligenceContext): void {
    const { cityGen, planetData } = context;

    for (const [fileId, instanceData] of cityGen.fileIdToInstance.entries()) {
      const file = findFile(planetData, fileId);
      if (!file) continue;

      this.tempColor.copy(instanceData.baseColor);

      if (file.isTest || file.testStatus === 'tested') {
        // High coverage / is a test file
        this.tempColor.offsetHSL(0.1, 0.4, 0.2); // Make it a bright, saturated green/cyan
        this.tempColor.setHex(0x3d8f6a); // Base test color
      } else if (file.testStatus === 'partial') {
        this.tempColor.offsetHSL(0, 0, 0); // Leave as is, or slightly tint
        this.tempColor.lerp(new THREE.Color(0x3d8f6a), 0.5);
      } else {
        // No tests detected
        this.tempColor.offsetHSL(0, -0.6, -0.4); // Subdue
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
