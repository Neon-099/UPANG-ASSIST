import { useState, useEffect, useRef, useCallback } from 'react'
import LoginPage from './LoginPage'
import SignupPage from './SignupPage'
import { collegeCourses } from '../data/collegeCourses'
import LoadingPage from './LoadingPage'
import { apiRequest } from '../api'
import upangLogo from '../assets/upang logo.png'
import ThoughtLine from '../ThoughtLine'
import BorderGlow from '../BorderGlow'
import '../App.css'
import '../Login.css'

const inquiryCards = [
  {
    category: 'Records & Documents',
    categoryClass: 'pill-records',
    title: "Where is the Registrar's Office?",
    description: 'Office hours, window assignments, and requesting Transcript of Records (TOR) or certifications.',
    question: "Where is the Registrar's Office?",
  },
  {
    category: 'Finance & Payments',
    categoryClass: 'pill-finance',
    title: 'Tuition Payment Channels',
    description: 'Pay via GCash, Maya, Landbank, or the on-campus Cashier counter with installment options.',
    question: 'Where can I pay my tuition?',
  },
  {
    category: 'Grants & Aid',
    categoryClass: 'pill-grants',
    title: 'Hawak Kamay Scholarship',
    description: 'Application process, coverage, and eligibility requirements for PHINMA aid.',
    question: 'How can I apply for a scholarship?',
  },
  {
    category: 'Enrollment',
    categoryClass: 'pill-enrollment',
    title: 'Enrollment Steps',
    description: 'Learn about portal registration, advising, section selection, and down payment.',
    question: 'What are the enrollment requirements and enrollment steps?',
  },
  {
    category: 'Campus & Facilities',
    categoryClass: 'pill-records',
    title: 'Campus Buildings & Library',
    description: 'Find the library, IT labs, and other key campus buildings.',
    question: 'Where are campus buildings, IT labs, and library located?',
  },
  {
    category: 'Health & Wellness',
    categoryClass: 'pill-wellness',
    title: 'Clinic & Guidance Services',
    description: 'Find the campus clinic and learn where to get counseling support.',
    question: 'Where is the clinic and guidance counseling center?',
  },
  {
    category: 'Academics',
    categoryClass: 'pill-academics',
    title: 'Adding or Dropping Subjects',
    description: 'Review the deadline and process for changing or dropping a subject.',
    question: 'Adding/Dropping/Withdrawal of Subjects',
  },
  {
    category: 'Academics',
    categoryClass: 'pill-academics',
    title: 'Class Attendance',
    description: 'Check the attendance and tardiness rules that may affect your classes.',
    question: 'Class Attendance',
  },
]


// Use the same origin in production. During local development, Vite proxies
// this path to the API server (see vite.config.js).
const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')

// Audio chime for response completion
function playCompletionChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(523.25, ctx.currentTime) // C5
    osc.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.12) // G5
    gain.gain.setValueAtTime(0.06, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.3)
  } catch {
    // AudioContext might be restricted by browser policy; safely ignore.
  }
}

const DEFAULT_NOTIFICATIONS = []


let nextUniqueId = 1000
function getNextId(prefix = 'item') {
  nextUniqueId += 1
  return `${prefix}_${nextUniqueId}`
}

