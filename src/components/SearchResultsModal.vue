<template>
  <div v-if="visible" class="modal-overlay" @click.self="close">
    <div class="search-results-modal">
      <div class="modal-header">
        <h2>Search Results for "{{ searchText }}"</h2>
        <button @click="close" class="close-button">×</button>
      </div>
      
      <div class="tabs-container">
        <div class="tabs">
          <button 
            v-for="tab in tabs" 
            :key="tab.id"
            @click="activeTab = tab.id"
            :class="['tab', { active: activeTab === tab.id }]"
          >
            {{ tab.label }}
            <span class="count-badge" v-if="getResultCount(tab.id) > 0">
              {{ getResultCount(tab.id) }}
            </span>
          </button>
        </div>
        
        <div class="tab-content">
          <!-- Maps Tab -->
          <div v-if="activeTab === 'maps'" class="results-list">
            <div v-if="filteredMaps.length === 0" class="no-results">
              No maps found matching "{{ searchText }}"
            </div>
            
            <!-- Pagination Controls (Top) -->
            <div v-if="totalPages.maps > 1" class="pagination-controls top">
              <button @click="prevPage('maps')" :disabled="currentPage.maps === 1" class="pagination-btn">
                ← Previous
              </button>
              <span class="pagination-info">
                Page {{ currentPage.maps }} of {{ totalPages.maps }} ({{ filteredMaps.length }} results)
              </span>
              <button @click="nextPage('maps')" :disabled="currentPage.maps === totalPages.maps" class="pagination-btn">
                Next →
              </button>
            </div>
            
            <div 
              v-for="map in paginatedMaps" 
              :key="map.id"
              @click="navigateToMap(map)"
              class="result-item map-item"
            >
              <div class="result-icon">🗺️</div>
              <div class="result-info">
                <h3>{{ map.name }}</h3>
                <p class="result-meta">Map ID: {{ map.id }}</p>
              </div>
              <button 
                @click.stop="copyMapLink(map)"
                class="copy-link-button"
                title="Copy direct link"
              >
                🔗
              </button>
              <div class="result-action">→</div>
            </div>
            
            <!-- Pagination Controls (Bottom) -->
            <div v-if="totalPages.maps > 1" class="pagination-controls bottom">
              <button @click="prevPage('maps')" :disabled="currentPage.maps === 1" class="pagination-btn">
                ← Previous
              </button>
              <span class="pagination-info">
                Page {{ currentPage.maps }} of {{ totalPages.maps }}
              </span>
              <button @click="nextPage('maps')" :disabled="currentPage.maps === totalPages.maps" class="pagination-btn">
                Next →
              </button>
            </div>
          </div>
          
          <!-- Spawns Tab -->
          <div v-if="activeTab === 'spawns'" class="results-list">
            <div v-if="filteredSpawns.length === 0" class="no-results">
              No spawn points found matching "{{ searchText }}"
            </div>
            
            <!-- Pagination Controls (Top) -->
            <div v-if="totalPages.spawns > 1" class="pagination-controls top">
              <button @click="prevPage('spawns')" :disabled="currentPage.spawns === 1" class="pagination-btn">
                ← Previous
              </button>
              <span class="pagination-info">
                Page {{ currentPage.spawns }} of {{ totalPages.spawns }} ({{ filteredSpawns.length }} results)
              </span>
              <button @click="nextPage('spawns')" :disabled="currentPage.spawns === totalPages.spawns" class="pagination-btn">
                Next →
              </button>
            </div>
            
            <div 
              v-for="spawn in paginatedSpawns" 
              :key="`spawn-${spawn.id}`"
              @click="navigateToSpawn(spawn)"
              class="result-item spawn-item"
            >
              <div class="result-icon">
                <!-- Handle different icon types -->
                <template v-if="spawn.icon">
                  <!-- Emoji icon -->
                  <span v-if="spawn.icon_type === 'emoji' || (!spawn.icon_type && spawn.icon)">
                    {{ spawn.icon }}
                  </span>
                  <!-- Image URL -->
                  <img v-else-if="!spawn.icon_type || spawn.icon_type === 'url'" 
                       :src="spawn.icon" 
                       :alt="spawn.name" 
                       class="spawn-icon" 
                       @error="(e) => e.target.style.display = 'none'" />
                </template>
                <!-- Fallback to type icon if available -->
                <template v-else-if="spawn.type_icon_value">
                  <span v-if="spawn.type_icon_type === 'emoji'">{{ spawn.type_icon_value }}</span>
                  <img v-else :src="spawn.type_icon_value" :alt="spawn.name" class="spawn-icon" @error="(e) => e.target.style.display = 'none'" />
                </template>
                <!-- Default icon -->
                <span v-else>📍</span>
              </div>
              <div class="result-info">
                <h3>{{ spawn.name }}</h3>
                <p class="result-meta">
                  <span v-if="spawn.map_name">{{ spawn.map_name }}</span>
                  <span v-if="spawn.level"> • Level {{ spawn.level }}</span>
                </p>
              </div>
              <button 
                @click.stop="copySpawnLink(spawn)"
                class="copy-link-button"
                title="Copy direct link"
              >
                🔗
              </button>
              <div class="result-action">→</div>
            </div>
            
            <!-- Pagination Controls (Bottom) -->
            <div v-if="totalPages.spawns > 1" class="pagination-controls bottom">
              <button @click="prevPage('spawns')" :disabled="currentPage.spawns === 1" class="pagination-btn">
                ← Previous
              </button>
              <span class="pagination-info">
                Page {{ currentPage.spawns }} of {{ totalPages.spawns }}
              </span>
              <button @click="nextPage('spawns')" :disabled="currentPage.spawns === totalPages.spawns" class="pagination-btn">
                Next →
              </button>
            </div>
          </div>
          
          <!-- NPCs Tab -->
          <div v-if="activeTab === 'npcs'" class="results-list">
            <div v-if="filteredNPCs.length === 0" class="no-results">
              No NPCs found matching "{{ searchText }}"
            </div>
            
            <!-- Pagination Controls (Top) -->
            <div v-if="totalPages.npcs > 1" class="pagination-controls top">
              <button @click="prevPage('npcs')" :disabled="currentPage.npcs === 1" class="pagination-btn">
                ← Previous
              </button>
              <span class="pagination-info">
                Page {{ currentPage.npcs }} of {{ totalPages.npcs }} ({{ filteredNPCs.length }} results)
              </span>
              <button @click="nextPage('npcs')" :disabled="currentPage.npcs === totalPages.npcs" class="pagination-btn">
                Next →
              </button>
            </div>
            
            <div 
              v-for="npc in paginatedNPCs" 
              :key="`npc-${npc.id}`"
              @click="navigateToNPC(npc)"
              class="result-item npc-item"
            >
              <div class="result-icon">
                <!-- Handle different icon types -->
                <template v-if="npc.icon_value || npc.icon">
                  <!-- Emoji icon -->
                  <span v-if="npc.icon_type === 'emoji' || (!npc.icon_type && npc.icon)">
                    {{ npc.icon_value || npc.icon }}
                  </span>
                  <!-- Image URL -->
                  <img v-else-if="!npc.icon_type || npc.icon_type === 'url'" 
                       :src="npc.icon_value || npc.icon" 
                       :alt="npc.name" 
                       class="npc-icon" 
                       @error="(e) => e.target.style.display = 'none'" />
                </template>
                <!-- Fallback to type icon if available -->
                <template v-else-if="npc.type_icon_value">
                  <span v-if="npc.type_icon_type === 'emoji'">{{ npc.type_icon_value }}</span>
                  <img v-else :src="npc.type_icon_value" :alt="npc.name" class="npc-icon" @error="(e) => e.target.style.display = 'none'" />
                </template>
                <!-- Default icon -->
                <span v-else>👤</span>
              </div>
              <div class="result-info">
                <h3>{{ npc.name }}</h3>
                <p class="result-meta">
                  <span v-if="npc.map_name">{{ npc.map_name }}</span>
                  <span v-if="npc.poi_name"> • {{ npc.poi_name }}</span>
                  <span v-if="npc.level"> • Level {{ npc.level }}</span>
                </p>
              </div>
              <button 
                @click.stop="copyNPCLink(npc)"
                class="copy-link-button"
                title="Copy direct link"
              >
                🔗
              </button>
              <div class="result-action">→</div>
            </div>
            
            <!-- Pagination Controls (Bottom) -->
            <div v-if="totalPages.npcs > 1" class="pagination-controls bottom">
              <button @click="prevPage('npcs')" :disabled="currentPage.npcs === 1" class="pagination-btn">
                ← Previous
              </button>
              <span class="pagination-info">
                Page {{ currentPage.npcs }} of {{ totalPages.npcs }}
              </span>
              <button @click="nextPage('npcs')" :disabled="currentPage.npcs === totalPages.npcs" class="pagination-btn">
                Next →
              </button>
            </div>
          </div>
          
          <!-- Items Tab -->
          <div v-if="activeTab === 'items'" class="results-list">
            <div v-if="filteredItems.length === 0" class="no-results">
              No items found matching "{{ searchText }}"
            </div>
            
            <!-- Pagination Controls (Top) -->
            <div v-if="totalPages.items > 1" class="pagination-controls top">
              <button @click="prevPage('items')" :disabled="currentPage.items === 1" class="pagination-btn">
                ← Previous
              </button>
              <span class="pagination-info">
                Page {{ currentPage.items }} of {{ totalPages.items }} ({{ filteredItems.length }} results)
              </span>
              <button @click="nextPage('items')" :disabled="currentPage.items === totalPages.items" class="pagination-btn">
                Next →
              </button>
            </div>
            
            <div 
              v-for="item in paginatedItems" 
              :key="`item-${item.id}`"
              @click="showItemInfo(item)"
              class="result-item item-item"
            >
              <div class="result-icon">
                <!-- Handle different icon types for items -->
                <template v-if="item.icon">
                  <!-- Check if it's an emoji (short string without slashes) -->
                  <span v-if="item.icon.length <= 4 && !item.icon.includes('/')">
                    {{ item.icon }}
                  </span>
                  <!-- Otherwise treat as image URL -->
                  <img v-else 
                       :src="item.icon" 
                       :alt="item.name" 
                       class="item-icon" 
                       @error="(e) => e.target.style.display = 'none'" />
                </template>
                <!-- Default icon -->
                <span v-else>📦</span>
              </div>
              <div class="result-info">
                <h3>{{ item.name }}</h3>
                <p class="result-meta">
                  <span v-if="item.type">{{ item.type }}</span>
                  <span v-if="item.slot"> • {{ item.slot }}</span>
                  <span v-if="item.level"> • Level {{ item.level }}</span>
                </p>
              </div>
              <button 
                @click.stop="copyItemLink(item)"
                class="copy-link-button"
                title="Copy direct link"
              >
                🔗
              </button>
              <div class="result-action">ℹ️</div>
            </div>
            
            <!-- Pagination Controls (Bottom) -->
            <div v-if="totalPages.items > 1" class="pagination-controls bottom">
              <button @click="prevPage('items')" :disabled="currentPage.items === 1" class="pagination-btn">
                ← Previous
              </button>
              <span class="pagination-info">
                Page {{ currentPage.items }} of {{ totalPages.items }}
              </span>
              <button @click="nextPage('items')" :disabled="currentPage.items === totalPages.items" class="pagination-btn">
                Next →
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <div class="modal-footer">
        <p class="search-hint">
          Click on any result to navigate or view details
        </p>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch } from 'vue'

