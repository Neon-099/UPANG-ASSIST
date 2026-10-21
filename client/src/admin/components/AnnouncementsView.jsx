import { useState } from 'react'
import { Archive, ChevronLeft, ChevronRight, Megaphone, Plus, Save, Trash2, X } from 'lucide-react'

const CATEGORIES = [
  { id: 'campus', label: 'Campus' },
  { id: 'academic', label: 'Academic' },
  { id: 'urgent', label: 'Urgent' },
  { id: 'events', label: 'Events' },
]
const TITLE_MAX_LENGTH = 100
const DESCRIPTION_MAX_LENGTH = 500

function toLocalDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

const fieldClass = 'mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-[#f0b445]/70'

const PAGE_SIZE = 8

export default function AnnouncementsView({ announcements, loading, onSave, onRestore, onArchiveMany, onDeleteMany }) {
  const [editingId, setEditingId] = useState(null)
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [category, setCategory] = useState('campus')
  const [link, setLink] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [status, setStatus] = useState('draft')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const filteredAnnouncements = announcements.filter((item) => {
    const expectedStatus = statusFilter === 'public' ? 'published' : statusFilter === 'archive' ? 'archived' : statusFilter
    return (statusFilter === 'all' || item.status === expectedStatus)
      && (categoryFilter === 'all' || item.category === categoryFilter)
  })
  const pageCount = Math.max(1, Math.ceil(filteredAnnouncements.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const pageItems = filteredAnnouncements.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const pageIds = pageItems.map((item) => item._id)
  const selectedOnPage = pageIds.filter((id) => selectedIds.has(id)).length
  const archivableSelectedCount = announcements.filter((item) => selectedIds.has(item._id) && item.status !== 'archived').length

  const toggleSelected = (id) => setSelectedIds((current) => {
    const next = new Set(current)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  const togglePageSelection = () => setSelectedIds((current) => {
    const next = new Set(current)
    if (selectedOnPage === pageIds.length) pageIds.forEach((id) => next.delete(id))
    else pageIds.forEach((id) => next.add(id))
    return next
  })

  const deleteSelected = async () => {
    if (!selectedIds.size || !window.confirm(`Delete ${selectedIds.size} selected announcement${selectedIds.size === 1 ? '' : 's'}? This also removes their notification receipts.`)) return
    const deleted = await onDeleteMany([...selectedIds])
    if (deleted) setSelectedIds(new Set())
  }

  const archiveSelected = async () => {
    if (!archivableSelectedCount || !window.confirm(`Archive ${archivableSelectedCount} selected announcement${archivableSelectedCount === 1 ? '' : 's'}? Archived announcements are permanently deleted after 3 days unless restored.`)) return
    const archived = await onArchiveMany([...selectedIds])
    if (archived) setSelectedIds(new Set())
  }

  const reset = () => {
    setEditingId(null); setTitle(''); setMessage(''); setCategory('campus'); setLink(''); setExpiresAt(''); setStatus('draft'); setFormError('')
  }

  const edit = (item) => {
    setEditingId(item._id); setTitle(item.title); setMessage(item.message); setCategory(item.category)
    setLink(item.link || ''); setExpiresAt(toLocalDate(item.expiresAt)); setStatus(item.status)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const submit = async (event) => {
    event.preventDefault()
    if (title.trim().length > TITLE_MAX_LENGTH) {
      setFormError(`Title must be ${TITLE_MAX_LENGTH} characters or fewer.`)
      return
    }
    if (message.trim().length > DESCRIPTION_MAX_LENGTH) {
      setFormError(`Description must be ${DESCRIPTION_MAX_LENGTH} characters or fewer.`)
      return
    }
    if (!title.trim() || !message.trim()) {
      setFormError('Title and description are required.')
      return
    }
    setFormError('')
    setSaving(true)
    try {
      const saved = await onSave(editingId, { title, message, category, link, expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null, status })
      if (saved) reset()
    } finally { setSaving(false) }
  }

  const setItemStatus = async (item, nextStatus) => {
    await onSave(item._id, { title: item.title, message: item.message, category: item.category, link: item.link || '', expiresAt: item.expiresAt || null, status: nextStatus })
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#f0b445]">Campus communications</p><h1 className="mt-1 text-2xl font-extrabold text-white">Announcements</h1><p className="mt-1 text-sm text-white/60">Publish updates that appear in signed-in students’ notification inboxes.</p></div>
        {!editingId && <button type="button" onClick={reset} className="inline-flex items-center gap-2 rounded-xl border border-[#f0b445]/40 bg-[#f0b445]/10 px-4 py-2.5 text-sm font-bold text-[#f0b445]"><Plus className="h-4 w-4" />New announcement</button>}
      </header>

      <form onSubmit={submit} className="rounded-2xl border border-white/10 bg-white/[.03] p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between"><h2 className="font-bold text-white">{editingId ? 'Edit announcement' : 'Create announcement'}</h2>{editingId && <button type="button" onClick={reset} className="rounded-lg p-1 text-white/60 hover:bg-white/10" aria-label="Cancel editing"><X className="h-4 w-4" /></button>}</div>
        {formError && <p className="mb-4 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs text-red-200" role="alert">{formError}</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-xs font-semibold text-white/70">Title<input className={fieldClass} value={title} maxLength={TITLE_MAX_LENGTH} onChange={(event) => setTitle(event.target.value)} required /><span className="mt-1 block text-[11px] text-white/45">{title.length}/{TITLE_MAX_LENGTH} characters</span></label>
          <label className="text-xs font-semibold text-white/70">Category<select className={fieldClass} value={category} onChange={(event) => setCategory(event.target.value)}>{CATEGORIES.map((item) => <option key={item.id} value={item.id} className="bg-[#0e2116]">{item.label}</option>)}</select></label>
          <label className="text-xs font-semibold text-white/70 sm:col-span-2">Description<textarea className={`${fieldClass} min-h-32 resize-y`} value={message} maxLength={DESCRIPTION_MAX_LENGTH} onChange={(event) => setMessage(event.target.value)} required /><span className="mt-1 block text-[11px] text-white/45">{message.length}/{DESCRIPTION_MAX_LENGTH} characters</span></label>
          <label className="text-xs font-semibold text-white/70">Optional HTTPS link or app path<input className={fieldClass} value={link} maxLength={500} placeholder="https://… or /student-page" onChange={(event) => setLink(event.target.value)} /></label>
          <label className="text-xs font-semibold text-white/70">Optional expiry date<input className={fieldClass} type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} /></label>
          <label className="text-xs font-semibold text-white/70">Status<select className={fieldClass} value={status} onChange={(event) => setStatus(event.target.value)} disabled={Boolean(editingId)}><option value="draft" className="bg-[#0e2116]">Draft</option><option value="published" className="bg-[#0e2116]">Published</option><option value="archived" className="bg-[#0e2116]">Archived</option></select>{editingId && <span className="mt-1 block text-[11px] text-white/45">Use the announcement actions to publish or archive. Archived announcements cannot be published again.</span>}</label>
        </div>
        <div className="mt-5 flex flex-wrap gap-2"><button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-[#f0b445] px-4 py-2.5 text-sm font-extrabold text-[#0a1a12] disabled:opacity-50"><Save className="h-4 w-4" />{saving ? 'Saving…' : editingId ? 'Save changes' : 'Create announcement'}</button>{editingId && <button type="button" onClick={reset} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-white/70">Cancel</button>}</div>
      </form>

      <div className="space-y-3">
        <div className="rounded-2xl border border-white/10 bg-white/[.025] p-4 sm:p-5">
          <h2 className="font-bold text-white">Announcement access</h2>
          <p className="mb-3 mt-1 text-xs text-white/50">Browse public announcements, drafts, or archived items.</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { id: 'all', label: 'All announcements', count: announcements.length },
              { id: 'public', label: 'Public', count: announcements.filter((item) => item.status === 'published').length },
              { id: 'draft', label: 'Drafts', count: announcements.filter((item) => item.status === 'draft').length },
              { id: 'archive', label: 'Archive', count: announcements.filter((item) => item.status === 'archived').length },
            ].map((item) => <button key={item.id} type="button" aria-pressed={statusFilter === item.id} onClick={() => { setStatusFilter(item.id); setPage(1) }} className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left transition-colors ${statusFilter === item.id ? 'border-[#f0b445]/50 bg-[#f0b445]/10 text-[#f0b445]' : 'border-white/10 bg-white/[.02] text-white/70 hover:border-white/20 hover:bg-white/[.05]'}`}><span className="text-xs font-bold">{item.label}</span><span className="rounded-full bg-black/20 px-2 py-0.5 text-[10px] font-bold">{item.count}</span></button>)}
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[.025] p-4 sm:p-5">
          <h2 className="font-bold text-white">Topics</h2>
          <p className="mb-3 mt-1 text-xs text-white/50">Narrow the current view by announcement category.</p>
          <div className="flex flex-wrap gap-2">
            {[{ id: 'all', label: 'All topics' }, ...CATEGORIES].map((item) => <button key={item.id} type="button" aria-pressed={categoryFilter === item.id} onClick={() => { setCategoryFilter(item.id); setPage(1) }} className={`rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${categoryFilter === item.id ? 'border-[#f0b445]/50 bg-[#f0b445]/10 text-[#f0b445]' : 'border-white/10 text-white/65 hover:bg-white/5'}`}>{item.label}{item.id !== 'all' && <span className="ml-2 text-[10px] opacity-60">{announcements.filter((entry) => entry.category === item.id).length}</span>}</button>)}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold text-white">{statusFilter === 'public' ? 'Public announcements' : statusFilter === 'archive' ? 'Archived announcements' : statusFilter === 'draft' ? 'Draft announcements' : 'All announcements'}{categoryFilter !== 'all' ? ` · ${CATEGORIES.find((item) => item.id === categoryFilter)?.label}` : ''}</h2><span className="text-xs text-white/50">{filteredAnnouncements.length} shown · {announcements.length} total</span></div><div className="flex flex-wrap items-center gap-2">{selectedIds.size > 0 && <><button type="button" onClick={() => void archiveSelected()} disabled={!archivableSelectedCount} className="inline-flex items-center gap-2 rounded-lg border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-xs font-bold text-amber-200 hover:bg-amber-300/20 disabled:cursor-not-allowed disabled:opacity-40"><Archive className="h-4 w-4" />Archive selected ({archivableSelectedCount})</button><button type="button" onClick={() => void deleteSelected()} className="inline-flex items-center gap-2 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs font-bold text-red-300 hover:bg-red-400/20"><Trash2 className="h-4 w-4" />Delete selected ({selectedIds.size})</button></>}<label className="flex cursor-pointer items-center gap-2 text-xs text-white/60"><input type="checkbox" checked={pageIds.length > 0 && selectedOnPage === pageIds.length} onChange={togglePageSelection} className="accent-[#f0b445]" />Select page</label></div></div>
        {loading && <p className="text-sm text-white/50">Loading announcements…</p>}
        {!loading && filteredAnnouncements.length === 0 && <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-sm text-white/50"><Megaphone className="mx-auto mb-2 h-6 w-6" />{announcements.length ? 'No announcements match these categories.' : 'No announcements yet.'}</div>}
        {pageItems.map((item) => <article key={item._id} className="rounded-2xl border border-white/10 bg-white/[.025] p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><div className="flex min-w-0 items-start gap-3"><input type="checkbox" aria-label={`Select ${item.title}`} checked={selectedIds.has(item._id)} onChange={() => toggleSelected(item._id)} className="mt-1 shrink-0 accent-[#f0b445]" /><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-white">{item.title}</h3><span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-bold uppercase text-white/60">{item.status}</span><span className="rounded-full bg-[#f0b445]/10 px-2 py-0.5 text-[10px] font-bold uppercase text-[#f0b445]">{item.category}</span></div><p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-white/65">{item.message}</p><p className="mt-3 text-[11px] text-white/40">Updated {new Date(item.updatedAt).toLocaleString()}{item.expiresAt ? ` · Expires ${new Date(item.expiresAt).toLocaleString()}` : ''}</p></div></div><div className="flex shrink-0 gap-2"><button type="button" onClick={() => edit(item)} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-white/75 hover:bg-white/10">Edit</button>{item.status === 'draft' && <button type="button" onClick={() => void setItemStatus(item, 'published')} className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-300">Publish</button>}{item.status === 'published' && <button type="button" onClick={() => void setItemStatus(item, 'archived')} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-white/60 hover:bg-white/10">Archive</button>}</div></div>
          {item.status === 'archived' && <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3"><p className="text-xs text-amber-200/75">Archived {item.archivedAt ? new Date(item.archivedAt).toLocaleString() : 'before the restore timer was added'}. Unrestored announcements are deleted after 3 days.</p><button type="button" onClick={() => void onRestore(item._id)} className="rounded-lg border border-sky-300/30 bg-sky-300/10 px-3 py-1.5 text-xs font-semibold text-sky-200 hover:bg-sky-300/20">Restore as draft</button></div>}
        </article>)}
        {!loading && filteredAnnouncements.length > PAGE_SIZE && <nav className="flex items-center justify-between border-t border-white/10 pt-4" aria-label="Announcement pages"><p className="text-xs text-white/50">Page {currentPage} of {pageCount} · Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredAnnouncements.length)} of {filteredAnnouncements.length}</p><div className="flex gap-2"><button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={currentPage === 1} className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-white/70 disabled:opacity-40"><ChevronLeft className="h-4 w-4" />Previous</button><button type="button" onClick={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={currentPage === pageCount} className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-white/70 disabled:opacity-40">Next<ChevronRight className="h-4 w-4" /></button></div></nav>}
      </div>
    </section>
  )
}
