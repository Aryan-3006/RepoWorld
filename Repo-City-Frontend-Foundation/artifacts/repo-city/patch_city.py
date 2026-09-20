import re

with open('src/components/three/engine/CityGenerator.ts', 'r') as f:
    content = f.read()

# Remove appendRoadQuad, roads, buildRoadMesh
content = re.sub(r'this\.appendRoadQuad.*?\n', '', content)
content = re.sub(r'roads:\s*THREE\.Mesh;', '', content)
content = re.sub(r'const roadPositions: number\[\] = \[\];\n\s*const roadNormals:\s*number\[\] = \[\];', '', content)
content = re.sub(r'const roads = this\.buildRoadMesh\(roadPositions, roadNormals\);', '', content)
content = re.sub(r'return \{ cityLabels, cityMarkers, floorMeshes, roads \};', 'return { cityLabels, cityMarkers, floorMeshes };', content)
content = re.sub(r'private buildRoadMesh.*?\n  }\n', '', content, flags=re.DOTALL)
content = re.sub(r'private appendRoadQuad.*?\n  }\n', '', content, flags=re.DOTALL)

with open('src/components/three/engine/CityGenerator.ts', 'w') as f:
    f.write(content)
