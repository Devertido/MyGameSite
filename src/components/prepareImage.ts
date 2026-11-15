import { t } from '../i18n.ts'
export async function prepareImage(file: File): Promise<string> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) {
    throw new Error(t('Выберите PNG, JPEG или WebP размером до 10 МБ.'))
  }
  const bitmap = await createImageBitmap(file)
  try {
    const scale = Math.min(1, 384 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error(t('Не удалось обработать изображение.'))
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/webp', 0.82)
  } finally {
    bitmap.close()
  }
}
