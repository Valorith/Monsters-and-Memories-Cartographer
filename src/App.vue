<template>
  <div class="app-container">
    <header class="app-header">
      <div class="logo-container" @click="reloadApp" title="Return to home">
        <svg class="mmc-logo" width="50" height="50" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <!-- Fantasy map-inspired logo -->
          <defs>
            <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:#FFD700;stop-opacity:1" />
              <stop offset="50%" style="stop-color:#FFA500;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#FF8C00;stop-opacity:1" />
            </linearGradient>
            <filter id="shadow">
              <feDropShadow dx="2" dy="2" stdDeviation="2" flood-opacity="0.3"/>
            </filter>
          </defs>
          
          <!-- Compass rose background -->
          <circle cx="50" cy="50" r="45" fill="url(#goldGradient)" filter="url(#shadow)"/>
          <circle cx="50" cy="50" r="40" fill="#2C1810" />
          
          <!-- M letters forming mountains -->
          <path d="M 20 65 L 30 35 L 40 55 L 50 35 L 60 55 L 70 35 L 80 65" 
                stroke="url(#goldGradient)" 
                stroke-width="4" 
                fill="none" 
                stroke-linejoin="round" 
                stroke-linecap="round"/>
          
          <!-- C as a crescent moon -->
          <path d="M 65 70 A 15 15 0 1 1 35 70 A 12 12 0 1 0 65 70" 
                fill="url(#goldGradient)" />
          
          <!-- Compass points -->
          <path d="M 50 10 L 55 20 L 50 15 L 45 20 Z" fill="#FFD700" opacity="0.8"/>
          <path d="M 90 50 L 80 55 L 85 50 L 80 45 Z" fill="#FFD700" opacity="0.8"/>
          <path d="M 50 90 L 45 80 L 50 85 L 55 80 Z" fill="#FFD700" opacity="0.8"/>
          <path d="M 10 50 L 20 45 L 15 50 L 20 55 Z" fill="#FFD700" opacity="0.8"/>
        </svg>
      </div>
      <h1 class="app-title">Monsters & Memories Cartographer</h1>
      <div class="header-controls">
        <div class="map-selector">
          <label for="mapSelect">Select Map:</label>
          <select id="mapSelect" v-model="selectedMapIndex" @change="loadSelectedMap">
            <option v-for="(map, index) in maps" :key="index" :value="index">
              {{ map.name }}
            </option>
          </select>
        </div>
        <div v-if="user && user.is_admin" class="admin-toggle">
          <button @click="toggleAdmin" class="admin-toggle-button" :class="{ active: isAdmin }">
            <span class="admin-icon">👑</span>
            <span class="admin-text">Admin Mode</span>
            <span class="toggle-indicator" :class="{ on: isAdmin }"></span>
          </button>
        </div>
        <div v-if="isAdmin" class="admin-indicator" title="Admin Mode Active">
          <span class="admin-dot"></span>
          <span class="admin-text">Active</span>
        </div>
        <div class="user-controls">
          <button v-if="!isAuthenticated" @click="loginWithGoogle" class="login-button">
            Sign In
          </button>
          <div v-else class="user-dropdown-container">
            <button @click="toggleUserDropdown" class="user-button">
              <img v-if="user && user.picture" :src="user.picture" :alt="user.displayName || user.name" class="user-avatar" @error="handleAvatarError" />
              <span v-else class="user-initials">{{ user && user.displayName ? user.displayName[0] : (user && user.name ? user.name[0] : '?') }}</span>
            </button>
            <div v-if="showUserDropdown" class="user-dropdown-menu">
              <a href="/account" class="dropdown-item">
                <span class="dropdown-icon">👤</span>
                Account
              </a>
              <button @click="handleLogout" class="dropdown-item">
                <span class="dropdown-icon">🚪</span>
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
    
    <XPBar :user="user" v-if="isAuthenticated && !loading" />
    
    <div class="poi-search-section">
      <POISearch
        :all-pois="allSearchablePOIs"
        :current-map-id="currentMapId"
        :maps="maps"
        @select-poi="handlePOISelected"
        @select-item="handleItemSelected"
        @select-npc="handleNPCSelected"
      />
    </div>
    
    <div class="map-container" ref="mapContainer" @click="handleMapClick" @contextmenu.prevent="handleContextMenu" @click.capture="hideContextMenu">
      <canvas 
        ref="mapCanvas"
        class="map-canvas"
        :class="{ 'admin-cursor': isAdmin && !isDragging }"
        tabindex="0"
        @mousedown="handleMouseDown"
        @mousemove="handleMouseMove"
        @mouseup="handleMouseUp"
        @mouseleave="handleMouseUp"
        @wheel.prevent="handleWheel"
        @touchstart="handleTouchStart"
        @touchmove.prevent="handleTouchMove"
        @touchend="handleTouchEnd"
      ></canvas>
      
      <div class="loading-overlay" v-if="isLoading || isTransitioningMap">
        <div class="spinner"></div>
        <p>{{ isTransitioningMap ? 'Navigating to POI...' : 'Loading map...' }}</p>
      </div>
      
      
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
          <h3>{{ pendingChange.item.isProposalDrag ? 'Submit Move Proposal' : 'Confirm Position Change' }}</h3>
          <p v-if="pendingChange.item.isProposalDrag">
            Submit a proposal to move "{{ pendingChange.item.name || 'POI' }}" to the new location?
            <br><small style="color: #999;">This will require community voting before the change is applied.</small>
          </p>
          <p v-else>
            Move {{ pendingChange.type === 'poi' ? 'POI' : pendingChange.type === 'customPoi' ? 'Custom POI' : 'Connection' }} to new position?
          </p>
          <div class="pending-change-buttons">
            <button @click="confirmPendingChange" class="confirm-btn">
              {{ pendingChange.item.isProposalDrag ? '✓ Submit Proposal' : '✓ Confirm' }}
            </button>
            <button @click="cancelPendingChange" class="cancel-btn">✗ Cancel</button>
          </div>
        </div>
      </div>
      
      <!-- Proposal Preview Loading -->
      <div v-if="isLoadingProposalPreview" class="proposal-preview-loading">
        <div class="loading-content">
          <div class="loading-spinner"></div>
          <p>Loading proposal preview...</p>
        </div>
      </div>
    </div>
    
    <!-- POI Popup -->
    <POIPopup
      v-if="selectedPOI && !(proposalsSourceActive && selectedPOIHasProposal)"
      :poi="selectedPOI"
      :visible="!!selectedPOI"
      :position="popupPosition"
      :isAdmin="isAdmin"
      :isLeftSide="popupIsLeftSide"
      :currentUserId="user?.id"
      :isAuthenticated="isAuthenticated"
      @close="selectedPOI = null"
      @delete="deletePOI"
      @confirmUpdate="handlePOIUpdate"
      @publish="publishCustomPOI"
      @propose-edit="showEditProposalDialog"
      @propose-delete="showDeleteProposalDialog"
      @propose-loot="showLootProposalDialog"
      @propose-npc-edit="showNPCEditProposal"
      @propose-item-edit="showItemEditProposal"
      @add-npc="showAddNPCDialog"
    />
    
    <!-- Proposal Popup -->
    <ProposalPopup
      v-if="selectedPOI && proposalsSourceActive && selectedPOIHasProposal"
      :visible="true"
      :proposal="(selectedPOI.is_proposal || (selectedPOI.is_custom && selectedPOI.has_pending_proposal)) ? selectedPOI : null"
      :proposalData="!(selectedPOI.is_proposal || (selectedPOI.is_custom && selectedPOI.has_pending_proposal)) ? selectedPOI : null"
      :position="popupPosition"
      :isLeftSide="popupIsLeftSide"
      :isAuthenticated="isAuthenticated"
      :currentUserId="user?.id"
      @close="handleProposalPopupClose"
      @vote-success="handleProposalVoteSuccess"
      @show-npcs="showProposalNPCs"
      @toggle-proposed-location="handleToggleProposedLocation"
      @proposal-withdrawn="handleProposalWithdrawn"
    />
    
    <!-- Toast Container -->
    <ToastContainer />
    
    <!-- Welcome Modal -->
    <WelcomeModal />
    
    <!-- Warning Modal -->
    <WarningModal 
      :warnings="unacknowledgedWarnings"
      @acknowledged="handleWarningAcknowledged"
    />
    
    <!-- Ban Modal -->
    <BanModal />
    
    <!-- Context Menu -->
    <ContextMenu
      :visible="contextMenuVisible"
      :position="contextMenuPosition"
      :isAuthenticated="isAuthenticated"
      :customPoi="contextMenuPOI"
      @close="hideContextMenu"
      @create-custom-poi="createCustomPOI"
      @edit-custom-poi="editCustomPOI"
      @delete-custom-poi="deleteCustomPOI"
    />
    
    <!-- Custom POI Dialog -->
    <CustomPOIDialog
      :visible="customPOIDialogVisible"
      :poi="selectedCustomPOI"
      :mapId="maps[selectedMapIndex]?.id"
      :position="customPOIPosition"
      @save="saveCustomPOI"
      @cancel="customPOIDialogVisible = false"
    />
    
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
    
    <!-- Prompt Dialog -->
    <div v-if="promptDialog.show" class="prompt-dialog-overlay" @click="promptDialog.onCancel">
      <div class="prompt-dialog" @click.stop>
        <h3 class="prompt-title">{{ promptDialog.title }}</h3>
        <p class="prompt-message">{{ promptDialog.message }}</p>
        <input 
          v-model="promptDialog.value"
          type="text"
          class="prompt-input"
          @keyup.enter="promptDialog.onConfirm"
          @keyup.esc="promptDialog.onCancel"
          ref="promptInput"
        />
        <div class="prompt-buttons">
          <button @click="promptDialog.onConfirm" class="prompt-confirm-btn">
            {{ promptDialog.confirmText }}
          </button>
          <button @click="promptDialog.onCancel" class="prompt-cancel-btn">
            {{ promptDialog.cancelText }}
          </button>
        </div>
      </div>
    </div>
    
    <!-- POI Edit Proposal Dialog -->
    <POIEditProposalDialog
      :visible="editProposalDialog.visible"
      :poi="editProposalDialog.poi"
      @close="editProposalDialog.visible = false"
      @submitted="handleProposalSubmitted"
    />
    
    <!-- POI Delete Proposal Dialog -->
    <POIDeleteProposalDialog
      :visible="deleteProposalDialog.visible"
      :poi="deleteProposalDialog.poi"
      @close="deleteProposalDialog.visible = false"
      @submitted="handleProposalSubmitted"
    />
    
    <!-- POI Loot Proposal Dialog -->
    <POILootProposalDialog
      :visible="lootProposalDialog.visible"
      :poi="lootProposalDialog.poi"
      @close="lootProposalDialog.visible = false"
      @submitted="handleProposalSubmitted"
    />
    
    <!-- Item Proposal Dialog -->
    <ItemProposalDialog
      :visible="itemProposalDialog.visible"
      @close="itemProposalDialog.visible = false"
      @submitted="handleProposalSubmitted"
    />
    
    <!-- NPC Proposal Dialog -->
    <NPCProposalDialog
      :visible="npcProposalDialog.visible"
      @close="npcProposalDialog.visible = false"
      @submitted="handleProposalSubmitted"
    />
    
    <!-- NPC Edit Proposal Dialog -->
    <NPCEditProposalDialog
      :visible="npcEditProposalDialog.visible"
      :npc="npcEditProposalDialog.npc"
      @close="npcEditProposalDialog.visible = false"
      @submitted="handleProposalSubmitted"
    />
    
    <ItemEditProposalDialog
      :visible="itemEditProposalDialog.visible"
      :item="itemEditProposalDialog.item"
      @close="itemEditProposalDialog.visible = false"
      @submitted="handleProposalSubmitted"
    />
    
    <!-- Item Search Dialog -->
    <ItemSearchDialog
      :visible="itemSearchDialog.visible"
      @close="itemSearchDialog.visible = false"
      @select="handleItemProposalSelected"
    />
    
    <!-- Proposal NPCs Modal -->
    <div v-if="showProposalNPCsModal" class="modal-overlay" @click.self="closeProposalNPCsModal">
      <div class="modal-content npc-list-modal" @click.stop>
        <div class="modal-header">
          <h3>Multi-Mob POI NPCs</h3>
          <button class="close-btn" @click.stop="closeProposalNPCsModal">&times;</button>
        </div>
        <div class="modal-body">
          <div v-if="proposalNPCsList && proposalNPCsList.length > 0" class="npc-list">
            <div class="npc-list-header">
              This multi-mob POI includes {{ proposalNPCsList.length }} NPCs:
            </div>
            <div v-for="npc in proposalNPCsList" :key="npc.npcid" class="npc-list-item">
              <div class="npc-main-info">
                <span class="npc-name">{{ npc.name }}</span>
                <span class="npc-level">Level {{ npc.level }}</span>
              </div>
              <div class="npc-id">ID: {{ npc.npcid }}</div>
            </div>
          </div>
          <div v-else class="no-npcs">
            No NPCs found for this proposal.
          </div>
        </div>
      </div>
    </div>

    <!-- Add NPC Dialog -->
    <AddNPCDialog
      :visible="addNPCDialog.visible"
      :poi="addNPCDialog.poi"
      @close="addNPCDialog.visible = false"
      @npc-added="handleNPCAdded"
    />
    
    <!-- Item Info Modal -->
    <ItemInfoModal
      :visible="itemInfoModal.visible"
      :item="itemInfoModal.item"
      @close="itemInfoModal.visible = false"
      @select-npc="handleNPCSelected"
    />
    
    <!-- NPC List Modal -->
    <NPCListModal
      :visible="npcListModal.visible"
      :npc="npcListModal.npc"
      @close="npcListModal.visible = false"
      @select-poi="handlePOINavigation"
      @select-item="handleItemSelectedFromNPC"
    />
    
    <div class="controls">
      <button class="control-btn" @click="zoomIn" title="Zoom In">+</button>
      <button class="control-btn" @click="zoomOut" title="Zoom Out">-</button>
      <button class="control-btn" @click="resetView" title="Home">🏠</button>
      <button v-if="isAdmin" class="control-btn admin-btn" @click="showMapManager = true" title="Map Manager">🗺️</button>
      <div v-if="isAuthenticated && !isAdmin" class="control-btn-dropdown">
        <button class="control-btn proposal-btn" @click="toggleItemDropdown" title="Item Proposals">
          ⚔️
          <span class="dropdown-arrow">▼</span>
        </button>
        <div v-if="itemDropdownVisible" class="control-dropdown-menu" @click.stop>
          <button class="dropdown-item" @click="showItemProposalDialog">
            <span class="dropdown-icon">➕</span>
            Propose New Item
          </button>
          <button class="dropdown-item" @click="showItemEditSelection">
            <span class="dropdown-icon">✏️</span>
            Edit Existing Item
          </button>
        </div>
      </div>
      <button v-if="isAuthenticated && !isAdmin" class="control-btn proposal-btn" @click="showNPCProposalDialog" title="Propose New NPC">
        💀+
      </button>
      <div class="zoom-indicator">
        <span>{{ zoomPercent }}%</span>
      </div>
    </div>
    
    <!-- Map Filters -->
    <MapFilters
      v-if="!isLoading"
      :poi-types="poiTypes"
      :all-pois="allUnfilteredPOIs"
      :is-authenticated="isAuthenticated"
      :current-user-id="user?.id"
      :initial-filters="mapFilters"
      @update-filters="handleFilterUpdate"
    />
    
    <!-- Context Menu for Custom POIs -->
    <ContextMenu
      :visible="contextMenuVisible"
      :position="contextMenuPosition"
      :isAuthenticated="isAuthenticated"
      :customPoi="contextMenuPOI"
      @create-custom-poi="createCustomPOI"
      @edit-custom-poi="editCustomPOI"
      @delete-custom-poi="deleteCustomPOI"
      @close="hideContextMenu"
    />
    
    <!-- Custom POI Dialog -->
    <CustomPOIDialog
      :visible="customPOIDialogVisible"
      :poi="selectedCustomPOI"
      :mapId="maps[selectedMapIndex]?.id"
      :position="customPOIPosition"
      @save="saveCustomPOI"
      @cancel="customPOIDialogVisible = false"
    />
    
    <!-- Custom Ko-fi Donation Button -->
    <button 
      class="custom-kofi-button" 
      @click="openKofiWidget"
      title="Support MMC"
    >
      <svg width="40" height="40" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" class="kofi-logo">
        <defs>
          <linearGradient id="kofiGoldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#FFD700;stop-opacity:1" />
            <stop offset="50%" style="stop-color:#FFA500;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#FF8C00;stop-opacity:1" />
          </linearGradient>
          <filter id="kofiShadow">
            <feDropShadow dx="2" dy="2" stdDeviation="2" flood-opacity="0.3"/>
          </filter>
        </defs>
        
        <!-- Compass rose background -->
        <circle cx="50" cy="50" r="45" fill="url(#kofiGoldGradient)" filter="url(#kofiShadow)"/>
        <circle cx="50" cy="50" r="40" fill="#2C1810" />
        
        <!-- M letters forming mountains -->
        <path d="M 20 65 L 30 35 L 40 55 L 50 35 L 60 55 L 70 35 L 80 65" 
              stroke="url(#kofiGoldGradient)" 
              stroke-width="4" 
              fill="none" 
              stroke-linejoin="round" 
              stroke-linecap="round"/>
        
        <!-- C as a crescent moon -->
        <path d="M 65 70 A 15 15 0 1 1 35 70 A 12 12 0 1 0 65 70" 
              fill="url(#kofiGoldGradient)" />
        
        <!-- Compass points -->
        <path d="M 50 10 L 55 20 L 50 15 L 45 20 Z" fill="#FFD700" opacity="0.8"/>
        <path d="M 90 50 L 80 55 L 85 50 L 80 45 Z" fill="#FFD700" opacity="0.8"/>
        <path d="M 50 90 L 45 80 L 50 85 L 55 80 Z" fill="#FFD700" opacity="0.8"/>
        <path d="M 10 50 L 20 45 L 15 50 L 20 55 Z" fill="#FFD700" opacity="0.8"/>
      </svg>
      <span class="kofi-text">Support MMC</span>
    </button>
  </div>
</template>

<script>
import { ref, reactive, onMounted, onUnmounted, computed, watch, nextTick } from 'vue'
import { useMapViewer } from './composables/useMapViewer'
import { useMapInteractions } from './composables/useMapInteractions'
import { mapsAPI, poisAPI, connectionsAPI, pointConnectorsAPI, zoneConnectorsAPI } from './services/api'
import POIPopup from './components/POIPopup.vue'
import ProposalPopup from './components/ProposalPopup.vue'
import AdminPanel from './components/AdminPanel.vue'
import ItemInfoModal from './components/ItemInfoModal.vue'
import NPCListModal from './components/NPCListModal.vue'
import AdminPopup from './components/AdminPopup.vue'
import MapManager from './components/MapManager.vue'
import ToastContainer from './components/ToastContainer.vue'
import ConfirmDialog from './components/ConfirmDialog.vue'
import ContextMenu from './components/ContextMenu.vue'
import CustomPOIDialog from './components/CustomPOIDialog.vue'
import XPBar from './components/XPBar.vue'
import POISearch from './components/POISearch.vue'
import POIEditProposalDialog from './components/POIEditProposalDialog.vue'
import POIDeleteProposalDialog from './components/POIDeleteProposalDialog.vue'
import POILootProposalDialog from './components/POILootProposalDialog.vue'
import ItemProposalDialog from './components/ItemProposalDialog.vue'
import ItemEditProposalDialog from './components/ItemEditProposalDialog.vue'
import ItemSearchDialog from './components/ItemSearchDialog.vue'
import AddNPCDialog from './components/AddNPCDialog.vue'
import NPCProposalDialog from './components/NPCProposalDialog.vue'
import NPCEditProposalDialog from './components/NPCEditProposalDialog.vue'
import WelcomeModal from './components/WelcomeModal.vue'
import WarningModal from './components/WarningModal.vue'
import BanModal from './components/BanModal.vue'
import MapFilters from './components/MapFilters.vue'
import { useToast } from './composables/useToast'
import { useAuth } from './composables/useAuth'
import { useCSRF } from './composables/useCSRF'
import { 
  EntityTypes, 
  parseEntityReference, 
  normalizeId, 
  findEntityById,
  isSameEntity 
} from './utils/entityId'

// Helper function to get map filename from path
function getMapFilename(path) {
  return path.split('/').pop()
}

