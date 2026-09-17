import { Check, KeyRound, Laptop, LoaderCircle, Mic2, Radio, RefreshCw, Server, ShieldAlert, ShieldCheck, Trash2, Waves } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui'
import { errorMessage } from '@/lib/errors'
import { useI18n } from '@/lib/i18n'
import { shortcutLabel } from '@/lib/platform-shortcuts'
import {
  DEEPGRAM_MODELS,
  GROQ_MODELS,
  OPENAI_FILE_MODELS,
  OPENAI_LIVE_MODELS,
  REALTIME_MODELS,
  REALTIME_VOICES,
  VOICE_PROVIDER_OPTIONS,
  optionsWithCurrent,
  type VoiceOption,
} from '@/lib/voice-options'
import type { AppSettings, PrimeWorkApi, VoiceCredentialProvider, VoiceCredentialStatus, VoiceTranscriptionProvider } from '@/types/api'
import type { SettingsSectionProps } from './contracts'

const CREDENTIALS: Array<{ id: VoiceCredentialProvider; name: string; monogram: string; detail: string }> = [
  { id: 'openai', name: 'OpenAI', monogram: 'OA', detail: 'Required for live dictation and the realtime orb.' },
  { id: 'groq', name: 'Groq', monogram: 'GQ', detail: 'Used only when Groq is your dictation provider.' },
  { id: 'deepgram', name: 'Deepgram', monogram: 'DG', detail: 'Used only when Deepgram is your dictation provider.' },
  { id: 'self-hosted', name: 'Self-hosted endpoint', monogram: 'SH', detail: 'Optional bearer token for your Parakeet or Whisper server.' },
]

const CONNECTION_CREDENTIALS = CREDENTIALS.filter((item) => item.id !== 'self-hosted')

interface VoiceSettingsProps extends SettingsSectionProps {
  voice: PrimeWorkApi['voice'] | null
  platform?: NodeJS.Platform
}

type VoiceServiceState = 'checking' | 'ready' | 'restart-required' | 'error'
type SelfHostedTestState = 'idle' | 'testing' | 'connected' | 'error'

