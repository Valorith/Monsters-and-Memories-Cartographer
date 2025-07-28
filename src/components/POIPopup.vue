<template>
  <div v-if="visible" class="poi-popup" :class="{ 'left-side': isLeftSide }" :style="popupStyle" @click.stop>
    <div class="poi-popup-header">
      <div v-if="!isEditing.name" class="editable-field" :class="{ editable: isAdmin }">
        <h3 @click="isAdmin && startEdit('name')">
          {{ localPoi.name }}
        </h3>
        <button v-if="isAdmin" class="field-delete-btn" @click.stop="deleteField('name')" title="Clear name">×</button>
      </div>
      <input 
        v-else
        v-model="localPoi.name"
        @keyup.enter="saveEdit('name')"
        @keyup.esc="cancelEdit"
        @blur="saveEdit('name')"
        ref="nameInput"
        class="edit-input"
      />
      <button class="close-btn" @click="$emit('close')">×</button>
    </div>
    <div class="poi-popup-content">
      <div v-if="!isEditing.description" class="editable-field" :class="{ editable: isAdmin }">
        <p @click="isAdmin && startEdit('description')">
          {{ localPoi.description || 'No description available' }}
        </p>
        <button v-if="isAdmin && localPoi.description" class="field-delete-btn" @click.stop="deleteField('description')" title="Clear description">×</button>
      </div>
      <textarea
        v-else
        v-model="localPoi.description"
        @keyup.enter.ctrl="saveEdit('description')"
        @keyup.esc="cancelEdit"
        @blur="saveEdit('description')"
        ref="descriptionInput"
        class="edit-textarea"
        rows="3"
        placeholder="Enter description..."
      ></textarea>
      
      <div class="poi-type">
        <span class="type-icon">{{ getTypeIcon(localPoi.type) }}</span>
        <span v-if="!isEditing.type" @click="isAdmin && startEdit('type')" class="type-text" :class="{ editable: isAdmin }">
          {{ formatType(localPoi.type) }}
        </span>
        <select
          v-else
          v-model="localPoi.type"
          @change="saveEdit('type')"
          @blur="saveEdit('type')"
          ref="typeSelect"
          class="edit-select"
        >
          <option value="landmark">Landmark</option>
          <option value="quest">Quest</option>
          <option value="merchant">Merchant</option>
          <option value="npc">NPC</option>
          <option value="dungeon">Dungeon</option>
          <option value="other">Other</option>
        </select>
      </div>
      
      <p v-if="isAdmin" class="edit-hint">Click any field to edit</p>
      
      <button v-if="isAdmin" class="delete-btn" @click="handleDelete">
        Delete POI
      </button>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch, nextTick } from 'vue'

export default {
  name: 'POIPopup',
  props: {
    poi: {
      type: Object,
      required: true
    },
    visible: {
      type: Boolean,
      default: false
    },
    position: {
      type: Object,
      default: () => ({ x: 0, y: 0 })
    },
    isAdmin: {
      type: Boolean,
      default: false
    },
    isLeftSide: {
      type: Boolean,
      default: false
    }
  },
  emits: ['close', 'delete', 'update', 'confirmUpdate'],
  setup(props, { emit }) {
    const localPoi = ref({ ...props.poi })
    const originalValues = ref({})
    const isEditing = ref({
      name: false,
      description: false,
      type: false
    })
    
    const nameInput = ref(null)
    const descriptionInput = ref(null)
    const typeSelect = ref(null)
    
    // Update local POI when prop changes
    watch(() => props.poi, (newPoi) => {
      localPoi.value = { ...newPoi }
    }, { deep: true })
    
    const popupStyle = computed(() => ({
      left: `${props.position.x}px`,
      top: `${props.position.y}px`
    }))
    
    const getTypeIcon = (type) => {
      const icons = {
        landmark: '🏛️',
        quest: '❗',
        merchant: '💰',
        npc: '💀',
        dungeon: '⚔️',
        other: '📍'
      }
      return icons[type] || '📍'
    }
    
    const formatType = (type) => {
      return type.charAt(0).toUpperCase() + type.slice(1)
    }
    
    const startEdit = async (field) => {
      if (!props.isAdmin) return
      
      // Store original value
      originalValues.value[field] = localPoi.value[field]
      
      // Reset all edit states
      Object.keys(isEditing.value).forEach(key => {
        isEditing.value[key] = false
      })
      
      // Enable editing for this field
      isEditing.value[field] = true
      
      // Focus the input after render
      await nextTick()
      if (field === 'name' && nameInput.value) {
        nameInput.value.focus()
        nameInput.value.select()
      } else if (field === 'description' && descriptionInput.value) {
        descriptionInput.value.focus()
        descriptionInput.value.select()
      } else if (field === 'type' && typeSelect.value) {
        typeSelect.value.focus()
      }
    }
    
    const saveEdit = (field) => {
      const oldValue = originalValues.value[field]
      const newValue = localPoi.value[field]
      
      // Only emit update if value changed
      if (oldValue !== newValue) {
        emit('confirmUpdate', {
          id: props.poi.id,
          field,
          oldValue,
          newValue,
          poi: { ...localPoi.value }
        })
      }
      
      isEditing.value[field] = false
      originalValues.value[field] = null
    }
    
    const cancelEdit = () => {
      // Restore original values
      Object.keys(originalValues.value).forEach(field => {
        if (originalValues.value[field] !== undefined) {
          localPoi.value[field] = originalValues.value[field]
        }
      })
      
      // Reset edit states
      Object.keys(isEditing.value).forEach(key => {
        isEditing.value[key] = false
      })
      
      originalValues.value = {}
    }
    
    const handleDelete = () => {
      emit('delete', props.poi.id)
    }
    
    const deleteField = (field) => {
      const oldValue = localPoi.value[field]
      
      // Don't allow deleting the name field if it's already empty
      if (field === 'name' && !oldValue) return
      
      emit('confirmUpdate', {
        id: props.poi.id,
        field,
        oldValue,
        newValue: field === 'name' ? 'Unnamed POI' : '', // Name can't be empty
        poi: { ...localPoi.value, [field]: field === 'name' ? 'Unnamed POI' : '' }
      })
    }
    
    return {
      localPoi,
      isEditing,
      nameInput,
      descriptionInput,
      typeSelect,
      popupStyle,
      getTypeIcon,
      formatType,
      startEdit,
      saveEdit,
      cancelEdit,
      handleDelete,
      deleteField
    }
  }
}
</script>

