import React, { useState } from 'react'
import {
  Activity,
  Bot,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Download,
  ExternalLink,
  Mail,
  RotateCcw,
  Save,
  Server,
  Settings2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import type { SystemSettings } from '../types'

interface SettingsViewProps {
  settings: SystemSettings
  onSaveSettings: (settings: SystemSettings) => void
  onExportData: () => void
  onResetDefaults: () => void
  onWipeBlank?: () => void
}

const inputClass =
  'w-full rounded-xl border border-white/10 bg-[#07130d]/70 px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[#f0b445]/70 focus:ring-2 focus:ring-[#f0b445]/10'

const labelClass = 'mb-2 block text-xs font-semibold text-white/75'

const SectionHeading = ({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType
  title: string
  description: string
}) => (
  <div className="mb-6 flex items-start gap-3 border-b border-white/[0.08] pb-5">
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#f0b445]/20 bg-[#df9e28]/10 text-[#f0b445]">
      <Icon className="h-5 w-5" />
    </span>
    <div>
      <h2 className="text-base font-bold text-white">{title}</h2>
      <p className="mt-1 text-xs leading-relaxed text-white/50">{description}</p>
    </div>
  </div>
)

const Field = ({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  placeholder?: string
}) => (
  <label className="block min-w-0">
    <span className={labelClass}>{label}</span>
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      className={inputClass}
    />
  </label>
)

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onSaveSettings,
  onExportData,
  onResetDefaults,
  onWipeBlank,
}) => {
  const [formData, setFormData] = useState<SystemSettings>(settings)
  const [savedSuccess, setSavedSuccess] = useState(false)

  const update = <K extends keyof SystemSettings,>(key: K, value: SystemSettings[K]) => {
    setFormData((current) => ({ ...current, [key]: value }))
    setSavedSuccess(false)
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    onSaveSettings(formData)
    setSavedSuccess(true)
    window.setTimeout(() => setSavedSuccess(false), 3000)
  }

  return (
    <div className="mx-auto max-w-6xl space-y-7 pb-10">
      <header className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#153322]/95 via-[#0d2116]/95 to-[#101c14]/95 p-6 shadow-xl shadow-black/20 sm:p-8">
        <div className="pointer-events-none absolute -right-12 -top-20 h-64 w-64 rounded-full bg-[#df9e28]/10 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#f0b445]/20 bg-[#df9e28]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#f0b445]">
              <Settings2 className="h-3.5 w-3.5" /> Workspace preferences
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">Settings</h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/55">
              Manage your campus assistant, service connections, and the way student questions are handled.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start rounded-xl border border-emerald-400/20 bg-emerald-400/[0.08] px-3 py-2 text-xs font-semibold text-emerald-300 sm:self-auto">
            <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" /></span>
            All systems operational
          </div>
        </div>
        <div className="relative mt-7 grid grid-cols-1 gap-3 border-t border-white/[0.08] pt-5 sm:grid-cols-3">
          <div className="flex items-center gap-3">
            <Server className="h-4 w-4 text-[#f0b445]" />
            <div><p className="text-[10px] uppercase tracking-wider text-white/40">Admin console</p><p className="mt-0.5 font-mono text-xs text-white/80">localhost:{formData.adminPort}</p></div>
          </div>
          <div className="flex items-center gap-3">
            <Bot className="h-4 w-4 text-emerald-300" />
            <div><p className="text-[10px] uppercase tracking-wider text-white/40">Assistant</p><p className="mt-0.5 text-xs text-white/80">{formData.botName}</p></div>
          </div>
          <div className="flex items-center gap-3">
            <Activity className="h-4 w-4 text-blue-300" />
            <div><p className="text-[10px] uppercase tracking-wider text-white/40">API service</p><p className="mt-0.5 font-mono text-xs text-white/80">localhost:{formData.serverPort}</p></div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[210px_minmax(0,1fr)]">
        <aside className="h-fit rounded-2xl border border-white/[0.08] bg-[#0a1a12]/70 p-3 lg:sticky lg:top-24">
          <p className="px-3 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[0.15em] text-white/35">Configuration</p>
          <a href="#services" className="flex items-center justify-between rounded-xl bg-white/[0.06] px-3 py-2.5 text-xs font-semibold text-white"><span className="flex items-center gap-2.5"><Server className="h-4 w-4 text-[#f0b445]" /> Services</span><ChevronRight className="h-3.5 w-3.5 text-white/30" /></a>
          <a href="#assistant" className="mt-1 flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-medium text-white/55 transition hover:bg-white/[0.04] hover:text-white"><Bot className="h-4 w-4" /> Assistant</a>
          <a href="#routing" className="mt-1 flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-medium text-white/55 transition hover:bg-white/[0.04] hover:text-white"><Mail className="h-4 w-4" /> Office routing</a>
          <a href="#data" className="mt-1 flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-medium text-white/55 transition hover:bg-white/[0.04] hover:text-white"><ShieldCheck className="h-4 w-4" /> Data & backup</a>
          <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.025] p-3">
            <div className="flex items-center gap-2 text-[11px] font-semibold text-white/70"><CircleHelp className="h-3.5 w-3.5 text-[#f0b445]" /> Need a hand?</div>
            <p className="mt-1.5 text-[10px] leading-relaxed text-white/40">Changes are stored in this browser and apply to the admin portal.</p>
          </div>
        </aside>

        <form onSubmit={handleSubmit} className="min-w-0 space-y-5">
          <section id="services" className="glass-panel scroll-mt-24 rounded-2xl p-5 sm:p-6">
            <SectionHeading icon={Server} title="Connected services" description="Local addresses used by the portal and student experience." />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-xl border border-[#f0b445]/25 bg-[#df9e28]/[0.06] p-4">
                <div className="flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-wider text-[#f0b445]">Admin console</span><CheckCircle2 className="h-4 w-4 text-emerald-400" /></div>
                <p className="mt-3 font-mono text-sm font-semibold text-white">localhost:{formData.adminPort}</p>
                <p className="mt-1 text-[11px] text-white/45">Current dashboard instance</p>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4">
                <div className="flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-wider text-white/55">Student chatbot</span><span className="h-2 w-2 rounded-full bg-emerald-400" /></div>
                <p className="mt-3 font-mono text-sm font-semibold text-white">localhost:{formData.studentPort}</p>
                <p className="mt-1 text-[11px] text-white/45">Student facing assistant</p>
                <a href={`http://localhost:${formData.studentPort}`} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#f0b445] hover:text-white">Open student app <ExternalLink className="h-3 w-3" /></a>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4 sm:col-span-2 xl:col-span-1">
                <div className="flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-wider text-white/55">Server API</span><span className="h-2 w-2 rounded-full bg-emerald-400" /></div>
                <p className="mt-3 font-mono text-sm font-semibold text-white">localhost:{formData.serverPort}</p>
                <p className="mt-1 text-[11px] text-white/45">Application and database service</p>
              </div>
            </div>
          </section>

          <section id="assistant" className="glass-panel scroll-mt-24 rounded-2xl p-5 sm:p-6">
            <SectionHeading icon={Sparkles} title="Assistant experience" description="Shape the name and first responses students see in chat." />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Assistant display name" value={formData.botName} onChange={(value) => update('botName', value)} placeholder="Bexie" />
              <Field label="Role or short description" value={formData.botRole} onChange={(value) => update('botRole', value)} placeholder="Your campus guide" />
              <label className="block sm:col-span-2"><span className={labelClass}>Welcome message</span><textarea rows={3} value={formData.aiGreeting} onChange={(event) => update('aiGreeting', event.target.value)} className={`${inputClass} resize-y leading-relaxed`} /></label>
              <label className="block sm:col-span-2"><span className={labelClass}>When an answer is outside the knowledge base</span><textarea rows={3} value={formData.aiFallbackResponse} onChange={(event) => update('aiFallbackResponse', event.target.value)} className={`${inputClass} resize-y leading-relaxed`} /></label>
            </div>
          </section>

          <section id="routing" className="glass-panel scroll-mt-24 rounded-2xl p-5 sm:p-6">
            <SectionHeading icon={Mail} title="Office contact routing" description="Escalation email addresses for questions that need staff follow up." />
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <Field label="Office of the Registrar" type="email" value={formData.escalationEmailRegistrar} onChange={(value) => update('escalationEmailRegistrar', value)} />
              <Field label="Cashier & Finance" type="email" value={formData.escalationEmailCashier} onChange={(value) => update('escalationEmailCashier', value)} />
              <Field label="Hawak Kamay Scholarships" type="email" value={formData.escalationEmailScholarship} onChange={(value) => update('escalationEmailScholarship', value)} />
            </div>
          </section>

          <section id="data" className="glass-panel scroll-mt-24 rounded-2xl p-5 sm:p-6">
            <SectionHeading icon={ShieldCheck} title="Data & backup" description="Export a local backup or restore the portal to its starting state." />
            <div className="flex flex-col justify-between gap-4 rounded-xl border border-white/[0.07] bg-white/[0.025] p-4 sm:flex-row sm:items-center">
              <div><p className="text-sm font-semibold text-white">Export a system backup</p><p className="mt-1 text-xs text-white/45">Download settings and portal records as a JSON file.</p></div>
              <button type="button" onClick={onExportData} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-xs font-semibold text-white/80 transition hover:bg-white/10 hover:text-white"><Download className="h-4 w-4" /> Export backup</button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={onResetDefaults} className="inline-flex items-center gap-2 rounded-xl border border-[#f0b445]/25 bg-[#df9e28]/[0.08] px-3.5 py-2.5 text-xs font-semibold text-[#f0b445] transition hover:bg-[#df9e28]/[0.16]"><RotateCcw className="h-3.5 w-3.5" /> Reset to defaults</button>
              {onWipeBlank && <button type="button" onClick={onWipeBlank} className="inline-flex items-center gap-2 rounded-xl border border-rose-400/20 bg-rose-500/[0.06] px-3.5 py-2.5 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/[0.12]">Wipe all records</button>}
            </div>
          </section>

          <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#0a1a12]/95 p-3 shadow-2xl shadow-black/30 backdrop-blur-xl sm:px-4">
            <p className="flex items-center gap-2 text-xs text-white/45">{savedSuccess ? <><Check className="h-4 w-4 text-emerald-400" /> <span className="text-emerald-300">Your settings have been saved.</span></> : 'Remember to save your changes.'}</p>
            <button type="submit" className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#df9e28] to-[#f0b445] px-5 py-2.5 text-xs font-extrabold text-[#08170f] shadow-lg shadow-black/20 transition hover:brightness-110"><Save className="h-4 w-4" /> Save changes</button>
          </div>
        </form>
      </div>
    </div>
  )
}
