<template>
  <div v-if="visible" class="poi-popup" :class="{ 'left-side': isLeftSide }" :style="popupStyle" @click.stop>
    <div class="poi-popup-header">
      <div v-if="!isEditing.name" class="editable-field" :class="{ editable: isAdmin }">
        <h3 @click="isAdmin && startEdit('name')">
          {{ localPoi.name }}
        </h3>
        <button v-if="isAdmin" class="field-delete-btn" @click.stop="deleteField('name')" title="Clear name">×</button>
      </div>
      <input 
        v-else
        v-model="localPoi.name"
        @keyup.enter="saveEdit('name')"
        @keyup.esc="cancelEdit"
        @blur="saveEdit('name')"
        ref="nameInput"
        class="edit-input"
      />
      <button class="close-btn" @click="$emit('close')">×</button>
    </div>
    <div class="poi-popup-content">
      <div v-if="!isEditing.description" class="editable-field" :class="{ editable: isAdmin }">
        <p @click="isAdmin && startEdit('description')" v-html="formattedDescription"></p>
        <button v-if="isAdmin && localPoi.description" class="field-delete-btn" @click.stop="deleteField('description')" title="Clear description">×</button>
      </div>
      <textarea
        v-else
        v-model="localPoi.description"
        @keyup.enter.ctrl="saveEdit('description')"
        @keyup.esc="cancelEdit"
        @blur="saveEdit('description')"
        ref="descriptionInput"
        class="edit-textarea"
        rows="3"
        placeholder="Enter description..."
      ></textarea>
      
      <div v-if="localPoi.type !== undefined || localPoi.type_id !== undefined" class="poi-type">
        <span class="type-icon">{{ getTypeIcon(localPoi.type || localPoi.type_id) }}</span>
        <span v-if="!isEditing.type" @click="isAdmin && startEdit('type')" class="type-text" :class="{ editable: isAdmin }">
          {{ formatType(localPoi.type || localPoi.type_id) }}
        </span>
        <select
          v-else
          v-model="localPoi.type"
          @change="saveEdit('type')"
          @blur="saveEdit('type')"
          ref="typeSelect"
          class="edit-select"
        >
          <option value="landmark">Landmark</option>
          <option value="quest">Quest</option>
          <option value="merchant">Merchant</option>
          <option value="npc">NPC</option>
          <option value="dungeon">Dungeon</option>
          <option value="other">Other</option>
        </select>
      </div>
      
      <div v-else class="poi-type">
        <span class="type-icon">{{ localPoi.icon || '📍' }}</span>
        <span class="type-text">Custom POI</span>
      </div>
      
      <!-- NPC Information -->
      <div v-if="localPoi.npc_id && npcData" class="poi-npc-info">
        <div class="info-section-header">
          <span class="section-icon">⚔️</span>
          <span class="section-title">NPC Information</span>
        </div>
        <div class="npc-details">
          <div class="npc-header">
            <span class="npc-name">{{ npcData.name }}</span>
            <span class="npc-level">Level {{ npcData.level }}</span>
          </div>
          <div v-if="npcData.description" class="npc-description" v-html="formatDescription(npcData.description)"></div>
          <div class="npc-stats">
            <div class="stat-row">
              <span class="stat-label">HP:</span>
              <span class="stat-value">{{ npcData.hp }}</span>
              <span class="stat-label">AC:</span>
              <span class="stat-value">{{ npcData.ac }}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">Damage:</span>
              <span class="stat-value">{{ npcData.min_dmg }}-{{ npcData.max_dmg }}</span>
            </div>
          </div>
          <div v-if="npcData.loot_items && npcData.loot_items.length > 0" class="npc-loot">
            <div class="loot-header">Drops:</div>
            <div class="loot-list">
              <div v-for="item in npcData.loot_items" :key="item.id" class="loot-item">
                <span v-if="item.icon_type === 'emoji'" class="item-icon">{{ item.icon_value }}</span>
                <iconify-icon v-else :icon="item.icon_value" class="item-icon"></iconify-icon>
                <span 
                  class="item-name" 
                  @mouseenter="showItemTooltip($event, item.id)"
                  @mouseleave="startTooltipHideTimer"
                >{{ item.name }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Item Information -->
      <div v-if="localPoi.item_id && itemData" class="poi-item-info">
        <div class="info-section-header">
          <span class="section-icon">💎</span>
          <span class="section-title">Item Information</span>
        </div>
        <div class="item-details">
          <div class="item-header">
            <span v-if="itemData.icon_type === 'emoji'" class="item-large-icon">{{ itemData.icon_value }}</span>
            <iconify-icon v-else :icon="itemData.icon_value" class="item-large-icon" width="32"></iconify-icon>
            <span class="item-name">{{ itemData.name }}</span>
          </div>
          <div v-if="itemData.description" class="item-description" v-html="formatDescription(itemData.description)"></div>
          <div class="item-stats">
            <div v-if="itemData.slot" class="stat-row">
              <span class="stat-label">Slot:</span>
              <span class="stat-value">{{ itemData.slot }}</span>
            </div>
            <div v-if="hasStats" class="stat-grid">
              <div v-if="itemData.str" class="stat-item">STR: +{{ itemData.str }}</div>
              <div v-if="itemData.sta" class="stat-item">STA: +{{ itemData.sta }}</div>
              <div v-if="itemData.agi" class="stat-item">AGI: +{{ itemData.agi }}</div>
              <div v-if="itemData.dex" class="stat-item">DEX: +{{ itemData.dex }}</div>
              <div v-if="itemData.wis" class="stat-item">WIS: +{{ itemData.wis }}</div>
              <div v-if="itemData.int" class="stat-item">INT: +{{ itemData.int }}</div>
              <div v-if="itemData.cha" class="stat-item">CHA: +{{ itemData.cha }}</div>
              <div v-if="itemData.ac" class="stat-item">AC: +{{ itemData.ac }}</div>
              <div v-if="itemData.health" class="stat-item">HP: +{{ itemData.health }}</div>
              <div v-if="itemData.mana" class="stat-item">MP: +{{ itemData.mana }}</div>
            </div>
          </div>
        </div>
      </div>
      
      <div v-if="localPoi.display_created_by || localPoi.created_by || localPoi.owner_name" class="poi-creator">
        <span class="creator-label">Created by:</span>
        <span class="creator-name">{{ localPoi.display_created_by || localPoi.created_by || localPoi.owner_name }}</span>
      </div>
      
      <!-- Proposal POI indicator -->
      <div v-if="localPoi.is_proposal" class="poi-proposal-info">
        <div class="proposal-badge" :class="localPoi.is_proposed ? 'proposed' : 'current'">
          {{ localPoi.is_proposed ? 'PROPOSED LOCATION' : 'CURRENT LOCATION' }}
        </div>
        <div v-if="localPoi.proposer_name" class="proposal-proposer">
          Proposed by: {{ localPoi.proposer_name }}
        </div>
      </div>
      
      <!-- Custom POI Status -->
      <div v-if="isCustomPOI && localPoi.status" class="poi-status">
        <span class="status-label">Status:</span>
        <span :class="['status-value', `status-${localPoi.status}`]">
          {{ formatStatus(localPoi.status) }}
        </span>
      </div>
      
      <!-- Voting information for pending POIs -->
      <div v-if="isCustomPOI && localPoi.status === 'pending' && localPoi.vote_score !== undefined" class="poi-voting-inline">
        <span class="vote-item">
          <span class="vote-icon">👍</span>
          <span class="vote-count upvote">{{ localPoi.upvotes || 0 }}</span>
        </span>
        <span class="vote-item">
          <span class="vote-icon">👎</span>
          <span class="vote-count downvote">{{ localPoi.downvotes || 0 }}</span>
        </span>
        <span class="vote-total" :class="localPoi.vote_score > 0 ? 'positive' : localPoi.vote_score < 0 ? 'negative' : ''">
          ({{ localPoi.vote_score > 0 ? '+' : '' }}{{ localPoi.vote_score || 0 }})
        </span>
      </div>
      
      <!-- Active change proposals for regular POIs -->
      <div v-if="!isCustomPOI && !localPoi.is_proposal && proposalVoteStats" class="poi-active-proposals">
        <div class="proposal-header">
          <span class="proposal-icon">📋</span>
          <span class="proposal-label">Active Proposals ({{ proposalVoteStats.count }})</span>
        </div>
        <div class="vote-stats">
          <span class="vote-item">
            <span class="vote-icon">👍</span>
            <span class="vote-count upvote">{{ proposalVoteStats.upvotes }}</span>
          </span>
          <span class="vote-item">
            <span class="vote-icon">👎</span>
            <span class="vote-count downvote">{{ proposalVoteStats.downvotes }}</span>
          </span>
          <span class="vote-total" :class="proposalVoteStats.score > 0 ? 'positive' : proposalVoteStats.score < 0 ? 'negative' : ''">
            ({{ proposalVoteStats.score > 0 ? '+' : '' }}{{ proposalVoteStats.score }})
          </span>
        </div>
      </div>
      
      <!-- Shared indicator -->
      <div v-if="isSharedPOI" class="poi-shared">
        <span class="shared-icon">🔗</span>
        <span class="shared-text">Shared by {{ localPoi.owner_name || 'Unknown' }}</span>
      </div>
      
      <div v-if="canEdit && !localPoi.is_proposal" class="edit-hints">
        <p class="edit-hint">{{ isAdmin ? 'Click any field to edit' : 'Alt+drag to move' }}</p>
        <p class="edit-hint">C+drag to copy</p>
      </div>
      <div v-else-if="isAuthenticated && !isCustomPOI && !localPoi.is_proposal && !isAdmin" class="edit-hints">
        <p class="edit-hint">Alt+drag to propose location change</p>
        <p class="edit-hint">C+drag to copy</p>
      </div>
      <p v-else-if="isOwnCustomPOI && localPoi.status === 'pending'" class="edit-hint pending-hint">
        POI can not be edited while pending publication.
      </p>
      <!-- Show copy hint for all authenticated users even if they can't edit -->
      <p v-else-if="isAuthenticated && !localPoi.is_proposal" class="edit-hint">C+drag to copy</p>
      
      <!-- Action buttons for custom POIs -->
      <div v-if="isOwnCustomPOI && localPoi.status !== 'pending'" class="custom-poi-actions">
        <button v-if="canPublish" class="publish-btn" @click="handlePublish">
          Publish
        </button>
        <button class="delete-btn" @click="handleDelete">
          Delete
        </button>
      </div>
      
      <!-- Admin buttons for regular POIs -->
      <div v-else-if="isAdmin && !isCustomPOI && !localPoi.is_proposal" class="admin-poi-actions">
        <button class="edit-btn" @click="handleEdit">
          Edit in POI Editor
        </button>
        <button class="delete-btn" @click="handleDelete">
          Delete POI
        </button>
      </div>
      
      <!-- User proposal buttons for regular POIs -->
      <div v-else-if="isAuthenticated && !isAdmin && !isCustomPOI && !localPoi.is_proposal && !localPoi.has_pending_proposal" class="user-poi-actions-dropdown">
        <div class="proposal-dropdown" ref="editDropdown">
          <button 
            class="propose-btn-main" 
            @click="toggleEditDropdown" 
            :aria-expanded="showEditDropdown"
            title="Propose changes"
          >
            <span class="action-icon">✏️</span>
            <span class="action-text">Edit</span>
            <span class="dropdown-arrow">▼</span>
          </button>
          <div v-if="showEditDropdown" class="dropdown-menu">
            <button class="dropdown-item" @click="handleProposalAction('propose-edit')" title="Propose changes to this POI">
              <span class="item-icon">📍</span>
              <span class="item-text">Edit POI Details</span>
            </button>
            <button 
              v-if="canProposeNPCEdit" 
              class="dropdown-item" 
              @click="handleProposalAction('propose-npc-edit')"
              title="Propose changes to NPC stats"
            >
              <span class="item-icon">⚔️</span>
              <span class="item-text">Edit NPC Stats</span>
            </button>
            <button 
              v-if="canProposeLoot" 
              class="dropdown-item" 
              @click="handleProposalAction('propose-loot')"
              title="Propose loot items for this NPC"
            >
              <span class="item-icon">💎</span>
              <span class="item-text">Edit NPC Loot</span>
            </button>
          </div>
        </div>
        <button class="propose-btn-main delete" @click="$emit('propose-delete', localPoi)" title="Propose deletion of this POI">
          <span class="action-icon">🗑️</span>
          <span class="action-text">Delete</span>
        </button>
      </div>
      
      <!-- Pending proposal indicator -->
      <div v-else-if="localPoi.has_pending_proposal" class="pending-proposal-notice">
        <span class="notice-icon">⏳</span>
        <span class="notice-text">This POI has a pending change proposal</span>
      </div>
    </div>
    
    <!-- Item Tooltip -->
    <div 
      v-if="tooltipItem && tooltipVisible" 
      class="item-tooltip"
      :style="tooltipStyle"
      @mouseenter="cancelTooltipHide"
      @mouseleave="hideItemTooltip"
    >
      <!-- Header with icon and name -->
      <div class="tooltip-header">
        <div class="header-content">
          <span v-if="tooltipItem.icon_type === 'emoji'" class="tooltip-icon">{{ tooltipItem.icon_value || '📦' }}</span>
          <iconify-icon v-else-if="tooltipItem.icon_type === 'iconify'" :icon="tooltipItem.icon_value" class="tooltip-icon" width="28"></iconify-icon>
          <div class="header-text">
            <div class="tooltip-name">{{ tooltipItem.name }}</div>
            <div v-if="tooltipItem.item_type" class="tooltip-type">{{ formatItemType(tooltipItem.item_type) }}</div>
          </div>
        </div>
      </div>
      
      <!-- Slot and basic info -->
      <div v-if="tooltipItem.slot || (tooltipItem.slots && tooltipItem.slots.length > 0) || tooltipItem.skill" class="tooltip-basic-info">
        <div v-if="tooltipItem.slot || (tooltipItem.slots && tooltipItem.slots.length > 0)" class="info-line">
          <span class="info-label">Slot:</span>
          <span class="info-value">{{ tooltipItem.slots && tooltipItem.slots.length > 0 ? tooltipItem.slots.join(', ') : tooltipItem.slot }}</span>
        </div>
        <div v-if="tooltipItem.skill" class="info-line">
          <span class="info-label">Skill:</span>
          <span class="info-value">{{ tooltipItem.skill }}</span>
        </div>
      </div>
      
      <!-- Combat Stats for weapons -->
      <div v-if="hasTooltipCombatStats" class="tooltip-section combat-section">
        <div v-if="tooltipItem.damage" class="combat-line">
          <span class="combat-label">Damage:</span>
          <span class="combat-value">{{ tooltipItem.damage }}</span>
        </div>
        <div v-if="tooltipItem.delay" class="combat-line">
          <span class="combat-label">Delay:</span>
          <span class="combat-value">{{ tooltipItem.delay }}</span>
        </div>
        <div v-if="tooltipItem.attack_speed && tooltipItem.attack_speed !== 0 && tooltipItem.attack_speed !== '0' && tooltipItem.attack_speed !== '0.0'" class="combat-line">
          <span class="combat-label">Attack Speed:</span>
          <span class="combat-value">{{ tooltipItem.attack_speed }}</span>
        </div>
      </div>
      
      <!-- Defensive Stats -->
      <div v-if="tooltipItem.ac || tooltipItem.block" class="tooltip-section defensive-section">
        <div v-if="tooltipItem.ac" class="stat-line">
          <span class="stat-value" :class="{ negative: tooltipItem.ac < 0 }">{{ formatStatValue(tooltipItem.ac) }} AC</span>
        </div>
        <div v-if="tooltipItem.block" class="stat-line">
          <span class="stat-value" :class="{ negative: tooltipItem.block < 0 }">{{ formatStatValue(tooltipItem.block) }} Block</span>
        </div>
      </div>
      
      <!-- Primary Stats -->
      <div v-if="hasTooltipStats" class="tooltip-section stats-section">
        <div class="stats-grid">
          <div v-if="tooltipItem.str" class="stat-item" :class="{ negative: tooltipItem.str < 0 }">
            <span class="stat-label">STR</span>
            <span class="stat-value">{{ formatStatValue(tooltipItem.str) }}</span>
          </div>
          <div v-if="tooltipItem.sta" class="stat-item" :class="{ negative: tooltipItem.sta < 0 }">
            <span class="stat-label">STA</span>
            <span class="stat-value">{{ formatStatValue(tooltipItem.sta) }}</span>
          </div>
          <div v-if="tooltipItem.agi" class="stat-item" :class="{ negative: tooltipItem.agi < 0 }">
            <span class="stat-label">AGI</span>
            <span class="stat-value">{{ formatStatValue(tooltipItem.agi) }}</span>
          </div>
          <div v-if="tooltipItem.dex" class="stat-item" :class="{ negative: tooltipItem.dex < 0 }">
            <span class="stat-label">DEX</span>
            <span class="stat-value">{{ formatStatValue(tooltipItem.dex) }}</span>
          </div>
          <div v-if="tooltipItem.wis" class="stat-item" :class="{ negative: tooltipItem.wis < 0 }">
            <span class="stat-label">WIS</span>
            <span class="stat-value">{{ formatStatValue(tooltipItem.wis) }}</span>
          </div>
          <div v-if="tooltipItem.int" class="stat-item" :class="{ negative: tooltipItem.int < 0 }">
            <span class="stat-label">INT</span>
            <span class="stat-value">{{ formatStatValue(tooltipItem.int) }}</span>
          </div>
          <div v-if="tooltipItem.cha" class="stat-item" :class="{ negative: tooltipItem.cha < 0 }">
            <span class="stat-label">CHA</span>
            <span class="stat-value">{{ formatStatValue(tooltipItem.cha) }}</span>
          </div>
        </div>
      </div>
      
      <!-- HP/Mana bonuses -->
      <div v-if="tooltipItem.health || tooltipItem.mana" class="tooltip-section bonus-section">
        <div v-if="tooltipItem.health" class="bonus-line">
          <span class="bonus-value" :class="{ negative: tooltipItem.health < 0 }">{{ formatStatValue(tooltipItem.health) }} Hit Points</span>
        </div>
        <div v-if="tooltipItem.mana" class="bonus-line">
          <span class="bonus-value" :class="{ negative: tooltipItem.mana < 0 }">{{ formatStatValue(tooltipItem.mana) }} Mana</span>
        </div>
      </div>
      
      <!-- Resistances -->
      <div v-if="hasTooltipResistances" class="tooltip-section resistance-section">
        <div class="section-header">Resistances</div>
        <div class="resistance-grid">
          <div v-if="tooltipItem.resist_fire" class="resistance-item" :class="{ negative: tooltipItem.resist_fire < 0 }">
            <span class="resistance-icon">🔥</span>
            <span class="resistance-value">{{ formatStatValue(tooltipItem.resist_fire) }}</span>
          </div>
          <div v-if="tooltipItem.resist_cold || tooltipItem.resist_ice" class="resistance-item" :class="{ negative: (tooltipItem.resist_cold || tooltipItem.resist_ice) < 0 }">
            <span class="resistance-icon">❄️</span>
            <span class="resistance-value">{{ formatStatValue(tooltipItem.resist_cold || tooltipItem.resist_ice) }}</span>
          </div>
          <div v-if="tooltipItem.resist_magic" class="resistance-item" :class="{ negative: tooltipItem.resist_magic < 0 }">
            <span class="resistance-icon">✨</span>
            <span class="resistance-value">{{ formatStatValue(tooltipItem.resist_magic) }}</span>
          </div>
          <div v-if="tooltipItem.resist_poison" class="resistance-item" :class="{ negative: tooltipItem.resist_poison < 0 }">
            <span class="resistance-icon">☠️</span>
            <span class="resistance-value">{{ formatStatValue(tooltipItem.resist_poison) }}</span>
          </div>
          <div v-if="tooltipItem.resist_disease" class="resistance-item" :class="{ negative: tooltipItem.resist_disease < 0 }">
            <span class="resistance-icon">🦠</span>
            <span class="resistance-value">{{ formatStatValue(tooltipItem.resist_disease) }}</span>
          </div>
          <div v-if="tooltipItem.resist_electricity" class="resistance-item" :class="{ negative: tooltipItem.resist_electricity < 0 }">
            <span class="resistance-icon">⚡</span>
            <span class="resistance-value">{{ formatStatValue(tooltipItem.resist_electricity) }}</span>
          </div>
          <div v-if="tooltipItem.resist_corruption" class="resistance-item" :class="{ negative: tooltipItem.resist_corruption < 0 }">
            <span class="resistance-icon">💀</span>
            <span class="resistance-value">{{ formatStatValue(tooltipItem.resist_corruption) }}</span>
          </div>
        </div>
      </div>
      
      <!-- Race/Class requirements -->
      <div v-if="(tooltipItem.race && tooltipItem.race !== 'ALL') || (tooltipItem.class && tooltipItem.class !== 'ALL')" class="tooltip-section requirements-section">
        <div v-if="tooltipItem.race && tooltipItem.race !== 'ALL'" class="requirement-line">
          <span class="requirement-label">Race:</span>
          <span class="requirement-value">{{ tooltipItem.race }}</span>
        </div>
        <div v-if="tooltipItem.class && tooltipItem.class !== 'ALL'" class="requirement-line">
          <span class="requirement-label">Class:</span>
          <span class="requirement-value">{{ tooltipItem.class }}</span>
        </div>
      </div>
      
      <!-- Weight/Size at bottom -->
      <div v-if="(tooltipItem.weight && tooltipItem.weight > 0) || (tooltipItem.size && tooltipItem.size !== 'Medium')" class="tooltip-section property-section">
        <div class="property-line">
          <span v-if="tooltipItem.weight && tooltipItem.weight > 0" class="property-item">Weight: {{ tooltipItem.weight }}</span>
          <span v-if="tooltipItem.size && tooltipItem.size !== 'Medium'" class="property-item">Size: {{ tooltipItem.size }}</span>
        </div>
      </div>
      
      <!-- Description -->
      <div v-if="tooltipItem.description" class="tooltip-description" v-html="formatDescription(tooltipItem.description)"></div>
      
      <!-- Actions -->
      <div v-if="isAuthenticated && !isAdmin" class="tooltip-actions">
        <button class="tooltip-edit-btn" @click="proposeItemEdit" title="Propose changes to this item">
          <span class="btn-icon">✏️</span>
          <span class="btn-text">Propose Edit</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'

export default {
  name: 'POIPopup',
  props: {
    poi: {
      type: Object,
      required: true
    },
    visible: {
      type: Boolean,
      default: false
    },
    position: {
      type: Object,
      default: () => ({ x: 0, y: 0 })
    },
    isAdmin: {
      type: Boolean,
      default: false
    },
    isLeftSide: {
      type: Boolean,
      default: false
    },
    currentUserId: {
      type: Number,
      default: null
    },
    isAuthenticated: {
      type: Boolean,
      default: false
    }
  },
  emits: ['close', 'delete', 'update', 'confirmUpdate', 'publish', 'propose-edit', 'propose-delete', 'propose-loot', 'propose-npc-edit', 'propose-item-edit'],
  setup(props, { emit }) {
    const localPoi = ref({ ...props.poi })
    const originalValues = ref({})
    const isEditing = ref({
      name: false,
      description: false,
      type: false
    })
    
    const nameInput = ref(null)
    const descriptionInput = ref(null)
    const typeSelect = ref(null)
    const editDropdown = ref(null)
    const showEditDropdown = ref(false)
    
    // Data for NPC and Item
    const npcData = ref(null)
    const itemData = ref(null)
    const activeProposals = ref([])
    
    // Tooltip data
    const tooltipItem = ref(null)
    const tooltipVisible = ref(false)
    const tooltipPosition = ref({ x: 0, y: 0 })
    let tooltipTimeout = null
    let currentTooltipItemId = null
    
    // Update local POI when prop changes
    watch(() => props.poi, (newPoi) => {
      localPoi.value = { ...newPoi }
      // Reset error flags for new POI
      delete localPoi.value._npcErrorLogged
      delete localPoi.value._itemErrorLogged
      // Fetch new NPC/Item data when POI changes
      fetchNPCData()
      fetchItemData()
      fetchActiveProposals()
    }, { deep: true })
    
    // Fetch NPC data when npc_id changes
    const fetchNPCData = async () => {
      if (!localPoi.value.npc_id) {
        npcData.value = null
        return
      }
      
      try {
        const response = await fetch(`/api/npcs/${localPoi.value.npc_id}`)
        if (response.ok) {
          npcData.value = await response.json()
        } else if (response.status === 404) {
          // NPC not found is not an error worth logging
          npcData.value = null
        } else {
          // Only log actual errors once
          if (!localPoi.value._npcErrorLogged) {
            console.error(`Error fetching NPC data: ${response.status} ${response.statusText}`)
            localPoi.value._npcErrorLogged = true
          }
          npcData.value = null
        }
      } catch (error) {
        // Only log error once, not repeatedly
        if (!localPoi.value._npcErrorLogged) {
          console.error('Error fetching NPC data:', error)
          localPoi.value._npcErrorLogged = true
        }
        npcData.value = null
      }
    }
    
    // Fetch Item data when item_id changes
    const fetchItemData = async () => {
      if (!localPoi.value.item_id) {
        itemData.value = null
        return
      }
      
      try {
        const response = await fetch(`/api/items/${localPoi.value.item_id}`)
        if (response.ok) {
          itemData.value = await response.json()
        } else if (response.status === 404) {
          // Item not found is not an error worth logging
          itemData.value = null
        } else {
          // Only log actual errors once
          if (!localPoi.value._itemErrorLogged) {
            console.error(`Error fetching item data: ${response.status} ${response.statusText}`)
            localPoi.value._itemErrorLogged = true
          }
          itemData.value = null
        }
      } catch (error) {
        // Only log error once, not repeatedly
        if (!localPoi.value._itemErrorLogged) {
          console.error('Error fetching item data:', error)
          localPoi.value._itemErrorLogged = true
        }
        itemData.value = null
      }
    }
    
    // Fetch active change proposals for this POI
    const fetchActiveProposals = async () => {
      // Only fetch for regular POIs (not custom or proposal POIs)
      if (!localPoi.value.id || isCustomPOI.value || localPoi.value.is_proposal) {
        activeProposals.value = []
        return
      }
      
      try {
        const response = await fetch(`/api/pois/${localPoi.value.id}/active-proposals`)
        if (response.ok) {
          activeProposals.value = await response.json()
        } else {
          activeProposals.value = []
        }
      } catch (error) {
        console.error('Error fetching active proposals:', error)
        activeProposals.value = []
      }
    }
    
    // Compute total votes for active proposals
    const proposalVoteStats = computed(() => {
      if (activeProposals.value.length === 0) return null
      
      // Aggregate votes across all active proposals
      const totalUpvotes = activeProposals.value.reduce((sum, p) => sum + (p.upvotes || 0), 0)
      const totalDownvotes = activeProposals.value.reduce((sum, p) => sum + (p.downvotes || 0), 0)
      const totalScore = activeProposals.value.reduce((sum, p) => sum + (p.vote_score || 0), 0)
      
      return {
        upvotes: totalUpvotes,
        downvotes: totalDownvotes,
        score: totalScore,
        count: activeProposals.value.length
      }
    })
    
    // Initial fetch
    onMounted(() => {
      fetchNPCData()
      fetchItemData()
      fetchActiveProposals()
    })
    
    // Cleanup on unmount
    onUnmounted(() => {
      // Clear any pending tooltip timeout
      if (tooltipTimeout) {
        clearTimeout(tooltipTimeout)
        tooltipTimeout = null
      }
      // Force hide tooltip
      tooltipVisible.value = false
      tooltipItem.value = null
      currentTooltipItemId = null
    })
    
    // Also cleanup when popup is hidden
    watch(() => props.visible, (newVisible) => {
      if (!newVisible) {
        // Clear tooltip when popup closes
        if (tooltipTimeout) {
          clearTimeout(tooltipTimeout)
          tooltipTimeout = null
        }
        tooltipVisible.value = false
        tooltipItem.value = null
        currentTooltipItemId = null
      }
    })
    
    const popupStyle = computed(() => ({
      left: `${props.position.x}px`,
      top: `${props.position.y}px`
    }))
    
    const isCustomPOI = computed(() => {
      return props.poi && props.poi.is_custom === true
    })
    
    const isOwnCustomPOI = computed(() => {
      return isCustomPOI.value && props.poi.user_id === props.currentUserId
    })
    
    const isSharedPOI = computed(() => {
      return isCustomPOI.value && props.poi.user_id !== props.currentUserId
    })
    
    const canEdit = computed(() => {
      // Proposal POIs cannot be edited
      if (props.poi.is_proposal) return false
      // Admins can always edit
      if (props.isAdmin) return true
      // Users can edit their own custom POIs only if not pending
      return isOwnCustomPOI.value && props.poi.status !== 'pending'
    })
    
    const canPublish = computed(() => {
      return isOwnCustomPOI.value && (props.poi.status === 'private' || props.poi.status === 'rejected')
    })
    
    const hasStats = computed(() => {
      if (!itemData.value) return false
      return itemData.value.str || itemData.value.sta || itemData.value.agi || 
             itemData.value.dex || itemData.value.wis || itemData.value.int || 
             itemData.value.cha || itemData.value.ac || itemData.value.health || 
             itemData.value.mana
    })
    
    const canProposeLoot = computed(() => {
      // Can propose loot if POI has an NPC and is a combat NPC type
      if (!localPoi.value.npc_id || !npcData.value) return false
      
      // Check if it's a combat NPC based on type name
      const typeName = localPoi.value.type_name?.toLowerCase() || ''
      return typeName.includes('combat') || typeName.includes('npc') || typeName.includes('mob')
    })
    
    const canProposeNPCEdit = computed(() => {
      // Can propose NPC edit if POI has an NPC
      return !!localPoi.value.npc_id && !!npcData.value
    })
    
    const hasTooltipStats = computed(() => {
      if (!tooltipItem.value) return false
      return tooltipItem.value.str || tooltipItem.value.sta || tooltipItem.value.agi || 
             tooltipItem.value.dex || tooltipItem.value.wis || tooltipItem.value.int || 
             tooltipItem.value.cha
    })
    
    const hasTooltipSecondaryStats = computed(() => {
      if (!tooltipItem.value) return false
      return tooltipItem.value.ac || tooltipItem.value.health || tooltipItem.value.mana
    })
    
    const hasTooltipBasicProperties = computed(() => {
      if (!tooltipItem.value) return false
      return tooltipItem.value.item_type || (tooltipItem.value.size && tooltipItem.value.size !== 'Medium') || 
             tooltipItem.value.weight || tooltipItem.value.skill
    })
    
    const hasTooltipCombatStats = computed(() => {
      if (!tooltipItem.value) return false
      return tooltipItem.value.damage || tooltipItem.value.delay || 
             (tooltipItem.value.attack_speed && tooltipItem.value.attack_speed !== 0 && 
              tooltipItem.value.attack_speed !== '0' && tooltipItem.value.attack_speed !== '0.0')
    })
    
    const hasTooltipResistances = computed(() => {
      if (!tooltipItem.value) return false
      return tooltipItem.value.resist_cold || tooltipItem.value.resist_corruption || 
             tooltipItem.value.resist_disease || tooltipItem.value.resist_electricity || 
             tooltipItem.value.resist_fire || tooltipItem.value.resist_magic || 
             tooltipItem.value.resist_poison
    })
    
    const tooltipStyle = computed(() => ({
      position: 'fixed',
      left: `${tooltipPosition.value.x}px`,
      top: `${tooltipPosition.value.y}px`,
      zIndex: 9999
    }))
    
    // Format description with clickable URLs and preserved newlines
    const formatDescription = (text) => {
      if (!text) return ''
      
      // Escape HTML to prevent XSS
      const escapeHtml = (str) => {
        const div = document.createElement('div')
        div.textContent = str
        return div.innerHTML
      }
      
      // Regular expression to match URLs
      const urlRegex = /(https?:\/\/[^\s<]+)/g
      
      // Escape HTML first
      let escaped = escapeHtml(text)
      
      // Replace newlines with <br> tags
      escaped = escaped.replace(/\n/g, '<br>')
      
      // Make URLs clickable
      return escaped.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">$1</a>')
    }
    
    // Format stat values with + or - prefix
    const formatStatValue = (value) => {
      if (!value) return '0'
      return value > 0 ? `+${value}` : `${value}`
    }
    
    // Format item type for display
    const formatItemType = (type) => {
      if (!type) return ''
      return type.charAt(0).toUpperCase() + type.slice(1)
    }
    
    // Computed property for POI description
    const formattedDescription = computed(() => {
      return formatDescription(localPoi.value.description) || 'No description available'
    })
    
    const getTypeIcon = (type) => {
      if (!type) return '📍'
      
      // If type is a number (type_id), use the icon from localPoi
      if (typeof type === 'number') {
        return localPoi.value.icon || localPoi.value.icon_value || '📍'
      }
      
      const icons = {
        landmark: '🏛️',
        quest: '❗',
        merchant: '💰',
        npc: '💀',
        dungeon: '⚔️',
        other: '📍'
      }
      return icons[type] || '📍'
    }
    
    const formatType = (type) => {
      if (!type && !localPoi.value.type_id) return 'Custom'
      
      // Handle case where type is a number (type_id) - use type_name if available
      if (typeof type === 'number' || localPoi.value.type_id) {
        return localPoi.value.type_name || 'Point of Interest'
      }
      
      // Handle string type
      if (typeof type === 'string') {
        return type.charAt(0).toUpperCase() + type.slice(1)
      }
      
      return 'Point of Interest'
    }
    
    const startEdit = async (field) => {
      if (!canEdit.value) return
      
      // Store original value
      originalValues.value[field] = localPoi.value[field]
      
      // Reset all edit states
      Object.keys(isEditing.value).forEach(key => {
        isEditing.value[key] = false
      })
      
      // Enable editing for this field
      isEditing.value[field] = true
      
      // Focus the input after render
      await nextTick()
      if (field === 'name' && nameInput.value) {
        nameInput.value.focus()
        nameInput.value.select()
      } else if (field === 'description' && descriptionInput.value) {
        descriptionInput.value.focus()
        descriptionInput.value.select()
      } else if (field === 'type' && typeSelect.value) {
        typeSelect.value.focus()
      }
    }
    
    const saveEdit = (field) => {
      const oldValue = originalValues.value[field]
      const newValue = localPoi.value[field]
      
      // Only emit update if value changed
      if (oldValue !== newValue) {
        emit('confirmUpdate', {
          id: props.poi.id,
          field,
          oldValue,
          newValue,
          poi: { ...localPoi.value }
        })
      }
      
      isEditing.value[field] = false
      originalValues.value[field] = null
    }
    
    const cancelEdit = () => {
      // Restore original values
      Object.keys(originalValues.value).forEach(field => {
        if (originalValues.value[field] !== undefined) {
          localPoi.value[field] = originalValues.value[field]
        }
      })
      
      // Reset edit states
      Object.keys(isEditing.value).forEach(key => {
        isEditing.value[key] = false
      })
      
      originalValues.value = {}
    }
    
    const handleDelete = () => {
      emit('delete', props.poi.id)
    }
    
    const handlePublish = () => {
      emit('publish', props.poi.id)
    }
    
    const handleEdit = () => {
      // Navigate to account page with POI ID to highlight
      const poiId = props.poi.id
      // Use absolute path to ensure proper navigation
      window.location.href = `/account.html?tab=admin&section=poi-editor&highlight=${poiId}`
    }
    
    const formatStatus = (status) => {
      const statusMap = {
        'private': 'Private',
        'pending': 'Pending Approval',
        'published': 'Published',
        'rejected': 'Rejected'
      }
      return statusMap[status] || status
    }
    
    // Tooltip methods
    const showItemTooltip = async (event, itemId) => {
      // Clear any existing timeout
      if (tooltipTimeout) {
        clearTimeout(tooltipTimeout)
        tooltipTimeout = null
      }
      
      // If we're already showing this item, don't reposition
      if (currentTooltipItemId === itemId && tooltipVisible.value) {
        return
      }
      
      // If showing a different item, hide current and show new
      if (currentTooltipItemId !== itemId && tooltipVisible.value) {
        tooltipVisible.value = false
        await nextTick() // Wait for hide before showing new
      }
      
      currentTooltipItemId = itemId
      
      try {
        const response = await fetch(`/api/items/${itemId}`)
        if (response.ok) {
          // Only show if we're still hovering over the same item
          if (currentTooltipItemId === itemId) {
            tooltipItem.value = await response.json()
            tooltipVisible.value = true
            positionTooltip(event)
          }
        }
      } catch (error) {
        console.error('Error fetching item for tooltip:', error)
      }
    }
    
    const positionTooltip = (event) => {
      // Position tooltip near the element, not following cursor
      const offset = 10
      const rect = event.target.getBoundingClientRect()
      
      let x = rect.right + offset
      let y = rect.top
      
      // Adjust position if tooltip would go off screen
      const tooltipWidth = 250 // Approximate width
      const tooltipHeight = 200 // Approximate max height
      
      // If it would go off the right, show on left
      if (x + tooltipWidth > window.innerWidth) {
        x = rect.left - tooltipWidth - offset
      }
      
      // If it would go off the bottom, adjust up
      if (y + tooltipHeight > window.innerHeight) {
        y = Math.max(10, window.innerHeight - tooltipHeight - 10)
      }
      
      tooltipPosition.value = { x, y }
    }
    
    const startTooltipHideTimer = () => {
      // Start a timer to hide tooltip
      if (tooltipTimeout) {
        clearTimeout(tooltipTimeout)
      }
      
      tooltipTimeout = setTimeout(() => {
        tooltipVisible.value = false
        tooltipItem.value = null
        currentTooltipItemId = null
        tooltipTimeout = null
      }, 300) // Longer delay to allow moving to tooltip
    }
    
    const cancelTooltipHide = () => {
      // Cancel hide timer when mouse enters tooltip
      if (tooltipTimeout) {
        clearTimeout(tooltipTimeout)
        tooltipTimeout = null
      }
    }
    
    const proposeItemEdit = () => {
      if (tooltipItem.value) {
        emit('propose-item-edit', tooltipItem.value)
        hideItemTooltip()
      }
    }
    
    const hideItemTooltip = () => {
      // Immediate hide when leaving tooltip
      if (tooltipTimeout) {
        clearTimeout(tooltipTimeout)
      }
      tooltipVisible.value = false
      tooltipItem.value = null
      currentTooltipItemId = null
      tooltipTimeout = null
    }
    
    
    const deleteField = (field) => {
      const oldValue = localPoi.value[field]
      
      // Don't allow deleting the name field if it's already empty
      if (field === 'name' && !oldValue) return
      
      emit('confirmUpdate', {
        id: props.poi.id,
        field,
        oldValue,
        newValue: field === 'name' ? 'Unnamed POI' : '', // Name can't be empty
        poi: { ...localPoi.value, [field]: field === 'name' ? 'Unnamed POI' : '' }
      })
    }
    
    const toggleEditDropdown = () => {
      showEditDropdown.value = !showEditDropdown.value
    }
    
    const handleProposalAction = (action) => {
      showEditDropdown.value = false
      emit(action, localPoi.value)
    }
    
    // Close dropdown when clicking outside
    const handleClickOutside = (event) => {
      if (editDropdown.value && !editDropdown.value.contains(event.target)) {
        showEditDropdown.value = false
      }
    }
    
    // Add/remove click listener
    watch(() => props.visible, (newVal) => {
      if (newVal) {
        document.addEventListener('click', handleClickOutside)
        // Fetch NPC/Item data when popup becomes visible
        fetchNPCData()
        fetchItemData()
        fetchActiveProposals()
      } else {
        document.removeEventListener('click', handleClickOutside)
        showEditDropdown.value = false
      }
    })
    
    onUnmounted(() => {
      document.removeEventListener('click', handleClickOutside)
    })
    
    return {
      localPoi,
      isEditing,
      nameInput,
      descriptionInput,
      typeSelect,
      popupStyle,
      getTypeIcon,
      formatType,
      startEdit,
      saveEdit,
      cancelEdit,
      handleDelete,
      deleteField,
      isCustomPOI,
      isOwnCustomPOI,
      isSharedPOI,
      canEdit,
      canPublish,
      canProposeLoot,
      canProposeNPCEdit,
      formatStatus,
      handlePublish,
      handleEdit,
      npcData,
      itemData,
      hasStats,
      formatDescription,
      formatStatValue,
      formatItemType,
      formattedDescription,
      tooltipItem,
      tooltipVisible,
      tooltipStyle,
      hasTooltipStats,
      hasTooltipSecondaryStats,
      hasTooltipBasicProperties,
      hasTooltipCombatStats,
      hasTooltipResistances,
      showItemTooltip,
      startTooltipHideTimer,
      cancelTooltipHide,
      hideItemTooltip,
      proposeItemEdit,
      editDropdown,
      showEditDropdown,
      toggleEditDropdown,
      handleProposalAction,
      activeProposals,
      proposalVoteStats
    }
  }
}
</script>

<style scoped>
.poi-popup {
  position: absolute;
  background: rgba(45, 45, 45, 0.95);
  border: 1px solid #555;
  border-radius: 8px;
  padding: 1rem;
  min-width: 200px;
  max-width: 300px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  z-index: 1000;
}

/* Add a speech bubble tail pointing to the POI */
.poi-popup::before {
  content: '';
  position: absolute;
  left: -10px;
  top: 20px;
  width: 0;
  height: 0;
  border-style: solid;
  border-width: 10px 10px 10px 0;
  border-color: transparent #555 transparent transparent;
}

.poi-popup::after {
  content: '';
  position: absolute;
  left: -9px;
  top: 20px;
  width: 0;
  height: 0;
  border-style: solid;
  border-width: 10px 10px 10px 0;
  border-color: transparent rgba(45, 45, 45, 0.95) transparent transparent;
}

/* Flip the tail when popup is on the left side */
.poi-popup.left-side::before {
  left: auto;
  right: -10px;
  border-width: 10px 0 10px 10px;
  border-color: transparent transparent transparent #555;
}

.poi-popup.left-side::after {
  left: auto;
  right: -9px;
  border-width: 10px 0 10px 10px;
  border-color: transparent transparent transparent rgba(45, 45, 45, 0.95);
}

.poi-popup-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.poi-popup-header h3 {
  margin: 0;
  font-size: 1.1rem;
  color: #fff;
}

.editable-field {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  flex: 1;
  margin-right: 20px; /* Space for delete button */
}

.poi-popup-header .editable-field {
  max-width: calc(100% - 40px); /* Account for close button */
}

.editable-field.editable h3,
.editable-field.editable p {
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.editable-field.editable:hover h3,
.editable-field.editable:hover p {
  background: rgba(255, 255, 255, 0.1);
}

.field-delete-btn {
  display: none;
  position: absolute;
  right: -20px;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(220, 20, 60, 0.8);
  border: none;
  color: #fff;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s;
  line-height: 1;
  padding: 0;
}

.editable-field:hover .field-delete-btn {
  display: block;
}

.field-delete-btn:hover {
  background: rgba(220, 20, 60, 1);
  transform: translateY(-50%) scale(1.1);
}

.close-btn {
  background: none;
  border: none;
  color: #999;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  color: #fff;
}

.poi-popup-content {
  color: #ccc;
  font-size: 0.9rem;
}

.poi-popup-content p {
  margin: 0 0 0.5rem 0;
  word-wrap: break-word;
  overflow-wrap: break-word;
  hyphens: auto;
  max-width: 100%;
}

.poi-popup-content p :deep(a),
.poi-popup-content p :deep(a:link),
.poi-popup-content p :deep(a:visited),
.poi-popup-content p :deep(a:active) {
  color: #ffffff !important;
  text-decoration: underline !important;
  word-break: break-all;
  font-weight: 500;
}

.poi-popup-content p :deep(a:hover) {
  color: #f5f5f5 !important;
  text-decoration: underline !important;
}

.poi-type {
  font-size: 0.85rem;
  color: #999;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.type-icon {
  font-size: 1rem;
}

.type-text {
  text-transform: capitalize;
}

.poi-creator {
  font-size: 0.85rem;
  color: #999;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.creator-label {
  color: #777;
}

.creator-name {
  color: #FFD700;
  font-weight: 500;
}

.type-text.editable {
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.type-text.editable:hover {
  background: rgba(255, 255, 255, 0.05);
}

.edit-input, .edit-textarea, .edit-select {
  background: #3a3a3a;
  color: #fff;
  border: 1px solid #666;
  border-radius: 4px;
  padding: 4px 8px;
  font-size: inherit;
  font-family: inherit;
  width: 100%;
  outline: none;
}

.edit-input {
  font-size: 1.1rem;
  font-weight: bold;
}

.edit-textarea {
  resize: vertical;
  min-height: 60px;
}

.edit-select {
  padding: 2px 4px;
  font-size: 0.85rem;
}

.edit-input:focus, .edit-textarea:focus, .edit-select:focus {
  border-color: #4a7c59;
  background: #4a4a4a;
}

.edit-hints {
  margin: 0.5rem 0;
}

.edit-hints .edit-hint {
  margin: 0.2rem 0;
}

.edit-hint {
  font-size: 0.8rem;
  color: #666;
  font-style: italic;
  margin: 0.5rem 0;
}

.admin-poi-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
}

.admin-poi-actions .edit-btn,
.admin-poi-actions .delete-btn {
  flex: 1;
  margin-top: 0;
}

.edit-btn {
  padding: 0.5rem;
  background: #4a7c59;
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  transition: background 0.2s;
}

.edit-btn:hover {
  background: #5a8d69;
}

.delete-btn {
  margin-top: 1rem;
  width: 100%;
  padding: 0.5rem;
  background: #dc143c;
  color: #fff;
  border: none;
  border-radius: 4px;
  font-size: 0.9rem;
  cursor: pointer;
  transition: background-color 0.2s;
}

.delete-btn:hover {
  background: #b91c1c;
}

.poi-status {
  font-size: 0.85rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.status-label {
  color: #999;
}

.status-value {
  font-weight: 500;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  font-size: 0.8rem;
}

.status-private {
  background: rgba(108, 117, 125, 0.2);
  color: #adb5bd;
}

.status-pending {
  background: rgba(255, 193, 7, 0.2);
  color: #ffc107;
}

.status-published {
  background: rgba(40, 167, 69, 0.2);
  color: #28a745;
}

.status-rejected {
  background: rgba(220, 53, 69, 0.2);
  color: #dc3545;
}

.custom-poi-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
}

.custom-poi-actions button {
  flex: 1;
  margin-top: 0;
}

.publish-btn {
  padding: 0.5rem;
  background: #28a745;
  color: #fff;
  border: none;
  border-radius: 4px;
  font-size: 0.9rem;
  cursor: pointer;
  transition: background-color 0.2s;
}

.publish-btn:hover {
  background: #218838;
}

.poi-shared {
  font-size: 0.85rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
  color: #17a2b8;
}

.shared-icon {
  font-size: 1rem;
}

.shared-text {
  font-style: italic;
}

.pending-hint {
  color: #ffc107;
  font-weight: 500;
}

/* Proposal POI styling */
.poi-proposal-info {
  margin-top: 0.75rem;
  padding: 0.5rem;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 4px;
}

.proposal-badge {
  font-size: 0.75rem;
  font-weight: bold;
  padding: 0.25rem 0.5rem;
  border-radius: 3px;
  text-align: center;
  margin-bottom: 0.25rem;
}

.proposal-badge.proposed {
  background: #4CAF50;
  color: white;
  box-shadow: 0 0 10px rgba(76, 175, 80, 0.5);
}

.proposal-badge.current {
  background: #F44336;
  color: white;
  opacity: 0.8;
}

.proposal-proposer {
  font-size: 0.8rem;
  color: #ccc;
  font-style: italic;
  text-align: center;
}

.poi-voting-inline {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.85rem;
  margin-top: 0.5rem;
}

/* Active proposals display for regular POIs */
.poi-active-proposals {
  font-size: 0.85rem;
  margin-top: 0.5rem;
}

.poi-active-proposals .proposal-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
  color: #FFD700;
}

.poi-active-proposals .proposal-icon {
  font-size: 1rem;
}

.poi-active-proposals .proposal-label {
  font-weight: 600;
}

.poi-active-proposals .vote-stats {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.poi-voting-inline .vote-item {
  display: flex;
  align-items: center;
  gap: 0.2rem;
}

.poi-voting-inline .vote-icon {
  font-size: 0.9rem;
  opacity: 0.8;
}

.poi-voting-inline .vote-count {
  font-weight: 600;
  font-size: 0.85rem;
}

.poi-voting-inline .vote-count.upvote {
  color: #28a745;
}

.poi-voting-inline .vote-count.downvote {
  color: #dc3545;
}

.poi-voting-inline .vote-total {
  font-weight: 600;
  color: #999;
}

.poi-voting-inline .vote-total.positive {
  color: #28a745;
}

.poi-voting-inline .vote-total.negative {
  color: #dc3545;
}

/* Copy vote item styles for active proposals */
.poi-active-proposals .vote-item {
  display: flex;
  align-items: center;
  gap: 0.2rem;
}

.poi-active-proposals .vote-icon {
  font-size: 0.9rem;
  opacity: 0.8;
}

.poi-active-proposals .vote-count {
  font-weight: 600;
  font-size: 0.85rem;
}

.poi-active-proposals .vote-count.upvote {
  color: #28a745;
}

.poi-active-proposals .vote-count.downvote {
  color: #dc3545;
}

.poi-active-proposals .vote-total {
  font-weight: 600;
  color: #999;
}

.poi-active-proposals .vote-total.positive {
  color: #28a745;
}

.poi-active-proposals .vote-total.negative {
  color: #dc3545;
}

/* NPC and Item Information Styles */
.poi-npc-info,
.poi-item-info {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #444;
}

.info-section-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.section-icon {
  font-size: 1.2rem;
}

.section-title {
  font-weight: 600;
  color: #FFD700;
  font-size: 0.95rem;
}

/* NPC Styles */
.npc-details {
  background: rgba(0, 0, 0, 0.2);
  padding: 0.75rem;
  border-radius: 6px;
}

.npc-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.npc-name {
  font-weight: 600;
  color: #ff6b6b;
  font-size: 1rem;
}

.npc-level {
  background: rgba(255, 193, 7, 0.2);
  color: #ffc107;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 500;
}

.npc-description {
  color: #ccc;
  font-size: 0.85rem;
  line-height: 1.4;
  margin-bottom: 0.75rem;
  font-style: italic;
  word-wrap: break-word;
  overflow-wrap: break-word;
  hyphens: auto;
  max-width: 100%;
}

.npc-description :deep(a),
.npc-description :deep(a:link),
.npc-description :deep(a:visited),
.npc-description :deep(a:active) {
  color: #ffffff !important;
  text-decoration: underline !important;
  word-break: break-all;
  font-weight: 500;
}

.npc-description :deep(a:hover) {
  color: #f5f5f5 !important;
  text-decoration: underline !important;
}

.npc-stats {
  margin-bottom: 0.5rem;
}

.stat-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
  font-size: 0.85rem;
}

.stat-label {
  color: #999;
  min-width: 50px;
}

.stat-value {
  color: #fff;
  font-weight: 500;
}

.npc-loot {
  margin-top: 0.75rem;
}

.loot-header {
  font-weight: 600;
  color: #28a745;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
}

.loot-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  max-height: 200px;
  overflow-y: auto;
  padding-right: 4px;
}

