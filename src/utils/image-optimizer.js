let sharp;
try {
  sharp = await import('sharp');
  sharp = sharp.default;
} catch (error) {
  console.warn('Sharp not available for image optimization');
}

/**
 * Optimize image for web usage
 * @param {Buffer} inputBuffer - The input image buffer
 * @param {Object} options - Optimization options
 * @returns {Promise<{buffer: Buffer, format: string, metadata: Object}>}
 */
export async function optimizeImage(inputBuffer, options = {}) {
  const {
    maxWidth = 200,
    maxHeight = 200,
    quality = 85,
    fit = 'cover',
    position = 'center',
    preserveAnimation = true,
    outputFormat = 'auto' // 'auto', 'webp', 'jpeg', 'png', 'gif'
  } = options;

  if (!sharp) {
    // Return original if sharp is not available
    return {
      buffer: inputBuffer,
      format: 'original',
      metadata: { size: inputBuffer.length }
    };
  }

  try {
    // Get image metadata
    const metadata = await sharp(inputBuffer).metadata();
    const isAnimated = metadata.pages && metadata.pages > 1;
    
    // Handle animated images
    if (isAnimated && preserveAnimation) {
      const optimized = await sharp(inputBuffer, { animated: true })
        .resize(maxWidth, maxHeight, {
          fit,
          position,
          withoutEnlargement: true
        })
        .gif({ 
          effort: 10,
          dither: 0.0,
          colors: 128 // Reduce colors for smaller file size
        })
        .toBuffer();
      
      return {
        buffer: optimized,
        format: 'gif',
        metadata: {
          ...metadata,
          size: optimized.length,
          optimized: true
        }
      };
    }

    // For static images, determine best format
    let format = outputFormat;
    let optimizedBuffer;
    
    if (format === 'auto') {
      // Try WebP first
      const webpBuffer = await sharp(inputBuffer)
        .resize(maxWidth, maxHeight, {
          fit,
          position,
          withoutEnlargement: true
        })
        .rotate() // Auto-rotate based on EXIF
        .webp({ 
          quality,
          effort: 6,
          smartSubsample: true
        })
        .toBuffer();
      
      // If WebP is significantly smaller, use it
      if (webpBuffer.length < inputBuffer.length * 0.7) {
        optimizedBuffer = webpBuffer;
        format = 'webp';
      } else {
        // Otherwise use JPEG for photos, PNG for graphics
        if (metadata.channels === 4 || metadata.density < 300) {
          // Has alpha channel or low density - likely a graphic
          optimizedBuffer = await sharp(inputBuffer)
            .resize(maxWidth, maxHeight, {
              fit,
              position,
              withoutEnlargement: true
            })
            .rotate()
            .png({ 
              quality,
              compressionLevel: 9,
              palette: true
            })
            .toBuffer();
          format = 'png';
        } else {
          // Likely a photo - use JPEG
          optimizedBuffer = await sharp(inputBuffer)
            .resize(maxWidth, maxHeight, {
              fit,
              position,
              withoutEnlargement: true
            })
            .rotate()
            .jpeg({ 
              quality,
              progressive: true,
              mozjpeg: true,
              chromaSubsampling: '4:2:0'
            })
            .toBuffer();
          format = 'jpeg';
        }
      }
    } else {
      // Use specified format
      const sharpInstance = sharp(inputBuffer)
        .resize(maxWidth, maxHeight, {
          fit,
          position,
          withoutEnlargement: true
        })
        .rotate();
      
      switch (format) {
        case 'webp':
          optimizedBuffer = await sharpInstance.webp({ quality, effort: 6 }).toBuffer();
          break;
        case 'jpeg':
          optimizedBuffer = await sharpInstance.jpeg({ quality, progressive: true, mozjpeg: true }).toBuffer();
          break;
        case 'png':
          optimizedBuffer = await sharpInstance.png({ quality, compressionLevel: 9 }).toBuffer();
          break;
        default:
          optimizedBuffer = await sharpInstance.toBuffer();
      }
    }

    return {
      buffer: optimizedBuffer,
      format,
      metadata: {
        originalSize: inputBuffer.length,
        optimizedSize: optimizedBuffer.length,
        compressionRatio: ((1 - optimizedBuffer.length / inputBuffer.length) * 100).toFixed(1) + '%',
        width: metadata.width,
        height: metadata.height,
        format: metadata.format
      }
    };
    
  } catch (error) {
    console.error('Image optimization error:', error);
    // Return original on error
    return {
      buffer: inputBuffer,
      format: 'original',
      metadata: { 
        size: inputBuffer.length,
        error: error.message 
      }
    };
  }
}

/**
 * Get file extension for format
 */
export function getExtensionForFormat(format) {
  const formatMap = {
    'webp': 'webp',
    'jpeg': 'jpg',
    'png': 'png',
    'gif': 'gif',
    'original': 'jpg' // Default fallback
  };
  return formatMap[format] || 'jpg';
}