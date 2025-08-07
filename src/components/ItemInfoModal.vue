<template>
  <div v-if="visible" class="modal-overlay" @click="$emit('close')">
    <div class="modal-container" @click.stop>
      <div class="modal-header">
        <h2 class="modal-title">Item Information</h2>
        <button class="close-btn" @click="$emit('close')">×</button>
      </div>
      
      <div v-if="item" class="modal-content">
        <!-- Item Header -->
        <div class="item-header">
          <div class="item-icon-large">
            <span v-if="item.icon_type === 'emoji'" class="icon-emoji">{{ item.icon_value || '📦' }}</span>
            <iconify-icon v-else-if="item.icon_type === 'iconify'" :icon="item.icon_value" width="48" height="48"></iconify-icon>
          </div>
          <div class="item-title-section">
            <h3 class="item-name">{{ item.name }}</h3>
            <div class="item-type">{{ item.item_type || 'Unknown Type' }} • {{ item.slot || 'N/A' }}</div>
          </div>
        </div>

        <!-- Item Stats -->
        <div v-if="hasStats" class="item-stats">
          <h4>Statistics</h4>
          <div class="stats-grid">
            <div v-if="item.str" class="stat">
              <span class="stat-label">STR</span>
              <span class="stat-value">+{{ item.str }}</span>
            </div>
            <div v-if="item.sta" class="stat">
              <span class="stat-label">STA</span>
              <span class="stat-value">+{{ item.sta }}</span>
            </div>
            <div v-if="item.agi" class="stat">
              <span class="stat-label">AGI</span>
              <span class="stat-value">+{{ item.agi }}</span>
            </div>
            <div v-if="item.dex" class="stat">
              <span class="stat-label">DEX</span>
              <span class="stat-value">+{{ item.dex }}</span>
            </div>
            <div v-if="item.wis" class="stat">
              <span class="stat-label">WIS</span>
              <span class="stat-value">+{{ item.wis }}</span>
            </div>
            <div v-if="item.int" class="stat">
              <span class="stat-label">INT</span>
              <span class="stat-value">+{{ item.int }}</span>
            </div>
            <div v-if="item.cha" class="stat">
              <span class="stat-label">CHA</span>
              <span class="stat-value">+{{ item.cha }}</span>
            </div>
            <div v-if="item.health" class="stat">
              <span class="stat-label">HP</span>
              <span class="stat-value">+{{ item.health }}</span>
            </div>
            <div v-if="item.mana" class="stat">
              <span class="stat-label">MP</span>
              <span class="stat-value">+{{ item.mana }}</span>
            </div>
            <div v-if="item.ac" class="stat">
              <span class="stat-label">AC</span>
              <span class="stat-value">+{{ item.ac }}</span>
            </div>
            <div v-if="item.attack_speed" class="stat">
              <span class="stat-label">ATK SPD</span>
              <span class="stat-value">{{ item.attack_speed }}</span>
            </div>
          </div>
        </div>

        <!-- Item Description -->
        <div v-if="item.description" class="item-description">
          <h4>Description</h4>
          <p v-html="formatDescription(item.description)"></p>
        </div>

        <!-- NPCs that drop this item -->
        <div class="npcs-section">
          <h4>Dropped By</h4>
          <div v-if="loadingNPCs" class="loading">
            <span class="spinner">⟳</span> Loading NPCs...
          </div>
          <div v-else-if="npcs.length === 0" class="no-npcs">
            No NPCs found that drop this item.
          </div>
          <div v-else class="npcs-list">
            <div 
              v-for="npc in npcs" 
              :key="npc.id"
              class="npc-item"
              @click="selectNPC(npc)"
              @mouseenter="hoveredNPC = npc.id"
              @mouseleave="hoveredNPC = null"
            >
              <div class="npc-icon">👤</div>
              <div class="npc-info">
                <div class="npc-name">{{ npc.name }}</div>
                <div class="npc-details">
                  Level {{ npc.level }} • {{ npc.location_count || 0 }} location{{ npc.location_count === 1 ? '' : 's' }}
                </div>
              </div>
              <div class="npc-stats">
                <div class="npc-stat">HP: {{ npc.hp }}</div>
                <div class="npc-stat">AC: {{ npc.ac }}</div>
              </div>
              <div class="arrow-icon">→</div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Item Tooltip -->
    <ItemTooltip
      :item="hoveredItem"
      :visible="tooltipVisible"
      :position="tooltipPosition"
      :show-actions="false"
      @mouseenter="cancelTooltipHide"
      @mouseleave="hideTooltip"
      @close="hideTooltip"
    />
  </div>
</template>

<script>
import { ref, watch, computed } from 'vue';
import ItemTooltip from './ItemTooltip.vue';