/* Custom scrollbar for loot list */
.loot-list::-webkit-scrollbar {
  width: 6px;
}

.loot-list::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 3px;
}

.loot-list::-webkit-scrollbar-thumb {
  background: rgba(40, 167, 69, 0.5);
  border-radius: 3px;
}

.loot-list::-webkit-scrollbar-thumb:hover {
  background: rgba(40, 167, 69, 0.7);
}

.loot-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(40, 167, 69, 0.1);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.85rem;
}

.item-icon {
  font-size: 1rem;
}

.item-name {
  color: #e0e0e0;
}

/* Item Styles */
.item-details {
  background: rgba(0, 0, 0, 0.2);
  padding: 0.75rem;
  border-radius: 6px;
}

.item-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.item-large-icon {
  font-size: 2rem;
}

.item-details .item-name {
  font-weight: 600;
  color: #4fc3f7;
  font-size: 1.1rem;
}

.item-description {
  color: #ccc;
  font-size: 0.85rem;
  line-height: 1.4;
  margin-bottom: 0.75rem;
  font-style: italic;
  word-wrap: break-word;
  overflow-wrap: break-word;
  hyphens: auto;
  max-width: 100%;
}

.item-description :deep(a),
.item-description :deep(a:link),
.item-description :deep(a:visited),
.item-description :deep(a:active) {
  color: #ffffff !important;
  text-decoration: underline !important;
  word-break: break-all;
  font-weight: 500;
}

