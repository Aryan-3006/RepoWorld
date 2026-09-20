import type { IntelligenceContext, IntelligenceVisualizer } from './IntelligenceMode';
import { findFile } from './IntelligenceMode';
import * as THREE from 'three';

export class HotspotVisualizer implements IntelligenceVisualizer {
  private tempColor = new THREE.Color();
  private indicators: THREE.Mesh[] = [];

  apply(context: IntelligenceContext): void {
    const { cityGen, scene, planetData } = context;

    // We'll place one ground indicator per high-risk building
    const highRiskBuildings = new Set<string>();

    for (const [fileId, instanceData] of cityGen.fileIdToInstance.entries()) {
      const file = findFile(planetData, fileId);
      if (!file) continue;

      this.tempColor.copy(instanceData.baseColor);

      if (file.risk === 'high') {
        // Subtle warm highlight for the file
        this.tempColor.offsetHSL(0.0, 0.4, 0.1); 
        this.tempColor.setHex(0xd95a53); // Reddish warm

        const bId = cityGen.fileIdToBuildingId.get(fileId);
        if (bId) highRiskBuildings.add(bId);

      } else if (file.risk === 'medium') {
        this.tempColor.offsetHSL(0, 0.2, 0.05); // slightly warmer
      } else {
        // subdued
        this.tempColor.offsetHSL(0, -0.3, -0.2);
      }

      instanceData.mesh.setColorAt(instanceData.instanceId, this.tempColor);
    }

    // Add ground halos for high-risk buildings
    const geometry = new THREE.RingGeometry(1.5, 2.0, 32);
    const material = new THREE.MeshBasicMaterial({ 
      color: 0xff4422, 
      transparent: true, 
      opacity: 0.4, 
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    for (const bId of highRiskBuildings) {
      const pos = cityGen.buildingIdToPosition.get(bId);
      if (!pos) continue;

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(pos);
      
      // Orient to the surface normal
      const normal = pos.clone().normalize();
      const up = new THREE.Vector3(0, 0, 1);
      mesh.quaternion.setFromUnitVectors(up, normal);

      // Raise slightly to avoid z-fighting with the ground
      mesh.position.addScaledVector(normal, 0.05);

      scene.add(mesh);
      this.indicators.push(mesh);
    }

    this.markNeedsUpdate(context);
  }

  reset(context: IntelligenceContext): void {
    const { cityGen, scene } = context;
    for (const [_, instanceData] of cityGen.fileIdToInstance.entries()) {
      instanceData.mesh.setColorAt(instanceData.instanceId, instanceData.baseColor);
    }
    this.markNeedsUpdate(context);

    // Remove indicators
    for (const mesh of this.indicators) {
      scene.remove(mesh);
      mesh.geometry.dispose();
    }
    this.indicators = [];
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
