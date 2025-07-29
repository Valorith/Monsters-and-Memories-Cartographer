import { ref, computed } from 'vue'

export function useMapInteractions(scale, offsetX, offsetY) {
  const hoveredPOI = ref(null)
  const hoveredConnection = ref(null)
  const hoveredConnector = ref(null)
  
  // Convert canvas coordinates to image coordinates
  const canvasToImage = (canvasX, canvasY) => {
    const imageX = (canvasX - offsetX.value) / scale.value
    const imageY = (canvasY - offsetY.value) / scale.value
    return { x: imageX, y: imageY }
  }
  
  // Convert image coordinates to canvas coordinates
  const imageToCanvas = (imageX, imageY) => {
    const canvasX = imageX * scale.value + offsetX.value
    const canvasY = imageY * scale.value + offsetY.value
    return { x: canvasX, y: canvasY }
  }
  
  // Check if a point is within a POI
  const isPOIHit = (poi, imageX, imageY) => {
    // Calculate the same icon size as in drawPOI (in pixels)
    const baseSize = 24
    const minSize = 20
    const maxSize = 36
    const inverseScale = Math.max(0.8, Math.min(1.5, 1 / Math.sqrt(scale.value)))
    const iconScale = poi.iconScale || 1
    const iconSize = Math.max(minSize, Math.min(maxSize, baseSize * inverseScale * iconScale))
    
    // Convert pixel radius to image space radius
    // Since the icon is drawn in pixels but we're checking in image space,
    // we need to divide by the current scale
    let radius = (iconSize / 2) / scale.value
    
    // Make grouped POIs more forgiving for hover
    if (poi.isGrouped && poi.groupSize > 1) {
      radius = radius * 1.5 // 50% larger hit area for grouped POIs
    }
    
    const dx = imageX - poi.x
    const dy = imageY - poi.y
    return Math.sqrt(dx * dx + dy * dy) <= radius
  }
  
  // Check if a point is within a connection
  const isConnectionHit = (connection, imageX, imageY) => {
    // Make hit radius much more forgiving, especially when zoomed out
    const baseRadius = 21
    const minRadius = 28
    const scaleFactor = Math.max(1, 2 / scale.value) // More aggressive scaling for connections
    const radius = Math.max(minRadius, baseRadius * scaleFactor)
    
    const dx = imageX - connection.x
    const dy = imageY - connection.y
    return Math.sqrt(dx * dx + dy * dy) <= radius
  }
  
  // Check if a point is within a connector
  const isConnectorHit = (connector, imageX, imageY) => {
    const baseRadius = 14
    const minRadius = 18
    const scaleFactor = Math.max(1, 1.5 / scale.value)
    const radius = Math.max(minRadius, baseRadius * scaleFactor)
    
    const dx = imageX - connector.x
    const dy = imageY - connector.y
    return Math.sqrt(dx * dx + dy * dy) <= radius
  }
  
  // Get POI colors based on type
  const getPOIColors = (type) => {
    switch (type) {
      case 'landmark':
        return { primary: '#ffa500', secondary: '#ff8c00', icon: '🏛️' }
      case 'quest':
        return { primary: '#ffd700', secondary: '#ffb347', icon: '❗' }
      case 'merchant':
        return { primary: '#32cd32', secondary: '#228b22', icon: '💰' }
      case 'npc':
        return { primary: '#9370db', secondary: '#7b68ee', icon: '💀' }
      case 'dungeon':
        return { primary: '#dc143c', secondary: '#8b0000', icon: '⚔️' }
      default:
        return { primary: '#87ceeb', secondary: '#4682b4', icon: '📍' }
    }
  }

  // Draw POI on canvas
  const drawPOI = (ctx, poi, isDragging = false) => {
    const canvasPos = imageToCanvas(poi.x, poi.y)
    const isHovered = hoveredPOI.value?.id === poi.id
    
    // Calculate icon size - moderate scaling when zoomed out
    const baseSize = 24
    const minSize = 20
    const maxSize = 36
    // More subtle inverse relationship with zoom
    const inverseScale = Math.max(0.8, Math.min(1.5, 1 / Math.sqrt(scale.value)))
    const iconScale = poi.iconScale || 1
    const iconSize = Math.max(minSize, Math.min(maxSize, baseSize * inverseScale * iconScale))
    
    const colors = getPOIColors(poi.type)
    // Use custom icon if available, otherwise use the type-based icon
    const displayIcon = poi.custom_icon || poi.icon || colors.icon
    
    ctx.save()
    ctx.translate(canvasPos.x, canvasPos.y)
    
    // Apply dragging effect
    if (isDragging) {
      ctx.globalAlpha = 0.7
      ctx.scale(1.1, 1.1)
    }
    
    // Glow effect removed per user request
    
    // Draw icon with outline for visibility
    ctx.font = `bold ${iconSize}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    
    // Drop shadow for depth
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)'
    ctx.shadowBlur = 8
    ctx.shadowOffsetX = 2
    ctx.shadowOffsetY = 2
    
    // Black outline for better visibility
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)'
    ctx.lineWidth = 5
    ctx.strokeText(displayIcon, 0, 0)
    
    // Reset shadow for next strokes
    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 0
    
    // White outline
    ctx.strokeStyle = 'rgba(255, 255, 255, 1)'
    ctx.lineWidth = 2.5
    ctx.strokeText(displayIcon, 0, 0)
    
    // Icon itself
    ctx.fillStyle = isHovered ? colors.secondary : colors.primary
    ctx.fillText(displayIcon, 0, 0)
    
    // Draw group indicator if this is a grouped POI
    if (poi.isGrouped && poi.groupSize > 1) {
      // Optional: Show hover area for debugging (uncomment to see the expanded hit area)
      // if (isHovered) {
      //   const hitRadius = iconSize / 2 * 1.5 // Same calculation as isPOIHit
      //   ctx.beginPath()
      //   ctx.arc(0, 0, hitRadius, 0, Math.PI * 2)
      //   ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'
      //   ctx.lineWidth = 1
      //   ctx.stroke()
      // }
      
      // Draw a small badge indicating the group
      const badgeSize = Math.max(14, Math.min(20, iconSize * 0.4))
      const badgeX = iconSize * 0.5
      const badgeY = -iconSize * 0.5
      
      // Badge background
      ctx.beginPath()
      ctx.arc(badgeX, badgeY, badgeSize, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'
      ctx.fill()
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 2
      ctx.stroke()
      
      // Badge text (number of POIs in group)
      ctx.font = `bold ${badgeSize * 1.2}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = '#fff'
      ctx.fillText(poi.groupSize.toString(), badgeX, badgeY)
    }
    
    // Draw connector mode indicator on POI hover
    if (isHovered && scale.value && offsetX.value !== undefined) {
      // Check if we're in connector mode (this would need to be passed in)
      // For now, we'll always show the name tooltip
    }
    
    // Draw name tooltip on hover
    if (isHovered && (poi.name || poi.groupedPOIs)) {
      const fontSize = Math.max(14, Math.min(18, 16 * Math.sqrt(scale.value)))
      ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif`
      
      let tooltipContent = []
      let maxWidth = 0
      
      if (poi.groupedPOIs && poi.groupedPOIs.length > 1) {
        // For grouped POIs, show all POI names with their icons
        poi.groupedPOIs.forEach(p => {
          const pColors = getPOIColors(p.type)
          const pIcon = p.custom_icon || p.icon || pColors.icon
          const text = `${pIcon} ${p.name}`
          const metrics = ctx.measureText(text)
          maxWidth = Math.max(maxWidth, metrics.width)
          tooltipContent.push({ text, icon: pIcon, name: p.name })
        })
      } else {
        // Single POI tooltip
        const text = poi.name
        const metrics = ctx.measureText(text)
        maxWidth = metrics.width
        tooltipContent.push({ text, icon: null, name: text })
      }
      
      const padding = 8
      const lineHeight = fontSize * 1.4
      const tooltipY = -(iconSize + 10)
      const tooltipHeight = (tooltipContent.length * lineHeight) + padding * 2
      const tooltipWidth = maxWidth + padding * 2
      
      // Draw tooltip background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.9)'
      const borderRadius = 6
      
      // Create rounded rectangle path
      ctx.beginPath()
      ctx.moveTo(-tooltipWidth/2 + borderRadius, tooltipY - tooltipHeight)
      ctx.lineTo(tooltipWidth/2 - borderRadius, tooltipY - tooltipHeight)
      ctx.quadraticCurveTo(tooltipWidth/2, tooltipY - tooltipHeight, tooltipWidth/2, tooltipY - tooltipHeight + borderRadius)
      ctx.lineTo(tooltipWidth/2, tooltipY - borderRadius)
      ctx.quadraticCurveTo(tooltipWidth/2, tooltipY, tooltipWidth/2 - borderRadius, tooltipY)
      ctx.lineTo(-tooltipWidth/2 + borderRadius, tooltipY)
      ctx.quadraticCurveTo(-tooltipWidth/2, tooltipY, -tooltipWidth/2, tooltipY - borderRadius)
      ctx.lineTo(-tooltipWidth/2, tooltipY - tooltipHeight + borderRadius)
      ctx.quadraticCurveTo(-tooltipWidth/2, tooltipY - tooltipHeight, -tooltipWidth/2 + borderRadius, tooltipY - tooltipHeight)
      ctx.closePath()
      ctx.fill()
      
      // Draw small triangle pointing down
      ctx.beginPath()
      ctx.moveTo(-5, tooltipY)
      ctx.lineTo(5, tooltipY)
      ctx.lineTo(0, tooltipY + 5)
      ctx.closePath()
      ctx.fill()
      
      // Draw border
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'
      ctx.lineWidth = 1
      ctx.stroke()
      
      // Draw text content
      ctx.fillStyle = '#fff'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      
      tooltipContent.forEach((item, index) => {
        const y = tooltipY - tooltipHeight + padding + (index + 0.5) * lineHeight
        ctx.fillText(item.text, 0, y)
      })
    }
    
    ctx.restore()
  }
  
  // Draw connection on canvas
  const drawConnection = (ctx, connection, isDragging = false) => {
    const canvasPos = imageToCanvas(connection.x, connection.y)
    const isHovered = hoveredConnection.value?.id === connection.id
    
    // Calculate size with minimum visibility threshold
    const baseSize = 21
    const minSize = 14
    const maxSize = 28
    // Use square root of scale for more gradual scaling
    const scaleFactor = Math.sqrt(scale.value)
    const size = Math.max(minSize, Math.min(maxSize, baseSize * scaleFactor))
    const glowSize = size * (isHovered ? 1.6 : 1.4)
    
    ctx.save()
    ctx.translate(canvasPos.x, canvasPos.y)
    
    // Apply dragging effect
    if (isDragging) {
      ctx.globalAlpha = 0.7
      ctx.scale(1.1, 1.1)
    }
    
    // Debug: Show hit area when hovering (optional - uncomment for debugging)
    // if (isHovered) {
    //   const hitRadius = Math.max(40, 30 * Math.max(1, 2 / scale.value)) * scale.value
    //   ctx.beginPath()
    //   ctx.arc(0, 0, hitRadius, 0, Math.PI * 2)
    //   ctx.fillStyle = 'rgba(255, 255, 255, 0.05)'
    //   ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
    //   ctx.lineWidth = 1
    //   ctx.fill()
    //   ctx.stroke()
    // }
    
    // Check if connection has a custom icon
    if (connection.customIcon) {
      // Draw custom icon instead of portal
      const iconSize = size * 1.8
      
      // Glow effect
      const glowGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, glowSize)
      glowGradient.addColorStop(0, `rgba(147, 112, 219, ${isHovered ? 0.6 : 0.4})`)
      glowGradient.addColorStop(0.5, `rgba(138, 43, 226, ${isHovered ? 0.3 : 0.2})`)
      glowGradient.addColorStop(1, 'rgba(138, 43, 226, 0)')
      
      ctx.beginPath()
      ctx.arc(0, 0, glowSize, 0, Math.PI * 2)
      ctx.fillStyle = glowGradient
      ctx.fill()
      
      // Draw icon with outline for visibility
      ctx.font = `bold ${iconSize}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      
      // Drop shadow for depth
      ctx.shadowColor = 'rgba(0, 0, 0, 0.6)'
      ctx.shadowBlur = 8
      ctx.shadowOffsetX = 2
      ctx.shadowOffsetY = 2
      
      // Black outline for better visibility
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)'
      ctx.lineWidth = 5
      ctx.strokeText(connection.customIcon, 0, 0)
      
      // Reset shadow
      ctx.shadowColor = 'transparent'
      ctx.shadowBlur = 0
      ctx.shadowOffsetX = 0
      ctx.shadowOffsetY = 0
      
      // White outline
      ctx.strokeStyle = 'rgba(255, 255, 255, 1)'
      ctx.lineWidth = 2.5
      ctx.strokeText(connection.customIcon, 0, 0)
      
      // Icon itself with purple tint
      ctx.fillStyle = isHovered ? '#b794f6' : '#9f7aea'
      ctx.fillText(connection.customIcon, 0, 0)
    } else {
      // Default portal drawing
      // Animated glow effect
      const time = Date.now() / 1000
      const glowIntensity = 0.6 + Math.sin(time * 2) * 0.4
      
      // Outer glow
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, glowSize)
      gradient.addColorStop(0, `rgba(147, 112, 219, ${glowIntensity})`)
      gradient.addColorStop(0.5, `rgba(138, 43, 226, ${glowIntensity * 0.5})`)
      gradient.addColorStop(1, 'rgba(138, 43, 226, 0)')
      
      ctx.beginPath()
      ctx.arc(0, 0, glowSize, 0, Math.PI * 2)
      ctx.fillStyle = gradient
      ctx.fill()
      
      // Main portal circle with gradient
      const portalGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, size)
      portalGradient.addColorStop(0, isHovered ? '#b794f6' : '#9f7aea')
      portalGradient.addColorStop(0.7, isHovered ? '#8b5cf6' : '#7c3aed')
      portalGradient.addColorStop(1, '#6b21a8')
      
      ctx.beginPath()
      ctx.arc(0, 0, size, 0, Math.PI * 2)
      ctx.fillStyle = portalGradient
      ctx.fill()
      
      // White border
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = Math.max(2, 3 * scaleFactor)
      ctx.stroke()
      
      // Inner swirl pattern
      ctx.beginPath()
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)'
      ctx.lineWidth = Math.max(1.5, 2 * scaleFactor)
      ctx.lineCap = 'round'
      
      // Create spiral effect
      for (let i = 0; i < 3; i++) {
        const offset = (i * 120 + time * 50) % 360
        const startAngle = (offset * Math.PI) / 180
        const endAngle = startAngle + Math.PI / 2
        const radius = size * 0.6
        
        ctx.beginPath()
        ctx.arc(0, 0, radius, startAngle, endAngle)
        ctx.stroke()
      }
      
      // Center dot
      ctx.beginPath()
      ctx.arc(0, 0, size * 0.15, 0, Math.PI * 2)
      ctx.fillStyle = '#fff'
      ctx.fill()
    }
    
    // Always show label (not just on hover)
    if (connection.label) {
      // Label background
      const labelScale = connection.labelScale || 1
      const fontSize = Math.max(12, Math.min(16, 14 * scaleFactor * labelScale))
      ctx.font = `bold ${fontSize}px sans-serif`
      const textWidth = ctx.measureText(connection.label).width
      const padding = 6
      
      // Calculate label position based on labelPosition property
      const position = connection.labelPosition || 'bottom'
      let labelX = 0
      let labelY = 0
      
      switch (position) {
        case 'top':
          labelY = -(size + 20)
          break
        case 'bottom':
          labelY = size + 20
          break
        case 'left':
          labelX = -(size + 10)
          break
        case 'right':
          labelX = size + 10
          break
      }
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'
      let boxX, boxY
      const boxWidth = textWidth + padding * 2
      const boxHeight = fontSize * 1.4
      const borderRadius = 4
      
      // Adjust box position based on label position
      if (position === 'left') {
        boxX = labelX - textWidth - padding * 2
        boxY = labelY - fontSize * 0.7
      } else if (position === 'right') {
        boxX = labelX
        boxY = labelY - fontSize * 0.7
      } else {
        boxX = labelX - textWidth / 2 - padding
        boxY = labelY - fontSize * 0.8
      }
      
      // Draw rounded rectangle manually
      ctx.beginPath()
      ctx.moveTo(boxX + borderRadius, boxY)
      ctx.lineTo(boxX + boxWidth - borderRadius, boxY)
      ctx.quadraticCurveTo(boxX + boxWidth, boxY, boxX + boxWidth, boxY + borderRadius)
      ctx.lineTo(boxX + boxWidth, boxY + boxHeight - borderRadius)
      ctx.quadraticCurveTo(boxX + boxWidth, boxY + boxHeight, boxX + boxWidth - borderRadius, boxY + boxHeight)
      ctx.lineTo(boxX + borderRadius, boxY + boxHeight)
      ctx.quadraticCurveTo(boxX, boxY + boxHeight, boxX, boxY + boxHeight - borderRadius)
      ctx.lineTo(boxX, boxY + borderRadius)
      ctx.quadraticCurveTo(boxX, boxY, boxX + borderRadius, boxY)
      ctx.closePath()
      ctx.fill()
      
      // Label text
      ctx.fillStyle = '#fff'
      // Adjust text alignment based on position
      if (position === 'left') {
        ctx.textAlign = 'right'
        ctx.textBaseline = 'middle'
        ctx.fillText(connection.label, labelX - padding, labelY)
      } else if (position === 'right') {
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillText(connection.label, labelX + padding, labelY)
      } else {
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(connection.label, labelX, labelY)
      }
    }
    
    ctx.restore()
  }
  
  // Draw connector on canvas
  const drawConnector = (ctx, connector, isDragging = false) => {
    const canvasPos = imageToCanvas(connector.x, connector.y)
    const isHovered = hoveredConnector.value?.id === connector.id
    
    // If showIcon is false, we still need to draw the label if it's visible
    if (connector.showIcon === false) {
      ctx.save()
      ctx.translate(canvasPos.x, canvasPos.y)
      
      // Only show a subtle indicator on hover
      if (isHovered) {
        const glowGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 20)
        const color = connector.color || '#4ecdc4'
        const r = parseInt(color.slice(1, 3), 16)
        const g = parseInt(color.slice(3, 5), 16)
        const b = parseInt(color.slice(5, 7), 16)
        
        glowGradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.4)`)
        glowGradient.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, 0.2)`)
        glowGradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`)
        
        ctx.beginPath()
        ctx.arc(0, 0, 20, 0, Math.PI * 2)
        ctx.fillStyle = glowGradient
        ctx.fill()
      }
      
      // Draw label even when icon is invisible (unless label is also invisible)
      if (connector.label && !connector.invisible && !connector.snapToPOI) {
        const scaleFactor = Math.sqrt(scale.value)
        const labelScale = connector.labelScale || 1
        const fontSize = Math.max(26, Math.min(36, 31 * scaleFactor * labelScale))
        ctx.font = `900 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif`
        
        // Calculate label position based on labelPosition property
        // Force center position when icon is invisible
        const position = 'center'
        let labelX = 0
        let labelY = 0
        const offset = 30 // Distance from center for positioned labels
        
        switch (position) {
          case 'top':
            labelY = -offset
            break
          case 'bottom':
            labelY = offset
            break
          case 'left':
            labelX = -offset
            break
          case 'right':
            labelX = offset
            break
          case 'center':
          default:
            // Keep at center
            break
        }
        
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        
        // Draw thick black shadow for strong contrast
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.95)'
        ctx.lineWidth = 8
        ctx.lineJoin = 'round'
        ctx.lineCap = 'round'
        ctx.strokeText(connector.label, labelX, labelY)
        
        // Draw dark gray outline instead of white
        ctx.strokeStyle = 'rgba(40, 40, 40, 0.8)'
        ctx.lineWidth = 5
        ctx.strokeText(connector.label, labelX, labelY)
        
        // Draw the label in bright white for maximum contrast
        ctx.fillStyle = '#ffffff'
        ctx.fillText(connector.label, labelX, labelY)
      }
      
      ctx.restore()
      return
    }
    
    // Calculate size for visible connectors
    const baseSize = 14
    const minSize = 11
    const maxSize = 20
    const scaleFactor = Math.sqrt(scale.value)
    const iconScale = connector.iconScale || 1
    const size = Math.max(minSize, Math.min(maxSize, baseSize * scaleFactor * iconScale))
    
    ctx.save()
    ctx.translate(canvasPos.x, canvasPos.y)
    
    // Apply dragging effect
    if (isDragging) {
      ctx.globalAlpha = 0.7
      ctx.scale(1.1, 1.1)
    }
    
    // Check if connector has a custom icon
    if (connector.customIcon) {
      // Draw custom icon without background
      const iconSize = size * 2.2
      
      // Draw icon with subtle outline for visibility
      ctx.font = `${iconSize}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      
      // Very subtle shadow for depth
      ctx.shadowColor = 'rgba(0, 0, 0, 0.3)'
      ctx.shadowBlur = 4
      ctx.shadowOffsetX = 1
      ctx.shadowOffsetY = 1
      
      // Thin black outline for contrast
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)'
      ctx.lineWidth = 2
      ctx.strokeText(connector.customIcon, 0, 0)
      
      // Reset shadow
      ctx.shadowColor = 'transparent'
      ctx.shadowBlur = 0
      ctx.shadowOffsetX = 0
      ctx.shadowOffsetY = 0
      
      // Draw the icon
      ctx.fillStyle = isHovered ? '#666' : '#888'
      ctx.fillText(connector.customIcon, 0, 0)
    } else {
      // Default link icon drawing
      // Draw background for better visibility
      ctx.beginPath()
      ctx.arc(0, 0, size * 0.9, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
      ctx.fill()
      
      // Draw link icon using two interlocking circles
      const linkRadius = size * 0.4
      const offset = linkRadius * 0.5
      
      // Draw black outline first for contrast
      ctx.strokeStyle = '#000'
      ctx.lineWidth = Math.max(5, 6 * scaleFactor)
      ctx.lineCap = 'round'
      
      // First circle outline
      ctx.beginPath()
      ctx.arc(-offset, 0, linkRadius, 0, Math.PI * 2)
      ctx.stroke()
      
      // Second circle outline
      ctx.beginPath()
      ctx.arc(offset, 0, linkRadius, 0, Math.PI * 2)
      ctx.stroke()
      
      // Draw white link icon on top
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = Math.max(3, 3.5 * scaleFactor)
      
      // First circle of the link
      ctx.beginPath()
      ctx.arc(-offset, 0, linkRadius, 0, Math.PI * 2)
      ctx.stroke()
      
      // Second circle of the link (slightly overlapping)
      ctx.beginPath()
      ctx.arc(offset, 0, linkRadius, 0, Math.PI * 2)
      ctx.stroke()
    }
    
    // Draw label with connector's color (unless it's invisible or snapped to POI)
    if (connector.label && !connector.invisible && !connector.snapToPOI) {
      const labelScale = connector.labelScale || 1
      const fontSize = Math.max(26, Math.min(36, 31 * scaleFactor * labelScale))
      ctx.font = `900 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif`
      
      // Calculate label position based on labelPosition property
      // If icon is invisible, center the label regardless of labelPosition setting
      const position = (connector.showIcon === false || !connector.iconVisible) 
        ? 'center' 
        : (connector.labelPosition || 'bottom')
      let labelX = 0
      let labelY = 0
      
      switch (position) {
        case 'top':
          labelY = -(size + 10)
          break
        case 'bottom':
          labelY = size + 10
          break
        case 'left':
          labelX = -(size + 8)
          break
        case 'right':
          labelX = size + 8
          break
        case 'center':
          // Label stays at 0,0
          break
      }
      
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      
      // Draw thick black shadow for strong contrast
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.95)'
      ctx.lineWidth = 8
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      ctx.strokeText(connector.label, labelX, labelY)
      
      // Draw dark gray outline instead of white
      ctx.strokeStyle = 'rgba(40, 40, 40, 0.8)'
      ctx.lineWidth = 5
      ctx.strokeText(connector.label, labelX, labelY)
      
      // Draw the label in bright white for maximum contrast
      ctx.fillStyle = '#ffffff'
      ctx.fillText(connector.label, labelX, labelY)
    }
    
    // Hover glow effect
    if (isHovered) {
      const glowGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 1.8)
      const color = connector.color || '#4ecdc4'
      
      // Convert hex to rgba for transparency
      const r = parseInt(color.slice(1, 3), 16)
      const g = parseInt(color.slice(3, 5), 16) 
      const b = parseInt(color.slice(5, 7), 16)
      
      glowGradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0)`)
      glowGradient.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, 0.3)`)
      glowGradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`)
      
      ctx.beginPath()
      ctx.arc(0, 0, size * 1.8, 0, Math.PI * 2)
      ctx.fillStyle = glowGradient
      ctx.fill()
    }
    
    ctx.restore()
  }
  
  return {
    hoveredPOI,
    hoveredConnection,
    hoveredConnector,
    canvasToImage,
    imageToCanvas,
    isPOIHit,
    isConnectionHit,
    isConnectorHit,
    drawPOI,
    drawConnection,
    drawConnector
  }
}