.item-description :deep(a:hover) {
  color: #f5f5f5 !important;
  text-decoration: underline !important;
}

.item-stats {
  font-size: 0.85rem;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.25rem;
  margin-top: 0.5rem;
}

.stat-item {
  background: rgba(79, 195, 247, 0.1);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  color: #4fc3f7;
  font-weight: 500;
  text-align: center;
}

/* Adjust popup width when showing NPC/Item info */
.poi-popup:has(.poi-npc-info),
.poi-popup:has(.poi-item-info) {
  max-width: 350px;
}

/* Item Tooltip Styles - MMO Style */
.item-tooltip {
  position: fixed;
  background: linear-gradient(to bottom, rgba(15, 15, 20, 0.98), rgba(10, 10, 15, 0.98));
  border: 1px solid #2a2a3a;
  border-radius: 6px;
  padding: 0;
  min-width: 280px;
  max-width: 360px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.05);
  pointer-events: auto;
  font-size: 14px;
  color: #e0e0e0;
  backdrop-filter: blur(8px);
  z-index: 9999;
}

/* Header section */
.tooltip-header {
  background: linear-gradient(to bottom, rgba(30, 30, 40, 0.6), rgba(20, 20, 30, 0.4));
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding: 12px 16px;
  border-radius: 6px 6px 0 0;
}