export default function App() {
  const [view, setView] = useState('login')
  const [isCheckingSession, setIsCheckingSession] = useState(true)
  const [authTransitionPhase, setAuthTransitionPhase] = useState(null)
  const [isLoadingHome, setIsLoadingHome] = useState(false)
  const [userName, setUserName] = useState('')
  const [userRole, setUserRole] = useState('')
  const [userCourse, setUserCourse] = useState('')
  const [userId, setUserId] = useState(null)
  const [userPhoto, setUserPhoto] = useState('')
  const [profileDraft, setProfileDraft] = useState({ name: '', course: '', photo: '' })
  const [profileError, setProfileError] = useState('')
  const [profileSaved, setProfileSaved] = useState(false)
  const isGuest = userRole === 'Guest'
  const isStudent = userRole === 'Student'
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState([])
  const [supportConversation, setSupportConversation] = useState(null)
  const [supportPanelOpen, setSupportPanelOpen] = useState(false)
  const [supportDraft, setSupportDraft] = useState('')
  const [supportBusy, setSupportBusy] = useState(false)
  const [supportUnreadCount, setSupportUnreadCount] = useState(0)
  const [confirmEndSupport, setConfirmEndSupport] = useState(false)
  const [endingSupport, setEndingSupport] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [showThoughtLine, setShowThoughtLine] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeSidebarPanel, setActiveSidebarPanel] = useState(null)
  const [settingsTab, setSettingsTab] = useState('general')
  const [activeHistoryId, setActiveHistoryId] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const authTransitionTimerRef = useRef(null)

  const loadConversations = useCallback(async () => {
    const items = await apiRequest('/conversations')
    const today = new Date().toDateString()
    setHistoryList(items.map((item) => ({
      ...item,
      group: new Date(item.updatedAt).toDateString() === today ? 'today' : 'previous',
    })))
    return items
  }, [])

  const applyAuthenticatedUser = useCallback((user) => {
    // Keep the student experience separate from the admin app. Server-side
    // authorization remains authoritative; this prevents showing student UI
    // to an administrator who signs in from the root page.
    if (user?.role === 'admin') {
      window.location.replace('/admin')
      return false
    }
    if (user?.role !== 'student') {
      void apiRequest('/auth/logout', { method: 'POST' }).catch(() => {})
      setView('login')
      return false
    }
    setUserId(user.id)
    setUserName(user.name || user.email)
    setUserRole('Student')
    setUserCourse(user.course || '')
    setUserPhoto(user.avatar || '')
    setProfileDraft({ name: user.name || user.email, course: user.course || '', photo: user.avatar || '' })
    setView('assistant')
    return true
  }, [])

  useEffect(() => {
    let active = true
    apiRequest('/auth/me')
      .then(async ({ user }) => {
        if (!active || !user) return
        if (!applyAuthenticatedUser(user)) return
        try { await loadConversations() } catch (error) { console.error('Unable to load conversations:', error.message) }
      })
      .catch((error) => {
        if (active && error.message !== 'Authentication required') console.error('Session check failed:', error.message)
      })
      .finally(() => { if (active) setIsCheckingSession(false) })
    return () => { active = false }
  }, [applyAuthenticatedUser, loadConversations])

  useEffect(() => () => {
    if (authTransitionTimerRef.current) {
      window.clearTimeout(authTransitionTimerRef.current)
    }
  }, [])

  // Notification center state (persisted to localStorage)
  const [notifications, setNotifications] = useState(DEFAULT_NOTIFICATIONS)
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifFilter, setNotifFilter] = useState('all') // 'all' | 'unread' | 'campus' | 'academic'
  const notifRef = useRef(null)

  // Toast notification system state
  const [toasts, setToasts] = useState([])
  const showToast = (toast) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`
    const newToast = { id, ...toast }
    setToasts((prev) => [...prev, newToast])
    if (pref('soundEffects', false)) playCompletionChime()
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4200)
  }

  // Close notifications popover on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false)
      }
    }
    if (notifOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [notifOpen])

  const markAsRead = (id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, unread: false } : n))
    )
  }

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })))
    showToast({
      type: 'info',
      title: 'Notifications',
      message: 'All notifications marked as read.',
    })
  }

  const deleteNotification = (id, e) => {
    if (e) e.stopPropagation()
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }

  useEffect(() => {
    if (!userId) {
      setSupportConversation(null)
      return undefined
    }
    let active = true
    const refreshSupport = async () => {
      try {
        const { conversation } = await apiRequest('/support/mine')
        if (!active || !conversation) return
        setSupportConversation((current) => {
          if (current?._id === conversation._id) {
            const oldAdminIds = new Set(current.messages.filter((message) => message.sender === 'admin').map((message) => message.clientMessageId))
            const newReplies = conversation.messages.filter((message) => message.sender === 'admin' && !oldAdminIds.has(message.clientMessageId)).length
            if (newReplies && !supportPanelOpen) setSupportUnreadCount((count) => count + newReplies)
          }
          return conversation
        })
      } catch (error) {
        if (error.status !== 404) console.error('Support conversation refresh failed:', error.message)
      }
    }
    void refreshSupport()
    const timer = window.setInterval(refreshSupport, 15000)
    return () => { active = false; window.clearInterval(timer) }
  }, [userId, supportPanelOpen])

  const submitSupportRequest = async (question, history) => {
    if (!isStudent || !userId) {
      showToast({ type: 'warning', title: 'Sign in to contact support', message: 'Sign in before submitting a private support inquiry.' })
      return
    }
    setSupportBusy(true)
    try {
      const data = await apiRequest('/support', {
        method: 'POST',
        body: JSON.stringify({ question, history: history.slice(-40) }),
      })
      setSupportConversation(data.conversation)
      setSupportPanelOpen(true)
      setSupportUnreadCount(0)
      showToast({ type: 'success', title: 'Inquiry submitted', message: data.message || 'Your inquiry was sent to the support team.' })
    } catch (error) {
      showToast({ type: 'warning', title: 'Inquiry not submitted', message: error.message })
    } finally {
      setSupportBusy(false)
    }
  }

  const handleConnectToSupport = (messageId) => {
    const index = messages.findIndex((message) => message.id === messageId)
    const history = messages.slice(0, index + 1).filter((message) => ['user', 'assistant'].includes(message.sender))
      .map(({ id, sender, text }) => ({ id: String(id), sender, text }))
    const question = [...history].reverse().find((message) => message.sender === 'user')?.text
    if (question) void submitSupportRequest(question, history)
  }

  const handleSupportMessageSubmit = async (event) => {
    event.preventDefault()
    if (!isStudent || !userId) return
    const text = supportDraft.trim()
    if (!text || !supportConversation || ['resolved', 'ended_by_student'].includes(supportConversation.status)) return
    const clientMessageId = createClientId('support_msg')
    const pending = { sender: 'student', senderName: userName, text, clientMessageId, createdAt: new Date().toISOString(), pending: true }
    setSupportConversation((current) => current ? { ...current, messages: [...current.messages, pending] } : current)
    setSupportDraft('')
    try {
      const data = await apiRequest(`/support/${supportConversation._id}/messages`, {
        method: 'POST', body: JSON.stringify({ text, clientMessageId }),
      })
      setSupportConversation(data.conversation)
    } catch (error) {
      showToast({ type: 'warning', title: 'Message not sent', message: error.message })
    }
  }

  const handleReopenSupport = async () => {
    if (!isStudent || !userId || !supportConversation) return
    setSupportBusy(true)
    try {
      const history = supportConversation.messages.map((message) => ({
        id: message.clientMessageId,
        sender: message.sender === 'student' ? 'user' : message.sender === 'assistant' ? 'assistant' : null,
        text: message.text,
      })).filter((message) => message.sender)
      const data = await apiRequest('/support', { method: 'POST', body: JSON.stringify({ question: supportConversation.question, history }) })
      setSupportConversation(data.conversation)
      setSupportPanelOpen(true)
      setSupportUnreadCount(0)
    } catch (error) {
      showToast({ type: 'warning', title: 'Could not reopen chat', message: error.message })
    } finally { setSupportBusy(false) }
  }

  const handleEndSupport = async () => {
    if (!isStudent || !userId || !supportConversation || endingSupport) return
    setEndingSupport(true)
    try {
      const data = await apiRequest(`/support/${supportConversation._id}/end`, { method: 'POST', body: JSON.stringify({}) })
      setSupportConversation(data.conversation)
      setConfirmEndSupport(false)
    } catch (error) {
      showToast({ type: 'warning', title: 'Could not end conversation', message: error.message })
    } finally { setEndingSupport(false) }
  }

  const clearAllNotifications = () => {
    setNotifications([])
    showToast({
      type: 'info',
      title: 'Notifications Cleared',
      message: 'All notifications have been removed.',
    })
  }

  const unreadCount = notifications.filter((n) => n.unread).length

  const filteredNotifications = notifications.filter((n) => {
    if (notifFilter === 'unread') return n.unread
    if (notifFilter === 'campus') return n.category === 'campus'
    if (notifFilter === 'academic') return n.category === 'academic' || n.category === 'announcement'
    return true
  })

  // Settings state — persisted to localStorage
  const [prefs, setPrefs] = useState(() => {
    try { return JSON.parse(localStorage.getItem('upang_prefs')) || {} } catch { return {} }
  })
  const updatePref = (key, value) => {
    setPrefs((prev) => {
      const next = { ...prev, [key]: value }
      localStorage.setItem('upang_prefs', JSON.stringify(next))
      return next
    })
  }
  const pref = (key, defaultVal) => (key in prefs ? prefs[key] : defaultVal)

  // Dynamic theme resolution ('dark', 'light', 'system')
  const themeSetting = pref('theme', 'dark')
  const [effectiveTheme, setEffectiveTheme] = useState('dark')

  useEffect(() => {
    if (themeSetting === 'system') {
      const media = window.matchMedia('(prefers-color-scheme: light)')
      const update = () => setEffectiveTheme(media.matches ? 'light' : 'dark')
      update()
      media.addEventListener('change', update)
      return () => media.removeEventListener('change', update)
    } else {
      setEffectiveTheme(themeSetting)
    }
  }, [themeSetting])

  // Sync effectiveTheme to root attribute
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', effectiveTheme)
  }, [effectiveTheme])

  // Interactive widget states
  const [feedbackMap, setFeedbackMap] = useState({})

  // Registrar office hours (Mon–Fri 8 AM – 5 PM)
  const toggleTheme = () => {
    const nextTheme = effectiveTheme === 'dark' ? 'light' : 'dark'
    updatePref('theme', nextTheme)
    showToast({
      type: 'info',
      title: 'Theme Updated',
      message: `Switched to ${nextTheme} mode.`,
    })
  }

  const handleFeedback = (msgId, val) => {
    setFeedbackMap((prev) => ({ ...prev, [msgId]: val }))
    showToast({
      type: 'success',
      title: 'Thanks for the feedback',
      message: val === 'yes' ? 'Thank you for your feedback!' : "Thank you! We'll keep improving our answers.",
    })
  }

  const [historyList, setHistoryList] = useState([])

  const filteredHistory = historyList.filter((item) =>
    item.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const todayChats = filteredHistory.filter((item) => item.group === 'today' || !item.group)
  const previousChats = filteredHistory.filter((item) => item.group === 'previous')

  const chatEndRef = useRef(null)
  const inputRef = useRef(null)
  const thoughtHideTimerRef = useRef(null)

  const clearPendingChatTimers = () => {
    if (thoughtHideTimerRef.current) {
      window.clearTimeout(thoughtHideTimerRef.current)
      thoughtHideTimerRef.current = null
    }
  }

  const navigateAuthPage = (nextView) => {
    if (authTransitionTimerRef.current) {
      window.clearTimeout(authTransitionTimerRef.current)
    }

    setAuthTransitionPhase('exiting')
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    authTransitionTimerRef.current = window.setTimeout(() => {
      setView(nextView)
      setAuthTransitionPhase('entering')
      authTransitionTimerRef.current = null
    }, prefersReducedMotion ? 0 : 180)
  }

  const enterHome = (name = 'Guest', role = 'Guest', course = '') => {
    setUserId(null)
    setUserName(name)
    setUserRole(role)
    setUserCourse(course)
    setIsLoadingHome(true)
    window.setTimeout(() => {
      setView('assistant')
      setIsLoadingHome(false)
    }, 1200)
  }

  const handleProfilePhotoChange = (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setProfileError('Choose an image file to use as your profile photo.')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setProfileError('Profile photos must be 2 MB or smaller.')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setProfileDraft((current) => ({ ...current, photo: reader.result }))
        setProfileError('')
        setProfileSaved(false)
      }
    }
    reader.onerror = () => setProfileError('The selected photo could not be read. Please try another image.')
    reader.readAsDataURL(file)
  }

  const handleSaveProfile = (event) => {
    event.preventDefault()
    const name = profileDraft.name.trim()
    if (!name) {
      setProfileError('Enter a name before saving your profile.')
      return
    }

    setUserName(name)
    setUserCourse(profileDraft.course)
    setUserPhoto(profileDraft.photo)
    setProfileError('')
    setProfileSaved(true)
  }

  const handleAccountAction = async () => {
    if (userName) {
      if (userId) {
        try { await apiRequest('/auth/logout', { method: 'POST' }) }
        catch (error) { console.error('Sign out failed:', error.message) }
      }
      clearPendingChatTimers()
      setMessages([])
      setInput('')
      setIsTyping(false)
      setShowThoughtLine(false)
      setActiveHistoryId(null)
      setUserName('')
      setUserRole('')
      setUserCourse('')
      setUserId(null)
      setSupportConversation(null)
      setSupportPanelOpen(false)
      setUserPhoto('')
      setProfileDraft({ name: '', course: '', photo: '' })
      setProfileSaved(false)
    }
    navigateAuthPage('login')
  }

  const handleLogin = async (email, password) => {
    const data = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    if (!applyAuthenticatedUser(data.user)) return
    try { await loadConversations() } catch (error) { console.error('Unable to load conversations:', error.message) }
    setIsLoadingHome(true)
    window.setTimeout(() => setIsLoadingHome(false), 650)
  }

  const handleGoogleLogin = () => {
    window.location.assign(`${apiBaseUrl}/auth/google`)
  }

  // Scroll to bottom when messages update
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isTyping])

  const handleSendMessage = async (textToSend) => {
    const trimmed = (textToSend || input).trim()
    if (!trimmed || isTyping) return
    const userMessage = { id: getNextId('user_msg'), sender: 'user', text: trimmed, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsTyping(true)
    setShowThoughtLine(true)
    clearPendingChatTimers()
    const assistantMsgId = getNextId('asst_msg')
    const assistantTimestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    try {
      const data = await apiRequest('/chat', {
        method: 'POST',
        body: JSON.stringify({ question: trimmed, ...(activeHistoryId ? { conversationId: activeHistoryId } : {}) }),
      })
      if (data.conversationId) setActiveHistoryId(data.conversationId)
      setMessages((prev) => [...prev, { id: assistantMsgId, sender: 'assistant', text: data.text, followUps: data.followUps || [], references: data.references || [], provider: data.provider, timestamp: assistantTimestamp, escalate: shouldOfferLiveSupport(data) }])
      if (!isGuest) {
        try { await loadConversations() } catch (error) { console.error('Unable to refresh conversations:', error.message) }
      }
      if (pref('soundEffects', false)) playCompletionChime()
    } catch (error) {
      console.error('Chat error:', error)
      setMessages((prev) => [...prev, { id: assistantMsgId, sender: 'assistant', text: `I couldn't get a response from the server. ${error.message || 'Please try again.'}`, timestamp: assistantTimestamp, escalate: true }])
    } finally {
      setIsTyping(false)
      thoughtHideTimerRef.current = window.setTimeout(() => {
        setShowThoughtLine(false)
        thoughtHideTimerRef.current = null
      }, 900)
    }
  }

  const handleNewConversation = () => {
    clearPendingChatTimers()
    setMessages([])
    setInput('')
    setIsTyping(false)
    setShowThoughtLine(false)
    setActiveHistoryId(null)
    if (window.innerWidth <= 900) {
      setSidebarOpen(false)
    }
  }

  const handleSelectHistory = async (item) => {
    clearPendingChatTimers()
    setIsTyping(false)
    setShowThoughtLine(false)
    try {
      const conversation = await apiRequest(`/conversations/${encodeURIComponent(item.id)}`)
      setActiveHistoryId(conversation.id)
      setMessages((conversation.messages || []).map((message) => ({
        id: message._id,
        sender: message.role,
        text: message.content,
        timestamp: new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        references: message.references || [],
      })))
      if (window.innerWidth <= 900) setSidebarOpen(false)
    } catch (error) {
      showToast({ type: 'error', title: 'Conversation unavailable', message: error.message })
    }
  }

  const handleDeleteHistory = async (event, id) => {
    event.stopPropagation()
    try {
      await apiRequest(`/conversations/${encodeURIComponent(id)}`, { method: 'DELETE' })
      setHistoryList((prev) => prev.filter((item) => item.id !== id))
      if (activeHistoryId === id) handleNewConversation()
    } catch (error) {
      showToast({ type: 'error', title: 'Could not delete conversation', message: error.message })
    }
  }

  const handleSidebarLinkClick = (panelName) => {
    if (panelName === 'settings' && isGuest) {
      setSettingsTab('general')
    }
    setActiveSidebarPanel((current) => (current === panelName ? null : panelName))
  }


  if (isCheckingSession || isLoadingHome) {
    return <LoadingPage />
  }

  if (view === 'login' || view === 'signup') {
    return (
      <div className={`auth-transition-page theme-${effectiveTheme}${authTransitionPhase ? ` auth-transition-page--${authTransitionPhase}` : ''}`}>
        {view === 'login' ? (
          <LoginPage
            onGuest={() => enterHome('Guest', 'Guest')}
            onGoogle={handleGoogleLogin}
            onSignUp={() => navigateAuthPage('signup')}
            onEnterHome={handleLogin}
          />
        ) : (
          <SignupPage
            onBack={() => navigateAuthPage('login')}
            onVerified={() => navigateAuthPage('login')}
          />
        )}
      </div>
    )
  }

  return (
    <div className={`app-shell home-entry theme-${effectiveTheme} font-${pref('fontSize', 'default')} ${pref('compactMode', false) ? 'compact-mode' : ''}`}>
      {/* Mobile Backdrop Overlay */}
      {sidebarOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Navigation */}
      <aside className={`sidebar side ${sidebarOpen ? 'sidebar-open' : ''}`}>
        {/* Brand Header */}
        <div className="brand" aria-label="Upang Assist brand">
          <div className="mark">
            <img src={upangLogo} alt="PHINMA UPang Logo" className="brand-logo-img" />
          </div>
          <div className="brand-titles">
            <b className="brand-main-title">Upang Assist</b>
          </div>
          <button
            className="sidebar-close-btn"
            type="button"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            ✕
          </button>
        </div>

        {/* New Conversation Button */}
        <button
          className="new new-conversation"
          type="button"
          onClick={handleNewConversation}
        >
          <div className="new-btn-left">
            <span className="plus">+</span>
            <span>New Conversation</span>
          </div>
        </button>

        {!isGuest && (
          <>
            {/* Search Conversations Input */}
            <div className="sidebar-search-box">
              <svg className="sidebar-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input
                type="text"
                placeholder="Search History"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search conversations"
              />
            </div>

            {/* History Section Grouped: TODAY & PREVIOUS CHATS */}
            <div className="hist history-list">
              {todayChats.length > 0 && (
                <div className="hist-group">
                  <div className="hist-title history-label">TODAY</div>
                  {todayChats.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`history-item ${activeHistoryId === item.id ? 'on active' : ''}`}
                      onClick={() => handleSelectHistory(item)}
                    >
                      <svg className="chat-bubble-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                      </svg>
                      <span className="history-title">{item.title}</span>
                      <span
                        className="history-delete-btn"
                        onClick={(e) => handleDeleteHistory(e, item.id)}
                        title="Delete conversation"
                        role="button"
                        tabIndex={0}
                      >
                        ✕
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {previousChats.length > 0 && (
                <div className="hist-group">
                  <div className="hist-title history-label">PREVIOUS CHATS</div>
                  {previousChats.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`history-item ${activeHistoryId === item.id ? 'on active' : ''}`}
                      onClick={() => handleSelectHistory(item)}
                    >
                      <svg className="chat-bubble-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                      </svg>
                      <span className="history-title">{item.title}</span>
                      <span
                        className="history-delete-btn"
                        onClick={(e) => handleDeleteHistory(e, item.id)}
                        title="Delete conversation"
                        role="button"
                        tabIndex={0}
                      >
                        ✕
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Sidebar Links & Log In */}
        <div className="foot sidebar-links">
          <button
            key="help"
            type="button"
            className={`lnk sidebar-link-btn ${activeSidebarPanel === 'help' ? 'active' : ''}`}
            onClick={() => handleSidebarLinkClick('help')}
            aria-pressed={activeSidebarPanel === 'help'}
            aria-label="Help & FAQ"
          >
            <span className="sidebar-link-text">Help &amp; FAQ</span>
          </button>
          <button
            key="settings"
            type="button"
            className={`lnk sidebar-link-btn ${activeSidebarPanel === 'settings' ? 'active' : ''}`}
            onClick={() => handleSidebarLinkClick('settings')}
            aria-pressed={activeSidebarPanel === 'settings'}
            aria-label="Settings"
          >
            <span className="sidebar-link-text">Settings</span>
          </button>
        </div>

        <div className="sidebar-user-card">
          <div className="user-avatar-badge">
            {userPhoto
              ? <img src={userPhoto} alt="" className="user-avatar-photo" />
              : (userName ? userName.substring(0, 2) : 'WS').toUpperCase()}
          </div>
          <div className="user-info-text">
            <span className="user-display-name">{userName || 'Wildcat Student'}</span>
            <span className="user-display-role">
              {userCourse ? `${userRole} · ${userCourse}` : userRole || 'Guest Mode'}
            </span>
          </div>
          <button
            className="user-login-pill-btn"
            type="button"
            onClick={isGuest ? () => navigateAuthPage('signup') : handleAccountAction}
            title={isGuest ? 'Sign up' : 'Log out'}
          >
            {isGuest ? 'Sign Up' : 'Log Out'}
          </button>
        </div>
      </aside>

      {activeSidebarPanel === 'settings' && (
        <div className="settings-modal-backdrop" onClick={() => setActiveSidebarPanel(null)}>
          <div
            className="settings-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Settings"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Left nav — no emoji icons */}
            <nav className="settings-nav">
              <div className="settings-nav-title">Settings</div>
              {[
                ...(!isGuest ? [{ id: 'profile', label: 'Profile' }] : []),
                { id: 'general',       label: 'General' },
                { id: 'appearance',    label: 'Appearance' },
                { id: 'notifications', label: 'Notifications' },
                { id: 'about',         label: 'About' },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`settings-nav-item ${settingsTab === item.id ? 'active' : ''}`}
                  onClick={() => {
                    setSettingsTab(item.id)
                    if (item.id === 'profile') {
                      setProfileDraft({ name: userName, course: userCourse, photo: userPhoto })
                      setProfileError('')
                      setProfileSaved(false)
                    }
                  }}
                >
                  {item.label}
                </button>
              ))}
            </nav>

            {/* Right content */}
            <div className="settings-content">
              <div className="settings-content-header">
                <h2>
                  {settingsTab === 'profile' && 'Profile'}
                  {settingsTab === 'general' && 'General'}
                  {settingsTab === 'appearance' && 'Appearance'}
                  {settingsTab === 'notifications' && 'Notifications'}
                  {settingsTab === 'about' && 'About'}
                </h2>
                <button
                  type="button"
                  className="settings-close-btn"
                  onClick={() => setActiveSidebarPanel(null)}
                  aria-label="Close settings"
                >✕</button>
              </div>

              <div className="settings-content-body">

                {!isGuest && settingsTab === 'profile' && (
                  <form className="profile-settings-form" onSubmit={handleSaveProfile}>
                    <div className="profile-photo-editor">
                      <div className="profile-photo-preview" aria-label="Profile photo preview">
                        {profileDraft.photo
                          ? <img src={profileDraft.photo} alt="Profile preview" />
                          : (profileDraft.name || userName || 'WS').substring(0, 2).toUpperCase()}
                      </div>
                      <div className="profile-photo-actions">
                        <strong>Profile photo</strong>
                        <small>Choose a JPG, PNG, GIF, or other image up to 2 MB.</small>
                        <label className="profile-photo-upload">
                          Choose photo
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleProfilePhotoChange}
                            aria-label="Choose profile photo"
                          />
                        </label>
                        {profileDraft.photo && (
                          <button
                            type="button"
                            className="profile-photo-remove"
                            onClick={() => {
                              setProfileDraft((current) => ({ ...current, photo: '' }))
                              setProfileSaved(false)
                            }}
                          >
                            Remove photo
                          </button>
                        )}
                      </div>
                    </div>

                    <label className="profile-field">
                      <span>Display name</span>
                      <input
                        type="text"
                        value={profileDraft.name}
                        onChange={(event) => {
                          setProfileDraft((current) => ({ ...current, name: event.target.value }))
                          setProfileSaved(false)
                        }}
                        maxLength={80}
                        autoComplete="name"
                        required
                      />
                    </label>

                    <label className="profile-field">
                      <span>Course</span>
                      <select
                        className="settings-select profile-course-select"
                        value={profileDraft.course}
                        onChange={(event) => {
                          setProfileDraft((current) => ({ ...current, course: event.target.value }))
                          setProfileSaved(false)
                        }}
                      >
                        <option value="">Select your course</option>
                        {collegeCourses.map(({ college, courses }) => (
                          <optgroup label={college} key={college}>
                            {courses.map((course) => (
                              <option value={course} key={course}>{course}</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </label>

                    <div className="profile-field profile-role-field">
                      <span>Account type</span>
                      <small>{userRole || 'Guest'}</small>
                    </div>

                    {profileError && <p className="profile-form-message is-error" role="alert">{profileError}</p>}
                    {profileSaved && <p className="profile-form-message" role="status">Profile updated for this session.</p>}
                    <div className="profile-form-actions">
                      <button
                        type="button"
                        className="profile-cancel-btn"
                        onClick={() => {
                          setProfileDraft({ name: userName, course: userCourse, photo: userPhoto })
                          setProfileError('')
                          setProfileSaved(false)
                        }}
                      >
                        Discard changes
                      </button>
                      <button type="submit" className="profile-save-btn">Save changes</button>
                    </div>
                  </form>
                )}

                {/* ── GENERAL ── */}
                {settingsTab === 'general' && (<>
                  <p className="settings-notice">Signed-in conversations are saved by the server. Suggestions appear when provided by the assistant.</p>
                </>)}

                {/* ── APPEARANCE ── */}
                {settingsTab === 'appearance' && (<>
                  <div className="settings-row">
                    <div className="settings-row-label">
                      <span>Theme</span>
                      <small>Visual color scheme of the interface</small>
                    </div>
                    <select
                      className="settings-select"
                      value={pref('theme', 'dark')}
                      onChange={(e) => {
                        updatePref('theme', e.target.value)
                        showToast({
                          type: 'info',
                          title: 'Theme Updated',
                          message: `Switched to ${e.target.value} mode.`,
                        })
                      }}
                    >
                      <option value="dark">Dark</option>
                      <option value="light">Light</option>
                      <option value="system">System</option>
                    </select>
                  </div>
                  <div className="settings-row">
                    <div className="settings-row-label">
                      <span>Font size</span>
                      <small>Chat message text size</small>
                    </div>
                    <select
                      className="settings-select"
                      value={pref('fontSize', 'default')}
                      onChange={(e) => updatePref('fontSize', e.target.value)}
                    >
                      <option value="small">Small</option>
                      <option value="default">Default</option>
                      <option value="large">Large</option>
                    </select>
                  </div>
                  <SettingToggle
                    label="Compact mode"
                    description="Reduce spacing between messages"
                    checked={pref('compactMode', false)}
                    onChange={(v) => updatePref('compactMode', v)}
                  />
                  <SettingToggle
                    label="Animated responses"
                    description="Show ThoughtLine animation while Bexie is thinking"
                    checked={pref('showThinking', true)}
                    onChange={(v) => updatePref('showThinking', v)}
                  />
                </>)}

                {/* ── NOTIFICATIONS ── */}
                {settingsTab === 'notifications' && (<>
                  <p className="settings-notice">Campus notifications and email digests are not available from the server yet.</p>
                  <SettingToggle
                    label="Sound effects"
                    description="Play a soft chime when a response finishes"
                    checked={pref('soundEffects', false)}
                    onChange={(v) => {
                      updatePref('soundEffects', v)
                      if (v) {
                        playCompletionChime()
                        showToast({
                          type: 'info',
                          title: 'Sound Chimes',
                          message: 'Audio alert enabled for incoming responses.',
                        })
                      }
                    }}
                  />
                </>)}

                {/* ── ABOUT ── */}
                {settingsTab === 'about' && (
                  <div className="settings-about">
                    <div className="settings-about-logo">
                      <img src={upangLogo} alt="UPang" />
                    </div>
                    <h3>Upang Assist</h3>
                    <p>Your AI-powered campus companion for PHINMA University of Pangasinan, Dagupan City.</p>
                    <p>Helping students navigate registrar, cashier, scholarships, enrollment, and more — fast.</p>
                    <div className="settings-about-meta">
                      <span>Version 2.0</span>
                      <span>•</span>
                      <span>PHINMA Education Network</span>
                    </div>
                    <button
                      type="button"
                      className="settings-reset-btn"
                      onClick={() => {
                        if (window.confirm('Reset all settings to defaults?')) {
                          localStorage.removeItem('upang_prefs')
                          setPrefs({})
                          showToast({
                            type: 'warning',
                            title: 'Settings Reset',
                            message: 'All application settings restored to default.',
                          })
                        }
                      }}
                    >
                      Reset all settings to defaults
                    </button>
                  </div>
                )}

              </div>
            </div>
          </div>
        </div>
      )}

      {activeSidebarPanel && activeSidebarPanel !== 'settings' && (
        <>
          <div
            className="sidebar-panel-backdrop"
            onClick={() => setActiveSidebarPanel(null)}
            aria-hidden="true"
          />
          <aside className="sidebar-panel" role="dialog" aria-modal="false" aria-label={`${activeSidebarPanel} information`}>
            <div className="sidebar-panel-header">
              <div>
                <p className="sidebar-panel-kicker">UPang Assist</p>
                <h3>{activeSidebarPanel === 'help' ? 'Quick Help' : 'About'}</h3>
              </div>
              <button
                type="button"
                className="sidebar-panel-close"
                onClick={() => setActiveSidebarPanel(null)}
                aria-label="Close panel"
              >✕</button>
            </div>
            {activeSidebarPanel === 'help' && (
              <div className="sidebar-panel-body">
                <p>Ask about registrar hours, tuition instructions, scholarships, campus locations, and enrollment steps.</p>
                <ul>
                  <li>Try a quick campus question.</li>
                  <li>Use the suggestions on the welcome screen.</li>
                  <li>Start a new conversation anytime.</li>
                </ul>
              </div>
            )}
            {activeSidebarPanel === 'about' && (
              <div className="sidebar-panel-body">
                <p>Upang Assist is a campus help experience for PHINMA University of Pangasinan students and visitors.</p>
                <p>Built to answer common questions with fast, helpful guidance.</p>
              </div>
            )}
          </aside>
        </>
      )}

      {/* Main Panel */}
      {/* Main Panel */}
      <main
        className="main main-panel"
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`)
          e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`)
        }}
      >
        {/* Top Header Bar */}
        <header className="top main-topbar">
          <button
            className="menu mobile-menu-trigger"
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar menu"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>

          <div className="student-desk-badge">
            <span className="desk-status-dot" aria-hidden="true">●</span>
            <span className="desk-status-text">UP Assist</span>
          </div>

          <div className="topbar-actions topbar-right">
            {/* Notification Center Trigger */}
            <div className="notif-wrapper" ref={notifRef}>
              <button
                type="button"
                className={`notif-trigger-btn ${notifOpen ? 'active' : ''}`}
                onClick={() => setNotifOpen(!notifOpen)}
                aria-label="Campus notifications"
                aria-expanded={notifOpen}
                title="Notifications"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                </svg>
                {unreadCount > 0 && (
                  <span className="notif-count-badge">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Popover */}
              {notifOpen && (
                <div className="notif-popover" role="dialog" aria-label="Campus notifications">
                  <div className="notif-popover-header">
                    <div className="notif-header-title">
                      <h3>Notifications</h3>
                      {unreadCount > 0 && (
                        <span className="notif-unread-pill">{unreadCount} new</span>
                      )}
                    </div>
                    <div className="notif-header-actions">
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          className="notif-action-btn"
                          onClick={markAllAsRead}
                          title="Mark all as read"
                        >
                          Mark all read
                        </button>
                      )}
                      {notifications.length > 0 && (
                        <button
                          type="button"
                          className="notif-action-btn notif-clear-btn"
                          onClick={clearAllNotifications}
                          title="Clear all"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Filter tabs */}
                  <div className="notif-tabs">
                    {[
                      { id: 'all', label: 'All' },
                      { id: 'unread', label: `Unread (${unreadCount})` },
                      { id: 'campus', label: 'Campus' },
                      { id: 'academic', label: 'Academic' },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        className={`notif-tab-item ${notifFilter === tab.id ? 'active' : ''}`}
                        onClick={() => setNotifFilter(tab.id)}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Notification items list */}
                  <div className="notif-list">
                    {filteredNotifications.length === 0 ? (
                      <div className="notif-empty">
                        <span className="notif-empty-icon">🔔</span>
                        <p>No notifications to display</p>
                        <small>You're all caught up with university advisories!</small>
                      </div>
                    ) : (
                      filteredNotifications.map((notif) => (
                        <div
                          key={notif.id}
                          className={`notif-item ${notif.unread ? 'unread' : ''}`}
                          onClick={() => markAsRead(notif.id)}
                        >
                          <div className="notif-item-header">
                            <span className={`notif-tag notif-tag-${notif.category}`}>
                              {notif.tag || notif.category}
                            </span>
                            <span className="notif-time">{notif.time}</span>
                            <button
                              type="button"
                              className="notif-item-delete"
                              onClick={(e) => deleteNotification(notif.id, e)}
                              aria-label="Dismiss notification"
                              title="Dismiss"
                            >
                              ✕
                            </button>
                          </div>
                          <div className="notif-item-title">{notif.title}</div>
                          <div className="notif-item-message">{notif.message}</div>
                          {notif.unread && (
                            <span className="notif-unread-dot" title="Unread" />
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {messages.length > 0 && (
              <button
                className="reset-chat-btn"
                type="button"
                onClick={handleNewConversation}
                title="Start a new conversation"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path>
                  <path d="M21 3v5h-5"></path>
                  <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path>
                  <path d="M8 16H3v5"></path>
                </svg>
                <span>Clear</span>
              </button>
            )}

            {/* Theme Toggle */}
            <button
              className="theme"
              type="button"
              onClick={toggleTheme}
              title="Toggle theme (Light / Dark)"
            >
              {effectiveTheme === 'dark' ? '☀️' : '🌙'}
            </button>
          </div>
        </header>

        {/* Content Area: Welcome Center Screen OR Chat Thread */}
        <div className="stage main-content-scroll">
          {messages.length === 0 ? (
            <div className="hero welcome-center">
              {/* Torch emblem box */}
              <div className="welcome-torch-emblem">
                <div className="torch-badge-box">
                  <img src={upangLogo} alt="UPang Torch" className="welcome-torch-img" />
                </div>
              </div>


              {/* Headline with exact font */}
              <h1 className="welcome-title-bold">
                Welcome to <span className="gold-text">Upang Assist</span>
              </h1>
              <p className="welcome-sub-prompt">What can I help you today?</p>

              {/* Frequently Asked Student Inquiries */}
              <div className="inquiries-container">
                <div className="inquiries-section-header">
                  <h2 className="inquiries-title">Frequently Asked Student Inquiries</h2>
                  <p className="inquiries-subtitle">Select a category or ask your own question below</p>
                </div>

                <div className="inquiry-cards-grid" aria-label="Frequently asked student inquiries">
                  {inquiryCards.map((card) => (
                    <BorderGlow
                      className="inquiry-card"
                      backgroundColor={effectiveTheme === 'light' ? '#ffffff' : '#142f20'}
                      glowColor={effectiveTheme === 'light' ? '42 75 48' : '42 80 72'}
                      borderRadius={16}
                      glowRadius={24}
                      glowIntensity={effectiveTheme === 'light' ? 0.65 : 1}
                      fillOpacity={effectiveTheme === 'light' ? 0.3 : 0.5}
                      colors={effectiveTheme === 'light'
                        ? ['#c98f1f', '#16a36a', '#3b82f6']
                        : ['#e9ae3c', '#34d399', '#38bdf8']}
                      key={card.title}
                      onClick={() => handleSendMessage(card.question)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          handleSendMessage(card.question)
                        }
                      }}
                    >
                      <div className="inquiry-card-top">
                        <span className={`inquiry-category-pill ${card.categoryClass}`}>{card.category}</span>
                      </div>
                      <h3 className="inquiry-card-title">{card.title}</h3>
                      <p className="inquiry-card-desc">{card.description}</p>
                      <div className="inquiry-ask-link">
                        <span>Ask question</span>
                        <span className="arrow">→</span>
                      </div>
                    </BorderGlow>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="chat chat-thread">
              <div className="col">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`msg ${msg.sender === 'user' ? 'me message-user' : 'bot message-assistant'}`}
                  >
                    {msg.sender === 'assistant' && (
                      <div className="av message-avatar" aria-hidden="true">
                        <img src={upangLogo} alt="UPang" className="avatar-torch" />
                      </div>
                    )}

                    <div className="bub message-bubble">
                      {msg.sender === 'assistant' ? (
                        <>
                          <div
                            className="formatted-content"
                            dangerouslySetInnerHTML={{
                              __html: formatMarkdown(msg.text),
                            }}
                          />

                          {msg.escalate && isStudent && (
                            <div className="support-escalation-actions">
                              <button type="button" onClick={() => handleConnectToSupport(msg.id)} disabled={supportBusy}>
                                {supportBusy ? 'Connecting…' : 'Connect with Live Chat'}
                              </button>
                              <button type="button" className="support-continue-button" onClick={() => setMessages((items) => items.map((item) => item.id === msg.id ? { ...item, escalate: false } : item))}>Continue Chatting</button>
                            </div>
                          )}

                          {msg.references?.length > 0 && <div className="src">Sources: {msg.references.map((reference) => reference.question || reference.category).filter(Boolean).join(', ')}</div>}

                          {/* Quick Action Suggestion Chips */}
                          {pref('quickActions', true) && msg.followUps && msg.followUps.length > 0 && (
                            <div className="fu followup-chips">
                              {msg.followUps.map((chip) => (
                                <button
                                  key={chip}
                                  type="button"
                                  className="chip sm followup-chip-btn"
                                  onClick={() => handleSendMessage(chip)}
                                >
                                  <span>{chip}</span>
                                  <span className="chip-plus">+</span>
                                </button>
                              ))}
                            </div>
                          )}

                          {/* Was this helpful feedback */}
                          <div className="fb">
                            {feedbackMap[msg.id] ? (
                              <span>
                                {feedbackMap[msg.id] === 'yes' ? '💚 Thank you for your feedback!' : "👍 Thanks, we'll improve our answers."}
                              </span>
                            ) : (
                              <>
                                <span>Was this helpful?</span>
                                <button type="button" onClick={() => handleFeedback(msg.id, 'yes')}>Yes</button>
                                <button type="button" onClick={() => handleFeedback(msg.id, 'no')}>No</button>
                              </>
                            )}
                          </div>
                        </>
                      ) : (
                        <p>{msg.text}</p>
                      )}
                    </div>
                  </div>
                ))}

                {isTyping && !pref('showThinking', true) && (
                  <div className="msg bot message-assistant">
                    <div className="av message-avatar" aria-hidden="true">
                      <img src={upangLogo} alt="UPang" className="avatar-torch" />
                    </div>
                    <div className="bub message-bubble">
                      <div className="typing" aria-label="Bexie is typing">
                        <i></i><i></i><i></i>
                      </div>
                    </div>
                  </div>
                )}

                {(isTyping || showThoughtLine) && pref('showThinking', true) && (
                  <div className="msg bot message-assistant">
                    <div className="av message-avatar" aria-hidden="true">
                      <img src={upangLogo} alt="UPang" className="avatar-torch" />
                    </div>
                    <div className="bub message-bubble" style={{ background: 'transparent', border: 'none', boxShadow: 'none', padding: 0 }}>
                      <ThoughtLine
                        working={isTyping}
                        steps={['Reading your inquiry', 'Querying campus directory', 'Formatting response']}
                        label="Thinking…"
                        doneLabel="Thought for"
                        glyph="sparkle"
                        fontSize={15}
                        breathPeriod={2.6}
                        breathDepth={0.45}
                        settleDuration={550}
                        settleBlur={2}
                        collapsible
                        collapseOnSettle
                        showTimer
                      />
                    </div>
                  </div>
                )}

                <div ref={chatEndRef} />
              </div>
            </div>
          )}
        </div>

        {/* Docked Prompt Box */}
        <div className="dock chat-composer-wrap">
          <form
            className="comp prompt-box modern-composer"
            onSubmit={(e) => {
              e.preventDefault()
              handleSendMessage()
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything about UPang (grades, admissions, buildings, fees)..."
              aria-label="Ask a question"
              autoComplete="off"
            />
            {input && (
              <button
                type="button"
                className="prompt-clear-btn"
                onClick={() => setInput('')}
                aria-label="Clear input text"
              >
                ✕
              </button>
            )}
            <button
              className={`send send-btn ${input.trim() ? 'send-btn-active' : ''}`}
              type="submit"
              aria-label="Send message"
              disabled={!input.trim() || isTyping}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
            </button>
          </form>

          <p className="composer-disclaimer-text">
            UPang Assist may occasionally produce inaccurate information. Please verify critical requirements directly with the Registrar or Dean's Office.
          </p>
        </div>
      </main>

      {isStudent && userId && supportConversation && (
        <aside className="support-widget" aria-label="Live support">
          {supportPanelOpen && (
            <section className="support-widget-panel" role="dialog" aria-label="Live support conversation">
              <header className="support-widget-header">
                <div className="support-widget-header-info">
                  <div className="support-widget-avatar-torch" aria-hidden="true"><img src={upangLogo} alt="" /></div>
                  <div>
                    <div className="support-widget-title-row">
                      <strong>Live Support</strong>
                      <span className={`support-live-pulse-dot ${supportConversation.status === 'live_chat' ? 'is-live' : ''}`} aria-hidden="true" />
                    </div>
                    <span className={`support-widget-status support-widget-status-${supportConversation.status}`}>{supportStatusLabel(supportConversation.status)}</span>
                  </div>
                </div>
                <button type="button" onClick={() => setSupportPanelOpen(false)} aria-label="Close live support" className="support-widget-close-btn">×</button>
              </header>

              <div className="support-widget-transcript" aria-live="polite">
                {supportConversation.status === 'waiting_for_support' && <p className="support-widget-notice">Your inquiry is saved. An administrator will reply here when available.</p>}
                {supportConversation.status === 'assigned' && <p className="support-widget-notice">An administrator accepted your inquiry and will reply here.</p>}
                {supportConversation.status === 'resolved' && <p className="support-widget-notice">This inquiry has been answered and resolved. You can return to AI Chat or reopen Live Chat.</p>}
                {supportConversation.status === 'ended_by_student' && <p className="support-widget-notice">You ended this conversation. You can return to AI Chat or reopen Live Support.</p>}
                {supportConversation.messages.map((message) => {
                  const mapped = mapSupportMessage(message)
                  const isUser = mapped.sender === 'user'
                  return (
                    <div key={message.clientMessageId || message._id} className={`support-widget-row support-widget-row-${mapped.sender}`}>
                      {!isUser && <div className="support-widget-avatar" aria-hidden="true"><img src={upangLogo} alt="" /></div>}
                      <div className={`support-widget-message support-widget-message-${mapped.sender}`}>
                        {mapped.sender === 'admin' && <div className="support-widget-sender-header"><span className="support-widget-badge">LIVE AGENT</span><strong className="support-widget-admin-name">{mapped.senderName || 'Support administrator'}</strong></div>}
                        <p>{mapped.text}</p>
                        <div className="support-widget-meta">
                          {mapped.timestamp && <span className="support-widget-time">{mapped.timestamp}</span>}
                          {message.pending && <small className="support-widget-pending">Waiting for connection…</small>}
                          {isUser && !message.pending && <span className="support-widget-ticks" aria-hidden="true">✓✓</span>}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {['resolved', 'ended_by_student'].includes(supportConversation.status) ? (
                <div className="support-widget-actions">
                  <button type="button" onClick={() => setSupportPanelOpen(false)}>Return to AI Chat</button>
                  <button type="button" onClick={handleReopenSupport} disabled={supportBusy}>{supportBusy ? 'Reopening…' : 'Reopen Live Chat'}</button>
                </div>
              ) : (
                <form className="support-widget-composer" onSubmit={handleSupportMessageSubmit}>
                  <input value={supportDraft} maxLength={2000} onChange={(event) => setSupportDraft(event.target.value)} placeholder="Message the support team…" aria-label="Message live support" />
                  <button type="submit" disabled={!supportDraft.trim()} aria-label="Send support message">Send</button>
                </form>
              )}
              {!['resolved', 'ended_by_student'].includes(supportConversation.status) && (
                <div className="support-widget-end-actions">
                  {confirmEndSupport ? <><span>End this support conversation?</span><button type="button" className="support-widget-end-confirm" onClick={() => void handleEndSupport()} disabled={endingSupport}>{endingSupport ? 'Ending…' : 'Yes, end'}</button><button type="button" className="support-widget-end-cancel" onClick={() => setConfirmEndSupport(false)} disabled={endingSupport}>Keep chatting</button></> : <button type="button" className="support-widget-end-trigger" onClick={() => setConfirmEndSupport(true)}>End conversation</button>}
                </div>
              )}
            </section>
          )}
          {!supportPanelOpen && (
            <button type="button" className="support-widget-bubble" onClick={() => { setSupportPanelOpen(true); setSupportUnreadCount(0) }} aria-expanded={false} aria-label={`Open Live Support${supportUnreadCount ? `, ${supportUnreadCount} new ${supportUnreadCount === 1 ? 'reply' : 'replies'}` : `: ${supportStatusLabel(supportConversation.status)}`} `}>
              <svg className="support-widget-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5 7.9 7.9 0 0 1-3.3-.72L4 20l1.72-4.48A7.9 7.9 0 0 1 5 12a7.5 7.5 0 1 1 15 0v-.5Z" /><path d="M8.5 12h.01M12 12h.01M15.5 12h.01" /></svg>
              {supportUnreadCount > 0 && <span className="support-widget-unread" aria-hidden="true">{supportUnreadCount > 9 ? '9+' : supportUnreadCount}</span>}
            </button>
          )}
        </aside>
      )}

      {/* Floating Toast Notification Stack */}
      <div className="toast-container" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast-card toast-${toast.type || 'info'}`}>
            <span className="toast-icon">
              {toast.type === 'success' ? '✓' : toast.type === 'warning' ? '⚠️' : '🔔'}
            </span>
            <div className="toast-body">
              {toast.title && <div className="toast-title">{toast.title}</div>}
              <div className="toast-message">{toast.message}</div>
            </div>
            <button
              type="button"
              className="toast-close"
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              aria-label="Close notification"
            >✕</button>
          </div>
        ))}
      </div>
    </div>
  )
}


function createClientId(prefix) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`
}

function mapSupportMessage(message) {
  return {
    id: message.clientMessageId || String(message._id),
    sender: message.sender === 'student' ? 'user' : message.sender,
    senderName: message.senderName,
    text: message.text,
    timestamp: message.createdAt ? new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
  }
}

function supportStatusLabel(status) {
  return ({ waiting_for_support: 'Waiting for Support', assigned: 'Assigned', live_chat: 'Live Chat', resolved: 'Resolved', ended_by_student: 'Ended by you' })[status] || 'Support'
}

function shouldOfferLiveSupport(answer) {
  const text = typeof answer.text === 'string' ? answer.text : ''
  const hasSchoolSources = Array.isArray(answer.references) && answer.references.length > 0
  return answer.escalate === true || answer.provider === 'response_fallback' || !hasSchoolSources || /NO_SUPPORTED_ANSWER/i.test(text)
}

// Markdown formatter for clean assistant text display
function formatMarkdown(text) {
  if (!text) return ''

  let formatted = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
  formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>')

  const lines = formatted.split('\n')
  let inList = false
  let result = []

  for (let line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('• ') || trimmed.startsWith('- ')) {
      if (!inList) {
        result.push('<ul class="chat-md-list">')
        inList = true
      }
      result.push(`<li>${trimmed.substring(2)}</li>`)
    } else {
      if (inList) {
        result.push('</ul>')
        inList = false
      }
      if (trimmed === '') {
        result.push('<div class="chat-md-gap"></div>')
      } else {
        result.push(`<p class="chat-md-p">${line}</p>`)
      }
    }
  }

  if (inList) {
    result.push('</ul>')
  }

  return result.join('')
}




function SettingToggle({ label, description, checked, onChange }) {
  return (
    <div className="settings-row" onClick={() => onChange(!checked)} style={{ cursor: 'pointer' }}>
      <div className="settings-row-label">
        <span>{label}</span>
        {description && <small>{description}</small>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        className={`toggle-switch ${checked ? 'toggle-switch-on' : ''}`}
        onClick={(event) => { event.stopPropagation(); onChange(!checked) }}
        aria-label={label}
      >
        <span className="toggle-switch-thumb" />
      </button>
    </div>
  )
}
