<template>
  <div class="map-filters-container" :class="{ collapsed: isCollapsed }">
    <div class="filters-header" @click="toggleCollapse">
      <div class="header-content">
        <span class="filter-icon">🔍</span>
        <h3>Map Filters</h3>
        <span class="active-count" v-if="activeFilterCount > 0">{{ activeFilterCount }} active</span>
      </div>
      <button class="collapse-btn" :class="{ rotated: !isCollapsed }">
        <svg width="12" height="12" viewBox="0 0 12 12">
          <path d="M2 4l4 4 4-4" stroke="currentColor" stroke-width="2" fill="none"/>
        </svg>
      </button>
    </div>
    
    <Transition name="slide">
      <div v-if="!isCollapsed" class="filters-body">
        <!-- Quick Actions -->
        <div class="filter-actions">
          <button @click="resetFilters" class="action-btn reset-btn" :disabled="activeFilterCount === 0">
            <span>↺</span> Reset All
          </button>
          <button @click="savePreset" class="action-btn save-btn" v-if="activeFilterCount > 0">
            <span>💾</span> Save Preset
          </button>
        </div>

        <!-- Search Filter -->
        <div class="filter-section">
          <div class="section-header">
            <span class="section-icon">🔤</span>
            <h4>Search</h4>
          </div>
          <input 
            v-model="searchQuery"
            type="text" 
            placeholder="Search POIs by name..."
            class="search-input"
            @input="updateFilters"
          />
        </div>

        <!-- POI Type Filter -->
        <div class="filter-section">
          <div class="section-header">
            <span class="section-icon">📍</span>
            <h4>POI Types</h4>
            <button @click="toggleAllTypes" class="toggle-all-btn">
              {{ allTypesSelected ? 'Deselect All' : 'Select All' }}
            </button>
          </div>
          <div class="poi-types-grid">
            <label 
              v-for="type in poiTypes" 
              :key="type.id"
              class="poi-type-checkbox"
              :class="{ selected: selectedTypes.includes(type.id) }"
            >
              <input 
                type="checkbox" 
                :value="type.id"
                v-model="selectedTypes"
                @change="updateFilters"
              />
              <span class="type-icon">
                <span v-if="type.icon_type === 'emoji'">{{ type.icon_value }}</span>
                <iconify-icon v-else-if="type.icon_type === 'iconify'" :icon="type.icon_value" width="16"></iconify-icon>
                <img v-else-if="type.icon_type === 'upload'" :src="type.icon_value" width="16" height="16" />
              </span>
              <span class="type-name">{{ type.name }}</span>
              <span class="type-count">{{ getTypeCount(type.id) }}</span>
            </label>
          </div>
        </div>

        <!-- Source Filter -->
        <div class="filter-section">
          <div class="section-header">
            <span class="section-icon">🏛️</span>
            <h4>Source</h4>
            <button @click="toggleAllSources" class="toggle-all-btn">
              {{ allSourcesSelected ? 'Deselect All' : 'Select All' }}
            </button>
          </div>
          <div class="source-options">
            <label class="checkbox-option" :class="{ selected: selectedSources.includes('official') }">
              <input 
                type="checkbox" 
                value="official" 
                v-model="selectedSources"
                @change="updateFilters"
              />
              <span class="checkbox-label">Official POIs</span>
            </label>
            <label class="checkbox-option" :class="{ selected: selectedSources.includes('custom') }" v-if="isAuthenticated">
              <input 
                type="checkbox" 
                value="custom" 
                v-model="selectedSources"
                @change="updateFilters"
              />
              <span class="checkbox-label">My Custom POIs</span>
            </label>
            <label class="checkbox-option" :class="{ selected: selectedSources.includes('shared') }" v-if="isAuthenticated">
              <input 
                type="checkbox" 
                value="shared" 
                v-model="selectedSources"
                @change="updateFilters"
              />
              <span class="checkbox-label">Shared POIs</span>
            </label>
            <label class="checkbox-option" :class="{ selected: selectedSources.includes('proposals') }">
              <input 
                type="checkbox" 
                value="proposals" 
                v-model="selectedSources"
                @change="updateFilters"
              />
              <span class="checkbox-label">Proposals</span>
            </label>
          </div>
        </div>

        <!-- Connection Filter -->
        <div class="filter-section">
          <div class="section-header">
            <span class="section-icon">🔗</span>
            <h4>Connections</h4>
          </div>
          <div class="connection-options">
            <label class="checkbox-option" :class="{ selected: showConnections }">
              <input 
                type="checkbox" 
                v-model="showConnections"
                @change="updateFilters"
              />
              <span class="checkbox-label">Show Connections</span>
            </label>
            <label class="checkbox-option" :class="{ selected: showLabels }">
              <input 
                type="checkbox" 
                v-model="showLabels"
                @change="updateFilters"
              />
              <span class="checkbox-label">Show POI Labels</span>
            </label>
          </div>
        </div>

        <!-- Saved Presets -->
        <div class="filter-section" v-if="savedPresets.length > 0">
          <div class="section-header">
            <span class="section-icon">⭐</span>
            <h4>Saved Presets</h4>
          </div>
          <div class="presets-list">
            <div 
              v-for="preset in savedPresets" 
              :key="preset.id"
              @click="loadPreset(preset)"
              class="preset-btn"
            >
              <span class="preset-name">{{ preset.name }}</span>
              <button @click.stop="deletePreset(preset.id)" class="delete-preset-btn">×</button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script>
