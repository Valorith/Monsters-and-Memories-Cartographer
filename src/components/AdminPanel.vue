<template>
  <div class="admin-panel" :class="{ minimized: isMinimized }" v-if="isAdmin" @click.stop @mousedown.stop @mouseup.stop @contextmenu.stop>
    <div class="admin-header">
      <h3>Admin Mode</h3>
      <div class="header-buttons">
        <button class="minimize-btn" @click="toggleMinimize" :title="isMinimized ? 'Expand' : 'Minimize'">
          {{ isMinimized ? '▼' : '▲' }}
        </button>
        <button class="close-admin-btn" @click="$emit('close')" title="Close Admin Mode">×</button>
      </div>
    </div>
    
    <div class="admin-content" v-show="!isMinimized">
      <!-- Mode Selection -->
      <div class="mode-selection">
        <button 
          class="mode-btn"
          :class="{ active: editMode === 'poi' }"
          @click="setMode('poi')"
        >
          <span class="mode-icon">📍</span>
          <span>POI Mode</span>
        </button>
        <button 
          class="mode-btn"
          :class="{ active: editMode === 'zone' }"
          @click="setMode('zone')"
        >
          <span class="mode-icon">🔗</span>
          <span>Zone Connector</span>
        </button>
        <button 
          class="mode-btn"
          :class="{ active: editMode === 'connector' }"
          @click="setMode('connector')"
        >
          <span class="mode-icon">⛓️</span>
          <span>Point Connector</span>
        </button>
      </div>
      
      <div class="current-mode-info">
        <h4>{{ getModeTitle() }}</h4>
        <p class="hint">{{ getModeHint() }}</p>
      </div>
      
      <!-- POI Form -->
      <div v-if="editMode === 'poi' && pendingPOI" class="form-section">
        <h4>New POI</h4>
        <div class="poi-form">
          <input 
            v-model="poiName" 
            placeholder="POI Name" 
            @keyup.enter="savePOI"
            ref="poiNameInput"
          />
          <textarea 
            v-model="poiDescription" 
            placeholder="Description"
            rows="3"
          ></textarea>
          <select v-model="poiType">
            <option value="landmark">🏛️ Landmark</option>
            <option value="quest">❗ Quest</option>
            <option value="merchant">💰 Merchant</option>
            <option value="npc">💀 NPC</option>
            <option value="dungeon">⚔️ Dungeon</option>
            <option value="other">📍 Other</option>
          </select>
          <div class="form-buttons">
            <button @click="savePOI" class="save-btn">Save POI</button>
            <button @click="cancelPOI" class="cancel-btn">Cancel</button>
          </div>
        </div>
      </div>
      
      <!-- Connection Form -->
      <div v-if="editMode === 'zone' && pendingConnection" class="form-section">
        <h4>New Zone Connection</h4>
        <div class="connection-form">
          <select v-model="targetMap" ref="targetMapSelect">
            <option value="">Select Target Map</option>
            <option v-for="map in availableMaps" :key="map.id" :value="map.id">
              {{ map.name }}
            </option>
          </select>
          <input 
            v-model="connectionLabel" 
            placeholder="Connection Label (defaults to 'to <zone name>')"
            @keyup.enter="saveConnection"
          />
          <div class="form-buttons">
            <button @click="saveConnection" class="save-btn">Save Connection</button>
            <button @click="cancelConnection" class="cancel-btn">Cancel</button>
          </div>
        </div>
      </div>
      
      <!-- Connector Form -->
      <div v-if="editMode === 'connector'" class="form-section">
        <div class="connector-options">
          <label class="checkbox-label">
            <input 
              type="checkbox" 
              v-model="invisibleLabel"
            />
            <span>Invisible Label</span>
          </label>
          <label class="checkbox-label">
            <input 
              type="checkbox" 
              v-model="invisibleIcon"
            />
            <span>Invisible Icon</span>
          </label>
        </div>
        <h4>{{ pendingConnectorPair.first ? 'Second Connector' : 'First Connector' }}</h4>
        <div v-if="pendingConnector" class="connector-form">
          <p v-if="pendingConnector.poiId" class="poi-connection">
            Connecting to POI: <strong>{{ pendingConnector.poiName || 'POI' }}</strong>
          </p>
          <input 
            v-if="!invisibleLabel && !pendingConnector.poiId && !pendingConnectorPair.first"
            v-model="connectorLabel" 
            placeholder="Connector Label (e.g. A, 1)"
            @keyup.enter="saveConnector"
            ref="connectorLabelInput"
          />
          <div class="form-buttons">
            <button @click="saveConnector" class="save-btn">
              {{ pendingConnectorPair.first ? 'Complete Connection' : 'Place First' }}
            </button>
            <button @click="cancelConnector" class="cancel-btn">Cancel</button>
          </div>
          <p v-if="pendingConnectorPair.first" class="hint">
            {{ pendingConnector?.poiId 
              ? 'Click to confirm connection to POI' 
              : `Place the second connector for pair${invisibleLabel ? '' : ` "${pendingConnectorPair.first.label}"`}` 
            }}
          </p>
        </div>
      </div>
      
      <!-- Instructions -->
      <div class="instructions">
        <h4>Instructions</h4>
        <ul>
          <li>Select a mode above (POI, Zone Connector, or Point Connector)</li>
          <li>Right-click on the map to place items</li>
          <li>For Point Connectors: place two points that link together</li>
          <li>Use "Invisible Label" for unlabeled connectors</li>
          <li>Alt+Click and drag to move items</li>
          <li>Shift+Click on items to delete them</li>
          <li>Ctrl+Click on items to open settings popup</li>
          <li>Normal click performs regular action (navigate/show popup)</li>
          <li>Fill out the form and save</li>
          <li>Left-click and drag to pan the map</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, watch, nextTick, computed } from 'vue'

