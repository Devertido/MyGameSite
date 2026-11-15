import { t } from '../i18n.ts'
import { effectiveSpeed, legacyBeastSpeed, type Movement } from '../domain/lore'

export function MovementFields({ movement, legacySpeed }: { movement?: Movement; legacySpeed?: string }) {
  const legacy = legacyBeastSpeed(legacySpeed)
  return <fieldset className="movement-fields">
    <legend>{t('Скорость передвижения')}</legend>
    <label>{t('Скорость (футы)')} <input type="number" min={0} step={1} name="speed-feet"
      defaultValue={movement?.speedFeet ?? legacy} /></label>
    <label>{t('Штраф к скорости (футы)')} <input type="number" min={0} step={1} name="speed-penalty-feet"
      defaultValue={movement?.speedPenaltyFeet} /></label>
    {legacySpeed && legacy === undefined && movement?.speedFeet === undefined && <p>{legacySpeed}</p>}
  </fieldset>
}

export function SpeedValue({ movement, legacySpeed }: { movement?: Movement; legacySpeed?: string }) {
  const base = movement?.speedFeet ?? legacyBeastSpeed(legacySpeed)
  const speed = effectiveSpeed(movement, base)
  if (speed === undefined) return <>{legacySpeed || '—'}</>
  const penalty = movement?.speedPenaltyFeet ?? 0
  return <>{speed} {t('фт.')}{penalty > 0 && <> ({base} − {penalty})</>}</>
}
