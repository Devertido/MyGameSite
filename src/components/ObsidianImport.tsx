import { t } from '../i18n.ts'
import { useMemo, useState } from 'react'
import type { ArchiveEntry } from '../domain/timeline'
import { importObsidian, obsidianLinks, type ObsidianNote } from '../domain/obsidian'
import { CreationDialog } from './CreationDialog'

export function ObsidianImport({ onClose, onImport }: {
  onClose: () => void
  onImport: (entries: ArchiveEntry[]) => void
}) {
  const [notes, setNotes] = useState<ObsidianNote[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [excludedLinks, setExcludedLinks] = useState<string[]>([])
  const [preview, setPreview] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const links = useMemo(() => obsidianLinks(notes), [notes])
  const visibleLinks = links.filter(({ source, target }) => selected.includes(source) && selected.includes(target))
  const linkKey = ({ source, index }: { source: string; index: number }) => JSON.stringify([source, index])
  const current = notes.find(({ path }) => path === preview)

  async function loadFiles(files: FileList | null) {
    if (!files?.length) return
    setBusy(true)
    setError('')
    try {
      const byPath = new Map<string, ObsidianNote>()
      for (const file of files) {
        if (!/\.md$/i.test(file.name)) continue
        const path = file.webkitRelativePath || file.name
        if (byPath.has(path)) throw new Error(t('Две заметки имеют одинаковый путь. Выберите папку, чтобы сохранить их пути.'))
        const body = await file.text()
        const heading = body.match(/^#\s+(.+)$/m)?.[1]?.trim()
        byPath.set(path, { path, body, title: heading || file.name.replace(/\.md$/i, '') })
      }
      const loaded = [...byPath.values()]
      if (!loaded.length) throw new Error(t('В выбранных файлах нет заметок Markdown.'))
      setNotes(loaded)
      setSelected(loaded.map(({ path }) => path))
      setExcludedLinks([])
      setPreview(loaded[0]!.path)
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : t('Не удалось открыть заметки.'))
    } finally {
      setBusy(false)
    }
  }

  function confirm() {
    setError('')
    try {
      onImport(importObsidian(notes.filter(({ path }) => selected.includes(path)),
        visibleLinks.filter((link) => !excludedLinks.includes(linkKey(link)))))
      onClose()
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : t('Не удалось импортировать заметки.'))
    }
  }

  return (
    <CreationDialog onCancel={onClose}>
      <h2 id="creation-dialog-title">{t("Импорт из Obsidian")}</h2>
      <p><label>{t("Файлы Markdown ")}<input type="file" accept=".md,text/markdown" multiple disabled={busy}
        onChange={(event) => void loadFiles(event.currentTarget.files)} /></label></p>
      <p><label>{t("Папка заметок ")}<input type="file" {...{ webkitdirectory: "" }} disabled={busy}
        onChange={(event) => void loadFiles(event.currentTarget.files)} /></label></p>
      {notes.length > 0 && (
        <>
          <fieldset>
            <legend>{t("Заметки для импорта")}</legend>
            {notes.map(({ path, title }) => (
              <label key={path} className="event-participant">
                <input type="checkbox" checked={selected.includes(path)} onChange={() => {
                  setSelected((paths) => paths.includes(path) ? paths.filter((item) => item !== path) : [...paths, path])
                }} /> {title} <small>({path})</small>
              </label>
            ))}
          </fieldset>
          <p><label>{t("Предпросмотр ")}<select value={preview} onChange={(event) => setPreview(event.currentTarget.value)}>
            {notes.map(({ path }) => <option key={path}>{path}</option>)}
          </select></label></p>
          {current && <pre className="obsidian-preview">{current.body}</pre>}
          <fieldset>
            <legend>{t("Ссылки для переноса")}</legend>
            {visibleLinks.length ? visibleLinks.map((link) => (
              <label className="event-participant" key={linkKey(link)}>
                <input type="checkbox" checked={!excludedLinks.includes(linkKey(link))}
                  onChange={(event) => {
                    const checked = event.currentTarget.checked
                    setExcludedLinks((keys) => checked ? keys.filter((key) => key !== linkKey(link)) : [...keys, linkKey(link)])
                  }} /> {link.source} → {link.target}{' · '}{link.label}
              </label>
            )) : <p>{t("Между выбранными заметками нет найденных ссылок.")}</p>}
          </fieldset>
        </>
      )}
      {error && <p role="alert">{error}</p>}
      <p>{t("Выбранные заметки появятся в летописях со статусом «Черновик».")}</p>
      <button type="button" disabled={busy || !selected.length} onClick={confirm}>{t("Импортировать")}</button>{' '}
      <button type="button" onClick={onClose}>{t("Отмена")}</button>
    </CreationDialog>
  )
}
