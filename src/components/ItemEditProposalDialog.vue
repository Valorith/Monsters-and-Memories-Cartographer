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
            
            <!-- Weight and Size -->
            <div class="form-row">
              <div class="form-group">
                <label for="weight">Weight</label>
                <input 
                  id="weight"
                  v-model.number="proposedData.weight" 
                  type="number" 
                  class="form-control"
                  :class="{ 'changed': proposedData.weight !== currentData.weight }"
                  min="0"
                  step="0.01"
                />
                <span v-if="proposedData.weight !== currentData.weight" class="change-indicator">
                  (was: {{ currentData.weight || 0 }})
                </span>
              </div>
              
              <div class="form-group">
                <label for="size">Size</label>
                <select 
                  id="size"
                  v-model="proposedData.size" 
                  class="form-control"
                  :class="{ 'changed': proposedData.size !== currentData.size }"
                >
                  <option value="Small">Small</option>
                  <option value="Medium">Medium</option>
                  <option value="Large">Large</option>
                  <option value="Giant">Giant</option>
                </select>
                <span v-if="proposedData.size !== currentData.size" class="change-indicator">
                  (was: {{ currentData.size || 'Medium' }})
                </span>
              </div>
            </div>
            
            <!-- Damage and Delay -->
            <div class="form-row">
              <div class="form-group">
                <label for="damage">Damage</label>
                <input 
                  id="damage"
                  v-model.number="proposedData.damage" 
                  type="number" 
                  class="form-control"
                  :class="{ 'changed': proposedData.damage !== currentData.damage }"
                  min="0"
                />
                <span v-if="proposedData.damage !== currentData.damage" class="change-indicator">
                  (was: {{ currentData.damage || 0 }})
                </span>
              </div>
              
              <div class="form-group">
                <label for="delay">Delay</label>
                <input 
                  id="delay"
                  v-model.number="proposedData.delay" 
                  type="number" 
                  class="form-control"
                  :class="{ 'changed': proposedData.delay !== currentData.delay }"
                  min="0"
                />
                <span v-if="proposedData.delay !== currentData.delay" class="change-indicator">
                  (was: {{ currentData.delay || 0 }})
                </span>
              </div>
            </div>
            
            <!-- Skill -->
            <div class="form-group">
              <label for="skill">Skill</label>
              <select 
                id="skill"
                v-model="proposedData.skill" 
                class="form-control"
                :class="{ 'changed': proposedData.skill !== currentData.skill }"
              >
                <option :value="null">None</option>
                <option value="Archery">Archery</option>
                <option value="Slashing">Slashing</option>
                <option value="Bludgeoning">Bludgeoning</option>
                <option value="Piercing">Piercing</option>
                <option value="Throwing">Throwing</option>
                <option value="Brass">Brass</option>
                <option value="Percussion">Percussion</option>
                <option value="Stringed">Stringed</option>
                <option value="Wind">Wind</option>
                <option value="Singing">Singing</option>
              </select>
              <span v-if="proposedData.skill !== currentData.skill" class="change-indicator">
                (was: {{ currentData.skill || 'None' }})
              </span>
            </div>
            
            <!-- Multiple Slots -->
            <div class="form-group">
              <label>Slots</label>
              <div class="multi-select-container">
                <div class="multi-select-display" @click="showSlotDropdown = !showSlotDropdown">
                  {{ selectedSlotsDisplay || 'Select slots...' }}
                  <span class="dropdown-arrow">▼</span>
                </div>
                <div v-if="showSlotDropdown" class="multi-select-dropdown">
                  <div 
                    v-for="slot in slotOptions" 
                    :key="slot"
                    class="multi-select-option"
                    @click="toggleSlot(slot)"
                  >
                    <input 
                      type="checkbox" 
                      :checked="proposedData.slots.includes(slot)"
                      @click.stop
                      @change="toggleSlot(slot)"
                    />
                    <span>{{ slot }}</span>
                  </div>
                </div>
              </div>
              <span v-if="!arraysEqual(proposedData.slots, currentData.slots)" class="change-indicator">
                (was: {{ currentData.slots?.join(', ') || currentData.slot || 'None' }})
              </span>
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
          
          <div class="form-section">
            <h4>Resistances</h4>
            
            <div class="stats-grid">
              <div v-for="resist in resistanceFields" :key="resist.key" class="form-group stat-group">
                <label :for="resist.key">{{ resist.label }}</label>
                <input 
                  :id="resist.key"
                  v-model.number="proposedData[resist.key]" 
                  type="number" 
                  class="form-control stat-input"
                  :class="{ 'changed': proposedData[resist.key] !== currentData[resist.key] }"
                  min="-999"
                  max="999"
                />
                <span v-if="proposedData[resist.key] !== currentData[resist.key]" class="change-indicator">
                  (was: {{ currentData[resist.key] || 0 }})
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
    
    // Define resistance fields
    const resistanceFields = [
      { key: 'resist_cold', label: 'Cold' },
      { key: 'resist_corruption', label: 'Corruption' },
      { key: 'resist_disease', label: 'Disease' },
      { key: 'resist_electricity', label: 'Electricity' },
      { key: 'resist_fire', label: 'Fire' },
      { key: 'resist_magic', label: 'Magic' },
      { key: 'resist_poison', label: 'Poison' }
    ]
    
    // Slot options
    const slotOptions = [
      'Head', 'Face', 'Ears', 'Neck', 'Shoulders', 'Arms', 'Back',
      'Wrist1', 'Wrist2', 'Range', 'Hands', 'Primary', 'Secondary',
      'Finger1', 'Finger2', 'Chest', 'Legs', 'Feet', 'Waist', 'Ammo'
    ]
    
    const showSlotDropdown = ref(false)
    
    // All fields that can be edited
    const allFields = [
      { key: 'name', label: 'Name' },
      { key: 'description', label: 'Description' },
      { key: 'item_type', label: 'Type' },
      { key: 'slot', label: 'Slot' },
      { key: 'slots', label: 'Slots' },
      { key: 'weight', label: 'Weight' },
      { key: 'size', label: 'Size' },
      { key: 'damage', label: 'Damage' },
      { key: 'delay', label: 'Delay' },
      { key: 'skill', label: 'Skill' },
      ...statFields,
      ...resistanceFields
    ]
    
    // Initialize data when dialog opens
    watch(() => props.visible, (newVal) => {
      if (newVal && props.item) {
        proposalNotes.value = ''
        
        // Copy current data
        allFields.forEach(field => {
          if (field.key === 'slots') {
            // Handle slots array
            currentData.slots = props.item.slots || (props.item.slot ? [props.item.slot] : [])
            proposedData.slots = [...currentData.slots]
          } else if (field.key === 'size') {
            currentData.size = props.item.size || 'Medium'
            proposedData.size = currentData.size
          } else if (field.key === 'skill') {
            currentData.skill = props.item.skill || null
            proposedData.skill = currentData.skill
          } else {
            const defaultValue = ['description', 'slot', 'name', 'item_type'].includes(field.key) ? '' : 0
            currentData[field.key] = props.item[field.key] || defaultValue
            proposedData[field.key] = props.item[field.key] || defaultValue
          }
        })
        
        // Ensure required fields have values
        if (!proposedData.name) proposedData.name = props.item.name || ''
        if (!proposedData.item_type) proposedData.item_type = props.item.item_type || 'misc'
        
        // Close dropdown when dialog opens
        showSlotDropdown.value = false
      }
    })
    
    // Helper function to compare arrays
    const arraysEqual = (a, b) => {
      if (!Array.isArray(a) || !Array.isArray(b)) return false
      if (a.length !== b.length) return false
      return a.every(item => b.includes(item)) && b.every(item => a.includes(item))
    }
    
    // Check if there are any changes
    const hasChanges = computed(() => {
      return allFields.some(field => {
        if (field.key === 'slots') {
          return !arraysEqual(proposedData.slots, currentData.slots)
        }
        return proposedData[field.key] !== currentData[field.key]
      })
    })
    
    // Get list of changes
    const changesList = computed(() => {
      return allFields
        .filter(field => {
          if (field.key === 'slots') {
            return !arraysEqual(proposedData.slots, currentData.slots)
          }
          return proposedData[field.key] !== currentData[field.key]
        })
        .map(field => ({
          field: field.key,
          label: field.label,
          old: field.key === 'slots' ? (currentData.slots?.join(', ') || 'None') : currentData[field.key],
          new: field.key === 'slots' ? (proposedData.slots?.join(', ') || 'None') : proposedData[field.key]
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
    
    // Slot management functions
    const toggleSlot = (slot) => {
      const index = proposedData.slots.indexOf(slot)
      if (index > -1) {
        proposedData.slots.splice(index, 1)
      } else {
        proposedData.slots.push(slot)
      }
    }
    
    const selectedSlotsDisplay = computed(() => {
      return proposedData.slots?.length > 0 ? proposedData.slots.join(', ') : ''
    })
    
    const handleClose = () => {
      emit('close')
    }
    
    return {
      proposalNotes,
      currentData,
      proposedData,
      statFields,
      resistanceFields,
      slotOptions,
      showSlotDropdown,
      hasChanges,
      changesList,
      submitProposal,
      handleClose,
      toggleSlot,
      selectedSlotsDisplay,
      arraysEqual
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

/* Multi-select dropdown styles */
.multi-select-container {
  position: relative;
}

.multi-select-display {
  padding: 0.5rem;
  border: 1px solid #444;
  border-radius: 4px;
  background: #1a1a1a;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-height: 2.5rem;
}

.multi-select-display:hover {
  border-color: #666;
}

.dropdown-arrow {
  font-size: 0.8rem;
  color: #666;
}

.multi-select-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: #1a1a1a;
  border: 1px solid #444;
  border-radius: 4px;
  margin-top: 0.25rem;
  max-height: 200px;
  overflow-y: auto;
  z-index: 10;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
}

.multi-select-option {
  padding: 0.5rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.multi-select-option:hover {
  background: rgba(255, 255, 255, 0.05);
}

.multi-select-option input[type="checkbox"] {
  margin: 0;
}
</style>