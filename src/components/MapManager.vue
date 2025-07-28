<template>
  <div v-if="visible" class="map-manager-overlay" @click="handleOverlayClick">
    <div class="map-manager" @click.stop>
      <div class="map-manager-header">
        <h2>Map Manager</h2>
        <button class="close-btn" @click="$emit('close')">×</button>
      </div>
      
      <div class="map-manager-content">
        <!-- Map List -->
        <div class="map-list-panel">
          <div class="panel-header">
            <h3>Maps</h3>
            <button class="add-map-btn" @click="showAddMapDialog" title="Add New Map">
              <span class="icon">➕</span>
            </button>
          </div>
          
          <div class="map-list">
            <div 
              v-for="(map, index) in maps" 
              :key="index"
              :class="['map-item', { active: selectedMapIndex === index, dragging: draggedIndex === index }]"
              draggable="true"
              @click="selectMap(index)"
              @dragstart="handleDragStart(index, $event)"
              @dragend="handleDragEnd"
              @dragover.prevent="handleDragOver(index, $event)"
              @drop="handleDrop(index, $event)"
              @dragenter.prevent
            >
              <span class="drag-handle" @click.stop>⋮⋮</span>
              <div class="map-info">
                <span class="map-name">{{ map.name }}</span>
                <span class="map-filename">{{ getFilename(map.file) }}</span>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Map Preview and Controls -->
        <div class="map-preview-panel">
          <div v-if="selectedMapIndex !== null" class="map-details">
            <div class="map-preview-header">
              <div v-if="!isEditingName" class="map-title-row">
                <div class="map-title">
                  <h3>{{ selectedMap.name }}</h3>
                  <button class="edit-name-btn" @click="startEditName" title="Edit name">
                    ✏️
                  </button>
                </div>
                <div class="map-stats">
                  <span>{{ getFilename(selectedMap.file) }}</span>
                  <span class="separator">|</span>
                  <span>POIs: {{ getMapStats().pois }}</span>
                  <span class="separator">|</span>
                  <span>Connections: {{ getMapStats().connections }}</span>
                  <span class="separator">|</span>
                  <span>Connectors: {{ getMapStats().connectors }}</span>
                </div>
              </div>
              <div v-else class="map-title-edit">
                <input 
                  v-model="editedName"
                  @keyup.enter="saveName"
                  @keyup.esc="cancelEditName"
                  @blur="saveName"
                  ref="nameInput"
                  class="name-input"
                />
                <button class="save-btn" @click="saveName">✓</button>
                <button class="cancel-btn" @click="cancelEditName">✗</button>
              </div>
            </div>
            
            <div class="map-preview-container">
              <canvas ref="previewCanvas" class="map-preview-canvas"></canvas>
              <div v-if="isLoadingPreview" class="preview-loading">
                <div class="spinner"></div>
              </div>
            </div>
            
            <div class="map-actions">
              <button class="action-btn update-btn" @click="showUpdateDialog">
                <span class="icon">📤</span>
                Update Map Image
              </button>
              <button class="action-btn delete-btn" @click="showDeleteConfirm">
                <span class="icon">🗑️</span>
                Delete Map
              </button>
            </div>
          </div>
          
          <div v-else class="no-selection">
            <p>Select a map from the list to view details</p>
          </div>
        </div>
      </div>
      
      <!-- Add Map Dialog -->
      <div v-if="showAddMap" class="dialog-overlay" @click="closeAddMapDialog">
        <div class="dialog" @click.stop>
          <h3>Add New Map</h3>
          <div class="form-group">
            <label>Map Name</label>
            <input 
              v-model="newMapName" 
              placeholder="Enter map name"
              @keyup.enter="handleAddMap"
              ref="newMapNameInput"
            />
          </div>
          <div class="form-group">
            <label>Map Image</label>
            <input 
              type="file" 
              accept="image/*"
              @change="handleFileSelect"
              ref="fileInput"
            />
            <p v-if="selectedFile" class="file-info">
              Selected: {{ selectedFile.name }}
            </p>
          </div>
          <div class="dialog-actions">
            <button class="dialog-btn primary" @click="handleAddMap" :disabled="!canAddMap">
              Add Map
            </button>
            <button class="dialog-btn" @click="closeAddMapDialog">
              Cancel
            </button>
          </div>
        </div>
      </div>
      
      <!-- Update Map Dialog -->
      <div v-if="showUpdateMap" class="dialog-overlay" @click="closeUpdateDialog">
        <div class="dialog" @click.stop>
          <h3>Update Map Image</h3>
          <p>Select a new image to replace the current map:</p>
          <p class="current-map"><strong>{{ selectedMap?.name }}</strong></p>
          <div class="form-group">
            <input 
              type="file" 
              accept="image/*"
              @change="handleUpdateFileSelect"
              ref="updateFileInput"
            />
            <p v-if="updateFile" class="file-info">
              Selected: {{ updateFile.name }}
            </p>
          </div>
          <div class="dialog-actions">
            <button class="dialog-btn primary" @click="handleUpdateMap" :disabled="!updateFile">
              Update Map
            </button>
            <button class="dialog-btn" @click="closeUpdateDialog">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { mapData, getMapFilename, saveMapData } from '../data/mapData'

