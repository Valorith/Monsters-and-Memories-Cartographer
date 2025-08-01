<template>
  <div v-if="visible" class="modal-overlay" @click.self="handleClose">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h2>Catalog Game NPC</h2>
        <button class="close-btn" @click="handleClose">×</button>
      </div>
      
      <div class="modal-body">
        <div class="info-box">
          <span class="info-icon">📚</span>
          <div class="info-content">
            <p class="info-title">NPC Cataloging Guidelines</p>
            <ul class="guideline-list">
              <li>Only catalog NPCs that actually exist in Monsters & Memories</li>
              <li>Use the exact name and stats from the game</li>
              <li>Verify all information is accurate before submitting</li>
              <li>Include the NPC type (Combat, Quest, Vendor, etc.)</li>
              <li>Choose icons that closely match the in-game appearance</li>
            </ul>
          </div>
        </div>
        
        <form @submit.prevent="submitProposal" class="proposal-form">
          <h3>NPC Details</h3>
          
          <div class="form-row">
            <div class="form-group">
              <label for="npc-name">Name *</label>
              <input 
                id="npc-name"
                v-model="formData.name" 
                type="text" 
                class="form-control"
                placeholder="Enter NPC name from game..."
                required
                maxlength="255"
              />
            </div>
            
            <div class="form-group">
              <label for="npc-level">Level</label>
              <input 
                id="npc-level"
                v-model.number="formData.level" 
                type="number" 
                class="form-control"
                placeholder="0"
                min="0"
                max="999"
              />
            </div>
          </div>
          
          <div class="form-group">
            <label for="npc-type">Type</label>
            <select 
              id="npc-type"
              v-model="formData.npc_type" 
              class="form-control"
            >
              <option value="">-- Select Type --</option>
              <option v-for="type in npcTypes" :key="type" :value="type">
                {{ type }}
              </option>
            </select>
          </div>
          
          <div class="form-group">
            <label for="npc-description">Description</label>
            <textarea 
              id="npc-description"
              v-model="formData.description" 
              class="form-control" 
              rows="3"
              placeholder="Describe the NPC's appearance, personality, and role..."
            ></textarea>
          </div>
          
          
          <!-- Stats Section -->
          <h4>NPC Stats</h4>
          <div class="stats-grid">
            <div class="form-group">
              <label for="npc-hp">Health Points (HP)</label>
              <input 
                id="npc-hp"
                v-model.number="formData.hp" 
                type="number" 
                class="form-control"
                placeholder="100"
                min="0"
              />
            </div>
            
            <div class="form-group">
              <label for="npc-mp">Mana Points (MP)</label>
              <input 
                id="npc-mp"
                v-model.number="formData.mp" 
                type="number" 
                class="form-control"
                placeholder="0"
                min="0"
              />
            </div>
            
            <div class="form-group">
              <label for="npc-ac">Armor Class (AC)</label>
              <input 
                id="npc-ac"
                v-model.number="formData.ac" 
                type="number" 
                class="form-control"
                placeholder="0"
                min="0"
              />
            </div>
            
            <div class="form-group">
              <label for="npc-attack-speed">Attack Speed</label>
              <input 
                id="npc-attack-speed"
                v-model.number="formData.attack_speed" 
                type="number" 
                class="form-control"
                placeholder="0"
                min="0"
                step="0.1"
              />
            </div>
            
            <div class="form-group">
              <label for="npc-str">Strength</label>
              <input 
                id="npc-str"
                v-model.number="formData.str" 
                type="number" 
                class="form-control"
                placeholder="10"
                min="0"
              />
            </div>
            
            <div class="form-group">
              <label for="npc-sta">Stamina</label>
              <input 
                id="npc-sta"
                v-model.number="formData.sta" 
                type="number" 
                class="form-control"
                placeholder="10"
                min="0"
              />
            </div>
            
            <div class="form-group">
              <label for="npc-agi">Agility</label>
              <input 
                id="npc-agi"
                v-model.number="formData.agi" 
                type="number" 
                class="form-control"
                placeholder="10"
                min="0"
              />
            </div>
            
            <div class="form-group">
              <label for="npc-dex">Dexterity</label>
              <input 
                id="npc-dex"
                v-model.number="formData.dex" 
                type="number" 
                class="form-control"
                placeholder="10"
                min="0"
              />
            </div>
            
            <div class="form-group">
              <label for="npc-wis">Wisdom</label>
              <input 
                id="npc-wis"
                v-model.number="formData.wis" 
                type="number" 
                class="form-control"
                placeholder="10"
                min="0"
              />
            </div>
            
            <div class="form-group">
              <label for="npc-int">Intelligence</label>
              <input 
                id="npc-int"
                v-model.number="formData.int" 
                type="number" 
                class="form-control"
                placeholder="10"
                min="0"
              />
            </div>
            
            <div class="form-group">
              <label for="npc-cha">Charisma</label>
              <input 
                id="npc-cha"
                v-model.number="formData.cha" 
                type="number" 
                class="form-control"
                placeholder="10"
                min="0"
              />
            </div>
            
            <div class="form-group">
              <label for="npc-min-dmg">Minimum Damage</label>
              <input 
                id="npc-min-dmg"
                v-model.number="formData.min_dmg" 
                type="number" 
                class="form-control"
                placeholder="0"
                min="0"
              />
            </div>
            
            <div class="form-group">
              <label for="npc-max-dmg">Maximum Damage</label>
              <input 
                id="npc-max-dmg"
                v-model.number="formData.max_dmg" 
                type="number" 
                class="form-control"
                placeholder="0"
                min="0"
              />
            </div>
          </div>
          
          <div class="form-group">
            <label for="proposal-notes">Justification (required) *</label>
            <textarea 
              id="proposal-notes"
              v-model="proposalNotes" 
              class="form-control" 
              rows="4"
              placeholder="Explain why this NPC should be cataloged. Provide details about where it's found in Monsters &amp; Memories."
              required
            ></textarea>
          </div>
          
          <div class="form-actions">
            <button type="submit" class="submit-btn" :disabled="!isFormValid || submitting">
              {{ submitting ? 'Submitting...' : 'Submit Proposal' }}
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
import { ref, computed, watch } from 'vue'
import { useToast } from '../composables/useToast'
import { useCSRF } from '../composables/useCSRF'

