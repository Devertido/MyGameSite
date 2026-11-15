import { useLayoutEffect, useRef, type ReactNode } from 'react'

export function CreationDialog({ onCancel, children, titleId = 'creation-dialog-title' }: {
  titleId?: string
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
    <dialog ref={dialogRef} className="creation-dialog" aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        onCancel()
      }}>
      {children}
    </dialog>
  )
}