export default {
  name: 'AdminPanel',
  props: {
    isAdmin: {
      type: Boolean,
      default: false
    },
    pendingPOI: {
      type: Object,
      default: null
    },
    pendingConnection: {
      type: Object,
      default: null
    },
    pendingConnector: {
      type: Object,
      default: null
    },
    pendingConnectorPair: {
      type: Object,
      default: () => ({ first: null, second: null })
    },
    maps: {
      type: Array,
      default: () => []
    }
  },
  emits: ['close', 'savePOI', 'saveConnection', 'saveConnector', 'cancelPOI', 'cancelConnection', 'cancelConnector', 'modeChange', 'connectorSettingsChange'],
  setup(props, { emit }) {
    const editMode = ref('poi') // 'poi', 'zone', or 'connector'
    const isMinimized = ref(false)
    const poiName = ref('')
    const poiDescription = ref('')
    const poiType = ref('landmark')
    const targetMap = ref('')
    const connectionLabel = ref('')
    const connectorLabel = ref('')
    const invisibleLabel = ref(false)
    const invisibleIcon = ref(false)
    const poiNameInput = ref(null)
    const targetMapSelect = ref(null)
    const connectorLabelInput = ref(null)
    
    const availableMaps = computed(() => props.maps)
    
    // Watch for target map selection to update default label
    watch(targetMap, (newMapId) => {
      if (newMapId) {
        const selectedMap = props.maps.find(map => map.id === newMapId)
        if (selectedMap) {
          connectionLabel.value = `to ${selectedMap.name}`
        }
      }
    })
    
    const toggleMinimize = () => {
      isMinimized.value = !isMinimized.value
    }
    
    const getModeTitle = () => {
      switch (editMode.value) {
        case 'poi': return 'POI Mode'
        case 'zone': return 'Zone Connector Mode'
        case 'connector': return 'Point Connector Mode'
        default: return 'Unknown Mode'
      }
    }
    
    const getModeHint = () => {
      switch (editMode.value) {
        case 'poi': return 'Right-click on the map to place a POI'
        case 'zone': return 'Right-click on the map to place a zone connection'
        case 'connector': return 'Right-click to place paired connectors'
        default: return ''
      }
    }
    
    const setMode = (mode) => {
      editMode.value = mode
      emit('modeChange', mode)
      // Clear any pending items when switching modes
      if (mode !== 'poi' && props.pendingPOI) {
        emit('cancelPOI')
      }
      if (mode !== 'zone' && props.pendingConnection) {
        emit('cancelConnection')
      }
      if (mode !== 'connector' && props.pendingConnector) {
        emit('cancelConnector')
      }
    }
    
    const savePOI = () => {
      if (!poiName.value) return
      
      emit('savePOI', {
        name: poiName.value,
        description: poiDescription.value,
        type: poiType.value
      })
      
      // Reset form
      poiName.value = ''
      poiDescription.value = ''
      poiType.value = 'landmark'
    }
    
    const saveConnection = () => {
      if (!targetMap.value || !connectionLabel.value) return
      
      emit('saveConnection', {
        targetMapId: targetMap.value,
        label: connectionLabel.value
      })
      
      // Reset form
      targetMap.value = ''
      connectionLabel.value = ''
    }
    
    const cancelPOI = () => {
      emit('cancelPOI')
      poiName.value = ''
      poiDescription.value = ''
      poiType.value = 'landmark'
    }
    
    const cancelConnection = () => {
      emit('cancelConnection')
      targetMap.value = ''
      connectionLabel.value = ''
    }
    
    const saveConnector = () => {
      // Require a label unless it's an invisible label, connecting to POI, or second connector
      if (!invisibleLabel.value && !connectorLabel.value && !props.pendingConnector?.poiId && !props.pendingConnectorPair.first) return
      
      // For invisible labels, use empty string as label
      // For second connector, use the first connector's label
      const label = invisibleLabel.value 
        ? '' 
        : (props.pendingConnectorPair.first 
          ? props.pendingConnectorPair.first.label 
          : connectorLabel.value)
      
      emit('saveConnector', {
        label: label,
        invisibleLabel: invisibleLabel.value,
        invisibleIcon: invisibleIcon.value,
        // TODO: Add icon selection and other customization options
        icon: '🔗',
        iconSize: 20,
        labelPosition: 'bottom'
      })
      
      // Clear label for next connector
      connectorLabel.value = ''
    }
    
    const cancelConnector = () => {
      emit('cancelConnector')
      connectorLabel.value = ''
      invisibleLabel.value = false
      invisibleIcon.value = false
    }
    
    // Auto-focus form inputs when pending items appear
    watch(() => props.pendingPOI, async (newVal) => {
      if (newVal && poiNameInput.value) {
        await nextTick()
        poiNameInput.value.focus()
      }
    })
    
    watch(() => props.pendingConnection, async (newVal) => {
      if (newVal && targetMapSelect.value) {
        await nextTick()
        targetMapSelect.value.focus()
      }
    })
    
    watch(() => props.pendingConnector, async (newVal) => {
      // Only focus input when placing first connector and not an invisible label
      if (newVal && !props.pendingConnectorPair.first && !invisibleLabel.value && connectorLabelInput.value) {
        await nextTick()
        connectorLabelInput.value.focus()
      }
    })
    
    // Emit connector settings changes
    watch([invisibleLabel, invisibleIcon], () => {
      emit('connectorSettingsChange', {
        invisibleLabel: invisibleLabel.value,
        invisibleIcon: invisibleIcon.value
      })
    })
    
    return {
      editMode,
      isMinimized,
      poiName,
      poiDescription,
      poiType,
      targetMap,
      connectionLabel,
      connectorLabel,
      invisibleLabel,
      invisibleIcon,
      availableMaps,
      poiNameInput,
      targetMapSelect,
      connectorLabelInput,
      toggleMinimize,
      getModeTitle,
      getModeHint,
      setMode,
      savePOI,
      saveConnection,
      saveConnector,
      cancelPOI,
      cancelConnection,
      cancelConnector
    }
  }
}
</script>