export default {
  name: 'MapManager',
  props: {
    visible: {
      type: Boolean,
      default: false
    },
    maps: {
      type: Array,
      required: true
    }
  },
  emits: ['close', 'updateMaps', 'showConfirm', 'showToast'],
  setup(props, { emit }) {
    const selectedMapIndex = ref(null)
    const isEditingName = ref(false)
    const editedName = ref('')
    const nameInput = ref(null)
    const previewCanvas = ref(null)
    const isLoadingPreview = ref(false)
    const previewImage = ref(null)
    const draggedIndex = ref(null)
    const dragOverIndex = ref(null)
    
    // Dialog states
    const showAddMap = ref(false)
    const showUpdateMap = ref(false)
    const newMapName = ref('')
    const selectedFile = ref(null)
    const updateFile = ref(null)
    const fileInput = ref(null)
    const updateFileInput = ref(null)
    const newMapNameInput = ref(null)
    
    const selectedMap = computed(() => 
      selectedMapIndex.value !== null ? props.maps[selectedMapIndex.value] : null
    )
    
    const canAddMap = computed(() => 
      newMapName.value.trim() !== '' && selectedFile.value !== null
    )
    
    const getFilename = (filepath) => {
      return getMapFilename(filepath)
    }
    
    const getMapStats = () => {
      if (!selectedMap.value) return { pois: 0, connections: 0, connectors: 0 }
      const filename = getFilename(selectedMap.value.file)
      const data = mapData[filename] || { pois: [], connections: [], connectors: [] }
      return {
        pois: data.pois?.length || 0,
        connections: data.connections?.length || 0,
        connectors: data.connectors?.length || 0
      }
    }
    
    const selectMap = (index) => {
      selectedMapIndex.value = index
      // Add a small delay to ensure DOM updates
      nextTick(() => {
        setTimeout(() => loadMapPreview(), 50)
      })
    }
    
    const loadMapPreview = async () => {
      if (!selectedMap.value) return
      
      // Wait for next tick to ensure canvas is in DOM
      await nextTick()
      
      if (!previewCanvas.value) {
        // If canvas still not available, try again after a short delay
        setTimeout(() => loadMapPreview(), 100)
        return
      }
      
      isLoadingPreview.value = true
      
      // Load the image
      const img = new Image()
      img.onload = () => {
        const canvas = previewCanvas.value
        if (!canvas) {
          isLoadingPreview.value = false
          return
        }
        
        const ctx = canvas.getContext('2d')
        
        // Ensure parent element exists and has dimensions
        const parent = canvas.parentElement
        if (!parent || parent.clientWidth === 0) {
          // Try again after a short delay
          setTimeout(() => {
            isLoadingPreview.value = false
            loadMapPreview()
          }, 100)
          return
        }
        
        // Set canvas size to fit container while maintaining aspect ratio
        const maxWidth = parent.clientWidth
        const maxHeight = 600
        const scale = Math.min(maxWidth / img.width, maxHeight / img.height)
        
        canvas.width = img.width * scale
        canvas.height = img.height * scale
        
        // Clear and draw image
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        
        // Draw POIs on preview
        const filename = getFilename(selectedMap.value.file)
        const data = mapData[filename]
        if (data && data.pois) {
          data.pois.forEach(poi => {
            const x = poi.x * scale
            const y = poi.y * scale
            
            // Draw POI marker
            ctx.beginPath()
            ctx.arc(x, y, 5, 0, Math.PI * 2)
            ctx.fillStyle = '#4a7c59'
            ctx.fill()
            ctx.strokeStyle = '#fff'
            ctx.lineWidth = 2
            ctx.stroke()
          })
        }
        
        isLoadingPreview.value = false
      }
      
      img.onerror = () => {
        isLoadingPreview.value = false
        emit('showToast', { type: 'error', message: 'Failed to load map preview' })
      }
      
      img.src = selectedMap.value.file
    }
    
    const startEditName = async () => {
      isEditingName.value = true
      editedName.value = selectedMap.value.name
      await nextTick()
      nameInput.value?.focus()
      nameInput.value?.select()
    }
    
    const saveName = () => {
      if (editedName.value.trim() === '') {
        cancelEditName()
        return
      }
      
      // Update the map name
      const newMaps = [...props.maps]
      newMaps[selectedMapIndex.value] = {
        ...newMaps[selectedMapIndex.value],
        name: editedName.value.trim()
      }
      
      emit('updateMaps', newMaps)
      emit('showToast', { type: 'success', message: 'Map name updated' })
      isEditingName.value = false
    }
    
    const cancelEditName = () => {
      isEditingName.value = false
      editedName.value = ''
    }
    
    const showAddMapDialog = async () => {
      showAddMap.value = true
      newMapName.value = ''
      selectedFile.value = null
      if (fileInput.value) fileInput.value.value = ''
      await nextTick()
      newMapNameInput.value?.focus()
    }
    
    const closeAddMapDialog = () => {
      showAddMap.value = false
      newMapName.value = ''
      selectedFile.value = null
    }
    
    const showUpdateDialog = () => {
      showUpdateMap.value = true
      updateFile.value = null
      if (updateFileInput.value) updateFileInput.value.value = ''
    }
    
    const closeUpdateDialog = () => {
      showUpdateMap.value = false
      updateFile.value = null
    }
    
    const showDeleteConfirm = () => {
      emit('showConfirm', {
        title: 'Delete Map',
        message: `Are you sure you want to delete "${selectedMap.value.name}"? This action cannot be undone.`,
        confirmText: 'Delete',
        cancelText: 'Cancel',
        onConfirm: handleDeleteMap
      })
    }
    
    const handleFileSelect = (event) => {
      selectedFile.value = event.target.files[0]
    }
    
    const handleUpdateFileSelect = (event) => {
      updateFile.value = event.target.files[0]
    }
    
    const handleAddMap = () => {
      if (!canAddMap.value) return
      
      const reader = new FileReader()
      reader.onload = (e) => {
        const newMap = {
          name: newMapName.value.trim(),
          file: e.target.result
        }
        
        const newMaps = [...props.maps, newMap]
        emit('updateMaps', newMaps)
        emit('showToast', { type: 'success', message: `Map "${newMap.name}" added successfully` })
        
        // Select the newly added map
        selectedMapIndex.value = newMaps.length - 1
        closeAddMapDialog()
        
        // Load preview after a short delay
        setTimeout(() => loadMapPreview(), 100)
      }
      
      reader.readAsDataURL(selectedFile.value)
    }
    
    const handleUpdateMap = () => {
      if (!updateFile.value || selectedMapIndex.value === null) return
      
      const reader = new FileReader()
      reader.onload = (e) => {
        const newMaps = [...props.maps]
        newMaps[selectedMapIndex.value] = {
          ...newMaps[selectedMapIndex.value],
          file: e.target.result
        }
        
        emit('updateMaps', newMaps)
        emit('showToast', { type: 'success', message: 'Map image updated successfully' })
        closeUpdateDialog()
        
        // Reload preview
        setTimeout(() => loadMapPreview(), 100)
      }
      
      reader.readAsDataURL(updateFile.value)
    }
    
    const handleDeleteMap = () => {
      if (selectedMapIndex.value === null) return
      
      const mapToDelete = selectedMap.value
      const filename = getFilename(mapToDelete.file)
      
      // Remove map from list
      const newMaps = props.maps.filter((_, index) => index !== selectedMapIndex.value)
      
      // Remove associated data
      if (mapData[filename]) {
        delete mapData[filename]
        saveMapData()
      }
      
      emit('updateMaps', newMaps)
      emit('showToast', { type: 'success', message: `Map "${mapToDelete.name}" deleted successfully` })
      
      // Clear selection
      selectedMapIndex.value = null
    }
    
    const handleOverlayClick = (event) => {
      if (event.target === event.currentTarget) {
        emit('close')
      }
    }
    
    // Drag and drop handlers
    const handleDragStart = (index, event) => {
      draggedIndex.value = index
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData('text/html', event.target.innerHTML)
      // Add dragging class for visual feedback
      event.target.classList.add('dragging')
    }
    
    const handleDragEnd = (event) => {
      draggedIndex.value = null
      dragOverIndex.value = null
      // Remove dragging class
      event.target.classList.remove('dragging')
    }
    
    const handleDragOver = (index, event) => {
      if (draggedIndex.value === null) return
      
      const draggedOverElement = event.target.closest('.map-item')
      if (!draggedOverElement) return
      
      // Get the bounding rectangle of the element
      const rect = draggedOverElement.getBoundingClientRect()
      const midpoint = rect.top + rect.height / 2
      
      // Remove existing drag-over classes
      document.querySelectorAll('.map-item').forEach(item => {
        item.classList.remove('drag-over-top', 'drag-over-bottom')
      })
      
      // Add appropriate class based on cursor position
      if (event.clientY < midpoint) {
        draggedOverElement.classList.add('drag-over-top')
      } else {
        draggedOverElement.classList.add('drag-over-bottom')
      }
      
      dragOverIndex.value = index
    }
    
    const handleDrop = (dropIndex, event) => {
      event.preventDefault()
      
      if (draggedIndex.value === null || draggedIndex.value === dropIndex) {
        return
      }
      
      // Create a new array with the reordered maps
      const newMaps = [...props.maps]
      const draggedMap = newMaps[draggedIndex.value]
      
      // Remove the dragged item
      newMaps.splice(draggedIndex.value, 1)
      
      // Insert at the new position
      const insertIndex = dropIndex > draggedIndex.value ? dropIndex - 1 : dropIndex
      const rect = event.target.closest('.map-item').getBoundingClientRect()
      const midpoint = rect.top + rect.height / 2
      const insertAfter = event.clientY > midpoint
      
      if (insertAfter) {
        newMaps.splice(insertIndex + 1, 0, draggedMap)
      } else {
        newMaps.splice(insertIndex, 0, draggedMap)
      }
      
      // Update selected index if needed
      if (selectedMapIndex.value !== null) {
        const selectedMap = props.maps[selectedMapIndex.value]
        selectedMapIndex.value = newMaps.findIndex(map => map === selectedMap)
      }
      
      // Remove drag-over classes
      document.querySelectorAll('.map-item').forEach(item => {
        item.classList.remove('drag-over-top', 'drag-over-bottom')
      })
      
      emit('updateMaps', newMaps)
      emit('showToast', { type: 'success', message: 'Map order updated' })
    }
    
    // Handle window resize
    const handleResize = () => {
      if (selectedMapIndex.value !== null) {
        loadMapPreview()
      }
    }
    
    onMounted(() => {
      window.addEventListener('resize', handleResize)
    })
    
    onUnmounted(() => {
      window.removeEventListener('resize', handleResize)
    })
    
    // Load preview when component becomes visible with a map selected
    watch(() => props.visible, (newVal) => {
      if (newVal && selectedMapIndex.value !== null) {
        // Add delay to ensure modal is fully rendered
        setTimeout(() => {
          loadMapPreview()
        }, 150)
      }
    })
    
    // Also reload preview when selected map changes
    watch(selectedMapIndex, (newIndex) => {
      if (newIndex !== null && props.visible) {
        nextTick(() => {
          setTimeout(() => loadMapPreview(), 50)
        })
      }
    })
    
    return {
      selectedMapIndex,
      selectedMap,
      isEditingName,
      editedName,
      nameInput,
      previewCanvas,
      isLoadingPreview,
      showAddMap,
      showUpdateMap,
      newMapName,
      selectedFile,
      updateFile,
      canAddMap,
      fileInput,
      updateFileInput,
      newMapNameInput,
      getFilename,
      getMapStats,
      selectMap,
      startEditName,
      saveName,
      cancelEditName,
      showAddMapDialog,
      closeAddMapDialog,
      showUpdateDialog,
      closeUpdateDialog,
      showDeleteConfirm,
      handleFileSelect,
      handleUpdateFileSelect,
      handleAddMap,
      handleUpdateMap,
      handleDeleteMap,
      handleOverlayClick,
      draggedIndex,
      handleDragStart,
      handleDragEnd,
      handleDragOver,
      handleDrop
    }
  }
}
</script>

