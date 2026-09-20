import * as THREE from 'three';

/**
 * Creates a transparent cloud sphere slightly larger than the Earth.
 */
export class CloudLayer {
  public mesh: THREE.Mesh;

  constructor(planetRadius: number) {
    const radius = planetRadius * 1.006; // Just above the surface
    const geometry = new THREE.SphereGeometry(radius, 128, 128);
    
    const textureLoader = new THREE.TextureLoader();
    const cloudMap = textureLoader.load('/textures/planets/earth_clouds_1024.png');

    const material = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      alphaMap: cloudMap,
      transparent: true,
      opacity: 0.4,
      blending: THREE.NormalBlending,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = true;
  }

  public update(deltaTime: number) {
    // Clouds rotate slightly faster/differently than the earth
    this.mesh.rotation.y += 0.02 * deltaTime;
  }
}