.header-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.tooltip-icon {
  font-size: 28px;
  flex-shrink: 0;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5));
}

.header-text {
  flex: 1;
}

.tooltip-name {
  color: #fff;
  font-weight: 600;
  font-size: 16px;
  line-height: 1.2;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
}

.tooltip-type {
  color: #999;
  font-size: 12px;
  text-transform: capitalize;
  margin-top: 2px;
}

/* Basic info section */
.tooltip-basic-info {
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.02);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.info-line {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 2px 0;
}

.info-label {
  color: #888;
  font-size: 13px;
}

.info-value {
  color: #ddd;
  font-size: 13px;
}

/* Section styling */
.tooltip-section {
  padding: 10px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.tooltip-section:last-of-type {
  border-bottom: none;
}

/* Combat section */
.combat-section {
  background: rgba(255, 50, 50, 0.03);
}

.combat-line {
  display: flex;
  justify-content: space-between;
  padding: 2px 0;
}

.combat-label {
  color: #aaa;
  font-size: 13px;
}

.combat-value {
  color: #ff9999;
  font-weight: 500;
}

/* Defensive stats */
.defensive-section {
  background: rgba(50, 150, 255, 0.03);
  text-align: center;
}

.stat-line {
  display: inline-block;
  margin: 0 8px;
}

.stat-line .stat-value {
  color: #66b3ff;
  font-weight: 500;
  font-size: 15px;
}

/* Stats grid */
.stats-section {
  background: rgba(50, 255, 50, 0.02);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(70px, 1fr));
  gap: 8px;
}

