import { useState, useEffect, type FormEvent } from 'react'
import { io } from 'socket.io-client'
import { Navbar } from './components/Navbar'
import { Sidebar } from './components/Sidebar'
import { DashboardView } from './components/DashboardView'
import { KnowledgeBaseView } from './components/KnowledgeBaseView'
import { InquiriesView } from './components/InquiriesView'
import { UsersView } from './components/UsersView'
import { SettingsView } from './components/SettingsView'
import upangLogo from './assets/upang logo.png'
import { INITIAL_KNOWLEDGE, INITIAL_USERS, INITIAL_SETTINGS } from './data/mockData'
import type { KnowledgeItem, InquiryLog, UserAccount, SystemSettings, AdminTab, SupportMessage } from './types'

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')
const socketBaseUrl = import.meta.env.VITE_SOCKET_URL
  || (apiBaseUrl.startsWith('http') ? new URL(apiBaseUrl).origin : undefined)

interface SupportConversationResponse {
  _id: string
  ownerName: string
  ownerEmail: string
  question: string
  status: 'waiting_for_support' | 'assigned' | 'live_chat' | 'resolved' | 'ended_by_student'
  assignedTo: string | { _id: string } | null
  messages: SupportMessage[]
  lastMessageAt: string
}

interface AuthUser {
  id: string
  name: string
  email: string
  accountType: string
}

async function apiRequest<T>(
  path: string,
  token: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'The request could not be completed.')
  return data as T
}

function toInquiry(conversation: SupportConversationResponse): InquiryLog {
  const statusLabels: Record<SupportConversationResponse['status'], InquiryLog['status']> = {
    waiting_for_support: 'Waiting for Support',
    assigned: 'Assigned',
    live_chat: 'Live Chat',
    resolved: 'Resolved',
    ended_by_student: 'Ended by Student',
  }
  const assignedTo = typeof conversation.assignedTo === 'string'
    ? conversation.assignedTo
    : conversation.assignedTo?._id || null
  const timestamp = new Date(conversation.lastMessageAt)
  return {
    id: conversation._id,
    conversationId: conversation._id,
    studentName: conversation.ownerName,
    studentId: conversation.ownerEmail,
    query: conversation.question,
    responseSnippet: `${conversation.messages.length} messages`,
    category: 'General Campus Info',
    timestamp: Number.isNaN(timestamp.getTime()) ? '' : timestamp.toLocaleString(),
    rating: 0,
    status: statusLabels[conversation.status],
    assignedTo,
    messages: conversation.messages,
  }
}

async function loadConversations(token: string) {
  const data = await apiRequest<{ conversations: SupportConversationResponse[] }>('/support', token)
  return data.conversations.map(toInquiry)
}

