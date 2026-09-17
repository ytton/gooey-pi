import { Bot, Keyboard, RefreshCw, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { HARNESS_IDS, OMP_APPROVAL_MODES, type HarnessId, type OmpApprovalMode } from '@/types/api'
import { errorMessage } from '@/lib/errors'
import { HARNESS_AGENT_NAMES, HARNESS_PRODUCT_NAMES } from '@/lib/harness'
import { useI18n, type MessageKey } from '@/lib/i18n'
import { detectRendererPlatform, shortcutLabel } from '@/lib/platform-shortcuts'
import type { SettingsMetaSectionProps } from './contracts'
import { DraftSettingField } from './DraftSettingField'
import { SettingsToggle } from './SettingsToggle'

const APPROVAL_MODE_KEYS = {
  inherit: 'harness.approval.inherit',
  'always-ask': 'harness.approval.alwaysAsk',
  write: 'harness.approval.write',
  yolo: 'harness.approval.yolo',
} as const satisfies Record<OmpApprovalMode, MessageKey>

export function AgentSettings({ settings, meta, onUpdate, onRefreshHarnesses }: SettingsMetaSectionProps) {
  const { t } = useI18n()
  const activeHarness = settings.activeHarness
  const detectedHarnesses = HARNESS_IDS.filter((harness) => Boolean(meta?.harnesses[harness].path))
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState('')
  const platform = meta?.platform ?? detectRendererPlatform()
  const oppositeActionShortcut = shortcutLabel(platform, ['Primary', 'Enter'])
  const newLineShortcut = shortcutLabel(platform, ['Shift', 'Enter'])
  const refreshHarnesses = async () => {
    if (refreshing) return
    setRefreshing(true)
    setRefreshError('')
    try { await onRefreshHarnesses() } catch (error) { setRefreshError(errorMessage(error)) }
    finally { setRefreshing(false) }
  }
  const runtimePathValidation = (value: string, harness: HarnessId): string => {
    if (!value) return ''
    const absolute = meta?.platform === 'win32' ? /^[A-Za-z]:[\\/]/.test(value) || value.startsWith('\\\\') : value.startsWith('/')
    return absolute ? '' : t('harness.pathAbsolute', { name: HARNESS_AGENT_NAMES[harness] })
  }
  return (
    <>
      <header><h1>{t('harness.title')}</h1><p>{t('harness.description')}</p></header>
      <section className="settings-group">
        <h2>{t('harness.section')}</h2>
        <label className="settings-row">
          <span><strong>{t('harness.default')}</strong><small>{t('harness.defaultHint')}</small></span>
          <select value={detectedHarnesses.includes(activeHarness) ? activeHarness : ''} disabled={!detectedHarnesses.length} onChange={(event) => { void onUpdate({ activeHarness: event.target.value as HarnessId }) }}>
            {!detectedHarnesses.length ? <option value="">{t('harness.noneDetected')}</option> : null}
            {detectedHarnesses.map((harness) => <option key={harness} value={harness}>{HARNESS_PRODUCT_NAMES[harness]}</option>)}
          </select>
        </label>
        <label className="settings-row">
          <span><strong>{t('harness.approval')}</strong><small>{t('harness.approvalHint')}</small></span>
          <select value={settings.ompApprovalMode} onChange={(event) => { void onUpdate({ ompApprovalMode: event.target.value as OmpApprovalMode }) }}>
            {OMP_APPROVAL_MODES.map((mode) => <option key={mode} value={mode}>{t(APPROVAL_MODE_KEYS[mode])}</option>)}
          </select>
        </label>
      </section>
      <section className="settings-group">
        <div className="settings-group__heading">
          <h2>{t('harness.runtime')}</h2>
          <button type="button" className="button button--compact" disabled={refreshing} onClick={() => { void refreshHarnesses() }}>
            <RefreshCw className={refreshing ? 'spin' : ''} size={13} />{refreshing ? t('harness.refreshing') : t('harness.refresh')}
          </button>
        </div>
        {refreshError ? <p className="settings-error" role="alert">{refreshError}</p> : null}
        {HARNESS_IDS.map((harness) => {
          const name = HARNESS_AGENT_NAMES[harness]
          const status = meta?.harnesses[harness]
          return (
            <div className="runtime-card" key={harness}>
              <span className={status?.path ? 'is-online' : ''}><Bot size={17} /></span>
              <div>
                <strong>{status?.path ? t('harness.ready', { name }) : t('harness.missing', { name })}</strong>
                <small title={status?.problem ? `${status.problem.path}: ${status.problem.reason}` : undefined}>{status?.path ?? (status?.problem ? `${status.problem.path}: ${status.problem.reason}` : t('harness.install', { name }))}</small>
              </div>
              {status?.version ? <code>v{status.version}</code> : null}
            </div>
          )
        })}
        <p className="settings-group__description">{t('harness.discovery')}</p>
        {HARNESS_IDS.map((harness) => <DraftSettingField
          key={harness}
          id={`runtime-path-${harness}`}
          label={t('harness.override', { name: HARNESS_AGENT_NAMES[harness] })}
          description={t('harness.overrideHint')}
          committedValue={settings.runtimePaths[harness]}
          validate={(value) => runtimePathValidation(value.trim(), harness)}
          normalize={(value) => value.trim()}
          onCommit={async (value) => {
            await onUpdate({ runtimePaths: { ...settings.runtimePaths, [harness]: value } })
            await refreshHarnesses()
          }}
        />)}
      </section>
      <section className="settings-group">
        <h2>{t('harness.transcript')}</h2>
        <SettingsToggle checked={settings.showReasoningSummaries} onChange={(showReasoningSummaries) => { void onUpdate({ showReasoningSummaries }) }} label={t('harness.reasoning')} description={t('harness.reasoningHint')} />
        <SettingsToggle checked={settings.showToolCalls} onChange={(showToolCalls) => { void onUpdate({ showToolCalls }) }} label={t('harness.tools')} description={t('harness.toolsHint')} />
      </section>
      <section className="settings-group">
        <h2>{t('harness.shortcuts')}</h2>
        <label className="settings-row">
          <span><strong>{t('harness.enterAction')}</strong><small>{t('harness.enterActionHint', { opposite: oppositeActionShortcut, newline: newLineShortcut })}</small></span>
          <span className="shortcut-choice" role="radiogroup" aria-label={t('harness.enterActionAria')}>
            {(['queue', 'steer'] as const).map((action) => <button key={action} type="button" className={`button button--compact ${settings.messageEnterAction === action ? 'is-active' : ''}`} role="radio" aria-checked={settings.messageEnterAction === action} onClick={() => { void onUpdate({ messageEnterAction: action }) }}>{action === 'queue' ? t('harness.queue') : t('harness.steer')}</button>)}
          </span>
        </label>
        <div className="shortcut-row"><span><Keyboard size={14} />{settings.messageEnterAction === 'queue' ? t('harness.queueMessage') : t('harness.steerTurn')}</span><kbd>Enter</kbd></div>
        <div className="shortcut-row"><span><Keyboard size={14} />{settings.messageEnterAction === 'queue' ? t('harness.steerTurn') : t('harness.queueMessage')}</span><kbd>{oppositeActionShortcut}</kbd></div>
      </section>
      <section className="settings-group">
        <h2>{t('harness.permissions')}</h2>
        <div className="info-row"><ShieldCheck size={15} /><div><strong>{t('harness.workspaceAccess')}</strong><small>{t('harness.workspaceAccessHint')}</small></div></div>
      </section>
    </>
  )
}
