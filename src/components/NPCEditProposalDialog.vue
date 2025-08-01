<template>
  <div v-if="visible" class="modal-overlay" @click.self="handleClose">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h2>Propose NPC Changes</h2>
        <button class="close-btn" @click="handleClose">×</button>
      </div>
      
      <div class="modal-body">
        <div v-if="npc && npc.name" class="npc-info">
          <h3>{{ npc.name }}</h3>
          <div class="npc-details">
            <span class="detail-item">Level {{ currentStats.level }}</span>
            <span v-if="npc.npc_type" class="detail-item">{{ npc.npc_type }}</span>
          </div>
        </div>
        
        <form @submit.prevent="submitProposal" class="proposal-form">
          <div class="stats-grid">
            <div class="stat-group">
              <h4>Basic Stats</h4>
              
              <div class="form-row">
                <label for="level">Level</label>
                <input 
                  id="level" 
                  v-model.number="proposedStats.level" 
                  type="number" 
                  class="form-control" 
                  min="1" 
                  max="100"
                  :class="{ 'changed': proposedStats.level !== currentStats.level }"
                />
                <span v-if="proposedStats.level !== currentStats.level" class="change-indicator">
                  (was {{ currentStats.level }})
                </span>
              </div>
              
              <div class="form-row">
                <label for="hp">HP</label>
                <input 
                  id="hp" 
                  v-model.number="proposedStats.hp" 
                  type="number" 
                  class="form-control" 
                  min="0"
                  :class="{ 'changed': proposedStats.hp !== currentStats.hp }"
                />
                <span v-if="proposedStats.hp !== currentStats.hp" class="change-indicator">
                  (was {{ currentStats.hp }})
                </span>
              </div>
              
              <div class="form-row">
                <label for="mp">MP</label>
                <input 
                  id="mp" 
                  v-model.number="proposedStats.mp" 
                  type="number" 
                  class="form-control" 
                  min="0"
                  :class="{ 'changed': proposedStats.mp !== currentStats.mp }"
                />
                <span v-if="proposedStats.mp !== currentStats.mp" class="change-indicator">
                  (was {{ currentStats.mp }})
                </span>
              </div>
              
              <div class="form-row">
                <label for="ac">AC</label>
                <input 
                  id="ac" 
                  v-model.number="proposedStats.ac" 
                  type="number" 
                  class="form-control"
                  :class="{ 'changed': proposedStats.ac !== currentStats.ac }"
                />
                <span v-if="proposedStats.ac !== currentStats.ac" class="change-indicator">
                  (was {{ currentStats.ac }})
                </span>
              </div>
            </div>
            
            <div class="stat-group">
              <h4>Attributes</h4>
              
              <div class="form-row">
                <label for="str">STR</label>
                <input 
                  id="str" 
                  v-model.number="proposedStats.str" 
                  type="number" 
                  class="form-control" 
                  min="0"
                  :class="{ 'changed': proposedStats.str !== currentStats.str }"
                />
                <span v-if="proposedStats.str !== currentStats.str" class="change-indicator">
                  (was {{ currentStats.str }})
                </span>
              </div>
              
              <div class="form-row">
                <label for="sta">STA</label>
                <input 
                  id="sta" 
                  v-model.number="proposedStats.sta" 
                  type="number" 
                  class="form-control" 
                  min="0"
                  :class="{ 'changed': proposedStats.sta !== currentStats.sta }"
                />
                <span v-if="proposedStats.sta !== currentStats.sta" class="change-indicator">
                  (was {{ currentStats.sta }})
                </span>
              </div>
              
              <div class="form-row">
                <label for="agi">AGI</label>
                <input 
                  id="agi" 
                  v-model.number="proposedStats.agi" 
                  type="number" 
                  class="form-control" 
                  min="0"
                  :class="{ 'changed': proposedStats.agi !== currentStats.agi }"
                />
                <span v-if="proposedStats.agi !== currentStats.agi" class="change-indicator">
                  (was {{ currentStats.agi }})
                </span>
              </div>
              
              <div class="form-row">
                <label for="dex">DEX</label>
                <input 
                  id="dex" 
                  v-model.number="proposedStats.dex" 
                  type="number" 
                  class="form-control" 
                  min="0"
                  :class="{ 'changed': proposedStats.dex !== currentStats.dex }"
                />
                <span v-if="proposedStats.dex !== currentStats.dex" class="change-indicator">
                  (was {{ currentStats.dex }})
                </span>
              </div>
              
              <div class="form-row">
                <label for="wis">WIS</label>
                <input 
                  id="wis" 
                  v-model.number="proposedStats.wis" 
                  type="number" 
                  class="form-control" 
                  min="0"
                  :class="{ 'changed': proposedStats.wis !== currentStats.wis }"
                />
                <span v-if="proposedStats.wis !== currentStats.wis" class="change-indicator">
                  (was {{ currentStats.wis }})
                </span>
              </div>
              
              <div class="form-row">
                <label for="int">INT</label>
                <input 
                  id="int" 
                  v-model.number="proposedStats.int" 
                  type="number" 
                  class="form-control" 
                  min="0"
                  :class="{ 'changed': proposedStats.int !== currentStats.int }"
                />
                <span v-if="proposedStats.int !== currentStats.int" class="change-indicator">
                  (was {{ currentStats.int }})
                </span>
              </div>
              
              <div class="form-row">
                <label for="cha">CHA</label>
                <input 
                  id="cha" 
                  v-model.number="proposedStats.cha" 
                  type="number" 
                  class="form-control" 
                  min="0"
                  :class="{ 'changed': proposedStats.cha !== currentStats.cha }"
                />
                <span v-if="proposedStats.cha !== currentStats.cha" class="change-indicator">
                  (was {{ currentStats.cha }})
                </span>
              </div>
            </div>
            
            <div class="stat-group">
              <h4>Combat Stats</h4>
              
              <div class="form-row">
                <label for="min_dmg">Min Damage</label>
                <input 
                  id="min_dmg" 
                  v-model.number="proposedStats.min_dmg" 
                  type="number" 
                  class="form-control" 
                  min="0"
                  :class="{ 'changed': proposedStats.min_dmg !== currentStats.min_dmg }"
                />
                <span v-if="proposedStats.min_dmg !== currentStats.min_dmg" class="change-indicator">
                  (was {{ currentStats.min_dmg }})
                </span>
              </div>
              
              <div class="form-row">
                <label for="max_dmg">Max Damage</label>
                <input 
                  id="max_dmg" 
                  v-model.number="proposedStats.max_dmg" 
                  type="number" 
                  class="form-control" 
                  min="0"
                  :class="{ 'changed': proposedStats.max_dmg !== currentStats.max_dmg }"
                />
                <span v-if="proposedStats.max_dmg !== currentStats.max_dmg" class="change-indicator">
                  (was {{ currentStats.max_dmg }})
                </span>
              </div>
              
              <div class="form-row">
                <label for="attack_speed">Attack Speed</label>
                <input 
                  id="attack_speed" 
                  v-model.number="proposedStats.attack_speed" 
                  type="number" 
                  class="form-control" 
                  min="0"
                  step="0.1"
                  :class="{ 'changed': proposedStats.attack_speed !== currentStats.attack_speed }"
                />
                <span v-if="proposedStats.attack_speed !== currentStats.attack_speed" class="change-indicator">
                  (was {{ currentStats.attack_speed }})
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
                <strong>{{ change.label }}:</strong> {{ change.old }} → {{ change.new }}
              </li>
            </ul>
          </div>
          
          <div class="form-actions">
            <button type="submit" class="submit-btn" :disabled="!proposalNotes.trim() || !hasChanges">
              Submit NPC Edit Proposal
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
import { ref, computed, watch, reactive, toRef } from 'vue'
import { useToast } from '../composables/useToast'
import { useCSRF } from '../composables/useCSRF'