<style scoped>
.map-manager-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

.map-manager {
  background: #2a2a2a;
  border-radius: 12px;
  width: 95%;
  max-width: 1600px;
  height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}

.map-manager-header {
  background: #1a1a1a;
  padding: 1.5rem;
  border-radius: 12px 12px 0 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #444;
}

.map-manager-header h2 {
  margin: 0;
  color: #fff;
  font-size: 1.5rem;
}

.close-btn {
  background: none;
  border: none;
  color: #999;
  font-size: 1.5rem;
  cursor: pointer;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: all 0.2s;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.map-manager-content {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.map-list-panel {
  width: 350px;
  background: #1a1a1a;
  border-right: 1px solid #444;
  display: flex;
  flex-direction: column;
}

.panel-header {
  padding: 1rem;
  border-bottom: 1px solid #444;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.panel-header h3 {
  margin: 0;
  color: #fff;
  font-size: 1.1rem;
}

.add-map-btn {
  background: #4a7c59;
  border: none;
  color: #fff;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.add-map-btn:hover {
  background: #5a8c69;
  transform: translateY(-1px);
}

.map-list {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem;
}

.map-item {
  padding: 0.75rem;
  margin-bottom: 0.5rem;
  background: #2a2a2a;
  border: 1px solid #444;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  position: relative;
  user-select: none;
}

.map-item:hover {
  background: #3a3a3a;
  border-color: #555;
}

.map-item.active {
  background: #3a3a3a;
  border-color: #4a7c59;
}

.map-item.dragging {
  opacity: 0.5;
  cursor: move;
}

.map-item.drag-over-top::before {
  content: '';
  position: absolute;
  top: -2px;
  left: 0;
  right: 0;
  height: 3px;
  background: #4a7c59;
  border-radius: 2px;
}

.map-item.drag-over-bottom::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 0;
  right: 0;
  height: 3px;
  background: #4a7c59;
  border-radius: 2px;
}

.drag-handle {
  color: #666;
  font-size: 1.2rem;
  cursor: move;
  padding: 0 0.25rem;
  user-select: none;
  transition: color 0.2s;
}

.drag-handle:hover {
  color: #999;
}

.map-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  overflow: hidden;
}