export default {
  name: 'SearchResultsModal',
  props: {
    visible: {
      type: Boolean,
      default: false
    },
    searchText: {
      type: String,
      default: ''
    },
    maps: {
      type: Array,
      default: () => []
    },
    pois: {
      type: Array,
      default: () => []
    },
    npcs: {
      type: Array,
      default: () => []
    },
    items: {
      type: Array,
      default: () => []
    }
  },
  emits: ['close', 'navigate-to-map', 'navigate-to-poi', 'show-item-info', 'show-npc-info'],
  setup(props, { emit }) {
    const activeTab = ref('maps')
    
    const tabs = [
      { id: 'maps', label: 'Maps' },
      { id: 'spawns', label: 'Spawns' },
      { id: 'npcs', label: 'NPCs' },
      { id: 'items', label: 'Items' }
    ]
    
    // Pagination state
    const currentPage = ref({
      maps: 1,
      spawns: 1,
      npcs: 1,
      items: 1
    })
    const itemsPerPage = 20
    
    // Filter maps based on search text
    const filteredMaps = computed(() => {
      if (!props.searchText) return props.maps
      const searchLower = props.searchText.toLowerCase()
      return props.maps.filter(map => 
        map.name.toLowerCase().includes(searchLower)
      )
    })
    
    // Helper function to determine if a POI represents a specific NPC (has NPC ID)
    const isSpecificNPC = (poi) => {
      // NPCs are entries in the NPC table with NPC IDs
      // A POI represents a specific NPC if it has an npc_id or npc_ids
      
      // Has a single NPC ID - this is a specific NPC
      if (poi.npc_id) {
        return true
      }
      
      // Has NPC IDs array - this could be a specific NPC or a spawn with multiple NPCs
      if (poi.npc_ids && Array.isArray(poi.npc_ids) && poi.npc_ids.length > 0) {
        return true
      }
      
      // Everything else (Boss POIs, Minion POIs, spawn points, zones, etc.) goes to Spawns tab
      return false
    }
    
    // Filter Spawns from POIs (generic spawn points, NOT specific NPCs)
    const filteredSpawns = computed(() => {
      if (!props.searchText) return []
      const searchLower = props.searchText.toLowerCase()
      
      return props.pois.filter(poi => {
        // First check if it matches search
        const poiName = (poi.name || '').toLowerCase()
        const description = (poi.description || '').toLowerCase()
        const matches = poiName.includes(searchLower) || description.includes(searchLower)
        
        if (!matches) return false
        
        // If it's a specific unique NPC, it goes in NPC tab, not here
        return !isSpecificNPC(poi)
      }).map(poi => {
        // Get map name
        const map = props.maps.find(m => m.id === poi.map_id)
        
        return {
          id: poi.id,
          name: poi.name,
          poi_name: poi.name,
          map_id: poi.map_id,
          map_name: map ? map.name : 'Unknown Map',
          x: poi.x,
          y: poi.y,
          icon: poi.icon_value || poi.icon,
          icon_type: poi.icon_type,
          level: poi.level,
          type_icon_value: poi.type_icon_value,
          type_icon_type: poi.type_icon_type
        }
      })
    })
    
    // Filter NPCs from the actual NPC database table
    const filteredNPCs = computed(() => {
      if (!props.searchText) return []
      const searchLower = props.searchText.toLowerCase()
      
      console.log('Searching NPCs:', props.npcs.length, 'total NPCs, search term:', searchLower)
      
      // Search actual NPCs from the database
      const filtered = props.npcs.filter(npc => {
        const npcName = (npc.name || '').toLowerCase()
        const npcDescription = (npc.description || '').toLowerCase()
        
        return npcName.includes(searchLower) || npcDescription.includes(searchLower)
      }).map(npc => ({
        id: npc.id,
        npcid: npc.npcid,
        name: npc.name,
        description: npc.description,
        level: npc.level,
        hp: npc.hp,
        ac: npc.ac,
        npc_type: npc.npc_type,
        // These are for display
        icon: '👤', // Default NPC icon
        icon_type: 'emoji',
        icon_value: '👤',
        // We don't have map info for NPCs from the database
        map_id: null,
        map_name: 'Various Locations',
        // Store the NPC for navigation
        npc: npc
      }))
      
      console.log('Filtered NPCs:', filtered.length, 'matches found')
      return filtered
    })
    
    // Filter items based on search text
    const filteredItems = computed(() => {
      if (!props.searchText) return []
      const searchLower = props.searchText.toLowerCase()
      
      return props.items.filter(item => {
        const itemName = (item.name || '').toLowerCase()
        const itemType = (item.type || '').toLowerCase()
        const itemSlot = (item.slot || '').toLowerCase()
        const itemDescription = (item.description || '').toLowerCase()
        
        return itemName.includes(searchLower) || 
               itemType.includes(searchLower) || 
               itemSlot.includes(searchLower) ||
               itemDescription.includes(searchLower)
      })
    })
    
    // Get result count for tab badges
    const getResultCount = (tabId) => {
      switch(tabId) {
        case 'maps': return filteredMaps.value.length
        case 'spawns': return filteredSpawns.value.length
        case 'npcs': return filteredNPCs.value.length
        case 'items': return filteredItems.value.length
        default: return 0
      }
    }
    
    // Paginated results
    const paginatedMaps = computed(() => {
      const start = (currentPage.value.maps - 1) * itemsPerPage
      const end = start + itemsPerPage
      return filteredMaps.value.slice(start, end)
    })
    
    const paginatedSpawns = computed(() => {
      const start = (currentPage.value.spawns - 1) * itemsPerPage
      const end = start + itemsPerPage
      return filteredSpawns.value.slice(start, end)
    })
    
    const paginatedNPCs = computed(() => {
      const start = (currentPage.value.npcs - 1) * itemsPerPage
      const end = start + itemsPerPage
      return filteredNPCs.value.slice(start, end)
    })
    
    const paginatedItems = computed(() => {
      const start = (currentPage.value.items - 1) * itemsPerPage
      const end = start + itemsPerPage
      return filteredItems.value.slice(start, end)
    })
    
    // Total pages for each tab
    const totalPages = computed(() => ({
      maps: Math.ceil(filteredMaps.value.length / itemsPerPage),
      spawns: Math.ceil(filteredSpawns.value.length / itemsPerPage),
      npcs: Math.ceil(filteredNPCs.value.length / itemsPerPage),
      items: Math.ceil(filteredItems.value.length / itemsPerPage)
    }))
    
    // Pagination controls
    const changePage = (tab, page) => {
      if (page >= 1 && page <= totalPages.value[tab]) {
        currentPage.value[tab] = page
      }
    }
    
    const nextPage = (tab) => {
      changePage(tab, currentPage.value[tab] + 1)
    }
    
    const prevPage = (tab) => {
      changePage(tab, currentPage.value[tab] - 1)
    }
    
    // Reset pagination when search text changes
    watch(() => props.searchText, () => {
      currentPage.value = {
        maps: 1,
        spawns: 1,
        npcs: 1,
        items: 1
      }
    })
    
    // Auto-switch to tab with results when search changes
    watch(() => props.searchText, () => {
      // Find first tab with results
      if (filteredMaps.value.length > 0) {
        activeTab.value = 'maps'
      } else if (filteredNPCs.value.length > 0) {
        activeTab.value = 'npcs'
      } else if (filteredItems.value.length > 0) {
        activeTab.value = 'items'
      }
    })
    
    // Navigation handlers
    const navigateToMap = (map) => {
      emit('navigate-to-map', map)
      emit('close')
    }
    
    const navigateToSpawn = (spawn) => {
      emit('navigate-to-poi', spawn)
      emit('close')
    }
    
    const navigateToNPC = (npc) => {
      // If this NPC has a POI reference, navigate to it
      if (npc.poi) {
        emit('navigate-to-poi', npc.poi)
      } else {
        // For NPCs from the database, show NPC info modal
        emit('show-npc-info', npc.npc || npc)
      }
      emit('close')
    }
    
    const showItemInfo = (item) => {
      emit('show-item-info', item)
      emit('close')
    }
    
    const close = () => {
      emit('close')
    }
    
    // Copy link functions
    const copyMapLink = async (map) => {
      const link = `${window.location.origin}/map/${map.id}`
      await copyToClipboard(link)
      showCopyToast('Map link copied to clipboard!')
    }
    
    const copySpawnLink = async (spawn) => {
      const link = `${window.location.origin}/map/${spawn.map_id}/poi/${spawn.id}`
      await copyToClipboard(link)
      showCopyToast('Spawn link copied to clipboard!')
    }
    
    const copyNPCLink = async (npc) => {
      const link = `${window.location.origin}/map/${npc.map_id}/poi/${npc.id}`
      await copyToClipboard(link)
      showCopyToast('NPC link copied to clipboard!')
    }
    
    const copyItemLink = async (item) => {
      // For items, we'll create a search link since they don't have dedicated pages
      const link = `${window.location.origin}/search/${encodeURIComponent(item.name)}`
      await copyToClipboard(link)
      showCopyToast('Item search link copied to clipboard!')
    }
    
    const copyToClipboard = async (text) => {
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(text)
        } else {
          // Fallback for older browsers
          const textArea = document.createElement('textarea')
          textArea.value = text
          textArea.style.position = 'fixed'
          textArea.style.left = '-999999px'
          textArea.style.top = '-999999px'
          document.body.appendChild(textArea)
          textArea.focus()
          textArea.select()
          document.execCommand('copy')
          textArea.remove()
        }
      } catch (err) {
        console.error('Failed to copy:', err)
      }
    }
    
    const showCopyToast = (message) => {
      // Create a simple toast notification
      const toast = document.createElement('div')
      toast.className = 'copy-toast'
      toast.textContent = message
      document.body.appendChild(toast)
      
      // Trigger animation
      setTimeout(() => toast.classList.add('show'), 10)
      
      // Remove after 3 seconds
      setTimeout(() => {
        toast.classList.remove('show')
        setTimeout(() => toast.remove(), 300)
      }, 3000)
    }
    
    return {
      activeTab,
      tabs,
      filteredMaps,
      filteredSpawns,
      filteredNPCs,
      filteredItems,
      paginatedMaps,
      paginatedSpawns,
      paginatedNPCs,
      paginatedItems,
      currentPage,
      totalPages,
      getResultCount,
      changePage,
      nextPage,
      prevPage,
      navigateToMap,
      navigateToSpawn,
      navigateToNPC,
      showItemInfo,
      copyMapLink,
      copySpawnLink,
      copyNPCLink,
      copyItemLink,
      close
    }
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10000;
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.search-results-modal {
  background: #2C1810;
  border: 2px solid #8B4513;
  border-radius: 12px;
  width: 90%;
  max-width: 800px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.modal-header {
  padding: 20px;
  border-bottom: 1px solid #8B4513;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h2 {
  color: #FFD700;
  margin: 0;
  font-size: 24px;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
}

.close-button {
  background: none;
  border: none;
  color: #FFD700;
  font-size: 32px;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s;
}

.close-button:hover {
  transform: scale(1.2);
}

.tabs-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.tabs {
  display: flex;
  padding: 0 20px;
  background: rgba(0, 0, 0, 0.3);
  border-bottom: 1px solid #8B4513;
}

.tab {
  background: none;
  border: none;
  color: #D2691E;
  padding: 15px 20px;
  cursor: pointer;
  font-size: 16px;
  font-weight: bold;
  position: relative;
  transition: all 0.3s;
  display: flex;
  align-items: center;
  gap: 8px;
}

.tab:hover {
  color: #FFD700;
}

.tab.active {
  color: #FFD700;
  background: rgba(255, 215, 0, 0.1);
}

.tab.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: #FFD700;
}

