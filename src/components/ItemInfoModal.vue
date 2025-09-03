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
            <div class="external-link">
              <a :href="monstersAndMetadataUrl" target="_blank" rel="noopener noreferrer" class="metadata-link">
                <div class="metadata-logo">
                  <span class="logo-m">M</span>
                  <span class="logo-amp">&</span>
                  <span class="logo-metadata">Metadata</span>
                </div>
                <span class="metadata-link-text">View on Monsters & Metadata</span>
              </a>
            </div>
          </div>
        </div>

        <!-- Item Stats -->
        <div v-if="hasStats" class="item-stats">
          <h4>Statistics</h4>
          
          <!-- Primary Attributes -->
          <div v-if="hasPrimaryStats" class="stat-section">
            <h5>Attributes</h5>
            <div class="stats-grid">
              <div v-if="item.str" class="stat">
                <span class="stat-label">STR</span>
                <span class="stat-value" :class="{ negative: item.str < 0 }">{{ formatStatValue(item.str) }}</span>
              </div>
              <div v-if="item.sta" class="stat">
                <span class="stat-label">STA</span>
                <span class="stat-value" :class="{ negative: item.sta < 0 }">{{ formatStatValue(item.sta) }}</span>
              </div>
              <div v-if="item.agi" class="stat">
                <span class="stat-label">AGI</span>
                <span class="stat-value" :class="{ negative: item.agi < 0 }">{{ formatStatValue(item.agi) }}</span>
              </div>
              <div v-if="item.dex" class="stat">
                <span class="stat-label">DEX</span>
                <span class="stat-value" :class="{ negative: item.dex < 0 }">{{ formatStatValue(item.dex) }}</span>
              </div>
              <div v-if="item.wis" class="stat">
                <span class="stat-label">WIS</span>
                <span class="stat-value" :class="{ negative: item.wis < 0 }">{{ formatStatValue(item.wis) }}</span>
              </div>
              <div v-if="item.int" class="stat">
                <span class="stat-label">INT</span>
                <span class="stat-value" :class="{ negative: item.int < 0 }">{{ formatStatValue(item.int) }}</span>
              </div>
              <div v-if="item.cha" class="stat">
                <span class="stat-label">CHA</span>
                <span class="stat-value" :class="{ negative: item.cha < 0 }">{{ formatStatValue(item.cha) }}</span>
              </div>
            </div>
          </div>

          <!-- Combat Stats -->
          <div v-if="hasCombatStats" class="stat-section">
            <h5>Combat</h5>
            <div class="stats-grid">
              <div v-if="item.damage" class="stat">
                <span class="stat-label">DMG</span>
                <span class="stat-value">{{ item.damage }}</span>
              </div>
              <div v-if="item.delay" class="stat">
                <span class="stat-label">DELAY</span>
                <span class="stat-value">{{ item.delay }}</span>
              </div>
              <div v-if="item.attack_speed && Number(item.attack_speed) !== 0" class="stat">
                <span class="stat-label">ATK SPD</span>
                <span class="stat-value">{{ item.attack_speed }}</span>
              </div>
              <div v-if="item.ac" class="stat">
                <span class="stat-label">AC</span>
                <span class="stat-value" :class="{ negative: item.ac < 0 }">{{ formatStatValue(item.ac) }}</span>
              </div>
              <div v-if="item.block" class="stat">
                <span class="stat-label">BLOCK</span>
                <span class="stat-value" :class="{ negative: item.block < 0 }">{{ formatStatValue(item.block) }}</span>
              </div>
            </div>
          </div>

          <!-- Resources -->
          <div v-if="hasResourceStats" class="stat-section">
            <h5>Resources</h5>
            <div class="stats-grid">
              <div v-if="item.health" class="stat">
                <span class="stat-label">HP</span>
                <span class="stat-value" :class="{ negative: item.health < 0 }">{{ formatStatValue(item.health) }}</span>
              </div>
              <div v-if="item.mana" class="stat">
                <span class="stat-label">MP</span>
                <span class="stat-value" :class="{ negative: item.mana < 0 }">{{ formatStatValue(item.mana) }}</span>
              </div>
            </div>
          </div>

          <!-- Resistances -->
          <div v-if="hasResistances" class="stat-section">
            <h5>Resistances</h5>
            <div class="stats-grid">
              <div v-if="item.resist_cold" class="stat">
                <span class="stat-label">COLD</span>
                <span class="stat-value" :class="{ negative: item.resist_cold < 0 }">{{ formatStatValue(item.resist_cold) }}</span>
              </div>
              <div v-if="item.resist_fire" class="stat">
                <span class="stat-label">FIRE</span>
                <span class="stat-value" :class="{ negative: item.resist_fire < 0 }">{{ formatStatValue(item.resist_fire) }}</span>
              </div>
              <div v-if="item.resist_electricity" class="stat">
                <span class="stat-label">ELEC</span>
                <span class="stat-value" :class="{ negative: item.resist_electricity < 0 }">{{ formatStatValue(item.resist_electricity) }}</span>
              </div>
              <div v-if="item.resist_poison" class="stat">
                <span class="stat-label">POISON</span>
                <span class="stat-value" :class="{ negative: item.resist_poison < 0 }">{{ formatStatValue(item.resist_poison) }}</span>
              </div>
              <div v-if="item.resist_disease" class="stat">
                <span class="stat-label">DISEASE</span>
                <span class="stat-value" :class="{ negative: item.resist_disease < 0 }">{{ formatStatValue(item.resist_disease) }}</span>
              </div>
              <div v-if="item.resist_magic" class="stat">
                <span class="stat-label">MAGIC</span>
                <span class="stat-value" :class="{ negative: item.resist_magic < 0 }">{{ formatStatValue(item.resist_magic) }}</span>
              </div>
              <div v-if="item.resist_corruption" class="stat">
                <span class="stat-label">CORRUPT</span>
                <span class="stat-value" :class="{ negative: item.resist_corruption < 0 }">{{ formatStatValue(item.resist_corruption) }}</span>
              </div>
            </div>
          </div>

          <!-- Item Properties -->
          <div v-if="hasProperties" class="stat-section">
            <h5>Properties</h5>
            <div class="properties-list">
              <div v-if="item.weight" class="property">
                <span class="property-label">Weight:</span>
                <span class="property-value">{{ item.weight }}</span>
              </div>
              <div v-if="item.size" class="property">
                <span class="property-label">Size:</span>
                <span class="property-value">{{ item.size }}</span>
              </div>
              <div v-if="item.skill" class="property">
                <span class="property-label">Skill:</span>
                <span class="property-value">{{ item.skill }}</span>
              </div>
              <div v-if="item.race && item.race !== 'ALL'" class="property">
                <span class="property-label">Race:</span>
                <span class="property-value">{{ item.race }}</span>
              </div>
              <div v-if="item.class && item.class !== 'ALL'" class="property">
                <span class="property-label">Class:</span>
                <span class="property-value">{{ item.class }}</span>
              </div>
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
          <div v-else>
            <!-- Top Pagination Controls -->
            <div v-if="totalPages > 1" class="pagination pagination-top">
              <button 
                class="pagination-btn" 
                :disabled="currentPage === 1"
                @click="prevPage"
              >
                ←
              </button>
              
              <div class="pagination-pages">
                <button 
                  v-for="page in Math.min(5, totalPages)" 
                  :key="page"
                  class="pagination-page"
                  :class="{ active: currentPage === page }"
                  @click="goToPage(page)"
                >
                  {{ page }}
                </button>
                
                <span v-if="totalPages > 5" class="pagination-ellipsis">...</span>
                
                <button 
                  v-if="totalPages > 5"
                  class="pagination-page"
                  :class="{ active: currentPage === totalPages }"
                  @click="goToPage(totalPages)"
                >
                  {{ totalPages }}
                </button>
              </div>
              
              <button 
                class="pagination-btn" 
                :disabled="currentPage === totalPages"
                @click="nextPage"
              >
                →
              </button>
            </div>
            
            <div class="npcs-list">
              <div 
                v-for="npc in paginatedNPCs" 
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
            
            <!-- Pagination Controls -->
            <div v-if="totalPages > 1" class="pagination">
              <button 
                class="pagination-btn" 
                :disabled="currentPage === 1"
                @click="prevPage"
              >
                ←
              </button>
              
              <div class="pagination-pages">
                <button 
                  v-for="page in Math.min(5, totalPages)" 
                  :key="page"
                  class="pagination-page"
                  :class="{ active: currentPage === page }"
                  @click="goToPage(page)"
                >
                  {{ page }}
                </button>
                
                <span v-if="totalPages > 5" class="pagination-ellipsis">...</span>
                
                <button 
                  v-if="totalPages > 5"
                  class="pagination-page"
                  :class="{ active: currentPage === totalPages }"
                  @click="goToPage(totalPages)"
                >
                  {{ totalPages }}
                </button>
              </div>
              
              <button 
                class="pagination-btn" 
                :disabled="currentPage === totalPages"
                @click="nextPage"
              >
                →
              </button>
            </div>
            
            <div class="pagination-info">
              Showing {{ (currentPage - 1) * itemsPerPage + 1 }}-{{ Math.min(currentPage * itemsPerPage, npcs.length) }} of {{ npcs.length }} NPCs
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
    const metadataLogoUrl = ref('https://monstersandmetadata.com/images/logo.png');
    
    // Pagination state
    const currentPage = ref(1);
    const itemsPerPage = ref(10);
    const totalPages = computed(() => Math.ceil(npcs.value.length / itemsPerPage.value));
    
    // Computed property for paginated NPCs
    const paginatedNPCs = computed(() => {
      const start = (currentPage.value - 1) * itemsPerPage.value;
      const end = start + itemsPerPage.value;
      return npcs.value.slice(start, end);
    });
    
    // Computed property for Monsters & Metadata URL
    const monstersAndMetadataUrl = computed(() => {
      if (!props.item || !props.item.name) return '#';
      // Replace spaces with hyphens and convert to lowercase for the URL
      const itemNameForUrl = props.item.name.toLowerCase().replace(/\s+/g, '-');
      return `https://monstersandmetadata.com/items/${itemNameForUrl}`;
    });
    
    // Handle logo load error with multiple fallbacks
    const handleLogoError = () => {
      // Try different possible logo URLs
      const fallbackUrls = [
        'https://monstersandmetadata.com/favicon.ico',
        'https://monstersandmetadata.com/logo.png',
        'https://monstersandmetadata.com/assets/logo.png',
        'https://monstersandmetadata.com/img/logo.png',
        // If all fail, use a data URL for a simple "M&M" text icon
        'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIGZpbGw9IiM0YTllZmYiIHJ4PSIyIi8+CiAgPHRleHQgeD0iOCIgeT0iMTEiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSI5IiBmb250LXdlaWdodD0iYm9sZCIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiPk0mTTwvdGV4dD4KPC9zdmc+'
      ];
      
      const currentUrl = metadataLogoUrl.value;
      const currentIndex = fallbackUrls.indexOf(currentUrl);
      
      if (currentIndex < fallbackUrls.length - 1) {
        // Try next fallback URL
        metadataLogoUrl.value = fallbackUrls[currentIndex + 1];
      }
    };
    
    // Pagination methods
    const goToPage = (page) => {
      if (page >= 1 && page <= totalPages.value) {
        currentPage.value = page;
      }
    };
    
    const nextPage = () => goToPage(currentPage.value + 1);
    const prevPage = () => goToPage(currentPage.value - 1);
    
    // Tooltip state
    const hoveredItem = ref(null);
    const tooltipVisible = ref(false);
    const tooltipPosition = ref({ x: 0, y: 0 });
    let tooltipTimeout = null;

    const hasStats = computed(() => {
      if (!props.item) return false;
      return hasPrimaryStats.value || hasCombatStats.value || hasResourceStats.value || hasResistances.value || hasProperties.value;
    });

    const hasPrimaryStats = computed(() => {
      if (!props.item) return false;
      return props.item.str || props.item.sta || props.item.agi || 
             props.item.dex || props.item.wis || props.item.int || 
             props.item.cha;
    });

    const hasCombatStats = computed(() => {
      if (!props.item) return false;
      return props.item.damage || props.item.delay || 
             (props.item.attack_speed && Number(props.item.attack_speed) !== 0) || 
             props.item.ac || props.item.block;
    });

    const hasResourceStats = computed(() => {
      if (!props.item) return false;
      return props.item.health || props.item.mana;
    });

    const hasResistances = computed(() => {
      if (!props.item) return false;
      return props.item.resist_cold || props.item.resist_fire || 
             props.item.resist_electricity || props.item.resist_poison || 
             props.item.resist_disease || props.item.resist_magic || 
             props.item.resist_corruption;
    });

    const hasProperties = computed(() => {
      if (!props.item) return false;
      return props.item.weight || props.item.size || props.item.skill || 
             (props.item.race && props.item.race !== 'ALL') || 
             (props.item.class && props.item.class !== 'ALL');
    });

    const formatStatValue = (value) => {
      if (value > 0) return `+${value}`;
      return String(value);
    };

    const loadNPCs = async () => {
      if (!props.item || !props.item.id) return;
      
      loadingNPCs.value = true;
      npcs.value = [];
      currentPage.value = 1; // Reset to first page
      
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
      hasPrimaryStats,
      hasCombatStats,
      hasResourceStats,
      hasResistances,
      hasProperties,
      selectNPC,
      formatDescription,
      formatStatValue,
      monstersAndMetadataUrl,
      metadataLogoUrl,
      handleLogoError,
      // Pagination
      paginatedNPCs,
      currentPage,
      totalPages,
      itemsPerPage,
      goToPage,
      nextPage,
      prevPage,
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

.external-link {
  margin-top: 0.75rem;
}

.metadata-link {
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  text-decoration: none;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  background: linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%);
  border: 1px solid rgba(255, 140, 75, 0.25);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05);
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.metadata-link::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255, 140, 75, 0.4), transparent);
  opacity: 0;
  transition: opacity 0.3s;
}