export default {
  name: 'NPCEditProposalDialog',
  props: {
    visible: {
      type: Boolean,
      default: false
    },
    npc: {
      type: Object,
      default: () => ({})
    }
  },
  emits: ['close', 'submitted'],
  setup(props, { emit }) {
    const { success, error } = useToast()
    const { fetchWithCSRF } = useCSRF()
    
    const proposalNotes = ref('')
    const currentStats = reactive({})
    const proposedStats = reactive({})
    
    // List of stat fields to track
    const statFields = [
      { key: 'level', label: 'Level' },
      { key: 'hp', label: 'HP' },
      { key: 'mp', label: 'MP' },
      { key: 'ac', label: 'AC' },
      { key: 'str', label: 'STR' },
      { key: 'sta', label: 'STA' },
      { key: 'agi', label: 'AGI' },
      { key: 'dex', label: 'DEX' },
      { key: 'wis', label: 'WIS' },
      { key: 'int', label: 'INT' },
      { key: 'cha', label: 'CHA' },
      { key: 'min_dmg', label: 'Min Damage' },
      { key: 'max_dmg', label: 'Max Damage' },
      { key: 'attack_speed', label: 'Attack Speed' }
    ]
    
    // Initialize stats when dialog opens
    watch(() => props.visible, (newVal) => {
      if (newVal && props.npc) {
        proposalNotes.value = ''
        // Copy current stats
        statFields.forEach(field => {
          currentStats[field.key] = props.npc[field.key] || 0
          proposedStats[field.key] = props.npc[field.key] || 0
        })
      }
    })
    
    // Check if there are any changes
    const hasChanges = computed(() => {
      return statFields.some(field => 
        proposedStats[field.key] !== currentStats[field.key]
      )
    })
    
    // Get list of changes
    const changesList = computed(() => {
      return statFields
        .filter(field => proposedStats[field.key] !== currentStats[field.key])
        .map(field => ({
          field: field.key,
          label: field.label,
          old: currentStats[field.key],
          new: proposedStats[field.key]
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
        // Build current and proposed data
        const currentData = {}
        const proposedData = {
          npcid: props.npc.npcid,
          name: props.npc.name,
          npc_type: props.npc.npc_type
        }
        
        // Include only changed fields
        changesList.value.forEach(change => {
          currentData[change.field] = change.old
          proposedData[change.field] = change.new
        })
        
        const proposalPayload = {
          change_type: 'edit_npc',
          target_type: 'npc',
          target_id: props.npc.id,
          current_data: currentData,
          proposed_data: proposedData,
          notes: proposalNotes.value
        }
        
        // console.log('Submitting NPC edit proposal:', proposalPayload)
        
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
        
        success('NPC edit proposal submitted successfully!')
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
      currentStats,
      proposedStats,
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
  max-width: 900px;
  width: 90%;
  max-height: 90vh;
  display: flex;
  overflow: hidden;
  flex-direction: column;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
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

.npc-info {
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #333;
}

.npc-info h3 {
  margin: 0 0 0.5rem 0;
  color: #FFD700;
}

.npc-details {
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

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 2rem;
}

.stat-group {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.stat-group h4 {
  margin: 0 0 0.5rem 0;
  color: #FFD700;
  font-size: 1.1rem;
  border-bottom: 1px solid #333;
  padding-bottom: 0.5rem;
}

.form-row {
  display: grid;
  grid-template-columns: 80px minmax(80px, 100px) 1fr;
  align-items: center;
  gap: 0.5rem;
}

.form-row label {
  font-weight: 500;
  color: #ccc;
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

.change-indicator {
  color: #888;
  font-size: 0.75rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  font-weight: 500;
  color: #ccc;
}

textarea.form-control {
  resize: vertical;
  min-height: 80px;
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
  
  .stats-grid {
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }
  
  .form-row {
    grid-template-columns: 60px minmax(60px, 80px) 1fr;
    font-size: 0.85rem;
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
  .form-row {
    grid-template-columns: 50px 60px 1fr;
    gap: 0.25rem;
  }
  
  .form-row label {
    font-size: 0.8rem;
  }
}
</style>