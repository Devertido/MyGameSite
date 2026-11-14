import { useLayoutEffect, useRef, type ReactNode } from 'react'

export function CreationDialog({ active, onCancel, children }: {
  active: boolean
  onCancel: () => void
  children: ReactNode
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useLayoutEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    dialog.showModal()
    return () => dialog.close()
  }, [active])

  if (!active) return children

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