import { ref, computed, watch, onMounted } from 'vue'
import { useToast } from '../composables/useToast'

export default {
  name: 'MapFilters',
  props: {
    poiTypes: {
      type: Array,
      default: () => []
    },
    allPois: {
      type: Array,
      default: () => []
    },
    isAuthenticated: {
      type: Boolean,
      default: false
    },
    initialFilters: {
      type: Object,
      default: () => ({})
    }
  },
  emits: ['update-filters'],
  setup(props, { emit }) {
    const { success, error } = useToast()
    
    // Initialize filter states from props or defaults
    const isCollapsed = ref(true)
    const searchQuery = ref(props.initialFilters.search || '')
    const selectedTypes = ref(props.initialFilters.types || [])
    const selectedSources = ref(props.initialFilters.sources || ['official', 'custom', 'shared'])
    const showConnections = ref(props.initialFilters.showConnections ?? true)
    const showLabels = ref(props.initialFilters.showLabels ?? true)
    const savedPresets = ref([])
    
    // Computed
    const activeFilterCount = computed(() => {
      let count = 0
      if (searchQuery.value) count++
      if (selectedTypes.value.length > 0 && selectedTypes.value.length < props.poiTypes.length) count++
      // Check if sources differ from default (official, custom, shared - without proposals)
      const defaultSources = ['official', 'custom', 'shared']
      const hasNonDefaultSources = selectedSources.value.length !== defaultSources.length || 
                                   selectedSources.value.some(s => !defaultSources.includes(s)) ||
                                   !selectedSources.value.includes('official') || 
                                   !selectedSources.value.includes('custom') || 
                                   !selectedSources.value.includes('shared')
      if (hasNonDefaultSources) count++
      if (!showConnections.value) count++
      if (!showLabels.value) count++
      return count
    })
    
    const allTypesSelected = computed(() => {
      return selectedTypes.value.length === props.poiTypes.length
    })
    
    // Methods
    const toggleCollapse = () => {
      isCollapsed.value = !isCollapsed.value
      localStorage.setItem('mapFiltersCollapsed', isCollapsed.value)
    }
    
    const updateFilters = () => {
      const filters = {
        search: searchQuery.value,
        types: selectedTypes.value,
        sources: selectedSources.value,
        showConnections: showConnections.value,
        showLabels: showLabels.value
      }
      emit('update-filters', filters)
    }
    
    const resetFilters = () => {
      searchQuery.value = ''
      selectedTypes.value = props.poiTypes.map(t => t.id)
      selectedSources.value = ['official', 'custom', 'shared']
      showConnections.value = true
      showLabels.value = true
      updateFilters()
      success('Filters reset')
    }
    
    const toggleAllTypes = () => {
      if (allTypesSelected.value) {
        selectedTypes.value = []
      } else {
        selectedTypes.value = props.poiTypes.map(t => t.id)
      }
      updateFilters()
    }
    
    const allSourcesSelected = computed(() => {
      const allSources = props.isAuthenticated ? ['official', 'custom', 'shared', 'proposals'] : ['official', 'proposals']
      return selectedSources.value.length === allSources.length
    })
    
    const toggleAllSources = () => {
      const allSources = props.isAuthenticated ? ['official', 'custom', 'shared', 'proposals'] : ['official', 'proposals']
      if (allSourcesSelected.value) {
        selectedSources.value = []
      } else {
        selectedSources.value = [...allSources]
      }
      updateFilters()
    }
    
    const getTypeCount = (typeId) => {
      // Check both poi_type_id and type_id fields as different POIs might use different field names
      return props.allPois.filter(poi => 
        poi.poi_type_id === typeId || 
        poi.type_id === typeId ||
        poi.poi_type?.id === typeId
      ).length
    }
    
    const savePreset = () => {
      const name = prompt('Enter a name for this filter preset:')
      if (!name) return
      
      const preset = {
        id: Date.now(),
        name,
        filters: {
          search: searchQuery.value,
          types: [...selectedTypes.value],
          sources: [...selectedSources.value],
          showConnections: showConnections.value,
          showLabels: showLabels.value
        }
      }
      
      savedPresets.value.push(preset)
      localStorage.setItem('mapFilterPresets', JSON.stringify(savedPresets.value))
      success('Preset saved')
    }
    
    const loadPreset = (preset) => {
      searchQuery.value = preset.filters.search || ''
      selectedTypes.value = preset.filters.types || []
      // Handle legacy presets that use 'source' instead of 'sources'
      if (preset.filters.sources) {
        selectedSources.value = preset.filters.sources
      } else if (preset.filters.source) {
        // Convert old format to new format
        if (preset.filters.source === 'all') {
          selectedSources.value = ['official', 'custom', 'shared']
        } else if (preset.filters.source === 'official') {
          selectedSources.value = ['official']
        } else if (preset.filters.source === 'custom') {
          selectedSources.value = ['custom']
        } else if (preset.filters.source === 'proposals') {
          selectedSources.value = ['proposals']
        }
      } else {
        selectedSources.value = ['official', 'custom', 'shared']
      }
      showConnections.value = preset.filters.showConnections ?? true
      showLabels.value = preset.filters.showLabels ?? true
      updateFilters()
      success(`Loaded preset: ${preset.name}`)
    }
    
    const deletePreset = (id) => {
      savedPresets.value = savedPresets.value.filter(p => p.id !== id)
      localStorage.setItem('mapFilterPresets', JSON.stringify(savedPresets.value))
    }
    
    // Load saved presets
    const loadPresets = () => {
      try {
        const saved = localStorage.getItem('mapFilterPresets')
        if (saved) {
          savedPresets.value = JSON.parse(saved)
        }
      } catch (e) {
        console.error('Error loading presets:', e)
      }
    }
    
    // Initialize
    onMounted(() => {
      // Load collapse state - default to true (collapsed) if not set
      const collapsed = localStorage.getItem('mapFiltersCollapsed')
      if (collapsed !== null) {
        isCollapsed.value = collapsed === 'true'
      } else {
        // Default to collapsed
        isCollapsed.value = true
        localStorage.setItem('mapFiltersCollapsed', 'true')
      }
      
      loadPresets()
      // Don't load filters from localStorage - they come from initialFilters prop
      updateFilters()
    })
    
    // Watch for POI types changes
    watch(() => props.poiTypes, (newTypes) => {
      // If we have new types and no types are selected, select all
      if (newTypes.length > 0 && selectedTypes.value.length === 0) {
        selectedTypes.value = newTypes.map(t => t.id)
        updateFilters()
      }
      // If we previously had all types selected, keep all selected
      else if (props.poiTypes.length > 0 && selectedTypes.value.length === props.poiTypes.length - 1) {
        selectedTypes.value = newTypes.map(t => t.id)
        updateFilters()
      }
    }, { deep: true, immediate: true })
    
    return {
      isCollapsed,
      searchQuery,
      selectedTypes,
      selectedSources,
      showConnections,
      showLabels,
      savedPresets,
      activeFilterCount,
      allTypesSelected,
      allSourcesSelected,
      toggleCollapse,
      updateFilters,
      resetFilters,
      toggleAllTypes,
      toggleAllSources,
      getTypeCount,
      savePreset,
      loadPreset,
      deletePreset
    }
  }
}
</script>

