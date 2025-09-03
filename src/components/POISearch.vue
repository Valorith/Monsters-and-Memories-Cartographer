<template>
  <div class="poi-search-container" @click.stop>
    <div class="poi-search-wrapper">
      <input
        ref="searchInput"
        v-model="searchQuery"
        @input="handleSearch"
        @focus="handleFocus"
        @keydown="handleKeydown"
        type="text"
        placeholder="Search for POIs, items, NPCs..."
        class="poi-search-input"
      />
      <span v-if="searchQuery" @click="clearSearch" class="search-clear">×</span>
      <span v-else class="search-icon">🔍</span>
    </div>
    
    <div v-if="showResults && (filteredResults.length > 0 || searchQuery.length > 0 || isSearching)" class="poi-search-results">
      <div v-if="isSearching" class="searching">
        <span class="search-spinner">⟳</span> Searching...
      </div>
      <div v-else-if="filteredResults.length === 0" class="no-results">
        No results found matching "{{ searchQuery }}"
      </div>
      <div
        v-else
        v-for="(result, index) in filteredResults"
        :key="`${result.id}-${result.type}`"
        @click="selectPOI(result)"
        :class="['poi-search-result', { highlighted: highlightedIndex === index }]"
        @mouseenter="handleResultHover(result, index, $event)"
        @mouseleave="handleResultLeave(result)"
      >
        <div class="result-icon" :style="{ color: result.color || '#FFD700' }" v-html="getResultIcon(result)"></div>
        <div class="result-content">
          <div class="result-header">
            <div class="result-name">{{ result.name }}</div>
            <span class="result-type-badge" :class="getResultTypeBadgeClass(result)">
              {{ getResultTypeBadgeText(result) }}
            </span>
          </div>
          <div class="result-details">
            <span class="result-type">{{ formatPOIType(result) }}</span>
            <span v-if="result.map_name" class="result-map">• {{ result.map_name }}</span>
            <span v-if="result.match_type === 'description'" class="result-match">• Found in description</span>
          </div>
        </div>
      </div>
      <div v-if="searchQuery.length > 0" class="advanced-search-link" @click="openAdvancedSearch">
        <span class="advanced-search-icon">🔍</span>
        <span>Advanced Search for "{{ searchQuery }}"</span>
        <span class="advanced-search-arrow">→</span>
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
import { ref, computed, watch, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import ItemTooltip from './ItemTooltip.vue';

export default {
  name: 'POISearch',
  components: {
    ItemTooltip
  },
  directives: {
    clickOutside: {
      mounted(el, binding) {
        el.__clickOutsideHandler__ = (event) => {
          if (!el.contains(event.target)) {
            binding.value();
          }
        };
        document.addEventListener('click', el.__clickOutsideHandler__);
      },
      unmounted(el) {
        document.removeEventListener('click', el.__clickOutsideHandler__);
      }
    }
  },
  props: {
    allPois: {
      type: Array,
      required: true
    },
    currentMapId: {
      type: Number,
      default: null
    },
    maps: {
      type: Array,
      default: () => []
    }
  },
  emits: ['select-poi', 'select-item', 'select-npc'],
  setup(props, { emit }) {
    const router = useRouter();
    const searchQuery = ref('');
    const showResults = ref(false);
    const highlightedIndex = ref(-1);
    const searchInput = ref(null);
    const searchResults = ref([]);
    const isSearching = ref(false);
    let searchTimeout = null;
    
    // Tooltip state
    const hoveredItem = ref(null);
    const tooltipVisible = ref(false);
    const tooltipPosition = ref({ x: 0, y: 0 });
    let tooltipTimeout = null;

    // Perform search via API
    const performSearch = async () => {
      if (!searchQuery.value || searchQuery.value.length < 2) {
        searchResults.value = [];
        return;
      }

      isSearching.value = true;
      
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery.value)}`);
        if (response.ok) {
          const results = await response.json();
          searchResults.value = results;
        } else {
          searchResults.value = [];
        }
      } catch (error) {
        console.error('Search error:', error);
        searchResults.value = [];
      } finally {
        isSearching.value = false;
      }
    };

    const filteredResults = computed(() => {
      return searchResults.value;
    });

    const formatPOIType = (result) => {
      // Handle different result types
      if (result.result_type === 'item') {
        return `${result.item_type || 'Unknown'} • ${result.slot || 'N/A'}`;
      } else if (result.result_type === 'npc') {
        return `Level ${result.level} • ${result.location_count || 0} location${result.location_count === 1 ? '' : 's'}`;
      } else if (result.result_type === 'custom_poi') {
        if (result.is_pending) {
          return 'Pending';
        } else if (result.is_shared) {
          return 'Shared';
        } else {
          return result.owner_name || 'My POI';
        }
      }
      
      // Regular POI - use type name if available
      if (result.type_name) {
        return result.type_name;
      }
      
      // Fallback
      return 'Point of Interest';
    };

    const getResultIcon = (result) => {
      // For regular POIs - use the type icon
      if (result.result_type === 'poi' && result.type_icon_value) {
        if (result.type_icon_type === 'emoji') {
          return result.type_icon_value;
        } else if (result.type_icon_type === 'iconify') {
          return `<iconify-icon icon="${result.type_icon_value}" width="20" height="20"></iconify-icon>`;
        }
      }
      
      // For custom POIs - use their custom icon
      if (result.result_type === 'custom_poi' && result.icon_value) {
        return result.icon_value; // Custom POIs are always emoji
      }
      
      // For items - use their icon
      if (result.result_type === 'item' && result.icon_value) {
        if (result.icon_type === 'emoji') {
          return result.icon_value;
        } else if (result.icon_type === 'iconify') {
          return `<iconify-icon icon="${result.icon_value}" width="20" height="20"></iconify-icon>`;
        }
      }
      
      // For NPCs - they don't have custom icons in the database
      if (result.result_type === 'npc') {
        return '💀'; // Default NPC icon
      }
      
      // Fallback icons based on type
      switch (result.result_type) {
        case 'item':
          return '📦';
        case 'npc':
          return '💀';
        case 'custom_poi':
          return '📍';
        default:
          return '📍';
      }
    };
    
    const getResultTypeBadgeClass = (result) => {
      switch (result.result_type) {
        case 'item':
          return 'badge-item';
        case 'npc':
          return 'badge-npc';
        case 'custom_poi':
          return 'badge-custom-poi';
        default:
          return 'badge-poi';
      }
    };
    
    const getResultTypeBadgeText = (result) => {
      switch (result.result_type) {
        case 'item':
          return 'ITEM';
        case 'npc':
          return 'NPC';
        case 'custom_poi':
          return 'CUSTOM';
        default:
          return 'POI';
      }
    };

    const handleSearch = () => {
      showResults.value = searchQuery.value.length >= 2;
      highlightedIndex.value = -1;
      
      // Debounce search
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
      
      if (searchQuery.value.length >= 2) {
        searchTimeout = setTimeout(() => {
          performSearch();
        }, 300);
      } else {
        searchResults.value = [];
      }
    };

    const handleFocus = () => {
      if (searchQuery.value.length >= 2) {
        showResults.value = true;
      }
    };

    const handleKeydown = (event) => {
      if (!showResults.value || filteredResults.value.length === 0) {
        return;
      }

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          highlightedIndex.value = Math.min(highlightedIndex.value + 1, filteredResults.value.length - 1);
          break;
        case 'ArrowUp':
          event.preventDefault();
          highlightedIndex.value = Math.max(highlightedIndex.value - 1, -1);
          break;
        case 'Enter':
          event.preventDefault();
          if (highlightedIndex.value >= 0) {
            selectPOI(filteredResults.value[highlightedIndex.value]);
          }
          break;
        case 'Escape':
          closeResults();
          break;
      }
    };

    const selectPOI = (result) => {
      // Hide tooltip if showing
      hideTooltip();
      
      // Emit different events based on result type
      if (result.result_type === 'item') {
        emit('select-item', result);
      } else if (result.result_type === 'npc') {
        emit('select-npc', result);
      } else {
        // POI or custom POI
        emit('select-poi', result);
      }
      clearSearch();
    };

    const clearSearch = () => {
      searchQuery.value = '';
      showResults.value = false;
      highlightedIndex.value = -1;
      hideTooltip();
    };

    const closeResults = () => {
      showResults.value = false;
      highlightedIndex.value = -1;
      hideTooltip();
    };

    // Tooltip functions
    const handleResultHover = async (result, index, event) => {
      highlightedIndex.value = index;
      
      // Only show tooltip for items
      if (result.result_type !== 'item') {
        return;
      }
      
      // Clear any existing timeout
      if (tooltipTimeout) {
        clearTimeout(tooltipTimeout);
        tooltipTimeout = null;
      }
      
      // Show tooltip after a short delay
      tooltipTimeout = setTimeout(async () => {
        hoveredItem.value = result;
        
        // Calculate tooltip position
        const rect = event.target.getBoundingClientRect();
        const tooltipWidth = 300; // Approximate tooltip width
        
        // Position tooltip to the right of the result, or left if not enough space
        let x = rect.right + 10;
        if (x + tooltipWidth > window.innerWidth - 20) {
          x = rect.left - tooltipWidth - 10;
        }
        
        tooltipPosition.value = {
          x: x,
          y: rect.top
        };
        
        await nextTick();
        tooltipVisible.value = true;
      }, 300); // 300ms delay
    };
    
    const handleResultLeave = (result) => {
      if (result.result_type !== 'item') {
        return;
      }
      
      // Clear timeout if hovering away before tooltip shows
      if (tooltipTimeout) {
        clearTimeout(tooltipTimeout);
        tooltipTimeout = null;
      }
      
      // Start hide timer
      startTooltipHideTimer();
    };
    
    const startTooltipHideTimer = () => {
      if (tooltipTimeout) {
        clearTimeout(tooltipTimeout);
      }
      
      tooltipTimeout = setTimeout(() => {
        hideTooltip();
      }, 200); // 200ms delay before hiding
    };
    
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
    
    const openAdvancedSearch = () => {
      if (searchQuery.value) {
        // Navigate to search route with the current query
        router.push(`/search/${encodeURIComponent(searchQuery.value)}`);
        // Clear and close the search dropdown
        showResults.value = false;
      }
    };

    return {
      searchQuery,
      showResults,
      filteredResults,
      highlightedIndex,
      searchInput,
      isSearching,
      handleSearch,
      handleFocus,
      handleKeydown,
      selectPOI,
      clearSearch,
      closeResults,
      formatPOIType,
      getResultIcon,
      getResultTypeBadgeClass,
      getResultTypeBadgeText,
      // Tooltip
      hoveredItem,
      tooltipVisible,
      tooltipPosition,
      handleResultHover,
      handleResultLeave,
      cancelTooltipHide,
      hideTooltip,
      openAdvancedSearch
    };
  }
};
</script>

<style scoped>
.poi-search-container {
  position: relative;
  width: 100%;
  max-width: 400px;
  margin: 0 auto;
}

.poi-search-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.poi-search-input {
  width: 100%;
  padding: 10px 40px;
  font-size: 14px;
  border: 2px solid #4a3626;
  border-radius: 25px;
  background-color: rgba(42, 30, 20, 0.9);
  color: #e0d0b0;
  outline: none;
  transition: all 0.3s ease;
}

.poi-search-input:focus {
  border-color: #FFD700;
  box-shadow: 0 0 0 3px rgba(255, 215, 0, 0.2);
}

.poi-search-input::placeholder {
  color: #8b7355;
}

.search-icon,
.search-clear {
  position: absolute;
  font-size: 18px;
  color: #8b7355;
}

.search-icon {
  left: 15px;
  pointer-events: none;
}

.search-clear {
  right: 15px;
  cursor: pointer;
  font-size: 24px;
  transition: color 0.2s;
}

.search-clear:hover {
  color: #FFD700;
}

.poi-search-results {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 5px;
  background-color: rgba(42, 30, 20, 0.98);
  border: 2px solid #4a3626;
  border-radius: 10px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  max-height: 400px;
  overflow-y: auto;
  z-index: 1000;
}

.no-results {
  padding: 20px;
  text-align: center;
  color: #8b7355;
  font-style: italic;
}

.searching {
  padding: 20px;
  text-align: center;
  color: #FFD700;
}

.search-spinner {
  display: inline-block;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.poi-search-result {
  display: flex;
  align-items: center;
  padding: 12px 15px;
  cursor: pointer;
  transition: background-color 0.2s;
  border-bottom: 1px solid rgba(74, 54, 38, 0.3);
}

.poi-search-result:last-child {
  border-bottom: none;
}

.poi-search-result:hover,
.poi-search-result.highlighted {
  background-color: rgba(255, 215, 0, 0.1);
}

.result-icon {
  font-size: 20px;
  margin-right: 12px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
}

/* Ensure Iconify icons align properly */
.result-icon :deep(iconify-icon) {
  display: flex;
  align-items: center;
  justify-content: center;
}

.result-icon :deep(img) {
  display: block;
}

.result-content {
  flex: 1;
  overflow: hidden;
}

.result-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 2px;
}

.result-name {
  font-weight: bold;
  color: #FFD700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

/* Type Badges */
.result-type-badge {
  font-size: 10px;
  font-weight: bold;
  padding: 2px 6px;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  flex-shrink: 0;
}

.badge-poi {
  background: rgba(74, 124, 89, 0.3);
  color: #4dff4d;
  border: 1px solid rgba(74, 124, 89, 0.5);
}

.badge-item {
  background: rgba(138, 43, 226, 0.3);
  color: #da70d6;
  border: 1px solid rgba(138, 43, 226, 0.5);
}

.badge-npc {
  background: rgba(220, 20, 60, 0.3);
  color: #ff6b6b;
  border: 1px solid rgba(220, 20, 60, 0.5);
}

.badge-custom-poi {
  background: rgba(255, 165, 0, 0.3);
  color: #ffa500;
  border: 1px solid rgba(255, 165, 0, 0.5);
}

.result-details {
  font-size: 12px;
  color: #8b7355;
  display: flex;
  align-items: center;
  gap: 5px;
}

.result-type {
  color: #b8956a;
}

.result-map {
  color: #8b7355;
}

.result-match {
  color: #7a6a55;
  font-style: italic;
}

/* Scrollbar styling */
.poi-search-results::-webkit-scrollbar {
  width: 8px;
}

.poi-search-results::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
}

.poi-search-results::-webkit-scrollbar-thumb {
  background: #4a3626;
  border-radius: 4px;
}

.poi-search-results::-webkit-scrollbar-thumb:hover {
  background: #5a4636;
}

.advanced-search-link {
  padding: 12px 15px;
  border-top: 1px solid #8B4513;
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  transition: background-color 0.2s;
  color: #D2691E;
  font-weight: 500;
}

.advanced-search-link:hover {
  background: rgba(255, 215, 0, 0.1);
  color: #FFD700;
}

.advanced-search-icon {
  font-size: 18px;
}

.advanced-search-arrow {
  margin-left: auto;
  font-size: 18px;
  opacity: 0.7;
  transition: transform 0.2s;
}

.advanced-search-link:hover .advanced-search-arrow {
  transform: translateX(3px);
  opacity: 1;
}
</style>