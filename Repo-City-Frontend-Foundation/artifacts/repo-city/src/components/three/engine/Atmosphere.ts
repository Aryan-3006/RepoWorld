import * as THREE from 'three';

/**
 * Creates a subtle atmospheric glow around the planet using a custom shader.
 */
export class Atmosphere {
  public mesh: THREE.Mesh;

  constructor(planetRadius: number) {
    // Atmosphere should be thin and hug the planet closely
    const radius = planetRadius * 1.04;
    const geometry = new THREE.SphereGeometry(radius, 128, 128);

    const vertexShader = `
      varying vec3 vNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;

    const fragmentShader = `
      varying vec3 vNormal;
      void main() {
        // Tighter fresnel effect for a thin atmospheric rim
        float intensity = pow(0.55 - dot(vNormal, vec3(0, 0, 1.0)), 3.0);
        // Soft atmospheric blue
        gl_FragColor = vec4(0.2, 0.5, 0.9, 1.0) * intensity * 0.8;
      }
    `;

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false
    });

    this.mesh = new THREE.Mesh(geometry, material);
  }
}
