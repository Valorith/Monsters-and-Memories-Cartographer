<template>
  <div class="poi-type-dropdown" ref="dropdownRef">
    <div 
      class="dropdown-display" 
      @click="toggleDropdown"
      :class="{ 'is-open': isOpen }"
    >
      <div class="selected-type" v-if="selectedType">
        <span class="type-icon" v-html="renderIcon(selectedType)"></span>
        <span class="type-name">{{ selectedType.name }}</span>
      </div>
      <div class="placeholder" v-else>
        Select POI Type
      </div>
      <span class="dropdown-arrow">▼</span>
    </div>
    
    <div 
      v-show="isOpen" 
      class="dropdown-list"
    >
      <div 
        v-for="type in poiTypes" 
        :key="type.id"
        class="dropdown-item"
        :class="{ 'is-selected': type.id === modelValue }"
        @click="selectType(type)"
      >
        <span class="type-icon" v-html="renderIcon(type)"></span>
        <span class="type-name">{{ type.name }}</span>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted } from 'vue'

export default {
  name: 'POITypeDropdown',
  props: {
    modelValue: {
      type: [Number, String],
      default: null
    },
    poiTypes: {
      type: Array,
      required: true
    }
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const isOpen = ref(false)
    const dropdownRef = ref(null)
    
    const selectedType = computed(() => {
      return props.poiTypes.find(t => t.id === props.modelValue)
    })
    
    const toggleDropdown = () => {
      isOpen.value = !isOpen.value
    }
    
    const selectType = (type) => {
      emit('update:modelValue', type.id)
      isOpen.value = false
    }
    
    const renderIcon = (type) => {
      if (!type) return ''
      
      if (type.icon_type === 'emoji') {
        return `<span style="font-size: 1.2em;">${type.icon_value}</span>`
      } else if (type.icon_type === 'iconify' || type.icon_type === 'fontawesome') {
        return `<iconify-icon icon="${type.icon_value}" width="20" height="20"></iconify-icon>`
      } else if (type.icon_type === 'upload' && type.icon_value) {
        return `<img src="${type.icon_value}" alt="${type.name}" style="width: 20px; height: 20px; object-fit: contain;">`
      }
      return '📍'
    }
    
    // Close dropdown when clicking outside
    const handleClickOutside = (event) => {
      if (dropdownRef.value && !dropdownRef.value.contains(event.target)) {
        isOpen.value = false
      }
    }
    
    onMounted(() => {
      document.addEventListener('click', handleClickOutside)
    })
    
    onUnmounted(() => {
      document.removeEventListener('click', handleClickOutside)
    })
    
    return {
      isOpen,
      dropdownRef,
      selectedType,
      toggleDropdown,
      selectType,
      renderIcon
    }
  }
}
</script>

<style scoped>
.poi-type-dropdown {
  position: relative;
  width: 100%;
}

.dropdown-display {
  position: relative;
  padding: 0.5rem 2rem 0.5rem 0.5rem;
  background: #3a3a3a;
  color: #fff;
  border: 1px solid #555;
  border-radius: 4px;
  cursor: pointer;
  min-height: 38px;
  display: flex;
  align-items: center;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.dropdown-display:hover {
  border-color: #777;
  background: #4a4a4a;
}

.dropdown-display.is-open {
  border-color: #777;
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
}

.selected-type {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.placeholder {
  color: #999;
}

.dropdown-arrow {
  position: absolute;
  right: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
  font-size: 0.8rem;
  color: #999;
  transition: transform 0.2s;
}

.is-open .dropdown-arrow {
  transform: translateY(-50%) rotate(180deg);
}

.dropdown-list {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: #2d2d2d;
  border: 1px solid #555;
  border-top: none;
  border-bottom-left-radius: 4px;
  border-bottom-right-radius: 4px;
  max-height: 300px;
  overflow-y: auto;
  z-index: 1000;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
}

.dropdown-item {
  padding: 0.5rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: background 0.2s;
}

.dropdown-item:hover {
  background: rgba(74, 124, 89, 0.2);
}

.dropdown-item.is-selected {
  background: rgba(74, 124, 89, 0.3);
}

.type-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
}

.type-icon :deep(iconify-icon) {
  display: flex;
}

.type-name {
  flex: 1;
}

/* Scrollbar styling */
.dropdown-list::-webkit-scrollbar {
  width: 8px;
}

.dropdown-list::-webkit-scrollbar-track {
  background: #1a1a1a;
}

.dropdown-list::-webkit-scrollbar-thumb {
  background: #555;
  border-radius: 4px;
}

.dropdown-list::-webkit-scrollbar-thumb:hover {
  background: #666;
}
</style>