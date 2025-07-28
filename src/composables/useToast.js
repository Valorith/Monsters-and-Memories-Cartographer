import { ref } from 'vue'

const toasts = ref([])
let toastId = 0

export function useToast() {
  const addToast = (message, type = 'info', duration = 3000) => {
    const id = toastId++
    const toast = {
      id,
      message,
      type,
      duration,
      show: true
    }
    
    toasts.value.push(toast)
    
    if (duration > 0) {
      setTimeout(() => {
        removeToast(id)
      }, duration + 300) // Add transition time
    }
    
    return id
  }
  
  const removeToast = (id) => {
    const index = toasts.value.findIndex(t => t.id === id)
    if (index > -1) {
      toasts.value[index].show = false
      setTimeout(() => {
        toasts.value = toasts.value.filter(t => t.id !== id)
      }, 300)
    }
  }
  
  const success = (message, duration) => addToast(message, 'success', duration)
  const error = (message, duration) => addToast(message, 'error', duration)
  const warning = (message, duration) => addToast(message, 'warning', duration)
  const info = (message, duration) => addToast(message, 'info', duration)
  
  return {
    toasts,
    addToast,
    removeToast,
    success,
    error,
    warning,
    info
  }
}