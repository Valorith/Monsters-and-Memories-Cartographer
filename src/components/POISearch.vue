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
        placeholder="Search for POIs..."
        class="poi-search-input"
      />
      <span v-if="searchQuery" @click="clearSearch" class="search-clear">×</span>
      <span v-else class="search-icon">🔍</span>
    </div>
    
    <div v-if="showResults && (filteredResults.length > 0 || searchQuery.length > 0)" class="poi-search-results">
      <div v-if="filteredResults.length === 0" class="no-results">
        No POIs found matching "{{ searchQuery }}"
      </div>
      <div
        v-else
        v-for="(result, index) in filteredResults"
        :key="`${result.id}-${result.type}`"
        @click="selectPOI(result)"
        :class="['poi-search-result', { highlighted: highlightedIndex === index }]"
        @mouseenter="highlightedIndex = index"
      >
        <div class="result-icon" :style="{ color: result.color || '#FFD700' }" v-html="getResultIcon(result)"></div>
        <div class="result-content">
          <div class="result-name">{{ result.name }}</div>
          <div class="result-details">
            <span class="result-type">{{ formatPOIType(result) }}</span>
            <span v-if="result.map_name" class="result-map">• {{ result.map_name }}</span>
            <span v-if="result.match_type === 'description'" class="result-match">• Found in description</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch, onMounted } from 'vue';

