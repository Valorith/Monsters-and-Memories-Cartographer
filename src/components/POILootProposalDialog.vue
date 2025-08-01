<template>
  <div v-if="visible" class="modal-overlay" @click.self="handleClose">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h2>Change NPC Loot</h2>
        <button class="close-btn" @click="handleClose">×</button>
      </div>
      
      <div class="modal-body">
        <div v-if="poi && poi.name" class="poi-info">
          <h3>{{ poi.name }}</h3>
          <p v-if="poi.description" class="poi-description">{{ poi.description }}</p>
          <div class="poi-details">
            <span class="detail-item">
              <span class="icon">{{ poi.icon || poi.icon_value || '📍' }}</span>
              {{ poi.type_name || 'Point of Interest' }}
            </span>
            <span v-if="poi.npc_name" class="detail-item">
              <span class="icon">⚔️</span>
              {{ poi.npc_name }} (Level {{ poi.npc_level || '?' }})
            </span>
          </div>
        </div>
        
        <div v-if="poi && (!poi.npc_id || !isValidCombatNPC)" class="warning-box">
          <span class="warning-icon">⚠️</span>
          <div class="warning-content">
            <p class="warning-title">Invalid POI Type</p>
            <p class="warning-text">This POI does not have a Combat NPC associated with it. Only Combat NPCs can have loot items.</p>
          </div>
        </div>
        
        <form v-else @submit.prevent="submitProposal" class="proposal-form">
          <div class="form-group">
            <label>Current Loot Items</label>
            <div v-if="isLoadingCurrentLoot" class="loading-message">
              Loading current loot...
            </div>
            <div v-else-if="currentLootItems.length === 0" class="no-current-loot">
              This NPC currently has no loot items.
            </div>
            <div v-else class="current-loot-list">
              <div class="info-text">These items are currently assigned to this NPC. They will remain unless you remove them.</div>
            </div>
          </div>
          
          <div class="form-group">
            <label for="item-search">Search for items to add or remove</label>
            <input 
              id="item-search"
              v-model="searchQuery" 
              type="text" 
              class="form-control search-input"
              placeholder="Search items by name..."
            />
          </div>
          
          <div class="items-section">
            <div class="available-items">
              <h4>Available Items</h4>
              <div class="items-list">
                <div 
                  v-for="item in filteredItems" 
                  :key="item.id"
                  class="item-card"
                  :class="{ selected: isItemSelected(item.id) }"
                  @click="toggleItem(item)"
                >
                  <span class="item-icon">{{ item.icon_value || '📦' }}</span>
                  <div class="item-info">
                    <span class="item-name">{{ item.name }}</span>
                    <span class="item-type">{{ item.item_type }}</span>
                  </div>
                  <button 
                    type="button"
                    class="add-btn"
                    :class="{ active: isItemSelected(item.id) }"
                  >
                    {{ isItemSelected(item.id) ? '✓' : '+' }}
                  </button>
                </div>
                <div v-if="filteredItems.length === 0" class="no-items">
                  {{ searchQuery ? 'No items found matching your search' : 'Loading items...' }}
                </div>
              </div>
            </div>
            
            <div class="selected-items">
              <h4>Proposed Loot Items ({{ selectedItems.length }})</h4>
              <div class="selected-list">
                <div 
                  v-for="selectedItem in selectedItems" 
                  :key="selectedItem.item.id"
                  class="selected-item-card"
                >
                  <div class="selected-item-header">
                    <span class="item-icon">{{ selectedItem.item.icon_value || '📦' }}</span>
                    <span class="item-name">{{ selectedItem.item.name }}</span>
                    <button 
                      type="button"
                      class="remove-btn"
                      @click="removeItem(selectedItem.item.id)"
                    >
                      ×
                    </button>
                  </div>
                </div>
                <div v-if="selectedItems.length === 0" class="no-selected">
                  No items selected. The NPC will have no loot.
                </div>
              </div>
            </div>
          </div>
          
          <div class="form-group">
            <label for="proposal-notes">Notes (required)</label>
            <textarea 
              id="proposal-notes"
              v-model="proposalNotes" 
              class="form-control" 
              rows="3"
              placeholder="Explain why these items should drop from this NPC..."
              required
            ></textarea>
          </div>
          
          <div class="form-actions">
            <button type="submit" class="submit-btn" :disabled="!proposalNotes.trim()">
              Submit Loot Change Proposal
            </button>
            <button type="button" class="cancel-btn" @click="handleClose">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch, onMounted } from 'vue'
