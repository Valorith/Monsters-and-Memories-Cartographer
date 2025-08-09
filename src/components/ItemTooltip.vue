<template>
  <div 
    v-if="item && visible" 
    class="item-tooltip"
    :style="tooltipStyle"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
    @click="handleClick"
  >
    <!-- Header with icon and name -->
    <div class="tooltip-header">
      <div class="header-content">
        <span v-if="item.icon_type === 'emoji'" class="tooltip-icon">{{ item.icon_value || '📦' }}</span>
        <iconify-icon v-else-if="item.icon_type === 'iconify'" :icon="item.icon_value" class="tooltip-icon" width="28"></iconify-icon>
        <div class="header-text">
          <div class="tooltip-name">{{ item.name }}</div>
          <div v-if="item.item_type" class="tooltip-type">{{ formatItemType(item.item_type) }}</div>
        </div>
      </div>
    </div>
    
    <!-- Slot and basic info -->
    <div v-if="item.slot || (item.slots && item.slots.length > 0) || item.skill" class="tooltip-basic-info">
      <div v-if="item.slot || (item.slots && item.slots.length > 0)" class="info-line">
        <span class="info-label">Slot:</span>
        <span class="info-value">{{ item.slots && item.slots.length > 0 ? item.slots.join(', ') : item.slot }}</span>
      </div>
      <div v-if="item.skill" class="info-line">
        <span class="info-label">Skill:</span>
        <span class="info-value">{{ item.skill }}</span>
      </div>
    </div>
    
    <!-- Combat Stats for weapons -->
    <div v-if="hasCombatStats" class="tooltip-section combat-section">
      <div v-if="item.damage" class="combat-line">
        <span class="combat-label">Damage:</span>
        <span class="combat-value">{{ item.damage }}</span>
      </div>
      <div v-if="item.delay" class="combat-line">
        <span class="combat-label">Delay:</span>
        <span class="combat-value">{{ item.delay }}</span>
      </div>
      <div v-if="item.attack_speed" class="combat-line">
        <span class="combat-label">Attack Speed:</span>
        <span class="combat-value">{{ item.attack_speed }}</span>
      </div>
    </div>
    
    <!-- Defensive Stats -->
    <div v-if="hasDefensiveStats" class="defensive-section">
      <div v-if="item.ac" class="stat-line">
        <span class="stat-value" :class="{ negative: item.ac < 0 }">{{ formatStatValue(item.ac) }} AC</span>
      </div>
      <div v-if="item.block" class="stat-line">
        <span class="stat-value" :class="{ negative: item.block < 0 }">{{ formatStatValue(item.block) }} Block</span>
      </div>
    </div>
    
    <!-- Primary Stats -->
    <div v-if="hasStats" class="tooltip-section stats-section">
      <div class="stats-grid">
        <div v-if="item.str" class="stat-item" :class="{ negative: item.str < 0 }">
          <span class="stat-label">STR</span>
          <span class="stat-value">{{ formatStatValue(item.str) }}</span>
        </div>
        <div v-if="item.sta" class="stat-item" :class="{ negative: item.sta < 0 }">
          <span class="stat-label">STA</span>
          <span class="stat-value">{{ formatStatValue(item.sta) }}</span>
        </div>
        <div v-if="item.agi" class="stat-item" :class="{ negative: item.agi < 0 }">
          <span class="stat-label">AGI</span>
          <span class="stat-value">{{ formatStatValue(item.agi) }}</span>
        </div>
        <div v-if="item.dex" class="stat-item" :class="{ negative: item.dex < 0 }">
          <span class="stat-label">DEX</span>
          <span class="stat-value">{{ formatStatValue(item.dex) }}</span>
        </div>
        <div v-if="item.wis" class="stat-item" :class="{ negative: item.wis < 0 }">
          <span class="stat-label">WIS</span>
          <span class="stat-value">{{ formatStatValue(item.wis) }}</span>
        </div>
        <div v-if="item.int" class="stat-item" :class="{ negative: item.int < 0 }">
          <span class="stat-label">INT</span>
          <span class="stat-value">{{ formatStatValue(item.int) }}</span>
        </div>
        <div v-if="item.cha" class="stat-item" :class="{ negative: item.cha < 0 }">
          <span class="stat-label">CHA</span>
          <span class="stat-value">{{ formatStatValue(item.cha) }}</span>
        </div>
      </div>
    </div>
    
    <!-- HP/Mana bonuses -->
    <div v-if="item.health || item.mana" class="bonus-section">
      <div v-if="item.health" class="bonus-line">
        <span class="bonus-value" :class="{ negative: item.health < 0 }">{{ formatStatValue(item.health) }} Hit Points</span>
      </div>
      <div v-if="item.mana" class="bonus-line">
        <span class="bonus-value" :class="{ negative: item.mana < 0 }">{{ formatStatValue(item.mana) }} Mana</span>
      </div>
    </div>
    
    <!-- Resistances -->
    <div v-if="hasResistances" class="tooltip-section resistance-section">
      <div class="section-header">Resistances</div>
      <div class="resistance-grid">
        <div v-if="item.resist_fire" class="resistance-item" :class="{ negative: item.resist_fire < 0 }">
          <span class="resistance-icon">🔥</span>
          <span class="resistance-value">{{ formatStatValue(item.resist_fire) }}</span>
        </div>
        <div v-if="item.resist_cold || item.resist_ice" class="resistance-item" :class="{ negative: (item.resist_cold || item.resist_ice) < 0 }">
          <span class="resistance-icon">❄️</span>
          <span class="resistance-value">{{ formatStatValue(item.resist_cold || item.resist_ice) }}</span>
        </div>
        <div v-if="item.resist_magic" class="resistance-item" :class="{ negative: item.resist_magic < 0 }">
          <span class="resistance-icon">✨</span>
          <span class="resistance-value">{{ formatStatValue(item.resist_magic) }}</span>
        </div>
        <div v-if="item.resist_poison" class="resistance-item" :class="{ negative: item.resist_poison < 0 }">
          <span class="resistance-icon">☠️</span>
          <span class="resistance-value">{{ formatStatValue(item.resist_poison) }}</span>
        </div>
        <div v-if="item.resist_disease" class="resistance-item" :class="{ negative: item.resist_disease < 0 }">
          <span class="resistance-icon">🦠</span>
          <span class="resistance-value">{{ formatStatValue(item.resist_disease) }}</span>
        </div>
        <div v-if="item.resist_electricity" class="resistance-item" :class="{ negative: item.resist_electricity < 0 }">
          <span class="resistance-icon">⚡</span>
          <span class="resistance-value">{{ formatStatValue(item.resist_electricity) }}</span>
        </div>
        <div v-if="item.resist_corruption" class="resistance-item" :class="{ negative: item.resist_corruption < 0 }">
          <span class="resistance-icon">💀</span>
          <span class="resistance-value">{{ formatStatValue(item.resist_corruption) }}</span>
        </div>
      </div>
    </div>
    
    <!-- Race/Class requirements -->
    <div v-if="(item.race && item.race !== 'ALL') || (item.class && item.class !== 'ALL')" class="tooltip-section requirements-section">
      <div v-if="item.race && item.race !== 'ALL'" class="requirement-line">
        <span class="requirement-label">Race:</span>
        <span class="requirement-value">{{ item.race }}</span>
      </div>
      <div v-if="item.class && item.class !== 'ALL'" class="requirement-line">
        <span class="requirement-label">Class:</span>
        <span class="requirement-value">{{ item.class }}</span>
      </div>
    </div>
    
    <!-- Weight/Size at bottom -->
    <div v-if="(item.weight && item.weight > 0) || (item.size && item.size !== 'Medium')" class="tooltip-section property-section">
      <div class="property-line">
        <span v-if="item.weight && item.weight > 0" class="property-item">Weight: {{ item.weight }}</span>
        <span v-if="item.size && item.size !== 'Medium'" class="property-item">Size: {{ item.size }}</span>
      </div>
    </div>
    
    <!-- Description -->
    <div v-if="item.description" class="tooltip-description" v-html="formatDescription(item.description)"></div>
    
    <!-- Actions -->
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
             props.item.cha;
    });
    
    const hasSecondaryStats = computed(() => {
      if (!props.item) return false;
      return props.item.ac || props.item.block || props.item.health || props.item.mana;
    });
    
    const hasDefensiveStats = computed(() => {
      if (!props.item) return false;
      return props.item.ac || props.item.block;
    });
    
    const hasBasicProperties = computed(() => {
      if (!props.item) return false;
      return props.item.item_type || (props.item.size && props.item.size !== 'Medium') || 
             props.item.weight || props.item.skill;
    });
    
    const hasCombatStats = computed(() => {
      if (!props.item) return false;
      return props.item.damage || props.item.delay || props.item.attack_speed;
    });
    
    const hasResistances = computed(() => {
      if (!props.item) return false;
      return props.item.resist_cold || props.item.resist_ice || props.item.resist_corruption || 
             props.item.resist_disease || props.item.resist_electricity || 
             props.item.resist_fire || props.item.resist_magic || 
             props.item.resist_poison;
    });
    
    
    const tooltipStyle = computed(() => ({
      position: 'fixed',
      left: `${props.position.x}px`,
      top: `${props.position.y}px`,
      zIndex: 10002
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
    
    // Format stat values with + or - prefix
    const formatStatValue = (value) => {
      if (!value) return '0';
      return value > 0 ? `+${value}` : `${value}`;
    };
    
    // Format item type for display
    const formatItemType = (type) => {
      if (!type) return '';
      return type.charAt(0).toUpperCase() + type.slice(1);
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
      hasSecondaryStats,
      hasDefensiveStats,
      hasBasicProperties,
      hasCombatStats,
      hasResistances,
      tooltipStyle,
      formatDescription,
      formatStatValue,
      formatItemType,
      handleMouseEnter,
      handleMouseLeave,
      handleClick
    };
  }
};
</script>

<style scoped>
/* Base tooltip styling */
.item-tooltip {
  position: fixed;
  background: linear-gradient(to bottom, rgba(15, 15, 20, 0.98), rgba(10, 10, 15, 0.98));
  border: 1px solid #2a2a3a;
  border-radius: 6px;
  padding: 0;
  min-width: 300px;
  max-width: 380px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.05);
  pointer-events: auto;
  font-size: 14px;
  color: #e0e0e0;
  backdrop-filter: blur(8px);
}

