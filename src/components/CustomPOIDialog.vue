<template>
  <div v-if="visible" class="dialog-overlay" @click="cancel">
    <div class="dialog" @click.stop>
      <div class="dialog-header">
        <div class="header-content">
          <div class="header-icon">
            <span v-if="isEdit">✏️</span>
            <span v-else>📍</span>
          </div>
          <h2>{{ isEdit ? 'Edit' : 'Create' }} Custom POI</h2>
        </div>
        <button class="close-button" @click="cancel" title="Close">×</button>
      </div>
      
      <div class="dialog-body">
        <div class="form-section">
          <div class="form-group">
            <label>
              <span class="label-text">Name</span>
              <span class="required">*</span>
            </label>
            <input 
              v-model="formData.name" 
              type="text" 
              placeholder="Enter a memorable name for this location" 
              class="form-input"
              :class="{ 'has-value': formData.name }"
              @focus="handleFocus"
              @blur="handleBlur"
            />
          </div>
          
          <div class="form-group">
            <label>
              <span class="label-text">Description</span>
              <span class="optional">(optional)</span>
            </label>
            <textarea 
              v-model="formData.description" 
              placeholder="Add notes, lore, or important details about this location" 
              rows="4"
              class="form-textarea"
              :class="{ 'has-value': formData.description }"
              @focus="handleFocus"
              @blur="handleBlur"
            ></textarea>
          </div>
          
          <div class="form-group">
            <label>
              <span class="label-text">POI Type</span>
              <span class="required">*</span>
            </label>
            <div class="custom-select-wrapper">
              <div class="custom-select" @click="toggleTypeDropdown" :class="{ open: showTypeDropdown, 'has-value': selectedType }">
                <div class="selected-value">
                  <template v-if="selectedType">
                    <span class="type-icon" v-html="getTypeIcon(selectedType)"></span>
                    <span class="type-name">{{ selectedType.name }}</span>
                  </template>
                  <span v-else class="placeholder">Choose a category for this location</span>
                </div>
                <span class="dropdown-arrow">
                  <svg width="12" height="8" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </span>
              </div>
              <div v-if="showTypeDropdown" class="custom-dropdown">
                <div 
                  v-for="type in poiTypes" 
                  :key="type.id" 
                  @click="selectType(type)"
                  class="dropdown-option"
                  :class="{ selected: type.id === formData.type_id }"
                >
                  <span class="type-icon" v-html="getTypeIcon(type)"></span>
                  <span class="type-name">{{ type.name }}</span>
                  <span v-if="type.id === formData.type_id" class="checkmark">✓</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div class="preview-section" v-if="selectedType">
          <div class="preview-header">
            <h3>Preview</h3>
            <span class="preview-subtitle">This is how your POI will appear on the map</span>
          </div>
          <div class="preview-content">
            <div class="preview-poi">
              <span class="preview-icon" v-html="getTypeIcon(selectedType)"></span>
              <span class="preview-name">{{ formData.name || 'POI Name' }}</span>
            </div>
          </div>
        </div>
      </div>
      
      <div class="dialog-footer">
        <div class="footer-info">
          <span v-if="!formData.name || !formData.type_id" class="missing-fields">
            Please fill in all required fields
          </span>
        </div>
        <div class="dialog-actions">
          <button @click="cancel" class="btn secondary">
            Cancel
          </button>
          <button @click="save" class="btn primary" :disabled="!formData.name || !formData.type_id">
            <span v-if="isEdit">Save Changes</span>
            <span v-else>Create POI</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'CustomPOIDialog',
  props: {
    visible: Boolean,
    poi: Object,
    mapId: Number,
    position: Object
  },
  data() {
    return {
      formData: {
        name: '',
        description: '',
        type_id: null
      },
      poiTypes: [],
      showTypeDropdown: false
    };
  },
  computed: {
    isEdit() {
      return !!this.poi;
    },
    selectedType() {
      return this.poiTypes.find(t => t.id === this.formData.type_id);
    }
  },
  watch: {
    visible(newVal) {
      if (newVal) {
        this.loadPoiTypes();
        if (this.poi) {
          // Edit mode - load existing data
          this.formData = { ...this.poi };
        } else {
          // Create mode - reset form
          this.formData = {
            name: '',
            description: '',
            type_id: null
          };
        }
      }
    }
  },
  methods: {
    async loadPoiTypes() {
      try {
        const response = await fetch('/api/poi-types');
        if (!response.ok) throw new Error('Failed to load POI types');
        this.poiTypes = await response.json();
        
        // If no type is selected and there's a default, select it
        if (!this.formData.type_id && this.poiTypes.length > 0) {
          const defaultType = this.poiTypes.find(t => t.is_default);
          if (defaultType) {
            this.formData.type_id = defaultType.id;
          }
        }
      } catch (error) {
        console.error('Error loading POI types:', error);
      }
    },
    save() {
      if (!this.formData.name || !this.formData.type_id) return;
      
      const data = {
        ...this.formData,
        map_id: this.mapId,
        x: this.position?.x,
        y: this.position?.y
      };
      
      this.$emit('save', data);
    },
    cancel() {
      this.$emit('cancel');
    },
    getTypeIcon(type) {
      if (!type) return '';
      
      if (type.icon_type === 'emoji') {
        return type.icon_value;
      } else if (type.icon_type === 'iconify' || type.icon_type === 'fontawesome') {
        return `<iconify-icon icon="${type.icon_value}" width="20" height="20"></iconify-icon>`;
      } else if (type.icon_type === 'upload') {
        return `<img src="${type.icon_value}" style="width: 20px; height: 20px; object-fit: contain;" />`;
      }
      
      return '';
    },
    toggleTypeDropdown() {
      this.showTypeDropdown = !this.showTypeDropdown;
    },
    selectType(type) {
      this.formData.type_id = type.id;
      this.showTypeDropdown = false;
    },
    handleClickOutside(event) {
      if (!this.$el || !this.$el.contains(event.target)) {
        this.showTypeDropdown = false;
      }
    },
    handleFocus(event) {
      event.target.parentElement.classList.add('focused');
    },
    handleBlur(event) {
      event.target.parentElement.classList.remove('focused');
    }
  },
  mounted() {
    // Close dropdown when clicking outside
    document.addEventListener('click', this.handleClickOutside);
  },
  beforeDestroy() {
    document.removeEventListener('click', this.handleClickOutside);
  }
}
</script>