export default {
  name: 'App',
  components: {
    POIPopup,
    ProposalPopup,
    AdminPanel,
    AdminPopup,
    MapManager,
    ToastContainer,
    ConfirmDialog,
    ContextMenu,
    CustomPOIDialog,
    XPBar,
    POISearch,
    MapFilters,
    POIEditProposalDialog,
    POIDeleteProposalDialog,
    POILootProposalDialog,
    ItemProposalDialog,
    ItemEditProposalDialog,
    ItemSearchDialog,
    AddNPCDialog,
    NPCProposalDialog,
    NPCEditProposalDialog,
    ItemInfoModal,
    NPCListModal,
    WelcomeModal,
    WarningModal,
    BanModal
  },
  setup() {
    const mapCanvas = ref(null)
    const mapContainer = ref(null)
    const selectedMapIndex = ref(0)
    const isLoading = ref(false)
    // Admin mode state - only visual, actual permissions are always checked server-side
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
    const isCopyMode = ref(false) // Track if C key is held for copy mode
    const wasCopyDrag = ref(false) // Track if the current action was a copy drag
    const wasMapDragged = ref(false) // Track if the map was dragged
    const startDragPosition = ref(null) // Track where drag started
    const arrowTimeoutId = ref(null) // For clearing arrow timeout
    const potentialDragItem = ref(null) // Track item clicked without Alt for drag hint
    const dragHintShown = ref(false) // Prevent multiple hints
    
    // Highlighted POI
    const highlightedPOI = ref(null)
    const highlightStartTime = ref(0)
    
    // Proposal Preview
    const proposalPreviewPOIs = ref([])
    const proposalPreviewConnection = ref(null)
    const isLoadingProposalPreview = ref(false)
    
    // All pending proposals for the current map
    const pendingProposals = ref([])
    
    // Active move proposal display
    const showingProposedLocation = ref(false)
    const activeProposedLocation = ref(null)
    
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
    
    const promptDialog = ref({
      show: false,
      title: '',
      message: '',
      value: '',
      confirmText: 'OK',
      cancelText: 'Cancel',
      onConfirm: () => {},
      onCancel: () => {}
    })
    
    const promptInput = ref(null)
    
    // Proposal dialogs
    const editProposalDialog = ref({
      visible: false,
      poi: null
    })
    
    const deleteProposalDialog = ref({
      visible: false,
      poi: null
    })
    
    const lootProposalDialog = ref({
      visible: false,
      poi: null
    })
    
    const itemProposalDialog = ref({
      visible: false
    })
    
    const npcProposalDialog = ref({
      visible: false
    })
    
    const npcEditProposalDialog = ref({
      visible: false,
      npc: null
    })
    
    const itemEditProposalDialog = ref({
      visible: false,
      item: null
    })
    
    const itemSearchDialog = ref({
      visible: false
    })
    
    const addNPCDialog = ref({
      visible: false,
      poi: null
    })
    
    // Item and NPC modals
    const itemInfoModal = ref({
      visible: false,
      item: null
    })
    
    const npcListModal = ref({
      visible: false,
      npc: null
    })
    
    // Loading state for map transitions
    const isTransitioningMap = ref(false)
    
    // Authentication
    const { user, isAuthenticated, isAdmin: isUserAdmin, adminModeEnabled, loading, unacknowledgedWarnings, checkAuthStatus, acknowledgeWarning } = useAuth()
    const { fetchWithCSRF, initCSRF } = useCSRF()
    
    // Sync admin mode state from server
    watch(adminModeEnabled, (newValue) => {
      if (isUserAdmin.value) {
        isAdmin.value = newValue
      }
    }, { immediate: true })
    
    // Custom POI state
    const contextMenuVisible = ref(false)
    const contextMenuPosition = ref({ x: 0, y: 0 })
    const customPOIDialogVisible = ref(false)
    const customPOIPosition = ref(null)
    const selectedCustomPOI = ref(null)
    const customPOIs = ref([])
    const contextMenuPOI = ref(null)
    
    // Load filter settings from sessionStorage
    const loadFilterSettings = () => {
      const savedFilters = sessionStorage.getItem('mapFilters')
      if (savedFilters) {
        try {
          return JSON.parse(savedFilters)
        } catch (e) {
          console.error('Error loading saved filters:', e)
        }
      }
      // Return default settings if no saved settings
      return {
        search: '',
        types: [],
        sources: ['official', 'custom', 'shared'],
        showConnections: true,
        showLabels: true
      }
    }
    
    // Filter state - initialize from sessionStorage
    const mapFilters = ref(loadFilterSettings())
    
    // Save filter settings to sessionStorage whenever they change
    const saveFilterSettings = () => {
      try {
        sessionStorage.setItem('mapFilters', JSON.stringify(mapFilters.value))
      } catch (e) {
        console.error('Error saving filter settings:', e)
      }
    }
    
    // POI types for filtering
    const poiTypes = ref([])
    
    // User dropdown state
    const showUserDropdown = ref(false)
    
    // Proposal NPCs Modal
    const showProposalNPCsModal = ref(false)
    const proposalNPCsList = ref([])
    
    // Item dropdown state
    const itemDropdownVisible = ref(false)
    
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
      drawPOITooltip,
      drawConnection,
      drawConnector,
      loadIconImage
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
    
    const showPrompt = (title, message, defaultValue = '', confirmText = 'OK', cancelText = 'Cancel') => {
      return new Promise((resolve) => {
        // Wait for C key to be released if it's currently held
        let waitingForCRelease = isCopyMode.value
        
        promptDialog.value = {
          show: true,
          title,
          message,
          value: defaultValue,
          confirmText,
          cancelText,
          onConfirm: () => {
            const value = promptDialog.value.value
            promptDialog.value.show = false
            promptDialog.value.value = ''
            resolve(value)
          },
          onCancel: () => {
            promptDialog.value.show = false
            promptDialog.value.value = ''
            resolve(null)
          }
        }
        
        // Focus the input after Vue updates the DOM
        nextTick(() => {
          const input = document.querySelector('.prompt-input')
          if (input) {
            if (waitingForCRelease) {
              // Temporarily disable the input until C is released
              input.disabled = true
              input.placeholder = 'Release C key to edit...'
              
              // Watch for C key release
              const checkCRelease = () => {
                if (!isCopyMode.value) {
                  input.disabled = false
                  input.placeholder = ''
                  input.focus()
                  input.select()
                  // Remove the watcher
                  stopWatcher()
                }
              }
              
              // Set up a watcher for isCopyMode
              const stopWatcher = watch(isCopyMode, checkCRelease, { immediate: true })
            } else {
              // C key not held, proceed normally
              input.focus()
              input.select()
            }
          }
        })
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
      
      // Start grouping when moderately zoomed out (increased from 0.5 to 0.8)
      if (scale.value > 0.8) {
        expandedGroups.value.clear() // Clear expanded groups when zoomed in
        return pois
      }
      
      
      // Calculate grouping distance based on zoom level (adjusted for earlier grouping)
      const groupingDistance = 60 / scale.value // Larger distance when more zoomed out
      
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
            // Always include custom POIs in the type map
            if (!typeMap.has(type) || isSameEntity(p.id, poi.id) || p.is_custom) {
              typeMap.set(type, p)
            }
          })
          
          // Ensure all custom POIs are represented
          const customPOIsInGroup = group.filter(p => p.is_custom)
          customPOIsInGroup.forEach(customPOI => {
            // Give custom POIs unique type keys to ensure they're not dropped
            const customType = `custom_${customPOI.id}`
            typeMap.set(customType, customPOI)
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
                originalX: p.x,  // Preserve original position
                originalY: p.y,
                x: centerX + Math.cos(angle) * radius,
                y: centerY + Math.sin(angle) * radius,
                isInExpandedGroup: true,
                groupId: groupId,
                is_custom: p.is_custom  // Explicitly preserve is_custom flag
              })
              angle += (2 * Math.PI) / group.length
            })
          } else {
            // When zoomed out enough to cluster, show only one icon representing the entire group
            // Use the first POI as the representative
            const representativePOI = group[0]
            
            groups.push({
              ...representativePOI,
              originalX: representativePOI.x,  // Preserve original position
              originalY: representativePOI.y,
              x: centerX,
              y: centerY,
              isGrouped: true,
              groupSize: group.length,
              groupTypes: typeMap.size,
              groupId: groupId,
              groupedPOIs: group, // Include all POIs in the group for tooltip
              showGroupBadge: true, // Always show badge for grouped POIs
              is_custom: representativePOI.is_custom  // Explicitly preserve is_custom flag
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
    
    // Store the current grouped POIs for consistent access
    const currentGroupedPOIs = ref([])
    
    const render = () => {
      baseRender()
      
      if (!ctx.value || !image.value) return
      
      // Draw connections (if enabled in filters)
      if (mapFilters.value.showConnections) {
        currentMapData.value.connections.forEach(connection => {
          const isDragging = draggedItem.value && draggedItem.value.id === connection.id
          const isPending = pendingChange.value && pendingChange.value.item.id === connection.id
          drawConnection(ctx.value, connection, isDragging || isPending)
        })
      }
      
      // Draw zone connectors (if connections are enabled)
      if (mapFilters.value.showConnections && currentMapData.value.zoneConnectors) {
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
      
      // Draw connectors (if connections are enabled)
      if (mapFilters.value.showConnections && currentMapData.value.connectors) {
        currentMapData.value.connectors.forEach(connector => {
          const isDragging = draggedItem.value && isSameEntity(draggedItem.value.id, connector.id)
          const isPending = pendingChange.value && isSameEntity(pendingChange.value.item.id, connector.id)
          drawConnector(ctx.value, connector, isDragging || isPending)
        })
      }
      
      // Combine regular POIs and custom POIs for unified grouping
      // Filter out any duplicate POIs at the same location to prevent tooltip overlap
      const allPOIs = []
      const poiLocations = new Map()
      
      // Use filtered POIs instead of all POIs
      filteredPOIs.value.forEach(poi => {
        // Skip the temporarily hidden custom POI
        if (poi.is_custom && hiddenCustomPOIId.value && poi.id === hiddenCustomPOIId.value) {
          return
        }
        
        const key = `${poi.x},${poi.y}`
        
        // For custom POIs, add prefix to avoid ID collisions
        const poiToAdd = poi.is_custom ? {
          ...poi,
          id: `custom_${poi.id}`,  // Prefix ID to prevent collisions
          originalId: poi.id        // Keep original ID for API calls
        } : poi
        
        if (!poiLocations.has(key)) {
          poiLocations.set(key, poiToAdd)
          allPOIs.push(poiToAdd)
        } else if (poi.is_custom) {
          // If custom POI is at same location as regular POI, prefer custom POI
          const existingIndex = allPOIs.findIndex(p => p.x === poi.x && p.y === poi.y)
          if (existingIndex !== -1) {
            allPOIs[existingIndex] = poiToAdd
            poiLocations.set(key, poiToAdd)
          }
        }
      })
      
      // Group all POIs when zoomed out and store for click detection
      currentGroupedPOIs.value = groupPOIsWhenZoomedOut(allPOIs)
      
      // Draw dotted line during drag (before POIs so it appears behind)
      // Show for proposal drags, custom POI drags, and copy drags
      if (draggedItem.value && (draggedItem.value.isProposalDrag || dragItemType.value === 'customPoi' || draggedItem.value.isCopyDrag)) {
        const originalCanvasPos = imageToCanvas(originalPosition.value.x, originalPosition.value.y)
        const currentCanvasPos = imageToCanvas(draggedItem.value.x, draggedItem.value.y)
        
        // Draw dotted line from original to current position
        ctx.value.save()
        
        // Draw white background line for contrast
        ctx.value.strokeStyle = 'rgba(255, 255, 255, 0.9)'
        ctx.value.lineWidth = 6
        ctx.value.setLineDash([12, 6])
        ctx.value.beginPath()
        ctx.value.moveTo(originalCanvasPos.x, originalCanvasPos.y)
        ctx.value.lineTo(currentCanvasPos.x, currentCanvasPos.y)
        ctx.value.stroke()
        
        // Draw colored line on top
        // Orange for proposals, blue for custom POI moves
        ctx.value.strokeStyle = dragItemType.value === 'customPoi' ? '#4B9BFF' : '#FF6B00'
        ctx.value.lineWidth = 4
        ctx.value.setLineDash([12, 6])
        ctx.value.beginPath()
        ctx.value.moveTo(originalCanvasPos.x, originalCanvasPos.y)
        ctx.value.lineTo(currentCanvasPos.x, currentCanvasPos.y)
        ctx.value.stroke()
        
        ctx.value.restore()
      }
      
      // Draw dotted line for pending change (after mouse up)
      // Show for both proposal changes (regular POIs) and custom POI changes
      if (pendingChange.value && (pendingChange.value.item.isProposalDrag || pendingChange.value.type === 'customPoi')) {
        const originalCanvasPos = imageToCanvas(pendingChange.value.originalPosition.x, pendingChange.value.originalPosition.y)
        const newCanvasPos = imageToCanvas(pendingChange.value.newPosition.x, pendingChange.value.newPosition.y)
        
        // Draw dotted line from original to new position
        ctx.value.save()
        
        // Draw white background line for contrast
        ctx.value.strokeStyle = 'rgba(255, 255, 255, 0.9)'
        ctx.value.lineWidth = 6
        ctx.value.setLineDash([12, 6])
        ctx.value.beginPath()
        ctx.value.moveTo(originalCanvasPos.x, originalCanvasPos.y)
        ctx.value.lineTo(newCanvasPos.x, newCanvasPos.y)
        ctx.value.stroke()
        
        // Draw colored line on top
        // Orange for proposals, blue for custom POI moves
        ctx.value.strokeStyle = pendingChange.value.type === 'customPoi' ? '#4B9BFF' : '#FF6B00'
        ctx.value.lineWidth = 4
        ctx.value.setLineDash([12, 6])
        ctx.value.beginPath()
        ctx.value.moveTo(originalCanvasPos.x, originalCanvasPos.y)
        ctx.value.lineTo(newCanvasPos.x, newCanvasPos.y)
        ctx.value.stroke()
        
        ctx.value.restore()
      }
      
      // Draw all POIs - regular POIs first, then custom POIs on top
      // This ensures custom POIs are always visible
      const regularPOIs = currentGroupedPOIs.value.filter(poi => !poi.is_custom)
      const customPOIsToRender = currentGroupedPOIs.value.filter(poi => poi.is_custom)
      
      
      // Check if proposals are visible
      const proposalsVisible = mapFilters.value.sources.includes('proposals')
      
      // Draw regular POIs first
      regularPOIs.forEach(poi => {
        const isDragging = draggedItem.value && draggedItem.value.id === poi.id
        const isPending = pendingChange.value && pendingChange.value.item.id === poi.id
        drawPOI(ctx.value, poi, isDragging || isPending, mapFilters.value.showLabels, proposalsVisible)
      })
      
      // Draw custom POIs on top
      customPOIsToRender.forEach(poi => {
        const isDragging = draggedItem.value && draggedItem.value.id === poi.id
        const isPending = pendingChange.value && pendingChange.value.item.id === poi.id
        drawPOI(ctx.value, poi, isDragging || isPending, mapFilters.value.showLabels, proposalsVisible)
      })
      
      // Draw proposal preview connection arrow
      if (proposalPreviewConnection.value) {
        const fromCanvas = imageToCanvas(proposalPreviewConnection.value.from.x, proposalPreviewConnection.value.from.y)
        const toCanvas = imageToCanvas(proposalPreviewConnection.value.to.x, proposalPreviewConnection.value.to.y)
        
        ctx.value.save()
        ctx.value.strokeStyle = '#FFD700'
        ctx.value.lineWidth = 3
        ctx.value.setLineDash([10, 5])
        
        // Draw arrow line
        ctx.value.beginPath()
        ctx.value.moveTo(fromCanvas.x, fromCanvas.y)
        ctx.value.lineTo(toCanvas.x, toCanvas.y)
        ctx.value.stroke()
        
        // Draw arrowhead
        const angle = Math.atan2(toCanvas.y - fromCanvas.y, toCanvas.x - fromCanvas.x)
        const arrowLength = 20
        const arrowAngle = Math.PI / 6
        
        ctx.value.beginPath()
        ctx.value.moveTo(toCanvas.x, toCanvas.y)
        ctx.value.lineTo(
          toCanvas.x - arrowLength * Math.cos(angle - arrowAngle),
          toCanvas.y - arrowLength * Math.sin(angle - arrowAngle)
        )
        ctx.value.moveTo(toCanvas.x, toCanvas.y)
        ctx.value.lineTo(
          toCanvas.x - arrowLength * Math.cos(angle + arrowAngle),
          toCanvas.y - arrowLength * Math.sin(angle + arrowAngle)
        )
        ctx.value.stroke()
        
        ctx.value.restore()
      }
      
      // Draw proposal preview POIs
      proposalPreviewPOIs.value.forEach(poi => {
        ctx.value.save()
        
        // Make current POI semi-transparent
        if (poi.is_current) {
          ctx.value.globalAlpha = 0.5
        }
        
        // Handle deletion POIs with special styling
        if (poi.is_deletion) {
          // Draw red deletion indicator
          const canvasPos = imageToCanvas(poi.x, poi.y)
          
          // Draw pulsing red circle around POI
          const pulseTime = Date.now() / 1000
          const pulseScale = 1 + Math.sin(pulseTime * 3) * 0.1
          const ringRadius = 30 * pulseScale
          
          ctx.value.save()
          ctx.value.translate(canvasPos.x, canvasPos.y)
          
          // Red background circle
          ctx.value.beginPath()
          ctx.value.arc(0, 0, ringRadius + 5, 0, Math.PI * 2)
          ctx.value.fillStyle = 'rgba(255, 0, 0, 0.2)'
          ctx.value.fill()
          
          // Red ring
          ctx.value.strokeStyle = '#ff0000'
          ctx.value.lineWidth = 3
          ctx.value.shadowColor = '#ff0000'
          ctx.value.shadowBlur = 10
          ctx.value.beginPath()
          ctx.value.arc(0, 0, ringRadius, 0, Math.PI * 2)
          ctx.value.stroke()
          
          // Draw X mark
          ctx.value.strokeStyle = '#ff0000'
          ctx.value.lineWidth = 4
          ctx.value.shadowColor = 'rgba(0, 0, 0, 0.8)'
          ctx.value.shadowBlur = 4
          ctx.value.beginPath()
          const xSize = 15
          ctx.value.moveTo(-xSize, -xSize)
          ctx.value.lineTo(xSize, xSize)
          ctx.value.moveTo(xSize, -xSize)
          ctx.value.lineTo(-xSize, xSize)
          ctx.value.stroke()
          
          ctx.value.restore()
        }
        
        // Draw the POI
        drawPOI(ctx.value, poi, false, mapFilters.value.showLabels, proposalsVisible)
        
        // Add special styling for proposal POIs
        const canvasPos = imageToCanvas(poi.x, poi.y)
        const iconSize = (poi.icon_size || 24) * scale.value
        
        if (poi.is_proposed) {
          // Draw pulsing green border for proposed POI
          const time = Date.now() / 1000
          const pulse = Math.sin(time * 3) * 0.3 + 0.7
          
          ctx.value.strokeStyle = `rgba(76, 175, 80, ${pulse})`
          ctx.value.lineWidth = 3
          ctx.value.beginPath()
          ctx.value.arc(canvasPos.x, canvasPos.y, iconSize / 2 + 8, 0, Math.PI * 2)
          ctx.value.stroke()
          
          // Add "PROPOSED" label with better readability
          const labelY = canvasPos.y - iconSize / 2 - 20
          const labelText = 'PROPOSED'
          
          // Set up text properties
          ctx.value.font = 'bold 14px Arial'
          ctx.value.textAlign = 'center'
          ctx.value.textBaseline = 'middle'
          
          // Measure text for background
          const metrics = ctx.value.measureText(labelText)
          const padding = 6
          const bgWidth = metrics.width + padding * 2
          const bgHeight = 20
          
          // Draw background pill
          ctx.value.fillStyle = 'rgba(0, 0, 0, 0.8)'
          ctx.value.beginPath()
          ctx.value.roundRect(canvasPos.x - bgWidth / 2, labelY - bgHeight / 2, bgWidth, bgHeight, bgHeight / 2)
          ctx.value.fill()
          
          // Draw white border
          ctx.value.strokeStyle = 'rgba(255, 255, 255, 0.3)'
          ctx.value.lineWidth = 1
          ctx.value.stroke()
          
          // Draw text in white for better contrast
          ctx.value.fillStyle = '#FFFFFF'
          ctx.value.fillText(labelText, canvasPos.x, labelY)
        } else if (poi.is_current) {
          // Draw red border for current POI
          ctx.value.strokeStyle = 'rgba(244, 67, 54, 0.8)'
          ctx.value.lineWidth = 2
          ctx.value.setLineDash([5, 5])
          ctx.value.beginPath()
          ctx.value.arc(canvasPos.x, canvasPos.y, iconSize / 2 + 8, 0, Math.PI * 2)
          ctx.value.stroke()
          
          // Add "CURRENT" label with better readability
          const currentLabelY = canvasPos.y - iconSize / 2 - 20
          const currentLabelText = 'CURRENT'
          
          // Set up text properties
          ctx.value.font = 'bold 14px Arial'
          ctx.value.textAlign = 'center'
          ctx.value.textBaseline = 'middle'
          
          // Measure text for background
          const currentMetrics = ctx.value.measureText(currentLabelText)
          const currentPadding = 6
          const currentBgWidth = currentMetrics.width + currentPadding * 2
          const currentBgHeight = 20
          
          // Draw background pill
          ctx.value.fillStyle = 'rgba(0, 0, 0, 0.8)'
          ctx.value.beginPath()
          ctx.value.roundRect(canvasPos.x - currentBgWidth / 2, currentLabelY - currentBgHeight / 2, currentBgWidth, currentBgHeight, currentBgHeight / 2)
          ctx.value.fill()
          
          // Draw white border
          ctx.value.strokeStyle = 'rgba(255, 255, 255, 0.3)'
          ctx.value.lineWidth = 1
          ctx.value.stroke()
          
          // Draw text in white for better contrast
          ctx.value.fillStyle = '#FFFFFF'
          ctx.value.fillText(currentLabelText, canvasPos.x, currentLabelY)
        }
        
        ctx.value.restore()
      })
      
      // Draw highlight effect for navigated POI
      if (highlightedPOI.value) {
        drawHighlightEffect(ctx.value, highlightedPOI.value)
      }
      
      // Draw proposal indicator while dragging
      if (draggedItem.value && draggedItem.value.isProposalDrag && dragItemType.value === 'poi') {
        const canvasPos = imageToCanvas(draggedItem.value.x, draggedItem.value.y)
        
        ctx.value.save()
        ctx.value.font = 'bold 12px Arial'
        ctx.value.textAlign = 'center'
        ctx.value.textBaseline = 'bottom'
        
        // Draw background for text
        const text = 'PROPOSAL'
        const metrics = ctx.value.measureText(text)
        const padding = 4
        const bgWidth = metrics.width + padding * 2
        const bgHeight = 16
        const textY = canvasPos.y - 30
        
        ctx.value.fillStyle = 'rgba(255, 152, 0, 0.9)'
        ctx.value.beginPath()
        ctx.value.roundRect(canvasPos.x - bgWidth / 2, textY - bgHeight, bgWidth, bgHeight, 3)
        ctx.value.fill()
        
        // Draw text
        ctx.value.fillStyle = '#FFFFFF'
        ctx.value.fillText(text, canvasPos.x, textY)
        
        ctx.value.restore()
      }
      
      // Draw move proposal visualization (only if proposals are visible)
      if (proposalsVisible && showingProposedLocation.value && activeProposedLocation.value) {
        const originalPos = imageToCanvas(activeProposedLocation.value.originalPoi.x, activeProposedLocation.value.originalPoi.y)
        const proposedPos = imageToCanvas(activeProposedLocation.value.x, activeProposedLocation.value.y)
        
        // Draw dotted line from original to proposed location
        ctx.value.save()
        
        // White background line for contrast
        ctx.value.strokeStyle = 'rgba(255, 255, 255, 0.9)'
        ctx.value.lineWidth = 4
        ctx.value.setLineDash([10, 5])
        ctx.value.beginPath()
        ctx.value.moveTo(originalPos.x, originalPos.y)
        ctx.value.lineTo(proposedPos.x, proposedPos.y)
        ctx.value.stroke()
        
        // Blue line on top
        ctx.value.strokeStyle = '#1E90FF'
        ctx.value.lineWidth = 2
        ctx.value.beginPath()
        ctx.value.moveTo(originalPos.x, originalPos.y)
        ctx.value.lineTo(proposedPos.x, proposedPos.y)
        ctx.value.stroke()
        
        ctx.value.restore()
        
        // Draw proposed location POI
        const proposedPOI = {
          ...activeProposedLocation.value.originalPoi,
          x: activeProposedLocation.value.x,
          y: activeProposedLocation.value.y,
          is_proposal: true,
          proposal_type: 'move',
          is_proposed_location: true,
          has_move_proposal: true,
          move_proposal: activeProposedLocation.value.move_proposal
        }
        drawPOI(ctx.value, proposedPOI, false, true, true) // Always show proposal indicator for proposed location
        
        // Draw "PROPOSED" label
        const canvasPos = proposedPos
        const labelY = canvasPos.y - 35
        const labelText = 'PROPOSED LOCATION'
        
        ctx.value.save()
        ctx.value.font = 'bold 12px Arial'
        ctx.value.textAlign = 'center'
        ctx.value.textBaseline = 'middle'
        
        // Measure text for background
        const metrics = ctx.value.measureText(labelText)
        const padding = 6
        const bgWidth = metrics.width + padding * 2
        const bgHeight = 18
        
        // Draw background pill
        ctx.value.fillStyle = 'rgba(30, 144, 255, 0.9)'
        ctx.value.beginPath()
        if (ctx.value.roundRect) {
          ctx.value.roundRect(canvasPos.x - bgWidth / 2, labelY - bgHeight / 2, bgWidth, bgHeight, bgHeight / 2)
        } else {
          // Fallback for browsers without roundRect
          ctx.value.rect(canvasPos.x - bgWidth / 2, labelY - bgHeight / 2, bgWidth, bgHeight)
        }
        ctx.value.fill()
        
        // Draw text
        ctx.value.fillStyle = '#FFFFFF'
        ctx.value.fillText(labelText, canvasPos.x, labelY)
        ctx.value.restore()
      }
      
      // Draw all POI tooltips last to ensure they appear on top
      if (hoveredPOI.value) {
        drawPOITooltip(ctx.value, hoveredPOI.value)
      }
      
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
        
        // Draw line from proposal popup to POI if it's a proposal
        if (proposalsSourceActive.value && selectedPOIHasProposal.value) {
          // Draw dotted line on canvas
          ctx.value.save()
          
          // Set up line style
          ctx.value.strokeStyle = '#1E90FF'
          ctx.value.lineWidth = 3
          ctx.value.setLineDash([8, 4])
          ctx.value.lineCap = 'round'
          
          // Add shadow for visibility
          ctx.value.shadowColor = 'rgba(0, 0, 0, 0.5)'
          ctx.value.shadowBlur = 3
          ctx.value.shadowOffsetX = 1
          ctx.value.shadowOffsetY = 1
          
          // Draw the line from POI to popup edge
          ctx.value.beginPath()
          ctx.value.moveTo(canvasPos.x, canvasPos.y)
          
          // Calculate where line meets popup
          // Since the popup uses CSS transforms and fixed positioning, 
          // we'll draw the line to extend under where the popup appears
          let lineEndX
          if (popupIsLeftSide.value) {
            // Popup is to the left - extend line further left to reach popup edge
            // The popup is positioned at offsetX (-340) and then translated left by its width
            lineEndX = canvasPos.x - 60
          } else {
            // Popup is to the right - extend line to reach popup edge
            // The popup is positioned at offsetX (40) plus 20px offset
            lineEndX = canvasPos.x + 60
          }
          const lineEndY = canvasPos.y + offsetY
          
          ctx.value.lineTo(lineEndX, lineEndY)
          ctx.value.stroke()
          
          // Draw a small circle at the POI end
          ctx.value.fillStyle = '#1E90FF'
          ctx.value.beginPath()
          ctx.value.arc(canvasPos.x, canvasPos.y, 4, 0, Math.PI * 2)
          ctx.value.fill()
          
          ctx.value.restore()
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
      
      // Clear any active arrows and hover states when switching maps
      activeConnectorArrow.value = null
      hoveredConnector.value = null
      hoveredConnection.value = null
      hoveredPOI.value = null
      if (arrowTimeoutId.value) {
        clearTimeout(arrowTimeoutId.value)
        arrowTimeoutId.value = null
      }
      
      try {
        // Load map image
        await loadImage(map.file)
        
        // If it's a database map, load its data
        // Load if we don't have data or if we only have search data
        if (map.id && (!dbMapData.value[map.id] || dbMapData.value[map.id].searchOnly)) {
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
              labelScale: pc.from_label_size || 1,
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
                labelScale: pc.to_label_size || 1,
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
          
          // Process POIs to handle icon types from poi_types table
          const processedPOIs = (mapData.pois || []).map(poi => processPOI(poi))
          
          dbMapData.value[map.id] = {
            pois: processedPOIs,
            connections: mapData.connections || [],
            connectors: connectors,
            zoneConnectors: mapData.zoneConnectors || []
          }
        }
        
        // Load custom POIs for this map
        await loadCustomPOIs()
        
        // Load pending proposals for this map
        await loadPendingProposals()
        
        reset(mapCanvas.value)
        render()
        
        // Force another render after a short delay to ensure currentGroupedPOIs is populated
        setTimeout(() => {
          render()
          // Ensure drag state is reset after map load
          wasMapDragged.value = false
          startDragPosition.value = null
        }, 50)
      } catch (err) {
        console.error('Failed to load map:', err)
        error(`Failed to load map: ${map.name}`)
      } finally {
        isLoading.value = false
      }
    }
    
    const handleMapClick = (e) => {
      // Skip click handling if this was a copy drag or if C key is currently held
      if (wasCopyDrag.value || isCopyMode.value) {
        wasCopyDrag.value = false
        return
      }
      
      // Skip click handling if the map was dragged
      if (wasMapDragged.value) {
        wasMapDragged.value = false
        return
      }
      
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
        
        // Check for POI clicks - only allow deletion of regular POIs (not custom POIs)
        const clickedPOI = currentGroupedPOIs.value.find(poi =>
          isPOIHit(poi, imagePos.x, imagePos.y)
        )
        
        if (clickedPOI) {
          
          // If it's a grouped POI, we need to determine which POI to delete
          let poiToDelete = clickedPOI
          
          if (clickedPOI.isGrouped && clickedPOI.groupedPOIs && clickedPOI.groupedPOIs.length > 1) {
            
            // For grouped POIs, we should show a selection dialog
            const regularPOIs = clickedPOI.groupedPOIs.filter(poi => 
              !poi.is_custom && currentMapData.value.pois.some(p => p.id === poi.id)
            )
            
            
            if (regularPOIs.length === 0) {
              // No regular POI in this group
              info('This group contains only custom POIs. Use the POI popup to delete them.')
              return
            } else if (regularPOIs.length === 1) {
              poiToDelete = regularPOIs[0]
            } else {
              // Multiple regular POIs - for now, warn the user
              warning(`Multiple POIs at this location. Please zoom in or use the POI popup to select the specific POI to delete.`)
              return
            }
          }
          
          
          // Check if it's a regular POI (admin can only delete regular POIs via this method)
          const isRegularPOI = !poiToDelete.is_custom && 
            currentMapData.value.pois.some(poi => poi.id === poiToDelete.id)
          
          if (isRegularPOI) {
            showConfirm('Delete POI', `Delete POI "${poiToDelete.name}"?`, 'Delete', 'Cancel').then(confirmed => {
              if (confirmed) {
                deletePOI(poiToDelete.id)
              }
            })
            return
          } else if (poiToDelete.is_custom) {
            info('Cannot delete custom POIs with Shift+Click. Use the POI popup instead.')
            return
          }
        }
        
        return
      }
      
      // Skip normal click behavior if Alt key is pressed (for dragging)
      if (e.altKey) {
        return
      }
      
      // Check if proposals are visible (source filter is 'all' or 'proposals')
      const proposalsVisible = mapFilters.value.sources.includes('proposals')
      
      // Check if clicking on proposed location first (only if proposals are visible)
      let clickedPOI = null
      if (proposalsVisible && showingProposedLocation.value && activeProposedLocation.value) {
        const proposedPOI = {
          ...activeProposedLocation.value.originalPoi,
          x: activeProposedLocation.value.x,
          y: activeProposedLocation.value.y,
          is_proposal: true,
          is_proposed_location: true,
          has_move_proposal: true,
          move_proposal: activeProposedLocation.value.move_proposal
        }
        if (isPOIHit(proposedPOI, imagePos.x, imagePos.y)) {
          clickedPOI = proposedPOI
        }
      }
      
      // Check for zone connectors first (they should have priority over POIs)
      let clickedZoneConnector = null
      let clickedConnection = null
      
      
      if (currentMapData.value.zoneConnectors) {
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
          // Set clickedConnection for navigation
          clickedConnection = {
            targetMapId: clickedZone.to_map_id,
            label: clickedZone.from_label,
            x: clickedZone.from_x,
            y: clickedZone.from_y
          }
        }
      }
      
      // Check for connector clicks
      const clickedConnector = currentMapData.value.connectors?.find(conn =>
        isConnectorHit(conn, imagePos.x, imagePos.y)
      )
      
      // Check for regular connection clicks only if no zone connector was clicked
      if (!clickedConnection) {
        clickedConnection = currentMapData.value.connections.find(conn =>
          isConnectionHit(conn, imagePos.x, imagePos.y)
        )
      }
      
      // Now check for POI clicks only if no zone connector was clicked
      if (!clickedPOI && !clickedZoneConnector) {
        // Make sure currentGroupedPOIs is available
        if (currentGroupedPOIs.value && currentGroupedPOIs.value.length > 0) {
          clickedPOI = currentGroupedPOIs.value.find(poi =>
            isPOIHit(poi, imagePos.x, imagePos.y)
          )
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
        const offsetY = -40 // Adjusted to align popup tail with POI center
        
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
        } else {
          console.warn('Zone connector clicked but target map not found:', clickedConnection)
        }
        return
      }
      
      // Check for POI clicks (works in both admin and normal mode, and for both regular and custom POIs)
      // We already checked above, so use the existing clickedPOI if found
      if (clickedPOI && !isConnectorPOI) {
        // If it's a grouped POI, we need to handle it specially
        if (clickedPOI.isGrouped && clickedPOI.groupedPOIs && clickedPOI.groupedPOIs.length > 1) {
          
          // Find which specific POI in the group was clicked based on exact position
          // This helps when POIs are slightly offset in a group
          let poiToSelect = clickedPOI.groupedPOIs[0] // Default to first
          
          // Try to find the exact POI that was clicked if they have different positions
          const clickTolerance = 10 // pixels
          for (const poi of clickedPOI.groupedPOIs) {
            const dx = Math.abs(poi.x - imagePos.x)
            const dy = Math.abs(poi.y - imagePos.y)
            if (dx <= clickTolerance && dy <= clickTolerance) {
              poiToSelect = poi
              break
            }
          }
          
          
          // For better UX, we should implement a selection menu in the future
          // For now, we'll use the most accurate POI we can find
          selectedPOI.value = poiToSelect
        } else {
          
          // Check if proposals are visible (source filter is 'all' or 'proposals')
          const proposalsVisible = mapFilters.value.sources.includes('proposals')
          
          // Check if clicking on proposed location
          if (clickedPOI.is_proposed_location) {
            // Show ProposalPopup for the move proposal
            selectedPOI.value = clickedPOI
          } else if (proposalsVisible && clickedPOI.has_move_proposal && !clickedPOI.is_proposed_location) {
            // Only toggle proposed location if proposals are visible
            if (activeProposedLocation.value && 
                activeProposedLocation.value.originalPoi.id === clickedPOI.id) {
              // Toggle off - also close any open proposal popup
              showingProposedLocation.value = false
              activeProposedLocation.value = null
              // Close proposal popup if it's showing a proposed location
              if (selectedPOI.value?.is_proposed_location) {
                selectedPOI.value = null
              }
            } else {
              // Toggle on
              showingProposedLocation.value = true
              activeProposedLocation.value = {
                x: clickedPOI.move_proposal.proposed_x,
                y: clickedPOI.move_proposal.proposed_y,
                originalPoi: clickedPOI,
                move_proposal: clickedPOI.move_proposal
              }
            }
            render()
          } else {
            // For other POIs, show popup as normal
            selectedPOI.value = clickedPOI
          }
        }
        
        const canvasPos = imageToCanvas(clickedPOI.x, clickedPOI.y)
        
        // Calculate offset based on the POI's icon size (matching drawPOI logic)
        const baseSize = clickedPOI.icon_size || 24
        const minSize = 20
        const maxSize = 48
        const inverseScale = Math.max(0.8, Math.min(1.5, 1 / Math.sqrt(scale.value)))
        const iconScale = clickedPOI.iconScale || 1
        const iconSize = Math.max(minSize, Math.min(maxSize, baseSize * inverseScale * iconScale))
        
        let offsetX = iconSize / 2 + 20 // Distance from POI edge
        const offsetY = -35 // Move popup higher to better align with POI icon
        
        // Check if popup would go off the right edge
        const popupWidth = 300
        const screenX = canvasPos.x + rect.left + offsetX
        
        if (screenX + popupWidth > window.innerWidth - 20) {
          offsetX = -(iconSize / 2 + popupWidth + 20)
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
    
    const handleContextMenu = (e) => {
      // Prevent context menu while dragging
      if (draggedItem.value || isDragging.value || pendingChange.value) {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        return false
      }
      handleRightClick(e)
    }
    
    const handleRightClick = (e) => {
      e.preventDefault()
      
      const rect = mapCanvas.value.getBoundingClientRect()
      const canvasX = e.clientX - rect.left
      const canvasY = e.clientY - rect.top
      const imagePos = canvasToImage(canvasX, canvasY)
      
      // Show context menu for authenticated users
      if (isAuthenticated.value && !isAdmin.value) {
        // Check if clicking on any POI (regular or custom) - only allow editing own custom POIs
        const clickedPOI = currentGroupedPOIs.value.find(poi =>
          isPOIHit(poi, imagePos.x, imagePos.y)
        )
        
        // Only show context menu for custom POIs owned by the user
        const actualClickedId = clickedPOI && clickedPOI.id.toString().startsWith('custom_') ? 
          parseInt(clickedPOI.id.toString().replace('custom_', '')) : 
          (clickedPOI ? clickedPOI.id : null)
        const clickedCustomPOI = clickedPOI && customPOIs.value.find(customPOI => 
          customPOI.id === actualClickedId
        )
        
        contextMenuPOI.value = clickedCustomPOI
        contextMenuPosition.value = { x: e.clientX, y: e.clientY }
        customPOIPosition.value = imagePos
        contextMenuVisible.value = true
        return
      }
      
      if (!isAdmin.value) return
      
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
      
      const clickedPOI = currentGroupedPOIs.value.find(poi =>
        isPOIHit(poi, imagePos.x, imagePos.y)
      )
      
      // In connector mode with invisible link, clicking on POI sets connector position
      if (editMode.value === 'connector' && clickedPOI) {
        // Check if this is a custom POI - connections to custom POIs are not allowed
        if (clickedPOI.is_custom || clickedPOI.id.toString().startsWith('custom_')) {
          warning('Connections to custom POIs are not supported. Custom POIs may be deleted or moved by their owners.')
          return
        }
        
        // Verify it's actually a regular POI in the database
        const isRegularPOI = currentMapData.value.pois.some(p => p.id === clickedPOI.id)
        if (!isRegularPOI) {
          warning('This POI cannot be used for connections.')
          return
        }
        
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
      // Only handle left mouse button
      if (e.button !== 0) {
        return
      }
      
      // Track the starting position for map drag detection
      if (!draggedItem.value) {
        startDragPosition.value = { x: e.clientX, y: e.clientY }
      }
      
      // Check if Alt key is held for dragging or C key is held for copying
      if ((e.altKey || isCopyMode.value) && !e.shiftKey) {
        const rect = mapCanvas.value.getBoundingClientRect()
        const canvasX = e.clientX - rect.left
        const canvasY = e.clientY - rect.top
        const imagePos = canvasToImage(canvasX, canvasY)
        
        // Debug log for first attempt
        if (isCopyMode.value && (!currentGroupedPOIs.value || currentGroupedPOIs.value.length === 0)) {
          console.log('[Copy Mode] currentGroupedPOIs is empty on first attempt')
        }
        
        // Check for POI hit using the grouped POIs
        const clickedPOI = currentGroupedPOIs.value.find(poi =>
          isPOIHit(poi, imagePos.x, imagePos.y)
        )
        
        if (clickedPOI) {
          // Check if it's a custom POI the user can drag
          const actualClickedId = clickedPOI.id.toString().startsWith('custom_') ? 
            parseInt(clickedPOI.id.toString().replace('custom_', '')) : 
            clickedPOI.id
          const isCustomPOI = customPOIs.value.some(customPOI => 
            customPOI.id === actualClickedId &&
            customPOI.user_id === user.value?.id &&
            customPOI.status !== 'pending'
          )
          
          // Check if it's a regular POI (use the cleaned ID for comparison)
          // Convert to string for comparison to handle both numeric and string IDs
          const isRegularPOI = currentMapData.value.pois.some(poi => poi.id.toString() === actualClickedId.toString())
          
          // Allow dragging if:
          // 1. It's a custom POI owned by the user (for moving)
          // 2. It's a regular POI and user is admin
          // 3. It's a regular POI and user is authenticated (for proposals)
          // 4. It's a copy operation (C key held) - allow copying any POI
          if (isCopyMode.value || isCustomPOI || (isAdmin.value && isRegularPOI) || (isAuthenticated.value && isRegularPOI)) {
            // Check if POI already has a pending proposal
            if (clickedPOI.has_pending_proposal) {
              warning('This POI already has a pending change proposal')
              return
            }
            
            // Additional check: if is_custom flag is explicitly set, trust it
            if (clickedPOI.is_custom === false && !isRegularPOI) {
              console.warn('POI marked as not custom but not found in regular POIs:', clickedPOI)
              return
            }
            // Use original position if available (for grouped POIs)
            const poiX = clickedPOI.originalX !== undefined ? clickedPOI.originalX : clickedPOI.x
            const poiY = clickedPOI.originalY !== undefined ? clickedPOI.originalY : clickedPOI.y
            
            // If the POI has a prefixed ID, restore the original ID
            if (clickedPOI.id.toString().startsWith('custom_')) {
              draggedItem.value = {
                ...clickedPOI,
                id: actualClickedId  // Use the cleaned ID for both regular and custom POIs
              }
            } else {
              draggedItem.value = clickedPOI
            }
            dragItemType.value = isCustomPOI ? 'customPoi' : 'poi'
            dragOffset.value = {
              x: imagePos.x - poiX,
              y: imagePos.y - poiY
            }
            originalPosition.value = {
              x: poiX,
              y: poiY
            }
            // Track if this is a proposal drag (non-admin dragging regular POI)
            draggedItem.value.isProposalDrag = isRegularPOI && !isAdmin.value && isAuthenticated.value
            
            // Track if this is a copy operation
            draggedItem.value.isCopyDrag = isCopyMode.value
            if (isCopyMode.value) {
              wasCopyDrag.value = true
            }
            return
          }
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
          const clickedPOI = currentGroupedPOIs.value.find(poi =>
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
      
      // Check if proposals are visible (source filter is 'all' or 'proposals')
      const proposalsVisible = mapFilters.value.sources.includes('proposals')
      
      // Check if hovering over proposed location first (only if proposals are visible)
      if (proposalsVisible && showingProposedLocation.value && activeProposedLocation.value) {
        const proposedPOI = {
          ...activeProposedLocation.value.originalPoi,
          x: activeProposedLocation.value.x,
          y: activeProposedLocation.value.y,
          is_proposal: true,
          is_proposed_location: true,
          has_move_proposal: true,
          move_proposal: activeProposedLocation.value.move_proposal
        }
        if (isPOIHit(proposedPOI, imagePos.x, imagePos.y)) {
          hoveredPOI.value = proposedPOI
        } else {
          // Update hovered items using the grouped POIs
          hoveredPOI.value = currentGroupedPOIs.value.find(poi =>
            isPOIHit(poi, imagePos.x, imagePos.y)
          )
        }
      } else {
        // Update hovered items using the grouped POIs
        hoveredPOI.value = currentGroupedPOIs.value.find(poi =>
          isPOIHit(poi, imagePos.x, imagePos.y)
        )
      }
      
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
    
    const handleMouseUp = async (e) => {
      // Ignore right-click mouse up events
      if (e && e.button === 2) {
        return
      }
      
      // Check if the map was dragged (not just clicked)
      if (!draggedItem.value && startDragPosition.value && e) {
        const dragDistance = Math.sqrt(
          Math.pow(e.clientX - startDragPosition.value.x, 2) + 
          Math.pow(e.clientY - startDragPosition.value.y, 2)
        )
        // Consider it a drag if moved more than 5 pixels
        if (dragDistance > 5) {
          wasMapDragged.value = true
        }
      }
      
      // Reset the start drag position
      startDragPosition.value = null
      
      // Reset potential drag tracking
      potentialDragItem.value = null
      dragHintShown.value = false
      
      // If we were dragging an item, check if it actually moved
      if (draggedItem.value) {
        const moved = draggedItem.value.x !== originalPosition.value.x || 
                     draggedItem.value.y !== originalPosition.value.y
        
        if (moved) {
          // Check if this is a copy operation
          if (draggedItem.value.isCopyDrag) {
            // Handle copy operation - await it before clearing drag state
            await handlePOICopy()
          } else {
            // Regular move operation
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
        }
        
        // Clear drag state
        draggedItem.value = null
        dragItemType.value = null
        dragOffset.value = { x: 0, y: 0 }
        // Don't clear wasCopyDrag here - let handleMapClick clear it
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
    
    const reloadApp = () => {
      // Reset to first map and clear any admin mode
      selectedMapIndex.value = 0
      isAdmin.value = false
      pendingPOI.value = null
      pendingConnection.value = null
      pendingConnector.value = null
      pendingConnectorPair.value = { first: null, second: null }
      adminPopupItem.value = null
      selectedPOI.value = null
      
      // Reset view
      reset(mapCanvas.value)
      
      // Reload the first map
      if (maps.value.length > 0) {
        loadSelectedMap()
      }
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
    
    const drawHighlightEffect = (ctx, poi) => {
      const canvasPos = imageToCanvas(poi.x, poi.y)
      const currentTime = Date.now()
      const elapsed = currentTime - highlightStartTime.value
      const pulseDuration = 500 // Duration of each pulse in ms
      const totalDuration = pulseDuration * 5 // 5 pulses
      
      // Stop after 5 pulses
      if (elapsed > totalDuration) {
        highlightedPOI.value = null
        return
      }
      
      // Calculate pulse progress (0 to 1 for each pulse)
      const pulseProgress = (elapsed % pulseDuration) / pulseDuration
      
      ctx.save()
      ctx.translate(canvasPos.x, canvasPos.y)
      
      // Use sine wave for smooth pulsing
      const pulseScale = Math.sin(pulseProgress * Math.PI)
      
      // Create a glowing circle effect
      const baseRadius = 25
      const maxRadius = 40
      const radius = baseRadius + (maxRadius - baseRadius) * pulseScale
      const opacity = 0.3 + 0.7 * pulseScale
      
      // Outer glow
      const gradient = ctx.createRadialGradient(0, 0, radius * 0.5, 0, 0, radius * 1.5)
      gradient.addColorStop(0, `rgba(255, 215, 0, ${opacity * 0.8})`)
      gradient.addColorStop(0.5, `rgba(255, 215, 0, ${opacity * 0.4})`)
      gradient.addColorStop(1, `rgba(255, 215, 0, 0)`)
      
      ctx.beginPath()
      ctx.arc(0, 0, radius * 1.5, 0, Math.PI * 2)
      ctx.fillStyle = gradient
      ctx.fill()
      
      // Main circle
      ctx.beginPath()
      ctx.arc(0, 0, radius, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(255, 215, 0, ${opacity})`
      ctx.lineWidth = 3
      ctx.stroke()
      
      // Inner bright circle
      ctx.beginPath()
      ctx.arc(0, 0, radius * 0.7, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(255, 255, 255, ${opacity * 0.6})`
      ctx.lineWidth = 2
      ctx.stroke()
      
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
      
      render()
    }
    
    const toggleAdmin = async () => {
      // Only allow admin users to toggle admin mode
      if (!user.value || !user.value.is_admin) {
        error('Admin access required')
        return
      }
      
      try {
        // Toggle admin mode on server (secure)
        const response = await fetchWithCSRF('/api/admin/toggle-mode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        })
        
        if (response.ok) {
          const data = await response.json()
          isAdmin.value = data.adminModeEnabled
          
          if (isAdmin.value) {
            success('Admin mode activated')
          } else {
            // Clean up any pending admin operations
            pendingPOI.value = null
            pendingConnection.value = null
            pendingConnector.value = null
            pendingConnectorPair.value = { first: null, second: null }
            info('Admin mode deactivated')
          }
        } else {
          error('Failed to toggle admin mode')
        }
      } catch (err) {
        error('Failed to toggle admin mode')
        console.error('Admin toggle error:', err)
      }
    }
    
    const handleKeyboardShortcut = (e) => {
      // Track C key for copy mode
      if (e.key === 'c' || e.key === 'C') {
        if (!e.ctrlKey && !e.metaKey) { // Don't interfere with Ctrl+C
          isCopyMode.value = true
        }
      }
      
      // Ctrl+Shift+A to toggle admin mode
      if (e.ctrlKey && e.shiftKey && e.key === 'A') {
        e.preventDefault()
        toggleAdmin()
      }
      
      // Escape key handling
      if (e.key === 'Escape') {
        // Close proposal NPCs modal if open
        if (showProposalNPCsModal.value) {
          closeProposalNPCsModal()
          return
        }
        
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
    
    const handleKeyUp = (e) => {
      // Clear C key copy mode when released
      if (e.key === 'c' || e.key === 'C') {
        isCopyMode.value = false
      }
    }
    
    // Handle POI copy operation
    const handlePOICopy = async () => {
      
      if (!draggedItem.value) {
        return
      }
      
      // Accept both 'poi' and 'customPoi' types for copying
      if (dragItemType.value !== 'poi' && dragItemType.value !== 'customPoi') {
        return
      }
      
      const poi = draggedItem.value
      const newX = Math.round(poi.x)
      const newY = Math.round(poi.y)
      
      // Restore original position since we're copying, not moving
      poi.x = originalPosition.value.x
      poi.y = originalPosition.value.y
      
      // Determine the appropriate message based on admin status
      const promptMessage = isAdmin.value
        ? 'Enter a name for the copied POI:'
        : (poi.is_custom || poi.id.toString().startsWith('custom_') || dragItemType.value === 'customPoi')
          ? 'Enter a name for the copied POI (will be created immediately):'
          : 'Enter a name for the copied POI (will create a change proposal for community voting):'
      
      // Show custom prompt for POI name with current name pre-filled
      const newName = await showPrompt(
        'Copy POI',
        promptMessage,
        poi.name,
        'Copy',
        'Cancel'
      )
      
      if (!newName || newName.trim() === '') {
        render()
        return
      }
      
      try {
        // For multi-mob POIs, fetch NPC associations if not already loaded
        let npcAssociations = poi.npc_associations || []
        if (poi.multi_mob && !poi.npc_associations && poi.id) {
          try {
            const response = await fetch(`/api/pois/${poi.id}/npcs`)
            if (response.ok) {
              npcAssociations = await response.json()
            }
          } catch (err) {
            console.warn('Failed to fetch NPC associations for copy:', err)
          }
        }
        
        // In admin mode, always create regular POIs directly
        if (isAdmin.value) {
          // For custom POIs, we need to get the full data including type_id
          let poiTypeId = poi.type_id || poi.poi_type_id || null
          
          // If copying from a custom POI, get the type_id from the full custom POI data
          if (poi.is_custom || poi.id.toString().startsWith('custom_')) {
            const customPoiId = poi.id.toString().replace('custom_', '')
            const customPoiData = customPOIs.value.find(cp => cp.id.toString() === customPoiId)
            if (customPoiData) {
              // Custom POIs may have poi_type_id instead of type_id
              poiTypeId = customPoiData.poi_type_id || customPoiData.type_id || poiTypeId
            }
          }
          
          // If we still don't have a type_id, try to get it from the dragged POI's other properties
          if (!poiTypeId && poi.poi_type && poi.poi_type.id) {
            poiTypeId = poi.poi_type.id
          }
          
          
          // Admin copy - create regular POI immediately
          const newPOI = await poisAPI.save({
            map_id: maps.value[selectedMapIndex.value].id,
            x: newX,
            y: newY,
            name: newName.trim(),
            description: poi.description || '',
            type_id: poiTypeId,
            icon_size: poi.icon_size || 48,
            label_visible: poi.label_visible !== false,
            label_position: poi.label_position || 'bottom',
            npc_id: (!poi.multi_mob && poi.npc_id) ? poi.npc_id : null,
            // Preserve multi_mob flag if copying from a multi-mob POI
            multi_mob: poi.multi_mob || false
          })
          
          
          // Update local cache
          if (!dbMapData.value[maps.value[selectedMapIndex.value].id]) {
            dbMapData.value[maps.value[selectedMapIndex.value].id] = { pois: [] }
          }
          
          
          // Process the POI to extract icon information
          const processedPOI = processPOI(newPOI)
          dbMapData.value[maps.value[selectedMapIndex.value].id].pois.push(processedPOI)
          
          // Force re-render to show the new POI with correct icon
          render()
          
          // Copy NPC associations for multi-mob POIs
          // Admins can add multiple NPCs to any POI, even if it's not originally multi-mob
          if (npcAssociations.length > 0) {
            const successfulAssociations = []
            for (const assoc of npcAssociations) {
              try {
                const npcId = assoc.npcid || assoc.npc_id
                const response = await fetchWithCSRF(`/api/pois/${newPOI.id}/npcs`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    npc_id: npcId
                  })
                })
                if (response.ok) {
                  const result = await response.json()
                  // For admin-created associations, create a clean association object
                  successfulAssociations.push({
                    association_id: result.association_id,
                    npcid: npcId,
                    name: assoc.name,
                    level: assoc.level,
                    hp: assoc.hp,
                    ac: assoc.ac,
                    min_dmg: assoc.min_dmg,
                    max_dmg: assoc.max_dmg,
                    attack_speed: assoc.attack_speed,
                    description: assoc.description,
                    upvotes: 0,
                    downvotes: 0,
                    vote_score: 0,
                    user_vote: 0,
                    loot_items: assoc.loot_items || []
                  })
                }
              } catch (err) {
                console.warn(`Failed to copy NPC association for NPC ${assoc.npcid || assoc.npc_id}:`, err)
              }
            }
            
            // Update the POI in cache with successful associations
            if (successfulAssociations.length > 0) {
              const poiIndex = dbMapData.value[maps.value[selectedMapIndex.value].id].pois.findIndex(p => p.id === processedPOI.id)
              if (poiIndex !== -1) {
                dbMapData.value[maps.value[selectedMapIndex.value].id].pois[poiIndex].npc_associations = successfulAssociations
                // Only mark as multi_mob if we successfully added multiple NPCs
                if (successfulAssociations.length > 1) {
                  dbMapData.value[maps.value[selectedMapIndex.value].id].pois[poiIndex].multi_mob = true
                }
              }
            }
          } else if (poi.npc_id && !poi.multi_mob) {
            // For single NPC POIs, just copy the npc_id (already done in the save)
          }
          
          success(`POI "${newName}" created successfully`)
        } else {
          // Non-admin users
          // Check if it's a custom POI (either by is_custom flag or by ID prefix)
          const isCustom = poi.is_custom || poi.id.toString().startsWith('custom_') || dragItemType.value === 'customPoi'
          
          if (isCustom) {
          // Copy custom POI - create new custom POI immediately
          // Get the numeric custom POI ID
          const customPoiId = poi.id.toString().replace('custom_', '')
          const customPoiData = customPOIs.value.find(cp => cp.id.toString() === customPoiId)
          
          const response = await fetchWithCSRF('/api/custom-pois', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              map_id: maps.value[selectedMapIndex.value].id,
              x: newX,
              y: newY,
              name: newName.trim(),
              description: poi.description || '',
              icon: poi.icon || null,
              icon_type: poi.icon_type || null,
              icon_size: poi.icon_size || 48,
              label_visible: poi.label_visible !== false,
              label_position: poi.label_position || 'bottom',
              type_id: poi.type_id || customPoiData?.type_id || customPoiData?.poi_type_id || poi.poi_type_id || null,
              npc_id: poi.npc_id || null
            })
          })
          
          if (!response.ok) {
            throw new Error('Failed to copy custom POI')
          }
          
          const newPoi = await response.json()
          
          // Add the new custom POI to our local state
          // The response from the API should already have the correct structure
          customPOIs.value.push(newPoi)
          
          // If this is a multi-mob POI, prepare to store the associations
          let copiedAssociations = []
          
          // Copy NPC associations if the original POI has any
          if (poi.npc_id || npcAssociations.length > 0) {
            try {
              // First check if this is a multi-mob POI
              let isMultiMob = poi.multi_mob || false
              
              if (!isMultiMob && poi.type_id) {
                // Only fetch if we don't already have the multi_mob flag
                const typeResponse = await fetch(`/api/poi-types/${poi.type_id}`)
                if (typeResponse.ok) {
                  const typeData = await typeResponse.json()
                  isMultiMob = typeData.multi_mob
                }
              }
              
              if (isMultiMob && npcAssociations.length > 0) {
                // Copy all NPC associations for multi-mob POIs
                for (const assoc of npcAssociations) {
                  const npcId = assoc.npcid || assoc.npc_id
                  await fetchWithCSRF(`/api/pois/custom_${newPoi.id}/npcs`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                      npc_id: npcId
                    })
                  })
                  // Add to local associations array
                  copiedAssociations.push({
                    ...assoc,
                    poi_id: newPoi.id
                  })
                }
                // Update the new POI in our local state with the associations
                const poiIndex = customPOIs.value.findIndex(p => p.id === newPoi.id)
                if (poiIndex !== -1) {
                  customPOIs.value[poiIndex] = {
                    ...customPOIs.value[poiIndex],
                    npc_associations: copiedAssociations,
                    multi_mob: true
                  }
                }
              } else if (poi.npc_id && !isMultiMob) {
                // For non-multi-mob POIs, update the custom POI with the npc_id
                await fetchWithCSRF(`/api/custom-pois/${newPoi.id}`, {
                  method: 'PUT',
                  headers: {
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    ...newPoi,
                    npc_id: poi.npc_id
                  })
                })
              }
            } catch (err) {
              console.warn('Failed to copy NPC associations:', err)
              // Don't fail the entire copy operation if NPC copy fails
            }
          }
          
          success(`Custom POI "${poi.name}" copied successfully`)
        } else {
          // Copy regular POI - create new POI proposal
          const proposalData = {
            change_type: 'add_poi',
            target_type: 'map',
            target_id: maps.value[selectedMapIndex.value].id,
            proposed_data: {
              map_id: maps.value[selectedMapIndex.value].id,
              x: newX,
              y: newY,
              name: newName.trim(),
              description: poi.description || '',
              type_id: poi.type_id || poi.type || null,
              icon_size: poi.icon_size || 48,
              label_visible: poi.label_visible !== false,
              label_position: poi.label_position || 'bottom',
              // Include NPC associations in the proposal
              npc_id: poi.npc_id || null,
              npc_associations: npcAssociations
            }
          }
          
          const response = await fetchWithCSRF('/api/change-proposals', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(proposalData)
          })
          
          if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || 'Failed to create copy proposal')
          }
          
          success(`Copy proposal for "${poi.name}" submitted for community voting`)
        }
        } // End of non-admin users block
        
        render()
      } catch (err) {
        console.error('Failed to copy POI:', err)
        error(`Failed to copy POI: ${err.message}`)
        render()
      }
    }
    
    // Process a single POI to extract icon from type data
    const processPOI = (poi) => {
      let icon = poi.icon
      let iconType = 'emoji' // default
      
      // Check if POI has type information from poi_types table
      if (poi.type_icon_type && poi.type_icon_value) {
        if (poi.type_icon_type === 'emoji') {
          icon = poi.type_icon_value
          iconType = 'emoji'
        } else if (poi.type_icon_type === 'iconify' || poi.type_icon_type === 'fontawesome') {
          icon = poi.type_icon_value
          iconType = poi.type_icon_type
        } else if (poi.type_icon_type === 'upload') {
          icon = poi.type_icon_value
          iconType = 'upload'
        }
      }
      
      // If we still don't have an icon, fallback to POI's direct icon or default
      if (!icon) {
        // For proposal previews, don't add a default pin icon
        icon = poi.icon || (poi.is_proposal ? '' : '📍')
      }
      
      return {
        ...poi,
        icon: icon,
        icon_type: iconType,
        icon_size: poi.icon_size || 48, // Preserve icon_size with default of 48
        // Keep the original type data for reference
        poi_type: poi.type_name ? {
          name: poi.type_name,
          icon_type: poi.type_icon_type,
          icon_value: poi.type_icon_value
        } : null
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
          type_id: poiData.type_id,
          icon: null, // Icon will come from POI type
          icon_size: 48,
          label_visible: true,
          label_position: 'bottom'
        })
        
        // Process the POI to extract icon from type data
        const processedPOI = processPOI(newPOI)
        
        // Update local cache
        if (!dbMapData.value[map.id]) {
          dbMapData.value[map.id] = { pois: [], connections: [], connectors: [] }
        }
        dbMapData.value[map.id].pois.push(processedPOI)
        
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
            labelPosition: connectorData.labelPosition || 'bottom',
            labelScale: connectorData.labelScale || 1
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
            // Connecting to a POI - verify it's a regular POI
            const poiId = pendingConnector.value.poiId
            
            // Double-check this isn't a custom POI
            if (poiId.toString().startsWith('custom_')) {
              error('Cannot create connections to custom POIs')
              pendingConnectorPair.value = { first: null, second: null }
              pendingConnector.value = null
              return
            }
            
            // Verify the POI exists in regular POIs
            const poi = findEntityById(currentMapData.value.pois, poiId)
            if (!poi) {
              error('Invalid POI selected for connection')
              pendingConnectorPair.value = { first: null, second: null }
              pendingConnector.value = null
              return
            }
            
            toPoiId = poiId
            toX = null
            toY = null
            secondLabel = poi.name
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
            to_icon_visible: !(connectorData.invisibleIcon || false),
            from_label_size: firstData.labelScale || 1,
            to_label_size: connectorData.labelScale || 1
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
            labelScale: newConnector.from_label_size || 1,
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
              labelScale: newConnector.to_label_size || 1,
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
    
    const deletePOI = async (poiIdOrRef) => {
      
      // Create context for entity type inference
      const context = {
        pois: currentMapData.value?.pois || [],
        customPOIs: customPOIs.value || []
      }
      
      // Parse the entity reference (supports both legacy ID and new {type, id} format)
      const entityRef = parseEntityReference(poiIdOrRef, context)
      
      // First, check if we're deleting the currently selected POI
      // This is the most reliable way to determine if it's custom or regular
      let isCustomPOI = false
      let poiToDelete = null
      
      
      if (selectedPOI.value && isSameEntity(selectedPOI.value.id, entityRef.numericId || entityRef.id)) {
        // We're deleting the selected POI - trust its is_custom flag
        isCustomPOI = selectedPOI.value.is_custom === true
        poiToDelete = selectedPOI.value
      }
      
      if (!poiToDelete) {
        // Use entity type to determine where to look
        if (entityRef.type === EntityTypes.CUSTOM_POI) {
          isCustomPOI = true
          poiToDelete = findEntityById(customPOIs.value, entityRef.numericId || entityRef.id)
        } else if (entityRef.type === EntityTypes.POI) {
          isCustomPOI = false
          poiToDelete = findEntityById(currentMapData.value?.pois || [], entityRef.numericId || entityRef.id)
          if (poiToDelete) {
          }
        } else {
          // No type specified - use the safer approach of checking regular POIs first
          
          // IMPORTANT: We should NOT be here if we're deleting from the POI popup
          // The POI popup should always have selectedPOI set
          console.warn('WARNING: Deleting POI without selectedPOI set. This may cause issues!')
          
          // As a fallback, check regular POIs first (safer default)
          const map = maps.value[selectedMapIndex.value]
          if (map.id && dbMapData.value[map.id]) {
            poiToDelete = findEntityById(dbMapData.value[map.id].pois, entityRef.numericId || entityRef.id)
            if (poiToDelete) {
              isCustomPOI = false
            }
          }
          
          // Only check custom POIs if not found in regular POIs
          if (!poiToDelete) {
            poiToDelete = findEntityById(customPOIs.value, entityRef.numericId || entityRef.id)
            if (poiToDelete) {
              isCustomPOI = true
            }
          }
          
          const searchId = entityRef.numericId || entityRef.id
        }
      }
      
      if (!poiToDelete) {
        console.error(`POI with ID ${entityRef.id} not found`)
        error('POI not found')
        return
      }
      
      if (isCustomPOI) {
        // Handle custom POI deletion
        const actualId = poiToDelete.id
        
        const confirmed = await showConfirm(
          'Delete Custom POI',
          `Delete custom POI "${poiToDelete.name || 'Unnamed'}"? This will also remove it from anyone you shared it with.`,
          'Delete',
          'Cancel'
        )
        
        if (!confirmed) return
        
        try {
          const response = await fetchWithCSRF(`/api/custom-pois/${actualId}`, {
            method: 'DELETE'
          })
          
          if (response.ok) {
            success('Custom POI deleted')
            await loadCustomPOIs()
            await loadAllCustomPOIs() // Update global search
            
            // Clear selected POI if it's the one being deleted
            // Need to handle both prefixed and non-prefixed IDs
            if (selectedPOI.value) {
              const selectedId = selectedPOI.value.id.toString().replace('custom_', '')
              if (selectedId === actualId.toString()) {
                selectedPOI.value = null
              }
            }
            render()
          } else {
            error('Failed to delete custom POI')
          }
        } catch (err) {
          console.error('Failed to delete custom POI:', err)
          error('Failed to delete custom POI')
        }
        return
      }
      
      // Handle regular POI deletion
      const map = maps.value[selectedMapIndex.value]
      
      if (!map.id || !dbMapData.value[map.id]) {
        error('Cannot delete POI: Map is not connected to database')
        return
      }
      
      try {
        
        // Show confirmation dialog
        const confirmed = await showConfirm(
          'Delete POI',
          `Delete POI "${poiToDelete.name || 'Unnamed'}"? This action cannot be undone.`,
          'Delete',
          'Cancel'
        )
        
        if (!confirmed) return
        
        const numericPoiId = typeof poiToDelete.id === 'string' && !isNaN(poiToDelete.id) ? parseInt(poiToDelete.id) : poiToDelete.id
        
        // Use fetchWithCSRF for proper authentication
        const response = await fetchWithCSRF(`/api/pois/${numericPoiId}`, {
          method: 'DELETE'
        })
        
        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.details || errorData.error || `${response.status} ${response.statusText}`)
        }
        
        // Update local cache (use numericPoiId for comparison)
        dbMapData.value[map.id].pois = dbMapData.value[map.id].pois.filter(p => p.id !== numericPoiId)
        
        // Clear selected POI if it's the one being deleted
        if (selectedPOI.value && isSameEntity(selectedPOI.value.id, numericPoiId)) {
          selectedPOI.value = null
        }
        render()
        success(`POI "${poiToDelete.name}" deleted successfully`)
      } catch (err) {
        console.error('Failed to delete POI:', err)
        
        // Check for specific error types
        if (err.message && err.message.includes('403')) {
          error('Cannot delete POI: Admin privileges required')
          warning('Please ensure you are logged in as an admin with admin mode enabled')
        } else if (err.message && err.message.includes('401')) {
          error('Cannot delete POI: Authentication required')
          warning('Please log in to delete POIs')
        } else {
          error(`Failed to delete POI: ${err.message || 'Database error'}`)
          warning('Please check your internet connection and try again')
        }
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
          const poiIndex = dbMapData.value[map.id].pois.findIndex(p => isSameEntity(p.id, updatedItem.id))
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
          const connIndex = dbMapData.value[map.id].zoneConnectors?.findIndex(c => isSameEntity(c.id, updatedItem.id))
          
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
          
          if (updatedItem.labelScale !== undefined) {
            if (isFromSide) {
              connectorToUpdate.from_label_size = updatedItem.labelScale
            } else {
              connectorToUpdate.to_label_size = updatedItem.labelScale
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
              uiConnector.labelScale = updatedConnector.from_label_size || 1
            } else {
              uiConnector.icon = updatedConnector.to_icon
              uiConnector.customIcon = updatedConnector.to_icon
              uiConnector.iconSize = updatedConnector.to_icon_size
              uiConnector.labelPosition = updatedConnector.to_label_position
              uiConnector.labelScale = updatedConnector.to_label_size || 1
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
        const offsetY = -35
        
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
          const poiToUpdate = findEntityById(dbMapData.value[map.id].pois, id)
          if (poiToUpdate) {
            // Update in database
            const updatedPOI = await poisAPI.save({
              ...poiToUpdate,
              [field]: newValue
            })
            
            // Update local cache
            const poiIndex = dbMapData.value[map.id].pois.findIndex(p => isSameEntity(p.id, id))
            if (poiIndex !== -1) {
              dbMapData.value[map.id].pois[poiIndex] = updatedPOI
            }
            
            // Update selectedPOI to reflect the change
            if (selectedPOI.value && isSameEntity(selectedPOI.value.id, id)) {
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
    
    const showEditProposalDialog = async (poi) => {
      // Check if POI already has a pending proposal
      if (poi.has_pending_proposal) {
        warning('This POI already has a pending change proposal')
        return
      }
      
      // Fetch full POI data with associations
      try {
        const response = await fetch(`/api/pois/${poi.id}/full`)
        if (response.ok) {
          const fullPOI = await response.json()
          editProposalDialog.value.poi = fullPOI
          editProposalDialog.value.visible = true
        } else {
          error('Failed to load POI details')
        }
      } catch (err) {
        error('Failed to load POI details')
      }
    }
    
    const showDeleteProposalDialog = async (poi) => {
      // Check if POI already has a pending proposal
      if (poi.has_pending_proposal) {
        warning('This POI already has a pending change proposal')
        return
      }
      
      deleteProposalDialog.value.poi = poi
      deleteProposalDialog.value.visible = true
    }
    
    const showLootProposalDialog = async (poi) => {
      // Check if POI already has a pending proposal
      if (poi.has_pending_proposal) {
        warning('This POI already has a pending change proposal')
        return
      }
      
      // Ensure POI has an NPC associated
      if (!poi.npc_id) {
        warning('This POI must have an NPC associated to propose loot')
        return
      }
      
      // Check if this is from a multi-mob POI with selected NPC data
      if (poi._selected_npc) {
        // Create a POI data object with the selected NPC info
        const poiWithNPC = {
          ...poi,
          npc_name: poi._selected_npc.name,
          npc_level: poi._selected_npc.level,
          npc_id: poi._selected_npc.npcid
        }
        lootProposalDialog.value.poi = poiWithNPC
        lootProposalDialog.value.visible = true
      } else {
        // Fetch full POI data with NPC info for single-NPC POIs
        try {
          const response = await fetch(`/api/pois/${poi.id}/full`)
          if (!response.ok) throw new Error('Failed to fetch POI data')
          const fullPoiData = await response.json()
          
          
          lootProposalDialog.value.poi = fullPoiData
          lootProposalDialog.value.visible = true
        } catch (err) {
          error('Failed to load POI data')
          console.error('Error fetching POI:', err)
        }
      }
    }
    
    const showItemProposalDialog = () => {
      itemProposalDialog.value.visible = true
      itemDropdownVisible.value = false
    }
    
    // Item dropdown methods
    const toggleItemDropdown = () => {
      itemDropdownVisible.value = !itemDropdownVisible.value
    }
    
    const showItemEditSelection = () => {
      itemSearchDialog.value.visible = true
      itemDropdownVisible.value = false
    }
    
    const handleItemProposalSelected = (item) => {
      // Show the edit proposal dialog with the selected item
      itemEditProposalDialog.value.item = item
      itemEditProposalDialog.value.visible = true
    }
    
    // Handle item selection from search (shows item info modal)
    const handleItemSelected = async (item) => {
      // If we only have partial item data, fetch the full item
      if (item.id && !item.damage && !item.weight) {
        try {
          const response = await fetch(`/api/items/${item.id}`)
          if (response.ok) {
            const fullItem = await response.json()
            itemInfoModal.value.item = fullItem
          } else {
            // Fallback to partial data if fetch fails
            itemInfoModal.value.item = item
          }
        } catch (error) {
          console.error('Error fetching full item data:', error)
          itemInfoModal.value.item = item
        }
      } else {
        itemInfoModal.value.item = item
      }
      itemInfoModal.value.visible = true
    }
    
    // Handle NPC selection from search or item modal
    const handleNPCSelected = (npc) => {
      // Close item modal if open
      if (itemInfoModal.value.visible) {
        itemInfoModal.value.visible = false
      }
      npcListModal.value.npc = npc
      npcListModal.value.visible = true
    }

    // Handle item selection from NPC modal
    const handleItemSelectedFromNPC = async (item) => {
      // Close NPC modal
      npcListModal.value.visible = false
      // Open item modal using the existing handler
      await handleItemSelected(item)
    }
    
    // Handle POI navigation from NPC modal
    const handlePOINavigation = async (poi) => {
      // Close the NPC modal
      npcListModal.value.visible = false
      
      // Show loading state if switching maps
      if (poi.map_id !== currentMapId.value) {
        isTransitioningMap.value = true
      }
      
      // Use existing handlePOISelected logic
      await handlePOISelected(poi)
      
      // Clear loading state
      isTransitioningMap.value = false
    }
    
    const showNPCProposalDialog = () => {
      npcProposalDialog.value.visible = true
    }
    
    const showNPCEditProposal = async (poi) => {
      // Check if POI has an NPC associated
      if (!poi.npc_id) {
        warning('This POI must have an NPC associated to propose edits')
        return
      }
      
      // Check if this is from a multi-mob POI with selected NPC data
      if (poi._selected_npc) {
        // Use the pre-selected NPC data from multi-mob list
        npcEditProposalDialog.value.npc = poi._selected_npc
        npcEditProposalDialog.value.visible = true
      } else {
        // Fetch full NPC data for single-NPC POIs
        try {
          const response = await fetch(`/api/npcs/${poi.npc_id}`)
          if (response.ok) {
            const npcData = await response.json()
            npcEditProposalDialog.value.npc = npcData
            npcEditProposalDialog.value.visible = true
          } else {
            error('Failed to load NPC details')
          }
        } catch (err) {
          error('Failed to load NPC details')
        }
      }
    }
    
    const showItemEditProposal = async (item) => {
      // Item data is already passed from the tooltip
      itemEditProposalDialog.value.item = item
      itemEditProposalDialog.value.visible = true
    }
    
    const showProposalNPCs = (proposal) => {
      if (proposal && proposal.npc_associations) {
        proposalNPCsList.value = proposal.npc_associations
        showProposalNPCsModal.value = true
      }
    }
    
    const closeProposalNPCsModal = () => {
      showProposalNPCsModal.value = false
      proposalNPCsList.value = []
    }
    
    const showAddNPCDialog = async () => {
      // Check if POI is multi-mob type
      if (!selectedPOI.value) return
      
      // Show NPC selection dialog
      addNPCDialog.value.poi = selectedPOI.value
      addNPCDialog.value.visible = true
    }
    
    const handleProposalSubmitted = async () => {
      // Refresh the POI data to show pending proposal indicator
      await loadSelectedMap()
      
      // Close POI popup if open
      selectedPOI.value = null
    }
    
    const handleNPCAdded = async (npc) => {
      // Refresh the POI popup to show the newly added NPC
      if (selectedPOI.value) {
        // Trigger a re-fetch of NPC data in the popup
        selectedPOI.value = { ...selectedPOI.value }
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
        const connection = findEntityById(dbMapData.value[map.id].zoneConnectors, connectionId)
        
        if (connection) {
          await zoneConnectorsAPI.delete(connectionId)
          
          // Update local cache
          if (dbMapData.value[map.id].zoneConnectors) {
            dbMapData.value[map.id].zoneConnectors = dbMapData.value[map.id].zoneConnectors.filter(c => !isSameEntity(c.id, connectionId))
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
                      pendingChange.value.type === 'customPoi' ? 'Custom POI' :
                      pendingChange.value.type === 'connection' ? 'Connection' : 'Connector'
      const itemName = pendingChange.value.item.name || pendingChange.value.item.label
      
      if (!map.id || !dbMapData.value[map.id]) {
        error('Cannot move item: Map is not connected to database')
        cancelPendingChange()
        return
      }
      
      try {
        if (pendingChange.value.type === 'poi') {
          // Check if this is a proposal drag
          if (pendingChange.value.item.isProposalDrag) {
            // Create a move proposal instead of directly updating
            const poi = pendingChange.value.item
            const proposalData = {
              change_type: 'move_poi',
              target_type: 'poi',
              target_id: poi.id,
              current_data: {
                poi_id: poi.id,
                x: pendingChange.value.originalPosition.x,
                y: pendingChange.value.originalPosition.y,
                name: poi.name
              },
              proposed_data: {
                poi_id: poi.id,
                x: Math.round(pendingChange.value.newPosition.x),
                y: Math.round(pendingChange.value.newPosition.y),
                name: poi.name,
                type_id: poi.type_id,
                map_id: map.id
              }
            }
            
            const response = await fetchWithCSRF('/api/change-proposals', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(proposalData)
            })
            
            if (!response.ok) {
              const error = await response.json()
              throw new Error(error.error || 'Failed to create move proposal')
            }
            
            success(`Move proposal for "${poi.name}" submitted for community voting`)
            
            // Reset the POI position to original since it's just a proposal
            pendingChange.value.item.x = pendingChange.value.originalPosition.x
            pendingChange.value.item.y = pendingChange.value.originalPosition.y
          } else {
            // Admin direct update
            await poisAPI.save({
              ...pendingChange.value.item,
              x: Math.round(pendingChange.value.newPosition.x),
              y: Math.round(pendingChange.value.newPosition.y)
            })
          }
        } else if (pendingChange.value.type === 'customPoi') {
          // Update custom POI position
          // Ensure we're using a numeric ID without any prefix
          const customPoiId = pendingChange.value.item.id.toString().replace('custom_', '')
          const response = await fetchWithCSRF(`/api/custom-pois/${customPoiId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              ...pendingChange.value.item,
              x: Math.round(pendingChange.value.newPosition.x),
              y: Math.round(pendingChange.value.newPosition.y)
            })
          })
          
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            console.error('Custom POI update failed:', {
              status: response.status,
              error: errorData,
              poiId: pendingChange.value.item.id
            })
            throw new Error(errorData.error || 'Failed to update custom POI position')
          }
          
          // Update local state
          const index = customPOIs.value.findIndex(p => p.id.toString() === customPoiId)
          if (index !== -1) {
            customPOIs.value[index] = {
              ...customPOIs.value[index],
              x: Math.round(pendingChange.value.newPosition.x),
              y: Math.round(pendingChange.value.newPosition.y)
            }
          }
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
                to_icon_visible: dbConnector.to_icon_visible,
                from_label_size: dbConnector.from_label_size,
                to_label_size: dbConnector.to_label_size
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
                  labelScale: pc.from_label_size || 1,
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
                    labelScale: pc.to_label_size || 1,
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
        
        // Show appropriate success message
        const wasProposalDrag = pendingChange.value?.item?.isProposalDrag
        
        pendingChange.value = null
        render()
        
        if (!wasProposalDrag) {
          success(`${itemType} "${itemName}" moved successfully`)
        }
        // Proposal success message is already shown in the proposal branch
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
    
    let globalContextMenuHandler = null
    let globalMouseUpHandler = null
    
    // Close dropdowns when clicking outside
    const closeDropdowns = (event) => {
      // Close user dropdown if clicking outside
      if (showUserDropdown.value && !event.target.closest('.user-dropdown-container')) {
        showUserDropdown.value = false
      }
      // Close item dropdown if clicking outside
      if (itemDropdownVisible.value && !event.target.closest('.control-btn-dropdown')) {
        itemDropdownVisible.value = false
      }
    }
    
    // Animation loop removed - render is now called only when needed
    // This improves performance and prevents Vue reactivity warnings
    
    const loginWithGoogle = () => {
      window.location.href = '/auth/google';
    }
    
    // User dropdown methods
    const toggleUserDropdown = () => {
      showUserDropdown.value = !showUserDropdown.value
    }
    
    const handleLogout = async () => {
      try {
        const response = await fetchWithCSRF('/api/auth/logout', {
          method: 'POST'
        })
        
        if (response.ok) {
          window.location.href = '/'
        }
      } catch (error) {
        console.error('Error logging out:', error)
      }
    }
    
    // Close dropdown when clicking outside
    const closeUserDropdown = () => {
      showUserDropdown.value = false
    }
    
    // Handle avatar loading error by falling back to Google avatar
    const handleAvatarError = async (event) => {
      
      // Don't retry if we're already trying the Google picture
      if (event.target.src.includes('/api/user/google-picture') || 
          event.target.src.includes('googleusercontent.com')) {
        event.target.style.display = 'none'
        return
      }
      
      // Check if this is a missing custom avatar
      if (user.value?.avatarState?.hasCustomAvatar && user.value?.avatarState?.avatarMissing) {
        
        // Try to recover the avatar
        try {
          const { fetchWithCSRF } = useCSRF()
          const recoverResponse = await fetchWithCSRF('/api/user/profile/avatar/recover', {
            method: 'POST'
          })
          
          if (recoverResponse.ok) {
            // Wait a moment for file to be written
            setTimeout(() => {
              checkAuthStatus()
            }, 500)
            return
          }
        } catch (error) {
          console.error('Avatar recovery failed:', error)
        }
      }
      
      // Fall back to Google picture
      try {
        const response = await fetch('/api/user/google-picture')
        if (response.ok) {
          const data = await response.json()
          if (data.picture && event.target.src !== data.picture) {
            event.target.src = data.picture
            
            // Update the user object to prevent retry loops
            if (user.value) {
              user.value.picture = data.picture
            }
            
            // Don't immediately refresh auth status to avoid loops
            return
          }
        }
      } catch (error) {
        console.error('Error fetching Google picture:', error)
      }
      
      // If that fails, hide the image and show initials
      event.target.style.display = 'none'
    }
    
    // Custom POI methods
    // Load all POIs from all maps for global search
    const loadAllPOIsForSearch = async () => {
      try {
        // Load POIs for all maps that haven't been loaded yet
        const loadPromises = maps.value.map(async (map) => {
          // Skip if we already have data for this map
          if (dbMapData.value[map.id]?.pois) {
            return
          }
          
          try {
            const response = await fetch(`/api/maps/${map.id}`)
            if (response.ok) {
              const mapData = await response.json()
              // Process POIs to extract icon from type data
              const processedPOIs = (mapData.pois || []).map(poi => processPOI(poi))
              
              // Store ONLY POIs for search to avoid interfering with map display
              if (!dbMapData.value[map.id]) {
                // Create a minimal entry just for search
                dbMapData.value[map.id] = {
                  pois: processedPOIs,
                  // Empty arrays - these will be properly loaded when map is visited
                  connections: [],
                  connectors: [],
                  zoneConnectors: [],
                  // Mark this as search-only to force reload when map is visited
                  searchOnly: true
                }
              } else if (dbMapData.value[map.id].searchOnly) {
                // Update search-only POIs
                dbMapData.value[map.id].pois = processedPOIs
              }
              // If we have full data (!searchOnly), don't touch it
            }
          } catch (error) {
            console.error(`Failed to load POIs for map ${map.id}:`, error)
          }
        })
        
        await Promise.all(loadPromises)
      } catch (error) {
        console.error('Failed to load all POIs:', error)
      }
    }
    
    // Load all custom POIs across all maps for global search
    const allCustomPOIs = ref([])
    
    const loadAllCustomPOIs = async () => {
      if (!isAuthenticated.value || user.value?.isBanned) return
      
      try {
        const response = await fetch('/api/custom-pois')
        if (response.ok) {
          const pois = await response.json()
          allCustomPOIs.value = pois.map(poi => {
            // Set the icon based on the POI type data
            let icon = null
            let iconType = null
            
            if (poi.type_icon_type === 'emoji') {
              icon = poi.type_icon_value
              iconType = 'emoji'
            } else if (poi.type_icon_type === 'iconify' || poi.type_icon_type === 'fontawesome') {
              icon = poi.type_icon_value
              iconType = poi.type_icon_type
            } else if (poi.type_icon_type === 'upload') {
              icon = poi.type_icon_value
              iconType = 'upload'
            }
            
            if (!icon) {
              icon = '📍'
            }
            
            return {
              ...poi,
              is_custom: true,
              icon: icon,
              icon_type: iconType,
              poi_type: {
                name: poi.type_name,
                icon_type: poi.type_icon_type,
                icon_value: poi.type_icon_value
              }
            }
          })
        }
      } catch (error) {
        console.error('Failed to load all custom POIs:', error)
      }
    }
    
    const loadCustomPOIs = async () => {
      if (!isAuthenticated.value || !maps.value[selectedMapIndex.value]?.id) return
      
      try {
        const response = await fetch(`/api/maps/${maps.value[selectedMapIndex.value].id}/custom-pois`)
        if (response.ok) {
          const pois = await response.json()
          console.log('[loadCustomPOIs] Loaded custom POIs:', pois.map(p => ({ id: p.id, name: p.name, status: p.status })))
          // Mark POIs as custom for proper identification and set icon from POI type
          customPOIs.value = pois.map(poi => {
            // Set the icon based on the POI type data
            let icon = null
            let iconType = null
            
            if (poi.type_icon_type === 'emoji') {
              icon = poi.type_icon_value
              iconType = 'emoji'
            } else if (poi.type_icon_type === 'iconify' || poi.type_icon_type === 'fontawesome') {
              // Now we support rendering these icons!
              icon = poi.type_icon_value
              iconType = poi.type_icon_type
            } else if (poi.type_icon_type === 'upload') {
              // Support uploaded images too
              icon = poi.type_icon_value
              iconType = 'upload'
            }
            
            // Ensure we always have an icon
            if (!icon) {
              console.warn(`Custom POI "${poi.name}" has invalid icon type: ${poi.type_icon_type}`)
              icon = '📍' // Default pin if all else fails
            }
            
            return {
              ...poi,
              is_custom: true,
              icon: icon,
              icon_type: iconType,
              multi_mob: poi.multi_mob || false,
              npc_associations: poi.npc_associations || [],
              // Keep the original type data for reference
              poi_type: {
                name: poi.type_name,
                icon_type: poi.type_icon_type,
                icon_value: poi.type_icon_value
              },
              // Add callback for when icon loads
              onIconLoad: () => {
                render() // Re-render when icon is loaded
              }
            }
          })
          
          // Preload non-emoji icons
          customPOIs.value.forEach(poi => {
            if (poi.icon_type && poi.icon_type !== 'emoji' && poi.icon) {
              // Use the loadIconImage function to preload the icon
              loadIconImage(poi.icon_type, poi.icon)
            }
          })
          
          render() // Re-render to show custom POIs
        }
      } catch (error) {
        console.error('Error loading custom POIs:', error)
      }
    }
    
    // Animation frame ID for proposal animations
    let proposalAnimationId = null
    
    // Start or stop proposal animation based on whether there are proposals
    const updateProposalAnimation = () => {
      const hasAnimatedPOIs = filteredPOIs.value.some(poi => 
        poi.is_proposal || 
        poi.has_pending_proposal || 
        poi.has_move_proposal || 
        poi.has_edit_proposal || 
        poi.has_deletion_proposal ||
        poi.has_loot_proposal ||
        poi.has_npc_proposal ||
        (poi.is_custom && poi.is_shared_active) // Include shared POIs
      )
      
      if (hasAnimatedPOIs && !proposalAnimationId) {
        // Start animation loop
        const animateProposals = () => {
          render()
          proposalAnimationId = requestAnimationFrame(animateProposals)
        }
        animateProposals()
      } else if (!hasAnimatedPOIs && proposalAnimationId) {
        // Stop animation loop
        cancelAnimationFrame(proposalAnimationId)
        proposalAnimationId = null
      }
    }
    
    // Load pending proposals for the current map
    const loadPendingProposals = async () => {
      if (!maps.value[selectedMapIndex.value]?.id) return
      
      try {
        const response = await fetch('/api/change-proposals')
        if (response.ok) {
          const allProposals = await response.json()
          
          // Filter proposals for current map that are POI-related
          const currentMapId = maps.value[selectedMapIndex.value].id
          pendingProposals.value = allProposals.filter(proposal => 
            proposal.status === 'pending' &&
            proposal.map_id === currentMapId &&
            ['add_poi', 'edit_poi', 'move_poi', 'delete_poi', 'change_loot', 'edit_npc'].includes(proposal.change_type)
          )
          
          
          render() // Re-render to show proposals if filter is active
          updateProposalAnimation() // Start animation if needed
        }
      } catch (error) {
        console.error('Error loading pending proposals:', error)
      }
    }
    
    const createCustomPOI = () => {
      selectedCustomPOI.value = null
      customPOIDialogVisible.value = true
    }
    
    const editCustomPOI = (poi) => {
      selectedCustomPOI.value = poi
      customPOIDialogVisible.value = true
    }
    
    const publishCustomPOI = async (poiId) => {
      // Handle both prefixed and unprefixed IDs
      const actualId = poiId.toString().startsWith('custom_') ? 
        parseInt(poiId.toString().replace('custom_', '')) : 
        poiId
      const poi = customPOIs.value.find(p => p.id === actualId)
      if (!poi) return
      
      const confirmed = await showConfirm(
        'Publish POI',
        `Submit "${poi.name}" for community approval? Once published, it cannot be edited.`,
        'Publish',
        'Cancel'
      )
      
      if (!confirmed) return
      
      try {
        const response = await fetchWithCSRF(`/api/custom-pois/${actualId}/publish`, {
          method: 'POST'
        })
        
        if (response.ok) {
          const data = await response.json()
          success('POI submitted for community approval')
          
          // Update user's XP if awarded - the XPBar component will detect the change and animate
          if (data.xpAwarded && data.xpAwarded > 0 && user.value) {
            user.value.xp = data.newTotalXP
          }
          
          await loadCustomPOIs() // Refresh to get updated status
          await loadAllCustomPOIs() // Update global search
          
          // Update the selected POI status if it's still open
          if (selectedPOI.value && selectedPOI.value.id === poiId) {
            selectedPOI.value = { 
              ...selectedPOI.value, 
              status: 'pending',
              vote_score: 1,  // Creator's automatic upvote
              upvotes: 1,
              downvotes: 0
            }
          }
        } else {
          const data = await response.json()
          error(data.error || 'Failed to publish POI')
        }
      } catch (err) {
        console.error('Error publishing POI:', err)
        error('Failed to publish POI')
      }
    }
    
    const deleteCustomPOI = async (poi) => {
      if (!confirm('Delete this custom POI? This will also remove it from anyone you shared it with.')) {
        return
      }
      
      try {
        const response = await fetchWithCSRF(`/api/custom-pois/${poi.id}`, {
          method: 'DELETE'
        })
        
        if (response.ok) {
          success('Custom POI deleted')
          await loadCustomPOIs()
        } else {
          error('Failed to delete custom POI')
        }
      } catch (err) {
        error('Failed to delete custom POI')
      }
    }
    
    const saveCustomPOI = async (data) => {
      try {
        const url = selectedCustomPOI.value 
          ? `/api/custom-pois/${selectedCustomPOI.value.id}`
          : '/api/custom-pois'
        
        const method = selectedCustomPOI.value ? 'PUT' : 'POST'
        
        const response = await fetchWithCSRF(url, {
          method,
          body: data
        })
        
        if (response.ok) {
          success(selectedCustomPOI.value ? 'Custom POI updated' : 'Custom POI created')
          customPOIDialogVisible.value = false
          await loadCustomPOIs()
          await loadAllCustomPOIs() // Update global search
        } else {
          error('Failed to save custom POI')
        }
      } catch (err) {
        error('Failed to save custom POI')
      }
    }
    
    // Save filter settings whenever they change
    watch(mapFilters, () => {
      saveFilterSettings()
    }, { deep: true })
    
    // Load custom POIs when map changes
    watch(() => maps.value[selectedMapIndex.value]?.id, () => {
      if (isAuthenticated.value) {
        loadCustomPOIs()
      }
      // Clear proposal preview when changing maps
      proposalPreviewPOIs.value = []
      proposalPreviewConnection.value = null
      hiddenCustomPOIId.value = null
      
      // Clear temporary pending proposal marking
      if (tempPendingProposalPOI.value) {
        tempPendingProposalPOI.value.has_pending_proposal = false
        tempPendingProposalPOI.value = null
      }
    })
    
    // Watch for user changes to ensure non-admins can't have admin mode
    watch(user, (newUser) => {
      if (!newUser || !newUser.is_admin) {
        isAdmin.value = false
      }
    })
    
    // Hide context menu when clicking elsewhere
    const hideContextMenu = () => {
      contextMenuVisible.value = false
    }
    
    // XP polling for real-time updates
    let xpPollingInterval = null
    
    const pollForXPUpdates = async () => {
      if (!isAuthenticated.value) return
      
      try {
        const response = await fetch('/api/auth/status')
        if (response.ok) {
          const data = await response.json()
          if (data.authenticated && data.user.xp !== user.value?.xp) {
            // Update user object with new XP
            user.value = { ...user.value, xp: data.user.xp }
          }
        }
      } catch (error) {
        console.error('Error polling for XP updates:', error)
      }
    }
    
    // Store custom POI ID to hide temporarily
    const hiddenCustomPOIId = ref(null)
    // Store POI that we temporarily marked as having pending proposal
    const tempPendingProposalPOI = ref(null)
    
    // Show proposal preview on the map
    const showProposalPreview = (proposed, current, preview) => {
      proposalPreviewPOIs.value = []
      hiddenCustomPOIId.value = null // Clear any previously hidden POI
      
      // Clear any previous temporary pending proposal marking
      if (tempPendingProposalPOI.value) {
        tempPendingProposalPOI.value.has_pending_proposal = false
        tempPendingProposalPOI.value = null
      }
      
      // Ensure canvas is ready
      if (!mapCanvas.value) {
        console.error('Map canvas not ready for proposal preview')
        return
      }
      
      // Determine center point and zoom level
      const centerX = mapCanvas.value.width / 2
      const centerY = mapCanvas.value.height / 2
      
      let focusX = proposed.x
      let focusY = proposed.y
      let targetScale = 1.5
      
      // For move proposals, center between current and proposed locations
      if (preview.changeType === 'move_poi' && current) {
        focusX = (current.x + proposed.x) / 2
        focusY = (current.y + proposed.y) / 2
        
        // Calculate appropriate zoom to fit both points
        const dx = Math.abs(proposed.x - current.x)
        const dy = Math.abs(proposed.y - current.y)
        const distance = Math.sqrt(dx * dx + dy * dy)
        
        // Adjust zoom based on distance between points
        if (distance > 200) {
          targetScale = 0.8
        } else if (distance > 100) {
          targetScale = 1.0
        } else {
          targetScale = 1.5
        }
      }
      
      // Apply zoom and center
      scale.value = targetScale
      offsetX.value = centerX - (focusX * targetScale)
      offsetY.value = centerY - (focusY * targetScale)
      
      // If this is the user's own custom POI, hide it temporarily
      if (proposed.custom_poi_id && user.value) {
        // Find the custom POI by checking coordinates and user ownership
        const customPOI = customPOIs.value.find(poi => 
          poi.x === proposed.x && 
          poi.y === proposed.y && 
          poi.user_id === user.value.id
        )
        if (customPOI) {
          hiddenCustomPOIId.value = customPOI.id
        }
      }
      
      // For edit_poi, move_poi, delete_poi, or change_loot, try to find the original POI to get complete type data
      let originalPOI = null
      if ((preview.changeType === 'edit_poi' || preview.changeType === 'move_poi' || preview.changeType === 'delete_poi' || preview.changeType === 'change_loot')) {
        // Use target_id from preview or current data
        const poiId = preview.targetId || current?.id || proposed.poi_id
        if (poiId && currentMapData.value.pois) {
          // Look for the POI in the current map data
          originalPOI = currentMapData.value.pois.find(p => p.id === poiId)
        } else {
        }
      } else if (preview.changeType === 'edit_npc') {
        // For edit_npc, we need to use the npcid from the proposed_data, not the target_id
        // target_id is the npcs.id, but POIs reference npcs.npcid
        const npcId = preview.proposed?.npcid || preview.current?.npcid
        
        if (npcId && currentMapData.value.pois) {
          // Look for the POI that has this NPC
          originalPOI = currentMapData.value.pois.find(p => p.npc_id === npcId)
        } else {
        }
      }
      
      // Handle delete_poi and change_loot differently - show the existing POI
      if (preview.changeType === 'delete_poi' || preview.changeType === 'change_loot') {
        // For delete proposals, use the current POI data
        const x = proposed.x || current?.x || originalPOI?.x
        const y = proposed.y || current?.y || originalPOI?.y
        
        
        const poiData = {
          id: preview.changeType === 'delete_poi' ? `proposal_delete_${preview.proposalId}` : `proposal_loot_${preview.proposalId}`,
          name: originalPOI?.name || current?.name || current?.poi_name || 'Unnamed POI',
          description: originalPOI?.description || current?.description,
          x: x,
          y: y,
          type_id: originalPOI?.type_id || current?.type_id,
          type_name: preview.type_name || originalPOI?.type_name || current?.type_name,
          // Include the type icon data
          type_icon_type: preview.type_icon_type || originalPOI?.type_icon_type || originalPOI?.icon_type || 'emoji',
          type_icon_value: preview.type_icon_value || originalPOI?.type_icon_value || originalPOI?.icon,
          icon_size: originalPOI?.icon_size || 48,
          label_visible: originalPOI?.label_visible !== false,
          label_position: originalPOI?.label_position || 'bottom',
          is_proposal: true,
          is_deletion: preview.changeType === 'delete_poi',  // Special flag for deletion
          proposer_name: preview.proposerName,
          is_custom: false,
          // Include voting data
          upvotes: preview.upvotes || 0,
          downvotes: preview.downvotes || 0,
          user_vote: preview.user_vote || 0,
          proposer_id: preview.proposer_id,
          proposer_donation_tier_name: preview.proposer_donation_tier_name,
          proposer_donation_tier_color: preview.proposer_donation_tier_color,
          proposer_donation_tier_icon: preview.proposer_donation_tier_icon
        }
        
        // Check if we have valid coordinates
        if (!poiData.x || !poiData.y) {
          console.error('POI has no valid coordinates!', poiData)
          error('Unable to locate POI on map')
          return
        }
        
        // Process the POI to set up icon properly
        const displayPOI = processPOI(poiData)
        
        
        proposalPreviewPOIs.value.push(displayPOI)
        
        // Set this as the selected POI to show popup
        setTimeout(() => {
          selectedPOI.value = displayPOI
          const canvasCoords = imageToCanvas(displayPOI.x, displayPOI.y)
          
          popupPosition.value = { 
            x: canvasCoords.x, 
            y: canvasCoords.y 
          }
          popupIsLeftSide.value = canvasCoords.x > mapCanvas.value.width / 2
          
          // Add highlight effect
          highlightedPOI.value = { id: displayPOI.id, x: displayPOI.x, y: displayPOI.y }
          highlightStartTime.value = Date.now()
          
          render()
        }, 100)
        
        return // Don't create the normal proposed POI for delete/loot changes
      }
      
      // Handle edit_npc - just highlight the existing POI without creating a preview
      if (preview.changeType === 'edit_npc') {
        // Find the POI with this NPC
        if (originalPOI) {
          // Temporarily mark the POI as having a pending proposal for visual effect
          originalPOI.has_pending_proposal = true
          tempPendingProposalPOI.value = originalPOI
          
          // Set up center position
          offsetX.value = centerX - (originalPOI.x * targetScale)
          offsetY.value = centerY - (originalPOI.y * targetScale)
          scale.value = targetScale
          
          // Set this as the selected POI to show popup
          setTimeout(() => {
            selectedPOI.value = originalPOI
            const canvasCoords = imageToCanvas(originalPOI.x, originalPOI.y)
            
            popupPosition.value = { 
              x: canvasCoords.x, 
              y: canvasCoords.y 
            }
            popupIsLeftSide.value = canvasCoords.x > mapCanvas.value.width / 2
            
            // Add highlight effect
            highlightedPOI.value = { id: originalPOI.id, x: originalPOI.x, y: originalPOI.y }
            highlightStartTime.value = Date.now()
            
            // Start the pending proposal animation
            render()
          }, 100)
        } else {
          console.error('Could not find POI with NPC for edit_npc proposal')
          error('Unable to locate NPC on map')
        }
        
        return // Don't create any preview POIs for edit_npc
      }
      
      // Create preview POI for the proposed location (for add/edit/move)
      const proposedPOIData = {
        id: `proposal_new_${preview.proposalId}`,
        name: proposed.name || current?.name || originalPOI?.name || 'Unnamed POI',
        description: proposed.description || current?.description || originalPOI?.description,
        x: proposed.x,
        y: proposed.y,
        type_id: proposed.type_id || originalPOI?.type_id,
        type_name: proposed.type_name || originalPOI?.type_name,
        // Include the type icon data - prefer from original POI if available
        type_icon_type: preview.type_icon_type || originalPOI?.type_icon_type || originalPOI?.icon_type || 'emoji',
        type_icon_value: preview.type_icon_value || originalPOI?.type_icon_value || originalPOI?.icon,
        icon_size: proposed.icon_size || originalPOI?.icon_size || 48,
        label_visible: proposed.label_visible !== false,
        label_position: proposed.label_position || 'bottom',
        is_proposal: true,
        is_proposed: true,
        proposer_name: preview.proposerName,
        is_custom: false,
        // Include multi-mob and NPC associations for proposal
        is_multi_mob: preview.is_multi_mob,
        npc_associations: preview.npc_associations,
        // Also include the custom POI id if this is from a custom POI
        custom_poi_id: proposed.custom_poi_id,
        // Include voting data
        upvotes: preview.upvotes || 0,
        downvotes: preview.downvotes || 0,
        user_vote: preview.user_vote || 0,
        proposer_id: preview.proposer_id,
        proposer_donation_tier_name: preview.proposer_donation_tier_name,
        proposer_donation_tier_color: preview.proposer_donation_tier_color,
        proposer_donation_tier_icon: preview.proposer_donation_tier_icon
      }
      
      // Process the POI to set up icon properly (like regular POIs)
      const proposedPOI = processPOI(proposedPOIData)
      
      proposalPreviewPOIs.value.push(proposedPOI)
      
      // If there's a current POI (for moves only), add it too
      // For edits, don't show current POI since it's at the same location
      if (current && preview.changeType === 'move_poi') {
        const currentPOIData = {
          id: `proposal_current_${preview.proposalId}`,
          name: current.name,
          description: current.description,
          x: current.x,
          y: current.y,
          type_id: current.type_id || originalPOI?.type_id,
          type_name: originalPOI?.type_name || current.type_name,
          // Include the type icon data - use from original POI if available
          type_icon_type: originalPOI?.type_icon_type || originalPOI?.icon_type || preview.type_icon_type || 'emoji',
          type_icon_value: originalPOI?.type_icon_value || originalPOI?.icon || preview.type_icon_value,
          icon_size: current.icon_size || originalPOI?.icon_size || 48,
          label_visible: current.label_visible !== false,
          label_position: current.label_position || 'bottom',
          is_proposal: true,
          is_current: true,
          is_custom: false
        }
        
        // Process the POI to set up icon properly
        const currentPOI = processPOI(currentPOIData)
        
        proposalPreviewPOIs.value.push(currentPOI)
        
        // If it's a move, create a connection arrow
        if (current.x !== proposed.x || current.y !== proposed.y) {
          proposalPreviewConnection.value = {
            from: { x: current.x, y: current.y },
            to: { x: proposed.x, y: proposed.y }
          }
        }
      }
      
      // Highlight the proposed POI and optionally show popup
      setTimeout(() => {
        // For move_poi, don't show the popup - focus should be on location change
        if (preview.changeType !== 'move_poi') {
          selectedPOI.value = proposedPOI
          const canvasCoords = imageToCanvas(proposed.x, proposed.y)
          popupPosition.value = { 
            x: canvasCoords.x, 
            y: canvasCoords.y 
          }
          popupIsLeftSide.value = canvasCoords.x > mapCanvas.value.width / 2
        }
        
        // Add highlight effect (always show this)
        highlightedPOI.value = { id: proposedPOI.id, x: proposed.x, y: proposed.y }
        highlightStartTime.value = Date.now()
        
        render()
      }, 100)
    }
    
    // Add visibility change listener to refresh map data when returning to the page
    // This handles cases where proposals are deleted on the account page
    const handleVisibilityChange = async () => {
      if (!document.hidden) {
        // Always check auth status when tab becomes visible to get latest warnings
        await checkAuthStatus()
        
        if (maps.value[selectedMapIndex.value]?.id) {
          // Check if we need to refresh due to returning from account page
          const shouldRefresh = sessionStorage.getItem('refresh_on_return')
          if (shouldRefresh) {
            sessionStorage.removeItem('refresh_on_return')
          }
          
          // Only refresh if we have a database-connected map
          const currentMap = maps.value[selectedMapIndex.value]
          if (currentMap.id && dbMapData.value[currentMap.id]) {
            // Force reload map data to get updated proposal status
            delete dbMapData.value[currentMap.id]
            loadSelectedMap()
            
            // Also clear any proposal preview POIs that might be lingering
            proposalPreviewPOIs.value = []
            proposalPreviewConnection.value = null
          }
        }
      }
    }
    
    // Handle focus changes to clear proposal preview when returning to tab
    const handleFocusChange = async () => {
      // Always check auth status when window gains focus to get latest warnings
      await checkAuthStatus()
      
      // Clear any lingering proposal preview when tab gains focus
      if (proposalPreviewPOIs.value.length > 0 || proposalPreviewConnection.value) {
        proposalPreviewPOIs.value = []
        proposalPreviewConnection.value = null
        render() // Re-render to clear the preview
      }
    }
    
    onMounted(async () => {
      // Check authentication status
      await checkAuthStatus()
      
      document.addEventListener('visibilitychange', handleVisibilityChange)
      window.addEventListener('focus', handleFocusChange)
      
      // Add click listener for closing dropdowns
      document.addEventListener('click', closeDropdowns)
      
      // Initialize CSRF token if authenticated
      if (isAuthenticated.value) {
        await initCSRF()
      }
      
      // Admin mode state is now handled by the watcher on adminModeEnabled
      
      
      // Check if we need to show a POI proposal preview BEFORE loading maps
      const proposalPreviewData = sessionStorage.getItem('poi_proposal_preview')
      if (proposalPreviewData) {
        // Show loading state immediately
        isLoadingProposalPreview.value = true
      }
      
      // Load maps from database
      maps.value = await loadMapsFromDatabase()
      
      // Load all POIs for global search
      await loadAllPOIsForSearch()
      
      // Load POI types for filtering
      await loadPOITypes()
      
      // Start XP polling if authenticated
      if (isAuthenticated.value) {
        xpPollingInterval = setInterval(pollForXPUpdates, 30000) // Poll every 30 seconds
        // Load all custom POIs for global search
        await loadAllCustomPOIs()
      }
      
      // Check periodically for POI refresh requests
      const checkForPOIRefresh = async () => {
        const shouldRefreshPOIs = sessionStorage.getItem('refresh_pois')
        if (shouldRefreshPOIs) {
          sessionStorage.removeItem('refresh_pois')
          if (maps.value[selectedMapIndex.value]?.id) {
            const currentMap = maps.value[selectedMapIndex.value]
            if (currentMap.id && dbMapData.value[currentMap.id]) {
              delete dbMapData.value[currentMap.id]
              await loadSelectedMap()
            }
            // Also refresh custom POIs to update their status
            await loadCustomPOIs()
          }
        }
      }
      // Check every second for refresh requests
      setInterval(checkForPOIRefresh, 1000)
      
      initCanvas(mapCanvas.value)
      resizeCanvas()
      window.addEventListener('resize', resizeCanvas)
      window.addEventListener('keydown', handleKeyboardShortcut)
      window.addEventListener('keyup', handleKeyUp)
      
      // Global context menu prevention during drag
      globalContextMenuHandler = (e) => {
        if (draggedItem.value || isDragging.value || pendingChange.value) {
          e.preventDefault()
          e.stopPropagation()
        }
      }
      document.addEventListener('contextmenu', globalContextMenuHandler, true)
      
      // Global mouseup handler to ensure drag state is cleaned up
      globalMouseUpHandler = (e) => {
        // Only handle left mouse button
        if (e.button === 0 && (draggedItem.value || isDragging.value)) {
          handleMouseUp(e)
        }
      }
      window.addEventListener('mouseup', globalMouseUpHandler)
      
      // Listen for avatar updates from account page
      window.addEventListener('avatar-updated', async () => {
        await checkAuthStatus()
        if (isAuthenticated.value) {
          await loadAllCustomPOIs()
        }
      })
      
      // Close user dropdown when clicking outside
      document.addEventListener('click', (e) => {
        const dropdown = document.querySelector('.user-dropdown-container')
        if (dropdown && !dropdown.contains(e.target)) {
          closeUserDropdown()
        }
      })
      
      // Check if we need to highlight a custom POI
      const highlightData = sessionStorage.getItem('highlightCustomPoi')
      if (highlightData) {
        const { id, mapId, x, y } = JSON.parse(highlightData)
        sessionStorage.removeItem('highlightCustomPoi')
        
        // Find and select the map
        const mapIndex = maps.value.findIndex(m => m.id === mapId)
        if (mapIndex !== -1) {
          selectedMapIndex.value = mapIndex
          await loadSelectedMap()
          
          // Wait for map to be ready then set up highlight
          nextTick(() => {
            // Center view on the POI
            if (image.value) {
              // Calculate center position
              const centerX = mapCanvas.value.width / 2
              const centerY = mapCanvas.value.height / 2
              
              // Calculate offset to center the POI
              offsetX.value = centerX - (x * scale.value)
              offsetY.value = centerY - (y * scale.value)
              
              // Set up the highlight with a small delay to ensure rendering is ready
              setTimeout(() => {
                highlightedPOI.value = { id, x, y }
                highlightStartTime.value = Date.now()
                render()
              }, 100)
            }
          })
        }
      }
      
      // Now handle the POI proposal preview if we have one
      if (proposalPreviewData) {
        const preview = JSON.parse(proposalPreviewData)
        sessionStorage.removeItem('poi_proposal_preview')
        
        // Find and select the map - check top-level mapId first, then fall back to nested values
        const mapId = preview.mapId || preview.proposed.map_id || preview.current?.map_id
        
        if (mapId) {
          const mapIndex = maps.value.findIndex(m => m.id === mapId)
          
          if (mapIndex !== -1) {
            selectedMapIndex.value = mapIndex
            await loadSelectedMap()
            
            // Wait for map to be ready then show the preview
            nextTick(() => {
              // Hide loading state regardless
              isLoadingProposalPreview.value = false
              
              if (image.value && mapCanvas.value) {
                // Add a small delay to ensure canvas is fully initialized
                setTimeout(() => {
                  // Show proposal preview based on change type
                  if (preview.changeType === 'add_poi') {
                    // For new POIs, show proposed location
                    showProposalPreview(preview.proposed, null, preview)
                  } else if (preview.changeType === 'edit_poi' || preview.changeType === 'move_poi' || preview.changeType === 'delete_poi' || preview.changeType === 'change_loot' || preview.changeType === 'edit_npc') {
                    // For edits/moves/deletes/loot changes/npc edits, show both current and proposed
                    showProposalPreview(preview.proposed, preview.current, preview)
                  }
                }, 100)
              }
            })
          } else {
            // Map not found, hide loading state
            isLoadingProposalPreview.value = false
            console.error('Map not found:', mapId)
          }
        } else {
          // This should not happen anymore since we're passing mapId from account.html
          console.error('No map_id in proposal preview data')
          isLoadingProposalPreview.value = false
          
          // Load first map as fallback
          if (maps.value.length > 0) {
            await loadSelectedMap()
          }
        }
      } else {
        // Load the first map if available
        if (maps.value.length > 0) {
          await loadSelectedMap()
        }
      }
      
      // Start animation loop for glowing effects
      render()
    })
    
    onUnmounted(() => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocusChange)
      document.removeEventListener('click', closeDropdowns)
      window.removeEventListener('resize', resizeCanvas)
      window.removeEventListener('keydown', handleKeyboardShortcut)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('avatar-updated', async () => {
        await checkAuthStatus()
      })
      if (globalContextMenuHandler) {
        document.removeEventListener('contextmenu', globalContextMenuHandler, true)
      }
      if (globalMouseUpHandler) {
        window.removeEventListener('mouseup', globalMouseUpHandler)
      }
      if (xpPollingInterval) {
        clearInterval(xpPollingInterval)
      }
      if (proposalAnimationId) {
        cancelAnimationFrame(proposalAnimationId)
      }
      // Clear any hidden custom POI when component unmounts
      hiddenCustomPOIId.value = null
      proposalPreviewPOIs.value = []
      proposalPreviewConnection.value = null
      
      // Clear temporary pending proposal marking
      if (tempPendingProposalPOI.value) {
        tempPendingProposalPOI.value.has_pending_proposal = false
        tempPendingProposalPOI.value = null
      }
    })
    
    // Computed property for all searchable POIs
    const allSearchablePOIs = computed(() => {
      const allPOIs = []
      
      // Add regular POIs from all maps
      Object.entries(dbMapData.value).forEach(([mapId, mapData]) => {
        if (mapData.pois) {
          mapData.pois.forEach(poi => {
            allPOIs.push({
              ...poi,
              map_id: parseInt(mapId),
              is_custom: false
            })
          })
        }
      })
      
      // Add ALL custom POIs (owned and shared) across all maps if user is authenticated
      if (isAuthenticated.value && allCustomPOIs.value) {
        allCustomPOIs.value.forEach(poi => {
          allPOIs.push({
            ...poi,
            is_custom: true,
            is_pending: poi.status === 'pending',
            is_shared: !poi.is_owner // Mark shared POIs
          })
        })
      }
      
      return allPOIs
    })
    
    // Current map ID
    const currentMapId = computed(() => maps.value[selectedMapIndex.value]?.id || null)
    
    // Check if proposals source is active
    const proposalsSourceActive = computed(() => mapFilters.value.sources.includes('proposals'))
    
    // Check if selected POI has any proposal
    const selectedPOIHasProposal = computed(() => {
      if (!selectedPOI.value) return false
      return selectedPOI.value.is_proposal || 
             selectedPOI.value.has_pending_proposal || 
             selectedPOI.value.has_move_proposal || 
             selectedPOI.value.has_edit_proposal || 
             selectedPOI.value.has_deletion_proposal || 
             selectedPOI.value.has_loot_proposal ||
             selectedPOI.value.has_npc_proposal
    })
    
    // All POIs unfiltered (for counting in filters)
    const allUnfilteredPOIs = computed(() => {
      const pois = []
      
      // Add official POIs
      if (currentMapData.value && currentMapData.value.pois) {
        currentMapData.value.pois.forEach(poi => {
          pois.push({
            ...poi,
            is_custom: false,
            is_proposal: false
          })
        })
      }
      
      // Add ALL custom POIs (including pending ones)
      if (isAuthenticated.value) {
        customPOIs.value.forEach(poi => {
          const isPending = poi.status === 'pending'
          
          // Find the corresponding proposal for this custom POI if it's pending
          let proposalData = null
          if (isPending && pendingProposals.value.length > 0) {
            proposalData = pendingProposals.value.find(proposal => 
              proposal.change_type === 'add_poi' && 
              proposal.proposed_data.is_custom && 
              proposal.proposer_id === user.value?.id &&
              proposal.proposed_data.name === poi.name &&
              proposal.proposed_data.x === poi.x &&
              proposal.proposed_data.y === poi.y
            )
          }
          
          pois.push({
            ...poi,
            is_custom: true,
            is_proposal: isPending,
            proposal_type: isPending ? 'add' : null,
            has_pending_proposal: isPending,
            proposer_name: proposalData?.proposer_name || poi.owner_name,
            proposer_id: proposalData?.proposer_id || poi.user_id,
            upvotes: proposalData?.upvotes || (isPending ? 1 : 0),
            downvotes: proposalData?.downvotes || 0,
            user_vote: proposalData?.user_vote || (isPending && poi.user_id === user.value?.id ? 1 : 0),
            vote_score: proposalData?.vote_score || (proposalData ? proposalData.upvotes - proposalData.downvotes : (isPending ? 1 : 0)),
            proposal_id: proposalData?.id,
            notes: proposalData?.notes || poi.notes,
            // Ensure consistent field naming for multi-mob
            is_multi_mob: poi.multi_mob || proposalData?.is_multi_mob || false
          })
        })
      }
      
      // Add ALL proposal POIs
      if (pendingProposals.value.length > 0) {
        pendingProposals.value.forEach(proposal => {
          if (proposal.change_type === 'add_poi' && !proposal.proposed_data.is_custom) {
            const proposedPoi = {
              ...proposal.proposed_data,
              id: `proposal-${proposal.id}`,
              is_proposal: true,
              is_custom: false,
              proposal_type: 'add',
              proposal_id: proposal.id,
              proposer_name: proposal.proposer_name,
              proposer_id: proposal.proposer_id,
              upvotes: proposal.upvotes,
              downvotes: proposal.downvotes,
              user_vote: proposal.user_vote,
              vote_score: proposal.vote_score,
              notes: proposal.notes,
              has_pending_proposal: true,
              // Include multi-mob data
              is_multi_mob: proposal.is_multi_mob,
              npc_associations: proposal.npc_associations,
              // Include donation tier info
              proposer_donation_tier_name: proposal.proposer_donation_tier_name,
              proposer_donation_tier_color: proposal.proposer_donation_tier_color,
              proposer_donation_tier_icon: proposal.proposer_donation_tier_icon
            }
            pois.push(proposedPoi)
          }
        })
      }
      
      return pois
    })
    
    // All POIs for display (before filtering)
    const allDisplayPOIs = computed(() => {
      const pois = []
      
      // Add official POIs
      if (currentMapData.value && currentMapData.value.pois) {
        currentMapData.value.pois.forEach(poi => {
          pois.push({
            ...poi,
            is_custom: false,
            is_proposal: false
          })
        })
      }
      
      // Check if proposals are visible
      const proposalsVisible = mapFilters.value.sources.includes('proposals')
      
      // Add custom POIs
      if (isAuthenticated.value) {
        
        customPOIs.value.forEach(poi => {
          // Custom POIs with status 'pending' are actually proposals
          const isPending = poi.status === 'pending' && proposalsVisible
          
          // Find the corresponding proposal for this custom POI if it's pending
          let proposalData = null
          if (isPending && pendingProposals.value.length > 0) {
            // Look for a proposal that matches this custom POI
            proposalData = pendingProposals.value.find(proposal => 
              proposal.change_type === 'add_poi' && 
              proposal.proposed_data.is_custom && 
              proposal.proposer_id === user.value?.id &&
              proposal.proposed_data.name === poi.name &&
              proposal.proposed_data.x === poi.x &&
              proposal.proposed_data.y === poi.y
            )
          }
          
          // Only add proposal data if proposals are visible
          if (proposalsVisible && isPending) {
            pois.push({
              ...poi,
              is_custom: true,
              is_proposal: true,
              proposal_type: 'add',
              has_pending_proposal: true,
              // Add proposal voting data if found
              proposer_name: proposalData?.proposer_name || poi.owner_name,
              proposer_id: proposalData?.proposer_id || poi.user_id,
              upvotes: proposalData?.upvotes || (isPending ? 1 : 0),
              downvotes: proposalData?.downvotes || 0,
              user_vote: proposalData?.user_vote || (isPending && poi.user_id === user.value?.id ? 1 : 0),
              vote_score: proposalData?.vote_score || (proposalData ? proposalData.upvotes - proposalData.downvotes : (isPending ? 1 : 0)),
              proposal_id: proposalData?.id,
              notes: proposalData?.notes || poi.notes
            })
          } else {
            // Add as regular custom POI without proposal data
            pois.push({
              ...poi,
              is_custom: true,
              is_proposal: false,
              proposal_type: null,
              has_pending_proposal: false
            })
          }
        })
      }
      
      // Add proposal POIs when proposals filter is active
      if (proposalsVisible && pendingProposals.value.length > 0) {
        // First, mark existing POIs that have proposals
        pendingProposals.value.forEach(proposal => {
          if (proposal.change_type === 'move_poi') {
            // Mark existing POI as having a move proposal
            // For custom POIs, we need to check if the proposal's target_type is 'custom_poi'
            const poiToMove = pois.find(p => {
              if (proposal.target_type === 'custom_poi') {
                return p.is_custom && p.id === proposal.target_id
              }
              return !p.is_custom && p.id === proposal.target_id
            })
            if (poiToMove) {
              poiToMove.has_move_proposal = true
              poiToMove.move_proposal = {
                id: proposal.id,
                proposed_x: proposal.proposed_data.x,
                proposed_y: proposal.proposed_data.y,
                proposer_name: proposal.proposer_name,
                proposer_id: proposal.proposer_id,
                upvotes: proposal.upvotes,
                downvotes: proposal.downvotes,
                user_vote: proposal.user_vote,
                notes: proposal.notes
              }
            }
          } else if (proposal.change_type === 'edit_poi') {
            // Mark existing POI as having an edit proposal
            const poiToEdit = pois.find(p => {
              if (proposal.target_type === 'custom_poi') {
                return p.is_custom && p.id === proposal.target_id
              }
              return !p.is_custom && p.id === proposal.target_id
            })
            if (poiToEdit) {
              poiToEdit.has_edit_proposal = true
              poiToEdit.edit_proposal = {
                id: proposal.id,
                proposed_data: proposal.proposed_data,
                current_data: proposal.current_data,
                proposer_name: proposal.proposer_name,
                proposer_id: proposal.proposer_id,
                upvotes: proposal.upvotes,
                downvotes: proposal.downvotes,
                user_vote: proposal.user_vote,
                notes: proposal.notes
              }
            }
          } else if (proposal.change_type === 'delete_poi') {
            // Mark existing POI as having a deletion proposal
            const poiToDelete = pois.find(p => {
              if (proposal.target_type === 'custom_poi') {
                return p.is_custom && p.id === proposal.target_id
              }
              return !p.is_custom && p.id === proposal.target_id
            })
            if (poiToDelete) {
              poiToDelete.has_deletion_proposal = true
              poiToDelete.deletion_proposal = {
                id: proposal.id,
                proposer_name: proposal.proposer_name,
                proposer_id: proposal.proposer_id,
                upvotes: proposal.upvotes,
                downvotes: proposal.downvotes,
                user_vote: proposal.user_vote,
                notes: proposal.notes
              }
            }
          } else if (proposal.change_type === 'change_loot') {
            // Mark existing POI as having a loot change proposal
            const poiWithLootChange = pois.find(p => !p.is_custom && p.id === proposal.target_id)
            if (poiWithLootChange) {
              poiWithLootChange.has_loot_proposal = true
              poiWithLootChange.loot_proposal = {
                id: proposal.id,
                proposal_id: proposal.id,
                proposed_data: proposal.proposed_data,
                current_data: proposal.current_data,
                proposer_name: proposal.proposer_name,
                proposer_id: proposal.proposer_id,
                upvotes: proposal.upvotes,
                downvotes: proposal.downvotes,
                user_vote: proposal.user_vote,
                notes: proposal.notes
              }
            }
          } else if (proposal.change_type === 'edit_npc') {
            // For NPC edit proposals, we need to find POIs at the given coordinates
            // The API provides poi_x and poi_y for the affected POI
            const affectedPOIs = pois.filter(p => 
              p.x === proposal.poi_x && 
              p.y === proposal.poi_y && 
              p.npc_id // Must have an NPC
            )
            affectedPOIs.forEach(poi => {
              poi.has_npc_proposal = true
              poi.npc_proposal = {
                id: proposal.id,
                proposal_id: proposal.id,
                proposed_data: proposal.proposed_data,
                current_data: proposal.current_data,
                proposer_name: proposal.proposer_name,
                proposer_id: proposal.proposer_id,
                upvotes: proposal.upvotes,
                downvotes: proposal.downvotes,
                user_vote: proposal.user_vote,
                notes: proposal.notes
              }
            })
          }
        })
        
        // Add new POI proposals when proposals are included in sources
        if (mapFilters.value.sources.includes('proposals')) {
          pendingProposals.value.forEach(proposal => {
            if (proposal.change_type === 'add_poi') {
              const proposedData = proposal.proposed_data
              pois.push({
                id: `proposal_${proposal.id}`,
                name: proposedData.name,
                description: proposedData.description,
                x: proposedData.x,
                y: proposedData.y,
                type_id: proposedData.type_id,
                poi_type_id: proposedData.type_id,
                npc_id: proposedData.npc_id,
                item_id: proposedData.item_id,
                icon: proposal.type_icon_value,
                icon_type: proposal.type_icon_type,
                is_custom: proposedData.is_custom || false,
                is_proposal: true,
                proposal_type: 'add',
                proposal_data: proposedData,
                proposer_name: proposal.proposer_name,
                proposer_id: proposal.proposer_id,
                upvotes: proposal.upvotes,
                downvotes: proposal.downvotes,
                user_vote: proposal.user_vote,
                vote_score: proposal.vote_score || (proposal.upvotes - proposal.downvotes),
                proposal_id: proposal.id,
                notes: proposal.notes,
                npc_name: proposal.npc_name,
                item_name: proposal.item_name,
                // Include multi-mob data
                is_multi_mob: proposal.is_multi_mob,
                npc_associations: proposal.npc_associations,
                // Include donation tier info
                proposer_donation_tier_name: proposal.proposer_donation_tier_name,
                proposer_donation_tier_color: proposal.proposer_donation_tier_color,
                proposer_donation_tier_icon: proposal.proposer_donation_tier_icon
              })
            }
          })
        }
      }
      
      // Debug: Log POI structure if we have any
      if (pois.length > 0 && !window._poiStructureLogged) {
        window._poiStructureLogged = true
      }
      
      return pois
    })
    
    // Filtered POIs based on current filters
    const filteredPOIs = computed(() => {
      let pois = [...allDisplayPOIs.value]
      
      // Search filter
      if (mapFilters.value.search) {
        const search = mapFilters.value.search.toLowerCase()
        pois = pois.filter(poi => 
          poi.name.toLowerCase().includes(search) ||
          (poi.description && poi.description.toLowerCase().includes(search))
        )
      }
      
      // Type filter - only filter if we have POI types loaded and not all types are selected
      if (poiTypes.value.length > 0 && 
          mapFilters.value.types.length < poiTypes.value.length) {
        // If no types are selected (empty array), filter out all POIs
        if (mapFilters.value.types.length === 0) {
          pois = []
        } else {
          // Otherwise, filter by selected types
          pois = pois.filter(poi => {
            // Check multiple possible field names for POI type
            const typeId = poi.poi_type_id || poi.type_id || poi.poi_type?.id
            return mapFilters.value.types.includes(typeId)
          })
        }
      }
      
      // Source filter - now handles multiple selections
      if (!mapFilters.value.sources || mapFilters.value.sources.length === 0) {
        // No sources selected, show no POIs
        return []
      }
      
      pois = pois.filter(poi => {
        // Check each source type
        if (mapFilters.value.sources.includes('official') && !poi.is_custom && !poi.is_proposal) {
          return true
        }
        // For custom POIs, distinguish between owned and shared
        if (poi.is_custom && !poi.is_proposal) {
          const isOwned = poi.user_id === user.value?.id
          const isShared = poi.is_shared_active || (!isOwned && poi.is_custom)
          
          if (mapFilters.value.sources.includes('custom') && isOwned) {
            return true
          }
          if (mapFilters.value.sources.includes('shared') && isShared) {
            return true
          }
        }
        if (mapFilters.value.sources.includes('proposals') && (
          poi.is_proposal || 
          poi.has_move_proposal || 
          poi.has_edit_proposal || 
          poi.has_deletion_proposal || 
          poi.has_loot_proposal ||
          poi.has_npc_proposal ||
          poi.has_pending_proposal
        )) {
          return true
        }
        return false
      })
      
      return pois
    })
    
    // Handle POI selection from search
    const handlePOISelected = async (poi) => {
      // Switch to the POI's map if different
      if (poi.map_id !== currentMapId.value) {
        const mapIndex = maps.value.findIndex(m => m.id === poi.map_id)
        if (mapIndex !== -1) {
          selectedMapIndex.value = mapIndex
          await loadSelectedMap()
        }
      }
      
      // Wait for map to load
      await nextTick()
      
      // Center on the POI and zoom in
      const targetScale = 1.5 // Zoom to 150%
      
      // Calculate the position to center the POI
      const canvasRect = mapCanvas.value.getBoundingClientRect()
      const centerX = canvasRect.width / 2
      const centerY = canvasRect.height / 2
      
      // Update scale and offset to center on POI
      scale.value = targetScale
      offsetX.value = centerX - (poi.x * targetScale)
      offsetY.value = centerY - (poi.y * targetScale)
      
      // Set up the highlight effect
      setTimeout(() => {
        // Set the highlighted POI to trigger the glowing circle effect
        highlightedPOI.value = { id: poi.id, x: poi.x, y: poi.y }
        highlightStartTime.value = Date.now()
        
        const canvasPos = imageToCanvas(poi.x, poi.y)
        
        // Create a synthetic click event to show the POI popup
        const clickEvent = {
          clientX: canvasRect.left + canvasPos.x,
          clientY: canvasRect.top + canvasPos.y
        }
        
        // If it's a custom POI, find it in customPOIs
        if (poi.is_custom) {
          const customPOI = customPOIs.value.find(p => p.id === poi.id)
          if (customPOI) {
            selectedPOI.value = { ...customPOI, is_custom: true }
            popupPosition.value = {
              x: clickEvent.clientX,
              y: clickEvent.clientY
            }
            popupIsLeftSide.value = canvasPos.x > canvasRect.width / 2
          }
        } else {
          // Regular POI
          selectedPOI.value = poi
          popupPosition.value = {
            x: clickEvent.clientX,
            y: clickEvent.clientY
          }
          popupIsLeftSide.value = canvasPos.x > canvasRect.width / 2
        }
        
        render()
      }, 100)
    }
    
    // Handle warning acknowledgment
    const handleWarningAcknowledged = (warningId) => {
      acknowledgeWarning(warningId)
    }
    
    // Handle filter updates
    const handleFilterUpdate = (filters) => {
      mapFilters.value = { ...filters }
      
      // Hide proposed location if switching away from proposal view
      if (!filters.sources.includes('proposals')) {
        showingProposedLocation.value = false
        activeProposedLocation.value = null
      }
      
      render() // Re-render with new filters
      updateProposalAnimation() // Update animation state
    }
    
    // Load POI types
    const loadPOITypes = async () => {
      try {
        const response = await fetch('/api/poi-types')
        if (response.ok) {
          const types = await response.json()
          poiTypes.value = types
          // Initialize filter with all types selected
          if (mapFilters.value.types.length === 0) {
            mapFilters.value.types = types.map(t => t.id)
          }
        }
      } catch (error) {
        console.error('Error loading POI types:', error)
      }
    }
    
    // Proposal popup handlers
    const handleProposalPopupClose = () => {
      selectedPOI.value = null
      showingProposedLocation.value = false
      activeProposedLocation.value = null
      render() // Re-render to clear any proposed location visuals
    }
    
    const handleProposalVoteSuccess = ({ proposalId, vote }) => {
      // Update the proposal data with new vote
      const updateProposalVote = (proposal) => {
        if (proposal.id === proposalId || proposal.proposal_id === proposalId) {
          // Update vote counts based on previous vote
          const prevVote = proposal.user_vote || 0
          if (prevVote === 1) proposal.upvotes--
          if (prevVote === -1) proposal.downvotes--
          if (vote === 1) proposal.upvotes++
          if (vote === -1) proposal.downvotes++
          proposal.user_vote = vote
          proposal.vote_score = proposal.upvotes - proposal.downvotes
        }
      }
      
      // Update in pendingProposals
      pendingProposals.value.forEach(updateProposalVote)
      
      // Update in selectedPOI if it's a proposal
      if (selectedPOI.value?.is_proposal) {
        updateProposalVote(selectedPOI.value)
      } else if (selectedPOI.value) {
        // Update in POI proposal data
        if (selectedPOI.value.move_proposal) updateProposalVote(selectedPOI.value.move_proposal)
        if (selectedPOI.value.edit_proposal) updateProposalVote(selectedPOI.value.edit_proposal)
        if (selectedPOI.value.deletion_proposal) updateProposalVote(selectedPOI.value.deletion_proposal)
      }
      
      render() // Re-render to update visual indicators
    }
    
    const handleToggleProposedLocation = (show) => {
      // This function is no longer used since we handle toggling via direct clicks
      // Keeping it for backwards compatibility with ProposalPopup component
    }
    
    // Open Ko-fi donation widget
    const openKofiWidget = () => {
      // Simply open the Ko-fi page in a new tab
      // The floating chat widget has too many cross-origin restrictions to work reliably
      window.open('https://ko-fi.com/valorith', '_blank')
    }
    
    const handleProposalWithdrawn = (proposalId) => {
      try {
        // Find the proposal that was withdrawn
        const withdrawnProposal = pendingProposals.value.find(p => p.id === proposalId)
        
        // Store the current selected POI to clear its flags
        const currentSelectedPOI = selectedPOI.value
        
        // Remove from pending proposals
        pendingProposals.value = pendingProposals.value.filter(p => p.id !== proposalId)
      
      // Update POI states based on the withdrawn proposal type
      if (withdrawnProposal) {
        // Get all POIs - official POIs from currentMapData and custom POIs
        const officialPOIs = currentMapData.value?.pois || []
        const allPOIs = [...officialPOIs, ...customPOIs.value]
        
        if (withdrawnProposal.change_type === 'move_poi') {
          const poi = allPOIs.find(p => 
            (withdrawnProposal.target_type === 'custom_poi' ? p.is_custom && p.id === withdrawnProposal.target_id : !p.is_custom && p.id === withdrawnProposal.target_id)
          )
          if (poi) {
            delete poi.has_move_proposal
            delete poi.move_proposal
          }
        } else if (withdrawnProposal.change_type === 'edit_poi') {
          const poi = allPOIs.find(p => 
            (withdrawnProposal.target_type === 'custom_poi' ? p.is_custom && p.id === withdrawnProposal.target_id : !p.is_custom && p.id === withdrawnProposal.target_id)
          )
          if (poi) {
            delete poi.has_edit_proposal
            delete poi.edit_proposal
          }
        } else if (withdrawnProposal.change_type === 'delete_poi') {
          const poi = allPOIs.find(p => 
            (withdrawnProposal.target_type === 'custom_poi' ? p.is_custom && p.id === withdrawnProposal.target_id : !p.is_custom && p.id === withdrawnProposal.target_id)
          )
          if (poi) {
            delete poi.has_deletion_proposal
            delete poi.deletion_proposal
          }
        } else if (withdrawnProposal.change_type === 'change_loot') {
          const poi = allPOIs.find(p => !p.is_custom && p.id === withdrawnProposal.target_id)
          if (poi) {
            delete poi.has_loot_proposal
            delete poi.loot_proposal
          }
        } else if (withdrawnProposal.change_type === 'edit_npc') {
          // For NPC proposals, find POIs at the given coordinates
          const affectedPOIs = allPOIs.filter(p => 
            p.x === withdrawnProposal.poi_x && 
            p.y === withdrawnProposal.poi_y && 
            p.npc_id
          )
          affectedPOIs.forEach(poi => {
            delete poi.has_npc_proposal
            delete poi.npc_proposal
          })
        }
      }
      
      // Also clear flags from the currently selected POI if it matches
      if (currentSelectedPOI) {
        delete currentSelectedPOI.has_move_proposal
        delete currentSelectedPOI.move_proposal
        delete currentSelectedPOI.has_edit_proposal
        delete currentSelectedPOI.edit_proposal
        delete currentSelectedPOI.has_deletion_proposal
        delete currentSelectedPOI.deletion_proposal
        delete currentSelectedPOI.has_loot_proposal
        delete currentSelectedPOI.loot_proposal
        delete currentSelectedPOI.has_npc_proposal
        delete currentSelectedPOI.npc_proposal
      }
      
      // Close the proposal popup
      selectedPOI.value = null
      
      // Re-render the map to update visual indicators
      render()
      // Stop the proposal animation if no more proposals
      updateProposalAnimation()
      } catch (error) {
        console.error('Error handling proposal withdrawal:', error)
      }
    }
    
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
      promptDialog,
      promptInput,
      isDragging,
      zoomPercent,
      dbMapData,
      loadSelectedMap,
      handleMapClick,
      handleContextMenu,
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
      reloadApp,
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
      showEditProposalDialog,
      showDeleteProposalDialog,
      showLootProposalDialog,
      showItemProposalDialog,
      showNPCProposalDialog,
      toggleItemDropdown,
      showItemEditSelection,
      itemDropdownVisible,
      showNPCEditProposal,
      showItemEditProposal,
      showAddNPCDialog,
      showProposalNPCs,
      closeProposalNPCsModal,
      showProposalNPCsModal,
      proposalNPCsList,
      handleProposalSubmitted,
      handleNPCAdded,
      handleAdminPopupUpdate,
      handleAdminPopupActivate,
      handleAdminPopupDelete,
      handleUpdateMaps,
      handleMapManagerConfirm,
      handleMapManagerToast,
      deleteConnection,
      confirmPendingChange,
      cancelPendingChange,
      // Auth related
      user,
      isAuthenticated,
      loading,
      unacknowledgedWarnings,
      loginWithGoogle,
      showUserDropdown,
      toggleUserDropdown,
      handleLogout,
      handleAvatarError,
      handleWarningAcknowledged,
      // Custom POI related
      contextMenuVisible,
      contextMenuPosition,
      customPOIDialogVisible,
      customPOIPosition,
      selectedCustomPOI,
      customPOIs,
      contextMenuPOI,
      hideContextMenu,
      createCustomPOI,
      editCustomPOI,
      deleteCustomPOI,
      publishCustomPOI,
      saveCustomPOI,
      // Highlight
      highlightedPOI,
      highlightStartTime,
      // Search
      allSearchablePOIs,
      currentMapId,
      handlePOISelected,
      // Filters
      poiTypes,
      allUnfilteredPOIs,
      allDisplayPOIs,
      mapFilters,
      handleFilterUpdate,
      // Proposal preview loading
      isLoadingProposalPreview,
      // Proposal dialogs
      editProposalDialog,
      deleteProposalDialog,
      lootProposalDialog,
      itemProposalDialog,
      npcProposalDialog,
      npcEditProposalDialog,
      itemEditProposalDialog,
      itemSearchDialog,
      addNPCDialog,
      handleItemProposalSelected,
      // New modal handlers
      itemInfoModal,
      npcListModal,
      handleItemSelected,
      handleNPCSelected,
      handleItemSelectedFromNPC,
      handlePOINavigation,
      isTransitioningMap,
      // Proposal popup handlers
      handleProposalPopupClose,
      handleProposalVoteSuccess,
      handleToggleProposedLocation,
      handleProposalWithdrawn,
      // Computed properties for proposals
      proposalsSourceActive,
      selectedPOIHasProposal,
      // Ko-fi widget
      openKofiWidget
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

/* Prompt Dialog Styles */
.prompt-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(5px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.prompt-dialog {
  background: #2d2d2d;
  border: 2px solid #4a7c59;
  border-radius: 8px;
  padding: 1.5rem;
  max-width: 400px;
  width: 90%;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
}

.prompt-title {
  color: #FFD700;
  font-size: 1.25rem;
  margin: 0 0 0.5rem 0;
  font-family: 'Cinzel', serif;
}

.prompt-message {
  color: #e0e0e0;
  margin: 0 0 1rem 0;
  font-size: 0.95rem;
}

.prompt-input {
  width: 100%;
  padding: 0.75rem;
  background: #1a1a1a;
  border: 1px solid #4a7c59;
  border-radius: 4px;
  color: #e0e0e0;
  font-size: 1rem;
  margin-bottom: 1rem;
  transition: border-color 0.2s;
}

.prompt-input:focus {
  outline: none;
  border-color: #5fa772;
  box-shadow: 0 0 0 2px rgba(95, 167, 114, 0.2);
}

.prompt-input:disabled {
  background: #0d0d0d;
  color: #666;
  cursor: not-allowed;
  border-color: #333;
}

.prompt-buttons {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
}

.prompt-confirm-btn,
.prompt-cancel-btn {
  padding: 0.5rem 1.25rem;
  border: none;
  border-radius: 4px;
  font-size: 0.95rem;
  cursor: pointer;
  transition: all 0.2s;
}

.prompt-confirm-btn {
  background: #4a7c59;
  color: white;
}

.prompt-confirm-btn:hover {
  background: #5fa772;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(74, 124, 89, 0.3);
}

.prompt-cancel-btn {
  background: #444;
  color: #e0e0e0;
}

.prompt-cancel-btn:hover {
  background: #555;
}

/* Proposal Preview Loading */
.proposal-preview-loading {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(5px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.loading-content {
  text-align: center;
  color: #fff;
}

.loading-spinner {
  width: 60px;
  height: 60px;
  border: 4px solid rgba(255, 255, 255, 0.1);
  border-top: 4px solid #4CAF50;
  border-radius: 50%;
  margin: 0 auto 1rem;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.loading-content p {
  font-size: 1.1rem;
  color: #e0e0e0;
  margin: 0;
}

.admin-text {
  color: #4a7c59;
  font-weight: 500;
}

.admin-toggle {
  display: flex;
  align-items: center;
}

.admin-toggle-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: #3a3a3a;
  border: 1px solid #555;
  border-radius: 6px;
  color: #ccc;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
}

.admin-toggle-button:hover {
  background: #444;
  border-color: #666;
  color: #fff;
}

.admin-toggle-button.active {
  background: rgba(74, 124, 89, 0.2);
  border-color: rgba(74, 124, 89, 0.6);
  color: #4a7c59;
}

.admin-icon {
  font-size: 1.1rem;
}

.toggle-indicator {
  width: 36px;
  height: 20px;
  background: #555;
  border-radius: 10px;
  position: relative;
  transition: background 0.2s ease;
  margin-left: 0.5rem;
}

.toggle-indicator::after {
  content: '';
  position: absolute;
  width: 16px;
  height: 16px;
  background: white;
  border-radius: 50%;
  top: 2px;
  left: 2px;
  transition: transform 0.2s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.toggle-indicator.on {
  background: #4a7c59;
}

.toggle-indicator.on::after {
  transform: translateX(16px);
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

/* User controls */
.user-controls {
  display: flex;
  align-items: center;
}

.login-button {
  background: #4a7c59;
  color: white;
  border: 1px solid #4a7c59;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;
  font-weight: 500;
}

.login-button:hover {
  background: #3a6249;
  border-color: #3a6249;
}

.user-dropdown-container {
  position: relative;
}

.user-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  overflow: hidden;
  transition: box-shadow 0.2s;
  text-decoration: none;
  cursor: pointer;
  border: 1px solid #ddd;
  background: #f5f5f5;
  padding: 0;
}

.user-button:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.user-avatar {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.user-initials {
  width: 100%;
  height: 100%;
  background: #4a7c59;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 500;
  font-size: 1rem;
}

.user-dropdown-menu {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 8px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  min-width: 160px;
  overflow: hidden;
  z-index: 1000;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  text-decoration: none;
  color: #333;
  font-size: 14px;
  border: none;
  background: none;
  width: 100%;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.2s;
}

.dropdown-item:hover {
  background-color: #f5f5f5;
}

.dropdown-item:not(:last-child) {
  border-bottom: 1px solid #eee;
}

.dropdown-icon {
  font-size: 16px;
}

/* Map Controls */
.controls {
  position: fixed;
  bottom: 1rem;
  right: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  z-index: 100;
}

.control-btn {
  width: 50px;
  height: 50px;
  background: rgba(0, 0, 0, 0.8);
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  color: white;
  font-size: 1.2rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(10px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.control-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.4);
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
}

.control-btn:active {
  transform: translateY(0);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.admin-btn {
  background: linear-gradient(135deg, rgba(74, 124, 89, 0.9), rgba(58, 98, 69, 0.9));
  border-color: rgba(74, 124, 89, 0.6);
}

.admin-btn:hover {
  background: linear-gradient(135deg, rgba(74, 124, 89, 1), rgba(58, 98, 69, 1));
  border-color: rgba(74, 124, 89, 0.8);
}

.zoom-indicator {
  background: rgba(0, 0, 0, 0.8);
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  color: white;
  padding: 0.5rem;
  font-size: 0.9rem;
  font-weight: 500;
  text-align: center;
  backdrop-filter: blur(10px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  min-width: 50px;
}

.proposal-btn {
  background: rgba(34, 197, 94, 0.2) !important;
  border-color: rgba(34, 197, 94, 0.4) !important;
  font-size: 1.1rem !important;
  font-weight: 600 !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3) !important;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3) !important;
}

.proposal-btn:hover {
  background: rgba(34, 197, 94, 0.3) !important;
  border-color: rgba(34, 197, 94, 0.6) !important;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4) !important;
}

/* Control button dropdown */
.control-btn-dropdown {
  position: relative;
}

.control-btn-dropdown .control-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.2rem;
  padding: 0 0.5rem;
}

.dropdown-arrow {
  font-size: 0.6rem;
  opacity: 0.7;
  transition: transform 0.2s ease;
}

.control-btn-dropdown:hover .dropdown-arrow {
  transform: translateY(1px);
}

.control-dropdown-menu {
  position: absolute;
  bottom: calc(100% + 0.5rem);
  right: 0;
  background: rgba(0, 0, 0, 0.95);
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  overflow: hidden;
  min-width: 180px;
  backdrop-filter: blur(10px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  animation: dropdownSlideUp 0.2s ease-out;
}

@keyframes dropdownSlideUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.control-dropdown-menu .dropdown-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: none;
  border: none;
  color: #e0e0e0;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.15s ease;
  width: 100%;
  text-align: left;
}

.control-dropdown-menu .dropdown-item:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.control-dropdown-menu .dropdown-item .dropdown-icon {
  font-size: 1.1rem;
  width: 1.2rem;
  text-align: center;
}

.control-dropdown-menu .dropdown-item:not(:last-child) {
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .controls {
    bottom: 0.5rem;
    right: 0.5rem;
  }
  
  .control-btn {
    width: 45px;
    height: 45px;
    font-size: 1.1rem;
  }
  
  .proposal-btn {
    font-size: 1rem !important;
  }
}

/* Hide default Ko-fi button */
.floatingchat-container-wrap {
  display: none !important;
  visibility: hidden !important;
}

/* Custom Ko-fi Donation Button */
.custom-kofi-button {
  position: fixed;
  bottom: 20px;
  left: 20px;
  z-index: 999;
  background: #4a7c59;
  border: 2px solid #FFD700;
  border-radius: 50px;
  padding: 12px 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 10px;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
  animation: subtlePulse 3s ease-in-out infinite;
}

@keyframes subtlePulse {
  0%, 100% {
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
  }
  50% {
    box-shadow: 0 4px 20px rgba(255, 215, 0, 0.4);
  }
}

.custom-kofi-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(255, 215, 0, 0.5);
  background: #5a8c69;
}

.custom-kofi-button:active {
  transform: translateY(0);
}

.kofi-logo {
  width: 40px;
  height: 40px;
  transition: transform 0.3s ease;
}

.custom-kofi-button:hover .kofi-logo {
  transform: rotate(10deg) scale(1.1);
}

.kofi-text {
  color: #FFD700;
  font-weight: bold;
  font-size: 14px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  white-space: nowrap;
}

/* Hide text on small screens */
@media (max-width: 768px) {
  .kofi-text {
    display: none;
  }
  
  .custom-kofi-button {
    padding: 12px;
    left: 15px;
    bottom: 15px;
  }
}

/* Modal Overlay Fix */
.modal-overlay {
  position: fixed !important;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.modal-content {
  position: relative;
  background: #2d2d2d;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
}

/* NPC List Modal */
.npc-list-modal {
  max-width: 700px;
  width: 90%;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
  border: 2px solid #4a7c59;
  padding: 0;
}

.npc-list-modal .modal-header {
  padding: 1.5rem;
  background: rgba(74, 124, 89, 0.1);
  border-bottom: 1px solid rgba(74, 124, 89, 0.3);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.npc-list-modal .modal-header h3 {
  margin: 0;
  color: #FFD700;
  font-family: 'Cinzel', serif;
  font-size: 1.5rem;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
}

.npc-list-modal .close-btn {
  background: none;
  border: none;
  color: #999;
  font-size: 1.5rem;
  cursor: pointer;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.npc-list-modal .close-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.npc-list-modal .modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
  scrollbar-width: thin;
  scrollbar-color: #4a7c59 #1a1a1a;
}

.npc-list-modal .modal-body::-webkit-scrollbar {
  width: 8px;
}

.npc-list-modal .modal-body::-webkit-scrollbar-track {
  background: #1a1a1a;
  border-radius: 4px;
}

.npc-list-modal .modal-body::-webkit-scrollbar-thumb {
  background: #4a7c59;
  border-radius: 4px;
}

.npc-list-modal .modal-body::-webkit-scrollbar-thumb:hover {
  background: #5fa772;
}

.npc-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.npc-list-header {
  color: #FFD700;
  font-weight: 600;
  margin-bottom: 1rem;
  font-size: 1.1rem;
  padding: 1rem;
  background: rgba(255, 215, 0, 0.05);
  border-radius: 6px;
  border: 1px solid rgba(255, 215, 0, 0.1);
}

.npc-list-item {
  background: linear-gradient(135deg, rgba(0, 0, 0, 0.4) 0%, rgba(0, 0, 0, 0.6) 100%);
  border: 1px solid #444;
  border-radius: 6px;
  padding: 1rem 1.25rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: all 0.2s ease;
  cursor: pointer;
}

.npc-list-item:hover {
  background: linear-gradient(135deg, rgba(0, 0, 0, 0.5) 0%, rgba(0, 0, 0, 0.7) 100%);
  border-color: #666;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.npc-main-info {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.npc-name {
  color: #FFD700;
  font-weight: bold;
  font-size: 1.2rem;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}

.npc-level {
  color: #FFA500;
  font-weight: 500;
  font-size: 1rem;
  background: rgba(255, 165, 0, 0.1);
  padding: 0.25rem 0.75rem;
  border-radius: 4px;
  border: 1px solid rgba(255, 165, 0, 0.2);
}

.npc-id {
  color: #888;
  font-size: 0.85rem;
  font-family: monospace;
  background: rgba(0, 0, 0, 0.3);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}

.no-npcs {
  text-align: center;
  color: #999;
  padding: 2rem;
}
</style>