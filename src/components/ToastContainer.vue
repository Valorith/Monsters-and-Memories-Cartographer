<template>
  <div class="toast-container">
    <Toast
      v-for="toast in toasts"
      :key="toast.id"
      :message="toast.message"
      :type="toast.type"
      :duration="toast.duration"
      :show="toast.show"
      @close="() => removeToast(toast.id)"
    />
  </div>
</template>

<script>
import { useToast } from '../composables/useToast'
import Toast from './Toast.vue'

export default {
  name: 'ToastContainer',
  components: {
    Toast
  },
  setup() {
    const { toasts, removeToast } = useToast()
    
    return {
      toasts,
      removeToast
    }
  }
}
</script>

<style scoped>
.toast-container {
  position: fixed;
  top: 1rem;
  right: 1rem;
  z-index: 2000;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  pointer-events: none;
}

.toast-container > * {
  pointer-events: auto;
}
</style>