import { useI18n } from '@/lib/i18n'
import { Modal } from './ui'

export function NoHarnessPrompt({ onClose, onOpenHarnessSettings }: { onClose(): void; onOpenHarnessSettings(): void }) {
  const { t } = useI18n()
  return (
    <Modal
      title={t('error.noHarness.title')}
      onClose={onClose}
      footer={<button type="button" className="button button--primary" onClick={onOpenHarnessSettings}>{t('error.noHarness.action')}</button>}
    >
      <p>{t('error.noHarness.body')}</p>
      <p>{t('error.noHarness.hint')}</p>
    </Modal>
  )
}
