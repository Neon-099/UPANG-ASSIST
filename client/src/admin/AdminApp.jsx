import { useCallback, useEffect, useState } from 'react'
import { Activity } from 'lucide-react'
import { apiRequest } from '../api'
import upangLogo from './assets/upang logo.png'
import { DashboardView } from './components/DashboardView'
import { KnowledgeBaseView } from './components/KnowledgeBaseView'
import SupportInquiriesView from './components/SupportInquiriesView'
import { Navbar } from './components/Navbar'
import { Sidebar } from './components/Sidebar'
import './admin.css'
import './admin-design.css'

function fromServerEntry(entry) {
  return {
    id: entry._id,
    title: entry.question,
    category: entry.category,
    keywords: entry.keywords || [],
    response: entry.answer,
    followUps: entry.followUps || [],
    visibility: entry.visibility || 'student',
    updatedAt: entry.lastUpdated || entry.updatedAt?.slice(0, 10) || '',
    viewsCount: 0,
  }
}

function toServerEntry(entry) {
  return {
    category: entry.category,
    question: entry.title,
    answer: entry.response,
    keywords: entry.keywords,
    followUps: entry.followUps,
    visibility: entry.visibility,
  }
}

function fromSupportConversation(conversation) {
  const statusLabels = {
    waiting_for_support: 'Waiting for Support',
    assigned: 'Assigned',
    live_chat: 'Live Chat',
    resolved: 'Resolved',
    ended_by_student: 'Ended by Student',
  }
  const assignedTo = typeof conversation.assignedTo === 'string'
    ? conversation.assignedTo
    : conversation.assignedTo?._id || null
  const timestamp = new Date(conversation.lastMessageAt || conversation.updatedAt || conversation.createdAt)
  return {
    id: String(conversation._id),
    conversationId: String(conversation._id),
    studentName: conversation.ownerName || 'Student',
    studentId: conversation.ownerEmail || '',
    query: conversation.question || '',
    responseSnippet: `${conversation.messages?.length || 0} messages`,
    category: 'General Campus Info',
    timestamp: Number.isNaN(timestamp.getTime()) ? '' : timestamp.toLocaleString(),
    rating: 0,
    status: statusLabels[conversation.status] || 'Waiting for Support',
    assignedTo: assignedTo ? String(assignedTo) : null,
    messages: conversation.messages || [],
  }
}

function AdminSignIn({ onSignedIn }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const data = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      if (data.user?.role !== 'admin') {
        await apiRequest('/auth/logout', { method: 'POST' }).catch(() => {})
        throw new Error('This account does not have administrator access.')
      }
      onSignedIn(data.user)
    } catch (requestError) {
      setError(requestError.message || 'Unable to sign in.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="admin-signin-shell">
      <form className="admin-signin-card" onSubmit={submit}>
        <img src={upangLogo} alt="PHINMA UPang" className="admin-signin-mark" />
        <p className="admin-kicker">PHINMA UNIVERSITY OF PANGASINAN</p>
        <h1>Administrator sign in</h1>
        <p className="admin-subtitle">Sign in with your verified PHINMA account to manage the assistant knowledge base.</p>
        <label>Email address<input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
        <label>Password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
        {error && <p className="admin-error" role="alert">{error}</p>}
        <button className="admin-primary-button" disabled={busy}>{busy ? 'Signing inâ€¦' : 'Sign in'}</button>
        <a href="/" className="admin-back-link">Return to UPang Assist</a>
      </form>
    </main>
  )
}