export function App() {
  const [isLoading, setIsLoading] = useState(true)
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('upang_admin_token') || '')
  const [authError, setAuthError] = useState('')
  const [userName, setUserName] = useState('')
  const [adminId, setAdminId] = useState('')
  const [inquiries, setInquiries] = useState<InquiryLog[]>([])

  // Navigation State
  const [currentTab, setCurrentTab] = useState<AdminTab>('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Data States with LocalStorage Persistence
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>(() => {
    const saved = localStorage.getItem('upang_kb_data')
    return saved ? JSON.parse(saved) : INITIAL_KNOWLEDGE
  })

  const [users, setUsers] = useState<UserAccount[]>(() => {
    const saved = localStorage.getItem('upang_users_data')
    return saved ? JSON.parse(saved) : INITIAL_USERS
  })

  const [settings, setSettings] = useState<SystemSettings>(() => {
    const saved = localStorage.getItem('upang_settings_data')
    return saved ? JSON.parse(saved) : INITIAL_SETTINGS
  })

  // Modals
  const [isAddKnowledgeOpen, setIsAddKnowledgeOpen] = useState(false)

  // Sync to local storage
  useEffect(() => {
    localStorage.setItem('upang_kb_data', JSON.stringify(knowledgeItems))
  }, [knowledgeItems])

  useEffect(() => {
    localStorage.setItem('upang_users_data', JSON.stringify(users))
  }, [users])

  useEffect(() => {
    localStorage.setItem('upang_settings_data', JSON.stringify(settings))
  }, [settings])

  // Knowledge base actions
  const handleAddKnowledge = (
    item: Omit<KnowledgeItem, 'id' | 'viewsCount' | 'updatedAt'>
  ) => {
    const newItem: KnowledgeItem = {
      ...item,
      id: `kb-${Date.now()}`,
      viewsCount: 0,
      updatedAt: new Date().toISOString().split('T')[0],
    }
    setKnowledgeItems((prev) => [newItem, ...prev])
  }

  const handleUpdateKnowledge = (id: string, updated: Partial<KnowledgeItem>) => {
    setKnowledgeItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updated } : item))
    )
  }

  const handleDeleteKnowledge = (id: string) => {
    setKnowledgeItems((prev) => prev.filter((item) => item.id !== id))
  }

  useEffect(() => {
    let cancelled = false
    if (!authToken) {
      setIsLoading(false)
      return () => { cancelled = true }
    }

    setIsLoading(true)
    void (async () => {
      try {
        const { user } = await apiRequest<{ user: AuthUser }>('/auth/me', authToken)
        if (user.accountType !== 'admin') throw new Error('Administrator access is required.')
        const conversations = await loadConversations(authToken)
        if (cancelled) return
        setUserName(user.name)
        setAdminId(user.id)
        setInquiries(conversations)
        setAuthError('')
      } catch (error) {
        if (cancelled) return
        console.error('Admin session recovery failed:', error)
        localStorage.removeItem('upang_admin_token')
        setAuthToken('')
        setAuthError(error instanceof Error ? error.message : 'Sign-in failed.')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [authToken])

  useEffect(() => {
    if (!authToken || !adminId) return undefined
    const socket = io(socketBaseUrl, { auth: { token: authToken }, reconnection: true })
    const refresh = () => {
      void loadConversations(authToken)
        .then(setInquiries)
        .catch((error: unknown) => {
          console.error('Live support refresh failed:', error)
          setAuthError(error instanceof Error ? error.message : 'Live support could not be refreshed.')
        })
    }
    socket.on('connect', refresh)
    socket.on('support:new_conversation', refresh)
    socket.on('support:conversation_updated', refresh)
    socket.on('connect_error', (error) => {
      console.error('Admin live support connection failed:', error.message)
      setAuthError('Live updates are reconnecting. You can continue using the dashboard.')
    })
    return () => { socket.disconnect() }
  }, [authToken, adminId])

  const handleAuthenticated = (session: { token: string; user: AuthUser }) => {
    if (session.user.accountType !== 'admin') {
      setAuthError('This account does not have administrator access.')
      return
    }
    localStorage.setItem('upang_admin_token', session.token)
    setAuthError('')
    setAuthToken(session.token)
    setUserName(session.user.name)
    setAdminId(session.user.id)
  }

  const handleLogout = () => {
    localStorage.removeItem('upang_admin_token')
    setAuthToken('')
    setUserName('')
    setAdminId('')
    setInquiries([])
  }

  const updateConversation = async (id: string, action: string, body: Record<string, string> = {}) => {
    const { conversation } = await apiRequest<{ conversation: SupportConversationResponse }>(
      `/support/${id}/${action}`,
      authToken,
      { method: 'POST', body: JSON.stringify(body) },
    )
    const updated = toInquiry(conversation)
    setInquiries((current) => [
      updated,
      ...current.filter((item) => item.conversationId !== id),
    ])
  }

  const handleAcceptConversation = (id: string) => updateConversation(id, 'accept')
  const handleResolveConversation = (id: string) => updateConversation(id, 'resolve')
  const handleReply = (id: string, text: string, clientMessageId: string) => updateConversation(id, 'reply', {
    text,
    clientMessageId,
  })

  // Users actions
  const handleAddUser = (user: Omit<UserAccount, 'id' | 'lastActive'>) => {
    const newUser: UserAccount = {
      ...user,
      id: `usr-${Date.now()}`,
      lastActive: 'Just now',
    }
    setUsers((prev) => [newUser, ...prev])
  }

  const handleUpdateUserRole = (id: string, role: UserAccount['role']) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === id ? { ...u, role } : u))
    )
  }

  // Settings actions
  const handleSaveSettings = (newSettings: SystemSettings) => {
    setSettings(newSettings)
  }

  const handleExportData = () => {
    const backup = {
      exportDate: new Date().toISOString(),
      knowledgeItems,
      inquiries,
      users,
      settings,
    }
    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `upang-assist-admin-backup-${new Date().toISOString().split('T')[0]}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleResetDefaults = () => {
    if (window.confirm('Reset all Admin data like new to initial campus defaults?')) {
      localStorage.removeItem('upang_kb_data')
      localStorage.removeItem('upang_users_data')
      localStorage.removeItem('upang_settings_data')
      setKnowledgeItems([])
      setUsers([])
      setSettings(INITIAL_SETTINGS)
      alert('All admin data has been reset like brand new!')
    }
  }

  const handleWipeBlank = () => {
    if (window.confirm('Are you sure you want to wipe all records to a clean blank slate?')) {
      localStorage.removeItem('upang_kb_data')
      localStorage.removeItem('upang_users_data')
      setKnowledgeItems([])
      setUsers([])
      setSettings(INITIAL_SETTINGS)
      alert('All admin tables wiped to a clean blank slate.')
    }
  }

  if (isLoading) {
    return (
      <main
        className="min-h-screen flex flex-col items-center justify-center gap-5 bg-[#08170f] text-white"
        role="status"
        aria-live="polite"
      >
        <img src={upangLogo} alt="PHINMA UPang" className="h-16 w-16 object-contain" />
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-[#f0b445]" />
        <p className="text-sm font-medium text-white/70">Loading admin portal…</p>
      </main>
    )
  }

  if (!authToken) {
    return <AdminLogin error={authError} onAuthenticated={handleAuthenticated} />
  }

  return (
    <div className="min-h-screen flex flex-col font-sans text-white">
      {/* Top Navbar */}
      <Navbar
        userName={userName}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        onResetLikeNew={handleResetDefaults}
        inquiriesCount={inquiries.filter((i) => !['Resolved', 'Ended by Student'].includes(i.status)).length}
        onNavigateTab={(tab) => setCurrentTab(tab)}
        onLogout={handleLogout}
      />

      <div className="flex min-w-0 flex-1">
        {/* Sidebar */}
        <Sidebar
          currentTab={currentTab}
          onSelectTab={(tab) => setCurrentTab(tab)}
          isOpen={sidebarOpen}
          onCloseMobile={() => setSidebarOpen(false)}
        />

        {/* Main Content Area */}
        <main className="min-w-0 w-full max-w-7xl mx-auto flex-1 overflow-x-hidden p-4 md:p-6 lg:p-8">
          {authError && (
            <div role="status" className="mb-4 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-xs text-amber-200">
              {authError}
              <button type="button" className="ml-3 underline" onClick={() => setAuthError('')}>Dismiss</button>
            </div>
          )}
          {currentTab === 'dashboard' && (
            <DashboardView
              inquiries={inquiries}
              knowledgeItems={knowledgeItems}
              onNavigateTab={(tab) => setCurrentTab(tab)}
              onOpenAddKnowledge={() => {
                setCurrentTab('knowledge')
                setIsAddKnowledgeOpen(true)
              }}
            />
          )}

          {currentTab === 'knowledge' && (
            <KnowledgeBaseView
              items={knowledgeItems}
              onAddItem={handleAddKnowledge}
              onUpdateItem={handleUpdateKnowledge}
              onDeleteItem={handleDeleteKnowledge}
              isAddModalOpen={isAddKnowledgeOpen}
              setIsAddModalOpen={setIsAddKnowledgeOpen}
            />
          )}

          {currentTab === 'inquiries' && (
            <InquiriesView
              inquiries={inquiries}
              adminId={adminId}
              onAccept={handleAcceptConversation}
              onReply={handleReply}
              onResolve={handleResolveConversation}
            />
          )}

          {currentTab === 'users' && (
            <UsersView
              users={users}
              onAddUser={handleAddUser}
              onUpdateRole={handleUpdateUserRole}
            />
          )}

          {currentTab === 'settings' && (
            <SettingsView
              settings={settings}
              onSaveSettings={handleSaveSettings}
              onExportData={handleExportData}
              onResetDefaults={handleResetDefaults}
              onWipeBlank={handleWipeBlank}
            />
          )}
        </main>
      </div>
    </div>
  )
}

export default App

function AdminLogin({
  error,
  onAuthenticated,
}: {
  error: string
  onAuthenticated: (session: { token: string; user: AuthUser }) => void
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [loginError, setLoginError] = useState('')

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setLoginError('')
    try {
      const session = await apiRequest<{ token: string; user: AuthUser }>('/auth/login', '', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      onAuthenticated(session)
    } catch (requestError) {
      console.error('Administrator sign-in failed:', requestError)
      setLoginError(requestError instanceof Error ? requestError.message : 'Sign-in failed.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#08170f] px-4 text-white">
      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-5 rounded-3xl border border-white/10 bg-white/[0.04] p-8 shadow-2xl">
        <div className="flex flex-col items-center text-center">
          <img src={upangLogo} alt="PHINMA UPang" className="mb-4 h-14 w-14 object-contain" />
          <h1 className="text-2xl font-black">UPang Support Admin</h1>
          <p className="mt-2 text-sm text-white/60">Sign in with your provisioned administrator account.</p>
        </div>
        <label className="block space-y-2 text-sm font-semibold">
          Email address
          <input
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none focus:border-[#f0b445]"
          />
        </label>
        <label className="block space-y-2 text-sm font-semibold">
          Password
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none focus:border-[#f0b445]"
          />
        </label>
        {(loginError || error) && (
          <p role="alert" className="rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-200">
            {loginError || error}
          </p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-[#f0b445] px-4 py-3 font-extrabold text-[#08170f] transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60"
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  )
}
