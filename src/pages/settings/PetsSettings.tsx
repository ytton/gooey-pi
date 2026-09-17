import { PawPrint, RefreshCw, Sparkles } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { PetAvatar } from '@/components/PetAvatar'
import type { PetDefinition, PrimeWorkApi } from '@/types/api'
import { useI18n } from '@/lib/i18n'
import type { SettingsSectionProps } from './contracts'
import { SettingsToggle } from './SettingsToggle'

const BUILT_INS: PetDefinition[] = [
  { id: 'orb', petId: 'orb', displayName: 'Orb', description: 'A fluid voice orb that shifts with GooeyPi activity.', source: 'built-in', kind: 'orb' },
  { id: 'gooey-pi', petId: 'gooey-pi', displayName: 'GooeyPi', description: 'A friendly purple jelly pet shaped like the mathematical pi symbol.', source: 'built-in', kind: 'spritesheet' },
]

export function PetsSettings({ settings, onUpdate, pets }: SettingsSectionProps & { pets: PrimeWorkApi['pets'] | null }) {
  const { t } = useI18n()
  const [available, setAvailable] = useState<PetDefinition[]>(BUILT_INS)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const refresh = useCallback(async () => {
    if (!pets) return
    setLoading(true)
    setLoadError('')
    try {
      const items = await pets.list()
      setAvailable(items.length ? items : BUILT_INS)
    } catch {
      setLoadError(t('pets.refreshError'))
      setAvailable(BUILT_INS)
    } finally { setLoading(false) }
  }, [pets, t])
  useEffect(() => { void refresh() }, [refresh])
  const selected = useMemo(() => available.find((item) => item.id === settings.petId) ?? available.find((item) => item.id === 'orb') ?? BUILT_INS[0], [available, settings.petId])
  const codexCount = available.filter((item) => item.source === 'codex').length

  return (
    <>
      <header><h1>{t('pets.title')}</h1><p>{t('pets.description')}</p></header>
      <section className="pet-hero">
        <div className="pet-hero__stage"><PetAvatar pet={selected} pets={pets} activity="speaking" size={Math.round(96 * settings.petSize / 100)} reduceMotion={settings.reduceMotion} /></div>
        <div><span className="pet-kicker"><Sparkles size={12} /> {t('pets.active')}</span><h2>{selected.displayName}</h2><p>{selected.description}</p><small>{t('pets.dragHint')}</small></div>
      </section>
      <section className="settings-group">
        <h2>{t('pets.companion')}</h2>
        <SettingsToggle checked={settings.petEnabled} onChange={(petEnabled) => { void onUpdate({ petEnabled }) }} label={t('pets.show')} description={t('pets.showHint')} />
        <div className="settings-row pet-size-row">
          <span><label htmlFor="pet-size"><strong>{t('pets.size')}</strong></label><small>{t('pets.sizeHint')}</small></span>
          <div className="pet-size-control">
            <input id="pet-size" type="range" min="50" max="125" step="5" value={settings.petSize} style={{ '--pet-size-progress': `${(settings.petSize - 50) / .75}%` } as CSSProperties} onChange={(event) => { void onUpdate({ petSize: Number(event.target.value) }) }} />
            <output htmlFor="pet-size">{settings.petSize}%</output>
          </div>
        </div>
        <div className="pet-grid" role="radiogroup" aria-label={t('pets.aria')}>
          {available.map((pet) => (
            <button
              type="button"
              role="radio"
              aria-checked={pet.id === selected.id}
              className={pet.id === selected.id ? 'pet-choice is-active' : 'pet-choice'}
              key={pet.id}
              onClick={() => { void onUpdate({ petId: pet.id, petEnabled: true }) }}
            >
              <span className="pet-choice__art">
                {pet.id === 'gooey-pi' ? <img src="/gooeypi-mascot.png" alt="" /> : pet.kind === 'orb' ? <PetAvatar pet={pet} pets={pets} size={48} reduceMotion={settings.reduceMotion} /> : <PawPrint size={24} />}
              </span>
              <span><strong>{pet.displayName}</strong><small>{pet.source === 'built-in' ? t('pets.builtIn') : t('pets.codex')}</small></span>
            </button>
          ))}
        </div>
      </section>
      <section className="settings-group">
        <div className="settings-group__heading"><h2>{t('pets.codexTitle')}</h2><button type="button" className="button button--compact" disabled={!pets || loading} onClick={() => { void refresh() }}><RefreshCw size={12} className={loading ? 'spin' : ''} /> {t('common.refresh')}</button></div>
        <p className="settings-group__description">{t('pets.codexHint')}</p>
        <div className="settings-row"><span><strong>{codexCount ? t('pets.found', { count: codexCount }) : t('pets.none')}</strong><small>{codexCount ? t('pets.foundHint') : t('pets.noneHint')}</small></span></div>
        {loadError ? <p className="settings-error" role="alert">{loadError}</p> : null}
      </section>
    </>
  )
}