function needsDesktopRestart(error: unknown): boolean {
  return /No handler registered for ['"]voice:/i.test(errorMessage(error))
}

function ModelSelect({ label, description, value, options, onChange, recommendedLabel = 'Recommended' }: { label: string; description: string; value: string; options: VoiceOption[]; onChange(value: string): void; recommendedLabel?: string }) {
  const choices = optionsWithCurrent(options, value)
  const selected = choices.find((option) => option.value === value)
  return (
    <label className="voice-choice-row">
      <span><strong>{label}</strong><small>{description}</small></span>
      <span className="voice-choice-control">
        <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
          {choices.map((option) => <option key={option.value} value={option.value}>{option.label}{option.recommended ? ` · ${recommendedLabel}` : ''}</option>)}
        </select>
        {selected ? <small>{selected.detail}</small> : null}
      </span>
    </label>
  )
}


function PathInput({ label, description, placeholder, value, onCommit }: { label: string; description: string; placeholder: string; value: string; onCommit(value: string): void }) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  return (
    <label className="voice-path-field">
      <span><strong>{label}</strong><small>{description}</small></span>
      <input aria-label={label} value={draft} placeholder={placeholder} spellCheck={false} onChange={(event) => setDraft(event.target.value)} onBlur={() => { if (draft !== value) onCommit(draft) }} />
    </label>
  )
}
export function VoiceSettings({ settings, onUpdate, voice, platform = 'darwin' }: VoiceSettingsProps) {
  const { t } = useI18n()
  const [status, setStatus] = useState<VoiceCredentialStatus | null>(null)
  const [serviceState, setServiceState] = useState<VoiceServiceState>(voice ? 'checking' : 'restart-required')
  const [credential, setCredential] = useState<VoiceCredentialProvider | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')
  const [selfHostedUrl, setSelfHostedUrl] = useState(settings.voiceSelfHostedUrl)
  const [selfHostedModel, setSelfHostedModel] = useState(settings.voiceSelfHostedModel)
  const [selfHostedTestState, setSelfHostedTestState] = useState<SelfHostedTestState>('idle')
  const [selfHostedMessage, setSelfHostedMessage] = useState('')

  useEffect(() => setSelfHostedUrl(settings.voiceSelfHostedUrl), [settings.voiceSelfHostedUrl])
  useEffect(() => setSelfHostedModel(settings.voiceSelfHostedModel), [settings.voiceSelfHostedModel])

  useEffect(() => {
    let active = true
    if (!voice) { setServiceState('restart-required'); return }
    setServiceState('checking')
    void voice.credentialStatus().then((next) => {
      if (active) { setStatus(next); setServiceState('ready') }
    }).catch((error) => {
      if (!active) return
      setStatus(null)
      if (needsDesktopRestart(error)) { setCredential(null); setFailure(''); setServiceState('restart-required') }
      else { setFailure(errorMessage(error)); setServiceState('error') }
    })
    return () => { active = false }
  }, [voice])

  const saveCredential = async () => {
    if (!voice || !credential || !apiKey.trim()) return
    setBusy(true); setFailure('')
    try {
      setStatus(await voice.saveApiKey(credential, apiKey))
      setApiKey(''); setCredential(null)
    } catch (error) { setFailure(errorMessage(error)) } finally { setBusy(false) }
  }

  const removeCredential = async (provider: VoiceCredentialProvider) => {
    if (!voice) return
    setBusy(true); setFailure('')
    try { setStatus(await voice.deleteApiKey(provider)) } catch (error) { setFailure(errorMessage(error)) } finally { setBusy(false) }
  }

  const closeCredential = () => { if (!busy) { setCredential(null); setApiKey(''); setFailure('') } }
  const openCredential = (provider: VoiceCredentialProvider) => { setFailure(''); setCredential(provider) }
  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => { void onUpdate({ [key]: value } as Pick<AppSettings, K>) }
  const testSelfHosted = async () => {
    if (!voice || !selfHostedUrl.trim()) return
    setSelfHostedTestState('testing'); setSelfHostedMessage('')
    const url = selfHostedUrl.trim()
    const model = selfHostedModel.trim()
    try {
      await voice.testSelfHosted({ url, model })
      await onUpdate({ voiceSelfHostedUrl: url, voiceSelfHostedModel: model })
      setSelfHostedTestState('connected')
      setSelfHostedMessage('Connected. GooeyPi successfully transcribed a test audio clip.')
    } catch (error) {
      setSelfHostedTestState('error')
      setSelfHostedMessage(errorMessage(error))
    }
  }
  const provider = VOICE_PROVIDER_OPTIONS.find((option) => option.value === settings.voiceTranscriptionProvider) ?? VOICE_PROVIDER_OPTIONS[0]
  const selectedCredential = provider.credential
  const selectedConfigured = selectedCredential ? status?.configured[selectedCredential] ?? false : true
  const secureStorageAvailable = status?.storage.available ?? false

  return (
    <>
      <header className="voice-settings-header">
        <span className="voice-settings-header__icon"><Mic2 size={19} /></span>
        <div><h1>{t('voice.title')}</h1><p>{t('voice.description')}</p></div>
      </header>

        <div className="voice-bridge-notice" role="status">
          <RefreshCw size={17} />
          <span><strong>{t('voice.restart.title')}</strong><small>{t('voice.restart.body', { shortcut: shortcutLabel(platform, ['Primary', 'Q']) })}</small></span>
        </div>

      <section className="voice-section" aria-labelledby="voice-connections-title">
        <div className="voice-section__heading">
          <span><ShieldCheck size={15} /></span>
          <div><h2 id="voice-connections-title">{t('voice.connections')}</h2><p>{t('voice.connectionsHint')}</p></div>
        </div>
        {serviceState === 'ready' && status && !secureStorageAvailable ? (
          <div className="voice-storage-notice" role="alert">
            <ShieldAlert size={17} />
            <span><strong>{t('voice.storageLocked.title')}</strong><small>{status.storage.message} {t('voice.connectionsHint')}</small></span>
          </div>
        ) : null}
        {voice ? <div className="voice-connection-grid">
          {CONNECTION_CREDENTIALS.map((item) => {
            const configured = status?.configured[item.id] ?? false
            const source = status?.source[item.id]
            return (
              <article className={`voice-connection-card${configured ? ' is-connected' : ''}`} key={item.id}>
                <span className="voice-provider-mark" aria-hidden="true">{item.monogram}</span>
                <div className="voice-connection-card__body">
                  <span className="voice-connection-card__title"><strong>{item.name}</strong><i>{serviceState === 'checking' ? t('voice.checking') : serviceState === 'restart-required' ? t('voice.restartRequired') : serviceState === 'error' ? t('voice.unavailable') : configured ? source === 'environment' ? t('voice.environmentKey') : source === 'session' ? t('voice.sessionOnly') : t('voice.connected') : source === 'saved' && !secureStorageAvailable ? t('voice.storageLocked') : t('voice.notConnected')}</i></span>
                  <small>{t(item.id === 'openai' ? 'voice.credential.openai' : item.id === 'groq' ? 'voice.credential.groq' : item.id === 'deepgram' ? 'voice.credential.deepgram' : 'voice.credential.selfHosted')}</small>
                </div>
                {serviceState === 'ready' ? <button type="button" className="button" disabled={busy} onClick={() => openCredential(item.id)}><KeyRound size={13} /> {configured ? t('voice.replaceKey') : t('voice.addKey')}</button> : null}
                {serviceState === 'ready' && (source === 'saved' || source === 'session') ? <button type="button" className="button button--icon" aria-label={t('voice.removeKey', { name: item.name })} disabled={busy} onClick={() => void removeCredential(item.id)}><Trash2 size={13} /></button> : null}
              </article>
            )
          })}
        </div> : null}
        {failure && !credential ? <p className="settings-error" role="alert">{failure}</p> : null}
      </section>

      <section className="voice-section" aria-labelledby="voice-dictation-title">
        <div className="voice-section__heading">
          <span><Waves size={15} /></span>
          <div><h2 id="voice-dictation-title">{t('voice.dictation')}</h2><p>{t('voice.dictationHint')}</p></div>
        </div>
        <div className="voice-setup-card">
          <label className="voice-choice-row">
            <span><strong>{t('voice.service')}</strong><small>{t('voice.serviceHint')}</small></span>
            <span className="voice-choice-control">
              <select aria-label={t('voice.serviceAria')} value={settings.voiceTranscriptionProvider} onChange={(event) => update('voiceTranscriptionProvider', event.target.value as VoiceTranscriptionProvider)}>
                {VOICE_PROVIDER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}{option.recommended ? ` · ${t('voice.recommended')}` : ''}</option>)}
              </select>
              <small>{provider.detail}</small>
            </span>
          </label>

          {settings.voiceTranscriptionProvider === 'openai-live' ? <ModelSelect label={t('voice.model')} description={t('voice.model.live')} value={settings.voiceOpenAiLiveTranscriptionModel} options={OPENAI_LIVE_MODELS} onChange={(value) => update('voiceOpenAiLiveTranscriptionModel', value)} recommendedLabel={t('voice.recommended')} /> : null}
          {settings.voiceTranscriptionProvider === 'openai' ? <ModelSelect label={t('voice.model')} description={t('voice.model.file')} value={settings.voiceOpenAiTranscriptionModel} options={OPENAI_FILE_MODELS} onChange={(value) => update('voiceOpenAiTranscriptionModel', value)} recommendedLabel={t('voice.recommended')} /> : null}
          {settings.voiceTranscriptionProvider === 'groq' ? <ModelSelect label={t('voice.model')} description={t('voice.model.groq')} value={settings.voiceGroqTranscriptionModel} options={GROQ_MODELS} onChange={(value) => update('voiceGroqTranscriptionModel', value)} recommendedLabel={t('voice.recommended')} /> : null}
          {settings.voiceTranscriptionProvider === 'deepgram' ? <ModelSelect label={t('voice.model')} description={t('voice.model.deepgram')} value={settings.voiceDeepgramTranscriptionModel} options={DEEPGRAM_MODELS} onChange={(value) => update('voiceDeepgramTranscriptionModel', value)} recommendedLabel={t('voice.recommended')} /> : null}
          {settings.voiceTranscriptionProvider === 'self-hosted' ? (
            <div className="voice-self-hosted-setup">
              <span className="voice-local-setup__intro"><Server size={15} /><span><strong>{t('voice.selfHosted.title')}</strong><small>{t('voice.selfHosted.hint')}</small></span></span>
              <label className="voice-path-field">
                <span><strong>{t('voice.serverUrl')}</strong><small>{t('voice.serverUrlHint')}</small></span>
                <input aria-label={t('voice.serverUrl')} type="url" value={selfHostedUrl} placeholder="http://127.0.0.1:9000" spellCheck={false} onChange={(event) => { setSelfHostedUrl(event.target.value); setSelfHostedTestState('idle'); setSelfHostedMessage('') }} onBlur={() => { const value = selfHostedUrl.trim(); if (value !== settings.voiceSelfHostedUrl) update('voiceSelfHostedUrl', value) }} />
              </label>
              <label className="voice-path-field">
                <span><strong>{t('voice.modelId')}</strong><small>{t('voice.modelIdHint')}</small></span>
                <input aria-label={t('voice.modelId')} value={selfHostedModel} placeholder="nvidia/parakeet-tdt-0.6b-v3" spellCheck={false} onChange={(event) => { setSelfHostedModel(event.target.value); setSelfHostedTestState('idle'); setSelfHostedMessage('') }} onBlur={() => { const value = selfHostedModel.trim(); if (value !== settings.voiceSelfHostedModel) update('voiceSelfHostedModel', value) }} />
              </label>
              <div className="voice-self-hosted-auth">
                <span><strong>{t('voice.accessToken')}</strong><small>{t('voice.accessTokenHint')}</small></span>
                <span className="voice-self-hosted-auth__actions">
                  <i>{status?.configured['self-hosted'] ? status.source['self-hosted'] === 'session' ? t('voice.sessionOnly') : status.source['self-hosted'] === 'environment' ? t('voice.environmentToken') : t('voice.tokenSaved') : status?.source['self-hosted'] === 'saved' ? t('voice.storageLocked') : t('voice.noToken')}</i>
                  {voice && serviceState === 'ready' ? <button type="button" className="button" disabled={busy} onClick={() => openCredential('self-hosted')}><KeyRound size={13} /> {status?.configured['self-hosted'] ? t('voice.replaceToken') : t('voice.addToken')}</button> : null}
                  {voice && serviceState === 'ready' && (status?.source['self-hosted'] === 'saved' || status?.source['self-hosted'] === 'session') ? <button type="button" className="button button--icon" aria-label={t('voice.removeToken')} disabled={busy} onClick={() => void removeCredential('self-hosted')}><Trash2 size={13} /></button> : null}
                </span>
              </div>
              <div className="voice-self-hosted-connect">
                <span><strong>{t('voice.connectionCheck')}</strong><small>{t('voice.connectionCheckHint')}</small></span>
                <button type="button" className="button button--primary" disabled={!voice || !selfHostedUrl.trim() || selfHostedTestState === 'testing'} onClick={() => void testSelfHosted()}>{selfHostedTestState === 'testing' ? <LoaderCircle className="is-spinning" size={13} /> : <Server size={13} />} {selfHostedTestState === 'testing' ? t('voice.testing') : t('voice.connectTest')}</button>
              </div>
              {selfHostedMessage ? <p className={`voice-self-hosted-result is-${selfHostedTestState}`} role={selfHostedTestState === 'error' ? 'alert' : 'status'}>{selfHostedTestState === 'connected' ? <Check size={13} /> : <ShieldAlert size={13} />}{selfHostedMessage}</p> : null}
              <p className="voice-self-hosted-note">{t('voice.selfHostedNote')}</p>
            </div>
          ) : null}
          {settings.voiceTranscriptionProvider === 'local-whisper' ? (
            <div className="voice-local-setup">
              <span className="voice-local-setup__intro"><Laptop size={15} /><span><strong>{t('voice.local.title')}</strong><small>{t('voice.local.hint')}</small></span></span>
              <PathInput label={t('voice.whisperCli')} description={t('voice.whisperCliHint')} placeholder="/opt/homebrew/bin/whisper-cli" value={settings.voiceLocalWhisperExecutable} onCommit={(value) => update('voiceLocalWhisperExecutable', value)} />
              <PathInput label={t('voice.ggml')} description={t('voice.ggmlHint')} placeholder="/path/to/ggml-large-v3-turbo.bin" value={settings.voiceLocalWhisperModel} onCommit={(value) => update('voiceLocalWhisperModel', value)} />
            </div>
          ) : null}

          {settings.voiceTranscriptionProvider === 'self-hosted' ? (
            <div className={`voice-requirement${selfHostedUrl.trim() ? ' is-ready' : ''}`}>
              <span>{selfHostedUrl.trim() ? <Check size={13} /> : <Server size={13} />}{selfHostedUrl.trim() ? t('voice.serverConfigured') : t('voice.serverRequired')}</span>
            </div>
          ) : selectedCredential ? (
            <div className={`voice-requirement${selectedConfigured ? ' is-ready' : ''}`}>
              <span>{selectedConfigured ? <Check size={13} /> : <KeyRound size={13} />}{selectedConfigured ? t('voice.providerConnected', { name: CREDENTIALS.find((item) => item.id === selectedCredential)?.name ?? selectedCredential }) : t('voice.providerKeyRequired', { name: CREDENTIALS.find((item) => item.id === selectedCredential)?.name ?? selectedCredential })}</span>
              {!selectedConfigured && voice && serviceState === 'ready' ? <button type="button" onClick={() => openCredential(selectedCredential)}>{t('voice.addKey')}</button> : null}
            </div>
          ) : <div className="voice-requirement is-ready"><span><Check size={13} />{t('voice.runsLocally')}</span></div>}
        </div>
      </section>

      <section className="voice-section" aria-labelledby="voice-realtime-title">
        <div className="voice-section__heading">
          <span><Radio size={15} /></span>
          <div><h2 id="voice-realtime-title">{t('voice.realtime')}</h2><p>{t('voice.realtimeHint')}</p></div>
        </div>
        <div className="voice-setup-card">
          <ModelSelect label={t('voice.realtimeModel')} description={t('voice.realtimeModelHint')} value={settings.voiceRealtimeModel} options={REALTIME_MODELS} onChange={(value) => update('voiceRealtimeModel', value)} recommendedLabel={t('voice.recommended')} />
          <ModelSelect label={t('voice.speakingVoice')} description={t('voice.speakingVoiceHint')} value={settings.voiceRealtimeVoice} options={REALTIME_VOICES} onChange={(value) => update('voiceRealtimeVoice', value)} recommendedLabel={t('voice.recommended')} />
          <div className={`voice-requirement${status?.configured.openai ? ' is-ready' : ''}`}>
            <span>{status?.configured.openai ? <Check size={13} /> : <KeyRound size={13} />}{status?.configured.openai ? t('voice.openaiConnected') : t('voice.openaiRequired')}</span>
            {!status?.configured.openai && voice && serviceState === 'ready' ? <button type="button" onClick={() => openCredential('openai')}>{t('voice.addKey')}</button> : null}
          </div>
          {secureStorageAvailable ? <p className="voice-realtime-note">{t('voice.keychainNote')}</p> : null}
        </div>
      </section>

      {credential ? <Modal title={t('voice.connect', { name: CREDENTIALS.find((item) => item.id === credential)?.name ?? credential })} onClose={closeCredential} footer={<><button type="button" className="button" disabled={busy} onClick={closeCredential}>{t('common.cancel')}</button><button type="button" className="button button--primary" disabled={busy || !apiKey.trim()} onClick={() => void saveCredential()}>{busy ? t('voice.saving') : credential === 'self-hosted' ? t('voice.saveToken') : t('voice.saveApiKey')}</button></>}>
        <p className="modal-intro">{secureStorageAvailable ? t('voice.secureIntro', { kind: credential === 'self-hosted' ? t('voice.kind.token') : t('voice.kind.key') }) : t('voice.memoryIntro', { kind: credential === 'self-hosted' ? t('voice.kind.tokenShort') : t('voice.kind.keyShort') })}</p>
        {failure ? <p className="settings-error" role="alert">{failure}</p> : null}
        <label className="field"><span>{credential === 'self-hosted' ? t('voice.accessToken') : t('providers.apiKey')}</span><input autoFocus type="password" value={apiKey} autoComplete="off" spellCheck={false} placeholder={credential === 'self-hosted' ? t('voice.pasteToken') : t('voice.pasteKey')} onChange={(event) => setApiKey(event.target.value)} /></label>
      </Modal> : null}
    </>
  )
}
