<template>
  <Transition name="warning">
    <div v-if="visible && currentWarning" class="warning-overlay">
      <div class="warning-dialog">
        <div class="warning-header">
          <div class="warning-icon">⚠️</div>
          <h3>Admin Warning</h3>
        </div>
        <div class="warning-body">
          <div class="warning-meta">
            <p class="warning-date">{{ formatDate(currentWarning.created_at) }}</p>
            <p class="warning-admin">From: {{ currentWarning.admin_name }}</p>
          </div>
          <div class="warning-message">
            <p>{{ currentWarning.reason }}</p>
          </div>
        </div>
        <div class="warning-footer">
          <button 
            class="warning-btn warning-btn-acknowledge" 
            @click="acknowledgeWarning"
            :disabled="acknowledging"
          >
            {{ acknowledging ? 'Acknowledging...' : 'Acknowledge' }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script>
import { ref, computed, watch, onMounted } from 'vue'
import { useToast } from '../composables/useToast'
import { useCSRF } from '../composables/useCSRF'

export default {
  name: 'WarningModal',
  props: {
    warnings: {
      type: Array,
      default: () => []
    }
  },
  emits: ['acknowledged'],
  setup(props, { emit }) {
    const visible = ref(false)
    const currentWarningIndex = ref(0)
    const acknowledging = ref(false)
    const { error } = useToast()
    const { fetchWithCSRF } = useCSRF()
    
    // Get current warning to display
    const currentWarning = computed(() => {
      if (props.warnings.length === 0) return null
      return props.warnings[currentWarningIndex.value]
    })
    
    // Show modal if there are warnings
    const checkWarnings = () => {
      if (props.warnings.length > 0) {
        currentWarningIndex.value = 0
        visible.value = true
      } else {
        visible.value = false
      }
    }
    
    // Format date for display with relative time
    const formatDate = (dateString) => {
      const date = new Date(dateString)
      const now = new Date()
      const diffInMs = now - date
      const diffInMinutes = Math.floor(diffInMs / (1000 * 60))
      const diffInHours = Math.floor(diffInMinutes / 60)
      const diffInDays = Math.floor(diffInHours / 24)
      
      // Show relative time for recent warnings
      if (diffInMinutes < 1) {
        return 'Just now'
      } else if (diffInMinutes < 60) {
        return `${diffInMinutes} minute${diffInMinutes !== 1 ? 's' : ''} ago`
      } else if (diffInHours < 24) {
        return `${diffInHours} hour${diffInHours !== 1 ? 's' : ''} ago`
      } else if (diffInDays < 7) {
        return `${diffInDays} day${diffInDays !== 1 ? 's' : ''} ago`
      }
      
      // For older warnings, show absolute date
      return date.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      })
    }
    
    // Acknowledge the current warning
    const acknowledgeWarning = async () => {
      if (!currentWarning.value || acknowledging.value) return
      
      acknowledging.value = true
      
      try {
        const response = await fetchWithCSRF(`/api/warnings/${currentWarning.value.id}/acknowledge`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        })
        
        if (!response.ok) {
          throw new Error('Failed to acknowledge warning')
        }
        
        // Emit event to parent to update warnings list
        emit('acknowledged', currentWarning.value.id)
        
        // Check if there are more warnings
        if (currentWarningIndex.value < props.warnings.length - 1) {
          // Show next warning
          currentWarningIndex.value++
        } else {
          // All warnings acknowledged
          visible.value = false
        }
      } catch (err) {
        console.error('Error acknowledging warning:', err)
        error('Failed to acknowledge warning. Please try again.')
      } finally {
        acknowledging.value = false
      }
    }
    
    // Watch for changes in warnings
    watch(() => props.warnings, (newWarnings) => {
      checkWarnings()
    }, { immediate: true, deep: true })
    
    // Also check on mount to ensure immediate display
    onMounted(() => {
      checkWarnings()
    })
    
    return {
      visible,
      currentWarning,
      acknowledging,
      formatDate,
      acknowledgeWarning
    }
  }
}
</script>

<style scoped>
.warning-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.warning-dialog {
  background: rgba(40, 36, 20, 0.98);
  border: 2px solid #ffc107;
  border-radius: 8px;
  min-width: 400px;
  max-width: 500px;
  box-shadow: 0 4px 30px rgba(255, 193, 7, 0.3);
}

.warning-header {
  padding: 1.5rem;
  border-bottom: 1px solid #665533;
  display: flex;
  align-items: center;
  gap: 1rem;
  background: rgba(255, 193, 7, 0.1);
}

.warning-icon {
  font-size: 2rem;
  filter: drop-shadow(0 0 10px rgba(255, 200, 0, 0.5));
}

.warning-header h3 {
  margin: 0;
  color: #ffc107;
  font-size: 1.4rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.warning-body {
  padding: 1.5rem;
}

.warning-meta {
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #665533;
}

.warning-date,
.warning-admin {
  margin: 0.25rem 0;
  color: #aaa;
  font-size: 0.9rem;
}

.warning-message {
  background: rgba(255, 255, 255, 0.05);
  padding: 1rem;
  border-radius: 4px;
  border-left: 3px solid #ffc107;
}

.warning-message p {
  margin: 0;
  color: #fff;
  line-height: 1.6;
  font-size: 1.05rem;
}

.warning-footer {
  padding: 1.5rem;
  display: flex;
  justify-content: center;
  border-top: 1px solid #665533;
  background: rgba(0, 0, 0, 0.2);
}

.warning-btn {
  padding: 0.8rem 2.5rem;
  border: none;
  border-radius: 4px;
  font-size: 1.05rem;
  cursor: pointer;
  transition: all 0.2s;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.warning-btn-acknowledge {
  background: #ffc107;
  color: #1a1a1a;
  box-shadow: 0 2px 10px rgba(255, 193, 7, 0.3);
}

.warning-btn-acknowledge:hover:not(:disabled) {
  background: #ffcd38;
  box-shadow: 0 2px 15px rgba(255, 193, 7, 0.4);
  transform: translateY(-1px);
}

.warning-btn-acknowledge:active:not(:disabled) {
  transform: translateY(0);
}

.warning-btn-acknowledge:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Transition animations */
.warning-enter-active,
.warning-leave-active {
  transition: all 0.3s ease;
}

.warning-enter-from,
.warning-leave-to {
  opacity: 0;
}

.warning-enter-active .warning-dialog,
.warning-leave-active .warning-dialog {
  transition: all 0.3s ease;
}

.warning-enter-from .warning-dialog {
  transform: scale(0.8) translateY(-30px);
  opacity: 0;
}

.warning-leave-to .warning-dialog {
  transform: scale(0.9);
  opacity: 0;
}

/* Mobile responsiveness */
@media (max-width: 640px) {
  .warning-dialog {
    min-width: 90vw;
    max-width: 90vw;
    margin: 1rem;
  }
  
  .warning-header {
    padding: 1.25rem;
  }
  
  .warning-icon {
    font-size: 1.5rem;
  }
  
  .warning-header h3 {
    font-size: 1.2rem;
  }
}
</style>