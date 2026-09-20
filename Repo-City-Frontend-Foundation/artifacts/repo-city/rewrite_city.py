import re

with open('src/components/three/engine/CityGenerator.ts', 'r') as f:
    content = f.read()

# Replace generateForCountry
replacement = """
  public generateForCountry(
    country: CountryData,
    center: CountryPatch,
    rng: SeededRandom,
  ): CountryGeometryGroup {
    const buckets = new Map<FloorArchetype, PendingFloor[]>();
    const cityMarkerPending: PendingCityMarker[] = [];
    const cityLabels = new THREE.Group();

    // ── Create tangent plane for the architectural site ──
    const centerPos3D = getPlanetPosition(center.lat, center.lng, this.planet.radius);
    const normal = centerPos3D.clone().normalize();
    const up = new THREE.Vector3(0, 1, 0);
    let tangent = new THREE.Vector3().crossVectors(up, normal).normalize();
    if (tangent.lengthSq() < 0.001) {
      tangent = new THREE.Vector3(1, 0, 0);
    }
    const bitangent = new THREE.Vector3().crossVectors(normal, tangent).normalize();

    // Helper to map flat (x, y) to 3D tangent plane
    const projectFlat = (x: number, y: number) => {
      return centerPos3D.clone()
        .add(tangent.clone().multiplyScalar(x))
        .add(bitangent.clone().multiplyScalar(y));
    };

    const cityCount = country.cities.length;
    const cityGridSize = Math.ceil(Math.sqrt(cityCount));
    const citySpacing = 12.0;

    for (let c = 0; c < cityCount; c++) {
      const city = country.cities[c];
      const cx = ((c % cityGridSize) - (cityGridSize - 1) / 2) * citySpacing;
      const cy = (Math.floor(c / cityGridSize) - (cityGridSize - 1) / 2) * citySpacing;

      const cityPos3D = projectFlat(cx, cy);
      this.cityIdToPosition.set(city.id, cityPos3D);
      cityMarkerPending.push({ position: cityPos3D, normal, id: city.id });

      // Add city label slightly higher
      this.addCityLabel(city, cityPos3D, normal, cityLabels);

      const distCount = city.districts.length;
      const distGridSize = Math.ceil(Math.sqrt(distCount));
      const distSpacing = 6.0;

      for (let d = 0; d < distCount; d++) {
        const district = city.districts[d];
        const dx = cx + ((d % distGridSize) - (distGridSize - 1) / 2) * distSpacing;
        const dy = cy + (Math.floor(d / distGridSize) - (distGridSize - 1) / 2) * distSpacing;

        const distPos3D = projectFlat(dx, dy);
        this.districtIdToPosition.set(district.id, distPos3D);

        const buildCount = district.buildings.length;
        const buildGridSize = Math.ceil(Math.sqrt(buildCount));
        const buildSpacing = 1.6;

        for (let b = 0; b < buildCount; b++) {
          const building = district.buildings[b];
          const bx = dx + ((b % buildGridSize) - (buildGridSize - 1) / 2) * buildSpacing;
          const by = dy + (Math.floor(b / buildGridSize) - (buildGridSize - 1) / 2) * buildSpacing;

          const buildingPos3D = projectFlat(bx, by);
          this.buildingIdToPosition.set(building.id, buildingPos3D);

          // ── Building Foundation ──
          const maxFoot = Math.max(...building.files.map(f => this.calcFootprint(f.size)));
          const foundationHeight = 0.2;
          
          if (!buckets.has('foundation')) buckets.set('foundation', []);
          buckets.get('foundation')!.push({
            position: buildingPos3D,
            scale: new THREE.Vector3(maxFoot + 0.1, foundationHeight, maxFoot + 0.1),
            color: new THREE.Color(0x1a1a1d),
            normal: normal,
            id: building.id + '-base',
            archetype: 'foundation',
          });

          // ── Stack files as floors inside this building ──────────────────
          let currentElevation = foundationHeight;
          const gap = 0.05;

          for (const file of building.files) {
            const arch = selectFloorArchetype(file.language, file.isTest);
            const height = this.calcHeight(file.lines);
            const foot = this.calcFootprint(file.size);

            const color = getFloorColor(file.language, file.isTest, file.risk);
            const hueShift = (rng.next() - 0.5) * 0.05;
            color.offsetHSL(hueShift, 0, 0);

            const floorPos = buildingPos3D.clone().addScaledVector(normal, currentElevation);

            if (!buckets.has(arch)) buckets.set(arch, []);
            buckets.get(arch)!.push({
              position: floorPos,
              scale: new THREE.Vector3(foot, height, foot),
              color,
              normal,
              id: file.id,
              archetype: arch,
            });

            this.fileIdToPosition.set(file.id, floorPos);
            this.fileIdToCountryId.set(file.id, country.repositoryId);
            this.fileIdToBuildingId.set(file.id, building.id);

            currentElevation += height + gap;
          }
        }
      }
    }

    const floorMeshes: { mesh: THREE.InstancedMesh; data: Map<number, string> }[] = [];
    for (const [arch, pending] of buckets) {
      if (pending.length === 0) continue;
      floorMeshes.push(this.buildInstanced(arch, pending));
    }

    const cityMarkers = this.buildCityMarkers(cityMarkerPending);

    return { cityLabels, cityMarkers, floorMeshes };
  }
"""

content = re.sub(r'public generateForCountry.*?(?=\n  // ─── Helpers ───)', replacement.strip(), content, flags=re.DOTALL)

with open('src/components/three/engine/CityGenerator.ts', 'w') as f:
    f.write(content)
