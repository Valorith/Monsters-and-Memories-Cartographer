<template>
  <div 
    v-if="visible && (proposal || proposalData)" 
    class="proposal-popup"
    :style="popupStyle"
    @click.stop
  >
    <div class="proposal-header">
      <h3>{{ getProposalTitle() }}</h3>
      <span class="proposal-type-badge" :class="proposalTypeClass">
        {{ getProposalTypeBadge() }}
      </span>
    </div>

    <div class="proposal-content">
      <!-- Proposer Info -->
      <div class="proposer-info">
        <span class="proposer-label">Proposed by:</span>
        <span class="proposer-name">
          <span v-if="getProposerDonationTier()" 
                class="donation-badge" 
                :style="{ color: getProposerDonationTier().color }"
                :title="`${getProposerDonationTier().name} Supporter`">
            {{ getProposerDonationTier().icon }}
          </span>
          {{ getProposerName() }}
        </span>
      </div>

      <!-- Proposal Details -->
      <div class="proposal-details">
        <!-- Add POI Proposal -->
        <template v-if="proposal?.proposal_type === 'add' || proposal?.is_proposal">
          <div class="detail-row">
            <span class="detail-label">Name:</span>
            <span class="detail-value">{{ proposal?.name || 'Unnamed' }}</span>
          </div>
          <div v-if="proposal?.description" class="detail-row">
            <span class="detail-label">Description:</span>
            <span class="detail-value">{{ proposal.description }}</span>
          </div>
          <div v-if="proposal?.npc_name" class="detail-row">
            <span class="detail-label">Linked NPC:</span>
            <span class="detail-value">{{ proposal.npc_name }}</span>
          </div>
          <div v-if="proposal?.item_name" class="detail-row">
            <span class="detail-label">Linked Item:</span>
            <span class="detail-value">{{ proposal.item_name }}</span>
          </div>
          <!-- Show NPCs button for multi-mob proposals -->
          <div v-if="shouldShowNPCsButton" class="detail-row">
            <button class="show-npcs-btn" @click="$emit('show-npcs', proposal || proposalData)">
              <span class="btn-icon">⚔️</span>
              Show NPCs ({{ npcAssociations.length }})
            </button>
          </div>
        </template>

        <!-- Move POI Proposal -->
        <template v-else-if="proposalData?.has_move_proposal || proposal?.is_proposed_location">
          <div class="detail-row">
            <span class="detail-label">POI:</span>
            <span class="detail-value">{{ proposalData?.name || proposal?.name }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Current Location:</span>
            <span class="detail-value">X: {{ proposalData?.x || proposal?.originalPoi?.x }}, Y: {{ proposalData?.y || proposal?.originalPoi?.y }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Proposed Location:</span>
            <span class="detail-value">X: {{ proposalData?.move_proposal?.proposed_x || proposal?.move_proposal?.proposed_x }}, Y: {{ proposalData?.move_proposal?.proposed_y || proposal?.move_proposal?.proposed_y }}</span>
          </div>
        </template>

        <!-- Edit POI Proposal -->
        <template v-else-if="proposalData?.has_edit_proposal">
          <div class="detail-row">
            <span class="detail-label">Changes:</span>
          </div>
          <div class="changes-list">
            <div v-for="(change, key) in getEditChanges()" :key="key" class="change-item">
              <span class="change-field">{{ formatFieldName(key) }}:</span>
              <span class="change-old">{{ formatChangeValue(key, change.old) || '(empty)' }}</span>
              <span class="change-arrow">→</span>
              <span class="change-new">{{ formatChangeValue(key, change.new) }}</span>
            </div>
          </div>
        </template>

        <!-- Delete POI Proposal -->
        <template v-else-if="proposalData?.has_deletion_proposal">
          <div class="detail-row">
            <span class="detail-label">POI to delete:</span>
            <span class="detail-value">{{ proposalData.name }}</span>
          </div>
        </template>
        
        <!-- Show NPCs button for multi-mob proposals when using proposalData -->
        <div v-if="shouldShowNPCsButton && !proposal" class="detail-row">
          <button class="show-npcs-btn" @click="$emit('show-npcs', proposalData)">
            <span class="btn-icon">⚔️</span>
            Show NPCs ({{ npcAssociations.length }})
          </button>
        </div>

        <!-- Loot Change Proposal -->
        <template v-else-if="proposalData?.has_loot_proposal">
          <div class="detail-row">
            <span class="detail-label">POI:</span>
            <span class="detail-value">{{ proposalData.name }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Loot Changes:</span>
          </div>
          <div class="changes-list">
            <div class="change-item">
              <span class="change-field">Proposed loot changes for NPC</span>
            </div>
          </div>
        </template>

        <!-- NPC Edit Proposal -->
        <template v-else-if="proposalData?.has_npc_proposal">
          <div class="detail-row">
            <span class="detail-label">POI:</span>
            <span class="detail-value">{{ proposalData.name }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">NPC Changes:</span>
          </div>
          <div class="changes-list">
            <div v-for="(change, key) in getNPCEditChanges()" :key="key" class="change-item">
              <span class="change-field">{{ formatFieldName(key) }}:</span>
              <span class="change-old">{{ formatChangeValue(key, change.old) || '(empty)' }}</span>
              <span class="change-arrow">→</span>
              <span class="change-new">{{ formatChangeValue(key, change.new) }}</span>
            </div>
          </div>
        </template>

        <!-- Notes -->
        <div v-if="getProposalNotes()" class="detail-row notes">
          <span class="detail-label">Notes:</span>
          <span class="detail-value">{{ getProposalNotes() }}</span>
        </div>
      </div>

      <!-- Voting Section -->
      <div class="voting-section">
        <div class="vote-stats">
          <div class="vote-count upvotes" :class="{ voted: getUserVote() === 1 }">
            <span class="vote-icon">👍</span>
            <span class="vote-number">{{ getUpvotes() }}</span>
          </div>
          <div class="vote-score">
            <span class="score-label">Score:</span>
            <span class="score-value" :class="scoreClass">{{ getVoteScore() }}</span>
          </div>
          <div class="vote-count downvotes" :class="{ voted: getUserVote() === -1 }">
            <span class="vote-icon">👎</span>
            <span class="vote-number">{{ getDownvotes() }}</span>
          </div>
        </div>

        <!-- Vote Buttons (only for authenticated users) -->
        <div v-if="isAuthenticated" class="vote-buttons">
          <button 
            @click="vote(1)" 
            class="vote-btn upvote-btn"
            :class="{ active: getUserVote() === 1 }"
            :disabled="isVoting"
          >
            {{ getUserVote() === 1 ? 'Upvoted' : 'Upvote' }}
          </button>
          <button 
            @click="vote(-1)" 
            class="vote-btn downvote-btn"
            :class="{ active: getUserVote() === -1 }"
            :disabled="isVoting"
          >
            {{ getUserVote() === -1 ? 'Downvoted' : 'Downvote' }}
          </button>
        </div>

        <!-- Login prompt for unauthenticated users -->
        <div v-else class="login-prompt">
          <p>Sign in to vote on this proposal</p>
        </div>
      </div>
    </div>

    <!-- Close button -->
    <button @click="$emit('close')" class="close-btn" title="Close">×</button>
  </div>
</template>

<script>
import { ref, computed } from 'vue'
import { useToast } from '../composables/useToast'
import { useCSRF } from '../composables/useCSRF'

export default {
  name: 'ProposalPopup',
  props: {
    visible: {
      type: Boolean,
      default: false
    },
    proposal: {
      type: Object,
      default: null
    },
    proposalData: {
      type: Object,
      default: null
    },
    position: {
      type: Object,
      default: () => ({ x: 0, y: 0 })
    },
    isLeftSide: {
      type: Boolean,
      default: false
    },
    isAuthenticated: {
      type: Boolean,
      default: false
    },
    currentUserId: {
      type: Number,
      default: null
    }
  },
  emits: ['close', 'vote-success', 'toggle-proposed-location', 'proposal-withdrawn', 'show-npcs'],
  setup(props, { emit }) {
    const { success, error } = useToast()
    const { fetchWithCSRF } = useCSRF()
    
    const isVoting = ref(false)
    const showingProposedLocation = ref(false)
    
    // Computed to check if we should show the NPCs button
    const shouldShowNPCsButton = computed(() => {
      const data = props.proposal || props.proposalData
      // Check both 'multi_mob' and 'is_multi_mob' field names
      const isMultiMob = data?.is_multi_mob || data?.multi_mob
      return isMultiMob && data?.npc_associations && data.npc_associations.length > 0
    })
    
    const npcAssociations = computed(() => {
      const data = props.proposal || props.proposalData
      return data?.npc_associations || []
    })
    
    const popupStyle = computed(() => {
      const offset = 20
      const style = {
        position: 'fixed',
        zIndex: 1001
      }
      
      if (props.isLeftSide) {
        style.left = `${props.position.x - offset}px`
        style.transform = 'translateX(-100%)'
      } else {
        style.left = `${props.position.x + offset}px`
      }
      
      style.top = `${props.position.y}px`
      style.transform = (style.transform || '') + ' translateY(-50%)'
      
      return style
    })
    
    const proposalTypeClass = computed(() => {
      if (props.proposal?.proposal_type === 'add') return 'add'
      if (props.proposalData?.has_move_proposal) return 'move'
      if (props.proposalData?.has_edit_proposal) return 'edit'
      if (props.proposalData?.has_deletion_proposal) return 'delete'
      return ''
    })
    
    const scoreClass = computed(() => {
      const score = getVoteScore()
      if (score > 0) return 'positive'
      if (score < 0) return 'negative'
      return 'neutral'
    })
    
    const getProposalTitle = () => {
      if (props.proposal?.proposal_type === 'add') return 'New POI Proposal'
      if (props.proposalData?.has_move_proposal || props.proposal?.is_proposed_location) return 'Move POI Proposal'
      if (props.proposalData?.has_edit_proposal) return 'Edit POI Proposal'
      if (props.proposalData?.has_deletion_proposal) return 'Delete POI Proposal'
      if (props.proposalData?.has_loot_proposal) return 'Loot Change Proposal'
      if (props.proposalData?.has_npc_proposal) return 'NPC Edit Proposal'
      return 'Proposal'
    }
    
    const getProposalTypeBadge = () => {
      if (props.proposal?.proposal_type === 'add') return 'ADD'
      if (props.proposalData?.has_move_proposal || props.proposal?.is_proposed_location) return 'MOVE'
      if (props.proposalData?.has_edit_proposal) return 'EDIT'
      if (props.proposalData?.has_deletion_proposal) return 'DELETE'
      if (props.proposalData?.has_loot_proposal) return 'LOOT'
      if (props.proposalData?.has_npc_proposal) return 'NPC'
      return ''
    }
    
    const getProposalData = () => {
      if (props.proposal?.is_proposed_location) return props.proposal.move_proposal
      if (props.proposal) return props.proposal
      if (props.proposalData?.move_proposal) return props.proposalData.move_proposal
      if (props.proposalData?.edit_proposal) return props.proposalData.edit_proposal
      if (props.proposalData?.deletion_proposal) return props.proposalData.deletion_proposal
      if (props.proposalData?.loot_proposal) return props.proposalData.loot_proposal
      if (props.proposalData?.npc_proposal) return props.proposalData.npc_proposal
      return null
    }
    
    const getUpvotes = () => {
      const data = getProposalData()
      if (data?.upvotes !== undefined) return data.upvotes
      // For add proposals, check the proposal object directly
      if (props.proposal?.upvotes !== undefined) return props.proposal.upvotes
      return 0
    }
    
    const getDownvotes = () => {
      const data = getProposalData()
      if (data?.downvotes !== undefined) return data.downvotes
      // For add proposals, check the proposal object directly
      if (props.proposal?.downvotes !== undefined) return props.proposal.downvotes
      return 0
    }
    
    const getVoteScore = () => {
      return getUpvotes() - getDownvotes()
    }
    
    const getUserVote = () => {
      const data = getProposalData()
      if (data?.user_vote !== undefined) return data.user_vote
      // For add proposals, check the proposal object directly
      if (props.proposal?.user_vote !== undefined) return props.proposal.user_vote
      return 0
    }
    
    const getProposalNotes = () => {
      const data = getProposalData()
      return data?.notes || ''
    }
    
    const getProposalId = () => {
      const data = getProposalData()
      return data?.proposal_id || data?.id
    }
    
    const getProposerId = () => {
      const data = getProposalData()
      if (data?.proposer_id !== undefined) return data.proposer_id
      // For add proposals, check the proposal object directly
      if (props.proposal?.proposer_id !== undefined) return props.proposal.proposer_id
      return null
    }
    
    const getProposerName = () => {
      const data = getProposalData()
      if (data?.proposer_name) return data.proposer_name
      // For add proposals, check the proposal object directly
      if (props.proposal?.proposer_name) return props.proposal.proposer_name
      return 'Unknown'
    }
    
    const getProposerDonationTier = () => {
      const data = getProposalData()
      // Check for donation tier in proposalData
      if (data?.proposer_donation_tier_name) {
        return {
          name: data.proposer_donation_tier_name,
          color: data.proposer_donation_tier_color,
          icon: data.proposer_donation_tier_icon
        }
      }
      // Check for donation tier in proposal object
      if (props.proposal?.proposer_donation_tier_name) {
        return {
          name: props.proposal.proposer_donation_tier_name,
          color: props.proposal.proposer_donation_tier_color,
          icon: props.proposal.proposer_donation_tier_icon
        }
      }
      return null
    }
    
    const getEditChanges = () => {
      if (!props.proposalData?.edit_proposal) return {}
      
      const changes = {}
      const proposed = props.proposalData.edit_proposal.proposed_data
      const current = props.proposalData.edit_proposal.current_data
      
      // Compare each field
      for (const key in proposed) {
        if (proposed[key] !== current[key]) {
          changes[key] = {
            old: current[key],
            new: proposed[key]
          }
        }
      }
      
      return changes
    }
    
    const getNPCEditChanges = () => {
      if (!props.proposalData?.npc_proposal) return {}
      
      const changes = {}
      const proposed = props.proposalData.npc_proposal.proposed_data
      const current = props.proposalData.npc_proposal.current_data
      
      // Fields that should never be shown as changes (system fields only)
      const excludedFields = ['id', 'created_at', 'updated_at']
      
      // Fields that are read-only identifiers - if they appear in proposed but not current,
      // they're just identifying the NPC, not being changed
      const identifierFields = ['npcid', 'name', 'npc_type']
      
      // Only compare fields that are actually being changed
      for (const key in proposed) {
        // Skip system fields
        if (excludedFields.includes(key)) continue
        
        // For identifier fields, only show as change if they exist in current data
        // AND are different (meaning they're actually being edited)
        if (identifierFields.includes(key)) {
          if (current && key in current && current[key] !== proposed[key]) {
            changes[key] = {
              old: current[key],
              new: proposed[key]
            }
          }
          continue
        }
        
        // For all other fields, only show as change if values are different
        // and the field exists in current data
        if (current && 
            key in current && 
            proposed[key] !== current[key] && 
            proposed[key] !== null && 
            proposed[key] !== undefined) {
          changes[key] = {
            old: current[key],
            new: proposed[key]
          }
        }
      }
      
      return changes
    }
    
    const formatFieldName = (field) => {
      const fieldNames = {
        name: 'Name',
        description: 'Description',
        type_id: 'Type',
        npc_id: 'Linked NPC',
        item_id: 'Linked Item',
        // NPC fields
        level: 'Level',
        hp: 'HP',
        mp: 'MP',
        ac: 'AC',
        str: 'STR',
        sta: 'STA',
        agi: 'AGI',
        dex: 'DEX',
        wis: 'WIS',
        int: 'INT',
        cha: 'CHA',
        attack_speed: 'Attack Speed',
        min_dmg: 'Min Damage',
        max_dmg: 'Max Damage'
      }
      return fieldNames[field] || field
    }
    
    const toggleProposedLocation = () => {
      showingProposedLocation.value = !showingProposedLocation.value
      emit('toggle-proposed-location', showingProposedLocation.value)
    }
    
    const npcsCache = ref({})
    const itemsCache = ref({})
    
    const formatChangeValue = (field, value) => {
      if (value === null || value === undefined || value === '') {
        return '(empty)'
      }
      
      // Format NPC ID to name
      if (field === 'npc_id' && value) {
        if (npcsCache.value[value]) {
          return npcsCache.value[value]
        }
        
        // Fetch NPC name asynchronously
        fetch(`/api/npcs/${value}`)
          .then(response => {
            if (!response.ok) {
              console.warn(`NPC with ID ${value} not found`);
              return null;
            }
            return response.json();
          })
          .then(npc => {
            if (npc && npc.name) {
              npcsCache.value[value] = npc.name;
            } else {
              // If NPC not found, show a fallback
              npcsCache.value[value] = `NPC #${value}`;
            }
          })
          .catch(error => {
            console.warn('Failed to fetch NPC name:', error);
            npcsCache.value[value] = `NPC #${value}`;
          })
        
        return `NPC #${value}` // Return ID with prefix while loading
      }
      
      // Format Item ID to name
      if (field === 'item_id' && value) {
        if (itemsCache.value[value]) {
          return itemsCache.value[value]
        }
        
        // Fetch item name asynchronously
        fetch(`/api/items/${value}`)
          .then(response => {
            if (!response.ok) {
              console.warn(`Item with ID ${value} not found`);
              return null;
            }
            return response.json();
          })
          .then(item => {
            if (item && item.name) {
              itemsCache.value[value] = item.name;
            } else {
              // If item not found, show a fallback
              itemsCache.value[value] = `Item #${value}`;
            }
          })
          .catch(error => {
            console.warn('Failed to fetch item name:', error);
            itemsCache.value[value] = `Item #${value}`;
          })
        
        return `Item #${value}` // Return ID with prefix while loading
      }
      
      return value
    }

    const vote = async (voteValue) => {
      if (isVoting.value) return
      
      const proposalId = getProposalId()
      if (!proposalId) return
      
      // Check if proposer is downvoting their own proposal
      if (getProposerId() === props.currentUserId && voteValue === -1) {
        const confirmed = confirm('Downvoting your own proposal will withdraw it. Are you sure?')
        if (!confirmed) return
      }
      
      isVoting.value = true
      
      try {
        const response = await fetchWithCSRF(`/api/change-proposals/${proposalId}/vote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ vote: voteValue })
        })
        
        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Failed to vote')
        }
        
        const result = await response.json()
        
        if (result.withdrawn) {
          // Show success message
          if (success) {
            success('Proposal withdrawn')
          }
          
          // Emit the withdrawal event
          if (emit) {
            emit('proposal-withdrawn', proposalId)
          }
          // Don't emit close here - the parent handles closing when proposal is withdrawn
        } else {
          if (success) {
            success(voteValue === 1 ? 'Upvoted!' : 'Downvoted!')
          }
          if (emit) {
            emit('vote-success', { proposalId, vote: voteValue })
          }
        }
      } catch (err) {
        console.error('Error in vote function:', err)
        if (error) {
          error(err.message || 'Failed to process vote')
        }
      } finally {
        isVoting.value = false
      }
    }
    
    return {
      isVoting,
      showingProposedLocation,
      popupStyle,
      proposalTypeClass,
      scoreClass,
      getProposalTitle,
      getProposalTypeBadge,
      getProposerName,
      getProposerDonationTier,
      getUpvotes,
      getDownvotes,
      getVoteScore,
      getUserVote,
      getProposalNotes,
      getEditChanges,
      getNPCEditChanges,
      formatFieldName,
      formatChangeValue,
      npcsCache,
      itemsCache,
      toggleProposedLocation,
      vote,
      shouldShowNPCsButton,
      npcAssociations
    }
  }
}
</script>

<style scoped>
.proposal-popup {
  background: rgba(26, 26, 26, 0.95);
  border: 2px solid #1E90FF;
  border-radius: 8px;
  padding: 1rem;
  min-width: 320px;
  max-width: 400px;
  backdrop-filter: blur(10px);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.8), 0 0 20px rgba(30, 144, 255, 0.3);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  color: #e0e0e0;
}

.proposal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  padding-right: 2rem; /* Add space for close button */
  border-bottom: 1px solid rgba(30, 144, 255, 0.3);
}

.proposal-header h3 {
  margin: 0;
  font-size: 1.2rem;
  color: #1E90FF;
  font-weight: 600;
}

.proposal-type-badge {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  margin-right: 0.5rem; /* Add margin to separate from close button */
}

.proposal-type-badge.add {
  background: rgba(40, 167, 69, 0.2);
  color: #28a745;
  border: 1px solid rgba(40, 167, 69, 0.4);
}

.proposal-type-badge.move {
  background: rgba(255, 193, 7, 0.2);
  color: #ffc107;
  border: 1px solid rgba(255, 193, 7, 0.4);
}

.proposal-type-badge.edit {
  background: rgba(23, 162, 184, 0.2);
  color: #17a2b8;
  border: 1px solid rgba(23, 162, 184, 0.4);
}

.proposal-type-badge.delete {
  background: rgba(220, 53, 69, 0.2);
  color: #dc3545;
  border: 1px solid rgba(220, 53, 69, 0.4);
}

.proposer-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
  font-size: 0.9rem;
}

.proposer-label {
  color: #888;
}

.proposer-name {
  color: #FFD700;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.donation-badge {
  font-size: 18px;
  filter: drop-shadow(0 0 4px currentColor);
  animation: badge-glow 2s ease-in-out infinite;
}

@keyframes badge-glow {
  0%, 100% { opacity: 0.8; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.1); }
}

.proposal-details {
  margin-bottom: 1rem;
}

.detail-row {
  display: flex;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
}

.detail-label {
  color: #888;
  margin-right: 0.5rem;
  min-width: 80px;
}

.detail-value {
  color: #e0e0e0;
  flex: 1;
}

.detail-row.notes {
  flex-direction: column;
  margin-top: 0.75rem;
}

.detail-row.notes .detail-value {
  margin-top: 0.25rem;
  font-style: italic;
  color: #bbb;
}

.toggle-proposed-btn {
  background: rgba(30, 144, 255, 0.2);
  border: 1px solid #1E90FF;
  color: #1E90FF;
  padding: 0.25rem 0.75rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
  transition: all 0.2s ease;
}

.toggle-proposed-btn:hover {
  background: rgba(30, 144, 255, 0.3);
  border-color: #4B9BFF;
}

.changes-list {
  margin-top: 0.5rem;
  font-size: 0.85rem;
}

.change-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.4rem;
  padding: 0.25rem 0.5rem;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 4px;
}

.change-field {
  color: #888;
  min-width: 80px;
}

.change-old {
  color: #dc3545;
  text-decoration: line-through;
}

.change-arrow {
  color: #666;
}

.change-new {
  color: #28a745;
  font-weight: 500;
}

.voting-section {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 6px;
  padding: 1rem;
  margin-top: 1rem;
}

.vote-stats {
  display: flex;
  align-items: center;
  justify-content: space-around;
  margin-bottom: 1rem;
}

.vote-count {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  transition: all 0.2s ease;
}

.vote-count.voted {
  background: rgba(30, 144, 255, 0.2);
  border: 1px solid rgba(30, 144, 255, 0.4);
}

.vote-icon {
  font-size: 1.2rem;
}

.vote-number {
  font-size: 1.1rem;
  font-weight: 600;
}

.upvotes .vote-number {
  color: #28a745;
}

.downvotes .vote-number {
  color: #dc3545;
}

.vote-score {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.score-label {
  font-size: 0.75rem;
  color: #888;
}

.score-value {
  font-size: 1.5rem;
  font-weight: 700;
}

.score-value.positive {
  color: #28a745;
}

.score-value.negative {
  color: #dc3545;
}

.score-value.neutral {
  color: #888;
}

.vote-buttons {
  display: flex;
  gap: 0.5rem;
}

.vote-btn {
  flex: 1;
  padding: 0.5rem 1rem;
  border: 1px solid #444;
  background: rgba(255, 255, 255, 0.05);
  color: #e0e0e0;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  transition: all 0.2s ease;
}

.vote-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.upvote-btn:hover:not(:disabled) {
  background: rgba(40, 167, 69, 0.2);
  border-color: #28a745;
  color: #28a745;
}

.upvote-btn.active {
  background: rgba(40, 167, 69, 0.3);
  border-color: #28a745;
  color: #28a745;
}

.downvote-btn:hover:not(:disabled) {
  background: rgba(220, 53, 69, 0.2);
  border-color: #dc3545;
  color: #dc3545;
}

.downvote-btn.active {
  background: rgba(220, 53, 69, 0.3);
  border-color: #dc3545;
  color: #dc3545;
}

.login-prompt {
  text-align: center;
  color: #888;
  font-size: 0.9rem;
}

.close-btn {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  background: none;
  border: none;
  color: #888;
  font-size: 1.5rem;
  cursor: pointer;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

/* Show NPCs Button */
.show-npcs-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: rgba(96, 165, 250, 0.1);
  border: 1px solid rgba(96, 165, 250, 0.3);
  border-radius: 4px;
  color: #60a5fa;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  transition: all 0.2s ease;
  margin-top: 0.5rem;
}

.show-npcs-btn:hover {
  background: rgba(96, 165, 250, 0.2);
  border-color: rgba(96, 165, 250, 0.5);
  transform: translateY(-1px);
}

.show-npcs-btn .btn-icon {
  font-size: 1.1rem;
}
</style>