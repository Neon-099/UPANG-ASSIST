import React, { useState } from 'react'
import { CheckCircle2, Clock, Eye, Filter, MessageSquareText, Search, Send, X } from 'lucide-react'
import type { InquiryLog } from '../types'

interface InquiriesViewProps {
  inquiries: InquiryLog[]
  adminId: string
  onAccept: (id: string) => Promise<void>
  onReply: (id: string, text: string, clientMessageId: string) => Promise<void>
  onResolve: (id: string) => Promise<void>
}

const statuses: InquiryLog['status'][] = ['Waiting for Support', 'Assigned', 'Live Chat', 'Resolved', 'Ended by Student']

function statusStyle(status: InquiryLog['status']) {
  if (status === 'Resolved' || status === 'Ended by Student') return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
  if (status === 'Waiting for Support') return 'bg-amber-500/20 text-amber-300 border-amber-500/40'
  if (status === 'Assigned') return 'bg-sky-500/20 text-sky-300 border-sky-500/40'
  return 'bg-violet-500/20 text-violet-300 border-violet-500/40'
}

export const InquiriesView: React.FC<InquiriesViewProps> = ({
  inquiries,
  adminId,
  onAccept,
  onReply,
  onResolve,
}) => {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('All')
  const [selectedInquiry, setSelectedInquiry] = useState<InquiryLog | null>(null)
  const [reply, setReply] = useState('')
  const [replyRequestId, setReplyRequestId] = useState('')
  const [actionBusy, setActionBusy] = useState(false)
  const [actionError, setActionError] = useState('')

  const filtered = inquiries.filter((inquiry) => {
    const matchesSearch = [inquiry.studentName, inquiry.studentId, inquiry.query]
      .some((value) => value.toLowerCase().includes(search.toLowerCase()))
    return matchesSearch && (statusFilter === 'All' || inquiry.status === statusFilter)
  })

  const runAction = async (action: () => Promise<void>) => {
    setActionBusy(true)
    setActionError('')
    try {
      await action()
      if (selectedInquiry) {
        setSelectedInquiry(inquiries.find((item) => item.id === selectedInquiry.id) || selectedInquiry)
      }
    } catch (error) {
      console.error('Support conversation action failed:', error)
      setActionError(error instanceof Error ? error.message : 'The action could not be completed.')
    } finally {
      setActionBusy(false)
    }
  }

  const selected = selectedInquiry
    ? inquiries.find((item) => item.id === selectedInquiry.id) || selectedInquiry
    : null
  const isAssignedToAnother = Boolean(selected?.assignedTo && selected.assignedTo !== adminId)

  return (
    <div className="min-w-0 space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-black tracking-tight text-white">Live Support Conversations</h1>
          <span className="rounded-full border border-[#df9e28]/40 bg-[#df9e28]/20 px-2.5 py-0.5 text-xs font-bold text-[#f0b445]">
            {inquiries.length} conversations
          </span>
        </div>
        <p className="mt-1 text-xs text-white/60">Review student questions and reply directly in the authenticated live chat queue.</p>
      </div>

      <div className="glass-panel flex flex-col items-stretch justify-between gap-3 rounded-2xl p-3 md:flex-row md:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by student, email, or question..."
            className="w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-10 pr-4 text-xs text-white placeholder-white/40 focus:border-[#f0b445] focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-[#f0b445]" />
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-xl border border-white/10 bg-[#08170f] px-3 py-2 text-xs text-white focus:border-[#f0b445] focus:outline-none"
          >
            <option value="All">All statuses</option>
            {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
        </div>
      </div>

      <div className="glass-panel overflow-hidden rounded-3xl">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead className="border-b border-white/10 text-[10px] font-bold uppercase tracking-wider text-white/50">
              <tr>
                <th className="px-4 py-3.5">Student</th>
                <th className="px-4 py-3.5">Original question</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5">Last activity</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map((inquiry) => (
                <tr key={inquiry.conversationId} className="transition-colors hover:bg-white/[0.04]">
                  <td className="px-4 py-3">
                    <div className="font-bold text-white">{inquiry.studentName}</div>
                    <div className="font-mono text-[10px] text-white/40">{inquiry.studentId}</div>
                  </td>
                  <td className="max-w-sm px-4 py-3">
                    <p className="truncate font-medium text-white/90" title={inquiry.query}>{inquiry.query}</p>
                    <p className="mt-0.5 truncate text-[11px] text-white/40">{inquiry.responseSnippet}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${statusStyle(inquiry.status)}`}>
                      {['Resolved', 'Ended by Student'].includes(inquiry.status) ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                      {inquiry.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-[11px] text-white/40">{inquiry.timestamp}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => { setSelectedInquiry(inquiry); setActionError('') }}
                      className="inline-flex items-center gap-1 rounded-xl border border-[#df9e28]/35 bg-[#df9e28]/15 px-3 py-1.5 text-xs font-bold text-[#f0b445] transition-colors hover:bg-[#df9e28]/25"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="py-16 text-center">
            <MessageSquareText className="mx-auto mb-2 h-8 w-8 text-white/30" />
            <p className="text-sm font-bold text-white">No matching support conversations</p>
            <p className="mt-1 text-xs text-white/50">New live chat requests will appear here automatically.</p>
          </div>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-4 backdrop-blur-md">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="support-dialog-title"
            className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-[#df9e28]/40 bg-[#0c2217] shadow-2xl sm:max-h-[calc(100dvh-2rem)]"
          >
            <header className="flex items-center justify-between gap-3 border-b border-white/10 p-3 sm:p-5">
              <div className="min-w-0">
                <h2 id="support-dialog-title" className="text-sm font-extrabold text-white">Support conversation</h2>
                <p className="mt-1 truncate text-xs text-white/50">{selected.studentName} · {selected.studentId}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedInquiry(null)}
                aria-label="Close conversation"
                className="rounded-xl p-2 text-white/60 hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 sm:p-5">
              <div className="rounded-2xl border border-[#df9e28]/35 bg-[#df9e28]/15 p-3.5">
                <span className="mb-1 block text-[10px] font-bold uppercase text-[#f0b445]">Original question</span>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-white">{selected.query}</p>
              </div>
              {selected.messages.map((message) => {
                const isAdmin = message.sender === 'admin'
                const isStudent = message.sender === 'student'
                const timeString = message.createdAt
                  ? (() => {
                      try {
                        const d = new Date(message.createdAt)
                        return isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      } catch {
                        return ''
                      }
                    })()
                  : ''

                return (
                  <div
                    key={message.clientMessageId || message._id}
                    className={`flex flex-col ${isAdmin ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl p-3.5 text-sm leading-relaxed shadow-sm transition-all ${
                        isAdmin
                          ? 'rounded-tr-xs border border-emerald-400/30 bg-emerald-500/20 text-emerald-50'
                          : isStudent
                            ? 'rounded-tl-xs border border-white/15 bg-white/10 text-white'
                            : 'rounded-tl-xs border border-amber-400/25 bg-amber-400/10 text-amber-100'
                      }`}
                    >
                      <div className="mb-1 flex items-center gap-2">
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider ${
                            isAdmin ? 'text-emerald-300' : 'text-[#f0b445]'
                          }`}
                        >
                          {isAdmin
                            ? 'Support Admin (You)'
                            : message.senderName || (message.sender === 'assistant' ? 'UPangAssist Bot' : 'Student')}
                        </span>
                        {timeString && (
                          <span className="text-[10px] text-white/40">
                            {timeString}
                          </span>
                        )}
                      </div>
                      <p className="whitespace-pre-wrap">{message.text}</p>
                    </div>
                  </div>
                )
              })}
            </div>

            {actionError && <p role="alert" className="mx-5 rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs text-red-200">{actionError}</p>}

            <footer className="space-y-3 border-t border-white/10 p-3 sm:p-5">
              {!['Resolved', 'Ended by Student'].includes(selected.status) && !isAssignedToAnother && (
                <>
                  {selected.status === 'Waiting for Support' && (
                    <button
                      type="button"
                      disabled={actionBusy}
                      onClick={() => void runAction(() => onAccept(selected.conversationId))}
                      className="rounded-xl bg-[#f0b445] px-4 py-2 text-xs font-extrabold text-[#08170f] disabled:opacity-60"
                    >
                      {actionBusy ? 'Accepting…' : 'Accept conversation'}
                    </button>
                  )}
                  <form
                    className="flex gap-2"
                    onSubmit={(event) => {
                      event.preventDefault()
                      const text = reply.trim()
                      if (!text) return
                      const clientMessageId = replyRequestId
                        || `admin-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`
                      setReplyRequestId(clientMessageId)
                      void runAction(async () => {
                        await onReply(selected.conversationId, text, clientMessageId)
                        setReply('')
                        setReplyRequestId('')
                      })
                    }}
                  >
                    <input
                      value={reply}
                      onChange={(event) => {
                        setReplyRequestId('')
                        setReply(event.target.value)
                      }}
                      maxLength={2000}
                      placeholder="Write a reply to the student..."
                      aria-label="Support reply"
                      disabled={actionBusy || selected.status === 'Waiting for Support'}
                      className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none focus:border-[#f0b445] disabled:opacity-50"
                    />
                    <button
                      type="submit"
                      aria-label="Send reply"
                      disabled={actionBusy || !reply.trim() || selected.status === 'Waiting for Support'}
                      className="rounded-xl bg-emerald-500 px-3 text-white disabled:opacity-40"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </form>
                </>
              )}
              {isAssignedToAnother && !['Resolved', 'Ended by Student'].includes(selected.status) && (
                <p className="text-xs text-amber-200">This conversation is assigned to another administrator.</p>
              )}
              {!['Resolved', 'Ended by Student'].includes(selected.status) && (
                <button
                  type="button"
                  disabled={actionBusy || isAssignedToAnother}
                  onClick={() => void runAction(() => onResolve(selected.conversationId))}
                  className="rounded-xl border border-white/15 px-4 py-2 text-xs font-bold text-white/70 hover:bg-white/10 disabled:opacity-40"
                >
                  {actionBusy ? 'Updating…' : 'Resolve conversation'}
                </button>
              )}
            </footer>
          </section>
        </div>
      )}
    </div>
  )
}