import { useToast } from '../composables/useToast'
import { useCSRF } from '../composables/useCSRF'

export default {
  name: 'POILootProposalDialog',
  props: {
    visible: {
      type: Boolean,
      default: false
    },
    poi: {
      type: Object,
      default: () => ({})
    }
  },
  emits: ['close', 'submitted'],
  setup(props, { emit }) {
    const { success, error } = useToast()
    const { fetchWithCSRF } = useCSRF()
    
    const searchQuery = ref('')
    const proposalNotes = ref('')
    const items = ref([])
    const selectedItems = ref([])
    const currentLootItems = ref([])
    const isLoadingCurrentLoot = ref(false)
    
    // Check if POI has a valid Combat NPC
    const isValidCombatNPC = computed(() => {
      if (!props.poi?.type_name) return false
      const typeName = props.poi.type_name.toLowerCase()
      return props.poi?.npc_id && (
        typeName.includes('combat') || 
        typeName.includes('npc') || 
        typeName.includes('mob') ||
        typeName.includes('boss')
      )
    })
    
    // Load current loot items for the NPC
    const loadCurrentLoot = async () => {
      if (!props.poi?.npc_id) {
        currentLootItems.value = []
        return
      }
      
      isLoadingCurrentLoot.value = true
      try {
        const response = await fetch(`/api/npcs/${props.poi.npc_id}/loot`)
        if (response.ok) {
          const lootData = await response.json()
          currentLootItems.value = lootData
          // Initialize selectedItems with current loot
          selectedItems.value = lootData.map(item => ({
            item: {
              id: item.item_id,
              name: item.item_name,
              icon_value: item.icon_value
            }
          }))
        }
      } catch (err) {
        console.error('Error loading current loot:', err)
        currentLootItems.value = []
      } finally {
        isLoadingCurrentLoot.value = false
      }
    }
    
    // Reset form when dialog opens
    watch(() => props.visible, async (newVal) => {
      if (newVal) {
        searchQuery.value = ''
        proposalNotes.value = ''
        selectedItems.value = []
        currentLootItems.value = []
        await loadCurrentLoot()
      }
    })
    
    // Load items from database
    const loadItems = async () => {
      try {
        const response = await fetch('/api/items')
        if (response.ok) {
          items.value = await response.json()
        }
      } catch (err) {
        console.error('Error loading items:', err)
        error('Failed to load items')
      }
    }
    
    onMounted(loadItems)
    
    // Filter items based on search query
    const filteredItems = computed(() => {
      if (!searchQuery.value) {
        return items.value
      }
      const query = searchQuery.value.toLowerCase()
      return items.value.filter(item => 
        item.name.toLowerCase().includes(query) ||
        (item.item_type && item.item_type.toLowerCase().includes(query))
      )
    })
    
    // Check if item is selected
    const isItemSelected = (itemId) => {
      return selectedItems.value.some(si => si.item.id === itemId)
    }
    
    // Toggle item selection
    const toggleItem = (item) => {
      const index = selectedItems.value.findIndex(si => si.item.id === item.id)
      if (index > -1) {
        selectedItems.value.splice(index, 1)
      } else {
        selectedItems.value.push({
          item: item
        })
      }
    }
    
    // Remove item from selection
    const removeItem = (itemId) => {
      const index = selectedItems.value.findIndex(si => si.item.id === itemId)
      if (index > -1) {
        selectedItems.value.splice(index, 1)
      }
    }
    
    const submitProposal = async () => {
      if (!proposalNotes.value.trim()) {
        error('Please provide notes explaining the changes')
        return
      }
      
      // Check if there are actually changes
      const currentIds = new Set(currentLootItems.value.map(item => item.item_id))
      const selectedIds = new Set(selectedItems.value.map(si => si.item.id))
      
      const hasChanges = currentIds.size !== selectedIds.size || 
        [...currentIds].some(id => !selectedIds.has(id)) ||
        [...selectedIds].some(id => !currentIds.has(id))
      
      if (!hasChanges) {
        error('No changes detected. The proposed loot is the same as the current loot.')
        return
      }
      
      try {
        // Prepare loot data
        const lootItems = selectedItems.value.map(si => ({
          item_id: si.item.id,
          item_name: si.item.name
        }))
        
        const proposalData = {
          change_type: 'change_loot',
          target_type: 'poi',
          target_id: props.poi?.id,
          current_data: {
            poi_name: props.poi?.name,
            npc_id: props.poi?.npc_id,
            npc_name: props.poi?.npc_name,
            map_name: props.poi?.map_name
          },
          proposed_data: {
            npc_id: props.poi?.npc_id,
            loot_items: lootItems  // This will be the complete proposed loot list
          },
          notes: proposalNotes.value
        }
        
        // console.log('Submitting loot proposal with data:', proposalData)
        
        const response = await fetchWithCSRF('/api/change-proposals', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(proposalData)
        })
        
        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to create proposal')
        }
        
        success('Loot proposal submitted for community voting')
        emit('submitted')
        handleClose()
      } catch (err) {
        error(err.message || 'Failed to submit proposal')
      }
    }
    
    const handleClose = () => {
      emit('close')
    }
    
    return {
      searchQuery,
      proposalNotes,
      items,
      selectedItems,
      currentLootItems,
      isLoadingCurrentLoot,
      isValidCombatNPC,
      filteredItems,
      isItemSelected,
      toggleItem,
      removeItem,
      submitProposal,
      handleClose
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
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 1rem;
}

