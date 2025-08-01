<template>
  <div v-if="visible" class="dialog-backdrop" @click="handleBackdropClick">
    <div class="dialog-container" @click.stop>
      <div class="dialog-header">
        <h2>Select Item to Edit</h2>
        <button class="close-button" @click="$emit('close')">×</button>
      </div>
      
      <div class="dialog-body">
        <div class="search-section">
          <div class="search-input-wrapper">
            <span class="search-icon">🔍</span>
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search items by name..."
              class="search-input"
              @input="performSearch"
              ref="searchInput"
            >
            <button v-if="searchQuery" @click="clearSearch" class="clear-button">×</button>
          </div>
        </div>

        <div v-if="loading" class="loading-state">
          <div class="spinner"></div>
          <p>Loading items...</p>
        </div>

        <div v-else-if="error" class="error-state">
          <p>{{ error }}</p>
          <button @click="loadItems" class="retry-button">Retry</button>
        </div>

        <div v-else-if="filteredItems.length === 0 && searchQuery" class="empty-state">
          <p>No items found matching "{{ searchQuery }}"</p>
        </div>

        <div v-else-if="filteredItems.length === 0" class="empty-state">
          <p>No items available</p>
        </div>

        <div v-else class="items-grid">
          <div
            v-for="item in paginatedItems"
            :key="item.id"
            class="item-card"
            @click="selectItem(item)"
            :class="{ 'has-pending': item.has_pending_proposal }"
          >
            <div class="item-icon">
              <span v-if="item.icon_type === 'emoji'">{{ item.icon_value }}</span>
              <iconify-icon v-else :icon="item.icon_value"></iconify-icon>
            </div>
            <div class="item-info">
              <h3 class="item-name">{{ item.name }}</h3>
              <div class="item-details">
                <span v-if="item.level" class="item-level">Lvl {{ item.level }}</span>
                <span v-if="item.slot" class="item-slot">{{ formatSlot(item.slot) }}</span>
              </div>
              <div v-if="item.has_pending_proposal" class="pending-indicator">
                <span class="pending-dot"></span>
                Pending proposal
              </div>
            </div>
          </div>
        </div>

        <div v-if="totalPages > 1" class="pagination">
          <button
            @click="currentPage--"
            :disabled="currentPage === 0"
            class="pagination-button"
          >
            Previous
          </button>
          <span class="pagination-info">
            Page {{ currentPage + 1 }} of {{ totalPages }}
          </span>
          <button
            @click="currentPage++"
            :disabled="currentPage >= totalPages - 1"
            class="pagination-button"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch, nextTick } from 'vue'

export default {
  name: 'ItemSearchDialog',
  props: {
    visible: {
      type: Boolean,
      default: false
    }
  },
  emits: ['close', 'select'],
  setup(props, { emit }) {
    const searchInput = ref(null)
    const searchQuery = ref('')
    const items = ref([])
    const loading = ref(false)
    const error = ref(null)
    const currentPage = ref(0)
    const itemsPerPage = 12

    // Load all items
    const loadItems = async () => {
      loading.value = true
      error.value = null
      
      try {
        const response = await fetch('/api/items')
        if (!response.ok) {
          throw new Error('Failed to load items')
        }
        
        const data = await response.json()
        items.value = data.sort((a, b) => {
          // Sort by level (descending), then by name
          if (a.level !== b.level) {
            return (b.level || 0) - (a.level || 0)
          }
          return a.name.localeCompare(b.name)
        })
      } catch (err) {
        console.error('Error loading items:', err)
        error.value = 'Failed to load items. Please try again.'
      } finally {
        loading.value = false
      }
    }

    // Filter items based on search query
    const filteredItems = computed(() => {
      if (!searchQuery.value) {
        return items.value
      }
      
      const query = searchQuery.value.toLowerCase()
      return items.value.filter(item => 
        item.name.toLowerCase().includes(query)
      )
    })

    // Paginate filtered items
    const paginatedItems = computed(() => {
      const start = currentPage.value * itemsPerPage
      const end = start + itemsPerPage
      return filteredItems.value.slice(start, end)
    })

    // Calculate total pages
    const totalPages = computed(() => {
      return Math.ceil(filteredItems.value.length / itemsPerPage)
    })

    // Reset pagination when search changes
    const performSearch = () => {
      currentPage.value = 0
    }

    // Clear search
    const clearSearch = () => {
      searchQuery.value = ''
      currentPage.value = 0
    }

    // Format item slot
    const formatSlot = (slot) => {
      if (!slot) return ''
      
      const slotNames = {
        head: 'Head',
        chest: 'Chest',
        legs: 'Legs',
        feet: 'Feet',
        hands: 'Hands',
        arms: 'Arms',
        shoulders: 'Shoulders',
        waist: 'Waist',
        neck: 'Neck',
        earrings: 'Earrings',
        bracelets: 'Bracelets',
        ring: 'Ring',
        'main hand': 'Main Hand',
        'off hand': 'Off Hand',
        'two hand': 'Two Hand',
        ranged: 'Ranged',
        ammo: 'Ammo'
      }
      
      return slotNames[slot.toLowerCase()] || slot
    }

    // Select an item
    const selectItem = (item) => {
      if (item.has_pending_proposal) {
        return // Don't allow selection of items with pending proposals
      }
      emit('select', item)
      emit('close')
    }

    // Handle backdrop click
    const handleBackdropClick = (event) => {
      if (event.target === event.currentTarget) {
        emit('close')
      }
    }

    // Watch for dialog visibility changes
    watch(() => props.visible, async (newVal) => {
      if (newVal) {
        // Reset state
        searchQuery.value = ''
        currentPage.value = 0
        
        // Load items if not already loaded
        if (items.value.length === 0) {
          await loadItems()
        }
        
        // Focus search input
        await nextTick()
        searchInput.value?.focus()
      }
    })

    return {
      searchInput,
      searchQuery,
      items,
      loading,
      error,
      currentPage,
      filteredItems,
      paginatedItems,
      totalPages,
      loadItems,
      performSearch,
      clearSearch,
      formatSlot,
      selectItem,
      handleBackdropClick
    }
  }
}
</script>