/* Header section */
.tooltip-header {
  background: linear-gradient(to bottom, rgba(30, 30, 40, 0.6), rgba(20, 20, 30, 0.4));
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding: 12px 16px;
  border-radius: 6px 6px 0 0;
}

.header-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.tooltip-icon {
  font-size: 28px;
  flex-shrink: 0;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5));
}

.header-text {
  flex: 1;
}

.tooltip-name {
  color: #fff;
  font-weight: 600;
  font-size: 16px;
  line-height: 1.2;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
}

.tooltip-type {
  color: #999;
  font-size: 12px;
  text-transform: capitalize;
  margin-top: 2px;
}

/* Basic info section */
.tooltip-basic-info {
  padding: 10px 16px;
  background: rgba(255, 255, 255, 0.02);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.info-line {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 3px 0;
}

.info-line + .info-line {
  margin-top: 2px;
}

.info-label {
  color: #888;
  font-size: 13px;
}

.info-value {
  color: #ddd;
  font-size: 13px;
}

/* Section styling */
.tooltip-section {
  padding: 10px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  width: 100%;
  box-sizing: border-box;
}

.tooltip-section:last-of-type {
  border-bottom: none;
}

.tooltip-section + .tooltip-section {
  padding-top: 10px;
}

/* Combat section */
.combat-section {
  background: rgba(255, 50, 50, 0.03);
}

.combat-line {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
}

.combat-line + .combat-line {
  margin-top: 2px;
}

.combat-label {
  color: #aaa;
  font-size: 13px;
}

.combat-value {
  color: #ff9999;
  font-weight: 500;
}

/* Defensive stats */
.defensive-section {
  background: rgba(50, 150, 255, 0.03);
  text-align: center;
  padding: 10px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.stat-line {
  display: inline-block;
  margin: 0 10px;
}

.stat-line .stat-value {
  color: #66b3ff;
  font-weight: 500;
  font-size: 15px;
}

/* Stats grid */
.stats-section {
  background: rgba(50, 255, 50, 0.02);
  overflow: visible;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(65px, 1fr));
  gap: 6px;
  margin-top: 4px;
  width: 100%;
}

.stat-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 4px;
  padding: 5px 8px;
  transition: all 0.2s;
  min-height: 28px;
  width: 100%;
  box-sizing: border-box;
  overflow: hidden;
}