<style scoped>
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1001;
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.dialog {
  background: #1e1e1e;
  border-radius: 12px;
  max-width: 600px;
  width: 90%;
  max-height: 85vh;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8);
  display: flex;
  flex-direction: column;
  position: relative;
  animation: dialogSlideIn 0.3s ease-out;
}

@keyframes dialogSlideIn {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem 2rem;
  border-bottom: 1px solid #333;
  background: #252525;
  border-radius: 12px 12px 0 0;
}

.header-content {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.header-icon {
  font-size: 1.5rem;
  display: flex;
  align-items: center;
}

.dialog-header h2 {
  margin: 0;
  color: #fff;
  font-size: 1.5rem;
  font-weight: 600;
}

.close-button {
  background: none;
  border: none;
  color: #666;
  font-size: 2rem;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
}

.close-button:hover {
  background: #333;
  color: #fff;
}

.dialog-body {
  padding: 2rem;
  overflow-y: auto;
  flex: 1;
}

.form-section {
  margin-bottom: 2rem;
}

.form-group {
  margin-bottom: 1.5rem;
  position: relative;
}

.form-group.focused::before {
  content: '';
  position: absolute;
  left: -4px;
  top: 0;
  bottom: 0;
  width: 2px;
  background: #FFD700;
  border-radius: 2px;
}

.form-group label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.label-text {
  color: #e0e0e0;
  font-size: 0.95rem;
  font-weight: 500;
}

.required {
  color: #ff6b6b;
  font-size: 0.9rem;
}

.optional {
  color: #666;
  font-size: 0.85rem;
}

.form-input,
.form-textarea {
  width: 100%;
  padding: 0.875rem 1rem;
  background: #2a2a2a;
  border: 2px solid #3a3a3a;
  border-radius: 8px;
  color: #e0e0e0;
  font-size: 1rem;
  transition: all 0.2s;
  font-family: inherit;
}

.form-input:hover,
.form-textarea:hover {
  background: #333;
  border-color: #444;
}

.form-input:focus,
.form-textarea:focus {
  outline: none;
  background: #333;
  border-color: #FFD700;
  box-shadow: 0 0 0 3px rgba(255, 215, 0, 0.1);
}

.form-input.has-value,
.form-textarea.has-value {
  border-color: #4a7c59;
}

.form-textarea {
  resize: vertical;
  min-height: 100px;
}


.dialog-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem 2rem;
  border-top: 1px solid #333;
  background: #252525;
  border-radius: 0 0 12px 12px;
}