export default function AdminApp() {
  const [currentUser, setCurrentUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [currentTab, setCurrentTab] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [knowledgeItems, setKnowledgeItems] = useState([])
  const [supportInquiries, setSupportInquiries] = useState([])
  const [supportError, setSupportError] = useState('')
  const [supportLoading, setSupportLoading] = useState(false)
  const [isAddKnowledgeOpen, setIsAddKnowledgeOpen] = useState(false)
  const [error, setError] = useState('')
  const [loadingKnowledge, setLoadingKnowledge] = useState(false)

  useEffect(() => {
    document.body.classList.add('admin-mode')
    document.title = 'UPang Assist Admin'
    return () => {
      document.body.classList.remove('admin-mode')
      document.title = 'UPang Assist â€” PHINMA University of Pangasinan'
    }
  }, [])

  const loadKnowledge = useCallback(async () => {
    setLoadingKnowledge(true)
    try {
      const entries = await apiRequest('/admin/knowledge')
      setKnowledgeItems(entries.map(fromServerEntry))
      setError('')
    } catch (requestError) {
      setError(requestError.message || 'Unable to load chatbot knowledge.')
    } finally {
      setLoadingKnowledge(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    apiRequest('/auth/me')
      .then((data) => {
        if (active && data.user?.role === 'admin') {
          setCurrentUser(data.user)
          loadKnowledge()
        }
      })
      .catch((requestError) => {
        if (active && requestError.message !== 'Authentication required') setError(requestError.message)
      })
      .finally(() => { if (active) setAuthLoading(false) })
    return () => { active = false }
  }, [loadKnowledge])

  const loadSupportInquiries = useCallback(async () => {
    const data = await apiRequest('/support')
    setSupportInquiries((data.conversations || []).map(fromSupportConversation))
    setSupportError('')
  }, [])

  useEffect(() => {
    if (!currentUser) return undefined
    let active = true
    const refresh = async () => {
      try {
        if (active) setSupportLoading(true)
        await loadSupportInquiries()
      } catch (requestError) {
        if (active) setSupportError(requestError.message || 'Unable to load support conversations.')
      } finally {
        if (active) setSupportLoading(false)
      }
    }
    void refresh()
    const timer = window.setInterval(refresh, 15000)
    return () => { active = false; window.clearInterval(timer) }
  }, [currentUser, loadSupportInquiries])

  const saveKnowledge = async (method, id, entry) => {
    setError('')
    try {
      await apiRequest(`/admin/knowledge${id ? `/${encodeURIComponent(id)}` : ''}`, {
        method,
        body: JSON.stringify(toServerEntry(entry)),
      })
      await loadKnowledge()
    } catch (requestError) {
      setError(requestError.message || 'Unable to save knowledge entry.')
    }
  }

  const deleteKnowledge = async (id) => {
    if (!window.confirm('Delete this knowledge entry?')) return
    setError('')
    try {
      await apiRequest(`/admin/knowledge/${encodeURIComponent(id)}`, { method: 'DELETE' })
      await loadKnowledge()
    } catch (requestError) {
      setError(requestError.message || 'Unable to delete knowledge entry.')
    }
  }

  const updateSupportConversation = async (id, action, body = {}) => {
    setSupportError('')
    const data = await apiRequest(`/support/${encodeURIComponent(id)}/${action}`, {
      method: 'POST',
      body: JSON.stringify(body),
    })
    const updated = fromSupportConversation(data.conversation)
    setSupportInquiries((current) => [updated, ...current.filter((item) => item.conversationId !== id)])
  }

  const logout = async () => {
    try { await apiRequest('/auth/logout', { method: 'POST' }) } catch { /* clear local view when the API is unavailable */ }
    setCurrentUser(null)
    setKnowledgeItems([])
    setSupportInquiries([])
  }

  if (authLoading) return <main className="admin-loading"><Activity className="animate-spin" /><span>Checking administrator accessâ€¦</span></main>
  if (!currentUser) return <AdminSignIn onSignedIn={setCurrentUser} />

  return (
    <div className="min-h-screen flex flex-col font-sans text-white">
      <Navbar userName={currentUser.name || currentUser.email} inquiriesCount={supportInquiries.filter((item) => !['Resolved', 'Ended by Student'].includes(item.status)).length} onToggleSidebar={() => setSidebarOpen((open) => !open)} onNavigateTab={setCurrentTab} onLogout={logout} />
      <div className="flex min-w-0 flex-1">
        <Sidebar currentTab={currentTab} onSelectTab={setCurrentTab} isOpen={sidebarOpen} onCloseMobile={() => setSidebarOpen(false)} />
        <main className="admin-content min-w-0 w-full max-w-7xl mx-auto flex-1 overflow-x-hidden p-4 md:p-6 lg:p-8">
          {error && <div className="admin-api-error" role="alert">{error}<button type="button" onClick={() => setError('')} aria-label="Dismiss">Ã—</button></div>}
          {loadingKnowledge && <p className="admin-data-status" role="status">Loading the server knowledge baseâ€¦</p>}
          {currentTab === 'dashboard' && <DashboardView inquiries={supportInquiries} knowledgeItems={knowledgeItems} onNavigateTab={setCurrentTab} onOpenAddKnowledge={() => { setCurrentTab('knowledge'); setIsAddKnowledgeOpen(true) }} />}
          {currentTab === 'knowledge' && <KnowledgeBaseView items={knowledgeItems} onAddItem={(item) => saveKnowledge('POST', null, item)} onUpdateItem={(id, item) => saveKnowledge('PATCH', id, { ...knowledgeItems.find((entry) => entry.id === id), ...item })} onDeleteItem={deleteKnowledge} isAddModalOpen={isAddKnowledgeOpen} setIsAddModalOpen={setIsAddKnowledgeOpen} />}
          {currentTab === 'inquiries' && <SupportInquiriesView inquiries={supportInquiries} adminId={String(currentUser.id || currentUser._id)} loading={supportLoading} error={supportError} onAccept={(id) => updateSupportConversation(id, 'accept')} onReply={(id, text, clientMessageId) => updateSupportConversation(id, 'reply', { text, clientMessageId })} onResolve={(id) => updateSupportConversation(id, 'resolve')} />}
        </main>
      </div>
    </div>
  )
}

