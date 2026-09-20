import * as THREE from 'three';

/**
 * Converts geographic latitude and longitude into 3D spherical coordinates.
 * @param lat Latitude (-90 to 90)
 * @param lng Longitude (-180 to 180)
 * @param radius Radius of the sphere
 * @returns THREE.Vector3 position
 */
export function getPlanetPosition(lat: number, lng: number, radius: number): THREE.Vector3 {
  // Latitude is mapped to Phi (0 at North Pole, PI at South Pole)
  // Longitude is mapped to Theta (0 to 2PI)
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);

  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = (radius * Math.sin(phi) * Math.sin(theta));
  const y = (radius * Math.cos(phi));

  return new THREE.Vector3(x, y, z);
}

/**
 * Projects a 2D coordinate (x,y) from a tangent plane onto the sphere.
 */
export function projectPointToSphere(
  x: number, 
  y: number, 
  centerLat: number, 
  centerLng: number, 
  radius: number
): THREE.Vector3 {
  const centerPos = getPlanetPosition(centerLat, centerLng, radius);
  const normal = centerPos.clone().normalize();
  
  const up = new THREE.Vector3(0, 1, 0);
  let tangent = new THREE.Vector3().crossVectors(up, normal).normalize();
  if (tangent.lengthSq() < 0.001) {
    tangent = new THREE.Vector3(1, 0, 0);
  }
  const bitangent = new THREE.Vector3().crossVectors(normal, tangent).normalize();

  const angleX = x / radius;
  const angleY = y / radius;
  
  const vec = normal.clone();
  vec.applyAxisAngle(tangent, angleY);
  vec.applyAxisAngle(bitangent, -angleX);
  
  return vec.normalize().multiplyScalar(radius);
}