.stat-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 4px;
  padding: 4px 8px;
  transition: all 0.2s;
}

.stat-item:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.15);
}

.stat-item.negative {
  background: rgba(255, 0, 0, 0.05);
  border-color: rgba(255, 0, 0, 0.2);
}

.stat-label {
  color: #999;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
}

.stat-value {
  color: #4dff4d;
  font-weight: 600;
  font-size: 14px;
}

.stat-item.negative .stat-value {
  color: #ff6666;
}

/* Bonus section */
.bonus-section {
  background: rgba(255, 215, 0, 0.02);
  text-align: center;
}

.bonus-line {
  padding: 2px 0;
}

.bonus-value {
  color: #ffd700;
  font-weight: 500;
}

.bonus-value.negative {
  color: #ff6666;
}

/* Resistances */
.resistance-section {
  background: rgba(150, 100, 255, 0.02);
}

.section-header {
  color: #bbb;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  margin-bottom: 8px;
  text-align: center;
}

.resistance-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(50px, 1fr));
  gap: 6px;
}

.resistance-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 4px;
  padding: 4px;
  transition: all 0.2s;
}

.resistance-item:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.15);
}

.resistance-item.negative {
  background: rgba(255, 0, 0, 0.05);
  border-color: rgba(255, 0, 0, 0.2);
}

