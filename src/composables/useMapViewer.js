import { ref } from 'vue'

export function useMapViewer() {
  const canvas = ref(null)
  const ctx = ref(null)
  const image = ref(null)
  
  const scale = ref(1)
  const minScale = 0.1
  const maxScale = 5
  const offsetX = ref(0)
  const offsetY = ref(0)
  
  const isDragging = ref(false)
  const dragStartX = ref(0)
  const dragStartY = ref(0)
  
  const initCanvas = (canvasElement) => {
    canvas.value = canvasElement
    ctx.value = canvasElement.getContext('2d')
  }
  
  const loadImage = (src) => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        image.value = img
        resolve(img)
      }
      img.onerror = () => {
        reject(new Error(`Failed to load image: ${src}`))
      }
      img.src = src
    })
  }
  
  const startDrag = (x, y) => {
    isDragging.value = true
    dragStartX.value = x - offsetX.value
    dragStartY.value = y - offsetY.value
  }
  
  const drag = (x, y) => {
    if (!isDragging.value) return
    
    offsetX.value = x - dragStartX.value
    offsetY.value = y - dragStartY.value
  }
  
  const endDrag = () => {
    isDragging.value = false
  }
  
  const wheelZoom = (x, y, factor) => {
    const newScale = Math.max(minScale, Math.min(maxScale, scale.value * factor))
    
    if (newScale !== scale.value) {
      const scaleChange = newScale / scale.value
      offsetX.value = x - (x - offsetX.value) * scaleChange
      offsetY.value = y - (y - offsetY.value) * scaleChange
      scale.value = newScale
    }
  }
  
  const zoom = (factor, canvasElement) => {
    if (!canvasElement) return
    const centerX = canvasElement.width / 2
    const centerY = canvasElement.height / 2
    wheelZoom(centerX, centerY, factor)
  }
  
  const resetView = (canvasElement) => {
    if (!image.value || !canvasElement) return
    
    const canvasRatio = canvasElement.width / canvasElement.height
    const imageRatio = image.value.width / image.value.height
    
    if (canvasRatio > imageRatio) {
      scale.value = canvasElement.height / image.value.height
    } else {
      scale.value = canvasElement.width / image.value.width
    }
    
    scale.value *= 0.9 // Add padding
    
    offsetX.value = (canvasElement.width - image.value.width * scale.value) / 2
    offsetY.value = (canvasElement.height - image.value.height * scale.value) / 2
  }
  
  const render = () => {
    if (!ctx.value || !canvas.value || !image.value) return
    
    ctx.value.clearRect(0, 0, canvas.value.width, canvas.value.height)
    
    ctx.value.save()
    ctx.value.translate(offsetX.value, offsetY.value)
    ctx.value.scale(scale.value, scale.value)
    ctx.value.drawImage(image.value, 0, 0)
    ctx.value.restore()
  }
  
  return {
    canvas,
    ctx,
    image,
    scale,
    offsetX,
    offsetY,
    isDragging,
    initCanvas,
    loadImage,
    startDrag,
    drag,
    endDrag,
    wheelZoom,
    zoom,
    resetView,
    render
  }
}