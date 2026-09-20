import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { getPlanetPosition } from './coordinates';

interface MarkerData {
  id: string;
  label: string;
  lat: number;
  lng: number;
}

/**
 * Manages geographic information markers floating above the globe.
 */
export class WorldLabels {
  private markers: THREE.Group;
  private radius: number;

  constructor(scene: THREE.Scene, planetRadius: number) {
    this.markers = new THREE.Group();
    this.radius = planetRadius;
    scene.add(this.markers);

    this.createMockMarkers();
  }

  private createMockMarkers() {
    const mockData: MarkerData[] = [
      { id: 'frontend', label: 'FRONTEND', lat: 35, lng: -90 },
      { id: 'backend', label: 'BACKEND', lat: 45, lng: 10 },
      { id: 'infra', label: 'INFRASTRUCTURE', lat: -20, lng: -50 },
      { id: 'tests', label: 'TESTS', lat: 55, lng: 80 },
      { id: 'docs', label: 'DOCUMENTATION', lat: -30, lng: 130 },
    ];

    for (const data of mockData) {
      this.addMarker(data);
    }
  }

  private addMarker(data: MarkerData) {
    // Place marker slightly above the surface (e.g., above clouds)
    const markerRadius = this.radius * 1.05;
    const position = getPlanetPosition(data.lat, data.lng, markerRadius);

    // Create a small glowing dot
    const dotGeo = new THREE.SphereGeometry(0.8, 16, 16);
    const dotMat = new THREE.MeshBasicMaterial({ color: 0x6fbcf0, transparent: true, opacity: 0.8 });
    const dot = new THREE.Mesh(dotGeo, dotMat);
    dot.position.copy(position);
    this.markers.add(dot);

    // Create leader line from surface to dot
    const surfacePos = getPlanetPosition(data.lat, data.lng, this.radius);
    
    const lineGeo = new THREE.BufferGeometry().setFromPoints([
      surfacePos,
      position
    ]);
    const lineMat = new THREE.LineBasicMaterial({ color: 0x6fbcf0, transparent: true, opacity: 0.5 });
    const line = new THREE.Line(lineGeo, lineMat);
    this.markers.add(line);

    // Create CSS2D label
    const div = document.createElement('div');
    div.className = 'planet-label';
    div.textContent = data.label;
    div.style.color = '#ffffff';
    div.style.fontFamily = 'monospace';
    div.style.fontSize = '11px';
    div.style.letterSpacing = '1px';
    div.style.padding = '4px 8px';
    div.style.backgroundColor = 'rgba(10, 15, 25, 0.7)';
    div.style.border = '1px solid rgba(111, 188, 240, 0.4)';
    div.style.borderRadius = '4px';
    div.style.marginTop = '-15px'; // offset from the dot
    div.style.pointerEvents = 'none';
    
    const label = new CSS2DObject(div);
    label.position.copy(position);
    this.markers.add(label);
  }

  public update(deltaTime: number) {
    // Optionally rotate markers with the planet if they are parented to the scene
    // We can just parent the markers group to the planet mesh in RepoPlanet, or update rotation here.
    // If they are in their own group, we must rotate them identically to the planet.
    this.markers.rotation.y += 0.015 * deltaTime;
  }
}
