<template>
  <div class="poi-type-manager">
    <div class="section-header">
      <h3>POI Type Management</h3>
      <button @click="showAddModal = true" class="primary-btn">
        <span class="btn-icon">➕</span>
        Add POI Type
      </button>
    </div>

    <div v-if="loading" class="loading">Loading POI types...</div>
    
    <div v-else-if="poiTypes.length === 0" class="empty-state">
      <p>No POI types defined yet.</p>
    </div>

    <div v-else class="poi-types-list">
      <!-- Pagination Controls -->
      <div class="pagination-controls">
        <div class="pagination-info">
          Showing {{ startIndex + 1 }}-{{ endIndex }} of {{ poiTypes.length }} types
        </div>
      </div>

      <table class="data-table">
        <thead>
          <tr>
            <th width="60">Icon</th>
            <th>Name</th>
            <th width="100">Type</th>
            <th width="80">Default</th>
            <th width="60">Order</th>
            <th width="120">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr 
            v-for="(type, index) in paginatedPoiTypes" 
            :key="type.id"
            :class="{ 'is-default': type.is_default }"
            draggable="true"
            @dragstart="startDrag(currentPage * itemsPerPage + index)"
            @dragover.prevent
            @drop="handleDrop(currentPage * itemsPerPage + index)"
          >
            <td class="icon-cell">
              <div class="poi-icon">
                <img v-if="type.icon_type === 'upload'" :src="type.icon_value" :alt="type.name" />
                <i v-else-if="type.icon_type === 'fontawesome'" :class="type.icon_value"></i>
                <span v-else>{{ type.icon_value }}</span>
              </div>
            </td>
            <td>{{ type.name }}</td>
            <td>{{ type.icon_type }}</td>
            <td>
              <button 
                v-if="!type.is_default" 
                @click="setDefault(type.id)" 
                class="small-btn secondary"
                title="Set as default"
              >
                Set Default
              </button>
              <span v-else class="status-badge success">Default</span>
            </td>
            <td class="order-cell">
              <span class="drag-handle" title="Drag to reorder">☰</span>
              {{ type.display_order }}
            </td>
            <td class="actions-cell">
              <button @click="editType(type)" class="icon-btn" title="Edit">
                ✏️
              </button>
              <button 
                @click="deleteType(type)" 
                class="icon-btn danger" 
                title="Delete"
                :disabled="type.is_default"
              >
                🗑️
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Pagination Navigation -->
      <div class="pagination-nav" v-if="totalPages > 1">
        <button 
          @click="currentPage = 0" 
          :disabled="currentPage === 0"
          class="pagination-btn"
          title="First page"
        >
          «
        </button>
        <button 
          @click="currentPage--" 
          :disabled="currentPage === 0"
          class="pagination-btn"
          title="Previous page"
        >
          ‹
        </button>
        
        <div class="pagination-pages">
          <template v-for="(page, index) in visiblePages" :key="index">
            <span v-if="page === '...'" class="pagination-ellipsis">...</span>
            <button 
              v-else
              @click="currentPage = page - 1"
              :class="['pagination-btn', { active: currentPage === page - 1 }]"
            >
              {{ page }}
            </button>
          </template>
        </div>
        
        <button 
          @click="currentPage++" 
          :disabled="currentPage === totalPages - 1"
          class="pagination-btn"
          title="Next page"
        >
          ›
        </button>
        <button 
          @click="currentPage = totalPages - 1" 
          :disabled="currentPage === totalPages - 1"
          class="pagination-btn"
          title="Last page"
        >
          »
        </button>
      </div>
    </div>

    <!-- Add/Edit Modal -->
    <div v-if="showAddModal || editingType" class="modal-overlay" @click="closeModal">
      <div class="modal-content" @click.stop>
        <h3>{{ editingType ? 'Edit POI Type' : 'Add POI Type' }}</h3>
        
        <form @submit.prevent="saveType">
          <div class="form-group">
            <label for="type-name">Name *</label>
            <input 
              id="type-name"
              v-model="formData.name" 
              type="text" 
              required 
              placeholder="e.g., Tavern, Quest Giver, Dungeon"
            />
          </div>

          <div class="form-group">
            <label>Icon Type *</label>
            <div class="radio-group">
              <label>
                <input 
                  type="radio" 
                  v-model="formData.icon_type" 
                  value="emoji"
                />
                Emoji
              </label>
              <label>
                <input 
                  type="radio" 
                  v-model="formData.icon_type" 
                  value="fontawesome"
                />
                Font Awesome
              </label>
              <label>
                <input 
                  type="radio" 
                  v-model="formData.icon_type" 
                  value="upload"
                />
                Upload Image
              </label>
            </div>
          </div>

          <!-- Emoji Picker -->
          <div v-if="formData.icon_type === 'emoji'" class="form-group">
            <label for="emoji-value">Emoji *</label>
            <div class="emoji-input-group">
              <input 
                id="emoji-value"
                v-model="formData.icon_value" 
                type="text" 
                required
                placeholder="Enter emoji or click to select"
                @click="showEmojiPicker = !showEmojiPicker; console.log('Input clicked, showEmojiPicker:', showEmojiPicker)"
              />
              <button type="button" @click="showEmojiPicker = !showEmojiPicker; console.log('Button clicked, showEmojiPicker:', showEmojiPicker)" class="emoji-picker-btn">
                😀
              </button>
            </div>
            
            <div v-if="showEmojiPicker" class="emoji-picker" @click.stop>
              <div class="emoji-picker-header">
                <span>Select Emoji</span>
                <button type="button" @click="showEmojiPicker = false" class="close-picker-btn">×</button>
              </div>
              <div class="emoji-categories">
                <button 
                  v-for="category in emojiCategories" 
                  :key="category.name"
                  @click="selectedEmojiCategory = category.name"
                  :class="['category-btn', { active: selectedEmojiCategory === category.name }]"
                  type="button"
                >
                  {{ category.icon }}
                </button>
              </div>
              <div class="emoji-grid">
                <button 
                  v-for="emoji in currentCategoryEmojis" 
                  :key="emoji"
                  @click="selectEmoji(emoji)"
                  class="emoji-option"
                  type="button"
                  :title="emoji"
                >
                  {{ emoji }}
                </button>
              </div>
              <p class="help-text" style="margin-top: 0.5rem;">
                <a href="https://emojipedia.org/" target="_blank">Browse more emojis →</a>
              </p>
            </div>
          </div>

          <!-- Font Awesome Picker -->
          <div v-if="formData.icon_type === 'fontawesome'" class="form-group">
            <label for="fa-value">Font Awesome Class *</label>
            <input 
              id="fa-value"
              v-model="formData.icon_value" 
              type="text" 
              required
              placeholder="e.g., fas fa-sword"
            />
            <p class="help-text">
              Enter Font Awesome class names. 
              <a href="https://fontawesome.com/icons" target="_blank">Browse icons →</a>
            </p>
          </div>

          <!-- Upload Image -->
          <div v-if="formData.icon_type === 'upload'" class="form-group">
            <label for="icon-upload">Icon Image *</label>
            <input 
              id="icon-upload"
              type="file" 
              accept="image/*"
              @change="handleFileSelect"
              :required="!editingType"
            />
            <p class="help-text">Max size: 1MB. Supported formats: PNG, JPG, GIF, SVG</p>
            
            <div v-if="formData.preview_url" class="icon-preview">
              <img :src="formData.preview_url" alt="Icon preview" />
            </div>
          </div>

          <div class="modal-actions">
            <button type="button" @click="closeModal" class="secondary-btn">
              Cancel
            </button>
            <button type="submit" class="primary-btn" :disabled="saving">
              {{ saving ? 'Saving...' : (editingType ? 'Update' : 'Add') }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useToast } from '../composables/useToast';

