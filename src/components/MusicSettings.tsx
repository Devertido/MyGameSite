import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { loadMusic, saveMusic } from '../data/musicStorage'
import defaultTrackUrl from '../assets/mystical-glade_94962.mp3?url'

const musicAnimation = Object.values(import.meta.glob<string>('../assets/music-ensemble*.gif', {
  eager: true, query: '?url', import: 'default',
}))[0]

const maxTrackSize = 20 * 1024 * 1024

export function MusicSettings({ english, initialVolume, rememberVolume, buttonTarget, animationTarget }: {
  buttonTarget: HTMLDivElement | null
  animationTarget: HTMLDivElement | null
  english: boolean
  initialVolume: number
  rememberVolume: (volume: number) => void
}) {
  const player = useRef<HTMLAudioElement>(null)
  const [track, setTrack] = useState<File | null>(null)
  const [volume, setVolume] = useState(initialVolume)
  const [playing, setPlaying] = useState(false)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState<'storage' | 'file' | 'playback' | null>(null)

  useEffect(() => {
    let active = true
    void loadMusic().then((saved) => {
      if (active) setTrack(saved ?? null)
    }).catch(() => {
      if (active) setError('storage')
    }).finally(() => {
      if (active) setBusy(false)
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    const audio = player.current
    if (!audio) return
    const url = track ? URL.createObjectURL(track) : null
    audio.src = url ?? defaultTrackUrl
    return () => {
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
      if (url) URL.revokeObjectURL(url)
    }
  }, [track])

  useEffect(() => {
    if (player.current) player.current.volume = volume / 100
  }, [volume])

  async function updateTrack(file: File | null) {
    if (file && (!/\.mp3$/i.test(file.name) || file.size === 0 || file.size > maxTrackSize ||
        (file.type !== '' && file.type !== 'audio/mpeg' && file.type !== 'audio/mp3'))) {
      setError('file')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await saveMusic(file)
      setPlaying(false)
      setTrack(file)
    } catch {
      setError('storage')
    } finally {
      setBusy(false)
    }
  }

  async function togglePlayback() {
    const audio = player.current
    if (!audio) return
    if (!audio.paused) {
      audio.pause()
      return
    }
    setError(null)
    try {
      await audio.play()
    } catch {
      setError('playback')
    }
  }

  const errors = {
    storage: english ? 'Could not access saved music.' : 'Не удалось открыть или сохранить музыку в браузере.',
    file: english ? 'Choose an MP3 file up to 20 MB.' : 'Выберите MP3-файл размером до 20 МБ.',
    playback: english ? 'Could not play this audio file.' : 'Не удалось воспроизвести этот аудиофайл.',
  }

  const musicLabel = playing
    ? (english ? 'Pause music' : 'Приостановить музыку')
    : (english ? 'Play music' : 'Включить музыку')

  return (
    <fieldset>
      {playing && musicAnimation && animationTarget && createPortal(
        <img className="site-music-animation" src={musicAnimation} alt="" />,
        animationTarget,
      )}
      {buttonTarget && createPortal(
        <button className="site-music" type="button" disabled={busy} aria-pressed={playing}
          aria-label={musicLabel} title={musicLabel} onClick={() => void togglePlayback()}>♪</button>,
        buttonTarget,
      )}
      <legend>{english ? 'Background music' : 'Фоновая музыка'}</legend>
      <audio ref={player} preload="none" loop onPlaying={() => setPlaying(true)} onPause={() => setPlaying(false)}
        onWaiting={() => setPlaying(false)} onEnded={() => setPlaying(false)}
        onError={() => { setPlaying(false); setError('playback') }} />
      <p><label>{english ? 'MP3 file (up to 20 MB)' : 'MP3-файл (до 20 МБ)'}{' '}
        <input type="file" accept=".mp3,audio/mpeg" disabled={busy} onChange={(event) => {
          const input = event.currentTarget
          const file = input.files?.[0]
          input.value = ''
          if (file) void updateTrack(file)
        }} />
      </label></p>
      <div>
        <p>{track?.name ?? "Mystical Glade"}</p>
        <button type="button" disabled={busy} onClick={() => void togglePlayback()}>
          {playing ? (english ? 'Pause' : 'Пауза') : (english ? 'Play' : 'Воспроизвести')}
        </button>{' '}
        {track && (
          <button type="button" disabled={busy} onClick={() => void updateTrack(null)}>
            {english ? 'Restore default track' : 'Вернуть встроенный трек'}
          </button>
        )}
      </div>
      <p><label>{english ? 'Track volume' : 'Громкость трека'}{' '}
        <input type="range" min={0} max={100} value={volume} onChange={(event) => {
          const next = event.currentTarget.valueAsNumber
          setVolume(next)
          rememberVolume(next)
        }} />{' '}
        <output>{volume}%</output>
      </label></p>
      {error && <p role="alert">{errors[error]}</p>}
      {error === 'playback' && buttonTarget?.parentElement &&
        createPortal(<span className="site-music-error" role="status">{errors.playback}</span>, buttonTarget.parentElement)}
    </fieldset>
  )
}