export default {
  name: 'ItemInfoModal',
  components: {
    ItemTooltip
  },
  props: {
    visible: {
      type: Boolean,
      default: false
    },
    item: {
      type: Object,
      default: null
    }
  },
  emits: ['close', 'select-npc'],
  setup(props, { emit }) {
    const npcs = ref([]);
    const loadingNPCs = ref(false);
    const hoveredNPC = ref(null);
    
    // Tooltip state
    const hoveredItem = ref(null);
    const tooltipVisible = ref(false);
    const tooltipPosition = ref({ x: 0, y: 0 });
    let tooltipTimeout = null;

    const hasStats = computed(() => {
      if (!props.item) return false;
      return props.item.str || props.item.sta || props.item.agi || 
             props.item.dex || props.item.wis || props.item.int || 
             props.item.cha || props.item.health || props.item.mana || 
             props.item.ac || props.item.attack_speed;
    });

    const loadNPCs = async () => {
      if (!props.item || !props.item.id) return;
      
      loadingNPCs.value = true;
      npcs.value = [];
      
      try {
        const response = await fetch(`/api/items/${props.item.id}/npcs`);
        if (response.ok) {
          const data = await response.json();
          npcs.value = data.npcs || [];
        }
      } catch (error) {
        console.error('Error loading NPCs:', error);
      } finally {
        loadingNPCs.value = false;
      }
    };

    const selectNPC = (npc) => {
      emit('select-npc', npc);
      emit('close');
    };

    // Load NPCs when item changes
    watch(() => props.item, (newItem) => {
      if (newItem && props.visible) {
        loadNPCs();
      }
    });

    // Load NPCs when modal becomes visible
    watch(() => props.visible, (newVisible) => {
      if (newVisible && props.item) {
        loadNPCs();
      }
    });

    // Tooltip functions
    const cancelTooltipHide = () => {
      if (tooltipTimeout) {
        clearTimeout(tooltipTimeout);
        tooltipTimeout = null;
      }
    };
    
    const hideTooltip = () => {
      tooltipVisible.value = false;
      hoveredItem.value = null;
      if (tooltipTimeout) {
        clearTimeout(tooltipTimeout);
        tooltipTimeout = null;
      }
    };
    
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
      return escaped.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
    };
    
    return {
      npcs,
      loadingNPCs,
      hoveredNPC,
      hasStats,
      selectNPC,
      formatDescription,
      // Tooltip
      hoveredItem,
      tooltipVisible,
      tooltipPosition,
      cancelTooltipHide,
      hideTooltip
    };
  }
};
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(5px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.modal-container {
  background: #2d2d2d;
  border: 2px solid #4a7c59;
  border-radius: 8px;
  max-width: 600px;
  width: 90%;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #444;
}

.modal-title {
  color: #FFD700;
  font-size: 1.5rem;
  margin: 0;
  font-family: 'Cinzel', serif;
}

.close-btn {
  background: none;
  border: none;
  color: #FFD700;
  font-size: 2rem;
  cursor: pointer;
  padding: 0;
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
}

.close-btn:hover {
  background: rgba(255, 215, 0, 0.2);
  transform: rotate(90deg);
}

.modal-content {
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1;
}

/* Item Header */
.item-header {
  display: flex;
  gap: 1rem;
  align-items: center;
  margin-bottom: 1.5rem;
}

.item-icon-large {
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 215, 0, 0.1);
  border: 2px solid #FFD700;
  border-radius: 8px;
}

.icon-emoji {
  font-size: 2.5rem;
}

.item-title-section {
  flex: 1;
}

.item-name {
  color: #FFD700;
  font-size: 1.25rem;
  margin: 0 0 0.25rem 0;
}

.item-type {
  color: #999;
  font-size: 0.9rem;
}

/* Item Stats */
.item-stats {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid #444;
  border-radius: 4px;
  padding: 1rem;
  margin-bottom: 1.5rem;
}

.item-stats h4 {
  color: #FFD700;
  margin: 0 0 1rem 0;
  font-size: 1rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  gap: 0.75rem;
}

.stat {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(255, 215, 0, 0.05);
  border: 1px solid rgba(255, 215, 0, 0.2);
  border-radius: 4px;
  padding: 0.5rem;
}

.stat-label {
  color: #999;
  font-size: 0.8rem;
  font-weight: bold;
}

.stat-value {
  color: #4dff4d;
  font-weight: bold;
}

/* Item Description */
.item-description {
  margin-bottom: 1.5rem;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid #333;
  border-radius: 4px;
  padding: 1rem;
}

.item-description h4 {
  color: #FFD700;
  margin: 0 0 0.5rem 0;
  font-size: 1rem;
}

.item-description p {
  color: #e0e0e0;
  margin: 0;
  line-height: 1.5;
  word-wrap: break-word;
  overflow-wrap: break-word;
  max-width: 100%;
  white-space: pre-wrap;
}

.item-description :deep(a) {
  color: #4a9eff;
  text-decoration: underline;
  word-break: break-all;
}

.item-description :deep(a:hover) {
  color: #6bb6ff;
}

/* NPCs Section */
.npcs-section h4 {
  color: #FFD700;
  margin: 0 0 1rem 0;
  font-size: 1rem;
}

.loading {
  text-align: center;
  color: #FFD700;
  padding: 2rem;
}

.spinner {
  display: inline-block;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.no-npcs {
  text-align: center;
  color: #999;
  padding: 2rem;
  font-style: italic;
}

.npcs-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.npc-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid #444;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.npc-item:hover {
  background: rgba(255, 215, 0, 0.1);
  border-color: rgba(255, 215, 0, 0.3);
  transform: translateX(4px);
}

.npc-icon {
  font-size: 2rem;
}

.npc-info {
  flex: 1;
}

.npc-name {
  color: #FFD700;
  font-weight: bold;
  margin-bottom: 0.25rem;
}

.npc-details {
  color: #999;
  font-size: 0.9rem;
}

.npc-stats {
  display: flex;
  gap: 1rem;
  color: #999;
  font-size: 0.85rem;
}

.arrow-icon {
  color: #FFD700;
  font-size: 1.25rem;
}

/* Scrollbar styling */
.modal-content::-webkit-scrollbar {
  width: 8px;
}

.modal-content::-webkit-scrollbar-track {
  background: #1a1a1a;
  border-radius: 4px;
}

.modal-content::-webkit-scrollbar-thumb {
  background: #4a7c59;
  border-radius: 4px;
}

.modal-content::-webkit-scrollbar-thumb:hover {
  background: #5fa772;
}
</style>