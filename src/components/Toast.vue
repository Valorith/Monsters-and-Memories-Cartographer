<template>
  <Transition name="toast">
    <div v-if="visible" class="toast" :class="type">
      <div class="toast-icon">
        <span v-if="type === 'success'">✓</span>
        <span v-else-if="type === 'error'">✗</span>
        <span v-else-if="type === 'warning'">⚠</span>
        <span v-else>ℹ</span>
      </div>
      <div class="toast-content">
        <p class="toast-message">{{ message }}</p>
      </div>
      <button class="toast-close" @click="$emit('close')">×</button>
    </div>
  </Transition>
</template>

<script>
import { ref, watch, onMounted } from 'vue'

export default {
  name: 'Toast',
  props: {
    message: {
      type: String,
      required: true
    },
    type: {
      type: String,
      default: 'info',
      validator: (value) => ['success', 'error', 'warning', 'info'].includes(value)
    },
    duration: {
      type: Number,
      default: 3000
    },
    show: {
      type: Boolean,
      default: false
    }
  },
  emits: ['close'],
  setup(props, { emit }) {
    const visible = ref(false)
    let timeoutId = null
    
    const startTimer = () => {
      if (timeoutId) clearTimeout(timeoutId)
      if (props.duration > 0) {
        timeoutId = setTimeout(() => {
          visible.value = false
          setTimeout(() => emit('close'), 300)
        }, props.duration)
      }
    }
    
    watch(() => props.show, (newVal) => {
      visible.value = newVal
      if (newVal) {
        startTimer()
      }
    })
    
    onMounted(() => {
      if (props.show) {
        visible.value = true
        startTimer()
      }
    })
    
    return {
      visible
    }
  }
}
</script>

<style scoped>
.toast {
  position: fixed;
  top: 1rem;
  right: 1rem;
  min-width: 300px;
  max-width: 500px;
  background: rgba(30, 30, 30, 0.95);
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  padding: 1rem;
  gap: 1rem;
  z-index: 2000;
  border: 1px solid;
}

.toast.success {
  border-color: #2ecc71;
}

.toast.error {
  border-color: #e74c3c;
}

.toast.warning {
  border-color: #f39c12;
}

.toast.info {
  border-color: #3498db;
}

.toast-icon {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  font-weight: bold;
  flex-shrink: 0;
}

.toast.success .toast-icon {
  background: rgba(46, 204, 113, 0.2);
  color: #2ecc71;
}

.toast.error .toast-icon {
  background: rgba(231, 76, 60, 0.2);
  color: #e74c3c;
}

.toast.warning .toast-icon {
  background: rgba(243, 156, 18, 0.2);
  color: #f39c12;
}

.toast.info .toast-icon {
  background: rgba(52, 152, 219, 0.2);
  color: #3498db;
}

.toast-content {
  flex: 1;
}

.toast-message {
  margin: 0;
  color: #e0e0e0;
  font-size: 0.95rem;
  line-height: 1.4;
}

.toast-close {
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

.toast-close:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.1);
}

/* Transition animations */
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from {
  transform: translateX(100%);
  opacity: 0;
}

.toast-leave-to {
  transform: translateX(100%);
  opacity: 0;
}
</style>