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

  // Draw POI tooltip separately (to be called after all POIs are drawn)
  const drawPOITooltip = (ctx, poi) => {
    const canvasPos = imageToCanvas(poi.x, poi.y)
    const isHovered = hoveredPOI.value?.id === poi.id
    
    if (!isHovered || (!poi.name && !poi.groupedPOIs)) return
    
    ctx.save()
    ctx.translate(canvasPos.x, canvasPos.y)
    
    const fontSize = Math.max(14, Math.min(18, 16 * Math.sqrt(scale.value)))
    ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif`
    
    let tooltipContent = []
    let maxWidth = 0
    
    if (poi.groupedPOIs && poi.groupedPOIs.length > 1) {
      // For grouped POIs, show all POI names with their icons
      poi.groupedPOIs.forEach(p => {
        const pColors = getPOIColors(p.type)
        const pIcon = p.icon || pColors.icon
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
    const iconSize = 24 // Base icon size
    const tooltipY = -(iconSize + 10)
    const tooltipHeight = (tooltipContent.length * lineHeight) + padding * 2
    const tooltipWidth = maxWidth + padding * 2
    
    // Draw tooltip background with higher opacity for better visibility
    ctx.fillStyle = 'rgba(0, 0, 0, 0.95)'
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
    
    // Draw border with stronger visibility
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'
    ctx.lineWidth = 1.5
    ctx.stroke()
    
    // Draw text content
    ctx.fillStyle = '#fff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    
    tooltipContent.forEach((item, index) => {
      const y = tooltipY - tooltipHeight + padding + (index + 0.5) * lineHeight
      ctx.fillText(item.text, 0, y)
    })
    
    ctx.restore()
  }

  // Cache for loaded icon images
  const iconImageCache = new Map()
  
  // Helper function to adjust color brightness
  const adjustColorBrightness = (hex, percent) => {
    // Remove # if present
    hex = hex.replace('#', '')
    
    // Convert to RGB
    const r = parseInt(hex.substr(0, 2), 16)
    const g = parseInt(hex.substr(2, 2), 16)
    const b = parseInt(hex.substr(4, 2), 16)
    
    // Adjust brightness
    const adjust = (color) => {
      const adjusted = Math.round(color * (100 + percent) / 100)
      return Math.max(0, Math.min(255, adjusted))
    }
    
    // Convert back to hex
    const toHex = (n) => n.toString(16).padStart(2, '0')
    return '#' + toHex(adjust(r)) + toHex(adjust(g)) + toHex(adjust(b))
  }
  
  // Helper function to draw emoji icons
  const drawEmojiIcon = (ctx, displayIcon, iconSize, isHovered, isCustom, colors) => {
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
    // For custom POIs, use a consistent color that's always visible
    if (isCustom) {
      ctx.fillStyle = isHovered ? '#666666' : '#000000'
    } else {
      ctx.fillStyle = isHovered ? colors.secondary : colors.primary
    }
    ctx.fillText(displayIcon, 0, 0)
  }
  
  // Load an icon image (Iconify, FontAwesome, or uploaded)
  const loadIconImage = async (iconType, iconValue) => {
    const cacheKey = `${iconType}:${iconValue}`
    
    // Check cache first
    if (iconImageCache.has(cacheKey)) {
      return iconImageCache.get(cacheKey)
    }
    
    try {
      let imageUrl
      
      if (iconType === 'iconify' || iconType === 'fontawesome') {
        // Use Iconify API to get SVG with original colors
        const iconName = iconValue
        let apiUrl
        
        // Build API URL - never specify color to preserve original colors
        apiUrl = `https://api.iconify.design/${iconName}.svg?width=64&height=64`
        
        const response = await fetch(apiUrl)
        if (!response.ok) {
          console.error(`Failed to fetch icon ${iconName}: ${response.status} ${response.statusText}`)
          throw new Error('Failed to fetch icon')
        }
        
        let svgText = await response.text()
        
        // Only colorize monochrome icons (like game-icons)
        // Skip colorization for emoji-style icons (twemoji, noto, openmoji)
        const isEmojiStyle = iconName.startsWith('twemoji:') || 
                           iconName.startsWith('noto:') || 
                           iconName.startsWith('openmoji:') ||
                           iconName.startsWith('emojione:')
        
        if (!isEmojiStyle && iconName.startsWith('game-icons:')) {
          // Check if the SVG has no fill colors (is monochrome)
          if (!svgText.includes('fill=') || svgText.includes('fill="currentColor"')) {
            // Add vibrant, high-contrast colors based on icon type
            const iconColors = {
              // Wood/Lumberjack - Rich brown with orange tint
              'axe': '#D2691E',
              'wood': '#A0522D',
              'hatchet': '#8B4513',
              'tree': '#228B22',
              
              // Fishing - Bright blue/cyan
              'fishing': '#00CED1',
              'fish': '#1E90FF',
              'hook': '#4169E1',
              'pole': '#00BFFF',
              
              // Blacksmith - Bright orange/red for hot metal
              'anvil': '#FF4500',
              'hammer': '#FF6347',
              'forge': '#DC143C',
              'blacksmith': '#FF8C00',
              'metal': '#B22222',
              
              // Tailoring - Rich purple/pink
              'spool': '#DA70D6',
              'yarn': '#9932CC',
              'needle': '#FF1493',
              'thread': '#C71585',
              'sewing': '#8B008B',
              
              // Smelting - Glowing orange/yellow
              'molten': '#FFA500',
              'ore': '#DAA520',
              'ingot': '#FFD700',
              'smelt': '#FF8C00',
              'flamer': '#FF4500',
              
              // Quest/NPC - Bright green
              'conversation': '#00FF00',
              'talk': '#32CD32',
              'chat': '#00FA9A',
              'bubble': '#00FF7F',
              'person': '#3CB371',
              'quest': '#FFFF00',
              'exclamation': '#FFD700',
              
              // Additional common types
              'sword': '#C0C0C0',
              'shield': '#4682B4',
              'potion': '#9400D3',
              'treasure': '#FFD700',
              'castle': '#8B7355',
              'dragon': '#DC143C',
              'merchant': '#FFD700',
              'death': '#8B0000',
              'skull': '#DDA0DD',
              'dungeon': '#4B0082',
              'cave': '#696969',
              'crystal': '#00FFFF',
              'magic': '#FF00FF',
              'spell': '#9932CC'
            }
            
            // Find which color to use based on icon name
            let color = '#FFD700' // Default gold
            for (const [key, col] of Object.entries(iconColors)) {
              if (iconName.toLowerCase().includes(key)) {
                color = col
                break
              }
            }
            
            // Replace currentColor or add fill to paths and shapes
            svgText = svgText.replace(/fill="currentColor"/g, `fill="${color}"`)
            svgText = svgText.replace(/fill="#[0-9a-fA-F]{6}"/g, `fill="${color}"`)
            svgText = svgText.replace(/fill="rgb[^"]*"/g, `fill="${color}"`)
            
            // Add fill to paths, circles, rects, polygons without fill
            svgText = svgText.replace(/<path(?![^>]*fill)/g, `<path fill="${color}"`)
            svgText = svgText.replace(/<circle(?![^>]*fill)/g, `<circle fill="${color}"`)
            svgText = svgText.replace(/<rect(?![^>]*fill)/g, `<rect fill="${color}"`)
            svgText = svgText.replace(/<polygon(?![^>]*fill)/g, `<polygon fill="${color}"`)
            
            // Also add stroke for better definition
            const strokeColor = adjustColorBrightness(color, -30) // Darker stroke
            svgText = svgText.replace(/<svg/g, `<svg style="filter: drop-shadow(1px 1px 2px rgba(0,0,0,0.7))"`)
          }
        }
        
        // Convert SVG to data URL
        const blob = new Blob([svgText], { type: 'image/svg+xml' })
        imageUrl = URL.createObjectURL(blob)
      } else if (iconType === 'upload') {
        imageUrl = iconValue
      }
      
      // Load image
      const img = new Image()
      img.crossOrigin = 'anonymous'
      
      return new Promise((resolve, reject) => {
        img.onload = () => {
          iconImageCache.set(cacheKey, img)
          if (imageUrl.startsWith('blob:')) {
            URL.revokeObjectURL(imageUrl)
          }
          resolve(img)
        }
        img.onerror = () => {
          console.error(`Failed to load icon: ${cacheKey}`)
          reject(new Error('Failed to load icon'))
        }
        img.src = imageUrl
      })
    } catch (error) {
      console.error(`Error loading icon ${cacheKey}:`, error)
      return null
    }
  }
  
  // Draw POI on canvas
  const drawPOI = (ctx, poi, isDragging = false, showLabels = true, proposalsVisible = true) => {
    const canvasPos = imageToCanvas(poi.x, poi.y)
    const isHovered = hoveredPOI.value?.id === poi.id
    
    // Early return if POI is off-screen
    const canvasWidth = ctx.canvas.width
    const canvasHeight = ctx.canvas.height
    const buffer = 100 // Buffer to draw POIs slightly off-screen
    
    if (canvasPos.x < -buffer || canvasPos.x > canvasWidth + buffer || 
        canvasPos.y < -buffer || canvasPos.y > canvasHeight + buffer) {
      return // Skip drawing if POI is way off-screen
    }
    
    
    // Calculate icon size - moderate scaling when zoomed out
    // All POIs use consistent sizing
    const baseSize = poi.icon_size || 48
    const minSize = 20
    const maxSize = 48
    // More subtle inverse relationship with zoom
    const inverseScale = Math.max(0.8, Math.min(1.5, 1 / Math.sqrt(scale.value)))
    const iconScale = poi.iconScale || 1
    let iconSize = Math.max(minSize, Math.min(maxSize, baseSize * inverseScale * iconScale))
    
    
    const colors = getPOIColors(poi.type)
    
    ctx.save()
    ctx.translate(canvasPos.x, canvasPos.y)
    
    // Apply dragging effect
    if (isDragging) {
      ctx.globalAlpha = 0.7
      ctx.scale(1.1, 1.1)
    }
    
    // Draw proposal indicator for proposed POIs
    if (poi.is_proposal) {
      // Draw a blue pulsing glow for proposals
      const pulseTime = Date.now() / 1000
      const pulseIntensity = 0.5 + Math.sin(pulseTime * 3) * 0.3  // Pulsing between 0.2 and 0.8 opacity
      
      ctx.save()
      
      // Create circular glow around the icon
      const glowRadius = iconSize * 0.8
      
      // Draw the glow using radial gradient
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, glowRadius)
      gradient.addColorStop(0, `rgba(30, 144, 255, ${pulseIntensity})`)
      gradient.addColorStop(0.5, `rgba(30, 144, 255, ${pulseIntensity * 0.6})`)
      gradient.addColorStop(1, 'rgba(30, 144, 255, 0)')
      
      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.arc(0, 0, glowRadius, 0, Math.PI * 2)
      ctx.fill()
      
      // Draw dashed ring for proposals
      ctx.strokeStyle = `rgba(30, 144, 255, ${0.5 + pulseIntensity * 0.3})`
      ctx.lineWidth = 2
      ctx.setLineDash([5, 5])
      ctx.beginPath()
      ctx.arc(0, 0, iconSize / 2 + 5, 0, Math.PI * 2)
      ctx.stroke()
      ctx.setLineDash([])
      
      ctx.restore()
      
      // Make the icon slightly transparent for proposals
      ctx.globalAlpha = 0.8
    }
    
    // Draw pending proposal indicator (for existing POIs with proposals)
    // Only show if proposals are visible in the filter
    if (proposalsVisible && (poi.has_pending_proposal || poi.has_move_proposal || poi.has_edit_proposal || poi.has_deletion_proposal || poi.has_loot_proposal || poi.has_npc_proposal)) {
      // Draw a blue pulsing glow for all proposals (same as new proposals)
      const pulseTime = Date.now() / 1000
      const pulseIntensity = 0.5 + Math.sin(pulseTime * 3) * 0.3  // Pulsing between 0.2 and 0.8 opacity
      
      ctx.save()
      
      // Create circular glow around the icon
      const glowRadius = iconSize * 0.8
      
      // Draw the glow using radial gradient
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, glowRadius)
      gradient.addColorStop(0, `rgba(30, 144, 255, ${pulseIntensity})`)
      gradient.addColorStop(0.5, `rgba(30, 144, 255, ${pulseIntensity * 0.6})`)
      gradient.addColorStop(1, 'rgba(30, 144, 255, 0)')
      
      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.arc(0, 0, glowRadius, 0, Math.PI * 2)
      ctx.fill()
      
      // Draw dashed ring for proposals
      ctx.strokeStyle = `rgba(30, 144, 255, ${0.5 + pulseIntensity * 0.3})`
      ctx.lineWidth = 2
      ctx.setLineDash([5, 5])
      ctx.beginPath()
      ctx.arc(0, 0, iconSize / 2 + 5, 0, Math.PI * 2)
      ctx.stroke()
      ctx.setLineDash([])
      
      
      ctx.restore()
    }
    
    // Draw shared POI indicator
    if (poi.is_custom && poi.is_shared_active) {
      // Draw a purple/violet pulsing glow for shared POIs
      const pulseTime = Date.now() / 1000
      const pulseIntensity = 0.4 + Math.sin(pulseTime * 2.5) * 0.2  // Gentler pulsing between 0.2 and 0.6 opacity
      
      ctx.save()
      
      // Create circular glow around the icon
      const glowRadius = iconSize * 0.7
      
      // Draw the glow using radial gradient with purple/violet color
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, glowRadius)
      gradient.addColorStop(0, `rgba(147, 112, 219, ${pulseIntensity})`)  // Medium purple
      gradient.addColorStop(0.5, `rgba(147, 112, 219, ${pulseIntensity * 0.6})`)
      gradient.addColorStop(1, 'rgba(147, 112, 219, 0)')
      
      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.arc(0, 0, glowRadius, 0, Math.PI * 2)
      ctx.fill()
      
      // Draw dotted ring for shared POIs
      ctx.strokeStyle = `rgba(147, 112, 219, ${0.4 + pulseIntensity * 0.3})`
      ctx.lineWidth = 2
      ctx.setLineDash([3, 6])  // Smaller dots for shared POIs
      ctx.beginPath()
      ctx.arc(0, 0, iconSize / 2 + 5, 0, Math.PI * 2)
      ctx.stroke()
      ctx.setLineDash([])
      
      ctx.restore()
    }
    
    // Draw deletion proposal indicator
    if (poi.has_deletion_proposal) {
      ctx.save()
      
      // Draw red X over the POI
      const crossSize = iconSize * 0.7
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)'
      ctx.lineWidth = 4
      ctx.lineCap = 'round'
      
      // Add shadow for visibility
      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)'
      ctx.shadowBlur = 4
      
      // Draw X
      ctx.beginPath()
      ctx.moveTo(-crossSize / 2, -crossSize / 2)
      ctx.lineTo(crossSize / 2, crossSize / 2)
      ctx.moveTo(crossSize / 2, -crossSize / 2)
      ctx.lineTo(-crossSize / 2, crossSize / 2)
      ctx.stroke()
      
      ctx.restore()
    }
    
    // Check if this POI has an image-based icon
    const hasImageIcon = poi.icon_type && (poi.icon_type === 'iconify' || poi.icon_type === 'fontawesome' || poi.icon_type === 'upload')
    
    if (hasImageIcon && poi.icon) {
      // Handle image-based icons (Iconify, FontAwesome, uploaded)
      const iconImage = iconImageCache.get(`${poi.icon_type}:${poi.icon}`)
      
      if (iconImage) {
        // Draw the image icon
        const drawSize = iconSize * 1.5 // Make icons appropriately sized
        
        // Drop shadow for depth and visibility
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)'
        ctx.shadowBlur = 6
        ctx.shadowOffsetX = 2
        ctx.shadowOffsetY = 2
        
        // Draw the icon image directly without background
        ctx.drawImage(iconImage, -drawSize / 2, -drawSize / 2, drawSize, drawSize)
        
        // Reset shadow
        ctx.shadowColor = 'transparent'
        ctx.shadowBlur = 0
        ctx.shadowOffsetX = 0
        ctx.shadowOffsetY = 0
        
        // Add a subtle white outline for visibility on dark backgrounds
        if (isHovered) {
          // Draw a glow effect when hovered
          ctx.shadowColor = '#FFD700'
          ctx.shadowBlur = 8
          ctx.drawImage(iconImage, -drawSize / 2, -drawSize / 2, drawSize, drawSize)
          ctx.shadowColor = 'transparent'
          ctx.shadowBlur = 0
        }
      } else {
        // Image not loaded yet, queue it for loading
        loadIconImage(poi.icon_type, poi.icon).then(img => {
          if (img) {
            // Icon is now cached, trigger a re-render
            // Force a re-render by dispatching a custom event
            if (window.requestIdleCallback) {
              window.requestIdleCallback(() => {
                window.dispatchEvent(new CustomEvent('poi-icon-loaded', { detail: { poi } }))
              })
            } else {
              // Fallback for browsers without requestIdleCallback
              setTimeout(() => {
                window.dispatchEvent(new CustomEvent('poi-icon-loaded', { detail: { poi } }))
              }, 16)
            }
          }
        })
        
        // Draw fallback emoji while loading - use a more visible icon
        const fallbackIcon = poi.icon || '❓'
        drawEmojiIcon(ctx, fallbackIcon, iconSize, isHovered, poi.is_custom, colors)
      }
    } else {
      // Handle emoji icons
      let displayIcon = poi.is_custom ? (poi.icon || '📍') : (poi.icon || colors.icon)
      
      // Ensure we always have a valid icon to display
      if (!displayIcon || displayIcon.trim() === '') {
        console.warn(`POI "${poi.name}" has no valid icon, using default`)
        displayIcon = '📍'
      }
      
      drawEmojiIcon(ctx, displayIcon, iconSize, isHovered, poi.is_custom, colors)
    }
    
    // Draw group indicator if this is a grouped POI and it should show the badge
    if (poi.isGrouped && poi.groupSize > 1 && (poi.showGroupBadge !== false)) {
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
    
    // Note: Tooltips are now drawn in a separate pass after all POIs to ensure they appear on top
    
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
      const fontSize = Math.max(8, Math.min(24, 14 * scaleFactor * labelScale))
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
        const fontSize = Math.max(10, Math.min(50, 31 * scaleFactor * labelScale))
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
      const fontSize = Math.max(10, Math.min(50, 31 * scaleFactor * labelScale))
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
    drawPOITooltip,
    drawConnection,
    drawConnector,
    loadIconImage,
    iconImageCache
  }
}