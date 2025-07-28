<template>
  <div class="app-container">
    <header class="app-header">
      <h1>Monsters and Memories Cartographer</h1>
      <div class="header-controls">
        <div class="map-selector">
          <label for="mapSelect">Select Map:</label>
          <select id="mapSelect" v-model="selectedMapIndex" @change="loadSelectedMap">
            <option v-for="(map, index) in maps" :key="index" :value="index">
              {{ map.name }}
            </option>
          </select>
        </div>
        <div v-if="isAdmin" class="admin-indicator" title="Admin Mode Active">
          <span class="admin-dot"></span>
          <span class="admin-text">Admin</span>
        </div>
      </div>
    </header>
    
    <div class="map-container" ref="mapContainer" @click="handleMapClick" @contextmenu.prevent="handleRightClick">
      <canvas 
        ref="mapCanvas"
        class="map-canvas"
        :class="{ 'admin-cursor': isAdmin && !isDragging }"
        @mousedown="handleMouseDown"
        @mousemove="handleMouseMove"
        @mouseup="handleMouseUp"
        @mouseleave="handleMouseUp"
        @wheel.prevent="handleWheel"
        @touchstart="handleTouchStart"
        @touchmove.prevent="handleTouchMove"
        @touchend="handleTouchEnd"
      ></canvas>
      
      <div class="loading-overlay" v-if="isLoading">
        <div class="spinner"></div>
        <p>Loading map...</p>
      </div>
      
      <POIPopup
        v-if="selectedPOI"
        :poi="selectedPOI"
        :visible="!!selectedPOI"
        :position="popupPosition"
        :isAdmin="isAdmin"
        :isLeftSide="popupIsLeftSide"
        @close="selectedPOI = null"
        @delete="deletePOI"
        @confirmUpdate="handlePOIUpdate"
      />
      
      <AdminPanel
        :isAdmin="isAdmin"
        :pendingPOI="pendingPOI"
        :pendingConnection="pendingConnection"
        :pendingConnector="pendingConnector"
        :pendingConnectorPair="pendingConnectorPair"
        @close="isAdmin = false"
        @savePOI="savePOI"
        @saveConnection="saveConnection"
        @saveConnector="saveConnector"
        @cancelPOI="cancelPOI"
        @cancelConnection="cancelConnection"
        @cancelConnector="cancelConnector"
        @modeChange="handleModeChange"
        @connectorSettingsChange="handleConnectorSettingsChange"
      />
      
      <!-- Pending Change Confirmation -->
      <div v-if="pendingChange" class="pending-change-overlay">
        <div class="pending-change-card">
          <h3>Confirm Position Change</h3>
          <p>Move {{ pendingChange.type === 'poi' ? 'POI' : 'Connection' }} to new position?</p>
          <div class="pending-change-buttons">
            <button @click="confirmPendingChange" class="confirm-btn">✓ Confirm</button>
            <button @click="cancelPendingChange" class="cancel-btn">✗ Cancel</button>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Toast Container -->
    <ToastContainer />
    
    <!-- Admin Popup -->
    <AdminPopup
      v-if="adminPopupItem"
      :item="adminPopupItem"
      :itemType="adminPopupType"
      :visible="!!adminPopupItem"
      :position="adminPopupPosition"
      @close="adminPopupItem = null"
      @update="handleAdminPopupUpdate"
      @activate="handleAdminPopupActivate"
      @delete="handleAdminPopupDelete"
    />
    
    <!-- Map Manager -->
    <MapManager
      :visible="showMapManager"
      :maps="maps"
      @close="showMapManager = false"
      @updateMaps="handleUpdateMaps"
      @showConfirm="handleMapManagerConfirm"
      @showToast="handleMapManagerToast"
    />
    
    <!-- Confirm Dialog -->
    <ConfirmDialog
      :show="confirmDialog.show"
      :title="confirmDialog.title"
      :message="confirmDialog.message"
      :confirmText="confirmDialog.confirmText"
      :cancelText="confirmDialog.cancelText"
      @confirm="confirmDialog.onConfirm"
      @cancel="confirmDialog.onCancel"
    />
    
    <div class="controls">
      <button class="control-btn" @click="zoomIn" title="Zoom In">+</button>
      <button class="control-btn" @click="zoomOut" title="Zoom Out">-</button>
      <button class="control-btn" @click="resetView" title="Home">🏠</button>
      <button v-if="isAdmin" class="control-btn admin-btn" @click="showMapManager = true" title="Map Manager">🗺️</button>
      <div class="zoom-indicator">
        <span>{{ zoomPercent }}%</span>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, reactive, onMounted, onUnmounted, computed, watch } from 'vue'
import { useMapViewer } from './composables/useMapViewer'
import { useMapInteractions } from './composables/useMapInteractions'
import { mapList } from './data/maps'
import { mapData, getMapFilename, saveMapData } from './data/mapData'
import POIPopup from './components/POIPopup.vue'
import AdminPanel from './components/AdminPanel.vue'
import AdminPopup from './components/AdminPopup.vue'
import MapManager from './components/MapManager.vue'
import ToastContainer from './components/ToastContainer.vue'
import ConfirmDialog from './components/ConfirmDialog.vue'
import { useToast } from './composables/useToast'

