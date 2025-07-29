<template>
  <div class="app-container">
    <header class="app-header">
      <h1>MMC</h1>
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
        :maps="maps"
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
      :dbMapData="dbMapData"
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
import { ref, reactive, onMounted, onUnmounted, computed, watch, nextTick } from 'vue'
import { useMapViewer } from './composables/useMapViewer'
import { useMapInteractions } from './composables/useMapInteractions'
import { mapsAPI, poisAPI, connectionsAPI, pointConnectorsAPI, zoneConnectorsAPI } from './services/api'
import POIPopup from './components/POIPopup.vue'
import AdminPanel from './components/AdminPanel.vue'
import AdminPopup from './components/AdminPopup.vue'
import MapManager from './components/MapManager.vue'
import ToastContainer from './components/ToastContainer.vue'
import ConfirmDialog from './components/ConfirmDialog.vue'
import { useToast } from './composables/useToast'

// Helper function to get map filename from path
function getMapFilename(path) {
  return path.split('/').pop()
}

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
    
    // Database state
    const dbMaps = ref([])
    const dbMapData = ref({})
    const isLoadingFromDB = ref(true)
    
    // Load maps from database only
    const loadMapsFromDatabase = async () => {
      try {
        isLoadingFromDB.value = true
        const mapsFromDB = await mapsAPI.getAll()
        
        if (!mapsFromDB || mapsFromDB.length === 0) {
          warning('No maps found in database. Please add a map using the Map Manager.')
          return []
        }
        
        dbMaps.value = mapsFromDB
        return mapsFromDB.map(map => ({
          name: map.name,
          file: map.image_url,
          id: map.id,
          width: map.width,
          height: map.height
        }))
      } catch (err) {
        console.error('Failed to load maps from database:', err)
        error(`Failed to load maps from database: ${err.message || 'Database connection error'}`)
        warning('Please check your internet connection and refresh the page')
        return []
      } finally {
        isLoadingFromDB.value = false
      }
    }
    
    const maps = ref([])
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
      const map = maps.value[selectedMapIndex.value]
      if (!map) return { pois: [], connections: [], connectors: [], zoneConnectors: [] }
      
      // Must have a database connection
      if (!map.id) {
        return { pois: [], connections: [], connectors: [], zoneConnectors: [] }
      }
      
      // Return data from database
      return dbMapData.value[map.id] || { pois: [], connections: [], connectors: [], zoneConnectors: [] }
    })
    
    // Track expanded groups
    const expandedGroups = ref(new Set())
    
    const groupPOIsWhenZoomedOut = (pois) => {
      // Only group when significantly zoomed out
      if (scale.value > 0.5) {
        expandedGroups.value.clear() // Clear expanded groups when zoomed in
        return pois
      }
      
      // Calculate grouping distance based on zoom level
      const groupingDistance = 50 / scale.value // Larger distance when more zoomed out
      
      const groups = []
      const processedPOIs = new Set()
      
      pois.forEach(poi => {
        if (processedPOIs.has(poi.id)) return
        
        // Find all POIs within grouping distance
        const nearbyPOIs = pois.filter(otherPOI => {
          if (otherPOI.id === poi.id || processedPOIs.has(otherPOI.id)) return false
          
          const dx = poi.x - otherPOI.x
          const dy = poi.y - otherPOI.y
          const distance = Math.sqrt(dx * dx + dy * dy)
          
          return distance <= groupingDistance
        })
        
        if (nearbyPOIs.length > 0) {
          // Create a group
          const group = [poi, ...nearbyPOIs]
          processedPOIs.add(poi.id)
          nearbyPOIs.forEach(p => processedPOIs.add(p.id))
          
          // Get unique types in the group
          const typeMap = new Map()
          group.forEach(p => {
            const type = p.type || 'other'
            if (!typeMap.has(type) || p.id === poi.id) {
              typeMap.set(type, p)
            }
          })
          
          // Calculate center position for the group
          const centerX = group.reduce((sum, p) => sum + p.x, 0) / group.length
          const centerY = group.reduce((sum, p) => sum + p.y, 0) / group.length
          
          // Create a group ID based on center position
          const groupId = `${Math.round(centerX)}_${Math.round(centerY)}`
          
          // Check if this group is expanded
          if (expandedGroups.value.has(groupId)) {
            // Show all POIs in the group in a circle around the center
            let angle = 0
            const radius = 30
            group.forEach(p => {
              groups.push({
                ...p,
                x: centerX + Math.cos(angle) * radius,
                y: centerY + Math.sin(angle) * radius,
                isInExpandedGroup: true,
                groupId: groupId
              })
              angle += (2 * Math.PI) / group.length
            })
          } else {
            // Add one POI of each type at the center position
            let offset = 0
            typeMap.forEach((representativePOI, type) => {
              const offsetAngle = (offset * 2 * Math.PI) / typeMap.size
              const offsetDistance = typeMap.size > 1 ? 15 : 0
              
              groups.push({
                ...representativePOI,
                x: centerX + Math.cos(offsetAngle) * offsetDistance,
                y: centerY + Math.sin(offsetAngle) * offsetDistance,
                isGrouped: true,
                groupSize: group.length,
                groupTypes: typeMap.size,
                groupId: groupId,
                groupedPOIs: group // Include all POIs in the group for tooltip
              })
              offset++
            })
          }
        } else {
          // Single POI, not grouped
          processedPOIs.add(poi.id)
          groups.push(poi)
        }
      })
      
      return groups
    }
    
    const render = () => {
      baseRender()
      
      if (!ctx.value || !image.value) return
      
      // Draw connections
      currentMapData.value.connections.forEach(connection => {
        const isDragging = draggedItem.value && draggedItem.value.id === connection.id
        const isPending = pendingChange.value && pendingChange.value.item.id === connection.id
        drawConnection(ctx.value, connection, isDragging || isPending)
      })
      
      // Draw zone connectors
      if (currentMapData.value.zoneConnectors) {
        currentMapData.value.zoneConnectors.forEach(zoneConnector => {
          // Only draw the "from" side on current map
          if (zoneConnector.from_map_id === maps.value[selectedMapIndex.value]?.id) {
            const connection = {
              id: zoneConnector.id,
              x: zoneConnector.from_x,
              y: zoneConnector.from_y,
              label: zoneConnector.from_label,
              icon: zoneConnector.from_icon,
              customIcon: zoneConnector.from_icon, // drawConnection looks for customIcon
              iconSize: zoneConnector.from_icon_size,
              labelVisible: zoneConnector.from_label_visible,
              labelPosition: zoneConnector.from_label_position,
              iconVisible: zoneConnector.from_icon_visible,
              targetMapId: zoneConnector.to_map_id,
              isZoneConnector: true
            }
            const isDragging = draggedItem.value && draggedItem.value.id === connection.id
            const isPending = pendingChange.value && pendingChange.value.item.id === connection.id
            drawConnection(ctx.value, connection, isDragging || isPending)
          }
        })
      }
      
      // Draw connectors
      if (currentMapData.value.connectors) {
        currentMapData.value.connectors.forEach(connector => {
          const isDragging = draggedItem.value && draggedItem.value.id === connector.id
          const isPending = pendingChange.value && pendingChange.value.item.id === connector.id
          drawConnector(ctx.value, connector, isDragging || isPending)
        })
      }
      
      // Group POIs when zoomed out
      const poisToDraw = groupPOIsWhenZoomedOut(currentMapData.value.pois)
      
      // Draw POIs
      poisToDraw.forEach(poi => {
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
      const map = maps.value[selectedMapIndex.value]
      if (!map) return
      
      isLoading.value = true
      selectedPOI.value = null
      try {
        // Load map image
        await loadImage(map.file)
        
        // If it's a database map, load its data
        if (map.id && !dbMapData.value[map.id]) {
          const mapData = await mapsAPI.getById(map.id)
          // Transform database connectors to the format expected by the UI
          const connectors = (mapData.pointConnectors || []).flatMap(pc => {
            // Create connector objects from each point_connector record
            const result = []
            
            // Always add the "from" connector
            result.push({
              id: `${pc.id}-from`,
              x: pc.from_x,
              y: pc.from_y,
              label: pc.from_label || (pc.name ? pc.name.split(' ↔ ')[0] : ''),
              icon: pc.from_icon,
              customIcon: pc.from_icon, // drawConnector looks for customIcon
              iconSize: pc.from_icon_size,
              labelVisible: pc.from_label_visible,
              labelPosition: pc.from_label_position,
              iconVisible: pc.from_icon_visible,
              showIcon: pc.from_icon_visible, // drawConnector checks showIcon
              invisible: !pc.from_label_visible, // for label visibility
              pairId: pc.id,
              dbId: pc.id,
              isFrom: true,
              connectsToPoi: pc.to_poi_id ? pc.to_poi_id : null
            })
            
            // Only add "to" connector if it's not connected to a POI
            if (!pc.to_poi_id) {
              result.push({
                id: `${pc.id}-to`,
                x: pc.to_x,
                y: pc.to_y,
                label: pc.to_label || (pc.name ? pc.name.split(' ↔ ')[1] : ''),
                icon: pc.to_icon,
                customIcon: pc.to_icon, // drawConnector looks for customIcon
                iconSize: pc.to_icon_size,
                labelVisible: pc.to_label_visible,
                labelPosition: pc.to_label_position,
                iconVisible: pc.to_icon_visible,
                showIcon: pc.to_icon_visible, // drawConnector checks showIcon
                invisible: !pc.to_label_visible, // for label visibility
                pairId: pc.id,
                dbId: pc.id,
                isFrom: false
              })
            }
            
            return result
          })
          
          dbMapData.value[map.id] = {
            pois: mapData.pois || [],
            connections: mapData.connections || [],
            connectors: connectors,
            zoneConnectors: mapData.zoneConnectors || []
          }
        }
        
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
        let clickedConnection = currentMapData.value.connections.find(conn =>
          isConnectionHit(conn, imagePos.x, imagePos.y)
        )
        
        // Also check zone connectors
        if (!clickedConnection && currentMapData.value.zoneConnectors) {
          const clickedZone = currentMapData.value.zoneConnectors.find(zone => {
            if (zone.from_map_id === maps.value[selectedMapIndex.value]?.id) {
              const conn = {
                x: zone.from_x,
                y: zone.from_y,
                icon: zone.from_icon,
                iconSize: zone.from_icon_size
              }
              return isConnectionHit(conn, imagePos.x, imagePos.y)
            }
            return false
          })
          
          if (clickedZone) {
            clickedConnection = {
              id: clickedZone.id,
              label: clickedZone.from_label,
              isZoneConnector: true
            }
          }
        }
        
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
      let clickedConnection = currentMapData.value.connections.find(conn =>
        isConnectionHit(conn, imagePos.x, imagePos.y)
      )
      
      // Check for zone connector
      let clickedZoneConnector = null
      
      // Also check zone connectors
      if (!clickedConnection && currentMapData.value.zoneConnectors) {
        const clickedZone = currentMapData.value.zoneConnectors.find(zone => {
          if (zone.from_map_id === maps.value[selectedMapIndex.value]?.id) {
            const conn = {
              x: zone.from_x,
              y: zone.from_y,
              icon: zone.from_icon,
              iconSize: zone.from_icon_size
            }
            return isConnectionHit(conn, imagePos.x, imagePos.y)
          }
          return false
        })
        
        if (clickedZone) {
          // Set clickedZoneConnector directly instead of clickedConnection
          clickedZoneConnector = {
            ...clickedZone,
            x: clickedZone.from_x,
            y: clickedZone.from_y,
            label: clickedZone.from_label,
            icon: clickedZone.from_icon,
            iconSize: clickedZone.from_icon_size,
            labelVisible: clickedZone.from_label_visible,
            labelPosition: clickedZone.from_label_position,
            iconVisible: clickedZone.from_icon_visible,
            isZoneConnector: true,
            targetMapId: clickedZone.to_map_id
          }
          // Also set clickedConnection for navigation
          clickedConnection = {
            targetMapId: clickedZone.to_map_id,
            label: clickedZone.from_label,
            x: clickedZone.from_x,
            y: clickedZone.from_y
          }
        }
      }
      
      // Check if this POI is also a connector point
      let isConnectorPOI = false
      let connectorAtPOI = null
      if (clickedPOI) {
        connectorAtPOI = currentMapData.value.connectors?.find(conn =>
          conn.poiId === clickedPOI.id || (conn.x === clickedPOI.x && conn.y === clickedPOI.y)
        )
        isConnectorPOI = !!connectorAtPOI
      }
      
      // clickedZoneConnector is already set above when checking zone connectors
      
      // In admin mode with Ctrl/Cmd held, show admin popup for settings
      if (isAdmin.value && (e.ctrlKey || e.metaKey) && (clickedPOI || clickedConnector || clickedConnection || clickedZoneConnector)) {
        const item = clickedPOI || clickedConnector || clickedZoneConnector || clickedConnection
        const itemType = clickedPOI ? 'poi' : (clickedConnector ? 'connector' : (clickedZoneConnector ? 'zoneConnector' : 'connection'))
        
        
        // Position admin popup near the clicked item
        const canvasPos = imageToCanvas(item.x, item.y)
        
        // Get icon size for better positioning
        const iconSize = item.iconSize || item.icon_size || 17
        const iconOffset = iconSize / 2
        
        // Popup dimensions - using conservative estimates
        const popupWidth = 340 // 320px + some padding/border
        const popupHeight = 650 // Very conservative to account for all content
        const margin = 30 // Larger margin from screen edges
        const spacing = 15 // Space between icon and popup
        
        // Get icon position on screen
        const iconScreenX = canvasPos.x + rect.left
        const iconScreenY = canvasPos.y + rect.top
        
        // Calculate available space in each direction
        const spaceRight = window.innerWidth - iconScreenX - iconOffset - spacing - margin
        const spaceLeft = iconScreenX - iconOffset - spacing - margin
        const spaceBelow = window.innerHeight - iconScreenY - iconOffset - spacing - margin
        const spaceAbove = iconScreenY - iconOffset - spacing - margin
        
        let popupX, popupY
        let side = 'right' // default
        
        // Try right first
        if (spaceRight >= popupWidth) {
          popupX = iconScreenX + iconOffset + spacing
          popupY = iconScreenY - popupHeight / 2 // Center vertically on icon
          side = 'right'
        }
        // Try left
        else if (spaceLeft >= popupWidth) {
          popupX = iconScreenX - iconOffset - popupWidth - spacing
          popupY = iconScreenY - popupHeight / 2 // Center vertically on icon
          side = 'left'
        }
        // Try below
        else if (spaceBelow >= popupHeight) {
          popupX = iconScreenX - popupWidth / 2 // Center horizontally on icon
          popupY = iconScreenY + iconOffset + spacing
          side = 'bottom'
        }
        // Try above
        else if (spaceAbove >= popupHeight) {
          popupX = iconScreenX - popupWidth / 2 // Center horizontally on icon
          popupY = iconScreenY - iconOffset - popupHeight - spacing
          side = 'top'
        }
        // If no perfect fit, position in the corner with most space
        else {
          // Find corner with most space
          if (spaceRight > spaceLeft) {
            popupX = window.innerWidth - popupWidth - margin
          } else {
            popupX = margin
          }
          
          if (spaceBelow > spaceAbove) {
            popupY = window.innerHeight - popupHeight - margin
          } else {
            popupY = margin
          }
          side = 'corner'
        }
        
        // Final bounds check to ensure popup is fully on screen
        popupX = Math.max(margin, Math.min(popupX, window.innerWidth - popupWidth - margin))
        popupY = Math.max(margin, Math.min(popupY, window.innerHeight - popupHeight - margin))
        
        // If centered vertically, ensure it doesn't go off top or bottom
        if (side === 'left' || side === 'right') {
          if (popupY < margin) {
            popupY = margin
          } else if (popupY + popupHeight > window.innerHeight - margin) {
            popupY = window.innerHeight - popupHeight - margin
          }
        }
        
        // If centered horizontally, ensure it doesn't go off left or right
        if (side === 'top' || side === 'bottom') {
          if (popupX < margin) {
            popupX = margin
          } else if (popupX + popupWidth > window.innerWidth - margin) {
            popupX = window.innerWidth - popupWidth - margin
          }
        }
        
        
        // Set the entire state at once
        
        // Set position first before showing popup
        adminPopupPosition.value = {
          x: popupX,
          y: popupY,
          side: side
        }
        
        // Then set item and type to show the popup
        
        adminPopupItem.value = item
        adminPopupType.value = itemType
        
        
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
        // Check if this connector connects to a POI
        if (clickedConnector.connectsToPoi) {
          // Find the POI it connects to
          const targetPoi = currentMapData.value.pois.find(poi => 
            poi.id === clickedConnector.connectsToPoi
          )
          
          if (targetPoi) {
            // Clear any existing arrow timeout
            if (arrowTimeoutId.value) {
              clearTimeout(arrowTimeoutId.value)
              arrowTimeoutId.value = null
            }
            
            // Show arrow pointing to POI
            activeConnectorArrow.value = {
              from: clickedConnector,
              to: targetPoi
            }
            // Navigate to the POI
            navigateToPOI(targetPoi)
          }
        } else {
          // Find the paired connector
          const pairedConnector = currentMapData.value.connectors.find(conn =>
            conn.pairId === clickedConnector.pairId && conn.id !== clickedConnector.id
          )
          
          // Arrow is now shown on hover, no need for click behavior
        }
        return
      }
      
      // Handle connection clicks
      if (clickedConnection) {
        // Navigate to connected map
        let targetMapIndex = -1
        
        if (clickedConnection.targetMapId) {
          // Zone connector - uses map ID
          targetMapIndex = maps.value.findIndex(map => map.id === clickedConnection.targetMapId)
        } else if (clickedConnection.targetMap) {
          // Old-style connection - uses filename
          targetMapIndex = maps.value.findIndex(map => 
            getMapFilename(map.file) === clickedConnection.targetMap
          )
        }
        
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
          poiId: clickedPOI.id,
          poiName: clickedPOI.name
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
        
        // Update in database
        try {
          if (pendingItem.type === 'poi') {
            await poisAPI.save({ ...item, label_position: newPosition })
          } else if (pendingItem.type === 'pointConnector') {
            await pointConnectorsAPI.save({ ...item })
          } else if (pendingItem.type === 'zoneConnector') {
            await zoneConnectorsAPI.save({ ...item })
          }
          render()
          success(`Label position changed to ${newPosition}`)
        } catch (err) {
          error(`Failed to update label position: ${err.message || 'Database error'}`)
          warning('Please check your internet connection and try again')
        }
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
      
      // Check for zone connector hover
      let hoveredZoneConnector = null
      if (currentMapData.value.zoneConnectors) {
        hoveredZoneConnector = currentMapData.value.zoneConnectors.find(zone => {
          if (zone.from_map_id === maps.value[selectedMapIndex.value]?.id) {
            const conn = {
              x: zone.from_x,
              y: zone.from_y,
              icon: zone.from_icon,
              iconSize: zone.from_icon_size
            }
            return isConnectionHit(conn, imagePos.x, imagePos.y)
          }
          return false
        })
      }
      
      // Set zone connector as hovered connection for highlighting
      if (hoveredZoneConnector && !hoveredConnection.value) {
        // Create a temporary connection object for rendering
        hoveredConnection.value = {
          id: hoveredZoneConnector.id,
          x: hoveredZoneConnector.from_x,
          y: hoveredZoneConnector.from_y,
          label: hoveredZoneConnector.from_label,
          icon: hoveredZoneConnector.from_icon,
          customIcon: hoveredZoneConnector.from_icon,
          iconSize: hoveredZoneConnector.from_icon_size,
          targetMapId: hoveredZoneConnector.to_map_id,
          isZoneConnector: true
        }
      }
      
      hoveredConnector.value = currentMapData.value.connectors?.find(conn =>
        isConnectorHit(conn, imagePos.x, imagePos.y)
      )
      
      // Show arrow when hovering over point connector
      if (hoveredConnector.value) {
        // Find the paired connector
        const pairedConnector = currentMapData.value.connectors.find(conn =>
          conn.pairId === hoveredConnector.value.pairId && conn.id !== hoveredConnector.value.id
        )
        
        if (pairedConnector) {
          activeConnectorArrow.value = {
            from: hoveredConnector.value,
            to: pairedConnector
          }
        }
      } else if (!hoveredConnector.value && activeConnectorArrow.value) {
        // Clear arrow when no longer hovering, but only if we're not in a timeout period
        if (!arrowTimeoutId.value) {
          activeConnectorArrow.value = null
        }
      }
      
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
    
    const navigateToPOI = (poi) => {
      if (!mapCanvas.value || !poi) return
      
      const targetCanvasPos = imageToCanvas(poi.x, poi.y)
      const centerX = mapCanvas.value.width / 2
      const centerY = mapCanvas.value.height / 2
      
      // Calculate the offset needed to center the POI
      const targetOffsetX = centerX - poi.x * scale.value
      const targetOffsetY = centerY - poi.y * scale.value
      
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
          // Auto-hide arrow after navigation
          arrowTimeoutId.value = setTimeout(() => {
            activeConnectorArrow.value = null
          }, 2000)
        }
      }
      
      requestAnimationFrame(animate)
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
    
    const toggleAdmin = async () => {
      if (!isAdmin.value) {
        const password = prompt('Enter admin password:')
        if (!password) return
        
        // First try client-side password (for development)
        const expectedPassword = import.meta.env.VITE_ADMIN_PASSWORD
        
        if (expectedPassword) {
          // Development mode - check password client-side
          if (password === expectedPassword) {
            isAdmin.value = true
            localStorage.setItem('isAdmin', 'true')
            success('Admin mode activated')
          } else {
            error('Incorrect password')
          }
        } else {
          // Production mode - verify with server
          try {
            const response = await fetch('/api/admin/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ password })
            })
            
            const result = await response.json()
            
            if (response.ok && result.valid) {
              isAdmin.value = true
              localStorage.setItem('isAdmin', 'true')
              success('Admin mode activated')
            } else {
              error('Incorrect password')
            }
          } catch (err) {
            error('Failed to verify admin password')
            console.error('Admin verification error:', err)
          }
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
    
    const savePOI = async (poiData) => {
      if (!pendingPOI.value) return
      
      const map = maps.value[selectedMapIndex.value]
      
      if (!map.id) {
        error('Cannot save POI: Map is not connected to database')
        return
      }
      
      try {
        const newPOI = await poisAPI.save({
          map_id: map.id,
          x: Math.round(pendingPOI.value.x),
          y: Math.round(pendingPOI.value.y),
          name: poiData.name,
          description: poiData.description || '',
          type: poiData.type || 'landmark',
          icon: null, // Let the type determine the icon
          icon_size: 48,
          label_visible: true,
          label_position: 'bottom'
        })
        
        // Update local cache
        if (!dbMapData.value[map.id]) {
          dbMapData.value[map.id] = { pois: [], connections: [], connectors: [] }
        }
        dbMapData.value[map.id].pois.push(newPOI)
        
        pendingPOI.value = null
        render()
        success(`POI "${poiData.name}" created successfully`)
      } catch (err) {
        console.error('Failed to save POI:', err)
        error(`Failed to save POI: ${err.message || 'Database error'}`)
        warning('Please check your internet connection and try again')
      }
    }
    
    const saveConnection = async (connectionData) => {
      if (!pendingConnection.value) return
      
      const map = maps.value[selectedMapIndex.value]
      
      if (!map.id) {
        error('Cannot save connection: Map is not connected to database')
        return
      }
      
      try {
        // This is a zone connector (connection to another map)
        const newConnection = await zoneConnectorsAPI.save({
          from_map_id: map.id,
          to_map_id: connectionData.targetMapId,
          from_x: Math.round(pendingConnection.value.x),
          from_y: Math.round(pendingConnection.value.y),
          to_x: Math.round(pendingConnection.value.x), // Default to same position, will be updated on target map
          to_y: Math.round(pendingConnection.value.y),
          from_icon: '🌀',
          to_icon: '🌀',
          from_icon_size: 30,
          to_icon_size: 30,
          from_label: connectionData.label,
          to_label: connectionData.label,
          from_label_visible: true,
          to_label_visible: true,
          from_label_position: 'bottom',
          to_label_position: 'bottom',
          from_icon_visible: true,
          to_icon_visible: true
        })
        
        // Update local cache
        if (!dbMapData.value[map.id]) {
          dbMapData.value[map.id] = { pois: [], connections: [], connectors: [], zoneConnectors: [] }
        }
        if (!dbMapData.value[map.id].zoneConnectors) {
          dbMapData.value[map.id].zoneConnectors = []
        }
        dbMapData.value[map.id].zoneConnectors.push(newConnection)
        
        pendingConnection.value = null
        render()
        success(`Connection "${connectionData.label}" created successfully`)
      } catch (err) {
        console.error('Failed to save connection:', err)
        error(`Failed to save connection: ${err.message || 'Database error'}`)
        warning('Please check your internet connection and try again')
      }
    }
    
    const cancelPOI = () => {
      pendingPOI.value = null
    }
    
    const cancelConnection = () => {
      pendingConnection.value = null
    }
    
    const saveConnector = async (connectorData) => {
      if (!pendingConnector.value) return
      
      const map = maps.value[selectedMapIndex.value]
      
      if (!map.id) {
        error('Cannot save connector: Map is not connected to database')
        pendingConnector.value = null
        pendingConnectorPair.value = { first: null, second: null }
        return
      }
      
      try {
        if (!pendingConnectorPair.value.first) {
          // This is the first connector of the pair
          const firstConnectorData = {
            x: pendingConnector.value.x,
            y: pendingConnector.value.y,
            label: connectorData.label,
            invisibleLabel: connectorData.invisibleLabel || false,
            invisibleIcon: connectorData.invisibleIcon || false,
            icon: connectorData.icon || '🔗',
            iconSize: connectorData.iconSize || 14,
            labelPosition: connectorData.labelPosition || 'bottom'
          }
          
          pendingConnectorPair.value.first = firstConnectorData
          pendingConnector.value = null
          
          // Reset view to show full map
          reset(mapCanvas.value)
          render()
        } else {
          // This is the second connector, complete the pair
          const firstData = pendingConnectorPair.value.first
          
          // Check if second point is a POI
          let toPoiId = null
          let toX = pendingConnector.value.x
          let toY = pendingConnector.value.y
          let secondLabel = connectorData.label
          
          if (pendingConnector.value.poiId) {
            // Connecting to a POI
            toPoiId = pendingConnector.value.poiId
            toX = null
            toY = null
            // Get POI name for the label
            const poi = currentMapData.value.pois.find(p => p.id === pendingConnector.value.poiId)
            if (poi) {
              secondLabel = poi.name
            }
          }
          
          const newConnectorData = {
            map_id: map.id,
            name: `${firstData.label} ↔ ${secondLabel}`,
            from_x: Math.round(firstData.x),
            from_y: Math.round(firstData.y),
            to_x: toX !== null ? Math.round(toX) : null,
            to_y: toY !== null ? Math.round(toY) : null,
            to_poi_id: toPoiId,
            from_icon: firstData.icon || '🔗',
            to_icon: connectorData.icon || '🔗',
            from_icon_size: firstData.iconSize || 14,
            to_icon_size: connectorData.iconSize || 14,
            from_label_visible: !firstData.invisibleLabel,
            to_label_visible: !(connectorData.invisibleLabel || false),
            from_label_position: firstData.labelPosition || 'bottom',
            to_label_position: connectorData.labelPosition || 'bottom',
            from_icon_visible: !firstData.invisibleIcon,
            to_icon_visible: !(connectorData.invisibleIcon || false)
          }
          
          const newConnector = await pointConnectorsAPI.save(newConnectorData)
          
          
          // Transform the saved connector to UI format before adding to cache
          const uiConnectors = []
          
          // Add "from" connector
          uiConnectors.push({
            id: `${newConnector.id}-from`,
            x: newConnector.from_x,
            y: newConnector.from_y,
            label: newConnector.name ? newConnector.name.split(' ↔ ')[0] : '',
            icon: newConnector.from_icon,
            customIcon: newConnector.from_icon,
            iconSize: newConnector.from_icon_size,
            labelVisible: newConnector.from_label_visible,
            labelPosition: newConnector.from_label_position,
            iconVisible: newConnector.from_icon_visible,
            showIcon: newConnector.from_icon_visible,
            invisible: !newConnector.from_label_visible,
            pairId: newConnector.id,
            dbId: newConnector.id,
            isFrom: true,
            connectsToPoi: newConnector.to_poi_id ? newConnector.to_poi_id : null
          })
          
          // Only add "to" connector if it's not connected to a POI
          if (!newConnector.to_poi_id) {
            uiConnectors.push({
              id: `${newConnector.id}-to`,
              x: newConnector.to_x,
              y: newConnector.to_y,
              label: newConnector.name ? newConnector.name.split(' ↔ ')[1] : '',
              icon: newConnector.to_icon,
              customIcon: newConnector.to_icon,
              iconSize: newConnector.to_icon_size,
              labelVisible: newConnector.to_label_visible,
              labelPosition: newConnector.to_label_position,
              iconVisible: newConnector.to_icon_visible,
              showIcon: newConnector.to_icon_visible,
              invisible: !newConnector.to_label_visible,
              pairId: newConnector.id,
              dbId: newConnector.id,
              isFrom: false
            })
          }
          
          // Update local cache
          if (!dbMapData.value[map.id]) {
            dbMapData.value[map.id] = { pois: [], connections: [], connectors: [] }
          }
          dbMapData.value[map.id].connectors.push(...uiConnectors)
          
          pendingConnectorPair.value = { first: null, second: null }
          pendingConnector.value = null
          render()
          success(`Connector pair "${firstData.label}" ↔ "${secondLabel}" created successfully`)
        }
      } catch (err) {
        console.error('Failed to save connector:', err)
        error(`Failed to save connector: ${err.message || 'Database error'}`)
        warning('Please check your internet connection and try again')
        // Reset the connector state on error
        pendingConnector.value = null
        pendingConnectorPair.value = { first: null, second: null }
      }
    }
    
    const cancelConnector = () => {
      pendingConnector.value = null
      if (pendingConnectorPair.value.first) {
        pendingConnectorPair.value = { first: null, second: null }
      }
    }
    
    const deletePOI = async (poiId) => {
      const map = maps.value[selectedMapIndex.value]
      
      if (!map.id || !dbMapData.value[map.id]) {
        error('Cannot delete POI: Map is not connected to database')
        return
      }
      
      try {
        const poi = dbMapData.value[map.id].pois.find(p => p.id === poiId)
        
        await poisAPI.delete(poiId)
        
        // Update local cache
        dbMapData.value[map.id].pois = dbMapData.value[map.id].pois.filter(p => p.id !== poiId)
        
        // Clear selected POI if it's the one being deleted
        if (selectedPOI.value && selectedPOI.value.id === poiId) {
          selectedPOI.value = null
        }
        render()
        if (poi) {
          success(`POI "${poi.name}" deleted successfully`)
        }
      } catch (err) {
        console.error('Failed to delete POI:', err)
        error(`Failed to delete POI: ${err.message || 'Database error'}`)
        warning('Please check your internet connection and try again')
      }
    }
    
    const handleAdminPopupUpdate = async (updatedItem) => {
      const map = maps.value[selectedMapIndex.value]
      
      if (!map.id || !dbMapData.value[map.id]) {
        error('Cannot update: Map is not connected to database')
        return
      }
      
      try {
        if (adminPopupType.value === 'poi') {
          // Update POI in database with all custom fields
          const updatedPOI = await poisAPI.save(updatedItem)
          
          // Update local cache
          const poiIndex = dbMapData.value[map.id].pois.findIndex(p => p.id === updatedItem.id)
          if (poiIndex !== -1) {
            dbMapData.value[map.id].pois[poiIndex] = updatedPOI
          }
        } else if (adminPopupType.value === 'connection' || adminPopupType.value === 'zoneConnector') {
          // Update zone connector in database
          // Transform the data to match zone connector API format
          
          const zoneData = {
            id: updatedItem.id,
            from_map_id: updatedItem.from_map_id || map.id,
            to_map_id: updatedItem.to_map_id || updatedItem.targetMapId,
            from_x: Math.round(updatedItem.from_x || updatedItem.x || 0),
            from_y: Math.round(updatedItem.from_y || updatedItem.y || 0),
            to_x: Math.round(updatedItem.to_x || updatedItem.x || 0),
            to_y: Math.round(updatedItem.to_y || updatedItem.y || 0),
            from_icon: updatedItem.customIcon || updatedItem.from_icon || updatedItem.icon || '🌀',
            to_icon: updatedItem.to_icon || '🌀',
            from_icon_size: updatedItem.iconScale ? Math.round(updatedItem.iconScale * 30) : (updatedItem.from_icon_size || 30),
            to_icon_size: updatedItem.to_icon_size || 30,
            from_label: updatedItem.from_label || updatedItem.label || '',
            to_label: updatedItem.to_label || '',
            from_label_visible: updatedItem.from_label_visible !== false,
            to_label_visible: updatedItem.to_label_visible !== false,
            from_label_position: updatedItem.labelPosition || updatedItem.from_label_position || 'bottom',
            to_label_position: updatedItem.to_label_position || 'bottom',
            from_icon_visible: updatedItem.from_icon_visible !== false,
            to_icon_visible: updatedItem.to_icon_visible !== false
          }
          
          // Validate required fields
          if (!zoneData.id || !zoneData.from_map_id || !zoneData.to_map_id) {
            console.error('Missing required fields:', { 
              id: zoneData.id, 
              from_map_id: zoneData.from_map_id, 
              to_map_id: zoneData.to_map_id 
            })
            throw new Error('Missing required fields for zone connector update')
          }
          
          
          const updatedConnection = await zoneConnectorsAPI.save(zoneData)
          
          // Update local cache
          const connIndex = dbMapData.value[map.id].zoneConnectors?.findIndex(c => c.id === updatedItem.id)
          
          if (connIndex !== -1 && dbMapData.value[map.id].zoneConnectors) {
            // Use Vue's reactivity system to ensure the update is detected
            const zoneConnectors = [...dbMapData.value[map.id].zoneConnectors]
            zoneConnectors[connIndex] = updatedConnection
            dbMapData.value[map.id].zoneConnectors = zoneConnectors
          } else {
            console.error('Failed to update zone connector in cache - not found')
          }
        } else if (adminPopupType.value === 'connector') {
          // Update point connector in database
          const dbId = updatedItem.dbId || updatedItem.pairId
          if (!dbId) {
            throw new Error('No database ID found for connector')
          }
          
          // Fetch the complete connector data from the database
          const mapData = await mapsAPI.getById(map.id)
          const pointConnectors = mapData.pointConnectors || []
          const dbConnector = pointConnectors.find(pc => pc.id === dbId)
          
          if (!dbConnector) {
            throw new Error('Connector not found in database')
          }
          
          // Determine which side of the connector we're updating
          const isFromSide = updatedItem.isFrom
          
          // Update the appropriate fields based on which side was edited
          const connectorToUpdate = {
            ...dbConnector,
            id: dbId
          }
          
          if (updatedItem.customIcon !== undefined) {
            if (isFromSide) {
              connectorToUpdate.from_icon = updatedItem.customIcon || updatedItem.icon
            } else {
              connectorToUpdate.to_icon = updatedItem.customIcon || updatedItem.icon
            }
          }
          
          if (updatedItem.labelPosition !== undefined) {
            if (isFromSide) {
              connectorToUpdate.from_label_position = updatedItem.labelPosition
            } else {
              connectorToUpdate.to_label_position = updatedItem.labelPosition
            }
          }
          
          if (updatedItem.iconSize !== undefined) {
            if (isFromSide) {
              connectorToUpdate.from_icon_size = updatedItem.iconSize
            } else {
              connectorToUpdate.to_icon_size = updatedItem.iconSize
            }
          }
          
          const updatedConnector = await pointConnectorsAPI.save(connectorToUpdate)
          
          // Update local cache - need to transform the saved connector back to UI format
          const connectors = dbMapData.value[map.id].connectors
          const connIndex = connectors.findIndex(c => c.id === updatedItem.id)
          
          if (connIndex !== -1) {
            // Update the specific connector that was edited
            const uiConnector = connectors[connIndex]
            
            if (isFromSide) {
              uiConnector.icon = updatedConnector.from_icon
              uiConnector.customIcon = updatedConnector.from_icon
              uiConnector.iconSize = updatedConnector.from_icon_size
              uiConnector.labelPosition = updatedConnector.from_label_position
            } else {
              uiConnector.icon = updatedConnector.to_icon
              uiConnector.customIcon = updatedConnector.to_icon
              uiConnector.iconSize = updatedConnector.to_icon_size
              uiConnector.labelPosition = updatedConnector.to_label_position
            }
            
            // Update the array to trigger reactivity
            dbMapData.value[map.id].connectors = [...connectors]
          }
        }
        
        render()
        success('Settings updated successfully')
      } catch (err) {
        console.error('Failed to update settings:', err)
        error(`Failed to update settings: ${err.message || 'Database error'}`)
        warning('Please check your internet connection and try again')
      }
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
        // Arrow is now shown on hover, no need for activate behavior
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
        const map = maps.value[selectedMapIndex.value]
        
        if (!map.id || !dbMapData.value[map.id]) {
          error('Cannot update POI: Map is not connected to database')
          return
        }
        
        try {
          const poiToUpdate = dbMapData.value[map.id].pois.find(p => p.id === id)
          if (poiToUpdate) {
            // Update in database
            const updatedPOI = await poisAPI.save({
              ...poiToUpdate,
              [field]: newValue
            })
            
            // Update local cache
            const poiIndex = dbMapData.value[map.id].pois.findIndex(p => p.id === id)
            if (poiIndex !== -1) {
              dbMapData.value[map.id].pois[poiIndex] = updatedPOI
            }
            
            // Update selectedPOI to reflect the change
            if (selectedPOI.value && selectedPOI.value.id === id) {
              selectedPOI.value = { ...selectedPOI.value, [field]: newValue }
            }
            
            render()
            success(`POI ${field} updated successfully`)
          }
        } catch (err) {
          console.error('Failed to update POI:', err)
          error(`Failed to update POI: ${err.message || 'Database error'}`)
          warning('Please check your internet connection and try again')
        }
      }
    }
    
    const deleteConnection = async (connectionId) => {
      const map = maps.value[selectedMapIndex.value]
      
      if (!map.id || !dbMapData.value[map.id]) {
        error('Cannot delete connection: Map is not connected to database')
        return
      }
      
      try {
        // For zone connectors
        const connection = dbMapData.value[map.id].zoneConnectors?.find(c => c.id === connectionId)
        
        if (connection) {
          await zoneConnectorsAPI.delete(connectionId)
          
          // Update local cache
          if (dbMapData.value[map.id].zoneConnectors) {
            dbMapData.value[map.id].zoneConnectors = dbMapData.value[map.id].zoneConnectors.filter(c => c.id !== connectionId)
          }
          
          render()
          success(`Connection "${connection.from_label}" deleted successfully`)
        }
      } catch (err) {
        console.error('Failed to delete connection:', err)
        error(`Failed to delete connection: ${err.message || 'Database error'}`)
        warning('Please check your internet connection and try again')
      }
    }
    
    const deleteConnector = async (connectorId) => {
      const map = maps.value[selectedMapIndex.value]
      
      if (!map.id || !dbMapData.value[map.id]) {
        error('Cannot delete connector: Map is not connected to database')
        return
      }
      
      try {
        const connector = dbMapData.value[map.id].connectors?.find(c => c.id === connectorId)
        if (connector) {
          // For database connectors, we need to delete the actual database record
          const dbId = connector.dbId || connector.pairId
          
          await pointConnectorsAPI.delete(dbId)
          
          // Update local cache - remove both connectors that share the same dbId/pairId
          if (dbMapData.value[map.id].connectors) {
            const pairId = connector.pairId || connector.dbId
            dbMapData.value[map.id].connectors = dbMapData.value[map.id].connectors.filter(c => 
              (c.pairId !== pairId && c.dbId !== pairId)
            )
          }
          
          render()
          success(`Connector deleted successfully`)
        }
      } catch (err) {
        console.error('Failed to delete connector:', err)
        error(`Failed to delete connector: ${err.message || 'Database error'}`)
        warning('Please check your internet connection and try again')
      }
    }
    
    const confirmPendingChange = async () => {
      if (!pendingChange.value) return
      
      const map = maps.value[selectedMapIndex.value]
      const itemType = pendingChange.value.type === 'poi' ? 'POI' : 
                      pendingChange.value.type === 'connection' ? 'Connection' : 'Connector'
      const itemName = pendingChange.value.item.name || pendingChange.value.item.label
      
      if (!map.id || !dbMapData.value[map.id]) {
        error('Cannot move item: Map is not connected to database')
        cancelPendingChange()
        return
      }
      
      try {
        if (pendingChange.value.type === 'poi') {
          // Update POI position in database
          await poisAPI.save({
            ...pendingChange.value.item,
            x: Math.round(pendingChange.value.newPosition.x),
            y: Math.round(pendingChange.value.newPosition.y)
          })
        } else if (pendingChange.value.type === 'connector') {
          // Update connector position in database
          const connector = pendingChange.value.item
          if (connector.dbId || connector.pairId) {
            // We need to get the full point connector data from the server
            // First, load the current map data to get all connectors
            const mapData = await mapsAPI.getById(map.id)
            const pointConnectors = mapData.pointConnectors || []
            
            // Find the point connector by id
            const dbConnector = pointConnectors.find(pc => pc.id === (connector.dbId || connector.pairId))
            
            if (dbConnector) {
              // Create complete update data with all required fields
              const updateData = {
                id: dbConnector.id,
                map_id: dbConnector.map_id,
                name: dbConnector.name,
                from_x: dbConnector.from_x,
                from_y: dbConnector.from_y,
                to_x: dbConnector.to_x,
                to_y: dbConnector.to_y,
                to_poi_id: dbConnector.to_poi_id,
                from_icon: dbConnector.from_icon,
                to_icon: dbConnector.to_icon,
                from_icon_size: dbConnector.from_icon_size,
                to_icon_size: dbConnector.to_icon_size,
                from_label_visible: dbConnector.from_label_visible,
                to_label_visible: dbConnector.to_label_visible,
                from_label_position: dbConnector.from_label_position,
                to_label_position: dbConnector.to_label_position,
                from_icon_visible: dbConnector.from_icon_visible,
                to_icon_visible: dbConnector.to_icon_visible
              }
              
              // Update the appropriate position
              if (connector.isFrom) {
                updateData.from_x = Math.round(pendingChange.value.newPosition.x)
                updateData.from_y = Math.round(pendingChange.value.newPosition.y)
              } else {
                updateData.to_x = Math.round(pendingChange.value.newPosition.x)
                updateData.to_y = Math.round(pendingChange.value.newPosition.y)
              }
              
              // Save the updated connector
              const updatedConnector = await pointConnectorsAPI.save(updateData)
              
              // Update local cache with the updated connector
              const connectors = [updatedConnector].flatMap(pc => {
                const result = []
                result.push({
                  id: `${pc.id}-from`,
                  x: pc.from_x,
                  y: pc.from_y,
                  label: pc.from_label || (pc.name ? pc.name.split(' ↔ ')[0] : ''),
                  icon: pc.from_icon,
                  customIcon: pc.from_icon,
                  iconSize: pc.from_icon_size,
                  labelVisible: pc.from_label_visible,
                  labelPosition: pc.from_label_position,
                  iconVisible: pc.from_icon_visible,
                  showIcon: pc.from_icon_visible,
                  invisible: !pc.from_label_visible,
                  pairId: pc.id,
                  dbId: pc.id,
                  isFrom: true,
                  connectsToPoi: pc.to_poi_id ? pc.to_poi_id : null
                })
                
                if (!pc.to_poi_id) {
                  result.push({
                    id: `${pc.id}-to`,
                    x: pc.to_x,
                    y: pc.to_y,
                    label: pc.to_label || (pc.name ? pc.name.split(' ↔ ')[1] : ''),
                    icon: pc.to_icon,
                    customIcon: pc.to_icon,
                    iconSize: pc.to_icon_size,
                    labelVisible: pc.to_label_visible,
                    labelPosition: pc.to_label_position,
                    iconVisible: pc.to_icon_visible,
                    showIcon: pc.to_icon_visible,
                    invisible: !pc.to_label_visible,
                    pairId: pc.id,
                    dbId: pc.id,
                    isFrom: false
                  })
                }
                
                return result
              })
              
              // Update the specific connector in the cache
              if (dbMapData.value[map.id]) {
                const idx = dbMapData.value[map.id].connectors.findIndex(c => 
                  c.pairId === updatedConnector.id && c.isFrom === connector.isFrom
                )
                if (idx !== -1) {
                  const newConnector = connectors.find(c => 
                    c.pairId === updatedConnector.id && c.isFrom === connector.isFrom
                  )
                  if (newConnector) {
                    dbMapData.value[map.id].connectors[idx] = newConnector
                  }
                }
              }
            } else {
              throw new Error('Connector not found in database')
            }
          }
        } else if (pendingChange.value.type === 'connection') {
          // Update zone connector position in database
          const connection = pendingChange.value.item
          await zoneConnectorsAPI.save({
            ...connection,
            from_x: pendingChange.value.newPosition.x,
            from_y: pendingChange.value.newPosition.y
          })
        }
        
        pendingChange.value = null
        render()
        success(`${itemType} "${itemName}" moved successfully`)
      } catch (err) {
        console.error('Failed to save position change:', err)
        error(`Failed to save position change: ${err.message || 'Database error'}`)
        warning('Please check your internet connection and try again')
        // Revert the change
        cancelPendingChange()
      }
    }
    
    const handleUpdateMaps = async (action) => {
      const { type, data } = action
      
      try {
        switch (type) {
          case 'add': {
            // Create new map in database
            const newMap = await mapsAPI.save({
              name: data.name,
              image_url: data.image_url,
              width: data.width || 1000,
              height: data.height || 1000,
              display_order: maps.value.length
            })
            
            // Add to local array
            maps.value.push({
              id: newMap.id,
              name: newMap.name,
              file: newMap.image_url,
              width: newMap.width,
              height: newMap.height
            })
            
            // Select and load the new map
            selectedMapIndex.value = maps.value.length - 1
            await loadSelectedMap()
            
            success(`Map "${newMap.name}" added successfully`)
            break
          }
          
          case 'update': {
            // Update map in database
            const updatedMap = await mapsAPI.save({
              id: data.id,
              name: data.name,
              image_url: data.image_url,
              width: data.width,
              height: data.height,
              display_order: data.display_order
            })
            
            // Update local array
            const index = maps.value.findIndex(m => m.id === data.id)
            if (index !== -1) {
              maps.value[index] = {
                id: updatedMap.id,
                name: updatedMap.name,
                file: updatedMap.image_url,
                width: updatedMap.width,
                height: updatedMap.height
              }
            }
            
            success(`Map "${updatedMap.name}" updated successfully`)
            break
          }
          
          case 'delete': {
            // Delete from database
            await mapsAPI.delete(data.id)
            
            // Remove from local array
            const index = maps.value.findIndex(m => m.id === data.id)
            if (index !== -1) {
              const deletedMap = maps.value[index]
              maps.value.splice(index, 1)
              
              // Clear cached data
              delete dbMapData.value[data.id]
              
              // If the current map was deleted, switch to the first map
              if (selectedMapIndex.value === index) {
                selectedMapIndex.value = 0
                if (maps.value.length > 0) {
                  await loadSelectedMap()
                }
              } else if (selectedMapIndex.value > index) {
                selectedMapIndex.value--
              }
              
              success(`Map "${deletedMap.name}" deleted successfully`)
            }
            break
          }
          
          case 'reorder': {
            // Update display order for all maps - only send minimal data
            const updates = data.maps.map((map, index) => {
              // Only send id and display_order to avoid sending large image data
              return mapsAPI.save({
                id: map.id,
                name: map.name,
                width: map.width,
                height: map.height,
                display_order: index
                // Explicitly NOT sending image_url to avoid payload size issues
              })
            })
            
            try {
              await Promise.all(updates)
              
              // Reload maps from database to ensure correct order
              const reorderedMaps = await mapsAPI.getAll()
              
              // Update local array with the reordered maps
              maps.value = reorderedMaps.map(m => ({
                id: m.id,
                name: m.name,
                file: m.image_url,
                width: m.width,
                height: m.height
              }))
              
              success('Map order updated successfully')
            } catch (updateError) {
              console.error('Failed to update map order:', updateError)
              error('Failed to update map order')
            }
            break
          }
        }
      } catch (err) {
        console.error('Failed to update maps:', err)
        if (err.message && err.message.includes('413')) {
          error('Map image is too large. Please use a smaller image file.')
        } else {
          error(`Failed to ${type} map: ${err.message || 'Unknown error'}`)
        }
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
    
    // Debug admin popup position
    watch(adminPopupPosition, (newVal) => {
    }, { deep: true })
    
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
      
      // Load maps from database
      maps.value = await loadMapsFromDatabase()
      
      initCanvas(mapCanvas.value)
      resizeCanvas()
      window.addEventListener('resize', resizeCanvas)
      window.addEventListener('keydown', handleKeyboardShortcut)
      
      // Load the first map if available
      if (maps.value.length > 0) {
        await loadSelectedMap()
      }
      
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
      dbMapData,
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