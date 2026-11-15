import { useLayoutEffect, useRef, type ReactNode } from 'react'

export function CreationDialog({ onCancel, children, wide = false, titleId = 'creation-dialog-title' }: {
  titleId?: string
  wide?: boolean
  onCancel: () => void
  children: ReactNode
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useLayoutEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    dialog.showModal()
    return () => dialog.close()
  }, [])

  return (
    <dialog ref={dialogRef} className={wide ? 'creation-dialog creation-dialog-wide' : 'creation-dialog'} aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        onCancel()
      }}>
      {children}
    </dialog>
  )
}
