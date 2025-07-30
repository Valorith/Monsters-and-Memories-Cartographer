<template>
  <div v-if="visible" class="dialog-overlay" @click="cancel">
    <div class="dialog" @click.stop>
      <h2>{{ isEdit ? 'Edit' : 'Create' }} Custom POI</h2>
      
      <div class="form-group">
        <label>Name *</label>
        <input v-model="formData.name" type="text" placeholder="Enter POI name" />
      </div>
      
      <div class="form-group">
        <label>Description</label>
        <textarea v-model="formData.description" placeholder="Enter description (optional)" rows="3"></textarea>
      </div>
      
      <div class="form-group">
        <label>Icon</label>
        <div class="icon-input-group">
          <input v-model="formData.icon" type="text" placeholder="Enter custom emoji or select below" maxlength="2" class="icon-input" />
          <div class="icon-preview">{{ formData.icon }}</div>
        </div>
        <div class="icon-tabs">
          <button v-for="cat in iconCategories" :key="cat.name"
                  @click="activeCategory = cat.name"
                  :class="['tab', { active: activeCategory === cat.name }]">
            {{ cat.label }}
          </button>
        </div>
        <div class="icon-grid">
          <button v-for="icon in currentCategoryIcons" :key="icon" 
                  @click="formData.icon = icon" 
                  :class="['icon-option', { selected: formData.icon === icon }]">
            {{ icon }}
          </button>
        </div>
      </div>
      
      <div class="appearance-section">
        <h3>Appearance</h3>
        <div class="form-row">
          <div class="form-group half">
            <label>Icon Size</label>
            <div class="size-control">
              <input v-model.number="formData.icon_size" type="range" min="16" max="48" />
              <span class="size-value">{{ formData.icon_size }}px</span>
            </div>
          </div>
          <div class="form-group half">
            <label>Label Display</label>
            <div class="checkbox-group">
              <label class="checkbox-label">
                <input v-model="formData.label_visible" type="checkbox" />
                <span>Show label</span>
              </label>
            </div>
          </div>
        </div>
        <div v-if="formData.label_visible" class="form-group">
          <label>Label Position</label>
          <div class="position-selector">
            <button v-for="pos in ['top', 'bottom', 'left', 'right']" :key="pos"
                    @click="formData.label_position = pos"
                    :class="['position-option', { selected: formData.label_position === pos }]">
              {{ pos.charAt(0).toUpperCase() + pos.slice(1) }}
            </button>
          </div>
        </div>
      </div>
      
      <div class="dialog-actions">
        <button @click="save" class="btn primary" :disabled="!formData.name">
          {{ isEdit ? 'Update' : 'Create' }}
        </button>
        <button @click="cancel" class="btn secondary">Cancel</button>
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
        icon: '📍',
        icon_size: 24,
        label_visible: true,
        label_position: 'bottom'
      },
      activeCategory: 'general',
      iconCategories: [
        {
          name: 'general',
          label: 'General',
          icons: ['📍', '⭐', '🏠', '🎯', '🗝️', '⚔️', '🛡️', '🏪', '🏛️', '⛺']
        },
        {
          name: 'weapons',
          label: 'Weapons',
          icons: ['⚔️', '🗡️', '🏹', '🪓', '🔱', '🛡️', '🪃', '🔪', '🏺', '⛏️']
        },
        {
          name: 'magic',
          label: 'Magic',
          icons: ['🔮', '🪄', '✨', '🌟', '💫', '🔯', '📿', '🧿', '💎', '🪬']
        },
        {
          name: 'creatures',
          label: 'Creatures',
          icons: ['🐉', '🦄', '🧙', '🧚', '🧛', '🧟', '👹', '🦅', '🐺', '🕷️']
        },
        {
          name: 'locations',
          label: 'Locations',
          icons: ['🏰', '🗼', '⛪', '🏛️', '🕌', '🛖', '⛩️', '🏚️', '🌉', '🗿']
        },
        {
          name: 'nature',
          label: 'Nature',
          icons: ['🏔️', '🌋', '🏞️', '🕳️', '🌊', '🏜️', '🏝️', '🌳', '🌲', '🌴']
        },
        {
          name: 'treasures',
          label: 'Treasures',
          icons: ['💰', '🪙', '💎', '👑', '🏆', '🎁', '📦', '🗝️', '💍', '🪔']
        },
        {
          name: 'consumables',
          label: 'Consumables',
          icons: ['🧪', '⚗️', '🍷', '🍺', '🥤', '🍖', '🍞', '🍎', '🍄', '🌿']
        },
        {
          name: 'elements',
          label: 'Elements',
          icons: ['🔥', '❄️', '⚡', '🌀', '💨', '💧', '☀️', '🌙', '⭐', '🌑']
        },
        {
          name: 'danger',
          label: 'Danger',
          icons: ['💀', '☠️', '⚠️', '🚫', '☢️', '☣️', '🩸', '🕸️', '🦴', '⛔']
        },
        {
          name: 'quest',
          label: 'Quest',
          icons: ['❗', '❓', '💬', '📜', '📋', '🎯', '✅', '❌', '🔔', '📍']
        },
        {
          name: 'craft',
          label: 'Craft',
          icons: ['🔨', '⚒️', '🪛', '🧵', '🪡', '🎨', '🪵', '🪨', '🧱', '⚙️']
        }
      ]
    };
  },
  computed: {
    isEdit() {
      return !!this.poi;
    },
    currentCategoryIcons() {
      const category = this.iconCategories.find(cat => cat.name === this.activeCategory);
      return category ? category.icons : [];
    }
  },
  watch: {
    visible(newVal) {
      if (newVal) {
        if (this.poi) {
          // Edit mode - load existing data
          this.formData = { ...this.poi };
        } else {
          // Create mode - reset form
          this.formData = {
            name: '',
            description: '',
            icon: '📍',
            icon_size: 24,
            label_visible: true,
            label_position: 'bottom'
          };
        }
      }
    }
  },
  methods: {
    save() {
      if (!this.formData.name) return;
      
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
    }
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
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1001;
}

