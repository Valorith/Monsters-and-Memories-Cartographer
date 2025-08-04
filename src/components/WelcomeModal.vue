<template>
  <Transition name="welcome">
    <div v-if="visible" class="welcome-overlay" @click.self="handleClose">
      <div class="welcome-dialog">
        <div class="welcome-header">
          <h3>Welcome to MMC!</h3>
        </div>
        <div class="welcome-body">
          <div v-html="formattedMessage"></div>
        </div>
        <div class="welcome-footer">
          <button class="welcome-btn welcome-btn-primary" @click="handleClose">
            OK
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script>
import { ref, computed, onMounted, watch } from 'vue'
import { marked } from 'marked'
import { useAuth } from '../composables/useAuth'

export default {
  name: 'WelcomeModal',
  setup() {
    const visible = ref(false)
    const message = ref('')
    const { unacknowledgedWarnings } = useAuth()
    
    // Configure marked for safe HTML rendering
    marked.setOptions({
      breaks: true,
      gfm: true
    })
    
    // Format message with markdown support
    const formattedMessage = computed(() => {
      if (!message.value) return ''
      try {
        return marked.parse(message.value)
      } catch (error) {
        console.error('Error parsing markdown:', error)
        return message.value
      }
    })
    
    const checkAndShowWelcomeMessage = async () => {
      // Don't show if there are unacknowledged warnings
      if (unacknowledgedWarnings.value && unacknowledgedWarnings.value.length > 0) {
        return
      }
      
      // Check if already shown this session
      const shownThisSession = sessionStorage.getItem('welcomeMessageShown')
      if (shownThisSession === 'true') {
        return
      }
      
      try {
        // Fetch welcome message from API
        const response = await fetch('/api/welcome-message')
        const data = await response.json()
        
        if (data.message) {
          message.value = data.message
          visible.value = true
          // Mark as shown for this session
          sessionStorage.setItem('welcomeMessageShown', 'true')
        }
      } catch (error) {
        console.error('Failed to fetch welcome message:', error)
      }
    }
    
    const handleClose = () => {
      visible.value = false
    }
    
    // Watch for changes in warnings - when they're all acknowledged, check for welcome message
    watch(unacknowledgedWarnings, (newWarnings, oldWarnings) => {
      // If warnings just got cleared (went from some to none), check for welcome message
      if (oldWarnings && oldWarnings.length > 0 && (!newWarnings || newWarnings.length === 0)) {
        setTimeout(checkAndShowWelcomeMessage, 500)
      }
    })
    
    onMounted(() => {
      // Delay slightly to ensure app is fully loaded
      setTimeout(checkAndShowWelcomeMessage, 500)
    })
    
    return {
      visible,
      message,
      formattedMessage,
      handleClose
    }
  }
}
</script>

<style scoped>
.welcome-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3000;
}

.welcome-dialog {
  background: rgba(30, 30, 30, 0.98);
  border: 1px solid #555;
  border-radius: 8px;
  min-width: 400px;
  max-width: 600px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
}

.welcome-header {
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #444;
}

.welcome-header h3 {
  margin: 0;
  color: #fff;
  font-size: 1.3rem;
  font-weight: 600;
}

.welcome-body {
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1;
}

.welcome-body :deep(p) {
  margin: 0 0 1rem 0;
  color: #e0e0e0;
  line-height: 1.6;
}

.welcome-body :deep(p:last-child) {
  margin-bottom: 0;
}

.welcome-body :deep(h1),
.welcome-body :deep(h2),
.welcome-body :deep(h3),
.welcome-body :deep(h4),
.welcome-body :deep(h5),
.welcome-body :deep(h6) {
  color: #fff;
  margin: 1rem 0 0.5rem 0;
}

.welcome-body :deep(ul),
.welcome-body :deep(ol) {
  margin: 0.5rem 0;
  padding-left: 1.5rem;
  color: #e0e0e0;
}

.welcome-body :deep(li) {
  margin: 0.25rem 0;
}

.welcome-body :deep(a) {
  color: #7fb069;
  text-decoration: none;
}

.welcome-body :deep(a:hover) {
  text-decoration: underline;
}

.welcome-body :deep(code) {
  background: rgba(255, 255, 255, 0.1);
  padding: 0.2rem 0.4rem;
  border-radius: 3px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 0.9em;
}

.welcome-body :deep(pre) {
  background: rgba(0, 0, 0, 0.3);
  padding: 1rem;
  border-radius: 4px;
  overflow-x: auto;
}

.welcome-body :deep(blockquote) {
  border-left: 3px solid #7fb069;
  padding-left: 1rem;
  margin: 1rem 0;
  color: #ccc;
}

.welcome-footer {
  padding: 1rem 1.5rem;
  display: flex;
  justify-content: center;
  border-top: 1px solid #444;
}

.welcome-btn {
  padding: 0.6rem 2rem;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
  font-weight: 500;
}

.welcome-btn-primary {
  background: #4a7c59;
  color: white;
}

.welcome-btn-primary:hover {
  background: #5a8c69;
}

/* Transition animations */
.welcome-enter-active,
.welcome-leave-active {
  transition: all 0.3s ease;
}

.welcome-enter-from,
.welcome-leave-to {
  opacity: 0;
}

.welcome-enter-active .welcome-dialog,
.welcome-leave-active .welcome-dialog {
  transition: transform 0.3s ease;
}

.welcome-enter-from .welcome-dialog {
  transform: scale(0.9) translateY(-20px);
}

.welcome-leave-to .welcome-dialog {
  transform: scale(0.9) translateY(20px);
}

/* Mobile responsiveness */
@media (max-width: 640px) {
  .welcome-dialog {
    min-width: 90vw;
    max-width: 90vw;
    margin: 1rem;
  }
}
</style>