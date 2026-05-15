/**
 * compressImage
 * Resizes and compresses an image File or Blob before uploading to Supabase Storage.
 * Typical result: 3-10MB phone photo → 150-400KB (80-95% reduction in egress).
 *
 * @param source   File or Blob from an <input type="file"> or canvas.toBlob()
 * @param maxPx    Longest edge in pixels (default 1200 — good for feed photos)
 * @param quality  JPEG quality 0–1 (default 0.75)
 * @returns        Compressed Blob (image/jpeg)
 */
export async function compressImage(
  source: File | Blob,
  maxPx = 1200,
  quality = 0.75
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(source)
    const img = new Image()

    img.onload = () => {
      URL.revokeObjectURL(url)

      // Calculate new dimensions keeping aspect ratio
      let { width, height } = img
      if (width > maxPx || height > maxPx) {
        if (width >= height) {
          height = Math.round((height / width) * maxPx)
          width = maxPx
        } else {
          width = Math.round((width / height) * maxPx)
          height = maxPx
        }
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('Canvas not available')); return }

      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob(
        blob => {
          if (blob) resolve(blob)
          else reject(new Error('Compression failed'))
        },
        'image/jpeg',
        quality
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Image load failed'))
    }

    img.src = url
  })
}

/**
 * compressAvatar
 * Smaller preset for profile photos — 400px, slightly higher quality.
 */
export async function compressAvatar(source: File | Blob): Promise<Blob> {
  return compressImage(source, 400, 0.82)
}

/**
 * compressPhoto
 * Named alias for feed/post photos — same as compressImage defaults.
 */
export async function compressPhoto(source: File | Blob): Promise<Blob> {
  return compressImage(source, 1200, 0.75)
}

/**
 * compressStory
 * Portrait-optimised preset — max 1080 wide, max 1920 tall, quality 0.78.
 */
export async function compressStory(source: File | Blob): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(source)
    const img = new Image()

    img.onload = () => {
      URL.revokeObjectURL(url)

      let { width, height } = img
      const MAX_W = 1080
      const MAX_H = 1920
      if (width > MAX_W || height > MAX_H) {
        const ratio = Math.min(MAX_W / width, MAX_H / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('Canvas not available')); return }

      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob(
        blob => {
          if (blob) resolve(blob)
          else reject(new Error('Compression failed'))
        },
        'image/jpeg',
        0.78
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Image load failed'))
    }

    img.src = url
  })
}