export default {
  name: 'NPCProposalDialog',
  props: {
    visible: {
      type: Boolean,
      default: false
    }
  },
  emits: ['close', 'submitted'],
  setup(props, { emit }) {
    const { success, error } = useToast()
    const { fetchWithCSRF } = useCSRF()
    
    const formData = ref({
      name: '',
      npc_type: '',
      level: 0,
      description: '',
      hp: 0,
      mp: 0,
      ac: 0,
      str: 0,
      sta: 0,
      agi: 0,
      dex: 0,
      wis: 0,
      int: 0,
      cha: 0,
      attack_speed: 0,
      min_dmg: 0,
      max_dmg: 0
    })
    
    const proposalNotes = ref('')
    const submitting = ref(false)
    
    const npcTypes = [
      'Combat NPC', 'Quest NPC'
    ]
    
    
    const isFormValid = computed(() => {
      return formData.value.name.trim() && 
             formData.value.npc_type && 
             proposalNotes.value.trim()
    })
    
    // Reset form when dialog opens
    watch(() => props.visible, (newVal) => {
      if (newVal) {
        resetForm()
      }
    })
    
    const resetForm = () => {
      formData.value = {
        name: '',
        npc_type: '',
        level: 0,
        description: '',
        hp: 0,
        mp: 0,
        ac: 0,
        str: 0,
        sta: 0,
        agi: 0,
        dex: 0,
        wis: 0,
        int: 0,
        cha: 0,
        attack_speed: 0,
        min_dmg: 0,
        max_dmg: 0
      }
      proposalNotes.value = ''
    }
    
    
    const submitProposal = async () => {
      if (!isFormValid.value) {
        error('Please fill in all required fields')
        return
      }
      
      submitting.value = true
      
      try {
        const proposalData = {
          change_type: 'add_npc',
          target_type: 'npc',
          target_id: null,
          current_data: {},
          proposed_data: {
            name: formData.value.name.trim(),
            icon_type: 'emoji',
            icon_value: formData.value.npc_type === 'Combat NPC' ? '💀' : '❓',
            npc_type: formData.value.npc_type || null,
            level: formData.value.level || 0,
            description: formData.value.description.trim() || null,
            hp: formData.value.hp || 0,
            mp: formData.value.mp || 0,
            ac: formData.value.ac || 0,
            str: formData.value.str || 0,
            sta: formData.value.sta || 0,
            agi: formData.value.agi || 0,
            dex: formData.value.dex || 0,
            wis: formData.value.wis || 0,
            int: formData.value.int || 0,
            cha: formData.value.cha || 0,
            attack_speed: formData.value.attack_speed || 0,
            min_dmg: formData.value.min_dmg || 0,
            max_dmg: formData.value.max_dmg || 0
          },
          notes: proposalNotes.value.trim()
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
        
        success('NPC proposal submitted for community voting')
        emit('submitted')
        handleClose()
      } catch (err) {
        error(err.message || 'Failed to submit proposal')
      } finally {
        submitting.value = false
      }
    }
    
    const handleClose = () => {
      emit('close')
    }
    
    return {
      formData,
      proposalNotes,
      submitting,
      npcTypes,
      isFormValid,
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
  overflow-y: auto;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #444;
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(249, 115, 22, 0.05));
}

.modal-header h2 {
  margin: 0;
  color: #f97316;
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
}

.info-box {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 8px;
  margin-bottom: 1.5rem;
}

.info-icon {
  font-size: 1.5rem;
  color: #f97316;
}

.info-content {
  flex: 1;
}

.info-title {
  margin: 0 0 0.5rem 0;
  color: #f97316;
  font-weight: 600;
}

.guideline-list {
  margin: 0;
  padding-left: 1.2rem;
  color: #fed7aa;
  font-size: 0.9rem;
  line-height: 1.4;
}

.guideline-list li {
  margin-bottom: 0.25rem;
}

.proposal-form h3 {
  margin: 0 0 1rem 0;
  color: #f97316;
  font-size: 1.1rem;
}

.proposal-form h4 {
  margin: 1.5rem 0 1rem 0;
  color: #f97316;
  font-size: 1rem;
  border-bottom: 1px solid #444;
  padding-bottom: 0.5rem;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 1rem;
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
  border-color: #f97316;
  background: #262626;
}

.form-control::placeholder {
  color: #666;
}

textarea.form-control {
  resize: vertical;
  min-height: 80px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
  margin-bottom: 1rem;
}


.help-text {
  color: #999;
  font-size: 0.85rem;
  margin-top: 0.5rem;
}

.help-text a {
  color: #f97316;
  text-decoration: none;
}

.help-text a:hover {
  text-decoration: underline;
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
  background: #f97316;
  color: white;
}

.submit-btn:hover:not(:disabled) {
  background: #ea580c;
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

@media (max-width: 768px) {
  .form-row {
    grid-template-columns: 1fr;
  }
  
  .stats-grid {
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  }
  
  .emoji-categories {
    justify-content: center;
  }
}
</style>