.resistance-icon {
  font-size: 16px;
  margin-bottom: 2px;
}

.resistance-value {
  color: #8888ff;
  font-weight: 600;
  font-size: 13px;
}

.resistance-item.negative .resistance-value {
  color: #ff8888;
}

/* Requirements */
.requirements-section {
  background: rgba(255, 100, 100, 0.02);
}

.requirement-line {
  display: flex;
  justify-content: space-between;
  padding: 2px 0;
}

.requirement-label {
  color: #ff9999;
  font-size: 12px;
  text-transform: uppercase;
}

.requirement-value {
  color: #ffcccc;
  font-size: 13px;
}

/* Properties */
.property-section {
  background: rgba(100, 100, 100, 0.02);
  padding: 8px 16px;
}

.property-line {
  display: flex;
  justify-content: center;
  gap: 16px;
}

.property-item {
  color: #888;
  font-size: 12px;
}

/* Description */
.tooltip-description {
  padding: 12px 16px;
  line-height: 1.5;
  color: #aaa;
  font-size: 13px;
  word-wrap: break-word;
  overflow-wrap: break-word;
  max-width: 100%;
  background: rgba(0, 0, 0, 0.2);
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.tooltip-description :deep(a) {
  color: #4a9eff;
  text-decoration: underline;
}

.tooltip-description :deep(a:hover) {
  color: #6bb6ff;
}

/* Actions */
.tooltip-actions {
  padding: 10px 16px;
  background: rgba(255, 215, 0, 0.02);
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 0 0 6px 6px;
}

.tooltip-edit-btn {
  background: rgba(255, 215, 0, 0.1);
  border: 1px solid rgba(255, 215, 0, 0.3);
  border-radius: 4px;
  color: #FFD700;
  padding: 6px 12px;
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s;
  width: 100%;
  justify-content: center;
}

.tooltip-edit-btn:hover {
  background: rgba(255, 215, 0, 0.2);
  border-color: rgba(255, 215, 0, 0.5);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(255, 215, 0, 0.2);
}

.btn-icon {
  font-size: 14px;
}

.btn-text {
  font-weight: 500;
}

/* Keep old selectors for backward compatibility */
.tooltip-stats,
.tooltip-secondary-stats,
.tooltip-properties,
.tooltip-combat,
.tooltip-resistances {
  /* Styles handled by new section classes */
}

/* Make loot item names hoverable */
.loot-item .item-name {
  cursor: pointer;
  transition: color 0.2s;
}

.loot-item .item-name:hover {
  color: #4fc3f7;
  text-decoration: underline;
}

/* User proposal actions */
.user-poi-actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 1rem;
}

