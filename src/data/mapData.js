// Map data structure with POIs and zone connections
// In production, this would be stored in a database
export const mapData = {
  'Ancient_Crypt_Map.png': {
    pois: [
      // Example POI structure
      // {
      //   id: 'poi-1',
      //   x: 100, // Position on original image
      //   y: 200,
      //   name: 'Ancient Altar',
      //   description: 'A mysterious altar with strange markings',
      //   type: 'landmark' // landmark, quest, merchant, etc.
      // }
    ],
    connections: [
      // Example connection structure
      // {
      //   id: 'conn-1',
      //   x: 300,
      //   y: 400,
      //   targetMap: 'Deep_Dunes_Map.webp',
      //   label: 'To Deep Dunes'
      // }
    ]
  },
  'Deep_Dunes_Map.webp': {
    pois: [],
    connections: []
  },
  'Infested_Crypt_Map.png': {
    pois: [],
    connections: []
  },
  'Night_harbor_V2.webp': {
    pois: [],
    connections: []
  },
  'Shaded_Dunes_Map.webp': {
    pois: [],
    connections: []
  },
  'Sungreet_Strand_v2.jpg': {
    pois: [],
    connections: []
  },
  'TombOfTheLastWyrmsbaneIsometric.webp': {
    pois: [],
    connections: []
  },
  'WyrmsbaneCombined_v0.webp': {
    pois: [],
    connections: []
  },
  'Wyrmsbane_Tomb.webp': {
    pois: [],
    connections: []
  }
}

// Helper function to get map filename from path
export function getMapFilename(path) {
  return path.split('/').pop()
}

// Save map data to localStorage (temporary solution)
export function saveMapData() {
  localStorage.setItem('mapData', JSON.stringify(mapData))
}

// Load map data from localStorage
export function loadMapData() {
  const saved = localStorage.getItem('mapData')
  if (saved) {
    try {
      const parsed = JSON.parse(saved)
      Object.assign(mapData, parsed)
    } catch (e) {
      console.error('Failed to load saved map data:', e)
    }
  }
}

// Initialize by loading saved data
loadMapData()