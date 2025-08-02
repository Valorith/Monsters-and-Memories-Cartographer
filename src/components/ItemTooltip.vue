<template>
  <div 
    v-if="item && visible" 
    class="item-tooltip"
    :style="tooltipStyle"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
    @click="handleClick"
  >
    <div class="tooltip-header">
      <span v-if="item.icon_type === 'emoji'" class="tooltip-icon">{{ item.icon_value || '📦' }}</span>
      <iconify-icon v-else-if="item.icon_type === 'iconify'" :icon="item.icon_value" class="tooltip-icon" width="24"></iconify-icon>
      <span class="tooltip-name">{{ item.name }}</span>
    </div>
    <div v-if="item.description" class="tooltip-description" v-html="formatDescription(item.description)"></div>
    <div v-if="item.slot" class="tooltip-slot">Slot: {{ item.slot }}</div>
    <div v-if="hasStats" class="tooltip-stats">
      <span v-if="item.str" class="stat">STR +{{ item.str }}</span>
      <span v-if="item.sta" class="stat">STA +{{ item.sta }}</span>
      <span v-if="item.agi" class="stat">AGI +{{ item.agi }}</span>
      <span v-if="item.dex" class="stat">DEX +{{ item.dex }}</span>
      <span v-if="item.wis" class="stat">WIS +{{ item.wis }}</span>
      <span v-if="item.int" class="stat">INT +{{ item.int }}</span>
      <span v-if="item.cha" class="stat">CHA +{{ item.cha }}</span>
      <span v-if="item.ac" class="stat">AC +{{ item.ac }}</span>
      <span v-if="item.health" class="stat">HP +{{ item.health }}</span>
      <span v-if="item.mana" class="stat">MP +{{ item.mana }}</span>
    </div>
    <div v-if="showActions && isAuthenticated && !isAdmin" class="tooltip-actions">
      <button class="tooltip-edit-btn" @click="$emit('propose-edit')" title="Propose changes to this item">
        <span class="btn-icon">✏️</span>
        <span class="btn-text">Propose Edit</span>
      </button>
    </div>
  </div>
</template>

<script>
import { computed } from 'vue';

export default {
  name: 'ItemTooltip',
  props: {
    item: {
      type: Object,
      default: null
    },
    visible: {
      type: Boolean,
      default: false
    },
    position: {
      type: Object,
      default: () => ({ x: 0, y: 0 })
    },
    showActions: {
      type: Boolean,
      default: true
    },
    isAuthenticated: {
      type: Boolean,
      default: false
    },
    isAdmin: {
      type: Boolean,
      default: false
    }
  },
  emits: ['mouseenter', 'mouseleave', 'propose-edit', 'close'],
  setup(props, { emit }) {
    const hasStats = computed(() => {
      if (!props.item) return false;
      return props.item.str || props.item.sta || props.item.agi || 
             props.item.dex || props.item.wis || props.item.int || 
             props.item.cha || props.item.ac || props.item.health || 
             props.item.mana;
    });
    
    const tooltipStyle = computed(() => ({
      position: 'fixed',
      left: `${props.position.x}px`,
      top: `${props.position.y}px`,
      zIndex: 9999
    }));
    
    // Format description with clickable URLs and preserved newlines
    const formatDescription = (text) => {
      if (!text) return '';
      
      // Escape HTML to prevent XSS
      const escapeHtml = (str) => {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
      };
      
      // Regular expression to match URLs
      const urlRegex = /(https?:\/\/[^\s<]+)/g;
      
      // Escape HTML first
      let escaped = escapeHtml(text);
      
      // Replace newlines with <br> tags
      escaped = escaped.replace(/\n/g, '<br>');
      
      // Make URLs clickable
      return escaped.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">$1</a>');
    };
    
    // Mouse handlers
    const handleMouseEnter = () => {
      // Close immediately when mouse enters tooltip
      emit('close');
    };
    
    const handleMouseLeave = () => {
      // Also close when mouse leaves (shouldn't happen if closed on enter)
      emit('close');
    };
    
    const handleClick = (event) => {
      // Prevent the mouseenter close for links
      if (event.target.tagName === 'A') {
        event.stopPropagation();
      }
    };
    
    return {
      hasStats,
      tooltipStyle,
      formatDescription,
      handleMouseEnter,
      handleMouseLeave,
      handleClick
    };
  }
};
</script>

<style scoped>
.item-tooltip {
  position: fixed;
  background: rgba(20, 20, 20, 0.98);
  border: 2px solid #4a7c59;
  border-radius: 8px;
  padding: 12px;
  max-width: 300px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  pointer-events: auto;
  font-size: 14px;
  color: #e0e0e0;
}

.tooltip-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid #333;
}

.tooltip-icon {
  font-size: 20px;
  flex-shrink: 0;
}

.tooltip-name {
  color: #FFD700;
  font-weight: bold;
  font-size: 16px;
}

.tooltip-description {
  margin-bottom: 8px;
  line-height: 1.4;
  color: #b0b0b0;
  font-size: 13px;
  word-wrap: break-word;
  overflow-wrap: break-word;
  max-width: 100%;
}

.tooltip-description :deep(a) {
  color: #4a9eff;
  text-decoration: underline;
}

.tooltip-description :deep(a:hover) {
  color: #6bb6ff;
}

.tooltip-slot {
  color: #999;
  font-size: 13px;
  margin-bottom: 6px;
}

.tooltip-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #333;
}

.stat {
  background: rgba(74, 124, 89, 0.2);
  border: 1px solid #4a7c59;
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 12px;
  color: #4dff4d;
}

.tooltip-actions {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #333;
}

.tooltip-edit-btn {
  background: rgba(255, 215, 0, 0.1);
  border: 1px solid rgba(255, 215, 0, 0.3);
  border-radius: 4px;
  color: #FFD700;
  padding: 4px 8px;
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: all 0.2s;
  width: 100%;
  justify-content: center;
}

.tooltip-edit-btn:hover {
  background: rgba(255, 215, 0, 0.2);
  border-color: rgba(255, 215, 0, 0.5);
  transform: translateY(-1px);
}

.btn-icon {
  font-size: 14px;
}

.btn-text {
  font-weight: 500;
}
</style>