.dialog {
  background: #2d2d2d;
  border-radius: 8px;
  padding: 2rem;
  max-width: 500px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
}

.dialog h2 {
  margin: 0 0 1.5rem 0;
  color: #e0e0e0;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  color: #ccc;
  font-size: 0.9rem;
  margin-bottom: 0.5rem;
}

.form-group input[type="text"],
.form-group textarea,
.form-group select {
  width: 100%;
  padding: 0.5rem;
  background: #1a1a1a;
  border: 1px solid #444;
  border-radius: 4px;
  color: #e0e0e0;
  font-size: 1rem;
}

.form-group input[type="checkbox"] {
  margin-right: 0.5rem;
}

.appearance-section {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid #444;
}

.appearance-section h3 {
  color: #FFD700;
  font-size: 1rem;
  margin: 0 0 1rem 0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.form-row {
  display: flex;
  gap: 1rem;
}

.form-group.half {
  flex: 1;
}

.size-control {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.size-control input[type="range"] {
  flex: 1;
}

.size-value {
  min-width: 45px;
  text-align: right;
  color: #ccc;
  font-size: 0.9rem;
}

.checkbox-group {
  padding: 0.5rem 0;
}

.checkbox-label {
  display: flex;
  align-items: center;
  cursor: pointer;
  color: #ccc;
}

.checkbox-label input[type="checkbox"] {
  margin-right: 0.5rem;
}

.checkbox-label span {
  user-select: none;
}

.position-selector {
  display: flex;
  gap: 0.5rem;
}

.position-option {
  flex: 1;
  padding: 0.5rem;
  background: #1a1a1a;
  border: 1px solid #444;
  border-radius: 4px;
  color: #ccc;
  cursor: pointer;
  transition: all 0.2s;
  text-align: center;
}

.position-option:hover {
  background: #2a2a2a;
  border-color: #555;
}

.position-option.selected {
  background: #4a7c59;
  border-color: #5a8c69;
  color: white;
}

.icon-input-group {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.icon-input {
  flex: 1;
}

.icon-preview {
  width: 48px;
  height: 38px;
  background: #1a1a1a;
  border: 1px solid #444;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
}

.icon-tabs {
  display: flex;
  gap: 0.25rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.tab {
  padding: 0.5rem 1rem;
  background: #1a1a1a;
  border: 1px solid #444;
  border-radius: 4px;
  color: #ccc;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
}

.tab:hover {
  background: #2a2a2a;
  border-color: #555;
}

.tab.active {
  background: #4a7c59;
  border-color: #5a8c69;
  color: white;
}

.icon-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(40px, 1fr));
  gap: 0.5rem;
  max-height: 180px;
  overflow-y: auto;
  padding: 0.5rem;
  background: #1a1a1a;
  border-radius: 4px;
}

.icon-option {
  background: #1a1a1a;
  border: 1px solid #444;
  border-radius: 4px;
  padding: 0.5rem;
  font-size: 1.5rem;
  cursor: pointer;
  transition: all 0.2s;
}

.icon-option:hover {
  background: #3a3a3a;
  border-color: #666;
}

.icon-option.selected {
  background: #4a7c59;
  border-color: #5a8c69;
}

.dialog-actions {
  display: flex;
  gap: 1rem;
  margin-top: 2rem;
  justify-content: flex-end;
}

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  transition: background 0.2s;
}

.btn.primary {
  background: #4a7c59;
  color: white;
}

.btn.primary:hover:not(:disabled) {
  background: #3a6249;
}

.btn.primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn.secondary {
  background: #666;
  color: white;
}

.btn.secondary:hover {
  background: #777;
}
</style>