<style scoped>
.map-filters-container {
  position: absolute;
  top: 240px;
  right: 20px;
  width: 320px;
  background: rgba(26, 26, 26, 0.95);
  border: 2px solid #4a7c59;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.8);
  z-index: 100;
  backdrop-filter: blur(10px);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  transition: all 0.3s ease;
}

.map-filters-container.collapsed {
  width: auto;
}

.filters-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  cursor: pointer;
  user-select: none;
  border-bottom: 1px solid rgba(74, 124, 89, 0.3);
  background: rgba(74, 124, 89, 0.1);
  border-radius: 10px 10px 0 0;
}

.header-content {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.filter-icon {
  font-size: 1.25rem;
}

.filters-header h3 {
  margin: 0;
  font-size: 1.1rem;
  color: #FFD700;
  font-weight: 600;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
}

.active-count {
  background: #FFD700;
  color: #1a1a1a;
  padding: 0.15rem 0.5rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
}

.collapse-btn {
  background: none;
  border: none;
  color: #FFD700;
  cursor: pointer;
  padding: 0.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.3s ease;
}

.collapse-btn.rotated {
  transform: rotate(180deg);
}

.filters-body {
  padding: 1rem;
  max-height: calc(100vh - 200px);
  overflow-y: auto;
}

.filters-body::-webkit-scrollbar {
  width: 8px;
}

.filters-body::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 4px;
}