<style scoped>
.admin-panel {
  position: absolute;
  top: 5rem;
  right: 1rem;
  background: rgba(45, 45, 45, 0.95);
  border: 1px solid #555;
  border-radius: 8px;
  padding: 1rem;
  width: 320px;
  max-height: calc(100vh - 10rem);
  overflow-y: auto;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  z-index: 900;
}

.admin-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.admin-panel.minimized .admin-header {
  margin-bottom: 0;
}

.admin-header h3 {
  margin: 0;
  color: #fff;
}

.header-buttons {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.minimize-btn, .close-admin-btn {
  background: none;
  border: none;
  color: #999;
  font-size: 1.25rem;
  cursor: pointer;
  padding: 0.25rem;
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
}

.minimize-btn:hover, .close-admin-btn:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.1);
}

.admin-panel.minimized {
  width: auto;
  min-width: 200px;
}

.mode-selection {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}

.mode-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: 1rem;
  background: #3a3a3a;
  border: 2px solid transparent;
  border-radius: 8px;
  color: #999;
  cursor: pointer;
  transition: all 0.2s;
}

.mode-btn:hover {
  background: #4a4a4a;
  color: #fff;
}

.mode-btn.active {
  background: #4a7c59;
  border-color: #5a8c69;
  color: #fff;
}

