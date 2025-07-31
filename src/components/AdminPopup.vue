<template>
  <transition name="popup-fade">
    <div v-if="item" class="admin-popup" :style="`left: ${position?.x || 0}px; top: ${position?.y || 0}px;`" @click.stop @mousedown="logPosition">
      <div class="popup-arrow" :class="arrowPosition"></div>
      <div class="admin-popup-header">
      <h3>{{ getItemTypeLabel() }} Settings</h3>
      <button class="close-btn" @click="$emit('close')">×</button>
    </div>
    
    <div class="admin-popup-content">
      <!-- Label Position (for items with labels) -->
      <div v-if="hasLabel" class="setting-group">
        <label>Label Position</label>
        <div class="position-grid">
          <button 
            v-for="pos in ['top', 'right', 'bottom', 'left']" 
            :key="pos"
            :class="['position-btn', { active: currentLabelPosition === pos }]"
            @click="updateLabelPosition(pos)"
          >
            {{ pos }}
          </button>
        </div>
      </div>
      
      <!-- POI Type Selection (for POIs) -->
      <div v-if="itemType === 'poi'" class="setting-group">
        <label>POI Type</label>
        <POITypeDropdown 
          v-model="currentTypeId" 
          :poi-types="poiTypes"
          @update:modelValue="updatePOIType"
        />
      </div>
      
      <!-- Icon Selection -->
      <div v-if="hasIcon" class="setting-group">
        <label>Icon</label>
        <div class="icon-grid">
          <button 
            v-for="icon in availableIcons" 
            :key="icon.type"
            :class="['icon-btn', { active: currentIcon === icon.emoji }]"
            @click="updateIcon(icon)"
            :title="icon.label"
          >
            {{ icon.emoji }}
          </button>
        </div>
      </div>
      
      <!-- Icon Size (for POIs and visible connectors) -->
      <div v-if="hasIcon" class="setting-group">
        <label>Icon Size</label>
        <div class="size-controls">
          <input 
            type="range" 
            min="0.5" 
            max="2" 
            step="0.1" 
            v-model="iconSize"
            @change="updateIconSize"
          />
          <span class="size-value">{{ Math.round(iconSize * 100) }}%</span>
        </div>
      </div>
      
      <!-- Label Size (for items with labels) -->
      <div v-if="hasLabel" class="setting-group">
        <label>Label Size</label>
        <div class="size-controls">
          <input 
            type="range" 
            min="0.2" 
            max="2" 
            step="0.05" 
            v-model="labelSize"
            @change="updateLabelSize"
          />
          <span class="size-value">{{ Math.round(labelSize * 100) }}%</span>
        </div>
      </div>
      
      <!-- Item-specific info -->
      <div class="info-group">
        <p v-if="item.name" class="item-name">{{ item.name }}</p>
        <p v-if="item.label" class="item-label">Label: "{{ item.label }}"</p>
        <p v-if="item.type" class="item-type">Type: {{ item.type }}</p>
        <p v-if="item.targetMap" class="item-target">Target: {{ item.targetMap }}</p>
      </div>
      
      <!-- Action buttons -->
      <div class="action-buttons">
        <button class="activate-btn" @click="handleActivate">
          <span class="icon">{{ getActivateIcon() }}</span>
          Activate
        </button>
        <button class="delete-btn" @click="handleDelete">
          <span class="icon">🗑️</span>
          Delete
        </button>
      </div>
    </div>
    </div>
  </transition>
</template>

<script>
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import POITypeDropdown from './POITypeDropdown.vue'

