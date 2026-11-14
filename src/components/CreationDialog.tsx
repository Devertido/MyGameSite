import { useLayoutEffect, useRef, type ReactNode } from 'react'

export function CreationDialog({ onCancel, children }: {
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
    <dialog ref={dialogRef} className="creation-dialog" aria-labelledby="creation-dialog-title"
      onCancel={(event) => {
        event.preventDefault()
        onCancel()
      }}>
      {children}
    </dialog>
  )
}