export default {
  name: 'POITypeManager',
  setup() {
    // console.log('POITypeManager component setup() called');
    
    const { success, error } = useToast();
    
    const poiTypes = ref([]);
    const loading = ref(true);
    const showAddModal = ref(false);
    const editingType = ref(null);
    const saving = ref(false);
    const draggedIndex = ref(null);
    const showEmojiPicker = ref(false);
    const selectedEmojiCategory = ref('rpg');
    
    // Pagination state
    const currentPage = ref(0);
    const itemsPerPage = ref(10);
    
    const formData = ref({
      name: '',
      icon_type: 'emoji',
      icon_value: '',
      preview_url: null,
      file: null
    });

    const emojiCategories = [
      { name: 'harvest', icon: '🪵', emojis: ['🪵', '🪨', '⛏️', '🔨', '⚒️', '🪓', '🛠️', '⚙️', '🔩', '⛓️', '🧱', '🪙', '🥈', '🥇', '🥉', '💎', '💍', '📿', '🔷', '🔶', '🟫', '⬜', '⬛', '🟥', '🟦', '🟩', '🟨', '🟧', '🟪', '🔳', '🔲', '◼️', '◻️', '◾', '◽', '▪️', '▫️', '🔸', '🔹', '🔺', '🔻'] },
      { name: 'plants', icon: '🌿', emojis: ['🌿', '🌾', '🌱', '🌲', '🌳', '🌴', '🌵', '🎋', '🎍', '🌺', '🌸', '🌼', '🌻', '🌹', '🌷', '🌺', '🥀', '🏵️', '💐', '🌿', '☘️', '🍀', '🍃', '🍂', '🍁', '🍄', '🟫', '🌰', '🫘', '🥜', '🌶️', '🫑', '🥒', '🥬', '🥦', '🧄', '🧅', '🥕', '🌽', '🥔', '🍠'] },
      { name: 'rpg', icon: '⚔️', emojis: ['⚔️', '🗡️', '🏹', '🛡️', '🪃', '🏏', '⚰️', '🪦', '💀', '☠️', '🎯', '🔮', '📿', '🏺', '⚗️', '🧪', '💉', '🩸', '🧬', '🦴', '🦷', '👑', '🎩', '🎓', '🪖', '⛑️', '📯', '🎺', '🥁', '🪘', '🔔', '📜', '📃', '📄', '🗞️', '🔖', '🏷️', '💼', '🎒', '👝', '👛', '👜'] },
      { name: 'locations', icon: '🏰', emojis: ['🏰', '🏯', '🏟️', '🗿', '🗽', '⛩️', '🕌', '🛕', '⛪', '🏛️', '🕍', '🕋', '⛺', '🏕️', '🏠', '🏡', '🏘️', '🏚️', '🏗️', '🏭', '🏢', '🏬', '🏣', '🏤', '🏥', '🏦', '🏨', '🏩', '🏪', '🏫', '⛽', '🚏', '🚥', '🚦', '🚧', '⚓', '⛵', '🚤', '🛶', '🚁', '🏖️', '🏜️', '🏝️'] },
      { name: 'map', icon: '🗺️', emojis: ['🗺️', '🧭', '📍', '📌', '🚩', '🏁', '🏳️', '🏴', '📐', '📏', '🔍', '🔎', '🔭', '🔬', '🗝️', '🔑', '🚪', '🪜', '🛤️', '🛣️', '🛑', '⛔', '🚫', '🚳', '🚭', '🚯', '🚱', '🚷', '📵', '🔞', '☢️', '☣️', '⬆️', '↗️', '➡️', '↘️', '⬇️', '↙️', '⬅️', '↖️', '↕️', '↔️'] },
      { name: 'creatures', icon: '🐉', emojis: ['🐉', '🦄', '🧙', '🧚', '🧛', '🧟', '🧞', '🧜', '🧝', '👺', '👹', '👻', '👽', '👾', '🤖', '🦇', '🦅', '🦉', '🦆', '🦢', '🦜', '🦩', '🦚', '🦃', '🐺', '🦊', '🦝', '🐻', '🐼', '🦁', '🐯', '🐅', '🐆', '🦓', '🦍', '🦧', '🐘', '🦏', '🦛', '🦒', '🦘'] },
      { name: 'weather', icon: '🌤️', emojis: ['☀️', '🌤️', '⛅', '🌥️', '☁️', '🌦️', '🌧️', '⛈️', '🌩️', '🌨️', '❄️', '☃️', '⛄', '🌬️', '💨', '💧', '💦', '☔', '☂️', '🌊', '🌫️', '🌪️', '🌈', '🌅', '🌄', '🌠', '🎇', '🎆', '🌇', '🌆', '🌃', '🌌', '🌉', '🌁', '⚡', '🔥', '💥', '❄️', '🌟', '⭐', '🌙', '☄️'] },
      { name: 'items', icon: '💰', emojis: ['💰', '💵', '💴', '💶', '💷', '💸', '💳', '🪙', '⚱️', '🏺', '🕯️', '💡', '🔦', '🏮', '🪔', '📦', '🎁', '🎀', '🎗️', '🏵️', '🏅', '🥇', '🥈', '🥉', '🏆', '🎖️', '🎪', '🎭', '🎨', '🎬', '🎤', '🎧', '🎼', '🎵', '🎶', '🎹', '🥁', '🎷', '🎺', '🎸', '🎻', '🎲', '🎯'] },
      { name: 'food', icon: '🍖', emojis: ['🍖', '🍗', '🥩', '🥓', '🧀', '🥚', '🍞', '🥖', '🥨', '🥐', '🥯', '🧇', '🧈', '🍳', '🥘', '🍲', '🥣', '🥗', '🍿', '🧂', '🥫', '🍱', '🍘', '🍙', '🍚', '🍛', '🍜', '🍺', '🍻', '🥂', '🍷', '🥃', '🍸', '🍹', '🍾', '🍶', '🍵', '☕', '🫖', '🧃', '🧊', '🍯', '🍼', '🥛'] },
      { name: 'symbols', icon: '⭐', emojis: ['⭐', '🌟', '✨', '⚡', '🔥', '💥', '💫', '💢', '💯', '❗', '❓', '❕', '❔', '⁉️', '‼️', '⚠️', '🚸', '⛔', '🔱', '⚜️', '🔰', '⭕', '✅', '☑️', '✔️', '❌', '❎', '➕', '➖', '➗', '✖️', '💲', '💱', '™️', '©️', '®️', '〰️', '➰', '➿', '🔚', '🔙', '🔛', '🔝', '🔜'] }
    ];

    const currentCategoryEmojis = computed(() => {
      const category = emojiCategories.find(c => c.name === selectedEmojiCategory.value);
      return category ? category.emojis : [];
    });
    
    // Pagination computed properties
    const totalPages = computed(() => {
      return Math.ceil(poiTypes.value.length / itemsPerPage.value);
    });
    
    const startIndex = computed(() => {
      return currentPage.value * itemsPerPage.value;
    });
    
    const endIndex = computed(() => {
      return Math.min(startIndex.value + itemsPerPage.value, poiTypes.value.length);
    });
    
    const paginatedPoiTypes = computed(() => {
      return poiTypes.value.slice(startIndex.value, endIndex.value);
    });
    
    const visiblePages = computed(() => {
      const pages = [];
      const total = totalPages.value;
      const current = currentPage.value;
      const maxVisible = 5;
      
      if (total <= maxVisible) {
        // Show all pages if total is small
        for (let i = 1; i <= total; i++) {
          pages.push(i);
        }
      } else {
        // Always show first page
        pages.push(1);
        
        // Calculate range around current page
        let start = Math.max(2, current - 1);
        let end = Math.min(total - 1, current + 2);
        
        // Add ellipsis if needed
        if (start > 2) {
          pages.push('...');
        }
        
        // Add pages around current
        for (let i = start; i <= end; i++) {
          pages.push(i);
        }
        
        // Add ellipsis if needed
        if (end < total - 1) {
          pages.push('...');
        }
        
        // Always show last page
        if (total > 1) {
          pages.push(total);
        }
      }
      
      return pages;
    });

    const loadPoiTypes = async () => {
      try {
        const response = await fetch('/api/poi-types');
        if (!response.ok) throw new Error('Failed to fetch POI types');
        poiTypes.value = await response.json();
      } catch (err) {
        error('Failed to load POI types');
        console.error(err);
      } finally {
        loading.value = false;
      }
    };

    const saveType = async () => {
      saving.value = true;
      
      try {
        let savedType;
        
        if (formData.value.icon_type === 'upload' && formData.value.file) {
          // First save/update the type
          const typeData = {
            name: formData.value.name,
            icon_type: 'emoji', // Temporary, will be updated after upload
            icon_value: '📍' // Temporary default
          };
          
          const typeResponse = await fetch(
            editingType.value 
              ? `/api/poi-types/${editingType.value.id}`
              : '/api/poi-types',
            {
              method: editingType.value ? 'PUT' : 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(typeData)
            }
          );
          
          if (!typeResponse.ok) throw new Error('Failed to save POI type');
          savedType = await typeResponse.json();
          
          // Then upload the icon
          const formData = new FormData();
          formData.append('icon', formData.value.file);
          
          const uploadResponse = await fetch(`/api/poi-types/${savedType.id}/upload-icon`, {
            method: 'POST',
            body: formData
          });
          
          if (!uploadResponse.ok) throw new Error('Failed to upload icon');
        } else {
          // Regular save without upload
          const response = await fetch(
            editingType.value 
              ? `/api/poi-types/${editingType.value.id}`
              : '/api/poi-types',
            {
              method: editingType.value ? 'PUT' : 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: formData.value.name,
                icon_type: formData.value.icon_type,
                icon_value: formData.value.icon_value
              })
            }
          );
          
          if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Failed to save POI type');
          }
          
          savedType = await response.json();
        }
        
        success(editingType.value ? 'POI type updated' : 'POI type added');
        closeModal();
        await loadPoiTypes();
      } catch (err) {
        error(err.message);
        console.error(err);
      } finally {
        saving.value = false;
      }
    };

    const editType = (type) => {
      editingType.value = type;
      formData.value = {
        name: type.name,
        icon_type: type.icon_type,
        icon_value: type.icon_value,
        preview_url: type.icon_type === 'upload' ? type.icon_value : null,
        file: null
      };
    };

    const deleteType = async (type) => {
      if (!confirm(`Delete POI type "${type.name}"? This cannot be undone.`)) return;
      
      try {
        const response = await fetch(`/api/poi-types/${type.id}`, {
          method: 'DELETE'
        });
        
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to delete POI type');
        }
        
        success('POI type deleted');
        await loadPoiTypes();
      } catch (err) {
        error(err.message);
        console.error(err);
      }
    };

    const setDefault = async (typeId) => {
      try {
        const response = await fetch(`/api/poi-types/${typeId}/set-default`, {
          method: 'PUT'
        });
        
        if (!response.ok) throw new Error('Failed to set default POI type');
        
        success('Default POI type updated');
        await loadPoiTypes();
      } catch (err) {
        error('Failed to set default POI type');
        console.error(err);
      }
    };

    const closeModal = () => {
      showAddModal.value = false;
      editingType.value = null;
      showEmojiPicker.value = false;
      formData.value = {
        name: '',
        icon_type: 'emoji',
        icon_value: '',
        preview_url: null,
        file: null
      };
    };

    const selectEmoji = (emoji) => {
      formData.value.icon_value = emoji;
      showEmojiPicker.value = false;
    };

    const handleFileSelect = (event) => {
      const file = event.target.files[0];
      if (!file) return;
      
      formData.value.file = file;
      formData.value.preview_url = URL.createObjectURL(file);
    };

    const startDrag = (index) => {
      draggedIndex.value = index;
    };

    const handleDrop = async (dropIndex) => {
      if (draggedIndex.value === null || draggedIndex.value === dropIndex) return;
      
      const types = [...poiTypes.value];
      const draggedItem = types[draggedIndex.value];
      
      // Remove dragged item
      types.splice(draggedIndex.value, 1);
      
      // Insert at new position
      types.splice(dropIndex, 0, draggedItem);
      
      // Update display orders
      const updates = types.map((type, index) => ({
        id: type.id,
        display_order: index
      }));
      
      try {
        const response = await fetch('/api/poi-types/reorder', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order: updates })
        });
        
        if (!response.ok) throw new Error('Failed to reorder POI types');
        
        poiTypes.value = types;
        success('POI types reordered');
      } catch (err) {
        error('Failed to reorder POI types');
        console.error(err);
        await loadPoiTypes(); // Reload to reset order
      }
      
      draggedIndex.value = null;
    };

    // Watch for items per page changes
    watch(itemsPerPage, () => {
      currentPage.value = 0; // Reset to first page when page size changes
    });

    // Handle click outside emoji picker
    const handleClickOutside = (event) => {
      const emojiPicker = document.querySelector('.emoji-picker');
      const emojiInput = document.querySelector('#emoji-value');
      const emojiBtn = document.querySelector('.emoji-picker-btn');
      
      if (showEmojiPicker.value && emojiPicker && 
          !emojiPicker.contains(event.target) &&
          !emojiInput?.contains(event.target) &&
          !emojiBtn?.contains(event.target)) {
        showEmojiPicker.value = false;
      }
    };

    onMounted(() => {
      // console.log('POITypeManager mounted');
      loadPoiTypes();
      document.addEventListener('click', handleClickOutside);
    });

    onUnmounted(() => {
      document.removeEventListener('click', handleClickOutside);
    });

    return {
      poiTypes,
      loading,
      showAddModal,
      editingType,
      saving,
      formData,
      showEmojiPicker,
      selectedEmojiCategory,
      emojiCategories,
      currentCategoryEmojis,
      // Pagination
      currentPage,
      itemsPerPage,
      totalPages,
      startIndex,
      endIndex,
      paginatedPoiTypes,
      visiblePages,
      // Methods
      saveType,
      editType,
      deleteType,
      setDefault,
      closeModal,
      selectEmoji,
      handleFileSelect,
      startDrag,
      handleDrop
    };
  }
};
</script>