export default {
  name: 'AdminPopup',
  components: {
    POITypeDropdown
  },
  props: {
    item: {
      type: Object,
      required: true
    },
    itemType: {
      type: String,
      required: true // 'poi', 'connection', 'connector', 'zoneConnector'
    },
    visible: {
      type: Boolean,
      default: false
    },
    position: {
      type: Object,
      default: () => ({ x: 0, y: 0 })
    }
  },
  emits: ['close', 'update', 'activate', 'delete', 'reposition'],
  setup(props, { emit }) {
    const iconSize = ref(1)
    const labelSize = ref(1)
    const currentLabelPosition = ref('bottom')
    const currentIcon = ref('')
    const currentTypeId = ref(null)
    const poiTypes = ref([])
    
    // Available RPG icons
    const availableIcons = [
      { type: 'landmark', emoji: '🏛️', label: 'Landmark' },
      { type: 'quest', emoji: '❗', label: 'Quest' },
      { type: 'merchant', emoji: '💰', label: 'Merchant' },
      { type: 'npc', emoji: '💀', label: 'NPC' },
      { type: 'dungeon', emoji: '⚔️', label: 'Dungeon' },
      { type: 'tavern', emoji: '🍺', label: 'Tavern' },
      { type: 'boat', emoji: '⛵', label: 'Boat/Harbor' },
      { type: 'harvest', emoji: '🌾', label: 'Harvesting' },
      { type: 'mine', emoji: '⛏️', label: 'Mining' },
      { type: 'fish', emoji: '🎣', label: 'Fishing' },
      { type: 'camp', emoji: '🏕️', label: 'Camp' },
      { type: 'boss', emoji: '👹', label: 'Boss' },
      { type: 'chest', emoji: '📦', label: 'Chest/Loot' },
      { type: 'portal', emoji: '🌀', label: 'Portal' },
      { type: 'shrine', emoji: '🛐', label: 'Shrine' },
      { type: 'castle', emoji: '🏰', label: 'Castle' },
      { type: 'village', emoji: '🏘️', label: 'Village' },
      { type: 'forge', emoji: '🔨', label: 'Blacksmith' },
      { type: 'potion', emoji: '🧪', label: 'Alchemist' },
      { type: 'book', emoji: '📚', label: 'Library' },
      { type: 'stable', emoji: '🐴', label: 'Stable' },
      { type: 'danger', emoji: '⚠️', label: 'Danger' },
      { type: 'tree', emoji: '🌲', label: 'Special Tree' },
      { type: 'other', emoji: '📍', label: 'Generic' }
    ]
    
    // Initialize values from item
    watch(() => props.item, (newItem) => {
      if (newItem) {
        iconSize.value = newItem.iconScale || 1
        labelSize.value = newItem.labelScale || 1
        currentLabelPosition.value = newItem.labelPosition || 'bottom'
        
        // Set current icon based on item type
        if (props.itemType === 'poi') {
          const iconData = availableIcons.find(icon => icon.type === newItem.type)
          currentIcon.value = iconData ? iconData.emoji : '📍'
        } else if (props.itemType === 'connection' || props.itemType === 'zoneConnector') {
          // For connections, we can store a custom icon type
          const iconData = availableIcons.find(icon => icon.type === (newItem.iconType || 'portal'))
          currentIcon.value = iconData ? iconData.emoji : (props.itemType === 'zoneConnector' ? '🟩' : '🌀')
        } else if (props.itemType === 'connector') {
          // For connectors, we can store a custom icon type
          const iconData = availableIcons.find(icon => icon.type === (newItem.iconType || 'other'))
          currentIcon.value = iconData ? iconData.emoji : '🔗'
        }
      }
    }, { immediate: true })
    
    // Debug position prop specifically
    watch(() => props.position, (newVal, oldVal) => {
    }, { immediate: true, deep: true })
    
    const popupStyle = computed(() => {
      const x = props.position?.x || 0
      const y = props.position?.y || 0
      return {
        left: `${x}px`,
        top: `${y}px`
      }
    })
    
    const arrowPosition = computed(() => {
      if (!props.item || !props.position) return 'arrow-left'
      
      // Use the side information if provided
      if (props.position.side) {
        switch (props.position.side) {
          case 'left': return 'arrow-right'
          case 'right': return 'arrow-left'
          case 'bottom': return 'arrow-top'
          case 'top': return 'arrow-bottom'
          case 'corner': return 'arrow-none' // No arrow when in corner
          default: return 'arrow-left'
        }
      }
      
      // Fallback to heuristic if side not provided
      const x = props.position.x
      const viewportCenter = window.innerWidth / 2
      
      if (x > viewportCenter) {
        return 'arrow-left' // Arrow points left to the icon
      }
      return 'arrow-right' // Arrow points right to the icon
    })
    
    const hasLabel = computed(() => {
      if (props.itemType === 'poi') return false
      if (props.itemType === 'connection' || props.itemType === 'zoneConnector') return true
      if (props.itemType === 'connector') return !props.item.invisible
      return false
    })
    
    const hasIcon = computed(() => {
      // All types can have icons now
      if (props.itemType === 'poi') return true
      if (props.itemType === 'connection' || props.itemType === 'zoneConnector') return true
      if (props.itemType === 'connector') return props.item.showIcon !== false
      return false
    })
    
    const getItemTypeLabel = () => {
      switch (props.itemType) {
        case 'poi': return 'POI'
        case 'connection': return 'Zone Connection'
        case 'zoneConnector': return 'Zone Connector'
        case 'connector': return 'Point Connector'
        default: return 'Item'
      }
    }
    
    const getActivateIcon = () => {
      switch (props.itemType) {
        case 'poi': return currentIcon.value || '📍'
        case 'connection': return '🌀'
        case 'zoneConnector': return '🟩'
        case 'connector': return '🔗'
        default: return '▶️'
      }
    }
    
    const updateIcon = (icon) => {
      currentIcon.value = icon.emoji
      
      // Update based on item type
      if (props.itemType === 'poi') {
        emit('update', {
          ...props.item,
          type: icon.type
        })
      } else {
        // For connections and connectors, store the icon type separately
        emit('update', {
          ...props.item,
          iconType: icon.type,
          customIcon: icon.emoji,
          icon: icon.emoji, // Also update the icon field directly
          from_icon: icon.emoji // For zone connectors
        })
      }
    }
    
    const updateLabelPosition = (position) => {
      currentLabelPosition.value = position
      emit('update', {
        ...props.item,
        labelPosition: position
      })
    }
    
    const updateIconSize = () => {
      emit('update', {
        ...props.item,
        iconScale: parseFloat(iconSize.value)
      })
    }
    
    const updateLabelSize = () => {
      emit('update', {
        ...props.item,
        labelScale: parseFloat(labelSize.value)
      })
    }
    
    const handleActivate = () => {
      emit('activate', props.item, props.itemType)
      emit('close')
    }
    
    const handleDelete = () => {
      emit('delete', props.item, props.itemType)
      emit('close')
    }
    
    const logPosition = () => {
    }
    
    const loadPoiTypes = async () => {
      try {
        const response = await fetch('/api/poi-types')
        if (!response.ok) throw new Error('Failed to load POI types')
        poiTypes.value = await response.json()
      } catch (error) {
        console.error('Error loading POI types:', error)
      }
    }
    
    const updatePOIType = () => {
      emit('update', {
        ...props.item,
        type_id: currentTypeId.value
      })
    }
    
    const checkAndAdjustPosition = () => {
      nextTick(() => {
        const popup = document.querySelector('.admin-popup')
        if (popup && props.position) {
          const rect = popup.getBoundingClientRect()
          const actualHeight = rect.height
          const actualWidth = rect.width
          
          
          // Check if popup goes off screen
          const bottomOverflow = rect.bottom > window.innerHeight - 20
          const rightOverflow = rect.right > window.innerWidth - 20
          
          if (bottomOverflow || rightOverflow) {
            
            // Emit event to parent to reposition
            emit('reposition', {
              actualWidth,
              actualHeight,
              currentPosition: props.position
            })
          }
        }
      })
    }
    
    onMounted(() => {
      checkAndAdjustPosition()
      if (props.itemType === 'poi') {
        loadPoiTypes()
      }
    })
    
    // Re-check position when content changes
    watch(() => props.item, () => {
      checkAndAdjustPosition()
      if (props.item && props.itemType === 'poi') {
        currentTypeId.value = props.item.type_id
      }
    }, { immediate: true })
    
    
    return {
      iconSize,
      labelSize,
      currentLabelPosition,
      currentIcon,
      currentTypeId,
      poiTypes,
      availableIcons,
      popupStyle,
      arrowPosition,
      hasLabel,
      hasIcon,
      getItemTypeLabel,
      getActivateIcon,
      updateIcon,
      updateLabelPosition,
      updateIconSize,
      updateLabelSize,
      updatePOIType,
      handleActivate,
      handleDelete,
      logPosition
    }
  }
}
</script>