.metadata-link:hover {
  background: linear-gradient(135deg, #333 0%, #222 100%);
  border-color: rgba(255, 140, 75, 0.5);
  box-shadow: 0 4px 12px rgba(255, 140, 75, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.08);
  transform: translateY(-2px);
}

.metadata-link:hover::before {
  opacity: 1;
}

.metadata-link:active {
  transform: translateY(0);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.03);
}

.metadata-logo {
  display: flex;
  align-items: baseline;
  gap: 3px;
  flex-shrink: 0;
  background: #0a0a0a;
  border-radius: 4px;
  padding: 4px 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

.logo-m {
  font-size: 1.25rem;
  font-weight: 900;
  font-family: 'Arial Black', sans-serif;
  background: linear-gradient(180deg, #FF8C4B 0%, #E85A2C 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  line-height: 1;
}

.logo-amp {
  font-size: 1rem;
  font-weight: 700;
  color: #FF8C4B;
  margin: 0 2px;
  line-height: 1;
}

.logo-metadata {
  font-size: 0.9rem;
  font-weight: 600;
  color: #e0e0e0;
  font-family: Arial, sans-serif;
  line-height: 1;
  letter-spacing: 0.5px;
}

.metadata-link-text {
  color: #f0f0f0;
  font-size: 0.95rem;
  font-weight: 500;
  letter-spacing: 0.3px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  white-space: nowrap;
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

.stat-value.negative {
  color: #ff4d4d;
}

/* Stat Sections */
.stat-section {
  margin-bottom: 1.5rem;
}

.stat-section:last-child {
  margin-bottom: 0;
}

.stat-section h5 {
  color: #b8860b;
  margin: 0 0 0.75rem 0;
  font-size: 0.9rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Properties List */
.properties-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.property {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.property-label {
  color: #999;
  font-size: 0.9rem;
}

.property-value {
  color: #e0e0e0;
  font-size: 0.9rem;
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

/* Pagination Styles */
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #444;
}

.pagination-top {
  margin-top: 0;
  margin-bottom: 1rem;
  padding-top: 0;
  padding-bottom: 1rem;
  border-top: none;
  border-bottom: 1px solid #444;
}

.pagination-btn {
  background: rgba(255, 215, 0, 0.1);
  border: 1px solid rgba(255, 215, 0, 0.3);
  color: #FFD700;
  padding: 0.5rem 0.75rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1.2rem;
  transition: all 0.2s;
}

.pagination-btn:hover:not(:disabled) {
  background: rgba(255, 215, 0, 0.2);
  border-color: #FFD700;
}

.pagination-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pagination-pages {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.pagination-page {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid #444;
  color: #e0e0e0;
  padding: 0.5rem 0.75rem;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  min-width: 2.5rem;
}

.pagination-page:hover {
  background: rgba(255, 215, 0, 0.1);
  border-color: rgba(255, 215, 0, 0.3);
}

.pagination-page.active {
  background: rgba(255, 215, 0, 0.2);
  border-color: #FFD700;
  color: #FFD700;
  font-weight: bold;
}

.pagination-ellipsis {
  color: #999;
  padding: 0 0.5rem;
}

.pagination-info {
  text-align: center;
  color: #999;
  font-size: 0.9rem;
  margin-top: 0.5rem;
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