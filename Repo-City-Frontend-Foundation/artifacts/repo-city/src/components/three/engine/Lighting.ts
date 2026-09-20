import * as THREE from 'three';

/**
 * Manages cinematic sun and ambient lighting for the planet.
 */
export class Lighting {
  public ambientLight: THREE.AmbientLight;
  public sunLight: THREE.DirectionalLight;
  public fillLight: THREE.DirectionalLight;

  constructor(scene: THREE.Scene) {
    // Increased ambient light to ensure the dark side is readable (~25% visibility)
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.7); 
    scene.add(this.ambientLight);

    // Primary sun
    this.sunLight = new THREE.DirectionalLight(0xfff5e6, 3.5);
    // Position the sun to cast a nice angle across the sphere
    this.sunLight.position.set(200, 50, 150);
    this.sunLight.castShadow = true;
    
    // Shadow properties
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 50;
    this.sunLight.shadow.camera.far = 400;
    this.sunLight.shadow.camera.left = -150;
    this.sunLight.shadow.camera.right = 150;
    this.sunLight.shadow.camera.top = 150;
    this.sunLight.shadow.camera.bottom = -150;
    
    scene.add(this.sunLight);

    // Subtle blue fill light from the opposite side to mimic starlight/galaxy glow, providing shape to the dark side
    this.fillLight = new THREE.DirectionalLight(0x446699, 0.8);
    this.fillLight.position.set(-200, -50, -150);
    scene.add(this.fillLight);
  }
}