.modal-content {
  background: #2d2d2d;
  border-radius: 12px;
  width: 90%;
  max-width: 800px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
  overflow: hidden;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #444;
  background: linear-gradient(135deg, rgba(168, 85, 247, 0.1), rgba(168, 85, 247, 0.05));
}

.modal-header h2 {
  margin: 0;
  color: #a855f7;
  font-size: 1.5rem;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  color: #999;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.modal-body {
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

.poi-info {
  background: rgba(0, 0, 0, 0.3);
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 1.5rem;
}

.poi-info h3 {
  margin: 0 0 0.5rem 0;
  color: #fff;
  font-size: 1.2rem;
}

.poi-description {
  color: #ccc;
  font-size: 0.9rem;
  margin-bottom: 0.75rem;
  line-height: 1.4;
}

.poi-details {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.detail-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #999;
  font-size: 0.9rem;
}

.detail-item .icon {
  font-size: 1rem;
}

.warning-box {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 8px;
  margin-bottom: 1.5rem;
}

.warning-icon {
  font-size: 1.5rem;
  color: #ef4444;
}

.warning-content {
  flex: 1;
}

.warning-title {
  margin: 0 0 0.5rem 0;
  color: #ef4444;
  font-weight: 600;
}

.warning-text {
  margin: 0;
  color: #fca5a5;
  font-size: 0.9rem;
  line-height: 1.4;
}

.proposal-form {
  margin-top: 1rem;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  color: #e0e0e0;
  font-weight: 500;
  font-size: 0.9rem;
}

.form-control {
  width: 100%;
  padding: 0.75rem;
  background: #1a1a1a;
  border: 1px solid #444;
  border-radius: 6px;
  color: #e0e0e0;
  font-size: 0.95rem;
  transition: all 0.2s;
}

.form-control:focus {
  outline: none;
  border-color: #a855f7;
  background: #262626;
}

.form-control::placeholder {
  color: #666;
}

.search-input {
  margin-bottom: 0.5rem;
}

.items-section {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  margin-bottom: 1.5rem;
}

.available-items,
.selected-items {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  padding: 1rem;
}

.available-items h4,
.selected-items h4 {
  margin: 0 0 1rem 0;
  color: #e0e0e0;
  font-size: 1rem;
  font-weight: 600;
}

.items-list,
.selected-list {
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid #333;
  border-radius: 6px;
  background: #1a1a1a;
}

.item-card {
  display: flex;
  align-items: center;
  padding: 0.75rem;
  border-bottom: 1px solid #333;
  cursor: pointer;
  transition: all 0.2s;
}

.item-card:hover {
  background: rgba(168, 85, 247, 0.1);
}

.item-card.selected {
  background: rgba(168, 85, 247, 0.2);
  border-left: 3px solid #a855f7;
}

.item-card:last-child {
  border-bottom: none;
}

.item-icon {
  font-size: 1.25rem;
  margin-right: 0.75rem;
}

.item-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.item-name {
  color: #e0e0e0;
  font-size: 0.9rem;
  font-weight: 500;
}

.item-type {
  color: #999;
  font-size: 0.8rem;
}

.add-btn {
  width: 28px;
  height: 28px;
  border: 1px solid #666;
  background: transparent;
  color: #999;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.add-btn:hover {
  background: rgba(168, 85, 247, 0.2);
  border-color: #a855f7;
  color: #a855f7;
}

.add-btn.active {
  background: #a855f7;
  color: #fff;
  border-color: #a855f7;
}

.selected-item-card {
  padding: 0.75rem;
  border-bottom: 1px solid #333;
}

.selected-item-card:last-child {
  border-bottom: none;
}

.selected-item-header {
  display: flex;
  align-items: center;
  margin-bottom: 0.5rem;
}

.selected-item-header .item-name {
  flex: 1;
  margin: 0 0.5rem;
}

.remove-btn {
  width: 24px;
  height: 24px;
  background: none;
  border: none;
  color: #999;
  font-size: 1.25rem;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.remove-btn:hover {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

.no-items,
.no-selected {
  padding: 2rem;
  text-align: center;
  color: #666;
  font-size: 0.9rem;
}

.loading-message {
  padding: 1rem;
  text-align: center;
  color: #888;
}

.no-current-loot {
  padding: 1rem;
  text-align: center;
  color: #666;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
}

.current-loot-list {
  margin-bottom: 1rem;
}

.info-text {
  font-size: 0.85rem;
  color: #999;
  margin-bottom: 0.5rem;
}

textarea.form-control {
  resize: vertical;
  min-height: 80px;
}

.form-actions {
  display: flex;
  gap: 1rem;
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid #444;
  flex-shrink: 0;
}

.submit-btn,
.cancel-btn {
  flex: 1;
  padding: 0.75rem;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.submit-btn {
  background: #a855f7;
  color: white;
}

.submit-btn:hover:not(:disabled) {
  background: #9333ea;
}

.submit-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.cancel-btn {
  background: #4b5563;
  color: white;
}

.cancel-btn:hover {
  background: #374151;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .modal-content {
    width: 95%;
    max-height: 95vh;
    margin: 1rem;
  }
  
  .modal-body {
    padding: 1rem;
  }
  
  .items-section {
    grid-template-columns: 1fr;
  }
  
  .items-list,
  .selected-list {
    max-height: 200px;
  }
  
  .form-actions {
    flex-direction: column;
  }
  
  .submit-btn,
  .cancel-btn {
    width: 100%;
  }
}
</style>