<style scoped>
.dialog-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.dialog-container {
  background: #2d2d2d;
  border-radius: 12px;
  width: 90%;
  max-width: 800px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
  animation: slideIn 0.3s ease;
}

@keyframes slideIn {
  from {
    transform: translateY(-20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.dialog-header h2 {
  margin: 0;
  color: #fff;
  font-size: 1.5rem;
}

.close-button {
  background: none;
  border: none;
  color: #999;
  font-size: 2rem;
  cursor: pointer;
  padding: 0;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  transition: all 0.2s ease;
}

.close-button:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.dialog-body {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
}

.search-section {
  margin-bottom: 1.5rem;
}

.search-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 1rem;
  font-size: 1.2rem;
  opacity: 0.6;
}

.search-input {
  width: 100%;
  padding: 0.75rem 1rem 0.75rem 3rem;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  color: #fff;
  font-size: 1rem;
  transition: all 0.2s ease;
}

.search-input:focus {
  outline: none;
  border-color: #4a7c59;
  background: rgba(0, 0, 0, 0.5);
}

.search-input::placeholder {
  color: rgba(255, 255, 255, 0.5);
}

.clear-button {
  position: absolute;
  right: 0.5rem;
  background: none;
  border: none;
  color: #999;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.clear-button:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.1);
}

.loading-state,
.error-state,
.empty-state {
  text-align: center;
  padding: 3rem;
  color: #999;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top: 3px solid #4a7c59;
  border-radius: 50%;
  margin: 0 auto 1rem;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.retry-button {
  margin-top: 1rem;
  padding: 0.5rem 1.5rem;
  background: #4a7c59;
  border: none;
  border-radius: 6px;
  color: #fff;
  cursor: pointer;
  transition: all 0.2s ease;
}

.retry-button:hover {
  background: #5a8c69;
}

.items-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.item-card {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 1rem;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.item-card:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.2);
  transform: translateY(-2px);
}

.item-card.has-pending {
  opacity: 0.6;
  cursor: not-allowed;
}

.item-card.has-pending:hover {
  transform: none;
}

.item-icon {
  font-size: 2.5rem;
  margin-bottom: 0.5rem;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.item-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.item-name {
  margin: 0;
  font-size: 1rem;
  color: #fff;
  font-weight: 500;
}

.item-details {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
  flex-wrap: wrap;
  font-size: 0.85rem;
  color: #999;
}

.item-level {
  color: #ffd700;
}

.item-slot {
  color: #87ceeb;
}

.pending-indicator {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.8rem;
  color: #ff9800;
  margin-top: 0.25rem;
}

.pending-dot {
  width: 6px;
  height: 6px;
  background: #ff9800;
  border-radius: 50%;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.pagination-button {
  padding: 0.5rem 1rem;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  color: #fff;
  cursor: pointer;
  transition: all 0.2s ease;
}

.pagination-button:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.3);
}

.pagination-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pagination-info {
  color: #999;
  font-size: 0.9rem;
}

/* Responsive */
@media (max-width: 640px) {
  .items-grid {
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  }
  
  .item-icon {
    font-size: 2rem;
    height: 40px;
  }
  
  .item-name {
    font-size: 0.9rem;
  }
}
</style>