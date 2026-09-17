import { ChevronRight, ExternalLink, Gauge, KeyRound, LogIn, LogOut, RefreshCw, Search, Zap } from 'lucide-react'
import { useMemo, useState } from 'react'
import { errorMessage } from '@/lib/errors'
import type { HarnessId, PrimeModelCatalog, PrimeModelDescriptor, PrimeProviderDescriptor } from '@/types/api'
import { HARNESS_AGENT_NAMES } from '@/lib/harness'
import { useI18n, type I18nContextValue } from '@/lib/i18n'
import { Modal } from '@/components/ui'

interface ProviderSettingsProps {
  /** Active harness. OMP and Pi credentials stay CLI-owned; visibility toggles only affect GooeyPi. */
  harness?: HarnessId
  catalog: PrimeModelCatalog | null
  onRefresh(): Promise<void>
  onSaveApiKey(providerId: string, apiKey: string): Promise<void>
  onLogout(providerId: string): Promise<void>
  onSetEnabled(providerId: string, enabled: boolean): Promise<void>
  onSetAllEnabled(): Promise<void>
  onSetAllDisabled(): Promise<void>
  onSetModelEnabled(modelKey: string, enabled: boolean): Promise<void>
  onStartOAuth(providerId: string): Promise<void>
  onOpenDocs(): void
}

function authDescription(provider: PrimeProviderDescriptor, t: I18nContextValue['t']): string {
  if (!provider.configured) return provider.authMethod === 'external' ? t('providers.external') : t('providers.notConnected')
  const source = provider.authSource === 'environment' ? provider.authLabel ? `${t('providers.environment')} · ${provider.authLabel}` : t('providers.environment')
    : provider.authSource === 'prime_cli' ? t('providers.primeCli')
      : provider.authSource === 'models_json_key' || provider.authSource === 'models_json_command' ? t('providers.modelsJson')
        : provider.authSource === 'stored' ? provider.authMethod === 'oauth' ? t('providers.connectedAccount') : t('providers.storedKey')
          : provider.authSource ?? t('providers.configured')
  return `${source} · ${t('providers.availableModels', { count: provider.availableModelCount.toLocaleString() })}`
}

function activeFirst<T extends { enabled?: boolean }>(items: readonly T[]): T[] {
  return [...items].sort((left, right) => Number(right.enabled !== false) - Number(left.enabled !== false))
}

