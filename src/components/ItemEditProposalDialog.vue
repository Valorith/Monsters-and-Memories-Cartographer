<template>
  <div v-if="visible" class="modal-overlay" @click.self="handleClose">
    <div class="modal-content">
      <div class="modal-header">
        <h2>Propose Item Changes</h2>
        <button class="close-btn" @click="handleClose">×</button>
      </div>
      
      <div class="modal-body">
        <div v-if="item && item.name" class="item-info">
          <div class="item-header">
            <span v-if="item.icon_type === 'emoji'" class="item-icon">{{ item.icon_value }}</span>
            <iconify-icon v-else :icon="item.icon_value" class="item-icon" width="32"></iconify-icon>
            <h3>{{ item.name }}</h3>
          </div>
          <div v-if="item.item_type" class="item-details">
            <span class="detail-item">{{ item.item_type }}</span>
            <span v-if="item.slot" class="detail-item">{{ item.slot }}</span>
          </div>
        </div>
        
        <form @submit.prevent="submitProposal" class="proposal-form">
          <div class="form-section">
            <h4>Basic Information</h4>
            
            <div class="form-group">
              <label for="name">Name</label>
              <input 
                id="name" 
                v-model="proposedData.name" 
                type="text" 
                class="form-control"
                :class="{ 'changed': proposedData.name !== currentData.name }"
                required
              />
              <span v-if="proposedData.name !== currentData.name" class="change-indicator">
                (was: {{ currentData.name }})
              </span>
            </div>
            
            <div class="form-group">
              <label for="description">Description</label>
              <textarea 
                id="description"
                v-model="proposedData.description" 
                class="form-control" 
                rows="3"
                :class="{ 'changed': proposedData.description !== currentData.description }"
              ></textarea>
              <span v-if="proposedData.description !== currentData.description" class="change-indicator">
                (was: {{ currentData.description || 'No description' }})
              </span>
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label for="item_type">Type</label>
                <select 
                  id="item_type"
                  v-model="proposedData.item_type" 
                  class="form-control"
                  :class="{ 'changed': proposedData.item_type !== currentData.item_type }"
                >
                  <option value="weapon">Weapon</option>
                  <option value="armor">Armor</option>
                  <option value="consumable">Consumable</option>
                  <option value="misc">Miscellaneous</option>
                  <option value="quest">Quest Item</option>
                </select>
                <span v-if="proposedData.item_type !== currentData.item_type" class="change-indicator">
                  (was: {{ currentData.item_type }})
                </span>
              </div>
              
              <div class="form-group">
                <label for="slot">Slot</label>
                <select 
                  id="slot"
                  v-model="proposedData.slot" 
                  class="form-control"
                  :class="{ 'changed': proposedData.slot !== currentData.slot }"
                >
                  <option value="">None</option>
                  <option value="head">Head</option>
                  <option value="chest">Chest</option>
                  <option value="legs">Legs</option>
                  <option value="feet">Feet</option>
                  <option value="hands">Hands</option>
                  <option value="weapon">Weapon</option>
                  <option value="offhand">Offhand</option>
                  <option value="neck">Neck</option>
                  <option value="ring">Ring</option>
                  <option value="trinket">Trinket</option>
                </select>
                <span v-if="proposedData.slot !== currentData.slot" class="change-indicator">
                  (was: {{ currentData.slot || 'None' }})
                </span>
              </div>
            </div>
          </div>
          
          <div class="form-section">
            <h4>Stats</h4>
            
            <div class="stats-grid">
              <div v-for="stat in statFields" :key="stat.key" class="form-group stat-group">
                <label :for="stat.key">{{ stat.label }}</label>
                <input 
                  :id="stat.key"
                  v-model.number="proposedData[stat.key]" 
                  type="number" 
                  class="form-control stat-input"
                  :class="{ 'changed': proposedData[stat.key] !== currentData[stat.key] }"
                  min="0"
                  :max="stat.max || 999"
                />
                <span v-if="proposedData[stat.key] !== currentData[stat.key]" class="change-indicator">
                  (was: {{ currentData[stat.key] || 0 }})
                </span>
              </div>
            </div>
          </div>
          
          <div class="form-group">
            <label for="proposal-notes">Proposal Notes (Required)</label>
            <textarea 
              id="proposal-notes"
              v-model="proposalNotes" 
              class="form-control" 
              rows="3" 
              placeholder="Explain the reason for these changes..."
              required
            ></textarea>
          </div>
          
          <div v-if="hasChanges" class="changes-summary">
            <h4>Summary of Changes:</h4>
            <ul>
              <li v-for="change in changesList" :key="change.field">
                <strong>{{ change.label }}:</strong> 
                <span class="old-value">{{ change.old || 'None' }}</span> → 
                <span class="new-value">{{ change.new }}</span>
              </li>
            </ul>
          </div>
          
          <div class="form-actions">
            <button type="submit" class="submit-btn" :disabled="!proposalNotes.trim() || !hasChanges">
              Submit Item Edit Proposal
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
import { ref, computed, watch, reactive } from 'vue'
import { useToast } from '../composables/useToast'
import { useCSRF } from '../composables/useCSRF'

