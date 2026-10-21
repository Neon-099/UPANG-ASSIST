import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import LoginPage from './LoginPage'
import SignupPage from './SignupPage'
import ForgotPasswordPage from './ForgotPasswordPage'
import GoogleAuthErrorPage from './GoogleAuthErrorPage'
import SeenMessage from '../components/SeenMessage'
import { collegeCourses } from '../data/collegeCourses'
import LoadingPage from './LoadingPage'
import { apiRequest } from '../api'
import { createSupportSocket } from '../supportSocket'
import upangLogo from '../assets/upang logo.png'
import ThoughtLine from '../ThoughtLine'
import BorderGlow from '../BorderGlow'
import '../App.css'

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
  const [googleAuthError, setGoogleAuthError] = useState(() => new URLSearchParams(window.location.search).get('oauth_error') || '')
  const [view, setView] = useState(() => (new URLSearchParams(window.location.search).has('oauth_error') ? 'google-auth-error' : 'login'))
  const googleRetryAfterSeconds = Math.max(0, Number(new URLSearchParams(window.location.search).get('retry_after')) || 0)
  const [isCheckingSession, setIsCheckingSession] = useState(true)
  const [isLoadingHome, setIsLoadingHome] = useState(false)
  const [userName, setUserName] = useState('')
  const [userRole, setUserRole] = useState('')
  const [userCourse, setUserCourse] = useState('')
  const [userId, setUserId] = useState(null)
  const [profileDraft, setProfileDraft] = useState({ name: '', course: '' })
  const [profileError, setProfileError] = useState('')
  const [profileSaved, setProfileSaved] = useState(false)
  const [profileSaving, setProfileSaving] = useState(false)
  const isGuest = userRole === 'Guest'
  const isStudent = userRole === 'Student'
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState([])
  const [supportConversation, setSupportConversation] = useState(null)
  const supportSocketRef = useRef(null)
  const [supportPanelOpen, setSupportPanelOpen] = useState(false)
  const [supportDraft, setSupportDraft] = useState('')
  const [editingSupportMessageId, setEditingSupportMessageId] = useState(null)
  const [editingSupportMessageText, setEditingSupportMessageText] = useState('')
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
    setProfileDraft({ name: user.name || user.email, course: user.course || '' })
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

  // Student announcements and their server-backed inbox state.
  const [notifications, setNotifications] = useState(DEFAULT_NOTIFICATIONS)
  const [notificationNow, setNotificationNow] = useState(() => Date.now())
  const [notifOpen, setNotifOpen] = useState(false)
  const [dismissedAdvisoryId, setDismissedAdvisoryId] = useState(null)
  const notifRef = useRef(null)

  // Toast notification system state
  const [toasts, setToasts] = useState([])
  const showToast = (toast) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`
    const duration = Number.isFinite(toast.duration) ? Math.max(1500, toast.duration) : 4200
    const newToast = { id, duration, ...toast }
    setToasts((prev) => [...prev, newToast])
    if (pref('soundEffects', false)) playCompletionChime()
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, duration)
  }

  const loadNotifications = useCallback(async () => {
    if (!userId) {
      setNotifications([])
      return
    }
    try {
      const data = await apiRequest('/announcements')
      const items = (data.notifications || []).map((item) => ({
        ...item,
        id: String(item._id),
        unread: Boolean(item.unread),
        time: new Date(item.publishedAt || item.createdAt).toLocaleString(),
        tag: item.category,
      }))
      setNotifications(items)
    } catch (error) {
      if (error.status !== 401 && error.status !== 403) console.warn('Unable to load announcements:', error.message)
    }
  }, [userId])

  const openAnnouncementNotification = () => {
    setNotifOpen((open) => !open)
  }

  const selectAnnouncement = (announcement) => {
    if (!announcement.unread) return
    setNotifications((prev) => prev.map((item) => item.id === announcement.id ? { ...item, unread: false } : item))
    void apiRequest(`/announcements/${encodeURIComponent(announcement.id)}/read`, { method: 'PATCH', body: JSON.stringify({}) })
      .catch((error) => {
        void loadNotifications()
        showToast({ type: 'warning', title: 'Could not update notification', message: error.message })
      })
  }

  const activeNotifications = notifications.filter((item) => (
    !item.expiresAt || new Date(item.expiresAt).getTime() > notificationNow
  ))

  // Remove expired announcements from every student notification surface as
  // soon as their expiry is reached, even if the next server poll is later.
  useEffect(() => {
    const nextExpiry = notifications.reduce((nearest, item) => {
      if (!item.expiresAt) return nearest
      const expiry = new Date(item.expiresAt).getTime()
      return expiry > notificationNow && (!nearest || expiry < nearest) ? expiry : nearest
    }, 0)
    if (!nextExpiry) return undefined
    const timer = window.setTimeout(() => {
      setNotificationNow(Date.now())
      void loadNotifications()
    }, Math.max(0, nextExpiry - Date.now() + 10))
    return () => window.clearTimeout(timer)
  }, [notifications, notificationNow, loadNotifications])

  // Surface the newest published announcement for a 10-second advisory period.
  // Respect a nearer announcement expiry when less than 10 seconds remain.
  const newestActiveNotification = activeNotifications[0]
  const timedAdvisory = newestActiveNotification && String(newestActiveNotification.id) !== dismissedAdvisoryId
    ? newestActiveNotification
    : null
  const advisoryDisplayDuration = useMemo(() => {
    if (!timedAdvisory) return 0
    const expiry = timedAdvisory.expiresAt ? new Date(timedAdvisory.expiresAt).getTime() : 0
    return Math.min(10000, expiry > Date.now() ? expiry - Date.now() : 10000)
  }, [timedAdvisory?.id, timedAdvisory?.expiresAt])

  useEffect(() => {
    if (!notifOpen) return undefined
    const handleClickOutside = (event) => {
      if (notifRef.current && !notifRef.current.contains(event.target)) setNotifOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [notifOpen])

  useEffect(() => {
    if (!userId) { setNotifications([]); return undefined }
    void loadNotifications()
    const timer = window.setInterval(() => { void loadNotifications() }, 60000)
    return () => window.clearInterval(timer)
  }, [userId, loadNotifications])

  useEffect(() => {
    if (!timedAdvisory || advisoryDisplayDuration <= 0) return undefined
    const advisoryId = String(timedAdvisory.id)
    const timer = window.setTimeout(() => setDismissedAdvisoryId(advisoryId), advisoryDisplayDuration)
    return () => window.clearTimeout(timer)
  }, [timedAdvisory?.id, advisoryDisplayDuration])

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
        setSupportUnreadCount(conversation.messages.filter((message) => message.sender === 'admin' && !message.studentSeenAt).length)
        setSupportConversation((current) => {
          return conversation
        })
      } catch (error) {
        if (error.status !== 404) console.error('Support conversation refresh failed:', error.message)
      }
    }
    void refreshSupport()
    const timer = window.setInterval(refreshSupport, 20000)
    return () => { active = false; window.clearInterval(timer) }
  }, [userId])

  useEffect(() => {
    if (!userId || !isStudent) return undefined
    const refreshConversationList = () => {
      void loadConversations().catch((error) => console.error('Unable to refresh conversations:', error.message))
    }
    const timer = window.setInterval(refreshConversationList, 20000)
    return () => window.clearInterval(timer)
  }, [userId, isStudent, loadConversations])

  useEffect(() => {
    if (!userId || !isStudent) return undefined
    const socket = createSupportSocket()
    supportSocketRef.current = socket
    socket.on('support:updated', ({ conversation }) => {
      if (!conversation) return
      setSupportUnreadCount(conversation.messages.filter((message) => message.sender === 'admin' && !message.studentSeenAt).length)
      setSupportConversation((current) => {
        if (current && current._id !== conversation._id) return current
        return conversation
      })
    })
    socket.connect()
    return () => {
      socket.disconnect()
      supportSocketRef.current = null
    }
  }, [userId, isStudent])

  useEffect(() => {
    const socket = supportSocketRef.current
    const conversationId = supportConversation?._id
    if (!socket || !conversationId) return undefined
    const join = () => socket.emit('support:join', { conversationId })
    if (socket.connected) join()
    socket.on('connect', join)
    return () => {
      socket.off('connect', join)
      if (socket.connected) socket.emit('support:leave', { conversationId })
    }
  }, [supportConversation?._id])

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

  const handleSupportMessageSeen = useCallback(async (messageId) => {
    if (!supportConversation?._id || !messageId) return
    const conversationId = supportConversation._id
    const data = await apiRequest(`/support/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}/seen`, { method: 'POST' })
    setSupportConversation((current) => current?._id === conversationId
      ? { ...current, messages: current.messages.map((message) => String(message._id) === data.messageId ? { ...message, studentSeenAt: data.studentSeenAt, adminSeenAt: data.adminSeenAt } : message) }
      : current)
    setSupportUnreadCount(data.conversation.messages.filter((message) => message.sender === 'admin' && !message.studentSeenAt).length)
  }, [supportConversation?._id])

  const handleSupportMessageEdit = async (event, messageId) => {
    event.preventDefault()
    const text = editingSupportMessageText.trim()
    if (!text || !supportConversation || !messageId) return
    try {
      const data = await apiRequest(`/support/${supportConversation._id}/messages/${encodeURIComponent(messageId)}`, {
        method: 'PATCH', body: JSON.stringify({ text }),
      })
      setSupportConversation(data.conversation)
      setEditingSupportMessageId(null)
      setEditingSupportMessageText('')
    } catch (error) {
      showToast({ type: 'warning', title: 'Message not updated', message: error.message })
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

  const unreadCount = activeNotifications.filter((n) => n.unread).length

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
    if (nextView === 'login' && new URLSearchParams(window.location.search).has('oauth_error')) {
      const params = new URLSearchParams(window.location.search)
      params.delete('oauth_error')
      params.delete('retry_after')
      const query = params.toString()
      window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`)
      setGoogleAuthError('')
    }
    setView(nextView)
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

  const handleSaveProfile = async (event) => {
    event.preventDefault()
    const name = profileDraft.name.trim()
    if (!name) {
      setProfileError('Enter a name before saving your profile.')
      return
    }
    setProfileError('')
    setProfileSaving(true)
    try {
      const { user } = await apiRequest('/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify({ name, course: profileDraft.course }),
      })
      setUserName(user.name)
      setUserCourse(user.course || '')
      setProfileDraft({ name: user.name, course: user.course || '' })
      setProfileSaved(true)
    } catch (error) {
      setProfileError(error.message || 'Unable to update your profile.')
    } finally { setProfileSaving(false) }
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
      setProfileDraft({ name: '', course: '' })
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

  const handleGetLoginStatus = useCallback(() => apiRequest('/auth/login-status'), [])

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
    const userMessage = { id: getNextId('user_msg'), sender: 'user', text: escapeChatText(trimmed), timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
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
      setMessages((prev) => [...prev, { id: assistantMsgId, sender: 'assistant', text: escapeChatText(data.text), followUps: data.followUps || [], references: data.references || [], provider: data.provider, timestamp: assistantTimestamp, escalate: shouldOfferLiveSupport(data) }])
      if (!isGuest) {
        try { await loadConversations() } catch (error) { console.error('Unable to refresh conversations:', error.message) }
      }
      if (pref('soundEffects', false)) playCompletionChime()
    } catch (error) {
      console.error('Chat error:', error)
      setMessages((prev) => [...prev, { id: assistantMsgId, sender: 'assistant', text: escapeChatText(`I couldn't get a response from the server. ${error.message || 'Please try again.'}`), timestamp: assistantTimestamp, escalate: true }])
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
        text: escapeChatText(message.content),
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

  if (view === 'google-auth-error') {
    return <GoogleAuthErrorPage errorCode={googleAuthError} retryAfterSeconds={googleRetryAfterSeconds} onBack={() => navigateAuthPage('login')} />
  }

  if (view === 'login' || view === 'signup' || view === 'forgot-password') {
    return (
      <div className={`min-h-dvh w-full bg-white text-slate-900 theme-${effectiveTheme}`}>
        {view === 'login' ? (
          <LoginPage
            onGuest={() => enterHome('Guest', 'Guest')}
            onGoogle={handleGoogleLogin}
            onSignUp={() => navigateAuthPage('signup')}
            onForgotPassword={() => navigateAuthPage('forgot-password')}
            onEnterHome={handleLogin}
            onGetLoginStatus={handleGetLoginStatus}
          />
        ) : view === 'signup' ? (
          <SignupPage
            onBack={() => navigateAuthPage('login')}
            onVerified={() => navigateAuthPage('login')}
          />
        ) : (
          <ForgotPasswordPage
            onBack={() => navigateAuthPage('login')}
            onComplete={async ({ user }) => {
              if (!applyAuthenticatedUser(user)) return
              try { await loadConversations() } catch (error) { console.error('Unable to load conversations:', error.message) }
            }}
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
            {(userName ? userName.substring(0, 2) : 'WS').toUpperCase()}
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
                      setProfileDraft({ name: userName, course: userCourse })
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
                    <label className="profile-field">
                      <span>Display name</span>
                      <input
                        type="text"
                        value={profileDraft.name}
                        onChange={(event) => {
                          setProfileDraft((current) => ({ ...current, name: event.target.value }))
                          setProfileSaved(false)
                        }}
                        maxLength={30}
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
                    {profileSaved && <p className="profile-form-message" role="status">Profile updated.</p>}
                    <div className="profile-form-actions">
                      <button
                        type="button"
                        className="profile-cancel-btn"
                        onClick={() => {
                          setProfileDraft({ name: userName, course: userCourse })
                          setProfileError('')
                          setProfileSaved(false)
                        }}
                      >
                        Discard changes
                      </button>
                      <button type="submit" className="profile-save-btn" disabled={profileSaving}>{profileSaving ? 'Saving...' : 'Save changes'}</button>
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
                  <p className="settings-notice">Campus announcements appear in your notification inbox. Email digests are not available yet.</p>
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
            <div className="notif-wrapper" ref={notifRef}>
              <button
                type="button"
                className={`notif-trigger-btn ${notifOpen ? 'active' : ''}`}
                onClick={openAnnouncementNotification}
                aria-label={unreadCount ? `Campus announcements, ${unreadCount} unread` : 'Campus announcements'}
                aria-expanded={notifOpen}
                aria-haspopup="dialog"
                title="Announcements"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {unreadCount > 0 && (
                  <span className="notif-count-badge" role="status" aria-live="polite" aria-label={`${unreadCount} unread announcement${unreadCount === 1 ? '' : 's'}`}>
                    {unreadCount}
                  </span>
                )}
              </button>
              {notifOpen && (
                <section className="notif-popover" role="dialog" aria-label="Campus announcements">
                  <header className="notif-popover-header">
                    <div>
                      <h2>Announcements</h2>
                      <p>{unreadCount ? `${unreadCount} unread announcement${unreadCount === 1 ? '' : 's'}` : 'You are all caught up'}</p>
                    </div>
                    <button type="button" className="notif-popover-close" onClick={() => setNotifOpen(false)} aria-label="Close announcements">×</button>
                  </header>
                  <div className="notif-list">
                    {activeNotifications.length === 0 ? (
                      <div className="notif-empty">
                        <span className="notif-empty-icon" aria-hidden="true">🔔</span>
                        <strong>No announcements yet</strong>
                        <p>New campus announcements will appear here.</p>
                      </div>
                    ) : activeNotifications.map((item) => (
                      <button
                        type="button"
                        key={item.id}
                        className={`notif-item notif-advisory ${item.unread ? 'unread' : ''}`}
                        onClick={() => selectAnnouncement(item)}
                      >
                        <span className={`notif-tag notif-tag-${item.category}`}>{item.tag || item.category}</span>
                        <span className="notif-advisory-copy"><strong className="notif-item-title">{item.title}</strong>{' '}<span className="notif-item-message">{item.message}</span></span>
                        <span className="notif-time notif-advisory-time">{item.time}</span>
                        {item.unread && <span className="notif-unread-dot" aria-label="Unread" />}
                      </button>
                    ))}
                  </div>
                  {activeNotifications.length > 0 && (
                    <footer className="notif-popover-footer">
                      <span>Showing {activeNotifications.length} announcement{activeNotifications.length === 1 ? '' : 's'}</span>
                      <button type="button" onClick={() => void loadNotifications()}>Refresh</button>
                    </footer>
                  )}
                </section>
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

        {timedAdvisory && (
          <aside className="campus-alert-banner" aria-label="Timed campus advisory">
            <div className="campus-alert-content">
              <span className="campus-alert-badge">{timedAdvisory.category === 'campus' ? 'CAMPUS ADVISORY' : (timedAdvisory.tag || timedAdvisory.category).toUpperCase()}</span>
              <p className="campus-alert-msg"><strong>{timedAdvisory.title}</strong>{' '}{timedAdvisory.message}</p>
            </div>
            <button
              type="button"
              className="campus-alert-close"
              onClick={() => {
                selectAnnouncement(timedAdvisory)
                setDismissedAdvisoryId(String(timedAdvisory.id))
              }}
              aria-label="Dismiss campus advisory"
            >×</button>
            <span
              key={`${timedAdvisory.id}-${timedAdvisory.expiresAt || 'persistent'}`}
              className="campus-alert-duration-bar countdown"
              style={{ animationDuration: `${advisoryDisplayDuration}ms` }}
              aria-hidden="true"
            />
          </aside>
        )}

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
                          <div className="formatted-content" style={{ whiteSpace: 'pre-wrap' }}>{displayChatText(msg.text)}</div>

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
                        <p style={{ whiteSpace: 'pre-wrap' }}>{displayChatText(msg.text)}</p>
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
                    <SeenMessage key={message.clientMessageId || message._id} messageId={message._id} enabled={supportPanelOpen && message.sender === 'admin' && !message.studentSeenAt} onSeen={handleSupportMessageSeen}>
                      <div className={`support-widget-row support-widget-row-${mapped.sender}`}>
                        {!isUser && <div className="support-widget-avatar" aria-hidden="true"><img src={upangLogo} alt="" /></div>}
                        <div className={`support-widget-message support-widget-message-${mapped.sender}`}>
                          {mapped.sender === 'admin' && <div className="support-widget-sender-header"><span className="support-widget-badge">LIVE AGENT</span><strong className="support-widget-admin-name">{mapped.senderName || 'Support administrator'}</strong></div>}
                          {editingSupportMessageId === String(message._id) ? (
                            <form className="support-widget-edit-form" onSubmit={(event) => void handleSupportMessageEdit(event, message._id)}>
                              <textarea value={editingSupportMessageText} maxLength={2000} onChange={(event) => setEditingSupportMessageText(event.target.value)} aria-label="Edit your live chat message" />
                              <div><button type="submit" disabled={!editingSupportMessageText.trim()}>Save</button><button type="button" onClick={() => { setEditingSupportMessageId(null); setEditingSupportMessageText('') }}>Cancel</button></div>
                            </form>
                          ) : <p>{mapped.text}</p>}
                          <div className="support-widget-meta">
                            {mapped.timestamp && <span className="support-widget-time">{mapped.timestamp}</span>}
                            {message.pending && <small className="support-widget-pending">Waiting for connection…</small>}
                            {isUser && !message.pending && message.adminSeenAt && <small className="support-widget-seen">Seen</small>}
                            {isUser && !message.pending && !['resolved', 'ended_by_student'].includes(supportConversation.status) && <button type="button" className="support-widget-edit-trigger" onClick={() => { setEditingSupportMessageId(String(message._id)); setEditingSupportMessageText(message.text) }}>Edit</button>}
                          </div>
                        </div>
                      </div>
                    </SeenMessage>
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
            <button type="button" className="support-widget-bubble" onClick={() => setSupportPanelOpen(true)} aria-expanded={false} aria-label={`Open Live Support${supportUnreadCount ? `, ${supportUnreadCount} new ${supportUnreadCount === 1 ? 'reply' : 'replies'}` : `: ${supportStatusLabel(supportConversation.status)}`} `}>
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
            <span className="toast-duration-bar" style={{ animationDuration: `${toast.duration}ms` }} aria-hidden="true" />
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

const CHAT_HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
const CHAT_HTML_UNESCAPES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" }

function escapeChatText(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => CHAT_HTML_ESCAPES[character])
}

function displayChatText(value) {
  return String(value ?? '').replace(/&(?:amp|lt|gt|quot|#39);/g, (entity) => CHAT_HTML_UNESCAPES[entity])
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
