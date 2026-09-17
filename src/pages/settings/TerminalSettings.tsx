import { Keyboard } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import type { SettingsSectionProps } from './contracts'
import { shortcutLabel } from '@/lib/platform-shortcuts'
import { terminalShellValidation } from './draft-state'
import { DraftSettingField } from './DraftSettingField'
import { SettingsToggle } from './SettingsToggle'

export function TerminalSettings({ settings, onUpdate, platform = 'darwin' }: SettingsSectionProps & { platform?: NodeJS.Platform }) {
  const { t } = useI18n()
  return (
    <>
      <header><h1>{t('terminal.title')}</h1><p>{t('terminal.description')}</p></header>
      <section className="settings-group">
        <h2>{t('terminal.shell')}</h2>
        <DraftSettingField
          id="terminal-shell"
          label={t('terminal.executable')}
          description={t('terminal.executableHint')}
          committedValue={settings.terminalShell}
          validate={terminalShellValidation}
          onCommit={(terminalShell) => onUpdate({ terminalShell })}
          className="mono"
        />
        <SettingsToggle checked={settings.terminalOpen} onChange={(terminalOpen) => { void onUpdate({ terminalOpen }) }} label={t('terminal.openWithSessions')} description={t('terminal.openWithSessionsHint')} />
      </section>
      <section className="settings-group">
        <h2>{t('terminal.shortcut')}</h2>
        <div className="shortcut-row"><span><Keyboard size={14} />{t('terminal.toggle')}</span><kbd>{shortcutLabel(platform, ['Primary', 'J'])}</kbd></div>
      </section>
    </>
  )
}