.mode-icon {
  font-size: 1.5rem;
}

.current-mode-info {
  background: rgba(0, 0, 0, 0.3);
  padding: 0.75rem;
  border-radius: 4px;
  margin-bottom: 1rem;
}

.current-mode-info h4 {
  margin: 0 0 0.25rem 0;
  color: #fff;
  font-size: 1rem;
}

.form-section {
  margin-bottom: 1.5rem;
}

.form-section h4 {
  margin: 0 0 0.75rem 0;
  color: #fff;
  font-size: 1rem;
}

.hint {
  font-size: 0.85rem;
  color: #999;
  margin: 0;
}

.poi-form, .connection-form, .connector-form {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

input, textarea, select {
  background: #3a3a3a;
  color: #fff;
  border: 1px solid #555;
  border-radius: 4px;
  padding: 0.5rem;
  font-size: 0.9rem;
  font-family: inherit;
}

input:focus, textarea:focus, select:focus {
  outline: none;
  border-color: #777;
  background: #4a4a4a;
}

textarea {
  resize: vertical;
  min-height: 60px;
}

.form-buttons {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.save-btn, .cancel-btn {
  flex: 1;
  padding: 0.5rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background-color 0.2s;
}

.save-btn {
  background: #4a7c59;
  color: #fff;
}

.save-btn:hover {
  background: #5a8c69;
}

.cancel-btn {
  background: #555;
  color: #fff;
}

.cancel-btn:hover {
  background: #666;
}

.instructions {
  background: rgba(0, 0, 0, 0.3);
  padding: 0.75rem;
  border-radius: 4px;
  margin-top: 1rem;
}

.instructions h4 {
  margin: 0 0 0.5rem 0;
  color: #fff;
  font-size: 0.9rem;
}

.instructions ul {
  margin: 0;
  padding-left: 1.5rem;
  color: #ccc;
  font-size: 0.85rem;
}

.instructions li {
  margin-bottom: 0.25rem;
}

/* Scrollbar styling */
.admin-panel::-webkit-scrollbar {
  width: 8px;
}

.admin-panel::-webkit-scrollbar-track {
  background: #2a2a2a;
  border-radius: 4px;
}

.admin-panel::-webkit-scrollbar-thumb {
  background: #555;
  border-radius: 4px;
}

.admin-panel::-webkit-scrollbar-thumb:hover {
  background: #666;
}

.connector-options {
  margin-bottom: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #ccc;
  cursor: pointer;
  font-size: 0.9rem;
}

.checkbox-label input[type="checkbox"] {
  cursor: pointer;
}

.checkbox-label:hover {
  color: #fff;
}

.checkbox-label input[type="checkbox"]:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.checkbox-label input[type="checkbox"]:disabled + span {
  opacity: 0.5;
  cursor: not-allowed;
}

.poi-connection {
  background: #4a7c59;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  margin-bottom: 1rem;
  text-align: center;
  color: #fff;
}

.poi-connection strong {
  color: #ffd700;
}
</style>