<style scoped>
.poi-popup {
  position: absolute;
  background: rgba(45, 45, 45, 0.95);
  border: 1px solid #555;
  border-radius: 8px;
  padding: 1rem;
  min-width: 200px;
  max-width: 300px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  z-index: 1000;
}

/* Add a speech bubble tail pointing to the POI */
.poi-popup::before {
  content: '';
  position: absolute;
  left: -10px;
  top: 20px;
  width: 0;
  height: 0;
  border-style: solid;
  border-width: 10px 10px 10px 0;
  border-color: transparent #555 transparent transparent;
}

.poi-popup::after {
  content: '';
  position: absolute;
  left: -9px;
  top: 20px;
  width: 0;
  height: 0;
  border-style: solid;
  border-width: 10px 10px 10px 0;
  border-color: transparent rgba(45, 45, 45, 0.95) transparent transparent;
}

/* Flip the tail when popup is on the left side */
.poi-popup.left-side::before {
  left: auto;
  right: -10px;
  border-width: 10px 0 10px 10px;
  border-color: transparent transparent transparent #555;
}

.poi-popup.left-side::after {
  left: auto;
  right: -9px;
  border-width: 10px 0 10px 10px;
  border-color: transparent transparent transparent rgba(45, 45, 45, 0.95);
}

.poi-popup-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.poi-popup-header h3 {
  margin: 0;
  font-size: 1.1rem;
  color: #fff;
}

.editable-field {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  flex: 1;
  margin-right: 20px; /* Space for delete button */
}

.poi-popup-header .editable-field {
  max-width: calc(100% - 40px); /* Account for close button */
}

.editable-field.editable h3,
.editable-field.editable p {
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.editable-field.editable:hover h3,
.editable-field.editable:hover p {
  background: rgba(255, 255, 255, 0.1);
}

.field-delete-btn {
  display: none;
  position: absolute;
  right: -20px;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(220, 20, 60, 0.8);
  border: none;
  color: #fff;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s;
  line-height: 1;
  padding: 0;
}

.editable-field:hover .field-delete-btn {
  display: block;
}

.field-delete-btn:hover {
  background: rgba(220, 20, 60, 1);
  transform: translateY(-50%) scale(1.1);
}

.close-btn {
  background: none;
  border: none;
  color: #999;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  color: #fff;
}

.poi-popup-content {
  color: #ccc;
  font-size: 0.9rem;
}

.poi-popup-content p {
  margin: 0 0 0.5rem 0;
}

.poi-type {
  font-size: 0.85rem;
  color: #999;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.type-icon {
  font-size: 1rem;
}

.type-text {
  text-transform: capitalize;
}

.type-text.editable {
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.type-text.editable:hover {
  background: rgba(255, 255, 255, 0.05);
}

.edit-input, .edit-textarea, .edit-select {
  background: #3a3a3a;
  color: #fff;
  border: 1px solid #666;
  border-radius: 4px;
  padding: 4px 8px;
  font-size: inherit;
  font-family: inherit;
  width: 100%;
  outline: none;
}

.edit-input {
  font-size: 1.1rem;
  font-weight: bold;
}

.edit-textarea {
  resize: vertical;
  min-height: 60px;
}

.edit-select {
  padding: 2px 4px;
  font-size: 0.85rem;
}

.edit-input:focus, .edit-textarea:focus, .edit-select:focus {
  border-color: #4a7c59;
  background: #4a4a4a;
}

.edit-hint {
  font-size: 0.8rem;
  color: #666;
  font-style: italic;
  margin: 0.5rem 0;
}

.delete-btn {
  margin-top: 1rem;
  width: 100%;
  padding: 0.5rem;
  background: #dc143c;
  color: #fff;
  border: none;
  border-radius: 4px;
  font-size: 0.9rem;
  cursor: pointer;
  transition: background-color 0.2s;
}

.delete-btn:hover {
  background: #b91c1c;
}
</style>