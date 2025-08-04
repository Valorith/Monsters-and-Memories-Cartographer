<template>
  <Transition name="ban">
    <div v-if="visible" class="ban-overlay">
      <div class="ban-dialog">
        <div class="ban-header">
          <div class="ban-icon">🚫</div>
          <h3>Account Banned</h3>
        </div>
        <div class="ban-body">
          <div class="ban-message">
            <p>Your account has been banned from this application.</p>
            <div v-if="banReason" class="ban-reason">
              <h4>Reason:</h4>
              <p>{{ banReason }}</p>
            </div>
            <div v-else class="ban-reason">
              <p style="font-style: italic; color: #ccc;">No reason provided.</p>
            </div>
          </div>
          <div class="ban-info">
            <p>If you believe this is a mistake, please contact the administrators.</p>
            <p class="refresh-hint">You may refresh the page to check if your ban has been lifted.</p>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script>
import { ref, computed, watch, onMounted } from 'vue'
import { useAuth } from '../composables/useAuth'

export default {
  name: 'BanModal',
  setup() {
    const visible = ref(false)
    const { user } = useAuth()
    
    // Get ban reason from user data
    const banReason = computed(() => {
      return user.value?.banReason || ''
    })
    
    // Check if user is banned
    const checkBanStatus = () => {
      if (user.value?.isBanned) {
        visible.value = true
      } else {
        visible.value = false
      }
    }
    
    // Watch for user changes
    watch(user, () => {
      checkBanStatus()
    }, { deep: true })
    
    onMounted(() => {
      checkBanStatus()
    })
    
    return {
      visible,
      banReason
    }
  }
}
</script>

<style scoped>
.ban-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.ban-dialog {
  background: rgba(40, 20, 20, 0.98);
  border: 3px solid #dc3545;
  border-radius: 8px;
  min-width: 450px;
  max-width: 550px;
  box-shadow: 0 4px 40px rgba(220, 53, 69, 0.4);
  animation: shake 0.5s ease-in-out;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
  20%, 40%, 60%, 80% { transform: translateX(5px); }
}

.ban-header {
  padding: 1.5rem;
  border-bottom: 1px solid #661111;
  display: flex;
  align-items: center;
  gap: 1rem;
  background: rgba(220, 53, 69, 0.15);
}

.ban-icon {
  font-size: 2.5rem;
  filter: drop-shadow(0 0 15px rgba(220, 53, 69, 0.8));
}

.ban-header h3 {
  margin: 0;
  color: #ff4444;
  font-size: 1.6rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.ban-body {
  padding: 2rem;
}

.ban-message {
  background: rgba(255, 255, 255, 0.05);
  padding: 1.5rem;
  border-radius: 6px;
  border-left: 4px solid #dc3545;
  margin-bottom: 1.5rem;
}

.ban-message > p:first-child {
  margin: 0 0 1rem 0;
  color: #fff;
  font-size: 1.1rem;
  font-weight: 500;
}

.ban-reason {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #661111;
}

.ban-reason h4 {
  margin: 0 0 0.5rem 0;
  color: #ff6666;
  font-size: 1rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.ban-reason p {
  margin: 0;
  color: #fff;
  line-height: 1.6;
  font-size: 1.05rem;
}

.ban-info {
  text-align: center;
  color: #aaa;
  font-size: 0.95rem;
}

.ban-info p {
  margin: 0.5rem 0;
}

.refresh-hint {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #661111;
  color: #999;
  font-size: 0.9rem;
  font-style: italic;
}

/* Transition animations */
.ban-enter-active,
.ban-leave-active {
  transition: all 0.3s ease;
}

.ban-enter-from,
.ban-leave-to {
  opacity: 0;
}

.ban-enter-active .ban-dialog,
.ban-leave-active .ban-dialog {
  transition: all 0.3s ease;
}

.ban-enter-from .ban-dialog {
  transform: scale(0.8) translateY(-30px);
  opacity: 0;
}

.ban-leave-to .ban-dialog {
  transform: scale(0.9);
  opacity: 0;
}

/* Mobile responsiveness */
@media (max-width: 640px) {
  .ban-dialog {
    min-width: 90vw;
    max-width: 90vw;
    margin: 1rem;
  }
  
  .ban-header {
    padding: 1.25rem;
  }
  
  .ban-icon {
    font-size: 2rem;
  }
  
  .ban-header h3 {
    font-size: 1.3rem;
  }
}
</style>