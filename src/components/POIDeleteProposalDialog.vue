<template>
  <div v-if="visible" class="modal-overlay" @click.self="handleClose">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h2>Propose POI Deletion</h2>
        <button class="close-btn" @click="handleClose">×</button>
      </div>
      
      <div class="modal-body">
        <div v-if="poi && poi.name" class="poi-info">
          <h3>{{ poi.name }}</h3>
          <p v-if="poi.description" class="poi-description">{{ poi.description }}</p>
          <div class="poi-details">
            <span class="detail-item">
              <span class="icon">{{ poi.icon || poi.icon_value || '📍' }}</span>
              {{ poi.type_name || 'Point of Interest' }}
            </span>
            <span v-if="poi.npc_name" class="detail-item">
              <span class="icon">⚔️</span>
              {{ poi.npc_name }}
            </span>
            <span v-if="poi.item_name" class="detail-item">
              <span class="icon">💎</span>
              {{ poi.item_name }}
            </span>
          </div>
        </div>
        
        <div class="warning-box">
          <span class="warning-icon">⚠️</span>
          <div class="warning-content">
            <p class="warning-title">Are you sure you want to propose deleting this POI?</p>
            <p class="warning-text">This will submit a proposal for community voting. If approved, the POI will be permanently removed from the map.</p>
          </div>
        </div>
        
        <form @submit.prevent="submitProposal" class="proposal-form">
          <div class="form-group">
            <label for="deletion-reason">Reason for deletion (required)</label>
            <textarea 
              id="deletion-reason"
              v-model="proposalNotes" 
              class="form-control" 
              rows="3"
              placeholder="Please explain why this POI should be deleted..."
              required
            ></textarea>
          </div>
          
          <div class="form-actions">
            <button type="submit" class="submit-btn" :disabled="!proposalNotes.trim()">
              Submit Deletion Proposal
            </button>
            <button type="button" class="cancel-btn" @click="handleClose">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, watch } from 'vue'
import { useToast } from '../composables/useToast'
import { useCSRF } from '../composables/useCSRF'

export default {
  name: 'POIDeleteProposalDialog',
  props: {
    visible: {
      type: Boolean,
      default: false
    },
    poi: {
      type: Object,
      default: () => ({})
    }
  },
  emits: ['close', 'submitted'],
  setup(props, { emit }) {
    const { success, error } = useToast()
    const { fetchWithCSRF } = useCSRF()
    
    const proposalNotes = ref('')
    
    // Reset form when dialog opens
    watch(() => props.visible, (newVal) => {
      if (newVal) {
        proposalNotes.value = ''
      }
    })
    
    const submitProposal = async () => {
      if (!proposalNotes.value.trim()) {
        error('Please provide a reason for deletion')
        return
      }
      
      try {
        const proposalData = {
          change_type: 'delete_poi',
          target_type: 'poi',
          target_id: props.poi?.id,
          current_data: {
            name: props.poi?.name,
            description: props.poi?.description,
            type_id: props.poi?.type_id,
            type_name: props.poi?.type_name,
            npc_id: props.poi?.npc_id,
            item_id: props.poi?.item_id,
            x: props.poi?.x,
            y: props.poi?.y,
            map_id: props.poi?.map_id
          },
          proposed_data: {
            deleted: true
          },
          notes: proposalNotes.value
        }
        
        const response = await fetchWithCSRF('/api/change-proposals', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(proposalData)
        })
        
        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to create proposal')
        }
        
        success('Deletion proposal submitted for community voting')
        emit('submitted')
        handleClose()
      } catch (err) {
        error(err.message || 'Failed to submit proposal')
      }
    }
    
    const handleClose = () => {
      emit('close')
    }
    
    return {
      proposalNotes,
      submitProposal,
      handleClose
    }
  }
}
</script>

<style scoped>
.modal-overlay {
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
  padding: 1rem;
}

.modal-content {
  background: #2d2d2d;
  border-radius: 12px;
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #444;
  flex-shrink: 0;
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(239, 68, 68, 0.05));
}

.modal-header h2 {
  margin: 0;
  color: #ef4444;
  font-size: 1.5rem;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  color: #999;
  font-size: 1.5rem;
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

.close-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.modal-body {
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

.poi-info {
  background: rgba(0, 0, 0, 0.3);
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 1.5rem;
}

.poi-info h3 {
  margin: 0 0 0.5rem 0;
  color: #fff;
  font-size: 1.2rem;
}

.poi-description {
  color: #ccc;
  font-size: 0.9rem;
  margin-bottom: 0.75rem;
  line-height: 1.4;
}

.poi-details {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.detail-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #999;
  font-size: 0.9rem;
}

.detail-item .icon {
  font-size: 1rem;
}

.warning-box {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 8px;
  margin-bottom: 1.5rem;
}

.warning-icon {
  font-size: 1.5rem;
  color: #ef4444;
}

.warning-content {
  flex: 1;
}

.warning-title {
  margin: 0 0 0.5rem 0;
  color: #ef4444;
  font-weight: 600;
}

.warning-text {
  margin: 0;
  color: #fca5a5;
  font-size: 0.9rem;
  line-height: 1.4;
}

.proposal-form {
  margin-top: 1.5rem;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  color: #e0e0e0;
  font-weight: 500;
  font-size: 0.9rem;
}

.form-control {
  width: 100%;
  padding: 0.75rem;
  background: #1a1a1a;
  border: 1px solid #444;
  border-radius: 6px;
  color: #e0e0e0;
  font-size: 0.95rem;
  transition: all 0.2s;
  resize: vertical;
}

.form-control:focus {
  outline: none;
  border-color: #ef4444;
  background: #262626;
}

.form-control::placeholder {
  color: #666;
}

.form-actions {
  display: flex;
  gap: 1rem;
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid #444;
}

.submit-btn,
.cancel-btn {
  flex: 1;
  padding: 0.75rem;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.submit-btn {
  background: #ef4444;
  color: white;
}

.submit-btn:hover:not(:disabled) {
  background: #dc2626;
}

.submit-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.cancel-btn {
  background: #4b5563;
  color: white;
}

.cancel-btn:hover {
  background: #374151;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .modal-content {
    width: 95%;
    max-height: 95vh;
    margin: 1rem;
  }
  
  .modal-body {
    padding: 1rem;
  }
  
  .form-actions {
    flex-direction: column;
  }
  
  .submit-btn,
  .cancel-btn {
    width: 100%;
  }
}

@media (max-width: 640px) {
  .modal-content {
    width: 100%;
    margin: 0.5rem;
  }
}
</style>