.propose-btn,
.propose-delete-btn,
.propose-loot-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.5rem;
  border: none;
  border-radius: 4px;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;
  font-weight: 500;
}

.propose-btn {
  background: #3b82f6;
  color: white;
}

.propose-btn:hover {
  background: #2563eb;
}

.propose-delete-btn {
  background: #ef4444;
  color: white;
}

.propose-delete-btn:hover {
  background: #dc2626;
}

.propose-loot-btn {
  background: #10b981;
  color: white;
}

.propose-loot-btn:hover {
  background: #059669;
}

.action-icon {
  font-size: 1rem;
}

/* Dropdown proposal actions layout */
.user-poi-actions-dropdown {
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
}

.proposal-dropdown {
  position: relative;
  flex: 1;
}

.propose-btn-main {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  border: none;
  border-radius: 6px;
  font-size: 0.925rem;
  cursor: pointer;
  transition: all 0.2s;
  font-weight: 600;
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: white;
  position: relative;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3),
              0 1px 2px rgba(0, 0, 0, 0.2);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

.propose-btn-main:hover {
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4),
              0 2px 4px rgba(0, 0, 0, 0.2);
}

.propose-btn-main:active {
  transform: translateY(0);
  box-shadow: 0 1px 4px rgba(59, 130, 246, 0.3),
              0 1px 2px rgba(0, 0, 0, 0.2);
}