.map-name {
  color: #fff;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.map-filename {
  color: #999;
  font-size: 0.85rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.map-preview-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.map-details {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 1rem;
  overflow: hidden;
}

.map-preview-header {
  margin-bottom: 0.75rem;
  flex-shrink: 0;
  border-bottom: 1px solid #333;
  padding-bottom: 0.75rem;
}

.map-title {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.map-title h3 {
  margin: 0;
  color: #fff;
  font-size: 1.1rem;
}

.edit-name-btn {
  background: none;
  border: none;
  color: #999;
  font-size: 1rem;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 4px;
  transition: all 0.2s;
}

.edit-name-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.map-title-edit {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.name-input {
  background: #3a3a3a;
  border: 1px solid #666;
  color: #fff;
  padding: 0.5rem;
  font-size: 1.3rem;
  font-weight: 500;
  border-radius: 4px;
  flex: 1;
}

.save-btn, .cancel-btn {
  padding: 0.5rem 0.75rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
}

.save-btn {
  background: #4a7c59;
  color: #fff;
}

.save-btn:hover {
  background: #5a8c69;
}

.cancel-btn {
  background: #666;
  color: #fff;
}

.cancel-btn:hover {
  background: #777;
}

.map-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.map-stats {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8rem;
  color: #999;
}

.map-stats .separator {
  color: #555;
}

.map-preview-container {
  flex: 1;
  background: #1a1a1a;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  margin-bottom: 0.5rem;
  min-height: 0;
}

.map-preview-canvas {
  max-width: 100%;
  max-height: 100%;
  display: block;
}

.preview-loading {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #444;
  border-top-color: #4a7c59;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.map-actions {
  display: flex;
  gap: 1rem;
  flex-shrink: 0;
}

.action-btn {
  flex: 1;
  padding: 0.6rem 0.75rem;
  border: none;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  transition: all 0.2s;
}

.update-btn {
  background: #4a7c59;
  color: #fff;
}

.update-btn:hover {
  background: #5a8c69;
  transform: translateY(-1px);
}

.delete-btn {
  background: #dc143c;
  color: #fff;
}

.delete-btn:hover {
  background: #b91c1c;
  transform: translateY(-1px);
}

.icon {
  font-size: 1.1rem;
}

.no-selection {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #666;
  font-size: 1.1rem;
}

/* Dialog styles */
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3000;
}

.dialog {
  background: #2a2a2a;
  border-radius: 8px;
  padding: 2rem;
  width: 90%;
  max-width: 500px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
}

.dialog h3 {
  margin: 0 0 1.5rem 0;
  color: #fff;
  font-size: 1.2rem;
}

.dialog p {
  color: #ccc;
  margin: 0.5rem 0;
}

.current-map {
  color: #4a7c59 !important;
  font-size: 1.1rem;
  margin: 1rem 0 !important;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  color: #ccc;
  font-size: 0.9rem;
  margin-bottom: 0.5rem;
}

.form-group input[type="text"],
.form-group input {
  width: 100%;
  background: #3a3a3a;
  border: 1px solid #555;
  color: #fff;
  padding: 0.75rem;
  border-radius: 4px;
  font-size: 1rem;
}

.form-group input[type="file"] {
  padding: 0.5rem;
}

.file-info {
  color: #999;
  font-size: 0.85rem;
  margin-top: 0.5rem;
}

.dialog-actions {
  display: flex;
  gap: 1rem;
  margin-top: 2rem;
}

.dialog-btn {
  flex: 1;
  padding: 0.75rem;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
}

.dialog-btn.primary {
  background: #4a7c59;
  color: #fff;
}

.dialog-btn.primary:hover:not(:disabled) {
  background: #5a8c69;
}

.dialog-btn.primary:disabled {
  background: #444;
  color: #666;
  cursor: not-allowed;
}

.dialog-btn:not(.primary) {
  background: #444;
  color: #fff;
}

.dialog-btn:not(.primary):hover {
  background: #555;
}

/* Scrollbar styling */
.map-list::-webkit-scrollbar {
  width: 8px;
}

.map-list::-webkit-scrollbar-track {
  background: #2a2a2a;
  border-radius: 4px;
}

.map-list::-webkit-scrollbar-thumb {
  background: #555;
  border-radius: 4px;
}

.map-list::-webkit-scrollbar-thumb:hover {
  background: #666;
}

/* Responsive adjustments */
@media (max-width: 1200px) {
  .map-manager {
    width: 98%;
  }
  
  .map-list-panel {
    width: 300px;
  }
}

@media (max-width: 768px) {
  .map-manager-content {
    flex-direction: column;
  }
  
  .map-list-panel {
    width: 100%;
    height: 200px;
    border-right: none;
    border-bottom: 1px solid #444;
  }
  
  .map-info {
    flex-direction: column;
    gap: 0.5rem;
  }
}
</style>