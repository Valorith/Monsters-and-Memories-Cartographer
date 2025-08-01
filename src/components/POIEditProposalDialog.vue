<template>
  <div v-if="visible" class="modal-overlay" @click.self="handleClose">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h2>Propose POI Edit</h2>
        <button class="close-btn" @click="handleClose">×</button>
      </div>
      
      <div class="modal-body">
        <div v-if="poi && poi.name" class="current-values">
          <h3>Current Values</h3>
          <div class="info-grid">
            <div class="info-item">
              <span class="label">Name:</span>
              <span class="value">{{ poi.name }}</span>
            </div>
            <div class="info-item">
              <span class="label">Type:</span>
              <span class="value">{{ poi.type_name || 'Unknown' }}</span>
            </div>
            <div v-if="poi.description" class="info-item full-width">
              <span class="label">Description:</span>
              <span class="value">{{ poi.description }}</span>
            </div>
            <div v-if="poi.npc_name" class="info-item">
              <span class="label">NPC:</span>
              <span class="value">{{ poi.npc_name }}</span>
            </div>
            <div v-if="poi.item_name" class="info-item">
              <span class="label">Item:</span>
              <span class="value">{{ poi.item_name }}</span>
            </div>
          </div>
        </div>
        
        <form @submit.prevent="submitProposal" class="proposal-form">
          <h3>Proposed Changes</h3>
          <p class="help-text">Only fill in the fields you want to change</p>
          
          <div class="form-group">
            <label for="poi-name">Name</label>
            <input 
              id="poi-name"
              v-model="proposedData.name" 
              type="text" 
              class="form-control"
              :placeholder="poi?.name || 'POI name'"
            />
          </div>
          
          <div class="form-group">
            <label for="poi-description">Description</label>
            <textarea 
              id="poi-description"
              v-model="proposedData.description" 
              class="form-control" 
              rows="3"
              :placeholder="poi?.description || 'Add a description...'"
            ></textarea>
          </div>
          
          <div class="form-group">
            <label for="poi-type">Type</label>
            <select 
              id="poi-type"
              v-model="proposedData.type_id" 
              class="form-control"
            >
              <option :value="null">-- Keep current type --</option>
              <option 
                v-for="type in poiTypes" 
                :key="type.id" 
                :value="type.id"
              >
                {{ type.icon_value }} {{ type.name }}
              </option>
            </select>
            <p v-if="typeChangeWarning" class="warning-text">
              ⚠️ Changing type may remove incompatible NPC/Item associations
            </p>
          </div>
          
          <div class="form-group" v-if="canAssociateNPC">
            <label for="poi-npc">Associated NPC</label>
            <select 
              id="poi-npc"
              v-model="proposedData.npc_id" 
              class="form-control"
            >
              <option :value="null">-- No NPC --</option>
              <option 
                v-for="npc in filteredNPCs" 
                :key="npc.id" 
                :value="npc.id"
              >
                {{ npc.name }} (Level {{ npc.level }})
              </option>
            </select>
          </div>
          
          <div class="form-group" v-if="canAssociateItem">
            <label for="poi-item">Associated Item</label>
            <select 
              id="poi-item"
              v-model="proposedData.item_id" 
              class="form-control"
            >
              <option :value="null">-- No Item --</option>
              <option 
                v-for="item in filteredItems" 
                :key="item.id" 
                :value="item.id"
              >
                {{ item.icon_value }} {{ item.name }}
              </option>
            </select>
          </div>
          
          <div class="form-group">
            <label for="proposal-notes">Notes (required)</label>
            <textarea 
              id="proposal-notes"
              v-model="proposalNotes" 
              class="form-control" 
              rows="2"
              placeholder="Explain your proposed changes..."
              required
            ></textarea>
          </div>
          
          <div class="form-actions">
            <button type="submit" class="submit-btn" :disabled="!hasChanges || !proposalNotes">
              Submit Proposal
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
  name: 'POIEditProposalDialog',
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
    
    const proposedData = ref({
      name: '',
      description: '',
      type_id: null,
      npc_id: null,
      item_id: null
    })
    
    const proposalNotes = ref('')
    const poiTypes = ref([])
    const npcs = ref([])
    const items = ref([])
    
    // Reset form when POI changes
    watch(() => props.poi, () => {
      if (props.visible) {
        resetForm()
      }
    })
    
    // Reset form when dialog opens
    watch(() => props.visible, (newVal) => {
      if (newVal) {
        resetForm()
      }
    })
    
    const resetForm = () => {
      proposedData.value = {
        name: '',
        description: '',
        type_id: null,
        npc_id: props.poi?.npc_id || null,
        item_id: props.poi?.item_id || null
      }
      proposalNotes.value = ''
    }
    
    // Load POI types, NPCs, and items
    const loadData = async () => {
      try {
        // Load POI types
        const typesResponse = await fetch('/api/poi-types')
        if (typesResponse.ok) {
          poiTypes.value = await typesResponse.json()
        }
        
        // Load NPCs (only if authenticated)
        const npcsResponse = await fetch('/api/npcs')
        if (npcsResponse.ok) {
          npcs.value = await npcsResponse.json()
        } else if (npcsResponse.status === 403) {
          // User not authenticated or not admin, skip loading NPCs
          npcs.value = []
        }
        
        // Load items
        const itemsResponse = await fetch('/api/items')
        if (itemsResponse.ok) {
          items.value = await itemsResponse.json()
        }
      } catch (err) {
        console.error('Error loading data:', err)
      }
    }
    
    onMounted(loadData)
    
    const hasChanges = computed(() => {
      return proposedData.value.name !== '' ||
             proposedData.value.description !== '' ||
             proposedData.value.type_id !== null ||
             proposedData.value.npc_id !== (props.poi?.npc_id || null) ||
             proposedData.value.item_id !== (props.poi?.item_id || null)
    })
    
    const selectedType = computed(() => {
      if (proposedData.value.type_id) {
        return poiTypes.value.find(t => t.id === proposedData.value.type_id)
      }
      return poiTypes.value.find(t => t.id === props.poi?.type_id)
    })
    
    const canAssociateNPC = computed(() => {
      const type = selectedType.value
      if (!type) return false
      const typeName = type.name.toLowerCase()
      return typeName.includes('npc') || typeName.includes('combat') || typeName.includes('mob')
    })
    
    const canAssociateItem = computed(() => {
      const type = selectedType.value
      if (!type) return false
      const typeName = type.name.toLowerCase()
      return typeName.includes('item') || typeName.includes('merchant') || typeName.includes('vendor')
    })
    
    const typeChangeWarning = computed(() => {
      if (!proposedData.value.type_id || proposedData.value.type_id === props.poi?.type_id) {
        return false
      }
      
      // Check if current associations would be invalid with new type
      const hasNPC = props.poi?.npc_id || proposedData.value.npc_id
      const hasItem = props.poi?.item_id || proposedData.value.item_id
      
      return (hasNPC && !canAssociateNPC.value) || (hasItem && !canAssociateItem.value)
    })
    
    const filteredNPCs = computed(() => {
      return npcs.value
    })
    
    const filteredItems = computed(() => {
      return items.value
    })
    
    const submitProposal = async () => {
      if (!hasChanges.value || !proposalNotes.value) {
        error('Please make at least one change and provide notes')
        return
      }
      
      try {
        // Build the proposed data object with only changed fields
        const changes = {}
        
        if (proposedData.value.name) {
          changes.name = proposedData.value.name
        }
        
        if (proposedData.value.description !== '') {
          changes.description = proposedData.value.description
        }
        
        if (proposedData.value.type_id !== null) {
          changes.type_id = proposedData.value.type_id
          
          // Clear incompatible associations
          if (!canAssociateNPC.value) {
            changes.npc_id = null
          }
          if (!canAssociateItem.value) {
            changes.item_id = null
          }
        }
        
        if (proposedData.value.npc_id !== props.poi?.npc_id) {
          changes.npc_id = proposedData.value.npc_id
        }
        
        if (proposedData.value.item_id !== props.poi?.item_id) {
          changes.item_id = proposedData.value.item_id
        }
        
        const proposalData = {
          change_type: 'edit_poi',
          target_type: 'poi',
          target_id: props.poi?.id,
          current_data: {
            name: props.poi?.name,
            description: props.poi?.description,
            type_id: props.poi?.type_id,
            npc_id: props.poi?.npc_id,
            item_id: props.poi?.item_id
          },
          proposed_data: changes,
          notes: proposalNotes.value
        }
        
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
        
        success('Edit proposal submitted for community voting')
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
      proposedData,
      proposalNotes,
      poiTypes,
      npcs,
      items,
      hasChanges,
      selectedType,
      canAssociateNPC,
      canAssociateItem,
      typeChangeWarning,
      filteredNPCs,
      filteredItems,
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
  max-width: 600px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #444;
  flex-shrink: 0;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(59, 130, 246, 0.05));
}