<style scoped>
.poi-type-manager {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  margin-top: 1rem;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.section-header h3 {
  margin: 0;
  font-size: 1.25rem;
  color: #1a1a1a;
}

.primary-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: #4CAF50;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
  transition: background 0.2s;
}

.primary-btn:hover {
  background: #45a049;
}

.loading {
  text-align: center;
  padding: 2rem;
  color: #666;
}

.empty-state {
  text-align: center;
  padding: 3rem;
  color: #999;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th,
.data-table td {
  text-align: left;
  padding: 0.75rem;
  border-bottom: 1px solid #eee;
}

.data-table th {
  font-weight: 600;
  color: #666;
  font-size: 0.875rem;
  text-transform: uppercase;
}

.data-table tr {
  cursor: move;
  transition: background 0.2s;
}

.data-table tr:hover {
  background: #f9f9f9;
}

.data-table tr.is-default {
  background: #f0f8ff;
}

.icon-cell {
  text-align: center;
}

.poi-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  font-size: 24px;
  background: #f5f5f5;
  border-radius: 4px;
}

.poi-icon img {
  max-width: 24px;
  max-height: 24px;
}

.order-cell {
  text-align: center;
}

.drag-handle {
  cursor: grab;
  margin-right: 0.5rem;
  color: #999;
}

