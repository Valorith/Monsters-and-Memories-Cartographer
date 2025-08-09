<template>
  <div v-if="visible" class="dialog-backdrop" @click="handleBackdropClick">
    <div class="dialog-container" @click.stop>
      <div class="dialog-header">
        <h2>Add NPC to {{ poi?.name }}</h2>
        <button class="close-button" @click="$emit('close')">×</button>
      </div>
      
      <div class="dialog-body">
        <div class="search-section">
          <div class="search-input-wrapper">
            <span class="search-icon">🔍</span>
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search NPCs by name..."
              class="search-input"
              @input="performSearch"
              ref="searchInput"
            >
            <button v-if="searchQuery" @click="clearSearch" class="clear-button">×</button>
          </div>
        </div>

        <div v-if="loading" class="loading-state">
          <div class="spinner"></div>
          <p>Loading NPCs...</p>
        </div>

        <div v-else-if="error" class="error-state">
          <p>{{ error }}</p>
          <button @click="loadNPCs" class="retry-button">Retry</button>
        </div>

        <div v-else-if="filteredNPCs.length === 0 && searchQuery" class="empty-state">
          <p>No NPCs found matching "{{ searchQuery }}"</p>
        </div>

        <div v-else-if="filteredNPCs.length === 0" class="empty-state">
          <p>No NPCs available</p>
        </div>

        <div v-else class="npcs-grid">
          <div
            v-for="npc in paginatedNPCs"
            :key="npc.npcid"
            class="npc-card"
            @click="selectNPC(npc)"
            :class="{ 'already-added': isAlreadyAdded(npc.npcid) }"
          >
            <div class="npc-icon">💀</div>
            <div class="npc-info">
              <h3 class="npc-name">{{ npc.name }}</h3>
              <div class="npc-details">
                <span class="npc-level">Level {{ npc.level }}</span>
                <span class="npc-hp">HP: {{ npc.hp }}</span>
              </div>
              <div class="npc-stats">
                <span class="npc-damage">DMG: {{ npc.min_dmg }}-{{ npc.max_dmg }}</span>
                <span class="npc-ac">AC: {{ npc.ac }}</span>
              </div>
              <div v-if="isAlreadyAdded(npc.npcid)" class="already-added-indicator">
                <span class="added-icon">✓</span>
                Already added
              </div>
            </div>
          </div>
        </div>

        <div v-if="totalPages > 1" class="pagination">
          <button
            @click="currentPage--"
            :disabled="currentPage === 0"
            class="pagination-button"
          >
            Previous
          </button>
          <span class="pagination-info">
            Page {{ currentPage + 1 }} of {{ totalPages }}
          </span>
          <button
            @click="currentPage++"
            :disabled="currentPage >= totalPages - 1"
            class="pagination-button"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch, nextTick } from 'vue'
import { useToast } from '../composables/useToast'
import { useCSRF } from '../composables/useCSRF'