export function ProviderSettings({ harness = 'prime', catalog, onRefresh, onSaveApiKey, onLogout, onSetEnabled, onSetAllEnabled, onSetAllDisabled, onSetModelEnabled, onStartOAuth, onOpenDocs }: ProviderSettingsProps) {
  const { t } = useI18n()
  // OMP and Pi own their credentials in their CLIs; GooeyPi only toggles visibility.
  const externalAuth = harness !== 'prime'
  const agentName = HARNESS_AGENT_NAMES[harness]
  const [query, setQuery] = useState('')
  const [view, setView] = useState<'providers' | 'models'>('providers')
  const [apiKeyProvider, setApiKeyProvider] = useState<PrimeProviderDescriptor | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [busyProvider, setBusyProvider] = useState<string | null>(null)
  const [collapsedModelProviders, setCollapsedModelProviders] = useState<ReadonlySet<string>>(() => new Set())
  const [error, setError] = useState('')
  const [apiKeyError, setApiKeyError] = useState('')
  const providers = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    const matches = normalized
      ? (catalog?.providers ?? []).filter((provider) => `${provider.name} ${provider.id}`.toLowerCase().includes(normalized))
      : catalog?.providers ?? []
    return activeFirst(matches)
  }, [catalog, query])
  const providerNames = useMemo(() => new Map((catalog?.providers ?? []).map((provider) => [provider.id, provider.name])), [catalog])
  const modelGroups = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    const matches = normalized
      ? (catalog?.models ?? []).filter((model) => `${model.name} ${model.id} ${model.provider} ${providerNames.get(model.provider) ?? ''}`.toLowerCase().includes(normalized))
      : catalog?.models ?? []
    const byProvider = new Map<string, PrimeModelDescriptor[]>()
    for (const model of matches) {
      const models = byProvider.get(model.provider)
      if (models) models.push(model)
      else byProvider.set(model.provider, [model])
    }
    const orderedProviders = activeFirst(catalog?.providers ?? [])
    const groups = orderedProviders.flatMap((provider) => {
      const models = byProvider.get(provider.id)
      if (!models?.length) return []
      byProvider.delete(provider.id)
      return [{ provider, models: activeFirst(models) }]
    })
    for (const [providerId, models] of byProvider) {
      groups.push({
        provider: { id: providerId, name: providerNames.get(providerId) ?? providerId, authMethod: 'external', configured: false, modelCount: models.length, availableModelCount: 0, enabled: models.some((model) => model.enabled !== false) },
        models: activeFirst(models),
      })
    }
    return groups
  }, [catalog, providerNames, query])

  const run = async (providerId: string, action: () => Promise<void>) => {
    setBusyProvider(providerId); setError('')
    try { await action() } catch (failure) { setError(errorMessage(failure)) } finally { setBusyProvider(null) }
  }

  const saveApiKey = async () => {
    const provider = apiKeyProvider
    if (!provider || !apiKey.trim()) return
    setBusyProvider(provider.id)
    setApiKeyError('')
    try {
      await onSaveApiKey(provider.id, apiKey)
      setApiKey('')
      setApiKeyProvider(null)
    } catch (failure) {
      setApiKeyError(errorMessage(failure))
    } finally {
      setBusyProvider(null)
    }
  }

  const closeApiKey = () => { setApiKey(''); setApiKeyError(''); setApiKeyProvider(null) }
  const toggleModelProvider = (providerId: string) => setCollapsedModelProviders((current) => {
    const next = new Set(current)
    if (next.has(providerId)) next.delete(providerId)
    else next.add(providerId)
    return next
  })
  const enableAll = () => run('enable-all', onSetAllEnabled)
  const disableAll = () => run('disable-all', onSetAllDisabled)

  const providerCount = catalog?.providers.length ?? 0
  const modelCount = catalog?.models.length ?? 0
  const availableModelCount = catalog?.models.filter((model) => model.available && model.enabled !== false).length ?? 0
  const disabledCount = catalog?.providers.filter((provider) => !provider.enabled).length ?? 0

  return (
    <section className="settings-group provider-settings">
      <div className="settings-group__heading"><h2>{t('providers.catalogue', { name: agentName })}</h2><div className="provider-heading-actions">{catalog && disabledCount < providerCount ? <button type="button" className="button button--danger" disabled={Boolean(busyProvider)} onClick={() => void disableAll()}>{externalAuth ? t('providers.hideAll') : t('providers.disableAll')}</button> : null}{disabledCount ? <button type="button" className="button" disabled={Boolean(busyProvider)} onClick={() => void enableAll()}>{externalAuth ? t('providers.showAll') : t('providers.enableAll')}</button> : null}<button type="button" className="button button--icon" aria-label={t('providers.refresh')} disabled={Boolean(busyProvider)} onClick={() => void run('refresh', onRefresh)}><RefreshCw size={13} /></button></div></div>
      <div className="provider-catalog-summary"><strong>{catalog ? t('providers.summary', { providers: providerCount.toLocaleString(), models: modelCount.toLocaleString() }) : t('providers.loading')}</strong>{catalog ? <small>{externalAuth ? t('providers.availableExternal', { count: availableModelCount.toLocaleString(), name: agentName }) : t('providers.availablePrime', { count: availableModelCount.toLocaleString(), name: agentName })}</small> : null}</div>
      {catalog?.warning ? <p className="provider-catalog-warning" role="status">{catalog.warning}</p> : null}
      <div className="provider-catalog-tabs" role="tablist" aria-label={t('providers.view')}>
        <button type="button" role="tab" aria-selected={view === 'providers'} className={view === 'providers' ? 'is-active' : ''} onClick={() => { setView('providers'); setQuery('') }}>{t('providers.tab.providers')} <span>{providerCount.toLocaleString()}</span></button>
        <button type="button" role="tab" aria-selected={view === 'models'} className={view === 'models' ? 'is-active' : ''} onClick={() => { setView('models'); setQuery('') }}>{t('providers.tab.models')} <span>{modelCount.toLocaleString()}</span></button>
      </div>
      <label className="provider-search"><Search size={13} /><input value={query} placeholder={view === 'providers' ? t('providers.searchProviders') : t('providers.searchModels')} aria-label={view === 'providers' ? t('providers.searchProviders') : t('providers.searchModels')} onChange={(event) => setQuery(event.target.value)} /></label>
      {error ? <p className="settings-error" role="alert">{error}</p> : null}
      {view === 'providers' ? <div className="provider-list">
        {providers.map((provider) => {
          const busy = busyProvider === provider.id
          return <div className="provider-row" key={provider.id}>
            <label className="provider-row__toggle" title={provider.enabled ? `Hide provider in ${agentName}` : `Show provider in ${agentName}`}><input type="checkbox" aria-label={t('providers.showProvider', { name: provider.name })} checked={provider.enabled} disabled={busy} onChange={(event) => void run(provider.id, () => onSetEnabled(provider.id, event.target.checked))} /><i aria-hidden="true"><span /></i></label>
            <div className="provider-row__identity"><strong>{provider.name}</strong><small>{externalAuth ? `${provider.authLabel ?? t('providers.cliManaged', { harness })} · ${provider.availableModelCount.toLocaleString()} models` : authDescription(provider, t)}</small></div>
            {externalAuth ? <div className="provider-row__actions"><button type="button" className="button" onClick={onOpenDocs}><ExternalLink size={13} /> {t('providers.credentials')}</button></div> : <div className="provider-row__actions">
              {provider.authMethod === 'oauth' ? <button type="button" className="button" disabled={busy} onClick={() => void run(provider.id, () => onStartOAuth(provider.id))}><LogIn size={13} /> {provider.configured ? t('providers.reconnect') : t('providers.connect')}</button> : null}
              {provider.authMethod === 'api_key' ? <button type="button" className="button" disabled={busy} onClick={() => { setError(''); setApiKeyError(''); setApiKey(''); setApiKeyProvider(provider) }}><KeyRound size={13} /> {provider.configured ? t('providers.replaceKey') : t('providers.addKey')}</button> : null}
              {provider.authMethod === 'external' ? <button type="button" className="button" onClick={onOpenDocs}><ExternalLink size={13} /> {t('providers.setup')}</button> : null}
              {provider.configured && provider.authSource === 'stored' ? <button type="button" className="button button--icon" aria-label={t('providers.logout', { name: provider.name })} disabled={busy} onClick={() => void run(provider.id, () => onLogout(provider.id))}><LogOut size={13} /></button> : null}
            </div>}
          </div>
        })}
      </div> : <div className="provider-list provider-model-list">
        {modelGroups.map(({ provider, models }) => {
          const collapsed = collapsedModelProviders.has(provider.id)
          const contentId = `provider-models-${provider.id.replace(/[^a-z0-9_-]/gi, '-')}`
          return <div className={`provider-model-group${provider.enabled ? '' : ' is-disabled'}${collapsed ? ' is-collapsed' : ''}`} key={provider.id}>
          <button type="button" className="provider-model-group__heading" aria-expanded={!collapsed} aria-controls={contentId} onClick={() => toggleModelProvider(provider.id)}><strong>{provider.name}</strong><small>{models.filter((model) => model.enabled !== false).length.toLocaleString()} of {models.length.toLocaleString()} on</small><ChevronRight className="provider-model-group__chevron" size={13} aria-hidden="true" /></button>
          <div id={contentId} className="provider-model-group__models" hidden={collapsed}>{models.map((model) => <div className={`provider-model-row${model.enabled === false ? ' is-disabled' : ''}`} key={model.key}>
            <div className="provider-row__identity"><strong>{model.name}</strong><small>{model.id}</small></div>
            <div className="provider-model-row__capabilities">
              {model.reasoning ? <span title={`${model.availableThinkingLevels.length} reasoning levels`}><Gauge size={11} /> {t('providers.reasoning')}</span> : null}
              {model.fastModeSupported ? <span><Zap size={11} /> {t('providers.fast')}</span> : null}
              <span className={model.available && model.enabled !== false ? 'is-available' : ''}>{model.enabled === false ? (externalAuth ? t('providers.hidden') : t('providers.disabled')) : externalAuth ? t('providers.shown') : model.available ? t('providers.available') : t('providers.needsCredentials')}</span>
            </div>
            <label className="provider-row__toggle provider-model-row__toggle" title={model.enabled === false ? `Show model in ${agentName}` : `Hide model in ${agentName}`}><input type="checkbox" aria-label={t('providers.showModel', { name: model.name })} checked={model.enabled !== false} disabled={busyProvider === `model:${model.key}`} onChange={(event) => void run(`model:${model.key}`, () => onSetModelEnabled(model.key, event.target.checked))} /><i aria-hidden="true"><span /></i></label>
          </div>)}</div>
        </div>})}
      </div>}
      {catalog && view === 'providers' && !providers.length ? <p className="settings-empty">{t('providers.noProviders')}</p> : null}
      {catalog && view === 'models' && !modelGroups.length ? <p className="settings-empty">{t('providers.noModels')}</p> : null}
      {apiKeyProvider ? <Modal title={t('providers.connectTitle', { name: apiKeyProvider.name })} onClose={() => { if (!busyProvider) closeApiKey() }} footer={<><button type="button" className="button" disabled={Boolean(busyProvider)} onClick={closeApiKey}>{t('common.cancel')}</button><button type="button" className="button button--primary" disabled={Boolean(busyProvider) || !apiKey.trim()} onClick={() => void saveApiKey()}>{t('providers.saveKey')}</button></>}><p className="modal-intro">{t('providers.keyIntro')}</p>{apiKeyError ? <p className="settings-error" role="alert">{apiKeyError}</p> : null}<label className="field"><span>{t('providers.apiKey')}</span><input autoFocus type="password" value={apiKey} autoComplete="off" spellCheck={false} placeholder="sk-..." onChange={(event) => setApiKey(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void saveApiKey() }} /></label></Modal> : null}
    </section>
  )
}

const PROVIDERS_PAGE_INTROS: Record<HarnessId, string> = {
  omp: 'Choose which OMP providers and models appear in GooeyPi. These visibility settings do not change OMP itself; credentials remain managed by OMP. You may need to log in to or out of providers in the OMP CLI before they appear on this screen.',
  pi: 'Choose which Pi providers and models appear in GooeyPi. These visibility settings do not change Pi itself; Pi provider authentication is managed by the pi CLI. You may need to log in to or out of providers in the Pi CLI before they appear on this screen.',
  prime: 'Connect accounts, choose which providers and their models appear in GooeyPi, and browse every model Prime Agent supports. You may need to log in to or out of providers in the Prime Agent CLI before they appear on this screen.',
}

/** The Providers settings page: heading plus the provider/model catalog section. */
export function ProvidersSettings(props: ProviderSettingsProps) {
  const { t } = useI18n()
  const harness = props.harness ?? 'prime'
  const introKey = harness === 'omp' ? 'providers.intro.omp' : harness === 'pi' ? 'providers.intro.pi' : 'providers.intro.prime'
  return (
    <>
      <header><h1>{t('providers.title')}</h1><p>{t(introKey)}</p></header>
      <ProviderSettings {...props} />
    </>
  )
}
