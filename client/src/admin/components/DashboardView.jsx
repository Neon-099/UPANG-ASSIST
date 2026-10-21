import { AlertCircle, BookOpen, CheckCircle2, Clock3, MessageSquare, Sparkles } from 'lucide-react'

const STATUS_GROUPS = [
  { label: 'Waiting for support', statuses: ['Waiting for Support'], color: 'amber' },
  { label: 'Assigned', statuses: ['Assigned'], color: 'gold' },
  { label: 'Live chats', statuses: ['Live Chat'], color: 'green' },
  { label: 'Resolved', statuses: ['Resolved', 'Ended by Student'], color: 'muted' },
]

export const DashboardView = ({ inquiries, knowledgeItems, onNavigateTab, onOpenAddKnowledge }) => {
  const openInquiries = inquiries.filter((item) => ['Waiting for Support', 'Assigned', 'Live Chat'].includes(item.status)).length
  const resolvedInquiries = inquiries.filter((item) => ['Resolved', 'Ended by Student'].includes(item.status)).length
  const waitingInquiries = inquiries.filter((item) => item.status === 'Waiting for Support').length

  const summaries = [
    { label: 'Support inquiries', value: inquiries.length, note: 'All recorded conversations', icon: MessageSquare, tone: 'gold' },
    { label: 'Need attention', value: openInquiries, note: `${waitingInquiries} waiting for an administrator`, icon: AlertCircle, tone: 'amber' },
    { label: 'Resolved support', value: resolvedInquiries, note: 'Resolved or ended by student', icon: CheckCircle2, tone: 'green' },
    { label: 'Knowledge entries', value: knowledgeItems.length, note: 'Available in the knowledge base', icon: BookOpen, tone: 'teal' },
  ]

  return (
    <div className="admin-view-stack admin-dashboard-view min-w-0">
      <header className="flex flex-wrap items-end justify-between gap-4 rounded-3xl border border-[#df9e28]/40 bg-gradient-to-r from-[#0d261a] via-[#163d2a] to-[#0a1a12] p-6 shadow-2xl">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-[#df9e28]/40 bg-[#df9e28]/20 px-3 py-1 text-xs font-bold text-[#f0b445]"><Sparkles className="h-3.5 w-3.5" />PHINMA UPang · Dagupan City Campus</span>
          <h1 className="mt-3 text-xl font-black tracking-tight text-white md:text-2xl">Admin Dashboard</h1>
          <p className="mt-1 text-sm text-white/60">A summary of recorded support activity and knowledge resources.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => onNavigateTab('inquiries')} className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-xs font-bold text-white/80 hover:bg-white/10">View support inquiries</button>
          <button type="button" onClick={onOpenAddKnowledge} className="rounded-xl bg-gradient-to-r from-[#df9e28] to-[#f0b445] px-4 py-2.5 text-xs font-extrabold text-[#08170f] shadow-lg">Add knowledge entry</button>
        </div>
      </header>

      <section aria-label="Summary totals" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaries.map(({ label, value, note, icon: Icon, tone }) => <article key={label} className="glass-card rounded-2xl p-5">
          <div className="flex items-center justify-between gap-3"><span className="text-xs font-semibold text-white/60">{label}</span><span className={`rounded-xl border p-2.5 ${tone === 'gold' ? 'border-[#df9e28]/30 bg-[#df9e28]/15 text-[#f0b445]' : tone === 'amber' ? 'border-amber-500/30 bg-amber-500/15 text-amber-400' : tone === 'green' ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-400' : 'border-teal-500/30 bg-teal-500/15 text-teal-400'}`}><Icon className="h-4 w-4" /></span></div>
          <strong className="mt-3 block text-3xl font-black text-white">{value}</strong><p className="mt-1 text-[11px] text-white/45">{note}</p>
        </article>)}
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section className="glass-panel rounded-3xl p-5" aria-labelledby="status-summary-title">
          <div className="mb-4"><h2 id="status-summary-title" className="text-sm font-extrabold text-white">Support status summary</h2><p className="mt-1 text-xs text-white/50">Counts from the current support inquiry list.</p></div>
          <div className="space-y-3">
            {STATUS_GROUPS.map((group) => {
              const count = inquiries.filter((item) => group.statuses.includes(item.status)).length
              const percent = inquiries.length ? Math.round((count / inquiries.length) * 100) : 0
              const color = group.color === 'green' ? 'bg-emerald-400' : group.color === 'amber' ? 'bg-amber-400' : group.color === 'gold' ? 'bg-[#f0b445]' : 'bg-white/50'
              return <div key={group.label}>
                <div className="mb-1.5 flex items-center justify-between gap-2 text-xs"><span className="text-white/75">{group.label}</span><span className="font-mono font-bold text-white">{count} <span className="font-normal text-white/40">({percent}%)</span></span></div>
                <div className="h-2 overflow-hidden rounded-full bg-white/10"><div className={`h-full rounded-full ${color}`} style={{ width: `${percent}%` }} /></div>
              </div>
            })}
          </div>
          <button type="button" onClick={() => onNavigateTab('inquiries')} className="mt-5 inline-flex items-center gap-2 border-t border-white/10 pt-4 text-xs font-bold text-[#f0b445] hover:underline"><Clock3 className="h-3.5 w-3.5" />Open support inbox ({openInquiries})</button>
        </section>

      </div>
    </div>
  )
}