<style scoped>
.admin-popup {
  position: fixed;
  background: rgba(30, 30, 30, 0.98);
  border: 2px solid #4a7c59;
  border-radius: 12px;
  padding: 0;
  width: 320px;
  min-height: 200px;
  max-height: calc(100vh - 60px); /* Ensure it doesn't exceed viewport */
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8);
  z-index: 1100;
  overflow: hidden;
  backdrop-filter: blur(5px);
}

.admin-popup-header {
  background: #4a7c59;
  padding: 0.75rem 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.admin-popup-header h3 {
  margin: 0;
  font-size: 1rem;
  color: #fff;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  color: #fff;
  font-size: 1.25rem;
  cursor: pointer;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.admin-popup-content {
  padding: 1rem;
  max-height: calc(100vh - 160px); /* Account for header and margins */
  overflow-y: auto;
}

.setting-group {
  margin-bottom: 1.25rem;
  padding-bottom: 1.25rem;
  border-bottom: 1px solid #444;
}

.setting-group:last-of-type {
  border-bottom: none;
}

.setting-group label {
  display: block;
  color: #ccc;
  font-size: 0.85rem;
  margin-bottom: 0.5rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.position-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;
}

.position-btn {
  padding: 0.5rem;
  background: #3a3a3a;
  border: 1px solid #555;
  border-radius: 6px;
  color: #999;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
  text-transform: capitalize;
}

.position-btn:hover {
  background: #4a4a4a;
  color: #fff;
  border-color: #666;
}

.position-btn.active {
  background: #4a7c59;
  color: #fff;
  border-color: #5a8c69;
}

.type-select {
  width: 100%;
  padding: 0.5rem;
  background: #3a3a3a;
  border: 1px solid #555;
  border-radius: 6px;
  color: #fff;
  font-size: 0.9rem;
  cursor: pointer;
}

.type-select:hover {
  background: #4a4a4a;
  border-color: #666;
}

.type-select:focus {
  outline: none;
  border-color: #4a7c59;
}

.icon-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 0.4rem;
  max-height: 150px;
  overflow-y: auto;
  padding: 0.25rem;
  background: #2a2a2a;
  border-radius: 6px;
}

.icon-btn {
  padding: 0.5rem;
  background: #3a3a3a;
  border: 1px solid #555;
  border-radius: 6px;
  font-size: 1.3rem;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 1;
}

.icon-btn:hover {
  background: #4a4a4a;
  border-color: #666;
  transform: scale(1.1);
}

.icon-btn.active {
  background: #4a7c59;
  border-color: #5a8c69;
  transform: scale(1.05);
}

/* Scrollbar for icon grid */
.icon-grid::-webkit-scrollbar {
  width: 6px;
}

.icon-grid::-webkit-scrollbar-track {
  background: #2a2a2a;
}

.icon-grid::-webkit-scrollbar-thumb {
  background: #555;
  border-radius: 3px;
}

.icon-grid::-webkit-scrollbar-thumb:hover {
  background: #666;
}

.size-controls {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.size-controls input[type="range"] {
  flex: 1;
  -webkit-appearance: none;
  appearance: none;
  height: 6px;
  background: #3a3a3a;
  border-radius: 3px;
  outline: none;
}

.size-controls input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  background: #4a7c59;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s;
}

.size-controls input[type="range"]::-webkit-slider-thumb:hover {
  background: #5a8c69;
  transform: scale(1.1);
}

.size-controls input[type="range"]::-moz-range-thumb {
  width: 18px;
  height: 18px;
  background: #4a7c59;
  border-radius: 50%;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}

.size-controls input[type="range"]::-moz-range-thumb:hover {
  background: #5a8c69;
  transform: scale(1.1);
}

.size-value {
  color: #fff;
  font-size: 0.9rem;
  min-width: 45px;
  text-align: right;
}

.info-group {
  background: rgba(0, 0, 0, 0.3);
  padding: 0.75rem;
  border-radius: 6px;
  margin-bottom: 1rem;
}

.info-group p {
  margin: 0.25rem 0;
  color: #999;
  font-size: 0.85rem;
}

.item-name {
  color: #fff !important;
  font-weight: 600;
  font-size: 0.95rem !important;
}

.action-buttons {
  display: flex;
  gap: 0.75rem;
}

.activate-btn, .delete-btn {
  flex: 1;
  padding: 0.75rem;
  border: none;
  border-radius: 6px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.activate-btn {
  background: #4a7c59;
  color: #fff;
}

.activate-btn:hover {
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

/* Popup arrow */
.popup-arrow {
  position: absolute;
  width: 0;
  height: 0;
  border-style: solid;
}

.popup-arrow.arrow-left {
  left: -10px;
  top: 50%;
  transform: translateY(-50%);
  border-width: 10px 10px 10px 0;
  border-color: transparent #4a7c59 transparent transparent;
}

.popup-arrow.arrow-right {
  right: -10px;
  top: 50%;
  transform: translateY(-50%);
  border-width: 10px 0 10px 10px;
  border-color: transparent transparent transparent #4a7c59;
}

.popup-arrow.arrow-top {
  top: -10px;
  left: 50%;
  transform: translateX(-50%);
  border-width: 0 10px 10px 10px;
  border-color: transparent transparent #4a7c59 transparent;
}

.popup-arrow.arrow-bottom {
  bottom: -10px;
  left: 50%;
  transform: translateX(-50%);
  border-width: 10px 10px 0 10px;
  border-color: #4a7c59 transparent transparent transparent;
}

.popup-arrow.arrow-none {
  display: none;
}

/* Popup transition */
.popup-fade-enter-active,
.popup-fade-leave-active {
  transition: all 0.2s ease;
}

.popup-fade-enter-from,
.popup-fade-leave-to {
  opacity: 0;
  transform: scale(0.95);
}

/* POI Type Selection Styles */
</style>