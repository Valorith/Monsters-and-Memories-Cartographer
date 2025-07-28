<template>
  <Transition name="confirm">
    <div v-if="visible" class="confirm-overlay" @click.self="handleCancel">
      <div class="confirm-dialog">
        <div class="confirm-header">
          <h3>{{ title }}</h3>
        </div>
        <div class="confirm-body">
          <p>{{ message }}</p>
        </div>
        <div class="confirm-footer">
          <button class="confirm-btn confirm-btn-primary" @click="handleConfirm">
            {{ confirmText }}
          </button>
          <button class="confirm-btn confirm-btn-secondary" @click="handleCancel">
            {{ cancelText }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script>
import { ref, watch } from 'vue'

export default {
  name: 'ConfirmDialog',
  props: {
    show: {
      type: Boolean,
      default: false
    },
    title: {
      type: String,
      default: 'Confirm Action'
    },
    message: {
      type: String,
      required: true
    },
    confirmText: {
      type: String,
      default: 'Confirm'
    },
    cancelText: {
      type: String,
      default: 'Cancel'
    }
  },
  emits: ['confirm', 'cancel'],
  setup(props, { emit }) {
    const visible = ref(props.show)
    
    watch(() => props.show, (newVal) => {
      visible.value = newVal
    })
    
    const handleConfirm = () => {
      visible.value = false
      emit('confirm')
    }
    
    const handleCancel = () => {
      visible.value = false
      emit('cancel')
    }
    
    return {
      visible,
      handleConfirm,
      handleCancel
    }
  }
}
</script>

<style scoped>
.confirm-overlay {
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

.confirm-dialog {
  background: rgba(30, 30, 30, 0.98);
  border: 1px solid #555;
  border-radius: 8px;
  min-width: 300px;
  max-width: 500px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
}

.confirm-header {
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #444;
}

.confirm-header h3 {
  margin: 0;
  color: #fff;
  font-size: 1.2rem;
}

.confirm-body {
  padding: 1.5rem;
}

.confirm-body p {
  margin: 0;
  color: #e0e0e0;
  line-height: 1.5;
}

.confirm-footer {
  padding: 1rem 1.5rem;
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  border-top: 1px solid #444;
}

.confirm-btn {
  padding: 0.5rem 1.5rem;
  border: none;
  border-radius: 4px;
  font-size: 0.95rem;
  cursor: pointer;
  transition: all 0.2s;
  font-weight: 500;
}

.confirm-btn-primary {
  background: #4a7c59;
  color: white;
}

.confirm-btn-primary:hover {
  background: #5a8c69;
}

.confirm-btn-secondary {
  background: #555;
  color: white;
}

.confirm-btn-secondary:hover {
  background: #666;
}

/* Transition animations */
.confirm-enter-active,
.confirm-leave-active {
  transition: all 0.2s ease;
}

.confirm-enter-from,
.confirm-leave-to {
  opacity: 0;
}

.confirm-enter-active .confirm-dialog,
.confirm-leave-active .confirm-dialog {
  transition: transform 0.2s ease;
}

.confirm-enter-from .confirm-dialog {
  transform: scale(0.9);
}

.confirm-leave-to .confirm-dialog {
  transform: scale(0.9);
}
</style>