export default {
  name: 'AddNPCDialog',
  props: {
    visible: {
      type: Boolean,
      default: false
    },
    poi: {
      type: Object,
      default: null
    }
  },
  emits: ['close', 'npc-added'],
  setup(props, { emit }) {
    const { success, error } = useToast()
    const { fetchWithCSRF } = useCSRF()
    
    const searchQuery = ref('')
    const npcs = ref([])
    const existingNPCs = ref([])
    const loading = ref(false)
    const errorMessage = ref('')
    const currentPage = ref(0)
    const itemsPerPage = 20
    const searchInput = ref(null)
    
    // Computed properties
    const filteredNPCs = computed(() => {
      if (!searchQuery.value) return npcs.value
      
      const query = searchQuery.value.toLowerCase()
      return npcs.value.filter(npc => 
        npc.name.toLowerCase().includes(query)
      )
    })
    
    const paginatedNPCs = computed(() => {
      const start = currentPage.value * itemsPerPage
      const end = start + itemsPerPage
      return filteredNPCs.value.slice(start, end)
    })
    
    const totalPages = computed(() => {
      return Math.ceil(filteredNPCs.value.length / itemsPerPage)
    })
    
    // Methods
    const loadNPCs = async () => {
      loading.value = true
      errorMessage.value = ''
      
      try {
        const response = await fetch('/api/npcs')
        if (!response.ok) throw new Error('Failed to load NPCs')
        
        npcs.value = await response.json()
      } catch (err) {
        console.error('Error loading NPCs:', err)
        errorMessage.value = 'Failed to load NPCs. Please try again.'
      } finally {
        loading.value = false
      }
    }
    
    const loadExistingNPCs = async () => {
      if (!props.poi?.id) return
      
      try {
        const response = await fetch(`/api/pois/${props.poi.id}/npcs`)
        if (!response.ok) throw new Error('Failed to load existing NPCs')
        
        existingNPCs.value = await response.json()
      } catch (err) {
        console.error('Error loading existing NPCs:', err)
      }
    }
    
    const isAlreadyAdded = (npcId) => {
      return existingNPCs.value.some(npc => npc.npcid === npcId)
    }
    
    const selectNPC = async (npc) => {
      if (isAlreadyAdded(npc.npcid)) {
        error('This NPC is already added to this POI')
        return
      }
      
      try {
        const response = await fetchWithCSRF(`/api/pois/${props.poi.id}/npcs`, {
          method: 'POST',
          body: { npc_id: npc.npcid }
        })
        
        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Failed to add NPC')
        }
        
        const data = await response.json()
        
        // Check if it was a proposal or direct addition
        if (data.proposal_id) {
          success(`Proposal to add ${npc.name} to ${props.poi.name} has been created`)
        } else {
          success(`Added ${npc.name} to ${props.poi.name}`)
        }
        
        emit('npc-added', npc)
        emit('close')
      } catch (err) {
        console.error('Error adding NPC:', err)
        error(err.message || 'Failed to add NPC')
      }
    }
    
    const performSearch = () => {
      currentPage.value = 0
    }
    
    const clearSearch = () => {
      searchQuery.value = ''
      currentPage.value = 0
    }
    
    const handleBackdropClick = (e) => {
      if (e.target === e.currentTarget) {
        emit('close')
      }
    }
    
    // Watchers
    watch(() => props.visible, async (newVal) => {
      if (newVal) {
        await loadNPCs()
        await loadExistingNPCs()
        searchQuery.value = ''
        currentPage.value = 0
        nextTick(() => {
          searchInput.value?.focus()
        })
      }
    })
    
    return {
      searchQuery,
      npcs,
      loading,
      error: errorMessage,
      currentPage,
      searchInput,
      filteredNPCs,
      paginatedNPCs,
      totalPages,
      loadNPCs,
      isAlreadyAdded,
      selectNPC,
      performSearch,
      clearSearch,
      handleBackdropClick
    }
  }
}
</script>

<style scoped>
.dialog-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.dialog-container {
  background: #2C1810;
  border: 2px solid #8B4513;
  border-radius: 12px;
  width: 90%;
  max-width: 800px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #8B4513;
}

.dialog-header h2 {
  margin: 0;
  color: #FFD700;
  font-size: 1.5rem;
}

.close-button {
  background: none;
  border: none;
  color: #999;
  font-size: 2rem;
  cursor: pointer;
  padding: 0;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s;
}

.close-button:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.dialog-body {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
}

.search-section {
  margin-bottom: 1.5rem;
}

.search-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 0.75rem 1rem;
  transition: all 0.2s;
}

.search-input-wrapper:focus-within {
  border-color: #FFD700;
  background: rgba(255, 255, 255, 0.08);
}

.search-icon {
  margin-right: 0.5rem;
  font-size: 1.2rem;
}

.search-input {
  flex: 1;
  background: none;
  border: none;
  color: #fff;
  font-size: 1rem;
  outline: none;
}

.search-input::placeholder {
  color: #999;
}

.clear-button {
  background: none;
  border: none;
  color: #999;
  font-size: 1.2rem;
  cursor: pointer;
  padding: 0.25rem;
  margin-left: 0.5rem;
  border-radius: 50%;
  transition: all 0.2s;
}

.clear-button:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.loading-state,
.error-state,
.empty-state {
  text-align: center;
  padding: 3rem;
  color: #999;
}

.spinner {
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top-color: #FFD700;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
  margin: 0 auto 1rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.retry-button {
  background: #8B4513;
  color: #fff;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.retry-button:hover {
  background: #A0522D;
  transform: translateY(-1px);
}

.npcs-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.npc-card {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 1rem;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  gap: 1rem;
}

.npc-card:hover:not(.already-added) {
  background: rgba(255, 255, 255, 0.08);
  border-color: #FFD700;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.npc-card.already-added {
  opacity: 0.6;
  cursor: not-allowed;
}

.npc-icon {
  font-size: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.npc-info {
  flex: 1;
}

.npc-name {
  margin: 0 0 0.5rem 0;
  color: #fff;
  font-size: 1.1rem;
}

.npc-details {
  display: flex;
  gap: 1rem;
  margin-bottom: 0.25rem;
  font-size: 0.9rem;
  color: #ccc;
}

.npc-stats {
  display: flex;
  gap: 1rem;
  font-size: 0.85rem;
  color: #999;
}

.already-added-indicator {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  margin-top: 0.5rem;
  color: #4CAF50;
  font-size: 0.85rem;
}

.added-icon {
  font-size: 1rem;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  margin-top: 2rem;
}

.pagination-button {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #fff;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.pagination-button:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
  border-color: #FFD700;
}

.pagination-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pagination-info {
  color: #999;
  font-size: 0.9rem;
}
</style>