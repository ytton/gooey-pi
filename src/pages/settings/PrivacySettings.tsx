import { Bot, LockKeyhole } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import type { SettingsSectionProps } from './contracts'

export function PrivacySettings(_props: SettingsSectionProps) {
  const { t } = useI18n()
  return (
    <>
      <header><h1>{t('privacy.title')}</h1><p>{t('privacy.description')}</p></header>
      <section className="settings-group">
        <h2>{t('privacy.local')}</h2>
        <div className="info-row"><LockKeyhole size={15} /><div><strong>{t('privacy.localTitle')}</strong><small>{t('privacy.localHint')}</small></div></div>
      </section>
      <section className="settings-group">
        <h2>{t('privacy.requests')}</h2>
        <div className="info-row"><Bot size={15} /><div><strong>{t('privacy.requestsTitle')}</strong><small>{t('privacy.requestsHint')}</small></div></div>
      </section>
    </>
  )
}
