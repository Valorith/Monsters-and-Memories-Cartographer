<template>
  <div v-if="visible" class="admin-popup" :style="popupStyle" @click.stop>
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
            @input="updateIconSize"
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
            min="0.5" 
            max="2" 
            step="0.1" 
            v-model="labelSize"
            @input="updateLabelSize"
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
</template>

<script>
import { ref, computed, watch } from 'vue'

export default {
  name: 'AdminPopup',
  props: {
    item: {
      type: Object,
      required: true
    },
    itemType: {
      type: String,
      required: true // 'poi', 'connection', 'connector'
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
  emits: ['close', 'update', 'activate', 'delete'],
  setup(props, { emit }) {
    const iconSize = ref(1)
    const labelSize = ref(1)
    const currentLabelPosition = ref('bottom')
    const currentIcon = ref('')
    
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
        } else if (props.itemType === 'connection') {
          // For connections, we can store a custom icon type
          const iconData = availableIcons.find(icon => icon.type === (newItem.iconType || 'portal'))
          currentIcon.value = iconData ? iconData.emoji : '🌀'
        } else if (props.itemType === 'connector') {
          // For connectors, we can store a custom icon type
          const iconData = availableIcons.find(icon => icon.type === (newItem.iconType || 'other'))
          currentIcon.value = iconData ? iconData.emoji : '🔗'
        }
      }
    }, { immediate: true })
    
    const popupStyle = computed(() => ({
      left: `${props.position.x}px`,
      top: `${props.position.y}px`
    }))
    
    const hasLabel = computed(() => {
      if (props.itemType === 'poi') return false
      if (props.itemType === 'connection') return true
      if (props.itemType === 'connector') return !props.item.invisible
      return false
    })
    
    const hasIcon = computed(() => {
      // All types can have icons now
      if (props.itemType === 'poi') return true
      if (props.itemType === 'connection') return true
      if (props.itemType === 'connector') return props.item.showIcon !== false
      return false
    })
    
    const getItemTypeLabel = () => {
      switch (props.itemType) {
        case 'poi': return 'POI'
        case 'connection': return 'Zone Connection'
        case 'connector': return 'Point Connector'
        default: return 'Item'
      }
    }
    
    const getActivateIcon = () => {
      switch (props.itemType) {
        case 'poi': return currentIcon.value || '📍'
        case 'connection': return '🌀'
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
          customIcon: icon.emoji
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
    
    return {
      iconSize,
      labelSize,
      currentLabelPosition,
      currentIcon,
      availableIcons,
      popupStyle,
      hasLabel,
      hasIcon,
      getItemTypeLabel,
      getActivateIcon,
      updateIcon,
      updateLabelPosition,
      updateIconSize,
      updateLabelSize,
      handleActivate,
      handleDelete
    }
  }
}
</script>

<style scoped>
.admin-popup {
  position: absolute;
  background: rgba(30, 30, 30, 0.98);
  border: 2px solid #4a7c59;
  border-radius: 12px;
  padding: 0;
  width: 320px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8);
  z-index: 1100;
  overflow: hidden;
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
</style>