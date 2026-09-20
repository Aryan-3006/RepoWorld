import type { IntelligenceContext, IntelligenceVisualizer } from './IntelligenceMode';
import { allFiles } from './IntelligenceMode';
import * as THREE from 'three';

export class DependencyVisualizer implements IntelligenceVisualizer {
  private tempColor = new THREE.Color();
  private lines: THREE.Line[] = [];

  apply(context: IntelligenceContext): void {
    const { cityGen, scene, activeFileId, planetData } = context;

    const files = allFiles(planetData);
    
    // Find relevant files
    const relevantFiles = new Set<string>();
    if (activeFileId) {
      relevantFiles.add(activeFileId);
      const activeFile = files.find(f => f.id === activeFileId);
      if (activeFile) {
        activeFile.imports.forEach(id => relevantFiles.add(id));
        activeFile.importedBy.forEach(id => relevantFiles.add(id));
      }
    }

    // Subdue unrelated buildings and highlight relevant ones
    for (const [fileId, instanceData] of cityGen.fileIdToInstance.entries()) {
      this.tempColor.copy(instanceData.baseColor);

      if (activeFileId) {
        if (fileId === activeFileId) {
          this.tempColor.offsetHSL(0, 0.4, 0.2); // Highlight active
        } else if (relevantFiles.has(fileId)) {
          this.tempColor.offsetHSL(0, 0.2, 0.1); // Highlight connected
        } else {
          this.tempColor.offsetHSL(0, -0.6, -0.4); // Subdue unrelated
        }
      } else {
        // No active file, just dim everything slightly so lines pop
        this.tempColor.offsetHSL(0, -0.2, -0.2);
      }
      instanceData.mesh.setColorAt(instanceData.instanceId, this.tempColor);
    }
    this.markNeedsUpdate(context);

    // Draw lines
    const material = new THREE.LineBasicMaterial({ 
      color: 0x44aaff, 
      transparent: true, 
      opacity: 0.6,
      blending: THREE.AdditiveBlending
    });

    for (const file of files) {
      if (activeFileId && file.id !== activeFileId) continue; // Only draw outward from active, or all if none

      const fromPos = cityGen.fileIdToPosition.get(file.id);
      if (!fromPos) continue;

      for (const impId of file.imports) {
        const toPos = cityGen.fileIdToPosition.get(impId);
        if (!toPos) continue;

        // Create an arc
        const midPoint = new THREE.Vector3().addVectors(fromPos, toPos).multiplyScalar(0.5);
        const dist = fromPos.distanceTo(toPos);
        
        // Push the midpoint outwards based on distance (arc height)
        const normal = midPoint.clone().normalize();
        midPoint.addScaledVector(normal, dist * 0.2 + 0.5);

        const curve = new THREE.QuadraticBezierCurve3(fromPos, midPoint, toPos);
        const points = curve.getPoints(20);
        const geometry = new THREE.BufferGeometry().setFromPoints(points);

        const line = new THREE.Line(geometry, material);
        scene.add(line);
        this.lines.push(line);
      }
    }
  }

  reset(context: IntelligenceContext): void {
    const { cityGen, scene } = context;
    for (const [_, instanceData] of cityGen.fileIdToInstance.entries()) {
      instanceData.mesh.setColorAt(instanceData.instanceId, instanceData.baseColor);
    }
    this.markNeedsUpdate(context);

    for (const line of this.lines) {
      scene.remove(line);
      line.geometry.dispose();
    }
    this.lines = [];
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
