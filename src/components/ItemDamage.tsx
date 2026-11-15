import { useState } from 'react'
import { damageUsesStrength, parseDamageFormula } from '../domain/itemDamage'
import { t } from '../i18n.ts'

export function ItemDamage({ formula, ownerStrength }: { formula: string; ownerStrength?: number }) {
  const [manualStrength, setManualStrength] = useState('')
  const [result, setResult] = useState<number>()
  const [invalid, setInvalid] = useState(false)
  const needsStrength = damageUsesStrength(formula)
  const strength = manualStrength === '' ? ownerStrength : Number(manualStrength)
  const missingStrength = needsStrength && (strength === undefined || !Number.isInteger(strength) || strength < 0 || strength > 30)

  return <section className="item-damage">
    <p><strong>{t('Урон')}</strong> <code>({formula})</code>
      {result !== undefined && <> = <output aria-live="polite">{new Intl.NumberFormat(undefined, { maximumFractionDigits: 6 }).format(result)}</output></>}
    </p>
    {needsStrength && ownerStrength === undefined && <label>{t('Сила для броска')}{' '}
      <input type="number" min={0} max={30} step={1} value={manualStrength} onChange={(event) => {
        setManualStrength(event.currentTarget.value)
        setResult(undefined)
        setInvalid(false)
      }} />
    </label>}{' '}
    <button type="button" disabled={missingStrength} onClick={() => {
      const value = parseDamageFormula(formula)?.(strength, Math.random)
      const valid = value !== undefined && Number.isFinite(value)
      setResult(valid ? value : undefined)
      setInvalid(!valid)
    }}>{t('Бросить урон')}</button>
    {invalid && <p role="alert">{t('Не удалось вычислить урон. Проверьте формулу и деление на ноль.')}</p>}
  </section>
}
