import re

with open('src/components/three/engine/CityGenerator.ts', 'r') as f:
    content = f.read()

replacement = """
    const cityMarkers = this.buildCityMarkers(cityMarkerPending);

    // ── Architectural Ground Plane ──
    const groundGeom = new THREE.PlaneGeometry(80, 80);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x111113,
      roughness: 0.8,
      metalness: 0.2,
      depthWrite: false, // Ensure it doesn't cause z-fighting if placed exactly
    });
    const groundMesh = new THREE.Mesh(groundGeom, groundMat);
    groundMesh.position.copy(centerPos3D);
    groundMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    
    // We add this to floorMeshes technically, or return it. Let's return it as groundPlane.
    return { cityLabels, cityMarkers, floorMeshes, groundPlane: groundMesh };
"""

content = re.sub(r'const cityMarkers = this\.buildCityMarkers\(cityMarkerPending\);\n\n    return \{ cityLabels, cityMarkers, floorMeshes \};', replacement.strip(), content)

# update CountryGeometryGroup interface
content = re.sub(r'floorMeshes: \{ mesh: THREE\.InstancedMesh; data: Map<number, string> \}\[\];\n\s*\}', r'floorMeshes: { mesh: THREE.InstancedMesh; data: Map<number, string> }[];\n  groundPlane: THREE.Mesh;\n}', content)


with open('src/components/three/engine/CityGenerator.ts', 'w') as f:
    f.write(content)