export default {
  name: 'POISearch',
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
  emits: ['select-poi'],
  setup(props, { emit }) {
    const searchQuery = ref('');
    const showResults = ref(false);
    const highlightedIndex = ref(-1);
    const searchInput = ref(null);
    const poiTypes = ref([]);

    // Fuzzy search scoring function
    const calculateScore = (poi, query) => {
      const lowerQuery = query.toLowerCase();
      const lowerName = poi.name.toLowerCase();
      const lowerDesc = (poi.description || '').toLowerCase();
      
      let score = 0;
      let matchType = null;
      
      // Exact match
      if (lowerName === lowerQuery) {
        score = 100;
        matchType = 'exact';
      }
      // Starts with query
      else if (lowerName.startsWith(lowerQuery)) {
        score = 90;
        matchType = 'starts';
      }
      // Contains query as whole word
      else if (lowerName.match(new RegExp(`\\b${lowerQuery}\\b`))) {
        score = 80;
        matchType = 'word';
      }
      // Contains query
      else if (lowerName.includes(lowerQuery)) {
        score = 70;
        matchType = 'contains';
      }
      // Fuzzy match in name
      else {
        const nameScore = fuzzyMatch(lowerName, lowerQuery);
        if (nameScore > 0) {
          score = nameScore * 60;
          matchType = 'fuzzy';
        }
      }
      
      // Check description if no good name match
      if (score < 70 && lowerDesc) {
        if (lowerDesc.includes(lowerQuery)) {
          score = Math.max(score, 50);
          matchType = 'description';
        } else {
          const descScore = fuzzyMatch(lowerDesc, lowerQuery);
          if (descScore > 0.5) {
            score = Math.max(score, descScore * 40);
            matchType = 'description';
          }
        }
      }
      
      // Bonus for current map
      if (poi.map_id === props.currentMapId) {
        score += 10;
      }
      
      return { score, matchType };
    };

    // Simple fuzzy matching algorithm
    const fuzzyMatch = (str, query) => {
      let queryIndex = 0;
      let strIndex = 0;
      let matchedChars = 0;
      
      while (queryIndex < query.length && strIndex < str.length) {
        if (str[strIndex] === query[queryIndex]) {
          matchedChars++;
          queryIndex++;
        }
        strIndex++;
      }
      
      return matchedChars / query.length;
    };

    const filteredResults = computed(() => {
      if (!searchQuery.value || searchQuery.value.length < 2) {
        return [];
      }

      const results = props.allPois
        .map(poi => {
          const { score, matchType } = calculateScore(poi, searchQuery.value);
          if (score > 0) {
            return {
              ...poi,
              score,
              match_type: matchType,
              map_name: props.maps.find(m => m.id === poi.map_id)?.name
            };
          }
          return null;
        })
        .filter(Boolean)
        .sort((a, b) => {
          // Sort by score first
          if (b.score !== a.score) {
            return b.score - a.score;
          }
          // Then by current map
          if (a.map_id === props.currentMapId && b.map_id !== props.currentMapId) {
            return -1;
          }
          if (b.map_id === props.currentMapId && a.map_id !== props.currentMapId) {
            return 1;
          }
          // Finally by name
          return a.name.localeCompare(b.name);
        })
        .slice(0, 10); // Limit to top 10 results

      return results;
    });

    const formatPOIType = (poi) => {
      if (poi.is_custom) {
        if (poi.is_pending) {
          return 'Pending Custom POI';
        } else if (poi.is_shared) {
          return 'Shared Custom POI';
        } else {
          return 'My Custom POI';
        }
      }
      
      // Use POI type name if available
      if (poi.type_id && poiTypes.value.length > 0) {
        const poiType = poiTypes.value.find(t => t.id === poi.type_id);
        if (poiType) {
          return poiType.name;
        }
      }
      
      // Fallback to old type format
      if (poi.type) {
        return poi.type.charAt(0).toUpperCase() + poi.type.slice(1);
      }
      return 'POI';
    };

    const getResultIcon = (poi) => {
      // For custom POIs, use their custom icon if available
      if (poi.is_custom && poi.icon) {
        return poi.icon;
      }
      
      // Use POI type icon if available
      if (poi.type_id && poiTypes.value.length > 0) {
        const poiType = poiTypes.value.find(t => t.id === poi.type_id);
        if (poiType) {
          if (poiType.icon_type === 'emoji') {
            return poiType.icon_value;
          } else if (poiType.icon_type === 'iconify' || poiType.icon_type === 'fontawesome') {
            // Return Iconify web component HTML
            return `<iconify-icon icon="${poiType.icon_value}" width="20" height="20"></iconify-icon>`;
          } else if (poiType.icon_type === 'upload' && poiType.icon_value) {
            // Return image HTML for uploaded icons
            return `<img src="${poiType.icon_value}" alt="${poiType.name}" style="width: 20px; height: 20px; object-fit: contain;">`;
          }
          // For other icon types, return a default
          return '📍';
        }
      }
      
      // Fallback to old type-based icons for backward compatibility
      if (!poi.type) return '📍';
      
      const icons = {
        landmark: '🏛️',
        quest: '❗',
        merchant: '💰',
        npc: '💀',
        dungeon: '⚔️',
        other: '📍'
      };
      
      return icons[poi.type] || '📍';
    };
    
    const loadPoiTypes = async () => {
      try {
        const response = await fetch('/api/poi-types');
        if (!response.ok) throw new Error('Failed to load POI types');
        poiTypes.value = await response.json();
      } catch (error) {
        console.error('Error loading POI types:', error);
      }
    };
    
    onMounted(() => {
      loadPoiTypes();
    });

    const handleSearch = () => {
      showResults.value = true;
      highlightedIndex.value = -1;
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

    const selectPOI = (poi) => {
      emit('select-poi', poi);
      clearSearch();
    };

    const clearSearch = () => {
      searchQuery.value = '';
      showResults.value = false;
      highlightedIndex.value = -1;
    };

    const closeResults = () => {
      showResults.value = false;
      highlightedIndex.value = -1;
    };


    return {
      searchQuery,
      showResults,
      filteredResults,
      highlightedIndex,
      searchInput,
      handleSearch,
      handleFocus,
      handleKeydown,
      selectPOI,
      clearSearch,
      closeResults,
      formatPOIType,
      getResultIcon
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

.result-name {
  font-weight: bold;
  color: #FFD700;
  margin-bottom: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
</style>