import { t } from '../i18n.ts'
export async function prepareImage(file: File, largeIllustration = false): Promise<string> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) {
    throw new Error(t('Выберите PNG, JPEG или WebP размером до 10 МБ.'))
  }
  const bitmap = await createImageBitmap(file)
  try {
    const limit = largeIllustration ? 1280 : 384
    const scale = Math.min(1, limit / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error(t('Не удалось обработать изображение.'))
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    if (!largeIllustration) return canvas.toDataURL('image/webp', 0.82)
    for (const quality of [0.9, 0.82, 0.72, 0.6]) {
      const image = canvas.toDataURL('image/webp', quality)
      if (image.length <= 450_000) return image
    }
    throw new Error(t('Изображение слишком большое после сжатия. Выберите файл меньшего размера.'))
  } finally {
    bitmap.close()
  }
}