export default {
  name: 'App',
  components: {
    POIPopup,
    AdminPanel,
    AdminPopup,
    MapManager,
    ToastContainer,
    ConfirmDialog
  },
  setup() {
    const mapCanvas = ref(null)
    const mapContainer = ref(null)
    const selectedMapIndex = ref(0)
    const isLoading = ref(false)
    const isAdmin = ref(false)
    const selectedPOI = ref(null)
    const popupPosition = ref({ x: 0, y: 0 })
    const popupIsLeftSide = ref(false)
    const pendingPOI = ref(null)
    const adminPopupItem = ref(null)
    const adminPopupType = ref(null)
    const adminPopupPosition = ref({ x: 0, y: 0 })
    const showMapManager = ref(false)
    const pendingConnection = ref(null)
    const pendingConnector = ref(null)
    const pendingConnectorPair = ref({ first: null, second: null })
    const editMode = ref('poi') // 'poi', 'zone', or 'connector'
    const connectorSettings = ref({ invisibleLabel: false, invisibleIcon: false })
    
    // Drag state
    const draggedItem = ref(null)
    const dragItemType = ref(null) // 'poi', 'connection', or 'connector'
    const dragOffset = ref({ x: 0, y: 0 })
    const originalPosition = ref({ x: 0, y: 0 })
    const pendingChange = ref(null) // For showing confirm/cancel UI
    const activeConnectorArrow = ref(null) // For showing arrow to paired connector
    const arrowTimeoutId = ref(null) // For clearing arrow timeout
    const potentialDragItem = ref(null) // Track item clicked without Alt for drag hint
    const dragHintShown = ref(false) // Prevent multiple hints
    
    // Toast and dialog
    const { success, error, warning, info } = useToast()
    const confirmDialog = ref({
      show: false,
      title: '',
      message: '',
      confirmText: 'Confirm',
      cancelText: 'Cancel',
      onConfirm: () => {},
      onCancel: () => {}
    })
    
    const {
      scale,
      offsetX,
      offsetY,
      isDragging,
      image,
      ctx,
      initCanvas,
      loadImage,
      startDrag,
      drag,
      endDrag,
      wheelZoom,
      zoom,
      resetView: reset,
      render: baseRender
    } = useMapViewer()
    
    const {
      hoveredPOI,
      hoveredConnection,
      hoveredConnector,
      canvasToImage,
      imageToCanvas,
      isPOIHit,
      isConnectionHit,
      isConnectorHit,
      drawPOI,
      drawConnection,
      drawConnector
    } = useMapInteractions(scale, offsetX, offsetY)
    
    // Load maps from localStorage or use default
    const loadMaps = () => {
      const customMaps = localStorage.getItem('customMaps')
      if (customMaps) {
        try {
          return JSON.parse(customMaps)
        } catch (e) {
          console.error('Failed to parse custom maps:', e)
          return mapList
        }
      }
      return mapList
    }
    
    const maps = reactive(loadMaps())
    const zoomPercent = computed(() => Math.round(scale.value * 100))
    
    // Helper function to show confirm dialog
    const showConfirm = (title, message, confirmText = 'Confirm', cancelText = 'Cancel') => {
      return new Promise((resolve) => {
        confirmDialog.value = {
          show: true,
          title,
          message,
          confirmText,
          cancelText,
          onConfirm: () => {
            confirmDialog.value.show = false
            resolve(true)
          },
          onCancel: () => {
            confirmDialog.value.show = false
            resolve(false)
          }
        }
      })
    }
    
    const currentMapData = computed(() => {
      const map = maps[selectedMapIndex.value]
      if (!map) return { pois: [], connections: [], connectors: [] }
      const filename = getMapFilename(map.file)
      return mapData[filename] || { pois: [], connections: [], connectors: [] }
    })
    
    const render = () => {
      baseRender()
      
      if (!ctx.value || !image.value) return
      
      // Draw connections
      currentMapData.value.connections.forEach(connection => {
        const isDragging = draggedItem.value && draggedItem.value.id === connection.id
        const isPending = pendingChange.value && pendingChange.value.item.id === connection.id
        drawConnection(ctx.value, connection, isDragging || isPending)
      })
      
      // Draw connectors
      if (currentMapData.value.connectors) {
        currentMapData.value.connectors.forEach(connector => {
          const isDragging = draggedItem.value && draggedItem.value.id === connector.id
          const isPending = pendingChange.value && pendingChange.value.item.id === connector.id
          drawConnector(ctx.value, connector, isDragging || isPending)
        })
      }
      
      // Draw POIs
      currentMapData.value.pois.forEach(poi => {
        const isDragging = draggedItem.value && draggedItem.value.id === poi.id
        const isPending = pendingChange.value && pendingChange.value.item.id === poi.id
        drawPOI(ctx.value, poi, isDragging || isPending)
      })
      
      // Draw pending items
      if (pendingPOI.value) {
        drawPendingPOI(ctx.value, pendingPOI.value)
      }
      
      if (pendingConnection.value) {
        drawPendingConnection(ctx.value, pendingConnection.value)
      }
      
      if (pendingConnector.value) {
        drawPendingConnector(ctx.value, pendingConnector.value)
      }
      
      // Draw first connector of a pair being created
      if (pendingConnectorPair.value.first && !pendingConnector.value) {
        drawConnector(ctx.value, pendingConnectorPair.value.first, false)
      }
      
      // Draw connector arrow if active
      if (activeConnectorArrow.value && activeConnectorArrow.value.from && activeConnectorArrow.value.to) {
        drawConnectorArrow(ctx.value, activeConnectorArrow.value.from, activeConnectorArrow.value.to)
      }
      
      // Update popup position if POI is selected
      if (selectedPOI.value && mapCanvas.value) {
        const rect = mapCanvas.value.getBoundingClientRect()
        const canvasPos = imageToCanvas(selectedPOI.value.x, selectedPOI.value.y)
        
        // Position popup to the right of the POI with some offset
        let offsetX = 40 // Distance from POI center
        const offsetY = -20 // Slight upward offset
        
        // Check if popup would go off the right edge of the screen
        const popupWidth = 300 // Approximate max width
        const screenX = canvasPos.x + rect.left + offsetX
        
        // If it would go off the right edge, position it to the left instead
        if (screenX + popupWidth > window.innerWidth - 20) {
          offsetX = -popupWidth - 40
          popupIsLeftSide.value = true
        } else {
          popupIsLeftSide.value = false
        }
        
        popupPosition.value = {
          x: canvasPos.x + rect.left + offsetX,
          y: canvasPos.y + rect.top + offsetY
        }
      }
    }
    
    const resizeCanvas = () => {
      if (!mapCanvas.value || !mapContainer.value) return
      
      const rect = mapContainer.value.getBoundingClientRect()
      mapCanvas.value.width = rect.width
      mapCanvas.value.height = rect.height
      render()
    }
    
    const loadSelectedMap = async () => {
      const map = maps[selectedMapIndex.value]
      if (!map) return
      
      isLoading.value = true
      selectedPOI.value = null
      try {
        await loadImage(map.file)
        reset(mapCanvas.value)
        render()
      } catch (err) {
        console.error('Failed to load map:', err)
        error(`Failed to load map: ${map.name}`)
      } finally {
        isLoading.value = false
      }
    }
    
    const handleMapClick = (e) => {
      const rect = mapCanvas.value.getBoundingClientRect()
      const canvasX = e.clientX - rect.left
      const canvasY = e.clientY - rect.top
      const imagePos = canvasToImage(canvasX, canvasY)
      
      // In admin mode, check for deletion with left-click
      if (isAdmin.value && e.shiftKey) {
        // Check for connector clicks
        const clickedConnector = currentMapData.value.connectors?.find(conn =>
          isConnectorHit(conn, imagePos.x, imagePos.y)
        )
        
        if (clickedConnector) {
          showConfirm('Delete Connector', `Delete connector "${clickedConnector.label}"?`, 'Delete', 'Cancel').then(confirmed => {
            if (confirmed) {
              deleteConnector(clickedConnector.id)
            }
          })
          return
        }
        
        // Check for connection clicks
        const clickedConnection = currentMapData.value.connections.find(conn =>
          isConnectionHit(conn, imagePos.x, imagePos.y)
        )
        
        if (clickedConnection) {
          showConfirm('Delete Connection', `Delete connection "${clickedConnection.label}"?`, 'Delete', 'Cancel').then(confirmed => {
            if (confirmed) {
              deleteConnection(clickedConnection.id)
            }
          })
          return
        }
        
        // Check for POI clicks
        const clickedPOI = currentMapData.value.pois.find(poi =>
          isPOIHit(poi, imagePos.x, imagePos.y)
        )
        
        if (clickedPOI) {
          showConfirm('Delete POI', `Delete POI "${clickedPOI.name}"?`, 'Delete', 'Cancel').then(confirmed => {
            if (confirmed) {
              deletePOI(clickedPOI.id)
            }
          })
          return
        }
        
        return
      }
      
      // Skip normal click behavior if Alt key is pressed (for dragging)
      if (e.altKey) {
        return
      }
      
      // First check for POI clicks (in case a POI is also a connector point)
      const clickedPOI = currentMapData.value.pois.find(poi =>
        isPOIHit(poi, imagePos.x, imagePos.y)
      )
      
      // Check for connector clicks
      const clickedConnector = currentMapData.value.connectors?.find(conn =>
        isConnectorHit(conn, imagePos.x, imagePos.y)
      )
      
      // Check for connection clicks
      const clickedConnection = currentMapData.value.connections.find(conn =>
        isConnectionHit(conn, imagePos.x, imagePos.y)
      )
      
      // Check if this POI is also a connector point
      let isConnectorPOI = false
      let connectorAtPOI = null
      if (clickedPOI) {
        connectorAtPOI = currentMapData.value.connectors?.find(conn =>
          conn.poiId === clickedPOI.id || (conn.x === clickedPOI.x && conn.y === clickedPOI.y)
        )
        isConnectorPOI = !!connectorAtPOI
      }
      
      // In admin mode with Ctrl/Cmd held, show admin popup for settings
      if (isAdmin.value && (e.ctrlKey || e.metaKey) && (clickedPOI || clickedConnector || clickedConnection)) {
        const item = clickedPOI || clickedConnector || clickedConnection
        const itemType = clickedPOI ? 'poi' : (clickedConnector ? 'connector' : 'connection')
        
        // Position admin popup near the clicked item
        const canvasPos = imageToCanvas(item.x, item.y)
        adminPopupItem.value = item
        adminPopupType.value = itemType
        
        // Initial position (to the right and slightly above the item)
        let popupX = canvasPos.x + rect.left + 40
        let popupY = canvasPos.y + rect.top - 20
        
        // Popup dimensions
        const popupWidth = 320
        const popupHeight = 400 // Approximate height
        const margin = 20 // Margin from screen edges
        
        // Check right edge
        if (popupX + popupWidth > window.innerWidth - margin) {
          // Try positioning to the left of the item
          popupX = canvasPos.x + rect.left - popupWidth - 40
        }
        
        // Check left edge
        if (popupX < margin) {
          popupX = margin
        }
        
        // Check bottom edge
        if (popupY + popupHeight > window.innerHeight - margin) {
          popupY = window.innerHeight - popupHeight - margin
        }
        
        // Check top edge
        if (popupY < margin) {
          popupY = margin
        }
        
        adminPopupPosition.value = {
          x: popupX,
          y: popupY
        }
        
        return
      }
      
      // If it's a connector POI, handle both connector arrow and POI popup
      if (isConnectorPOI && connectorAtPOI) {
        // Show POI popup
        selectedPOI.value = clickedPOI
        const canvasPos = imageToCanvas(clickedPOI.x, clickedPOI.y)
        let offsetX = 40 // Distance from POI center
        const offsetY = -20 // Slight upward offset
        
        // Check if popup would go off the right edge
        const popupWidth = 300
        const screenX = canvasPos.x + rect.left + offsetX
        
        if (screenX + popupWidth > window.innerWidth - 20) {
          offsetX = -popupWidth - 40
          popupIsLeftSide.value = true
        } else {
          popupIsLeftSide.value = false
        }
        
        popupPosition.value = {
          x: canvasPos.x + rect.left + offsetX,
          y: canvasPos.y + rect.top + offsetY
        }
        
        // Find and show arrow to paired connector (but don't navigate)
        const pairedConnector = currentMapData.value.connectors.find(conn =>
          conn.pairId === connectorAtPOI.pairId && conn.id !== connectorAtPOI.id
        )
        
        if (pairedConnector) {
          // Clear any existing arrow timeout
          if (arrowTimeoutId.value) {
            clearTimeout(arrowTimeoutId.value)
          }
          
          activeConnectorArrow.value = {
            from: connectorAtPOI,
            to: pairedConnector
          }
          
          // Clear arrow after 3 seconds
          arrowTimeoutId.value = setTimeout(() => {
            activeConnectorArrow.value = null
            arrowTimeoutId.value = null
            render()
          }, 3000)
        }
        return
      }
      
      // Handle regular connector clicks (not on POIs)
      if (clickedConnector && !clickedConnector.snapToPOI) {
        // Find the paired connector
        const pairedConnector = currentMapData.value.connectors.find(conn =>
          conn.pairId === clickedConnector.pairId && conn.id !== clickedConnector.id
        )
        
        if (pairedConnector) {
          // Clear any existing arrow timeout
          if (arrowTimeoutId.value) {
            clearTimeout(arrowTimeoutId.value)
            arrowTimeoutId.value = null
          }
          
          // Show arrow pointing to paired connector
          activeConnectorArrow.value = {
            from: clickedConnector,
            to: pairedConnector
          }
          // Navigate to the paired connector
          navigateToConnector(pairedConnector)
        }
        return
      }
      
      // Handle connection clicks
      if (clickedConnection) {
        // Navigate to connected map
        const targetMapIndex = maps.findIndex(map => 
          getMapFilename(map.file) === clickedConnection.targetMap
        )
        if (targetMapIndex !== -1) {
          selectedMapIndex.value = targetMapIndex
          loadSelectedMap()
        }
        return
      }
      
      // Check for POI clicks (works in both admin and normal mode)
      // We already checked above, so use the existing clickedPOI if found
      if (clickedPOI && !isConnectorPOI) {
        selectedPOI.value = clickedPOI
        const canvasPos = imageToCanvas(clickedPOI.x, clickedPOI.y)
        let offsetX = 40 // Distance from POI center
        const offsetY = -20 // Slight upward offset
        
        // Check if popup would go off the right edge
        const popupWidth = 300
        const screenX = canvasPos.x + rect.left + offsetX
        
        if (screenX + popupWidth > window.innerWidth - 20) {
          offsetX = -popupWidth - 40
          popupIsLeftSide.value = true
        } else {
          popupIsLeftSide.value = false
        }
        
        popupPosition.value = {
          x: canvasPos.x + rect.left + offsetX,
          y: canvasPos.y + rect.top + offsetY
        }
      }
      
      // Only close popup if clicking on empty map area (not on any interactive element)
      if (!clickedPOI && !clickedConnector && !clickedConnection) {
        selectedPOI.value = null
        adminPopupItem.value = null
      }
    }
    
    const handleRightClick = (e) => {
      if (!isAdmin.value) return
      
      const rect = mapCanvas.value.getBoundingClientRect()
      const canvasX = e.clientX - rect.left
      const canvasY = e.clientY - rect.top
      const imagePos = canvasToImage(canvasX, canvasY)
      
      // Check if right-clicking on an existing connector
      const clickedConnector = currentMapData.value.connectors?.find(conn =>
        isConnectorHit(conn, imagePos.x, imagePos.y)
      )
      
      if (clickedConnector) {
        // Find if there's a paired connector
        const pairedConnector = currentMapData.value.connectors.find(conn =>
          conn.pairId === clickedConnector.pairId && conn.id !== clickedConnector.id
        )
        
        const message = pairedConnector 
          ? `Delete connector pair "${clickedConnector.label}" and "${pairedConnector.label}"?`
          : `Delete single connector "${clickedConnector.label}"?`
        
        const title = pairedConnector ? 'Delete Connector Pair' : 'Delete Connector'
          
        showConfirm(title, message, 'Delete', 'Cancel').then(confirmed => {
          if (confirmed) {
            deleteConnector(clickedConnector.id)
          }
        })
        return
      }
      
      // Check for other existing items
      const clickedConnection = currentMapData.value.connections.find(conn =>
        isConnectionHit(conn, imagePos.x, imagePos.y)
      )
      
      if (clickedConnection) {
        showConfirm('Delete Connection', `Delete connection "${clickedConnection.label}"?`, 'Delete', 'Cancel').then(confirmed => {
          if (confirmed) {
            deleteConnection(clickedConnection.id)
          }
        })
        return
      }
      
      const clickedPOI = currentMapData.value.pois.find(poi =>
        isPOIHit(poi, imagePos.x, imagePos.y)
      )
      
      // In connector mode with invisible link, clicking on POI sets connector position
      if (editMode.value === 'connector' && clickedPOI) {
        // Check if we have invisibleLink from the AdminPanel (need to pass this through)
        // For now, we'll place the connector at the POI position
        pendingConnector.value = {
          x: clickedPOI.x,
          y: clickedPOI.y,
          snapToPOI: true,
          poiId: clickedPOI.id
        }
        return
      }
      
      if (clickedPOI) {
        showConfirm('Delete POI', `Delete POI "${clickedPOI.name}"?`, 'Delete', 'Cancel').then(confirmed => {
          if (confirmed) {
            deletePOI(clickedPOI.id)
          }
        })
        return
      }
      
      // If not clicking on existing items, place new ones
      if (editMode.value === 'zone') {
        // Adding connection
        pendingConnection.value = {
          x: imagePos.x,
          y: imagePos.y
        }
      } else if (editMode.value === 'connector') {
        // Adding connector
        pendingConnector.value = {
          x: imagePos.x,
          y: imagePos.y
        }
      } else {
        // Adding POI
        pendingPOI.value = {
          x: imagePos.x,
          y: imagePos.y
        }
      }
    }
    
    const handleModeChange = (newMode) => {
      editMode.value = newMode
    }
    
    const handleConnectorSettingsChange = (settings) => {
      connectorSettings.value = settings
    }
    
    const showLabelPositionDialog = async (item, itemType) => {
      const positions = ['top', 'bottom', 'left', 'right']
      const currentPosition = item.labelPosition || 'bottom'
      
      // Create a custom dialog with position options
      const message = `Current label position: ${currentPosition.charAt(0).toUpperCase() + currentPosition.slice(1)}\n\nSelect new position:`
      
      // For now, we'll use a simple approach with multiple confirm dialogs
      // In a real app, you'd want a proper selection dialog
      const newPosition = await new Promise(async (resolve) => {
        for (const pos of positions) {
          if (pos === currentPosition) continue
          
          const confirmed = await showConfirm(
            'Change Label Position',
            `Move label to ${pos}?`,
            `Move to ${pos}`,
            'Cancel'
          )
          
          if (confirmed) {
            resolve(pos)
            return
          }
        }
        resolve(null)
      })
      
      if (newPosition) {
        // Update the item's label position
        item.labelPosition = newPosition
        
        // Save the changes
        const map = maps[selectedMapIndex.value]
        const filename = getMapFilename(map.file)
        saveMapData()
        render()
        
        success(`Label position changed to ${newPosition}`)
      }
    }
    
    const handleMouseDown = (e) => {
      // Check if we're in admin mode and Alt key is held for dragging
      if (isAdmin.value && e.altKey && !e.shiftKey) {
        const rect = mapCanvas.value.getBoundingClientRect()
        const canvasX = e.clientX - rect.left
        const canvasY = e.clientY - rect.top
        const imagePos = canvasToImage(canvasX, canvasY)
        
        // Check for POI hit
        const clickedPOI = currentMapData.value.pois.find(poi =>
          isPOIHit(poi, imagePos.x, imagePos.y)
        )
        
        if (clickedPOI) {
          draggedItem.value = clickedPOI
          dragItemType.value = 'poi'
          dragOffset.value = {
            x: imagePos.x - clickedPOI.x,
            y: imagePos.y - clickedPOI.y
          }
          originalPosition.value = {
            x: clickedPOI.x,
            y: clickedPOI.y
          }
          return
        }
        
        // Check for connection hit
        const clickedConnection = currentMapData.value.connections.find(conn =>
          isConnectionHit(conn, imagePos.x, imagePos.y)
        )
        
        if (clickedConnection) {
          draggedItem.value = clickedConnection
          dragItemType.value = 'connection'
          dragOffset.value = {
            x: imagePos.x - clickedConnection.x,
            y: imagePos.y - clickedConnection.y
          }
          originalPosition.value = {
            x: clickedConnection.x,
            y: clickedConnection.y
          }
          return
        }
        
        // Check for connector hit
        const clickedConnector = currentMapData.value.connectors?.find(conn =>
          isConnectorHit(conn, imagePos.x, imagePos.y)
        )
        
        if (clickedConnector) {
          draggedItem.value = clickedConnector
          dragItemType.value = 'connector'
          dragOffset.value = {
            x: imagePos.x - clickedConnector.x,
            y: imagePos.y - clickedConnector.y
          }
          originalPosition.value = {
            x: clickedConnector.x,
            y: clickedConnector.y
          }
          return
        }
      }
      
      // If not dragging an item, check for potential drag attempt without Alt
      if (!draggedItem.value) {
        // Check if clicking on an item in admin mode without Alt
        if (isAdmin.value && !e.altKey) {
          const rect = mapCanvas.value.getBoundingClientRect()
          const canvasX = e.clientX - rect.left
          const canvasY = e.clientY - rect.top
          const imagePos = canvasToImage(canvasX, canvasY)
          
          // Check if clicking on any draggable item
          const clickedPOI = currentMapData.value.pois.find(poi =>
            isPOIHit(poi, imagePos.x, imagePos.y)
          )
          const clickedConnection = currentMapData.value.connections.find(conn =>
            isConnectionHit(conn, imagePos.x, imagePos.y)
          )
          const clickedConnector = currentMapData.value.connectors?.find(conn =>
            isConnectorHit(conn, imagePos.x, imagePos.y)
          )
          
          // Track the clicked item for potential drag hint
          if (clickedPOI || clickedConnection || clickedConnector) {
            potentialDragItem.value = clickedPOI || clickedConnection || clickedConnector
            dragHintShown.value = false
          }
        }
        
        // Start normal map dragging
        startDrag(e.clientX, e.clientY)
      }
    }
    
    const handleMouseMove = (e) => {
      const rect = mapCanvas.value.getBoundingClientRect()
      const canvasX = e.clientX - rect.left
      const canvasY = e.clientY - rect.top
      const imagePos = canvasToImage(canvasX, canvasY)
      
      // Handle item dragging
      if (draggedItem.value) {
        // Update the position of the dragged item
        draggedItem.value.x = imagePos.x - dragOffset.value.x
        draggedItem.value.y = imagePos.y - dragOffset.value.y
        render()
        return
      }
      
      // Update hovered items
      hoveredPOI.value = currentMapData.value.pois.find(poi =>
        isPOIHit(poi, imagePos.x, imagePos.y)
      )
      
      hoveredConnection.value = currentMapData.value.connections.find(conn =>
        isConnectionHit(conn, imagePos.x, imagePos.y)
      )
      
      hoveredConnector.value = currentMapData.value.connectors?.find(conn =>
        isConnectorHit(conn, imagePos.x, imagePos.y)
      )
      
      // Update cursor
      if (isAdmin.value && e.shiftKey && (hoveredPOI.value || hoveredConnection.value || hoveredConnector.value)) {
        mapCanvas.value.style.cursor = 'not-allowed'
      } else if (isAdmin.value && e.altKey && (hoveredPOI.value || hoveredConnection.value || hoveredConnector.value)) {
        mapCanvas.value.style.cursor = 'move'
      } else if (hoveredPOI.value || hoveredConnection.value || hoveredConnector.value) {
        mapCanvas.value.style.cursor = 'pointer'
      } else if (!isDragging.value && !draggedItem.value) {
        mapCanvas.value.style.cursor = isAdmin.value ? 'crosshair' : 'grab'
      }
      
      // Check if trying to drag an item without Alt
      if (potentialDragItem.value && isDragging.value && !dragHintShown.value) {
        // Check if the potential drag item is still under the cursor
        const stillOnItem = (potentialDragItem.value === hoveredPOI.value) ||
                          (potentialDragItem.value === hoveredConnection.value) ||
                          (potentialDragItem.value === hoveredConnector.value)
        
        if (stillOnItem) {
          info('Hold Alt + Click to drag items')
          dragHintShown.value = true
        }
      }
      
      if (!isDragging.value) {
        render()
        return
      }
      
      drag(e.clientX, e.clientY)
      render()
    }
    
    const handleMouseUp = () => {
      // Reset potential drag tracking
      potentialDragItem.value = null
      dragHintShown.value = false
      
      // If we were dragging an item, check if it actually moved
      if (draggedItem.value) {
        const moved = draggedItem.value.x !== originalPosition.value.x || 
                     draggedItem.value.y !== originalPosition.value.y
        
        if (moved) {
          // Only show pending change if the item was actually moved
          pendingChange.value = {
            item: draggedItem.value,
            type: dragItemType.value,
            originalPosition: { ...originalPosition.value },
            newPosition: {
              x: draggedItem.value.x,
              y: draggedItem.value.y
            }
          }
        }
        
        // Clear drag state
        draggedItem.value = null
        dragItemType.value = null
        dragOffset.value = { x: 0, y: 0 }
      } else {
        endDrag()
      }
    }
    
    const handleWheel = (e) => {
      const rect = mapCanvas.value.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9
      
      wheelZoom(x, y, zoomFactor)
      render()
    }
    
    const handleTouchStart = (e) => {
      if (e.touches.length === 1) {
        const touch = e.touches[0]
        startDrag(touch.clientX, touch.clientY)
      }
    }
    
    const handleTouchMove = (e) => {
      if (!isDragging.value || e.touches.length !== 1) return
      const touch = e.touches[0]
      drag(touch.clientX, touch.clientY)
      render()
    }
    
    const handleTouchEnd = () => {
      endDrag()
    }
    
    const zoomIn = () => {
      zoom(1.2, mapCanvas.value)
      render()
    }
    
    const zoomOut = () => {
      zoom(0.8, mapCanvas.value)
      render()
    }
    
    const resetViewHandler = () => {
      reset(mapCanvas.value)
      render()
    }
    
    const drawPendingPOI = (ctx, pendingPos) => {
      const canvasPos = imageToCanvas(pendingPos.x, pendingPos.y)
      
      ctx.save()
      ctx.translate(canvasPos.x, canvasPos.y)
      
      // Animated pulse effect
      const time = Date.now() / 500
      const pulseScale = 1 + Math.sin(time) * 0.1
      ctx.scale(pulseScale, pulseScale)
      
      // Draw semi-transparent background circle
      ctx.beginPath()
      ctx.arc(0, 0, 25, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(74, 124, 89, 0.2)'
      ctx.fill()
      
      // Draw dashed circle border
      ctx.setLineDash([5, 5])
      ctx.lineDashOffset = time * 2
      ctx.strokeStyle = 'rgba(74, 124, 89, 0.8)'
      ctx.lineWidth = 2
      ctx.stroke()
      
      // Draw POI icon preview (pin)
      ctx.setLineDash([])
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'
      ctx.font = 'bold 20px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('📍', 0, 0)
      
      ctx.restore()
    }
    
    const drawPendingConnection = (ctx, pendingPos) => {
      const canvasPos = imageToCanvas(pendingPos.x, pendingPos.y)
      
      ctx.save()
      ctx.translate(canvasPos.x, canvasPos.y)
      
      // Animated pulse effect
      const time = Date.now() / 500
      const pulseScale = 1 + Math.sin(time) * 0.1
      ctx.scale(pulseScale, pulseScale)
      
      // Draw semi-transparent background circle
      ctx.beginPath()
      ctx.arc(0, 0, 30, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(138, 43, 226, 0.2)'
      ctx.fill()
      
      // Draw dashed circle border
      ctx.setLineDash([5, 5])
      ctx.lineDashOffset = time * 2
      ctx.strokeStyle = 'rgba(138, 43, 226, 0.8)'
      ctx.lineWidth = 2
      ctx.stroke()
      
      // Draw portal preview
      ctx.setLineDash([])
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 20)
      gradient.addColorStop(0, 'rgba(147, 112, 219, 0.8)')
      gradient.addColorStop(0.7, 'rgba(138, 43, 226, 0.6)')
      gradient.addColorStop(1, 'rgba(138, 43, 226, 0.2)')
      
      ctx.beginPath()
      ctx.arc(0, 0, 20, 0, Math.PI * 2)
      ctx.fillStyle = gradient
      ctx.fill()
      
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)'
      ctx.lineWidth = 2
      ctx.stroke()
      
      ctx.restore()
    }
    
    const drawPendingConnector = (ctx, pendingPos) => {
      const canvasPos = imageToCanvas(pendingPos.x, pendingPos.y)
      
      ctx.save()
      ctx.translate(canvasPos.x, canvasPos.y)
      
      // If placing on a POI or invisible icon is checked, just show a subtle indicator
      if (pendingPos.snapToPOI || connectorSettings.value.invisibleIcon) {
        // Just show a small pulsing dot
        const time = Date.now() / 500
        const pulseScale = 1 + Math.sin(time) * 0.2
        
        ctx.beginPath()
        ctx.arc(0, 0, 5 * pulseScale, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(78, 205, 196, 0.6)'
        ctx.fill()
        
        ctx.restore()
        return
      }
      
      // Animated pulse effect for normal connectors
      const time = Date.now() / 500
      const pulseScale = 1 + Math.sin(time) * 0.1
      ctx.scale(pulseScale, pulseScale)
      
      // Draw semi-transparent background circle
      ctx.beginPath()
      ctx.arc(0, 0, 25, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(78, 205, 196, 0.2)'
      ctx.fill()
      
      // Draw dashed circle border
      ctx.setLineDash([5, 5])
      ctx.lineDashOffset = time * 2
      ctx.strokeStyle = 'rgba(78, 205, 196, 0.8)'
      ctx.lineWidth = 2
      ctx.stroke()
      
      // Draw link icon preview
      ctx.setLineDash([])
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)'
      ctx.lineWidth = 3
      ctx.lineCap = 'round'
      
      const linkRadius = 8
      const offset = linkRadius * 0.5
      
      // First circle of the link
      ctx.beginPath()
      ctx.arc(-offset, 0, linkRadius, 0, Math.PI * 2)
      ctx.stroke()
      
      // Second circle of the link
      ctx.beginPath()
      ctx.arc(offset, 0, linkRadius, 0, Math.PI * 2)
      ctx.stroke()
      
      // If this is the second connector, draw a line to the first
      if (pendingConnectorPair.value.first) {
        ctx.restore()
        ctx.save()
        
        const firstPos = imageToCanvas(pendingConnectorPair.value.first.x, pendingConnectorPair.value.first.y)
        
        // Draw connecting line
        const gradient = ctx.createLinearGradient(firstPos.x, firstPos.y, canvasPos.x, canvasPos.y)
        gradient.addColorStop(0, 'rgba(78, 205, 196, 0.4)')
        gradient.addColorStop(0.5, 'rgba(78, 205, 196, 0.6)')
        gradient.addColorStop(1, 'rgba(78, 205, 196, 0.4)')
        
        ctx.strokeStyle = gradient
        ctx.lineWidth = 2
        ctx.setLineDash([10, 5])
        ctx.lineDashOffset = -time * 2
        
        ctx.beginPath()
        ctx.moveTo(firstPos.x, firstPos.y)
        ctx.lineTo(canvasPos.x, canvasPos.y)
        ctx.stroke()
      }
      
      ctx.restore()
    }
    
    const drawConnectorArrow = (ctx, fromConnector, toConnector) => {
      const fromPos = imageToCanvas(fromConnector.x, fromConnector.y)
      const toPos = imageToCanvas(toConnector.x, toConnector.y)
      
      // Calculate angle and distance
      const dx = toPos.x - fromPos.x
      const dy = toPos.y - fromPos.y
      const distance = Math.sqrt(dx * dx + dy * dy)
      const angle = Math.atan2(dy, dx)
      
      // Start and end points with some offset from the connectors
      const startDistance = 30
      const endDistance = 30
      const startX = fromPos.x + Math.cos(angle) * startDistance
      const startY = fromPos.y + Math.sin(angle) * startDistance
      const endX = toPos.x - Math.cos(angle) * endDistance
      const endY = toPos.y - Math.sin(angle) * endDistance
      
      // Animated dash offset
      const time = Date.now() / 100
      
      ctx.save()
      
      // Draw line with gradient
      const gradient = ctx.createLinearGradient(fromPos.x, fromPos.y, toPos.x, toPos.y)
      const color = fromConnector.color || '#4ecdc4'
      
      // Convert hex to rgba for transparency
      const r = parseInt(color.slice(1, 3), 16)
      const g = parseInt(color.slice(3, 5), 16)
      const b = parseInt(color.slice(5, 7), 16)
      
      gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.3)`)
      gradient.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, 0.8)`)
      gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0.3)`)
      
      // Draw the connecting line
      ctx.strokeStyle = gradient
      ctx.lineWidth = 4
      ctx.setLineDash([10, 5])
      ctx.lineDashOffset = -time
      
      ctx.beginPath()
      ctx.moveTo(startX, startY)
      ctx.lineTo(endX, endY)
      ctx.stroke()
      
      // Draw arrowheads at both ends
      ctx.setLineDash([])
      ctx.fillStyle = color
      
      // Arrow at the target end
      ctx.save()
      ctx.translate(endX, endY)
      ctx.rotate(angle)
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(-20, -10)
      ctx.lineTo(-20, 10)
      ctx.closePath()
      ctx.fill()
      ctx.restore()
      
      // Arrow at the start (pointing backwards)
      ctx.save()
      ctx.translate(startX, startY)
      ctx.rotate(angle + Math.PI)
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(-20, -10)
      ctx.lineTo(-20, 10)
      ctx.closePath()
      ctx.fill()
      ctx.restore()
      
      // Add pulsing effect on the connectors
      const pulseSize = 5 + Math.sin(time / 10) * 3
      
      // Pulse effect on source
      ctx.beginPath()
      ctx.arc(fromPos.x, fromPos.y, startDistance + pulseSize, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${0.5 + Math.sin(time / 10) * 0.3})`
      ctx.lineWidth = 2
      ctx.stroke()
      
      // Pulse effect on target
      ctx.beginPath()
      ctx.arc(toPos.x, toPos.y, endDistance + pulseSize, 0, Math.PI * 2)
      ctx.stroke()
      
      ctx.restore()
    }
    
    const navigateToConnector = (connector) => {
      if (!mapCanvas.value || !connector) return
      
      const targetCanvasPos = imageToCanvas(connector.x, connector.y)
      const centerX = mapCanvas.value.width / 2
      const centerY = mapCanvas.value.height / 2
      
      // Calculate the offset needed to center the connector
      const targetOffsetX = centerX - connector.x * scale.value
      const targetOffsetY = centerY - connector.y * scale.value
      
      // Animate the pan
      const startOffsetX = offsetX.value
      const startOffsetY = offsetY.value
      const duration = 800 // milliseconds
      const startTime = Date.now()
      
      const animate = () => {
        const elapsed = Date.now() - startTime
        const progress = Math.min(elapsed / duration, 1)
        
        // Ease-in-out cubic
        const easeProgress = progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2
        
        offsetX.value = startOffsetX + (targetOffsetX - startOffsetX) * easeProgress
        offsetY.value = startOffsetY + (targetOffsetY - startOffsetY) * easeProgress
        
        render()
        
        if (progress < 1) {
          requestAnimationFrame(animate)
        } else {
          // Clear arrow after animation completes
          setTimeout(() => {
            activeConnectorArrow.value = null
          }, 500)
        }
      }
      
      animate()
    }
    
    const toggleAdmin = () => {
      if (!isAdmin.value) {
        const password = prompt('Enter admin password:')
        if (!password) return
        
        // Get password from environment variable
        // IMPORTANT: Set VITE_ADMIN_PASSWORD in your .env file!
        const expectedPassword = import.meta.env.VITE_ADMIN_PASSWORD
        
        if (!expectedPassword) {
          error('Admin password not configured. Please set VITE_ADMIN_PASSWORD environment variable.')
          return
        }
        
        if (password === expectedPassword) {
          isAdmin.value = true
          localStorage.setItem('isAdmin', 'true')
          success('Admin mode activated')
        } else {
          error('Incorrect password')
        }
      } else {
        isAdmin.value = false
        localStorage.removeItem('isAdmin')
        pendingPOI.value = null
        pendingConnection.value = null
        pendingConnector.value = null
        info('Admin mode deactivated')
      }
    }
    
    const handleKeyboardShortcut = (e) => {
      // Ctrl+Shift+A to toggle admin mode
      if (e.ctrlKey && e.shiftKey && e.key === 'A') {
        e.preventDefault()
        toggleAdmin()
      }
      
      // Escape key handling
      if (e.key === 'Escape') {
        // Cancel any pending connector operation
        if (pendingConnector.value || pendingConnectorPair.value.first) {
          cancelConnector()
          return
        }
        
        // Cancel any pending POI
        if (pendingPOI.value) {
          cancelPOI()
          return
        }
        
        // Cancel any pending connection
        if (pendingConnection.value) {
          cancelConnection()
          return
        }
        
        // Close POI popup
        if (selectedPOI.value) {
          selectedPOI.value = null
          return
        }
      }
    }
    
    const savePOI = (poiData) => {
      if (!pendingPOI.value) return
      
      const map = maps[selectedMapIndex.value]
      const filename = getMapFilename(map.file)
      
      const newPOI = {
        id: `poi-${Date.now()}`,
        x: pendingPOI.value.x,
        y: pendingPOI.value.y,
        ...poiData
      }
      
      if (!mapData[filename]) {
        mapData[filename] = { pois: [], connections: [] }
      }
      
      mapData[filename].pois.push(newPOI)
      saveMapData()
      pendingPOI.value = null
      render()
      success(`POI "${poiData.name}" created successfully`)
    }
    
    const saveConnection = (connectionData) => {
      if (!pendingConnection.value) return
      
      const map = maps[selectedMapIndex.value]
      const filename = getMapFilename(map.file)
      
      const newConnection = {
        id: `conn-${Date.now()}`,
        x: pendingConnection.value.x,
        y: pendingConnection.value.y,
        ...connectionData
      }
      
      if (!mapData[filename]) {
        mapData[filename] = { pois: [], connections: [] }
      }
      
      mapData[filename].connections.push(newConnection)
      saveMapData()
      pendingConnection.value = null
      render()
      success(`Connection "${connectionData.label}" created successfully`)
    }
    
    const cancelPOI = () => {
      pendingPOI.value = null
    }
    
    const cancelConnection = () => {
      pendingConnection.value = null
    }
    
    const saveConnector = (connectorData) => {
      if (!pendingConnector.value) return
      
      const map = maps[selectedMapIndex.value]
      const filename = getMapFilename(map.file)
      
      // Generate a color for this pair if it's the first connector
      let pairColor = null
      if (!pendingConnectorPair.value.first) {
        // Generate a random color for this pair
        const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f39c12', '#9b59b6', '#3498db', '#2ecc71', '#e74c3c', '#1abc9c', '#f1c40f']
        const usedColors = new Set()
        if (mapData[filename] && mapData[filename].connectors) {
          mapData[filename].connectors.forEach(conn => usedColors.add(conn.color))
        }
        const availableColors = colors.filter(c => !usedColors.has(c))
        pairColor = availableColors.length > 0 ? availableColors[0] : colors[Math.floor(Math.random() * colors.length)]
      } else {
        pairColor = pendingConnectorPair.value.first.color
      }
      
      // Check if connector is being placed on a POI
      const isOnPOI = pendingConnector.value.snapToPOI || false
      
      const newConnector = {
        id: `connector-${Date.now()}`,
        x: pendingConnector.value.x,
        y: pendingConnector.value.y,
        label: connectorData.label,
        color: pairColor,
        pairId: pendingConnectorPair.value.first ? pendingConnectorPair.value.first.pairId : `pair-${Date.now()}`,
        invisible: connectorData.invisible || false,
        showIcon: isOnPOI ? false : (connectorData.showIcon !== undefined ? connectorData.showIcon : true),
        snapToPOI: isOnPOI,
        poiId: pendingConnector.value.poiId || null
      }
      
      if (!mapData[filename]) {
        mapData[filename] = { pois: [], connections: [], connectors: [] }
      }
      
      if (!mapData[filename].connectors) {
        mapData[filename].connectors = []
      }
      
      if (!pendingConnectorPair.value.first) {
        // This is the first connector of the pair
        pendingConnectorPair.value.first = newConnector
        pendingConnector.value = null
        
        // Reset view to show full map
        reset(mapCanvas.value)
        render()
      } else {
        // This is the second connector, complete the pair
        mapData[filename].connectors.push(pendingConnectorPair.value.first)
        mapData[filename].connectors.push(newConnector)
        saveMapData()
        const firstLabel = pendingConnectorPair.value.first.label
        const secondLabel = newConnector.label
        pendingConnectorPair.value = { first: null, second: null }
        pendingConnector.value = null
        render()
        success(`Connector pair "${firstLabel}" ↔ "${secondLabel}" created successfully`)
      }
    }
    
    const cancelConnector = () => {
      pendingConnector.value = null
      if (pendingConnectorPair.value.first) {
        pendingConnectorPair.value = { first: null, second: null }
      }
    }
    
    const deletePOI = (poiId) => {
      const map = maps[selectedMapIndex.value]
      const filename = getMapFilename(map.file)
      
      if (mapData[filename] && mapData[filename].pois) {
        const poi = mapData[filename].pois.find(p => p.id === poiId)
        mapData[filename].pois = mapData[filename].pois.filter(poi => poi.id !== poiId)
        saveMapData()
        // Clear selected POI if it's the one being deleted
        if (selectedPOI.value && selectedPOI.value.id === poiId) {
          selectedPOI.value = null
        }
        render()
        if (poi) {
          success(`POI "${poi.name}" deleted successfully`)
        }
      }
    }
    
    const handleAdminPopupUpdate = (updatedItem) => {
      const map = maps[selectedMapIndex.value]
      const filename = getMapFilename(map.file)
      
      if (adminPopupType.value === 'poi') {
        const poiIndex = mapData[filename].pois.findIndex(p => p.id === updatedItem.id)
        if (poiIndex !== -1) {
          mapData[filename].pois[poiIndex] = { ...mapData[filename].pois[poiIndex], ...updatedItem }
        }
      } else if (adminPopupType.value === 'connection') {
        const connIndex = mapData[filename].connections.findIndex(c => c.id === updatedItem.id)
        if (connIndex !== -1) {
          mapData[filename].connections[connIndex] = { ...mapData[filename].connections[connIndex], ...updatedItem }
        }
      } else if (adminPopupType.value === 'connector') {
        const connIndex = mapData[filename].connectors.findIndex(c => c.id === updatedItem.id)
        if (connIndex !== -1) {
          mapData[filename].connectors[connIndex] = { ...mapData[filename].connectors[connIndex], ...updatedItem }
        }
      }
      
      saveMapData()
      render()
      success('Settings updated successfully')
    }
    
    const handleAdminPopupActivate = (item, itemType) => {
      adminPopupItem.value = null
      
      if (itemType === 'poi') {
        // Show POI popup
        const rect = mapCanvas.value.getBoundingClientRect()
        selectedPOI.value = item
        const canvasPos = imageToCanvas(item.x, item.y)
        let offsetX = 40
        const offsetY = -20
        
        const popupWidth = 300
        const screenX = canvasPos.x + rect.left + offsetX
        
        if (screenX + popupWidth > window.innerWidth - 20) {
          offsetX = -popupWidth - 40
          popupIsLeftSide.value = true
        } else {
          popupIsLeftSide.value = false
        }
        
        popupPosition.value = {
          x: canvasPos.x + rect.left + offsetX,
          y: canvasPos.y + rect.top + offsetY
        }
      } else if (itemType === 'connection') {
        // Navigate to connected map
        const targetMapIndex = maps.findIndex(map => 
          getMapFilename(map.file) === item.targetMap
        )
        if (targetMapIndex !== -1) {
          selectedMapIndex.value = targetMapIndex
          loadSelectedMap()
        }
      } else if (itemType === 'connector') {
        // Find and navigate to paired connector
        const pairedConnector = currentMapData.value.connectors.find(conn =>
          conn.pairId === item.pairId && conn.id !== item.id
        )
        if (pairedConnector) {
          activeConnectorArrow.value = {
            from: item,
            to: pairedConnector
          }
          navigateToConnector(pairedConnector)
        }
      }
    }
    
    const handleAdminPopupDelete = (item, itemType) => {
      if (itemType === 'poi') {
        showConfirm('Delete POI', `Delete POI "${item.name}"?`, 'Delete', 'Cancel').then(confirmed => {
          if (confirmed) {
            deletePOI(item.id)
          }
        })
      } else if (itemType === 'connection') {
        showConfirm('Delete Connection', `Delete connection "${item.label}"?`, 'Delete', 'Cancel').then(confirmed => {
          if (confirmed) {
            deleteConnection(item.id)
          }
        })
      } else if (itemType === 'connector') {
        const pairedConnector = currentMapData.value.connectors.find(conn =>
          conn.pairId === item.pairId && conn.id !== item.id
        )
        const message = pairedConnector 
          ? `Delete connector pair "${item.label}" and "${pairedConnector.label}"?`
          : `Delete single connector "${item.label}"?`
        const title = pairedConnector ? 'Delete Connector Pair' : 'Delete Connector'
        
        showConfirm(title, message, 'Delete', 'Cancel').then(confirmed => {
          if (confirmed) {
            deleteConnector(item.id)
          }
        })
      }
      adminPopupItem.value = null
    }
    
    const handlePOIUpdate = async (updateData) => {
      const { id, field, oldValue, newValue, poi } = updateData
      
      // Create appropriate message based on the field and values
      let message
      if (!newValue || newValue === '') {
        message = `Clear ${field} "${oldValue}"?`
      } else if (!oldValue || oldValue === '') {
        message = `Set ${field} to "${newValue}"?`
      } else {
        message = `Change ${field} from "${oldValue}" to "${newValue}"?`
      }
      
      const confirmed = await showConfirm(
        'Confirm Update',
        message,
        'Update',
        'Cancel'
      )
      
      if (confirmed) {
        const map = maps[selectedMapIndex.value]
        const filename = getMapFilename(map.file)
        
        if (mapData[filename] && mapData[filename].pois) {
          const poiIndex = mapData[filename].pois.findIndex(p => p.id === id)
          if (poiIndex !== -1) {
            mapData[filename].pois[poiIndex][field] = newValue
            saveMapData()
            
            // Update selectedPOI to reflect the change
            if (selectedPOI.value && selectedPOI.value.id === id) {
              selectedPOI.value = { ...selectedPOI.value, [field]: newValue }
            }
            
            render()
            success(`POI ${field} updated successfully`)
          }
        }
      }
    }
    
    const deleteConnection = (connectionId) => {
      const map = maps[selectedMapIndex.value]
      const filename = getMapFilename(map.file)
      
      if (mapData[filename] && mapData[filename].connections) {
        const connection = mapData[filename].connections.find(c => c.id === connectionId)
        mapData[filename].connections = mapData[filename].connections.filter(conn => conn.id !== connectionId)
        saveMapData()
        render()
        if (connection) {
          success(`Connection "${connection.label}" deleted successfully`)
        }
      }
    }
    
    const deleteConnector = (connectorId) => {
      const map = maps[selectedMapIndex.value]
      const filename = getMapFilename(map.file)
      
      if (mapData[filename] && mapData[filename].connectors) {
        const connector = mapData[filename].connectors.find(c => c.id === connectorId)
        if (connector) {
          // Find if there's a pair
          const pairedConnector = mapData[filename].connectors.find(c => 
            c.pairId === connector.pairId && c.id !== connector.id
          )
          // Delete both connectors in the pair
          mapData[filename].connectors = mapData[filename].connectors.filter(c => c.pairId !== connector.pairId)
          saveMapData()
          render()
          if (pairedConnector) {
            success(`Connector pair "${connector.label}" ↔ "${pairedConnector.label}" deleted successfully`)
          } else {
            success(`Connector "${connector.label}" deleted successfully`)
          }
        }
      }
    }
    
    const confirmPendingChange = () => {
      if (!pendingChange.value) return
      
      // Save the change
      saveMapData()
      const itemType = pendingChange.value.type === 'poi' ? 'POI' : 
                      pendingChange.value.type === 'connection' ? 'Connection' : 'Connector'
      const itemName = pendingChange.value.item.name || pendingChange.value.item.label
      pendingChange.value = null
      render()
      success(`${itemType} "${itemName}" moved successfully`)
    }
    
    const handleUpdateMaps = (newMaps) => {
      // Update the global maps array
      maps.splice(0, maps.length, ...newMaps)
      
      // Save the updated maps list
      localStorage.setItem('customMaps', JSON.stringify(newMaps))
      
      // If the current map was deleted, switch to the first map
      if (selectedMapIndex.value >= newMaps.length) {
        selectedMapIndex.value = 0
        loadSelectedMap()
      }
    }
    
    const handleMapManagerConfirm = ({ title, message, confirmText, cancelText, onConfirm }) => {
      confirmDialog.value = {
        show: true,
        title,
        message,
        confirmText,
        cancelText,
        onConfirm: () => {
          confirmDialog.value.show = false
          if (onConfirm) onConfirm()
        },
        onCancel: () => {
          confirmDialog.value.show = false
        }
      }
    }
    
    const handleMapManagerToast = ({ type, message }) => {
      if (type === 'success') success(message)
      else if (type === 'error') error(message)
      else if (type === 'warning') warning(message)
      else info(message)
    }
    
    const cancelPendingChange = () => {
      if (!pendingChange.value) return
      
      // Restore original position
      pendingChange.value.item.x = pendingChange.value.originalPosition.x
      pendingChange.value.item.y = pendingChange.value.originalPosition.y
      pendingChange.value = null
      render()
    }
    
    // Watch for admin panel edit mode changes
    watch(() => isAdmin.value, (newVal) => {
      if (!newVal) {
        pendingPOI.value = null
        pendingConnection.value = null
      }
    })
    
    let animationFrameId = null
    
    const animate = () => {
      render()
      animationFrameId = requestAnimationFrame(animate)
    }
    
    onMounted(async () => {
      // Check for persisted admin mode
      if (localStorage.getItem('isAdmin') === 'true') {
        isAdmin.value = true
      }
      
      initCanvas(mapCanvas.value)
      resizeCanvas()
      window.addEventListener('resize', resizeCanvas)
      window.addEventListener('keydown', handleKeyboardShortcut)
      await loadSelectedMap()
      
      // Start animation loop for glowing effects
      animate()
    })
    
    onUnmounted(() => {
      window.removeEventListener('resize', resizeCanvas)
      window.removeEventListener('keydown', handleKeyboardShortcut)
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId)
      }
    })
    
    return {
      mapCanvas,
      mapContainer,
      maps,
      selectedMapIndex,
      isLoading,
      isAdmin,
      selectedPOI,
      popupPosition,
      popupIsLeftSide,
      pendingPOI,
      pendingConnection,
      pendingConnector,
      pendingConnectorPair,
      pendingChange,
      adminPopupItem,
      adminPopupType,
      adminPopupPosition,
      showMapManager,
      confirmDialog,
      isDragging,
      zoomPercent,
      loadSelectedMap,
      handleMapClick,
      handleRightClick,
      handleMouseDown,
      handleMouseMove,
      handleMouseUp,
      handleWheel,
      handleTouchStart,
      handleTouchMove,
      handleTouchEnd,
      zoomIn,
      zoomOut,
      resetView: resetViewHandler,
      toggleAdmin,
      savePOI,
      saveConnection,
      saveConnector,
      cancelPOI,
      cancelConnection,
      cancelConnector,
      handleModeChange,
      handleConnectorSettingsChange,
      deletePOI,
      handlePOIUpdate,
      handleAdminPopupUpdate,
      handleAdminPopupActivate,
      handleAdminPopupDelete,
      handleUpdateMaps,
      handleMapManagerConfirm,
      handleMapManagerToast,
      deleteConnection,
      confirmPendingChange,
      cancelPendingChange
    }
  }
}
</script>