.count-badge {
  background: rgba(255, 215, 0, 0.2);
  color: #FFD700;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: bold;
}

.tab-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.results-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.no-results {
  text-align: center;
  color: #8B7355;
  padding: 40px;
  font-style: italic;
}

/* Pagination Controls */
.pagination-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 6px;
  margin-bottom: 12px;
}

.pagination-controls.bottom {
  margin-bottom: 0;
  margin-top: 12px;
}

.pagination-btn {
  background: #8B4513;
  color: #FFD700;
  border: 1px solid #A0522D;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
}

.pagination-btn:hover:not(:disabled) {
  background: #A0522D;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.pagination-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pagination-info {
  color: #D4A574;
  font-size: 0.9rem;
  font-weight: 500;
}

.result-item {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid #8B4513;
  border-radius: 8px;
  padding: 15px;
  display: flex;
  align-items: center;
  gap: 15px;
  cursor: pointer;
  transition: all 0.3s;
}

.result-item:hover {
  background: rgba(255, 215, 0, 0.1);
  border-color: #FFD700;
  transform: translateX(5px);
}

.result-icon {
  font-size: 32px;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.result-icon span {
  font-size: 32px;
  line-height: 1;
}

.npc-icon, .item-icon {
  width: 48px;
  height: 48px;
  object-fit: contain;
  image-rendering: pixelated;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
  padding: 4px;
}

.result-info {
  flex: 1;
  min-width: 0;
}

.result-info h3 {
  color: #FFD700;
  margin: 0 0 5px 0;
  font-size: 18px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.result-meta {
  color: #D2691E;
  margin: 0;
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.result-action {
  color: #FFD700;
  font-size: 24px;
  opacity: 0.5;
  transition: opacity 0.3s;
}

.result-item:hover .result-action {
  opacity: 1;
}

.copy-link-button {
  background: rgba(255, 215, 0, 0.1);
  border: 1px solid #8B4513;
  border-radius: 6px;
  color: #FFD700;
  padding: 8px 12px;
  cursor: pointer;
  font-size: 18px;
  transition: all 0.3s;
  flex-shrink: 0;
}

.copy-link-button:hover {
  background: rgba(255, 215, 0, 0.2);
  border-color: #FFD700;
  transform: scale(1.1);
}

.copy-link-button:active {
  transform: scale(0.95);
}

.modal-footer {
  padding: 15px 20px;
  border-top: 1px solid #8B4513;
  background: rgba(0, 0, 0, 0.3);
}

.search-hint {
  color: #8B7355;
  margin: 0;
  text-align: center;
  font-size: 14px;
  font-style: italic;
}

/* Scrollbar styling */
.tab-content::-webkit-scrollbar {
  width: 8px;
}

.tab-content::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 4px;
}

.tab-content::-webkit-scrollbar-thumb {
  background: #8B4513;
  border-radius: 4px;
}

.tab-content::-webkit-scrollbar-thumb:hover {
  background: #A0522D;
}
</style>

<style>
/* Global styles for toast notification */
.copy-toast {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%) translateY(100px);
  background: #2C1810;
  border: 2px solid #FFD700;
  border-radius: 8px;
  color: #FFD700;
  padding: 12px 24px;
  font-size: 16px;
  font-weight: bold;
  z-index: 100000;
  opacity: 0;
  transition: all 0.3s ease-out;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
}

.copy-toast.show {
  transform: translateX(-50%) translateY(0);
  opacity: 1;
}
</style>