.actions-cell {
  text-align: right;
}

.icon-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1.1rem;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  transition: background 0.2s;
}

.icon-btn:hover {
  background: #f0f0f0;
}

.icon-btn.danger:hover {
  background: #fee;
}

.icon-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.small-btn {
  background: #f0f0f0;
  border: none;
  padding: 0.25rem 0.75rem;
  border-radius: 4px;
  font-size: 0.75rem;
  cursor: pointer;
  transition: background 0.2s;
}

.small-btn:hover {
  background: #e0e0e0;
}

.small-btn.secondary {
  background: #007bff;
  color: white;
}

.small-btn.secondary:hover {
  background: #0056b3;
}

.status-badge {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
}

.status-badge.success {
  background: #d4edda;
  color: #155724;
}

/* Modal styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 8px;
  padding: 2rem;
  max-width: 500px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-content h3 {
  margin: 0 0 1.5rem 0;
  font-size: 1.5rem;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #333;
}

.form-group input[type="text"],
.form-group input[type="file"] {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
}

.radio-group {
  display: flex;
  gap: 1.5rem;
}

.radio-group label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}

.emoji-input-group {
  display: flex;
  gap: 0.5rem;
}

.emoji-input-group input {
  flex: 1;
}

.emoji-picker-btn {
  padding: 0.5rem 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  cursor: pointer;
  font-size: 1.25rem;
}

.emoji-picker {
  border: 1px solid #ddd;
  border-radius: 4px;
  margin-top: 0.5rem;
  background: white;
  position: relative;
  z-index: 100;
}

.emoji-picker-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid #eee;
  font-weight: 500;
}

.close-picker-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #666;
  line-height: 1;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-picker-btn:hover {
  color: #000;
}

.emoji-categories {
  display: flex;
  gap: 0.25rem;
  padding: 0.5rem;
  border-bottom: 1px solid #eee;
}

.category-btn {
  background: none;
  border: none;
  padding: 0.5rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1.25rem;
  transition: background 0.2s;
}

.category-btn:hover,
.category-btn.active {
  background: #f0f0f0;
}

.emoji-grid {
  display: grid;
  grid-template-columns: repeat(10, 1fr);
  gap: 0.25rem;
  padding: 0.5rem;
  max-height: 200px;
  overflow-y: auto;
}

.emoji-option {
  background: none;
  border: none;
  padding: 0.5rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1.25rem;
  transition: background 0.2s;
}

.emoji-option:hover {
  background: #f0f0f0;
}

.help-text {
  font-size: 0.875rem;
  color: #666;
  margin-top: 0.25rem;
}

.help-text a {
  color: #007bff;
  text-decoration: none;
}

.help-text a:hover {
  text-decoration: underline;
}

.icon-preview {
  margin-top: 1rem;
  padding: 1rem;
  background: #f5f5f5;
  border-radius: 4px;
  text-align: center;
}

.icon-preview img {
  max-width: 64px;
  max-height: 64px;
}

.modal-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 2rem;
}

.secondary-btn {
  background: #f0f0f0;
  color: #333;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
  transition: background 0.2s;
}

.secondary-btn:hover {
  background: #e0e0e0;
}

/* Pagination Styles */
.pagination-controls {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 1rem;
  padding: 0.5rem 0;
}

.pagination-info {
  color: #666;
  font-size: 0.875rem;
}

.pagination-size {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
}

.pagination-size label {
  color: #666;
}

.pagination-size select {
  padding: 0.25rem 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  font-size: 0.875rem;
}

.pagination-nav {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.25rem;
  margin-top: 1.5rem;
  padding: 1rem 0;
}

.pagination-btn {
  padding: 0.5rem 0.75rem;
  border: 1px solid #ddd;
  background: white;
  color: #333;
  cursor: pointer;
  border-radius: 4px;
  font-size: 0.875rem;
  transition: all 0.2s;
  min-width: 36px;
}

.pagination-btn:hover:not(:disabled) {
  background: #f5f5f5;
  border-color: #999;
}

.pagination-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pagination-btn.active {
  background: #4CAF50;
  color: white;
  border-color: #4CAF50;
}

.pagination-pages {
  display: flex;
  gap: 0.25rem;
}

.pagination-pages .pagination-btn:disabled {
  border: none;
  background: none;
  cursor: default;
  padding: 0.5rem 0.5rem;
}

.pagination-ellipsis {
  padding: 0.5rem;
  color: #666;
  user-select: none;
}
</style>