<style scoped>
.header-controls {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.admin-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.75rem;
  background: rgba(74, 124, 89, 0.2);
  border: 1px solid rgba(74, 124, 89, 0.4);
  border-radius: 4px;
  font-size: 0.85rem;
}

.admin-dot {
  width: 8px;
  height: 8px;
  background: #4a7c59;
  border-radius: 50%;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.5; }
  100% { opacity: 1; }
}

.admin-text {
  color: #4a7c59;
  font-weight: 500;
}

.map-canvas.admin-cursor {
  cursor: crosshair !important;
}

.pending-change-overlay {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 1000;
}

.pending-change-card {
  background: rgba(30, 30, 30, 0.95);
  border: 2px solid #4a7c59;
  border-radius: 8px;
  padding: 1.5rem;
  min-width: 300px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
}

.pending-change-card h3 {
  margin: 0 0 1rem 0;
  color: #4a7c59;
  font-size: 1.2rem;
}

.pending-change-card p {
  margin: 0 0 1.5rem 0;
  color: #e0e0e0;
}

.pending-change-buttons {
  display: flex;
  gap: 1rem;
  justify-content: center;
}

.confirm-btn, .cancel-btn {
  padding: 0.5rem 1.5rem;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
}

.confirm-btn {
  background: #4a7c59;
  color: white;
}

.confirm-btn:hover {
  background: #5a8c69;
}

.cancel-btn {
  background: #666;
  color: white;
}

.cancel-btn:hover {
  background: #777;
}
</style>