import { useMemo, useState } from 'react'
import { CheckCircle2, Clock, Eye, Filter, MessageSquareText, Search, Send, X } from 'lucide-react'
import './support-inquiries.css'

const statuses = ['Waiting for Support', 'Assigned', 'Live Chat', 'Resolved', 'Ended by Student']

function statusClass(status) {
  if (status === 'Resolved' || status === 'Ended by Student') return 'is-resolved'
  if (status === 'Waiting for Support') return 'is-waiting'
  if (status === 'Assigned') return 'is-assigned'
  return 'is-live'
}

export default function SupportInquiriesView({ inquiries, adminId, loading, error, onAccept, onReply, onResolve }) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [selectedId, setSelectedId] = useState(null)
  const [reply, setReply] = useState('')
  const [replyRequestId, setReplyRequestId] = useState('')
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')

  const filtered = useMemo(() => inquiries.filter((item) => {
    const query = search.toLowerCase()
    const matches = [item.studentName, item.studentId, item.query].some((value) => value.toLowerCase().includes(query))
    return matches && (statusFilter === 'All' || item.status === statusFilter)
  }), [inquiries, search, statusFilter])
  const selected = inquiries.find((item) => item.id === selectedId) || null
  const assignedElsewhere = Boolean(selected?.assignedTo && selected.assignedTo !== adminId)

  const perform = async (action) => {
    setBusy(true)
    setActionError('')
    try { await action() }
    catch (actionFailure) { setActionError(actionFailure.message || 'The action could not be completed.') }
    finally { setBusy(false) }
  }

  const closeDialog = () => {
    setSelectedId(null)
    setReply('')
    setReplyRequestId('')
    setActionError('')
  }

  const submitReply = (event) => {
    event.preventDefault()
    const text = reply.trim()
    if (!text || !selected) return
    const clientMessageId = replyRequestId || `admin-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`
    setReplyRequestId(clientMessageId)
    void perform(async () => {
      await onReply(selected.conversationId, text, clientMessageId)
      setReply('')
      setReplyRequestId('')
    })
  }

  return (
    <section className="support-admin-page">
      <header className="support-admin-heading">
        <div>
          <h1>Live Support Conversations <span>{inquiries.length} conversations</span></h1>
          <p>Review student questions and reply directly in the authenticated live chat queue.</p>
        </div>
      </header>

      {error && <p className="support-admin-alert" role="alert">{error}</p>}

      <div className="support-admin-filters">
        <label className="support-admin-search"><Search aria-hidden="true" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by student, email, or question..." aria-label="Search support conversations" /></label>
        <label className="support-admin-status-filter"><Filter aria-hidden="true" /><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter by status"><option value="All">All statuses</option>{statuses.map((status) => <option key={status}>{status}</option>)}</select></label>
      </div>

      <div className="support-admin-table-wrap">
        <div className="support-admin-table-scroll">
          <table className="support-admin-table">
            <thead><tr><th>Student</th><th>Current question</th><th>Status</th><th>Last activity</th><th>Actions</th></tr></thead>
            <tbody>{filtered.map((item) => (
              <tr key={item.conversationId}>
                <td><strong>{item.studentName}</strong><small>{item.studentId}</small></td>
                <td className="support-question-cell"><strong title={item.query}>{item.query}</strong><small>{item.responseSnippet}</small></td>
                <td><span className={`support-status-pill ${statusClass(item.status)}`}>{['Resolved', 'Ended by Student'].includes(item.status) ? <CheckCircle2 /> : <Clock />}{item.status}</span></td>
                <td className="support-time-cell">{item.timestamp}</td>
                <td><button type="button" className="support-review-button" onClick={() => { setSelectedId(item.id); setActionError('') }}><Eye />Review</button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        {!filtered.length && <div className="support-admin-empty"><MessageSquareText /><strong>{loading ? 'Loading support conversations…' : 'No matching support conversations'}</strong><p>New live chat requests will appear here automatically.</p></div>}
      </div>

      {selected && (
        <div className="support-admin-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDialog() }}>
          <section className="support-admin-dialog" role="dialog" aria-modal="true" aria-labelledby="support-dialog-title">
            <header className="support-admin-dialog-header"><div><h2 id="support-dialog-title">Support conversation</h2><p>{selected.studentName} · {selected.studentId}</p></div><button type="button" onClick={closeDialog} aria-label="Close conversation"><X /></button></header>
            <div className="support-admin-transcript">
              <div className="support-original-question"><span>Current question</span><p>{selected.currentQuestion || selected.query}</p></div>
              <div className="support-original-question"><span>Original question</span><p>{selected.originalQuestion || selected.query}</p></div>
              {selected.messages.map((message) => {
                const isAdmin = message.sender === 'admin'
                const time = message.createdAt ? new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
                return <div key={message.clientMessageId || message._id} className={`support-transcript-row ${isAdmin ? 'from-admin' : ''}`}>
                  <div className={`support-transcript-message ${isAdmin ? 'from-admin' : message.sender === 'student' ? 'from-student' : 'from-assistant'}`}>
                    <div><strong>{isAdmin ? 'Support Admin (You)' : message.senderName || (message.sender === 'assistant' ? 'UPangAssist Bot' : 'Student')}</strong>{time && <time>{time}</time>}</div>
                    <p>{message.text}</p>
                  </div>
                </div>
              })}
            </div>
            {actionError && <p className="support-admin-action-error" role="alert">{actionError}</p>}
            <footer className="support-admin-dialog-footer">
              {!['Resolved', 'Ended by Student'].includes(selected.status) && !assignedElsewhere && <>
                {selected.status === 'Waiting for Support' && <button type="button" className="support-accept-button" disabled={busy} onClick={() => void perform(() => onAccept(selected.conversationId))}>{busy ? 'Accepting…' : 'Accept conversation'}</button>}
                <form onSubmit={submitReply}>
                  <input value={reply} onChange={(event) => { setReplyRequestId(''); setReply(event.target.value) }} maxLength={2000} placeholder="Write a reply to the student..." aria-label="Support reply" disabled={busy || selected.status === 'Waiting for Support'} />
                  <button type="submit" aria-label="Send reply" disabled={busy || !reply.trim() || selected.status === 'Waiting for Support'}><Send /></button>
                </form>
              </>}
              {assignedElsewhere && !['Resolved', 'Ended by Student'].includes(selected.status) && <p className="support-assigned-note">This conversation is assigned to another administrator.</p>}
              {!['Resolved', 'Ended by Student'].includes(selected.status) && <button type="button" className="support-resolve-button" disabled={busy || assignedElsewhere} onClick={() => void perform(() => onResolve(selected.conversationId))}>{busy ? 'Updating…' : 'Resolve conversation'}</button>}
            </footer>
          </section>
        </div>
      )}
    </section>
  )
}