.footer-info {
  flex: 1;
}

.missing-fields {
  color: #666;
  font-size: 0.875rem;
  font-style: italic;
}

.dialog-actions {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.btn.primary {
  background: linear-gradient(135deg, #4a7c59 0%, #3a6249 100%);
  color: white;
  box-shadow: 0 2px 8px rgba(74, 124, 89, 0.3);
}

.btn.primary:hover:not(:disabled) {
  background: linear-gradient(135deg, #5a8c69 0%, #4a7c59 100%);
  box-shadow: 0 4px 12px rgba(74, 124, 89, 0.4);
  transform: translateY(-1px);
}

.btn.primary:active:not(:disabled) {
  transform: translateY(0);
  box-shadow: 0 2px 4px rgba(74, 124, 89, 0.3);
}

.btn.primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: #4a7c59;
  box-shadow: none;
}

.btn.secondary {
  background: #3a3a3a;
  color: #ccc;
  border: 1px solid #4a4a4a;
}

.btn.secondary:hover {
  background: #444;
  color: #fff;
  border-color: #555;
}

/* Custom Select Dropdown Styles */
.custom-select-wrapper {
  position: relative;
}

.custom-select {
  width: 100%;
  padding: 0.875rem 1rem;
  background: #2a2a2a;
  border: 2px solid #3a3a3a;
  border-radius: 8px;
  color: #e0e0e0;
  font-size: 1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: all 0.2s;
  position: relative;
}

.custom-select:hover {
  background: #333;
  border-color: #444;
}

.custom-select.open {
  border-color: #FFD700;
  background: #333;
  box-shadow: 0 0 0 3px rgba(255, 215, 0, 0.1);
}

.custom-select.has-value {
  border-color: #4a7c59;
}

.selected-value {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
}

.placeholder {
  color: #666;
}

.dropdown-arrow {
  color: #666;
  transition: transform 0.2s;
  display: flex;
  align-items: center;
}

.custom-select.open .dropdown-arrow {
  transform: rotate(180deg);
  color: #FFD700;
}

.custom-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 8px;
  background: #2a2a2a;
  border: 2px solid #3a3a3a;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
  max-height: 280px;
  overflow-y: auto;
  z-index: 1000;
  animation: dropdownSlideIn 0.2s ease-out;
}

@keyframes dropdownSlideIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.custom-dropdown::-webkit-scrollbar {
  width: 8px;
}

.custom-dropdown::-webkit-scrollbar-track {
  background: #1a1a1a;
  border-radius: 4px;
}

.custom-dropdown::-webkit-scrollbar-thumb {
  background: #444;
  border-radius: 4px;
}

.custom-dropdown::-webkit-scrollbar-thumb:hover {
  background: #555;
}

.dropdown-option {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  cursor: pointer;
  transition: all 0.2s;
  border-bottom: 1px solid #333;
  position: relative;
}

.dropdown-option:last-child {
  border-bottom: none;
}

.dropdown-option:hover {
  background: #333;
  padding-left: 1.25rem;
}

.dropdown-option.selected {
  background: rgba(74, 124, 89, 0.2);
}

.dropdown-option .checkmark {
  margin-left: auto;
  color: #4a7c59;
  font-weight: bold;
}

.type-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 28px;
  font-size: 1.2rem;
}

.type-name {
  flex: 1;
  color: #e0e0e0;
  font-weight: 500;
}

/* Preview Section */
.preview-section {
  background: #2a2a2a;
  border-radius: 8px;
  padding: 1.5rem;
  border: 1px solid #3a3a3a;
}

.preview-header {
  margin-bottom: 1rem;
}

.preview-header h3 {
  margin: 0 0 0.25rem 0;
  color: #FFD700;
  font-size: 1rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.preview-subtitle {
  color: #666;
  font-size: 0.875rem;
}

.preview-content {
  display: flex;
  justify-content: center;
  padding: 1.5rem;
  background: #1e1e1e;
  border-radius: 6px;
  border: 1px solid #333;
}

.preview-poi {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1.25rem;
  background: #2a2a2a;
  border-radius: 8px;
  border: 1px solid #3a3a3a;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.preview-icon {
  font-size: 1.5rem;
}

.preview-name {
  color: #e0e0e0;
  font-weight: 500;
  font-size: 1.1rem;
}
</style>