export default {
  name: 'ItemEditProposalDialog',
  props: {
    visible: {
      type: Boolean,
      default: false
    },
    item: {
      type: Object,
      default: () => ({})
    }
  },
  emits: ['close', 'submitted'],
  setup(props, { emit }) {
    const { success, error } = useToast()
    const { fetchWithCSRF } = useCSRF()
    
    const proposalNotes = ref('')
    const currentData = reactive({})
    const proposedData = reactive({})
    
    // Define stat fields
    const statFields = [
      { key: 'str', label: 'STR', max: 999 },
      { key: 'sta', label: 'STA', max: 999 },
      { key: 'agi', label: 'AGI', max: 999 },
      { key: 'dex', label: 'DEX', max: 999 },
      { key: 'wis', label: 'WIS', max: 999 },
      { key: 'int', label: 'INT', max: 999 },
      { key: 'cha', label: 'CHA', max: 999 },
      { key: 'ac', label: 'AC', max: 999 },
      { key: 'health', label: 'HP', max: 9999 },
      { key: 'mana', label: 'MP', max: 9999 },
      { key: 'attack_speed', label: 'Attack Speed', max: 99 }
    ]
    
    // All fields that can be edited
    const allFields = [
      { key: 'name', label: 'Name' },
      { key: 'description', label: 'Description' },
      { key: 'item_type', label: 'Type' },
      { key: 'slot', label: 'Slot' },
      ...statFields
    ]
    
    // Initialize data when dialog opens
    watch(() => props.visible, (newVal) => {
      if (newVal && props.item) {
        proposalNotes.value = ''
        
        // Copy current data
        allFields.forEach(field => {
          currentData[field.key] = props.item[field.key] || (field.key === 'description' || field.key === 'slot' ? '' : 0)
          proposedData[field.key] = props.item[field.key] || (field.key === 'description' || field.key === 'slot' ? '' : 0)
        })
        
        // Ensure required fields have values
        if (!proposedData.name) proposedData.name = props.item.name || ''
        if (!proposedData.item_type) proposedData.item_type = props.item.item_type || 'misc'
      }
    })
    
    // Check if there are any changes
    const hasChanges = computed(() => {
      return allFields.some(field => 
        proposedData[field.key] !== currentData[field.key]
      )
    })
    
    // Get list of changes
    const changesList = computed(() => {
      return allFields
        .filter(field => proposedData[field.key] !== currentData[field.key])
        .map(field => ({
          field: field.key,
          label: field.label,
          old: currentData[field.key],
          new: proposedData[field.key]
        }))
    })
    
    const submitProposal = async () => {
      if (!proposalNotes.value.trim()) {
        error('Please provide notes explaining the changes')
        return
      }
      
      if (!hasChanges.value) {
        error('No changes detected')
        return
      }
      
      try {
        // Build the proposal payload
        const proposalPayload = {
          change_type: 'edit_item',
          target_type: 'item',
          target_id: props.item.id,
          current_data: { ...currentData },
          proposed_data: { ...proposedData },
          notes: proposalNotes.value
        }
        
        // console.log('Submitting item edit proposal:', proposalPayload)
        
        const response = await fetchWithCSRF('/api/change-proposals', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(proposalPayload)
        })
        
        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to create proposal')
        }
        
        success('Item edit proposal submitted successfully!')
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
      proposalNotes,
      currentData,
      proposedData,
      statFields,
      hasChanges,
      changesList,
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
  z-index: 10000;
}

.modal-content {
  background: #1e1e1e;
  border-radius: 8px;
  max-width: 800px;
  width: 90%;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  overflow: hidden;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #333;
}

.modal-header h2 {
  margin: 0;
  color: #FFD700;
  font-size: 1.5rem;
}

.close-btn {
  background: none;
  border: none;
  color: #999;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0.5rem;
  transition: color 0.2s;
}

.close-btn:hover {
  color: #fff;
}

.modal-body {
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

.item-info {
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #333;
}

.item-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.5rem;
}

.item-icon {
  font-size: 2rem;
  line-height: 1;
}

.item-info h3 {
  margin: 0;
  color: #FFD700;
}

.item-details {
  display: flex;
  gap: 1rem;
  color: #999;
  font-size: 0.9rem;
}

.detail-item {
  padding: 0.25rem 0.75rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
}

.proposal-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-section {
  padding: 1rem;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 8px;
  border: 1px solid #333;
}

.form-section h4 {
  margin: 0 0 1rem 0;
  color: #FFD700;
  font-size: 1.1rem;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  font-weight: 500;
  color: #ccc;
  font-size: 0.9rem;
}

.form-control {
  background: #2a2a2a;
  border: 1px solid #444;
  color: #fff;
  padding: 0.5rem;
  border-radius: 4px;
  font-size: 0.9rem;
  width: 100%;
  transition: all 0.2s;
}

.form-control:focus {
  outline: none;
  border-color: #FFD700;
  box-shadow: 0 0 0 2px rgba(255, 215, 0, 0.2);
}

.form-control.changed {
  border-color: #FFD700;
  background: rgba(255, 215, 0, 0.1);
}

textarea.form-control {
  resize: vertical;
  min-height: 60px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 0.75rem;
}

.stat-group {
  position: relative;
}

.stat-input {
  text-align: center;
}

.change-indicator {
  color: #888;
  font-size: 0.75rem;
  font-style: italic;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
}

.changes-summary {
  background: rgba(255, 215, 0, 0.1);
  border: 1px solid rgba(255, 215, 0, 0.3);
  border-radius: 4px;
  padding: 1rem;
}

.changes-summary h4 {
  margin: 0 0 0.5rem 0;
  color: #FFD700;
}

.changes-summary ul {
  margin: 0;
  padding-left: 1.5rem;
}

.changes-summary li {
  color: #ccc;
  margin-bottom: 0.25rem;
}

.old-value {
  color: #ff6b6b;
  text-decoration: line-through;
}

.new-value {
  color: #51cf66;
  font-weight: 500;
}

.form-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid #333;
  flex-shrink: 0;
}

.submit-btn,
.cancel-btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.submit-btn {
  background: #FFD700;
  color: #000;
}

.submit-btn:hover:not(:disabled) {
  background: #FFC700;
  transform: translateY(-1px);
}

.submit-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.cancel-btn {
  background: #444;
  color: #fff;
}

.cancel-btn:hover {
  background: #555;
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
  
  .form-row {
    grid-template-columns: 1fr;
  }
  
  .stats-grid {
    grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
    gap: 0.5rem;
  }
  
  .form-section {
    padding: 0.75rem;
  }
  
  .stat-group label {
    font-size: 0.8rem;
  }
  
  .form-control {
    font-size: 0.85rem;
    padding: 0.4rem;
  }
  
  .change-indicator {
    font-size: 0.7rem;
  }
  
  .form-actions {
    flex-direction: column;
  }
  
  .submit-btn,
  .cancel-btn {
    width: 100%;
  }
}

@media (max-width: 480px) {
  .stats-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
</style>