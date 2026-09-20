import type {
  PlanetData,
  CountryData,
  CityData,
  DistrictData,
  BuildingData,
  FileData,
  FileLanguage,
} from '@/types/planet';

// Ensure the language matches the expected type
function normalizeLanguage(lang: string | undefined | null): FileLanguage {
  const allowed: FileLanguage[] = [
    'TypeScript',
    'TSX',
    'CSS',
    'JSON',
    'Markdown',
    'SQL',
    'YAML',
    'Shell',
    'Python',
    'Go',
    'Rust',
  ];
  if (lang && allowed.includes(lang as FileLanguage)) {
    return lang as FileLanguage;
  }
  // Basic fallbacks
  if (lang === 'JavaScript') return 'TypeScript'; // Close enough for mapping if missing JS
  return 'Markdown'; // Safe default fallback
}

// Ensure risk matches the expected type
function normalizeRisk(risk: string | undefined | null): 'low' | 'medium' | 'high' {
  if (risk === 'high' || risk === 'medium' || risk === 'low') {
    return risk;
  }
  return 'low';
}

export function backendToPlanetData(backendResponse: any): PlanetData {
  if (!backendResponse || !backendResponse.repository) {
    return { countries: [] };
  }

  const { repository, statistics, files: backendFiles = [], dependencies: backendDeps = [] } = backendResponse;

  // 1. Process files and map them into the `FileData` structure.
  // We'll also build dependency graphs here.
  const fileMap = new Map<string, FileData>();

  for (const bFile of backendFiles) {
    const isTest = Boolean(bFile.is_test);
    
    // Determine testStatus
    let testStatus: 'tested' | 'partial' | 'not detected' = 'not detected';
    if (isTest) {
      testStatus = 'tested';
    } else {
      // In a real app we'd cross reference with actual test coverage, 
      // for visualization we'll default to 'partial' if it has an activity score > 0.5, else 'not detected'
      testStatus = bFile.activity_score > 0.5 ? 'partial' : 'not detected';
    }

    const fileData: FileData = {
      id: bFile.id,
      name: bFile.name || bFile.id,
      path: bFile.path || bFile.id,
      language: normalizeLanguage(bFile.language),
      lines: bFile.line_count || 0,
      size: bFile.size_bytes || 0,
      changes: bFile.commit_count || 0,
      lastModified: bFile.last_modified || 'Unknown',
      risk: normalizeRisk(bFile.hotspot_category),
      isTest: isTest,
      imports: [],
      importedBy: [],
      contributors: bFile.commit_count || 1, // Approximation
      testStatus: testStatus,
    };

    fileMap.set(fileData.id, fileData);
  }

  // 2. Resolve dependencies
  for (const dep of backendDeps) {
    const source = fileMap.get(dep.source_file_id);
    const target = fileMap.get(dep.target_file_id);

    if (source && target) {
      if (!source.imports.includes(target.id)) {
        source.imports.push(target.id);
      }
      if (!target.importedBy.includes(source.id)) {
        target.importedBy.push(source.id);
      }
    }
  }

  // 3. Group Files into Buildings (Folders) -> Districts -> Cities
  // Backend provides `bFile.district` which we can map to DistrictData.
  // We'll group them: City (top-level) -> District (backend.district) -> Building (dirname)
  
  const citiesMap = new Map<string, Map<string, Map<string, FileData[]>>>();

  for (const bFile of backendFiles) {
    const file = fileMap.get(bFile.id);
    if (!file) continue;

    const pathParts = bFile.path.split('/');
    // e.g., "src/backend/auth/core/auth_service.py"
    // topLevel = "src" (City)
    // district = bFile.district ("src/backend")
    // building = dirname ("src/backend/auth/core")
    
    let topLevel = 'root';
    if (pathParts.length > 0) {
      topLevel = pathParts[0];
    }
    
    let districtName = bFile.district || topLevel;
    
    let buildingName = 'root';
    if (pathParts.length > 1) {
      // everything except the filename
      buildingName = pathParts.slice(0, -1).join('/');
    }

    if (!citiesMap.has(topLevel)) {
      citiesMap.set(topLevel, new Map());
    }
    const cityDistricts = citiesMap.get(topLevel)!;

    if (!cityDistricts.has(districtName)) {
      cityDistricts.set(districtName, new Map());
    }
    const districtBuildings = cityDistricts.get(districtName)!;

    if (!districtBuildings.has(buildingName)) {
      districtBuildings.set(buildingName, []);
    }
    districtBuildings.get(buildingName)!.push(file);
  }

  // 4. Construct the CityData array
  const cities: CityData[] = [];

  for (const [cityName, districtsMap] of citiesMap.entries()) {
    const districts: DistrictData[] = [];

    for (const [districtName, buildingsMap] of districtsMap.entries()) {
      const buildings: BuildingData[] = [];

      for (const [buildingName, files] of buildingsMap.entries()) {
        buildings.push({
          id: `bld-${buildingName.replace(/[^a-zA-Z0-9]/g, '-')}`,
          name: buildingName.split('/').pop() || buildingName,
          path: buildingName,
          files: files,
        });
      }

      districts.push({
        id: `dst-${districtName.replace(/[^a-zA-Z0-9]/g, '-')}`,
        name: districtName,
        path: districtName,
        buildings: buildings,
      });
    }

    // Determine City Type based on name heuristics
    let cityType: CityData['type'] = 'core';
    const cNameLower = cityName.toLowerCase();
    if (cNameLower.includes('front') || cNameLower.includes('web') || cNameLower.includes('ui')) cityType = 'frontend';
    else if (cNameLower.includes('back') || cNameLower.includes('api') || cNameLower.includes('server')) cityType = 'backend';
    else if (cNameLower.includes('db') || cNameLower.includes('data')) cityType = 'database';
    else if (cNameLower.includes('auth')) cityType = 'auth';
    else if (cNameLower.includes('test')) cityType = 'tests';
    else if (cNameLower.includes('doc')) cityType = 'docs';
    else if (cNameLower.includes('infra') || cNameLower.includes('deploy')) cityType = 'infra';
    else if (cNameLower.includes('shared') || cNameLower.includes('lib') || cNameLower.includes('common')) cityType = 'shared';


    cities.push({
      id: `city-${cityName.replace(/[^a-zA-Z0-9]/g, '-')}`,
      name: cityName,
      path: cityName,
      type: cityType,
      districts: districts,
    });
  }

  // 5. Construct CountryData
  const country: CountryData = {
    repositoryId: repository.id,
    name: repository.name,
    owner: repository.owner,
    description: repository.url, // No description from backend currently, using URL as fallback
    language: normalizeLanguage(statistics?.languages?.[0]),
    lat: Math.random() * 100 - 50, // Random placement
    lng: Math.random() * 180 - 90,
    stats: {
      files: statistics?.total_files || 0,
      folders: 0, // Not explicitly provided by backend stats
      loc: statistics?.total_lines || 0,
      contributors: 1, // Not explicitly provided
      commits: 1, // Not explicitly provided
      stars: 0,
      forks: 0,
    },
    cities: cities,
  };

  return {
    countries: [country],
  };
}
