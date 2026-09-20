import * as THREE from 'three';

/**
 * Creates the main Earth sphere with diffuse, normal, and specular maps.
 */
export class Planet {
  public mesh: THREE.Mesh;
  public radius: number = 100;
  private rotationPaused = false;

  constructor() {
    const geometry = new THREE.SphereGeometry(this.radius, 128, 128);
    
    const textureLoader = new THREE.TextureLoader();
    const diffuseMap = textureLoader.load('/textures/planets/earth_atmos_2048.jpg');
    const specularMap = textureLoader.load('/textures/planets/earth_specular_2048.jpg');
    const normalMap = textureLoader.load('/textures/planets/earth_normal_2048.jpg');

    diffuseMap.colorSpace = THREE.SRGBColorSpace;

    const material = new THREE.MeshStandardMaterial({
      map: diffuseMap,
      metalnessMap: specularMap,
      normalMap: normalMap,
      metalness: 0.6, // Oceans will be metallic for tight reflections
      roughness: 0.4, // Globally slightly smooth for realistic atmosphere scatter and water
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = true;
  }

  public pauseRotation(): void {
    this.rotationPaused = true;
  }

  public resumeRotation(): void {
    this.rotationPaused = false;
  }

  public update(deltaTime: number) {
    if (this.rotationPaused) return;
    // Slowly rotate the Earth
    this.mesh.rotation.y += 0.015 * deltaTime;
  }
}
