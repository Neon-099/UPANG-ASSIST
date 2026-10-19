import React from 'react'
import {
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  Plus,
} from 'lucide-react'
import type { InquiryLog, KnowledgeItem } from '../types'
import type { AdminTab } from '../types'

interface DashboardViewProps {
  inquiries: InquiryLog[]
  knowledgeItems: KnowledgeItem[]
  onNavigateTab: (tab: AdminTab) => void
  onOpenAddKnowledge: () => void
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  inquiries,
  knowledgeItems,
  onNavigateTab,
  onOpenAddKnowledge,
}) => {

  const escalations = inquiries.filter((inquiry) => (
    inquiry.status === 'Waiting for Support' || inquiry.status === 'Assigned'
  )).length
  const categoryCounts = [...new Set(inquiries.map((inquiry) => inquiry.category))].map((category) => ({
    name: category,
    count: inquiries.filter((inquiry) => inquiry.category === category).length,
    pct: inquiries.length
      ? Math.round((inquiries.filter((inquiry) => inquiry.category === category).length / inquiries.length) * 100)
      : 0,
    color: 'bg-[#10b981]',
  }))

  return (
    <div className="min-w-0 space-y-6">
      {/* Top Banner & Quick Controls matching user UI hero block */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-[#0d261a] via-[#163d2a] to-[#0a1a12] rounded-3xl p-6 border border-[#df9e28]/40 shadow-2xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-[radial-gradient(circle_at_center,rgba(240,180,69,0.18)_0,transparent_70%)] pointer-events-none" />
        <div className="relative z-10">
          <div className="inline-flex flex-wrap items-center gap-2 px-3 py-1 rounded-full bg-[#df9e28]/20 border border-[#df9e28]/40 text-[#f0b445] text-xs font-bold mb-2">
            <Sparkles className="w-3.5 h-3.5 text-[#f0b445]" />
            <span>PHINMA UPang • Dagupan City Campus</span>
          </div>
          <h1 className="text-xl md:text-2xl font-black tracking-tight text-white">
            Admin Command Center
          </h1>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-2.5">
          <button
            onClick={onOpenAddKnowledge}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-[#df9e28] to-[#f0b445] hover:brightness-110 text-[#08170f] transition-all shadow-lg shadow-black/30"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Add FAQ</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1 */}
        <div className="glass-card p-5 rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white/60">Total Inquiries Today</span>
            <div className="p-2.5 rounded-xl bg-[#df9e28]/15 border border-[#df9e28]/30 text-[#f0b445]">
              <MessageSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">{inquiries.length}</span>
          </div>
          <p className="mt-1 text-[11px] text-white/40">Recorded inquiries</p>
        </div>

        {/* Card 2 */}
        <div className="glass-card p-5 rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white/60">AI Resolution Rate</span>
            <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">—</span>
          </div>
          <p className="mt-1 text-[11px] text-white/40">No analytics available</p>
        </div>

        {/* Card 3 */}
        <div className="glass-card p-5 rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white/60">Office Escalations</span>
            <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">{escalations}</span>
          </div>
          <p className="mt-1 text-[11px] text-white/40">Waiting or assigned support</p>
        </div>

        {/* Card 4 */}
        <div className="glass-card p-5 rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white/60">Average AI Latency</span>
            <div className="p-2.5 rounded-xl bg-teal-500/15 border border-teal-500/30 text-teal-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">—</span>
          </div>
          <p className="mt-1 text-[11px] text-white/40">No analytics available</p>
        </div>
      </div>

      {/* Grid: Charts & Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly Traffic Chart */}
        <div className="lg:col-span-2 glass-panel p-5 rounded-3xl">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="text-sm font-extrabold text-white">Weekly Student Inquiry Traffic</h2>
              <p className="text-xs text-white/50">Number of campus questions processed per day</p>
            </div>
            <span className="text-xs font-mono bg-white/10 px-3 py-1 rounded-xl text-[#f0b445] font-bold border border-[#f0b445]/30">
              No data
            </span>
          </div>

          <div className="h-52 flex items-center justify-center border-b border-white/10">
            <p className="text-xs text-white/40">No weekly analytics available</p>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between text-xs text-white/60 gap-2">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]"></span> Inquiries Answered
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-white/30"></span> Total Capacity
              </span>
            </div>
            <span className="text-[#f0b445] font-semibold">{inquiries.length} inquiries recorded</span>
          </div>
        </div>

        {/* Top Category Distribution */}
        <div className="glass-panel p-5 rounded-3xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-extrabold text-white">Top Inquired Topics</h2>
              <button
                onClick={() => onNavigateTab('knowledge')}
                className="text-xs text-[#f0b445] hover:underline font-bold"
              >
                View FAQs
              </button>
            </div>
            <p className="text-xs text-white/50 mb-4">Breakdown of student questions by department</p>

            <div className="space-y-3.5">
              {categoryCounts.length === 0 && <p className="text-xs text-white/40">No inquiry data yet</p>}
              {categoryCounts.map((cat) => (
                <div key={cat.name}>
                  <div className="flex justify-between text-xs font-medium mb-1">
                    <span className="text-white/80 truncate pr-2">{cat.name}</span>
                    <span className="font-mono text-white font-bold">{cat.pct}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${cat.color}`}
                      style={{ width: `${cat.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-white/60">
            <span>Active Knowledge Items: <strong className="text-white">{knowledgeItems.length}</strong></span>
            <button
              onClick={onOpenAddKnowledge}
              className="font-bold text-[#f0b445] hover:underline"
            >
              + Add Entry
            </button>
          </div>
        </div>
      </div>

      {/* Recent Inquiries */}
      <div className="grid grid-cols-1 gap-6">

        <div className="lg:col-span-2 glass-panel p-5 rounded-3xl">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-extrabold text-white">Recent Student Inquiries</h2>
              <p className="text-xs text-white/50">Live chat queries processed by Bexie AI</p>
            </div>
            <button
              onClick={() => onNavigateTab('inquiries')}
              className="text-xs text-[#f0b445] hover:underline font-bold"
            >
              View All ({inquiries.length})
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-xs">
              <thead className="border-b border-white/10 text-white/50 font-semibold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="pb-2.5 font-bold">Student / ID</th>
                  <th className="pb-2.5 font-bold">Inquiry</th>
                  <th className="pb-2.5 font-bold">Category</th>
                  <th className="pb-2.5 font-bold">Status</th>
                  <th className="pb-2.5 font-bold text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {inquiries.slice(0, 5).map((inq) => (
                  <tr key={inq.id} className="hover:bg-white/[0.04] transition-colors">
                    <td className="py-2.5">
                      <div className="font-bold text-white">{inq.studentName}</div>
                      <div className="text-[10px] text-white/40 font-mono">{inq.studentId}</div>
                    </td>
                    <td className="py-2.5 max-w-[220px]">
                      <div className="truncate text-white/80 font-medium" title={inq.query}>
                        {inq.query}
                      </div>
                    </td>
                    <td className="py-2.5">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/10 text-white/70">
                        {inq.category.split(' ')[0]}
                      </span>
                    </td>
                    <td className="py-2.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          inq.status === 'Resolved'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                            : inq.status === 'Waiting for Support' || inq.status === 'Assigned'
                            ? 'bg-[#df9e28]/20 text-[#f0b445] border border-[#df9e28]/40'
                            : 'bg-white/10 text-white/70'
                        }`}
                      >
                        {inq.status}
                      </span>
                    </td>
                    <td className="py-2.5 text-right font-mono text-[11px] text-white/40 whitespace-nowrap">
                      {inq.timestamp}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