.stat-item:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.15);
}

.stat-item.negative {
  background: rgba(255, 0, 0, 0.05);
  border-color: rgba(255, 0, 0, 0.2);
}

.stat-label {
  color: #999;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  flex-shrink: 0;
}

.stat-value {
  color: #4dff4d;
  font-weight: 600;
  font-size: 13px;
  white-space: nowrap;
}

.stat-item.negative .stat-value {
  color: #ff6666;
}

/* Bonus section */
.bonus-section {
  background: rgba(255, 215, 0, 0.02);
  text-align: center;
  padding: 10px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.bonus-line {
  padding: 3px 0;
}

.bonus-line + .bonus-line {
  margin-top: 4px;
}

.bonus-value {
  color: #ffd700;
  font-weight: 500;
}

.bonus-value.negative {
  color: #ff6666;
}

/* Resistances */
.resistance-section {
  background: rgba(150, 100, 255, 0.02);
}

.section-header {
  color: #bbb;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  margin-bottom: 10px;
  text-align: center;
  letter-spacing: 0.5px;
}

.resistance-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(50px, 1fr));
  gap: 8px;
  margin-top: 4px;
}

.resistance-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 4px;
  padding: 6px 4px;
  transition: all 0.2s;
  min-height: 45px;
  gap: 2px;
}

