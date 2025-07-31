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
      
      <div v-if="localPoi.type !== undefined" class="poi-type">
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
      
      <div v-else class="poi-type">
        <span class="type-icon">{{ localPoi.icon || '📍' }}</span>
        <span class="type-text">Custom POI</span>
      </div>
      
      <div v-if="localPoi.display_created_by || localPoi.created_by || localPoi.owner_name" class="poi-creator">
        <span class="creator-label">Created by:</span>
        <span class="creator-name">{{ localPoi.display_created_by || localPoi.created_by || localPoi.owner_name }}</span>
      </div>
      
      <!-- Custom POI Status -->
      <div v-if="isCustomPOI && localPoi.status" class="poi-status">
        <span class="status-label">Status:</span>
        <span :class="['status-value', `status-${localPoi.status}`]">
          {{ formatStatus(localPoi.status) }}
        </span>
      </div>
      
      <!-- Voting information for pending POIs -->
      <div v-if="isCustomPOI && localPoi.status === 'pending' && localPoi.vote_score !== undefined" class="poi-voting-inline">
        <span class="vote-item">
          <span class="vote-icon">👍</span>
          <span class="vote-count upvote">{{ localPoi.upvotes || 0 }}</span>
        </span>
        <span class="vote-item">
          <span class="vote-icon">👎</span>
          <span class="vote-count downvote">{{ localPoi.downvotes || 0 }}</span>
        </span>
        <span class="vote-total" :class="localPoi.vote_score > 0 ? 'positive' : localPoi.vote_score < 0 ? 'negative' : ''">
          ({{ localPoi.vote_score > 0 ? '+' : '' }}{{ localPoi.vote_score || 0 }})
        </span>
      </div>
      
      <!-- Shared indicator -->
      <div v-if="isSharedPOI" class="poi-shared">
        <span class="shared-icon">🔗</span>
        <span class="shared-text">Shared by {{ localPoi.owner_name || 'Unknown' }}</span>
      </div>
      
      <p v-if="canEdit" class="edit-hint">{{ isAdmin ? 'Click any field to edit' : 'Alt+drag to move' }}</p>
      <p v-else-if="isOwnCustomPOI && localPoi.status === 'pending'" class="edit-hint pending-hint">
        POI can not be edited while pending publication.
      </p>
      
      <!-- Action buttons for custom POIs -->
      <div v-if="isOwnCustomPOI && localPoi.status !== 'pending'" class="custom-poi-actions">
        <button v-if="canPublish" class="publish-btn" @click="handlePublish">
          Publish
        </button>
        <button class="delete-btn" @click="handleDelete">
          Delete
        </button>
      </div>
      
      <!-- Admin buttons for regular POIs -->
      <div v-else-if="isAdmin && !isCustomPOI" class="admin-poi-actions">
        <button class="edit-btn" @click="handleEdit">
          Edit in POI Editor
        </button>
        <button class="delete-btn" @click="handleDelete">
          Delete POI
        </button>
      </div>
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
    },
    currentUserId: {
      type: Number,
      default: null
    }
  },
  emits: ['close', 'delete', 'update', 'confirmUpdate', 'publish'],
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
    
    const isCustomPOI = computed(() => {
      return props.poi && props.poi.is_custom === true
    })
    
    const isOwnCustomPOI = computed(() => {
      return isCustomPOI.value && props.poi.user_id === props.currentUserId
    })
    
    const isSharedPOI = computed(() => {
      return isCustomPOI.value && props.poi.user_id !== props.currentUserId
    })
    
    const canEdit = computed(() => {
      // Admins can always edit
      if (props.isAdmin) return true
      // Users can edit their own custom POIs only if not pending
      return isOwnCustomPOI.value && props.poi.status !== 'pending'
    })
    
    const canPublish = computed(() => {
      return isOwnCustomPOI.value && (props.poi.status === 'private' || props.poi.status === 'rejected')
    })
    
    const getTypeIcon = (type) => {
      if (!type) return '📍'
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
      if (!type) return 'Custom'
      return type.charAt(0).toUpperCase() + type.slice(1)
    }
    
    const startEdit = async (field) => {
      if (!canEdit.value) return
      
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
    
    const handlePublish = () => {
      emit('publish', props.poi.id)
    }
    
    const handleEdit = () => {
      // Navigate to account page with POI ID to highlight
      const poiId = props.poi.id
      // Use absolute path to ensure proper navigation
      window.location.href = `/account.html?tab=admin&section=poi-editor&highlight=${poiId}`
    }
    
    const formatStatus = (status) => {
      const statusMap = {
        'private': 'Private',
        'pending': 'Pending Approval',
        'published': 'Published',
        'rejected': 'Rejected'
      }
      return statusMap[status] || status
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
      deleteField,
      isCustomPOI,
      isOwnCustomPOI,
      isSharedPOI,
      canEdit,
      canPublish,
      formatStatus,
      handlePublish,
      handleEdit
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

.poi-creator {
  font-size: 0.85rem;
  color: #999;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.creator-label {
  color: #777;
}

.creator-name {
  color: #FFD700;
  font-weight: 500;
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

.admin-poi-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
}

.admin-poi-actions .edit-btn,
.admin-poi-actions .delete-btn {
  flex: 1;
  margin-top: 0;
}

.edit-btn {
  padding: 0.5rem;
  background: #4a7c59;
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  transition: background 0.2s;
}

.edit-btn:hover {
  background: #5a8d69;
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

.poi-status {
  font-size: 0.85rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.status-label {
  color: #999;
}

.status-value {
  font-weight: 500;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  font-size: 0.8rem;
}

.status-private {
  background: rgba(108, 117, 125, 0.2);
  color: #adb5bd;
}

.status-pending {
  background: rgba(255, 193, 7, 0.2);
  color: #ffc107;
}

.status-published {
  background: rgba(40, 167, 69, 0.2);
  color: #28a745;
}

.status-rejected {
  background: rgba(220, 53, 69, 0.2);
  color: #dc3545;
}

.custom-poi-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
}

.custom-poi-actions button {
  flex: 1;
  margin-top: 0;
}

.publish-btn {
  padding: 0.5rem;
  background: #28a745;
  color: #fff;
  border: none;
  border-radius: 4px;
  font-size: 0.9rem;
  cursor: pointer;
  transition: background-color 0.2s;
}

.publish-btn:hover {
  background: #218838;
}

.poi-shared {
  font-size: 0.85rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
  color: #17a2b8;
}

.shared-icon {
  font-size: 1rem;
}

.shared-text {
  font-style: italic;
}

.pending-hint {
  color: #ffc107;
  font-weight: 500;
}

.poi-voting-inline {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.85rem;
  margin-top: 0.5rem;
}

.poi-voting-inline .vote-item {
  display: flex;
  align-items: center;
  gap: 0.2rem;
}

.poi-voting-inline .vote-icon {
  font-size: 0.9rem;
  opacity: 0.8;
}

.poi-voting-inline .vote-count {
  font-weight: 600;
  font-size: 0.85rem;
}

.poi-voting-inline .vote-count.upvote {
  color: #28a745;
}

.poi-voting-inline .vote-count.downvote {
  color: #dc3545;
}

.poi-voting-inline .vote-total {
  font-weight: 600;
  color: #999;
}

.poi-voting-inline .vote-total.positive {
  color: #28a745;
}

.poi-voting-inline .vote-total.negative {
  color: #dc3545;
}
</style>