.modal-header h2 {
  margin: 0;
  color: #3b82f6;
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

.current-values {
  background: rgba(0, 0, 0, 0.3);
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 1.5rem;
}

.current-values h3 {
  margin: 0 0 1rem 0;
  color: #999;
  font-size: 0.9rem;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
}

.info-item {
  display: flex;
  gap: 0.5rem;
}

.info-item.full-width {
  grid-column: 1 / -1;
}

.info-item .label {
  color: #999;
  font-size: 0.9rem;
}

.info-item .value {
  color: #e0e0e0;
  font-size: 0.9rem;
}

.proposal-form h3 {
  margin: 0 0 0.5rem 0;
  color: #3b82f6;
  font-size: 1.1rem;
}

.help-text {
  color: #999;
  font-size: 0.85rem;
  margin-bottom: 1rem;
  font-style: italic;
}

.form-group {
  margin-bottom: 1rem;
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
  border-color: #3b82f6;
  background: #262626;
}

.form-control::placeholder {
  color: #666;
}

textarea.form-control {
  resize: vertical;
  min-height: 80px;
}

.warning-text {
  color: #f59e0b;
  font-size: 0.85rem;
  margin-top: 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.form-actions {
  display: flex;
  gap: 1rem;
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid #444;
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
  background: #3b82f6;
  color: white;
}

.submit-btn:hover:not(:disabled) {
  background: #2563eb;
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
}

@media (max-width: 640px) {
  .modal-content {
    width: 100%;
    margin: 0.5rem;
  }
}
</style>