.resistance-item:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.15);
}

.resistance-item.negative {
  background: rgba(255, 0, 0, 0.05);
  border-color: rgba(255, 0, 0, 0.2);
}

.resistance-icon {
  font-size: 16px;
  line-height: 1;
  display: block;
}

.resistance-value {
  color: #8888ff;
  font-weight: 600;
  font-size: 13px;
}

.resistance-item.negative .resistance-value {
  color: #ff8888;
}

/* Requirements */
.requirements-section {
  background: rgba(255, 100, 100, 0.02);
  padding: 10px 16px;
}

.requirement-line {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
}

.requirement-line + .requirement-line {
  margin-top: 2px;
}

.requirement-label {
  color: #ff9999;
  font-size: 12px;
  text-transform: uppercase;
}

.requirement-value {
  color: #ffcccc;
  font-size: 13px;
}

/* Properties */
.property-section {
  background: rgba(100, 100, 100, 0.02);
  padding: 10px 16px;
}

.property-line {
  display: flex;
  justify-content: center;
  gap: 20px;
}

.property-item {
  color: #888;
  font-size: 12px;
}

/* Description */
.tooltip-description {
  padding: 12px 16px;
  line-height: 1.5;
  color: #aaa;
  font-size: 13px;
  word-wrap: break-word;
  overflow-wrap: break-word;
  max-width: 100%;
  background: rgba(0, 0, 0, 0.2);
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.tooltip-description :deep(a) {
  color: #4a9eff;
  text-decoration: underline;
}

.tooltip-description :deep(a:hover) {
  color: #6bb6ff;
}

/* Actions */
.tooltip-actions {
  padding: 10px 16px;
  background: rgba(255, 215, 0, 0.02);
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 0 0 6px 6px;
}

.tooltip-edit-btn {
  background: rgba(255, 215, 0, 0.1);
  border: 1px solid rgba(255, 215, 0, 0.3);
  border-radius: 4px;
  color: #FFD700;
  padding: 6px 12px;
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s;
  width: 100%;
  justify-content: center;
}

.tooltip-edit-btn:hover {
  background: rgba(255, 215, 0, 0.2);
  border-color: rgba(255, 215, 0, 0.5);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(255, 215, 0, 0.2);
}

.btn-icon {
  font-size: 14px;
}

.btn-text {
  font-weight: 500;
}
</style>