.propose-btn-main.delete {
  background: linear-gradient(135deg, #ef4444, #dc2626);
  box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3),
              0 1px 2px rgba(0, 0, 0, 0.2);
}

.propose-btn-main.delete:hover {
  background: linear-gradient(135deg, #dc2626, #b91c1c);
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4),
              0 2px 4px rgba(0, 0, 0, 0.2);
}

.dropdown-arrow {
  font-size: 0.65rem;
  margin-left: 0.25rem;
  transition: transform 0.2s;
  opacity: 0.8;
}

.propose-btn-main:hover .dropdown-arrow {
  opacity: 1;
}

.proposal-dropdown .propose-btn-main[aria-expanded="true"] .dropdown-arrow {
  transform: rotate(180deg);
}

.dropdown-menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: linear-gradient(to bottom, #363636, #2d2d2d);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6), 
              0 0 0 1px rgba(255, 255, 255, 0.05) inset;
  z-index: 1000;
  overflow: hidden;
  animation: dropdownSlide 0.2s ease-out;
  backdrop-filter: blur(10px);
}

@keyframes dropdownSlide {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.dropdown-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1.25rem;
  border: none;
  background: transparent;
  color: #d0d0d0;
  font-size: 0.925rem;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
  position: relative;
  overflow: hidden;
}

.dropdown-item::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: #3b82f6;
  transform: translateX(-100%);
  transition: transform 0.2s;
}

.dropdown-item:hover {
  background: linear-gradient(to right, rgba(59, 130, 246, 0.15), rgba(59, 130, 246, 0.05));
  color: #fff;
  padding-left: 1.5rem;
}

.dropdown-item:hover::before {
  transform: translateX(0);
}

.dropdown-item:hover .item-icon {
  transform: scale(1.1);
}

.dropdown-item:hover .item-text {
  transform: translateX(2px);
}

.dropdown-item:not(:last-child) {
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.dropdown-item:first-child {
  border-radius: 8px 8px 0 0;
}

.dropdown-item:last-child {
  border-radius: 0 0 8px 8px;
}

.item-icon {
  font-size: 1.1rem;
  width: 1.75rem;
  text-align: center;
  transition: transform 0.2s;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
}

.item-text {
  flex: 1;
  font-weight: 500;
  letter-spacing: 0.01em;
  transition: transform 0.2s;
}

.action-icon {
  font-size: 1rem;
}

.action-text {
  font-size: 0.9rem;
}

/* Pending proposal notice */
.pending-proposal-notice {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 1rem;
  padding: 0.75rem;
  background: rgba(251, 146, 60, 0.1);
  border: 1px solid rgba(251, 146, 60, 0.3);
  border-radius: 6px;
  color: #fb923c;
}

.notice-icon {
  font-size: 1.2rem;
}

.notice-text {
  font-size: 0.85rem;
  font-weight: 500;
}

.tooltip-actions {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid #444;
  display: flex;
  justify-content: center;
}

.tooltip-edit-btn {
  background: #FFD700;
  color: #000;
  border: none;
  border-radius: 4px;
  padding: 0.4rem 0.8rem;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.3rem;
  transition: all 0.2s;
}

.tooltip-edit-btn:hover {
  background: #FFC700;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(255, 215, 0, 0.3);
}

.tooltip-edit-btn .btn-icon {
  font-size: 0.9rem;
}

.tooltip-edit-btn .btn-text {
  white-space: nowrap;
}
</style>