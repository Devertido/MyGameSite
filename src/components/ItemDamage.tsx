import { useState } from 'react'
import { averageDamage, damageUsesStrength } from '../domain/itemDamage'
import { t } from '../i18n.ts'

export function ItemDamage({ formula, ownerStrength }: { formula: string; ownerStrength?: number }) {
  const [manualStrength, setManualStrength] = useState('')
  const needsStrength = damageUsesStrength(formula)
  const strength = manualStrength === '' ? ownerStrength : Number(manualStrength)
  const missingStrength = needsStrength && (strength === undefined || !Number.isInteger(strength) || strength < 0 || strength > 30)
  const result = missingStrength ? undefined : averageDamage(formula, strength)

  return <section className="item-damage">
    <p><strong>{t('Урон')}</strong>{' '}
      <output aria-live="polite">{result === undefined ? '—' : new Intl.NumberFormat().format(result)}</output>
      <code>{'\u00a0'.repeat(5)}({formula})</code>
    </p>
    {needsStrength && ownerStrength === undefined && <label>{t('Сила для расчёта')}{' '}
      <input type="number" min={0} max={30} step={1} value={manualStrength}
        onChange={(event) => setManualStrength(event.currentTarget.value)} />
    </label>}
    {!missingStrength && result === undefined && <p role="alert">{t('Не удалось вычислить урон. Проверьте формулу и деление на ноль.')}</p>}
  </section>
}
