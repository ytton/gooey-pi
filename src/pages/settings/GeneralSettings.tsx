import type { AppSettings } from '@/types/api'
import { useI18n } from '@/lib/i18n'
import type { SettingsSectionProps } from './contracts'
import { SettingsToggle } from './SettingsToggle'
export function GeneralSettings({ settings, onUpdate, platform }: SettingsSectionProps & { platform: NodeJS.Platform }) {
  const { t } = useI18n()
  return (
    <>
      <header><h1>{t('general.title')}</h1><p>{t('general.description')}</p></header>
      <section className="settings-group">
        <h2>{t('general.window')}</h2>
        <SettingsToggle checked={settings.sidebarOpen} onChange={(sidebarOpen) => { void onUpdate({ sidebarOpen }) }} label={t('general.sidebar')} description={t('general.sidebarHint')} />
        <SettingsToggle checked={settings.inspectorOpen} onChange={(inspectorOpen) => { void onUpdate({ inspectorOpen }) }} label={t('general.inspector')} description={t('general.inspectorHint')} />
        <SettingsToggle checked={settings.showFileChangesPopup} onChange={(showFileChangesPopup) => { void onUpdate({ showFileChangesPopup }) }} label={t('general.changesPopup')} description={t('general.changesPopupHint')} />
      </section>
      {platform === 'darwin' ? (
        <section className="settings-group">
          <h2>{t('general.startup')}</h2>
          <SettingsToggle checked={settings.keepRunningInBackground} onChange={(keepRunningInBackground) => { void onUpdate({ keepRunningInBackground }) }} label={t('general.keepRunning')} description={t('general.keepRunningHint')} />
          <SettingsToggle checked={settings.launchAtLogin} onChange={(launchAtLogin) => { void onUpdate({ launchAtLogin }) }} label={t('general.launchAtLogin')} description={t('general.launchAtLoginHint')} />
        </section>
      ) : null}
      <section className="settings-group">
        <h2>{t('general.sessionDefaults')}</h2>
        <label className="settings-row">
          <span><strong>{t('general.checkout')}</strong><small>{t('general.checkoutHint')}</small></span>
          <select value={settings.checkoutStrategy} onChange={(event) => {
            const checkoutStrategy = event.target.value
            if (checkoutStrategy === 'worktree' || checkoutStrategy === 'branch') void onUpdate({ checkoutStrategy })
          }}>
            <option value="worktree">{t('general.worktrees')}</option>
            <option value="branch">{t('general.branches')}</option>
          </select>
        </label>
        <label className="settings-row">
          <span><strong>{t('general.defaultTab')}</strong><small>{t('general.defaultTabHint')}</small></span>
          <select value={settings.defaultInspectorTab} onChange={(event) => { void onUpdate({ defaultInspectorTab: event.target.value as AppSettings['defaultInspectorTab'] }) }}>
            <option value="summary">{t('inspector.summary')}</option>
            <option value="changes">{t('inspector.changes')}</option>
            <option value="browser">{t('inspector.browser')}</option>
            <option value="files">{t('inspector.files')}</option>
          </select>
        </label>
      </section>
    </>
  )
}
