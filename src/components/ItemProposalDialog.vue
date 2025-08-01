<template>
  <div v-if="visible" class="modal-overlay" @click.self="handleClose">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h2>Catalog Game Item</h2>
        <button class="close-btn" @click="handleClose">×</button>
      </div>
      
      <div class="modal-body">
        <div class="info-box">
          <span class="info-icon">📚</span>
          <div class="info-content">
            <p class="info-title">Item Cataloging Guidelines</p>
            <ul class="guideline-list">
              <li>Only catalog items that actually exist in Monsters & Memories</li>
              <li>Use the exact name and stats from the game</li>
              <li>Verify all information is accurate before submitting</li>
              <li>Choose icons that closely match the in-game appearance</li>
            </ul>
          </div>
        </div>
        
        <form @submit.prevent="submitProposal" class="proposal-form">
          <h3>Item Details</h3>
          
          <div class="form-group">
            <label for="item-name">Name *</label>
            <input 
              id="item-name"
              v-model="formData.name" 
              type="text" 
              class="form-control"
              placeholder="Enter item name from game..."
              required
              maxlength="100"
            />
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label for="item-type">Type</label>
              <select 
                id="item-type"
                v-model="formData.item_type" 
                class="form-control"
              >
                <option value="">-- Select Type --</option>
                <option v-for="type in itemTypes" :key="type" :value="type">
                  {{ type }}
                </option>
              </select>
            </div>
            
            <div class="form-group">
              <label for="item-slot">Slot</label>
              <select 
                id="item-slot"
                v-model="formData.slot" 
                class="form-control"
              >
                <option value="">-- Select Slot --</option>
                <option v-for="slot in itemSlots" :key="slot" :value="slot">
                  {{ slot }}
                </option>
              </select>
            </div>
          </div>
          
          
          <!-- Icon Selection -->
          <div class="form-group">
            <label>Icon *</label>
            <div class="icon-selection">
              <div class="icon-type-buttons">
                <button 
                  v-for="iconType in iconTypes" 
                  :key="iconType.value"
                  @click="formData.icon_type = iconType.value"
                  :class="['icon-type-btn', { active: formData.icon_type === iconType.value }]"
                  type="button"
                >
                  {{ iconType.label }}
                </button>
              </div>
              
              <!-- Emoji Picker -->
              <div v-if="formData.icon_type === 'emoji'" class="icon-input-group">
                <div class="icon-preview-input">
                  <input 
                    v-model="formData.icon_value" 
                    type="text" 
                    class="form-control icon-input"
                    placeholder="Select or type emoji..."
                    required
                  />
                  <button 
                    @click="showEmojiPicker = !showEmojiPicker"
                    class="emoji-picker-btn"
                    type="button"
                  >
                    {{ formData.icon_value || '😊' }}
                  </button>
                </div>
                
                <div v-if="showEmojiPicker" class="emoji-picker">
                  <div class="emoji-categories">
                    <button 
                      v-for="category in emojiCategories" 
                      :key="category.name"
                      @click="selectedEmojiCategory = category.name"
                      :class="['category-btn', { active: selectedEmojiCategory === category.name }]"
                      type="button"
                    >
                      {{ category.icon }}
                    </button>
                  </div>
                  <div class="emoji-grid">
                    <button 
                      v-for="emoji in currentCategoryEmojis" 
                      :key="emoji"
                      @click="selectEmoji(emoji)"
                      class="emoji-option"
                      type="button"
                    >
                      {{ emoji }}
                    </button>
                  </div>
                </div>
              </div>

              <!-- Iconify Input -->
              <div v-if="formData.icon_type === 'iconify'" class="icon-input-group">
                <input 
                  v-model="formData.icon_value" 
                  type="text" 
                  class="form-control"
                  placeholder="e.g., mdi:sword"
                  required
                />
                <p class="help-text">
                  <a href="https://iconify.design/" target="_blank">Browse Iconify icons →</a>
                </p>
              </div>
            </div>
          </div>
          
          <!-- Stats Section -->
          <h4>Item Stats</h4>
          <div class="stats-grid">
            <div class="form-group">
              <label for="item-str">Strength</label>
              <input 
                id="item-str"
                v-model.number="formData.str" 
                type="number" 
                class="form-control"
                placeholder="0"
                min="0"
              />
            </div>
            
            <div class="form-group">
              <label for="item-sta">Stamina</label>
              <input 
                id="item-sta"
                v-model.number="formData.sta" 
                type="number" 
                class="form-control"
                placeholder="0"
                min="0"
              />
            </div>
            
            <div class="form-group">
              <label for="item-agi">Agility</label>
              <input 
                id="item-agi"
                v-model.number="formData.agi" 
                type="number" 
                class="form-control"
                placeholder="0"
                min="0"
              />
            </div>
            
            <div class="form-group">
              <label for="item-dex">Dexterity</label>
              <input 
                id="item-dex"
                v-model.number="formData.dex" 
                type="number" 
                class="form-control"
                placeholder="0"
                min="0"
              />
            </div>
            
            <div class="form-group">
              <label for="item-wis">Wisdom</label>
              <input 
                id="item-wis"
                v-model.number="formData.wis" 
                type="number" 
                class="form-control"
                placeholder="0"
                min="0"
              />
            </div>
            
            <div class="form-group">
              <label for="item-int">Intelligence</label>
              <input 
                id="item-int"
                v-model.number="formData.int" 
                type="number" 
                class="form-control"
                placeholder="0"
                min="0"
              />
            </div>
            
            <div class="form-group">
              <label for="item-cha">Charisma</label>
              <input 
                id="item-cha"
                v-model.number="formData.cha" 
                type="number" 
                class="form-control"
                placeholder="0"
                min="0"
              />
            </div>
            
            <div class="form-group">
              <label for="item-ac">Armor Class</label>
              <input 
                id="item-ac"
                v-model.number="formData.ac" 
                type="number" 
                class="form-control"
                placeholder="0"
                min="0"
              />
            </div>
            
            <div class="form-group">
              <label for="item-health">Health</label>
              <input 
                id="item-health"
                v-model.number="formData.health" 
                type="number" 
                class="form-control"
                placeholder="0"
                min="0"
              />
            </div>
            
            <div class="form-group">
              <label for="item-mana">Mana</label>
              <input 
                id="item-mana"
                v-model.number="formData.mana" 
                type="number" 
                class="form-control"
                placeholder="0"
                min="0"
              />
            </div>
            
            <div class="form-group">
              <label for="item-attack-speed">Attack Speed</label>
              <input 
                id="item-attack-speed"
                v-model.number="formData.attack_speed" 
                type="number" 
                class="form-control"
                placeholder="0.0"
                min="0"
                step="0.1"
              />
            </div>
          </div>
          
          <div class="form-group">
            <label for="item-description">Description</label>
            <textarea 
              id="item-description"
              v-model="formData.description" 
              class="form-control" 
              rows="3"
              placeholder="Describe the item's appearance and special properties..."
            ></textarea>
          </div>
          
          <div class="form-group">
            <label for="proposal-notes">Justification (required) *</label>
            <textarea 
              id="proposal-notes"
              v-model="proposalNotes" 
              class="form-control" 
              rows="3"
              placeholder="Explain why this item should be cataloged. Provide details about where it's found in Monsters &amp; Memories..."
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
  name: 'ItemProposalDialog',
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
      icon_type: 'emoji',
      icon_value: '',
      item_type: '',
      slot: '',
      str: 0,
      sta: 0,
      agi: 0,
      dex: 0,
      wis: 0,
      int: 0,
      cha: 0,
      attack_speed: 0,
      health: 0,
      mana: 0,
      ac: 0,
      description: ''
    })
    
    const proposalNotes = ref('')
    const submitting = ref(false)
    const showEmojiPicker = ref(false)
    const selectedEmojiCategory = ref('items')
    
    const iconTypes = [
      { label: 'Emoji', value: 'emoji' },
      { label: 'Iconify', value: 'iconify' }
    ]
    
    const itemTypes = [
      'Weapon', 'Armor', 'Shield', 'Accessory', 'Consumable', 
      'Tool', 'Quest Item', 'Material', 'Gem', 'Scroll', 
      'Potion', 'Food', 'Key', 'Book', 'Container'
    ]
    
    const itemSlots = [
      'Primary Hand', 'Off Hand', 'Two-Handed', 'Head', 'Chest', 
      'Legs', 'Feet', 'Hands', 'Arms', 'Waist', 'Neck', 'Finger', 
      'Ear', 'Back', 'Face', 'Shoulder', 'Wrist', 'Charm', 'Ammo'
    ]
    
    const emojiCategories = [
      { name: 'items', icon: '💰', emojis: ['💰', '💵', '💴', '💶', '💷', '💸', '💳', '🪙', '⚱️', '🏺', '🕯️', '💡', '🔦', '🏮', '🪔', '📦', '🎁', '🎀', '🎗️', '🏵️', '🏅', '🥇', '🥈', '🥉', '🏆', '🎖️', '🎪', '🎭', '🎨', '🎬', '🎤', '🎧', '🎼', '🎵', '🎶', '🎹', '🥁', '🎷', '🎺', '🎸', '🎻', '🎲', '🎯'] },
      { name: 'weapons', icon: '⚔️', emojis: ['⚔️', '🗡️', '🏹', '🛡️', '🪃', '🏏', '⚰️', '🪦', '💀', '☠️', '🎯', '🔮', '📿', '🏺', '⚗️', '🧪', '💉', '🩸', '🧬', '🦴', '🦷', '👑', '🎩', '🎓', '🪖', '⛑️', '📯', '🎺', '🥁', '🪘', '🔔', '📜', '📃', '📄', '🗞️', '🔖', '🏷️', '💼', '🎒', '👝', '👛', '👜'] },
      { name: 'armor', icon: '🛡️', emojis: ['🛡️', '⛑️', '🪖', '👑', '🎩', '🎓', '👘', '🥼', '🦺', '👕', '👔', '👗', '👚', '👖', '🩳', '🩱', '👙', '👠', '👡', '👢', '👞', '👟', '🥾', '🥿', '🧦', '🧤', '🧣', '🎽', '👤', '🧥', '🥻', '👯', '🕴️', '💃', '🕺', '👫', '👬', '👭', '💑', '👨‍❤️‍👨', '👩‍❤️‍👩'] },
      { name: 'gems', icon: '💎', emojis: ['💎', '💍', '📿', '🔷', '🔶', '🟫', '⬜', '⬛', '🟥', '🟦', '🟩', '🟨', '🟧', '🟪', '🔳', '🔲', '◼️', '◻️', '◾', '◽', '▪️', '▫️', '🔸', '🔹', '🔺', '🔻', '💠', '🔘', '⚪', '⚫', '🟤', '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⭕', '🅾️', '🆔', '📛', '🚩'] },
      { name: 'potions', icon: '🧪', emojis: ['🧪', '⚗️', '🍶', '🍾', '🍷', '🥂', '🍸', '🍹', '🧃', '🧊', '🍯', '🍼', '🥛', '☕', '🍵', '🫖', '🧈', '🥫', '🍱', '🥘', '🍲', '🥣', '🥗', '🍿', '🧂', '🍺', '🍻', '🍸', '🍹', '🧋', '🥤', '🧉', '🫗', '🍇', '🍈', '🍉', '🍊', '🍋', '🍌', '🍍', '🥭', '🍎'] },
      { name: 'books', icon: '📚', emojis: ['📚', '📖', '📗', '📘', '📙', '📓', '📔', '📒', '📕', '📑', '📄', '📃', '📜', '📋', '📊', '📈', '📉', '🗒️', '🗓️', '📆', '📅', '🗑️', '📇', '🗃️', '🗳️', '🗄️', '📁', '📂', '🗂️', '🗞️', '📰', '📖', '📝', '✏️', '✒️', '🖋️', '🖊️', '🖌️', '🔍', '🔎', '🔏', '🔐', '🔒', '🔓'] },
      { name: 'tools', icon: '🔨', emojis: ['🔨', '⚒️', '🛠️', '⛏️', '🪓', '🪚', '🔧', '🪛', '🔩', '⚙️', '🪜', '⛓️', '🧱', '🪙', '🥈', '🥇', '🥉', '🏗️', '🔗', '📎', '🖇️', '📐', '📏', '📌', '📍', '✂️', '🗜️', '⚖️', '🦯', '🔱', '🪝', '🧲', '🪄', '🔮', '🪩', '🎪', '🎨', '🖼️', '🎭', '🎬', '🎤', '🎧', '🎼'] }
    ]
    
    const currentCategoryEmojis = computed(() => {
      const category = emojiCategories.find(c => c.name === selectedEmojiCategory.value)
      return category ? category.emojis : []
    })
    
    const isFormValid = computed(() => {
      return formData.value.name.trim() && 
             formData.value.icon_value.trim() && 
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
        icon_type: 'emoji',
        icon_value: '',
        item_type: '',
        slot: '',
        str: 0,
        sta: 0,
        agi: 0,
        dex: 0,
        wis: 0,
        int: 0,
        cha: 0,
        attack_speed: 0,
        health: 0,
        mana: 0,
        ac: 0,
        description: ''
      }
      proposalNotes.value = ''
      showEmojiPicker.value = false
    }
    
    const selectEmoji = (emoji) => {
      formData.value.icon_value = emoji
      showEmojiPicker.value = false
    }
    
    const submitProposal = async () => {
      if (!isFormValid.value) {
        error('Please fill in all required fields')
        return
      }
      
      submitting.value = true
      
      try {
        const proposalData = {
          change_type: 'add_item',
          target_type: 'item',
          target_id: null,
          current_data: {},
          proposed_data: {
            name: formData.value.name.trim(),
            icon_type: formData.value.icon_type,
            icon_value: formData.value.icon_value.trim(),
            item_type: formData.value.item_type || null,
            slot: formData.value.slot || null,
            str: formData.value.str || 0,
            sta: formData.value.sta || 0,
            agi: formData.value.agi || 0,
            dex: formData.value.dex || 0,
            wis: formData.value.wis || 0,
            int: formData.value.int || 0,
            cha: formData.value.cha || 0,
            attack_speed: formData.value.attack_speed || 0,
            health: formData.value.health || 0,
            mana: formData.value.mana || 0,
            ac: formData.value.ac || 0,
            description: formData.value.description.trim() || null
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
        
        success('Item proposal submitted for community voting')
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
      showEmojiPicker,
      selectedEmojiCategory,
      iconTypes,
      itemTypes,
      itemSlots,
      emojiCategories,
      currentCategoryEmojis,
      isFormValid,
      selectEmoji,
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
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(34, 197, 94, 0.05));
}

.modal-header h2 {
  margin: 0;
  color: #22c55e;
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
  background: rgba(34, 197, 94, 0.1);
  border: 1px solid rgba(34, 197, 94, 0.3);
  border-radius: 8px;
  margin-bottom: 1.5rem;
}

.info-icon {
  font-size: 1.5rem;
  color: #22c55e;
}

.info-content {
  flex: 1;
}

.info-title {
  margin: 0 0 0.5rem 0;
  color: #22c55e;
  font-weight: 600;
}

.guideline-list {
  margin: 0;
  padding-left: 1.2rem;
  color: #86efac;
  font-size: 0.9rem;
  line-height: 1.4;
}

.guideline-list li {
  margin-bottom: 0.25rem;
}

.proposal-form h3 {
  margin: 0 0 1rem 0;
  color: #22c55e;
  font-size: 1.1rem;
}

.proposal-form h4 {
  margin: 1.5rem 0 1rem 0;
  color: #22c55e;
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
  border-color: #22c55e;
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

.icon-selection {
  border: 1px solid #444;
  border-radius: 6px;
  background: #1a1a1a;
  padding: 0.75rem;
}

.icon-type-buttons {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.icon-type-btn {
  padding: 0.5rem 1rem;
  background: #333;
  border: 1px solid #555;
  border-radius: 4px;
  color: #ccc;
  cursor: pointer;
  transition: all 0.2s;
}

.icon-type-btn.active,
.icon-type-btn:hover {
  background: #22c55e;
  border-color: #22c55e;
  color: white;
}

.icon-input-group {
  position: relative;
}

.icon-preview-input {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.icon-input {
  flex: 1;
}

.emoji-picker-btn {
  padding: 0.75rem;
  background: #333;
  border: 1px solid #555;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1.2rem;
  transition: all 0.2s;
}

.emoji-picker-btn:hover {
  background: #444;
}

.emoji-picker {
  margin-top: 0.75rem;
  padding: 0.75rem;
  background: #222;
  border-radius: 6px;
  border: 1px solid #444;
}

.emoji-categories {
  display: flex;
  gap: 0.25rem;
  margin-bottom: 0.75rem;
  flex-wrap: wrap;
}

.category-btn {
  padding: 0.5rem;
  background: #333;
  border: 1px solid #555;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1.1rem;
  transition: all 0.2s;
}

.category-btn.active,
.category-btn:hover {
  background: #22c55e;
  border-color: #22c55e;
}

.emoji-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(40px, 1fr));
  gap: 0.25rem;
  max-height: 200px;
  overflow-y: auto;
}

.emoji-option {
  padding: 0.5rem;
  background: none;
  border: 1px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1.2rem;
  transition: all 0.2s;
}

.emoji-option:hover {
  background: #333;
  border-color: #555;
}

.help-text {
  color: #999;
  font-size: 0.85rem;
  margin-top: 0.5rem;
}

.help-text a {
  color: #22c55e;
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
  background: #22c55e;
  color: white;
}

.submit-btn:hover:not(:disabled) {
  background: #16a34a;
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