.filters-body::-webkit-scrollbar-thumb {
  background: #4a7c59;
  border-radius: 4px;
}

.filter-actions {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.action-btn {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid #4a7c59;
  background: rgba(74, 124, 89, 0.1);
  color: #e0e0e0;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
}

.action-btn:hover:not(:disabled) {
  background: rgba(74, 124, 89, 0.2);
  border-color: #5fa772;
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.reset-btn span {
  font-size: 1.1rem;
}

.filter-section {
  margin-bottom: 1.5rem;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.section-header h4 {
  margin: 0;
  font-size: 0.95rem;
  color: #FFD700;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.section-icon {
  font-size: 1rem;
}

.toggle-all-btn {
  background: none;
  border: 1px solid #4a7c59;
  color: #7fb069;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.toggle-all-btn:hover {
  background: rgba(74, 124, 89, 0.2);
  border-color: #5fa772;
}

.search-input {
  width: 100%;
  padding: 0.75rem;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid #444;
  border-radius: 6px;
  color: #e0e0e0;
  font-size: 0.875rem;
  transition: all 0.2s ease;
}

.search-input:focus {
  outline: none;
  border-color: #4a7c59;
  background: rgba(0, 0, 0, 0.6);
}

.search-input::placeholder {
  color: #666;
}

.poi-types-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}

.poi-type-checkbox {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid #333;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
}

.poi-type-checkbox:hover {
  background: rgba(74, 124, 89, 0.1);
  border-color: #4a7c59;
}

.poi-type-checkbox.selected {
  background: rgba(74, 124, 89, 0.2);
  border-color: #5fa772;
}

.poi-type-checkbox input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.type-icon {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.type-name {
  flex: 1;
  font-size: 0.8rem;
  color: #e0e0e0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.type-count {
  font-size: 0.875rem;
  color: #7fb069;
  background: rgba(0, 0, 0, 0.7);
  padding: 0.2rem 0.4rem;
  border-radius: 10px;
  font-weight: 600;
  margin-left: 0.25rem;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
}

.source-options,
.connection-options {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.radio-option,
.checkbox-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid #333;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.radio-option:hover,
.checkbox-option:hover {
  background: rgba(74, 124, 89, 0.1);
  border-color: #4a7c59;
}

.radio-option.selected,
.checkbox-option.selected {
  background: rgba(74, 124, 89, 0.2);
  border-color: #5fa772;
}

.radio-option input,
.checkbox-option input {
  margin: 0;
  cursor: pointer;
}

.radio-label,
.checkbox-label {
  font-size: 0.875rem;
  color: #e0e0e0;
  cursor: pointer;
}

.presets-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.preset-btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid #333;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.preset-btn:hover {
  background: rgba(74, 124, 89, 0.1);
  border-color: #4a7c59;
}

.preset-name {
  font-size: 0.875rem;
  color: #e0e0e0;
}

.delete-preset-btn {
  background: none;
  border: none;
  color: #dc3545;
  font-size: 1.2rem;
  cursor: pointer;
  padding: 0 0.25rem;
  line-height: 1;
  transition: transform 0.2s ease;
}

.delete-preset-btn:hover {
  transform: scale(1.2);
}

/* Transitions */
.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

/* Mobile responsiveness */
@media (max-width: 768px) {
  .map-filters-container {
    top: 200px;
    right: 10px;
    left: 10px;
    width: auto;
    max-width: 400px;
    margin: 0 auto;
  }
  
  .poi-types-grid {
    grid-template-columns: 1fr;
  }
}
</style>