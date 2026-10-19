import { useState, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import upangLogo from './assets/upang logo.png'
import upangCampus from './assets/UpangCampus.jpg'
import ThoughtLine from './ThoughtLine'
import BorderGlow from './BorderGlow'
import './App.css'
import './Login.css'

const CAMPUS_ALERT_DURATION_MS = 10000
const welcomeGreetings = ['Welcome', 'Hello', 'Good to see you', 'Great to have you here']

const quickPrompts = [
  "Where is the Registrar's Office?",
  'Where can I pay my tuition?',
  'How can I apply for a scholarship?',
  'Where are the campus buildings located?',
]

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

const collegeCourses = [
  {
    college: 'College of Management and Accountancy',
    courses: [
      'Bachelor of Science in Accountancy',
      'Bachelor of Science in Management Accounting',
      'Bachelor of Science in Hospitality Management',
      'Bachelor of Science in Tourism Management',
      'Bachelor of Science in Business Administration',
      'Bachelor of Science in Business Administration Major in Marketing Management',
      'Bachelor of Science in Business Administration Major in Financial Management',
    ],
  },
  {
    college: 'College of Education and Liberal Arts',
    courses: [
      'Bachelor of Arts in Political Science',
      'Bachelor of Science in Elementary Education',
      'Bachelor of Secondary Education',
      'Bachelor of Secondary Education Major in English',
      'Bachelor of Secondary Education Major in Math',
      'Bachelor of Secondary Education Major in Science',
      'Bachelor of Secondary Education Major in Social Studies',
    ],
  },
  {
    college: 'College of Criminal Justice Education',
    courses: ['Bachelor of Science in Criminology'],
  },
  {
    college: 'College of Engineering and Architecture',
    courses: [
      'Bachelor of Science in Architecture',
      'Bachelor of Science in Computer Engineering',
      'Bachelor of Science in Civil Engineering',
      'Bachelor of Science in Electrical Engineering',
      'Bachelor of Science in Mechanical Engineering',
    ],
  },
  {
    college: 'College of Allied Health Sciences',
    courses: [
      'Bachelor of Science in Nursing',
      'Bachelor of Science in Pharmacy',
      'Bachelor in Medical Laboratory Science',
      'Bachelor of Science in Psychology',
    ],
  },
  {
    college: 'College of Information Technology',
    courses: ['Bachelor of Science in Information Technology'],
  },
]

// Use the same origin in production. During local development, Vite proxies
// this path to the API server (see vite.config.js).
const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')
const socketBaseUrl = import.meta.env.VITE_SOCKET_URL
  || (apiBaseUrl.startsWith('http') ? new URL(apiBaseUrl).origin : undefined)
const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

async function parseAuthResponse(response, failureMessage) {
  let data
  try {
    const body = await response.text()
    if (!body.trim()) throw new Error('empty response')
    data = JSON.parse(body)
  } catch {
    throw new Error(
      'The UPangAssist API returned an empty or invalid response. Start the backend in another terminal with "npm run dev:server", then try again.'
    )
  }

  if (!response.ok) throw new Error(data.error || failureMessage)
  return data
}

function getAuthErrorMessage(error, failureMessage) {
  if (error instanceof TypeError) {
    return 'Cannot connect to the UPangAssist API. Start the backend in another terminal with "npm run dev:server", then try again.'
  }
  return error.message || failureMessage
}

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
  } catch (err) {
    // AudioContext might be restricted by browser policy; safely ignore
  }
}

// Mock responses tailored to PHINMA University of Pangasinan with customizable tone & language
function generateCampusResponse(query, options = {}) {
  const { tone = 'helpful', language = 'en', tagalogMix = false } = options
  const lower = query.toLowerCase()
  let baseText = ''
  let followUps = []

  if (lower.includes('registrar') || lower.includes('tor') || lower.includes('transcript') || lower.includes('record')) {
    baseText = `The **Office of the University Registrar** is located on the **Ground Floor of the Main Building** (Administration Wing).\n\n• **Window Hours:** Monday to Friday, 8:00 AM – 5:00 PM | Saturday, 8:00 AM – 12:00 PM\n• **Services:** Transcript of Records (TOR), Honorable Dismissal, Certificate of Good Moral, True Copy of Grades (TCG), and CAV authentication.\n• **Document Processing:** You can submit document requests online via the Student Portal or visit Window 1 & 2 for document claiming.\n\n*Tip: Bring your Valid Student ID and official receipt when claiming documents.*`
    followUps = ['How to request Honorable Dismissal?', 'What are the fees for Transcript of Records?']
  } else if (lower.includes('tuition') || lower.includes('pay') || lower.includes('cashier') || lower.includes('fee') || lower.includes('installment')) {
    baseText = `PHINMA UPang offers flexible installment payment plans:\n\n**1. On-Campus Payment:**\n• **Location:** University Cashier, Ground Floor, Admin Wing\n• **Hours:** Mon–Fri 8:00 AM – 4:30 PM\n\n**2. Online / Bank Channels:**\n• **GCash / Maya:** Search for "PHINMA University of Pangasinan" in Bills Payment\n• **Landbank / BDO:** Over-the-counter or online bank deposit using your Student Number as Reference\n• **Student Portal:** Settle balances directly through the integrated payment gateway\n\n*Note: Allow 24 to 48 hours for online payments to reflect in your official ledger.*`
    followUps = ['Where can I see my remaining balance?', 'Promissory note procedures']
  } else if (lower.includes('scholarship') || lower.includes('hawak kamay') || lower.includes('discount') || lower.includes('grant')) {
    baseText = `PHINMA UPang is committed to accessible education through the **Hawak Kamay (HK) Scholarship**:\n\n• **Coverage:** Up to 50% – 75% tuition and miscellaneous discount.\n• **Eligibility:** Open to high school graduates and continuing students with a heart to learn. No maintaining honors grade required — just pass your enrolled subjects!\n• **Requirements:**\n  1. Accomplished HK Application Form\n  2. Certificate of Indigency or Proof of Income (ITR)\n  3. Latest Report Card or Transcript of Grades\n  4. 2x2 ID Photo\n• **Where to apply:** Student Development & Scholarships Office, 2nd Floor Student Pavilion.`
    followUps = ['Are there scholarships for Dean\'s Listers?', 'CHED Tulong Dunong requirements']
  } else if (lower.includes('building') || lower.includes('cea') || lower.includes('cbt') || lower.includes('library') || lower.includes('map') || lower.includes('where')) {
    baseText = `Here is a quick directory of key campus landmarks at PHINMA UPang Dagupan:\n\n• 🏛️ **Main Building:** Administration, Registrar, Cashier, and College of Education.\n• 🏗️ **CEA Building:** College of Engineering & Architecture, drafting laboratories, CAD labs, and civil testing rooms.\n• 💼 **CBT Building:** College of Business and Technology, IT/Computer laboratories, and business mock offices.\n• 📖 **University Library:** 3rd & 4th Floors of the Student Center Building with quiet study carrels, online catalog access, and discussion rooms.\n• 🏀 **University Gymnasium:** Located near the athletic field for physical education classes and university assemblies.`
    followUps = ['Where is the IT laboratory located?', 'Where is the Student Pavilion?']
  } else if (lower.includes('enroll') || lower.includes('subject') || lower.includes('advising') || lower.includes('schedule')) {
    baseText = `Step-by-Step Enrollment Guide for PHINMA UPang Wildcats:\n\n1. **Step 1 — Advising:** Log in to the UPang Student Portal or visit your College Dean's Office for curriculum evaluation.\n2. **Step 2 — Sectioning:** Select your course load and class schedules.\n3. **Step 3 — Assessment:** Review your breakdown of tuition and payment schedule.\n4. **Step 4 — Downpayment:** Settle the minimum downpayment through online channels or the Cashier.\n5. **Step 5 — Official Registration:** Your Certificate of Matriculation (COM) will be generated and marked ENROLLED.`
    followUps = ['Can I add or drop subjects after enrollment?', 'How to shift programs?']
  } else if (lower.includes('clinic') || lower.includes('guidance') || lower.includes('counseling') || lower.includes('health') || lower.includes('doctor')) {
    baseText = `Student Health & Wellness Facilities:\n\n• 🩺 **University Clinic:** Ground Floor, Student Pavilion.\n  - Open Monday to Friday, 8:00 AM – 5:00 PM.\n  - Offers free physician consultations, routine checkups, emergency first aid, and basic over-the-counter medicine.\n\n• 💬 **Guidance & Counseling Center:** 2nd Floor, Main Wing.\n  - Provides academic counseling, career assessments, and psychological wellness counseling.\n  - Consultations are strictly confidential. Walk-ins and appointments are welcome.`
    followUps = ['Medical certificate requirement for absences', 'How to schedule a guidance appointment']
  } else {
    baseText = `Hello, Wildcat! I am here to assist you with anything regarding **PHINMA University of Pangasinan**.\n\nYou can ask me about:\n• 🏛️ Registrar window hours, TOR requests, and certifications\n• 💳 Tuition payments, installment plans, and cashier lines\n• 🎓 Hawak Kamay scholarships, grants, and discounts\n• 🗺️ Campus buildings, IT labs, and library facilities\n• 📋 Enrollment procedures and curriculum advising\n\nHow can I best help you today?`
    followUps = ['Where is the Registrar\'s Office?', 'How to apply for Hawak Kamay scholarship?']
  }

  let text = baseText

  // Tone adjustments
  if (tone === 'concise') {
    const lines = text.split('\n\n')
    text = `⚡ **Quick Summary:**\n${lines[0]}\n\n*Need more? Ask for full details anytime.*`
  } else if (tone === 'formal') {
    text = `**Official PHINMA UPang Campus Information**\n\n` + text.replace(/Hello, Wildcat! /g, 'Greetings. ')
  } else if (tone === 'friendly') {
    text = `Hey Wildcat! 💚 Here is what I found for you:\n\n` + text
  }

  // Language & Tagalog Mix
  if (language === 'fil' || tagalogMix) {
    text = text
      .replace(/Step-by-Step Enrollment Guide for PHINMA UPang Wildcats:/g, 'Gabay sa Pagpapatala para sa PHINMA UPang Wildcats:')
      .replace(/Hello, Wildcat! I am here to assist you/g, 'Kamusta, Wildcat! Nandito ako upang tulungan ka')
      .replace(/Window Hours:/g, 'Oras ng Window:')
      .replace(/Where to apply:/g, 'Saan mag-aapply:')
    if (tagalogMix && !text.includes('po')) {
      text += `\n\n*Kung may katanungan pa po kayo, i-chat niyo lang po ako muli!*`
    }
  } else if (language === 'ceb') {
    text = text
      .replace(/Hello, Wildcat! I am here to assist you/g, 'Kumusta, Wildcat! Ania ako aron motabang kanimo')
      .replace(/Step-by-Step Enrollment Guide/g, 'Giya sa Pagpa-enroll')
  }

  return { text, followUps }
}

const DEFAULT_NOTIFICATIONS = [
  {
    id: 'notif-1',
    category: 'campus',
    title: 'Registrar Document Releasing',
    message: 'Window 2 is open for Transcript of Records (TOR) and certifications claiming today until 4:30 PM.',
    time: '10m ago',
    unread: true,
    tag: 'Registrar',
  },
  {
    id: 'notif-2',
    category: 'academic',
    title: 'Hawak Kamay Scholarship Renewal',
    message: 'Submission of grades for 2nd semester scholarship discount renewal is open at the Pavilion.',
    time: '45m ago',
    unread: true,
    tag: 'Scholarship',
  },
  {
    id: 'notif-3',
    category: 'announcement',
    title: 'Tuition Payment Channels Active',
    message: 'Cashier and online payment via GCash/Bills Payment are open for installment balance settlement.',
    time: '2h ago',
    unread: true,
    tag: 'Cashier',
  },
  {
    id: 'notif-4',
    category: 'campus',
    title: 'University Clinic Health Advisory',
    message: 'Free medical consultations and routine vital checks available at the Student Pavilion Clinic.',
    time: '1d ago',
    unread: false,
    tag: 'Clinic',
  },
]

let nextUniqueId = 1000
function getNextId(prefix = 'item') {
  nextUniqueId += 1
  return `${prefix}_${nextUniqueId}`
}

export default function App() {
  const [view, setView] = useState('assistant')
  const [welcomeGreeting] = useState(
    () => welcomeGreetings[Math.floor(Math.random() * welcomeGreetings.length)]
  )
  const [authTransitionPhase, setAuthTransitionPhase] = useState(null)
  const [isLoadingHome, setIsLoadingHome] = useState(false)
  const [userName, setUserName] = useState('Guest')
  const [userRole, setUserRole] = useState('Guest')
  const [userCourse, setUserCourse] = useState('')
  const [userPhoto, setUserPhoto] = useState('')
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('upang_auth_token') || '')
  const [authRestoring, setAuthRestoring] = useState(() => Boolean(localStorage.getItem('upang_auth_token')))
  const [supportConversation, setSupportConversation] = useState(null)
  const [supportBusy, setSupportBusy] = useState(false)
  const [supportPanelOpen, setSupportPanelOpen] = useState(false)
  const [supportDraft, setSupportDraft] = useState('')
  const [supportUnreadCount, setSupportUnreadCount] = useState(0)
  const [confirmEndSupport, setConfirmEndSupport] = useState(false)
  const [endingSupport, setEndingSupport] = useState(false)
  const [profileDraft, setProfileDraft] = useState({ name: '', course: '', photo: '' })
  const [profileError, setProfileError] = useState('')
  const [profileSaved, setProfileSaved] = useState(false)
  const isGuest = userRole === 'Guest'
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState([])
  const [isTyping, setIsTyping] = useState(false)
  const [showThoughtLine, setShowThoughtLine] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeSidebarPanel, setActiveSidebarPanel] = useState(null)
  const [settingsTab, setSettingsTab] = useState('general')
  const [activeHistoryId, setActiveHistoryId] = useState(null)
  const [dismissedAlert, setDismissedAlert] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const authTransitionTimerRef = useRef(null)
  const supportSocketRef = useRef(null)
  const supportConversationRef = useRef(supportConversation)
  const supportPanelOpenRef = useRef(supportPanelOpen)

  useEffect(() => {
    supportConversationRef.current = supportConversation
  }, [supportConversation])

  useEffect(() => {
    supportPanelOpenRef.current = supportPanelOpen
  }, [supportPanelOpen])

  useEffect(() => () => {
    if (authTransitionTimerRef.current) {
      window.clearTimeout(authTransitionTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (!authToken) return undefined
    let cancelled = false
    fetch(`${apiBaseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('Your saved sign-in has expired. Please sign in again.')
        return response.json()
      })
      .then(async ({ user }) => {
        if (cancelled) return
        setUserName(user.name)
        setUserRole(user.accountType === 'student' ? 'Student' : user.accountType === 'employee' ? 'Employee' : user.accountType)
        setUserCourse(user.course || '')
        setView('assistant')
        try {
          const response = await fetch(`${apiBaseUrl}/support/mine`, {
            headers: { Authorization: `Bearer ${authToken}` },
          })
          if (!response.ok) throw new Error('Could not restore your support conversation.')
          const { conversation } = await response.json()
          if (!cancelled && conversation) {
            setSupportConversation(conversation)
          }
        } catch (error) {
          console.error('Support conversation recovery failed:', error)
        }
      })
      .catch((error) => {
        if (cancelled) return
        console.error('Sign-in recovery failed:', error)
        localStorage.removeItem('upang_auth_token')
        setAuthToken('')
        setAuthRestoring(false)
      })
      .finally(() => {
        if (!cancelled) setAuthRestoring(false)
      })
    return () => { cancelled = true }
  }, [authToken])

  useEffect(() => {
    if (!authToken) return undefined
    const socket = io(socketBaseUrl, {
      auth: { token: authToken },
      reconnection: true,
      reconnectionAttempts: Infinity,
    })
    supportSocketRef.current = socket
    socket.on('connect', async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/support/mine`, {
          headers: { Authorization: `Bearer ${authToken}` },
        })
        if (!response.ok) throw new Error('Could not restore your support conversation.')
        const { conversation } = await response.json()
        if (!conversation) return
        const pending = (supportConversationRef.current?.messages || [])
          .filter((message) => message.pending)
        const restoredIds = new Set(conversation.messages.map((message) => message.clientMessageId))
        const unsent = pending.filter((message) => !restoredIds.has(message.clientMessageId))
        setSupportConversation({ ...conversation, messages: [...conversation.messages, ...unsent] })
        for (const message of unsent) {
          try {
            const sendResponse = await fetch(`${apiBaseUrl}/support/${conversation._id}/messages`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${authToken}`,
              },
              body: JSON.stringify({ text: message.text, clientMessageId: message.clientMessageId }),
            })
            const data = await sendResponse.json()
            if (!sendResponse.ok) throw new Error(data.error || 'Retrying a support message failed.')
            setSupportConversation(data.conversation)
          } catch (error) {
            console.error('Pending support message retry failed:', error)
          }
        }
      } catch (error) {
        console.error('Support recovery after reconnect failed:', error)
      }
    })
    socket.on('support:status', ({ id, status }) => {
      setSupportConversation((current) => {
        if (!current || String(current._id) !== id) return current
        return { ...current, status }
      })
    })
    socket.on('support:message', ({ conversationId, message }) => {
      setSupportConversation((current) => {
        if (!current || String(current._id) !== conversationId) return current
        const exists = current.messages.some((entry) => entry.clientMessageId === message.clientMessageId)
        return exists ? current : { ...current, status: 'live_chat', messages: [...current.messages, message] }
      })
      if (message.sender === 'admin' && !supportPanelOpenRef.current) {
        setSupportUnreadCount((count) => count + 1)
      }
    })
    socket.on('connect_error', (error) => {
      console.error('Live support connection failed:', error.message)
    })
    return () => {
      socket.disconnect()
      supportSocketRef.current = null
    }
  }, [authToken])

  // Notification center state (persisted to localStorage)
  const [notifications, setNotifications] = useState(() => {
    try {
      const saved = localStorage.getItem('upang_notifications')
      return saved ? JSON.parse(saved) : DEFAULT_NOTIFICATIONS
    } catch {
      return DEFAULT_NOTIFICATIONS
    }
  })
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifFilter, setNotifFilter] = useState('all') // 'all' | 'unread' | 'campus' | 'academic'
  const notifRef = useRef(null)

  // Sync notifications to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('upang_notifications', JSON.stringify(notifications))
    } catch (e) {}
  }, [notifications])

  // Toast notification system state
  const [toasts, setToasts] = useState([])
  const showToast = (toast) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`
    const duration = 4200
    const newToast = { id, ...toast, duration }
    setToasts((prev) => [...prev, newToast])
    if (pref('soundEffects', false)) playCompletionChime()
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, duration)
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
  const campusAlertsEnabled = pref('campusAlerts', true)

  useEffect(() => {
    if (!campusAlertsEnabled || dismissedAlert) return undefined
    const timeout = window.setTimeout(() => setDismissedAlert(true), CAMPUS_ALERT_DURATION_MS)
    return () => window.clearTimeout(timeout)
  }, [campusAlertsEnabled, dismissedAlert])

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
  const [tuitionAmount, setTuitionAmount] = useState(24000)
  const [installmentTerm, setInstallmentTerm] = useState(3)
  const [scholarshipChecklist, setScholarshipChecklist] = useState([false, false, false, false])
  const [feedbackMap, setFeedbackMap] = useState({})

  // Registrar office hours (Mon–Fri 8 AM – 5 PM)
  const [hoursOpen, setHoursOpen] = useState(() => {
    const now = new Date()
    const d = now.getDay()
    const h = now.getHours()
    return d >= 1 && d <= 5 && h >= 8 && h < 17
  })

  useEffect(() => {
    const checkHours = () => {
      const now = new Date()
      const d = now.getDay()
      const h = now.getHours()
      setHoursOpen(d >= 1 && d <= 5 && h >= 8 && h < 17)
    }
    const timer = setInterval(checkHours, 60000)
    return () => clearInterval(timer)
  }, [])

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
      title: 'Feedback Recorded',
      message: val === 'yes' ? 'Thank you for your feedback!' : "Thank you! We'll keep improving our answers.",
    })
  }

  const [historyList, setHistoryList] = useState([
    { id: 'h1', title: 'Where is the Registrar?', group: 'today' },
    { id: 'h2', title: 'Hawak Kamay scholarship req...', group: 'today' },
    { id: 'h3', title: 'CEA building computer labs', group: 'previous' },
    { id: 'h4', title: 'Tuition installment due dates', group: 'previous' },
    { id: 'h5', title: 'Student portal password reco...', group: 'previous' },
  ])

  const filteredHistory = historyList.filter((item) =>
    item.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const todayChats = filteredHistory.filter((item) => item.group === 'today' || !item.group)
  const previousChats = filteredHistory.filter((item) => item.group === 'previous')

  const chatEndRef = useRef(null)
  const inputRef = useRef(null)
  const streamBufferRef = useRef('')
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
    setUserName(name)
    setUserRole(role === 'student' ? 'Student' : role === 'employee' ? 'Employee' : role)
    setUserCourse(course)
    setIsLoadingHome(true)
    window.setTimeout(() => {
      setView('assistant')
      setIsLoadingHome(false)
    }, 1200)
  }

  const completeSignIn = (session) => {
    localStorage.setItem('upang_auth_token', session.token)
    setAuthToken(session.token)
    setSupportConversation(null)
    setMessages([])
    enterHome(session.user.name, session.user.accountType, session.user.course || '')
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

  const handleAccountAction = () => {
    if (userName) {
      localStorage.removeItem('upang_auth_token')
      setAuthToken('')
      setSupportConversation(null)
      supportSocketRef.current?.disconnect()
      clearPendingChatTimers()
      setMessages([])
      setInput('')
      setIsTyping(false)
      setShowThoughtLine(false)
      setActiveHistoryId(null)
      setUserName('')
      setUserRole('')
      setUserCourse('')
      setUserPhoto('')
      setProfileDraft({ name: '', course: '', photo: '' })
      setProfileSaved(false)
    }
    navigateAuthPage('login')
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

    const userMessage = {
      id: createClientId('user_msg'),
      sender: 'user',
      text: trimmed,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsTyping(true)
    setShowThoughtLine(true)
    if (thoughtHideTimerRef.current) {
      window.clearTimeout(thoughtHideTimerRef.current)
      thoughtHideTimerRef.current = null
    }

    // Save to history if this is a fresh conversation AND saveHistory is enabled
    if (messages.length === 0 && !isGuest && pref('saveHistory', true)) {
      const newHistoryItem = {
        id: getNextId('hist'),
        title: trimmed.length > 32 ? trimmed.substring(0, 32) + '...' : trimmed,
        group: 'today',
      }
      setHistoryList((prev) => [newHistoryItem, ...prev])
      setActiveHistoryId(newHistoryItem.id)
    }

    const assistantMsgId = createClientId('assistant_msg')
    const assistantTimestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    const isStreamEnabled = pref('streaming', true)

    try {
      const response = await fetch(`${apiBaseUrl}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: trimmed,
          stream: isStreamEnabled,
          tone: pref('tone', 'helpful'),
          language: pref('language', 'en'),
          tagalogMix: pref('tagalogMix', false),
        }),
      })

      if (!response.ok) {
        throw new Error('Chat request failed')
      }

      const contentType = response.headers.get('content-type') || ''

      if (!isStreamEnabled || contentType.includes('application/json')) {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Chat request failed')
        setMessages((prev) => [
          ...prev,
          {
            id: assistantMsgId,
            sender: 'assistant',
            text: data.text,
            followUps: data.followUps || [],
            timestamp: assistantTimestamp,
            escalate: data.escalate === true,
          },
        ])
        setIsTyping(false)
        if (pref('soundEffects', false)) playCompletionChime()
      } else {
        // Stream text chunk-by-chunk for real-time typewriter display
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        streamBufferRef.current = ''

        // Create empty assistant bubble first
        setMessages((prev) => [
          ...prev,
          {
            id: assistantMsgId,
            sender: 'assistant',
            text: '',
            followUps: [],
            timestamp: assistantTimestamp,
            escalate: response.headers.get('X-UPang-Escalation') === 'true',
          },
        ])
        setIsTyping(false)

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const accumulatedText = streamBufferRef.current + decoder.decode(value, { stream: true })
          streamBufferRef.current = accumulatedText

          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId ? { ...msg, text: accumulatedText } : msg
            )
          )
        }
        if (pref('soundEffects', false)) playCompletionChime()
      }
    } catch (err) {
      console.error('Chat error:', err)
      setMessages((prev) => {
        const exists = prev.some((m) => m.id === assistantMsgId)
        const fallbackMsg = {
          id: assistantMsgId,
          sender: 'assistant',
          text: 'I’m sorry, but I couldn’t retrieve a reliable answer just now. Would you like to connect with our support team for further assistance?',
          followUps: [],
          timestamp: assistantTimestamp,
          escalate: true,
        }
        return exists
          ? prev.map((m) => (m.id === assistantMsgId ? fallbackMsg : m))
          : [...prev, fallbackMsg]
      })
      if (pref('soundEffects', false)) playCompletionChime()
    } finally {
      setIsTyping(false)
      thoughtHideTimerRef.current = window.setTimeout(() => {
        setShowThoughtLine(false)
        thoughtHideTimerRef.current = null
      }, 900)
    }
  }

  const submitSupportRequest = async (question, history) => {
    if (!authToken || isGuest) {
      showToast({
        type: 'warning',
        title: 'Sign in to contact support',
        message: 'Create an account or sign in before submitting a private support inquiry.',
      })
      return
    }
    setSupportBusy(true)
    try {
      const response = await fetch(`${apiBaseUrl}/support`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          question,
          history: history.slice(-40),
          requestId: createClientId('support_request'),
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Your support request could not be submitted.')
      setSupportConversation(data.conversation)
      showToast({
        type: data.administratorAvailable ? 'success' : 'warning',
        title: data.administratorAvailable ? 'Inquiry submitted' : 'Support is currently unavailable',
        message: data.message,
      })
    } catch (error) {
      console.error('Live support request failed:', error)
      showToast({ type: 'warning', title: 'Inquiry not submitted', message: error.message })
    } finally {
      setSupportBusy(false)
    }
  }

  const handleConnectToSupport = () => {
    const question = [...messages].reverse().find((message) => message.sender === 'user')?.text
    if (!question) {
      showToast({ type: 'warning', title: 'Question unavailable', message: 'Send your question again before contacting support.' })
      return
    }
    const history = messages
      .filter((message) => ['user', 'assistant'].includes(message.sender))
      .map(({ id, sender, text }) => ({ id: String(id), sender, text }))
    void submitSupportRequest(question, history)
  }

  const handleReturnToAI = () => {
    setSupportPanelOpen(false)
    supportPanelOpenRef.current = false
  }

  const handleReopenSupport = () => {
    if (!supportConversation) return
    const history = supportConversation.messages.map((message) => ({
      id: message.clientMessageId,
      sender: message.sender === 'student' ? 'user' : message.sender === 'assistant' ? 'assistant' : null,
      text: message.text,
    })).filter((message) => message.sender)
    setSupportPanelOpen(true)
    supportPanelOpenRef.current = true
    setSupportUnreadCount(0)
    void submitSupportRequest(supportConversation.question, history)
  }

  const handleSupportPanelToggle = () => {
    const nextOpen = !supportPanelOpen
    setSupportPanelOpen(nextOpen)
    supportPanelOpenRef.current = nextOpen
    if (nextOpen) setSupportUnreadCount(0)
  }

  const handleSupportMessageSubmit = async (event) => {
    event.preventDefault()
    const text = supportDraft.trim()
    if (!text || !supportConversation || supportConversation.status === 'resolved') return

    const clientMessageId = createClientId('support_msg')
    const pendingMessage = {
      sender: 'student',
      senderId: null,
      senderName: userName,
      text,
      clientMessageId,
      createdAt: new Date().toISOString(),
      pending: true,
    }
    setSupportConversation((current) => current
      ? { ...current, messages: [...current.messages, pendingMessage] }
      : current)
    setSupportDraft('')
    try {
      const response = await fetch(`${apiBaseUrl}/support/${supportConversation._id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `******`,
        },
        body: JSON.stringify({ text, clientMessageId }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Your message could not be sent.')
      setSupportConversation(data.conversation)
    } catch (error) {
      console.error('Live support message failed:', error)
      showToast({
        type: 'warning',
        title: 'Message waiting to send',
        message: 'Your message is saved here and will be retried when the connection returns.',
      })
    }
  }

  const handleEndSupport = async () => {
    if (!supportConversation || endingSupport) return
    setEndingSupport(true)
    try {
      const response = await fetch(`${apiBaseUrl}/support/${supportConversation._id}/end`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `******`,
        },
        body: JSON.stringify({}),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'The conversation could not be ended.')
      setSupportConversation(data.conversation)
      setConfirmEndSupport(false)
      showToast({ type: 'success', title: 'Conversation ended', message: 'You can keep chatting with the AI or reopen Live Support later.' })
    } catch (error) {
      console.error('Ending live support failed:', error)
      showToast({ type: 'warning', title: 'Could not end conversation', message: error.message })
    } finally {
      setEndingSupport(false)
    }
  }

  const handlePromptClick = (prompt) => {
    handleSendMessage(prompt)
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

  const handleSelectHistory = (item) => {
    clearPendingChatTimers()
    setIsTyping(false)
    setActiveHistoryId(item.id)
    setShowThoughtLine(false)
    const responseData = generateCampusResponse(item.title, {
      tone: pref('tone', 'helpful'),
      language: pref('language', 'en'),
      tagalogMix: pref('tagalogMix', false),
    })
    setMessages([
      {
        id: getNextId('hist_usr'),
        sender: 'user',
        text: item.title,
        timestamp: 'Just now',
      },
      {
        id: getNextId('hist_asst'),
        sender: 'assistant',
        text: responseData.text,
        followUps: responseData.followUps,
        timestamp: 'Just now',
      },
    ])
    if (window.innerWidth <= 900) {
      setSidebarOpen(false)
    }
  }

  const handleDeleteHistory = (e, id) => {
    e.stopPropagation()
    setHistoryList((prev) => prev.filter((item) => item.id !== id))
    if (activeHistoryId === id) {
      handleNewConversation()
    }
  }

  const handleSidebarLinkClick = (panelName) => {
    if (panelName === 'settings' && isGuest) {
      setSettingsTab('general')
    }
    setActiveSidebarPanel((current) => (current === panelName ? null : panelName))
  }

  const getDepartmentForQuery = (text = '') => {
    const lower = text.toLowerCase()
    if (lower.includes('registrar') || lower.includes('tor') || lower.includes('transcript')) {
      return 'Office of the University Registrar'
    }
    if (lower.includes('tuition') || lower.includes('cashier') || lower.includes('pay') || lower.includes('installment')) {
      return 'Student Accounts & Cashier'
    }
    if (lower.includes('scholarship') || lower.includes('hawak kamay')) {
      return 'Student Development & Scholarships'
    }
    if (lower.includes('clinic') || lower.includes('health')) {
      return 'University Clinic & Wellness'
    }
    return 'PHINMA UPang Student Affairs'
  }

  const renderAssistantWidget = (msg) => {
    const lower = (msg.text || '').toLowerCase()

    if (lower.includes('registrar') || lower.includes('tor') || lower.includes('main building') || lower.includes('campus landmarks') || lower.includes('where is')) {
      return (
        <div className="wg">
          <div className="wt">
            <span>Campus Locator</span>
            <span className="cnt">Main Building · Ground Flr</span>
          </div>
          <svg className="mp" viewBox="0 0 540 180" aria-label="Campus Map">
            <rect width="540" height="180" rx="14" fill="transparent" />
            <rect className="rd" x="20" y="86" width="500" height="8" rx="4" />
            <rect className="rd" x="200" y="20" width="8" height="140" rx="4" />
            <g className="b">
              <rect x="30" y="20" width="150" height="55" rx="8" />
              <text x="45" y="52">CEA Building</text>
            </g>
            <g className="b">
              <rect x="30" y="105" width="150" height="55" rx="8" />
              <text x="45" y="137">CBT Building</text>
            </g>
            <g className="hl">
              <rect x="230" y="20" width="190" height="65" rx="8" />
              <circle className="ring" cx="325" cy="52" r="16" />
              <circle cx="325" cy="52" r="5" fill="var(--gold-2)" />
              <text x="245" y="46" fontWeight="700">Admin Building</text>
              <text x="245" y="60" fill="var(--gold-2)" fontSize="8">★ Registrar (Window 1-4)</text>
            </g>
            <g className="b">
              <rect x="230" y="105" width="190" height="55" rx="8" />
              <text x="250" y="137">Student Pavilion / Clinic</text>
            </g>
            <g className="b">
              <rect x="440" y="20" width="80" height="140" rx="8" />
              <text x="455" y="95" transform="rotate(-90 455 95)">University Library</text>
            </g>
          </svg>
        </div>
      )
    }

    if (lower.includes('tuition') || lower.includes('installment') || lower.includes('payment plan') || lower.includes('cashier')) {
      const termAmt = Math.round(tuitionAmount / installmentTerm)
      return (
        <div className="wg calc">
          <div className="wt">
            <span>Installment Splitter</span>
            <span className="cnt">AY 2024–2025</span>
          </div>
          <div className="fl">
            <span>Total assessment (₱)</span>
            <input
              type="number"
              value={tuitionAmount}
              onChange={(e) => setTuitionAmount(Number(e.target.value) || 0)}
              step="500"
              min="1000"
              aria-label="Total tuition assessment"
            />
          </div>
          <div className="seg">
            {[2, 3, 4].map((term) => (
              <button
                key={term}
                type="button"
                className={installmentTerm === term ? 'on' : ''}
                onClick={() => setInstallmentTerm(term)}
              >
                {term} payments
              </button>
            ))}
          </div>
          <div className="res">
            Estimated: <b>₱{termAmt.toLocaleString()}</b>/ term (zero interest)
          </div>
        </div>
      )
    }

    if (lower.includes('scholarship') || lower.includes('hawak kamay') || lower.includes('discount')) {
      const count = scholarshipChecklist.filter(Boolean).length
      const pct = (count / 4) * 100
      return (
        <div className="wg box">
          <div className="wt">
            <span>Hawak Kamay Readiness</span>
            <span className="cnt">{count}/4 ready</span>
          </div>
          <div className="bar">
            <i style={{ width: `${pct}%` }}></i>
          </div>
          {[
            'Accomplished HK Application Form',
            'Certificate of Indigency / Proof of Income',
            'Latest Form 138 / Report Card',
            'Two (2) 2x2 ID Pictures',
          ].map((item, idx) => (
            <label key={item} className="ck">
              <input
                type="checkbox"
                checked={scholarshipChecklist[idx]}
                onChange={() => {
                  setScholarshipChecklist((prev) => {
                    const next = [...prev]
                    next[idx] = !next[idx]
                    return next
                  })
                }}
              />
              {item}
            </label>
          ))}
        </div>
      )
    }

    return null
  }

  if (isLoadingHome) {
    return <HomeLoadingScreen />
  }

  if (authRestoring) {
    return <HomeLoadingScreen />
  }

  if (view === 'login' || view === 'signup') {
    return (
      <div className={`auth-transition-page theme-${effectiveTheme}${authTransitionPhase ? ` auth-transition-page--${authTransitionPhase}` : ''}`}>
        {view === 'login' ? (
          <LoginPage
            onGuest={() => enterHome('Guest', 'Guest')}
            onSignUp={() => navigateAuthPage('signup')}
            onAuthenticated={completeSignIn}
          />
        ) : (
          <SignupPage
            onBack={() => navigateAuthPage('login')}
            onAuthenticated={completeSignIn}
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
            className={`user-login-pill-btn ${isGuest ? '' : 'user-logout-icon-btn'}`}
            type="button"
            onClick={isGuest ? () => navigateAuthPage('signup') : handleAccountAction}
            title={isGuest ? 'Sign up' : 'Log out'}
            aria-label={isGuest ? 'Sign up' : 'Log out'}
          >
            {isGuest ? 'Sign Up' : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M10 17l5-5-5-5M15 12H3" />
                <path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7" />
              </svg>
            )}
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
                    {profileSaved && <p className="profile-form-message" role="status">Profile changes saved.</p>}
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
                  <SettingToggle
                    label="Campus alerts"
                    description="Receive real-time campus announcements"
                    checked={pref('campusAlerts', true)}
                    onChange={(v) => {
                      updatePref('campusAlerts', v)
                      if (v) {
                        setDismissedAlert(false)
                        showToast({
                          type: 'info',
                          title: 'Campus Advisory',
                          message: 'Campus alert banner has been displayed.',
                        })
                      }
                    }}
                  />
                  <SettingToggle
                    label="Quick actions"
                    description="Show follow-up suggestion chips after each response"
                    checked={pref('quickActions', true)}
                    onChange={(v) => updatePref('quickActions', v)}
                  />
                  <SettingToggle
                    label="Conversation history"
                    description="Save chats in sidebar history"
                    checked={pref('saveHistory', true)}
                    onChange={(v) => updatePref('saveHistory', v)}
                  />
                  <SettingToggle
                    label="Streaming responses"
                    description="Display Bexie's reply word-by-word as it generates"
                    checked={pref('streaming', true)}
                    onChange={(v) => updatePref('streaming', v)}
                  />
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
                  <SettingToggle
                    label="Push notifications"
                    description="Get notified about campus updates"
                    checked={pref('pushNotifs', false)}
                    onChange={(v) => {
                      updatePref('pushNotifs', v)
                      if (v) {
                        showToast({
                          type: 'success',
                          title: 'Notifications Enabled',
                          message: 'Campus push notifications are now active.',
                        })
                        if ('Notification' in window) {
                          if (Notification.permission === 'default') {
                            Notification.requestPermission().then((perm) => {
                              if (perm === 'granted') {
                                try {
                                  new Notification('UPang Assist', {
                                    body: 'Campus push notifications are now enabled! 🔔',
                                    icon: upangLogo,
                                  })
                                } catch (e) {}
                              }
                            })
                          } else if (Notification.permission === 'granted') {
                            try {
                              new Notification('UPang Assist', {
                                body: 'Campus push notifications are active! 🔔',
                                icon: upangLogo,
                              })
                            } catch (e) {}
                          }
                        }
                      }
                    }}
                  />
                  <SettingToggle
                    label="Email digest"
                    description="Weekly summary of common campus inquiries"
                    checked={pref('emailDigest', false)}
                    onChange={(v) => {
                      updatePref('emailDigest', v)
                      if (v) {
                        showToast({
                          type: 'info',
                          title: 'Email Digest',
                          message: 'Weekly summary scheduled for delivery every Monday.',
                        })
                      }
                    }}
                  />
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

        {/* Campus Alert Banner */}
        {campusAlertsEnabled && !dismissedAlert && (
          <div className="campus-alert-banner">
            <div className="campus-alert-content">
              <span className="campus-alert-badge">CAMPUS ADVISORY</span>
              <span className="campus-alert-msg">
                <strong>Second Semester Advising &amp; Enrollment</strong> is currently ongoing. Registrar window hours: 8:00 AM – 5:00 PM.
              </span>
            </div>
            <button
              type="button"
              className="campus-alert-close"
              onClick={() => setDismissedAlert(true)}
              aria-label="Dismiss alert"
            >✕</button>
            <span
              className="campus-alert-duration-bar"
              style={{ animationDuration: `${CAMPUS_ALERT_DURATION_MS}ms` }}
              aria-hidden="true"
            />
          </div>
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
                {welcomeGreeting}, <span className="gold-text">{userName.trim().split(/\s+/)[0] || (isGuest ? 'Guest' : 'there')}!</span>
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
                    className={`msg ${msg.sender === 'user' ? 'me message-user' : msg.sender === 'system' ? 'support-system-message' : `bot message-assistant${msg.sender === 'admin' ? ' admin-reply' : ''}`}`}
                  >
                    {['assistant', 'admin'].includes(msg.sender) && (
                      <div className="av message-avatar" aria-hidden="true">
                        <img src={upangLogo} alt="UPang" className="avatar-torch" />
                      </div>
                    )}

                    <div className="bub message-bubble">
                      {['assistant', 'admin'].includes(msg.sender) ? (
                        <>
                          {msg.sender === 'admin' && (
                            <div className="live-chat-admin-header">
                              <span className="live-chat-badge">LIVE SUPPORT</span>
                              <strong className="support-admin-name">{msg.senderName || 'Support administrator'}</strong>
                            </div>
                          )}
                          <div
                            className="formatted-content"
                            dangerouslySetInnerHTML={{
                              __html: formatMarkdown(msg.text),
                            }}
                          />

                          {msg.sender === 'assistant' && msg.escalate && !isGuest && (
                            <div className="support-escalation-actions">
                              <button type="button" onClick={handleConnectToSupport} disabled={supportBusy}>
                                {supportBusy ? 'Connecting…' : 'Connect with Live Chat'}
                              </button>
                              <button
                                type="button"
                                className="support-continue-button"
                                onClick={() => setMessages((current) => current.map((item) => (
                                  item.id === msg.id ? { ...item, escalate: false } : item
                                )))}
                              >
                                Continue Chatting
                              </button>
                            </div>
                          )}

                          {/* Campus Widget (Map, Installment Splitter, or Checklist) */}
                          {msg.sender === 'assistant' && renderAssistantWidget(msg)}

                          {/* Department Verification Badge */}
                          {msg.sender === 'assistant' && (!msg.escalate || isGuest) && (
                            <div className="src">
                              ✓ Verified by <b>{getDepartmentForQuery(msg.text)}</b> <span>· Updated today</span>
                            </div>
                          )}

                          {/* Quick Action Suggestion Chips */}
                          {msg.sender === 'assistant' && pref('quickActions', true) && msg.followUps && msg.followUps.length > 0 && (
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
                          {msg.sender === 'assistant' && (!msg.escalate || isGuest) && <div className="fb">
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
                          </div>}
                        </>
                      ) : msg.sender === 'system' ? (
                        <p>{msg.text}</p>
                      ) : (
                        <>
                          <p>{msg.text}</p>
                          {msg.pending && <small className="support-pending-message">Queued for delivery when the connection returns.</small>}
                        </>
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
              maxLength={2000}
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

      {!isGuest && supportConversation && (
        <aside className="support-widget" aria-label="Live support">
          {supportPanelOpen && (
            <section className="support-widget-panel" role="dialog" aria-label="Live support conversation">
              <header className="support-widget-header">
                <div className="support-widget-header-info">
                  <div className="support-widget-avatar-torch" aria-hidden="true">
                    <img src={upangLogo} alt="" />
                  </div>
                  <div>
                    <div className="support-widget-title-row">
                      <strong>Live Support</strong>
                      <span className={`support-live-pulse-dot ${supportConversation.status === 'live_chat' ? 'is-live' : ''}`} aria-hidden="true" />
                    </div>
                    <span className={`support-widget-status support-widget-status-${supportConversation.status}`}>
                      {supportConversation.status === 'waiting_for_support' && 'Waiting for Support'}
                      {supportConversation.status === 'assigned' && 'Assigned'}
                      {supportConversation.status === 'live_chat' && 'Live Chat'}
                      {supportConversation.status === 'resolved' && 'Resolved'}
                      {supportConversation.status === 'ended_by_student' && 'Ended by you'}
                    </span>
                  </div>
                </div>
                <button type="button" onClick={handleReturnToAI} aria-label="Close live support" className="support-widget-close-btn">×</button>
              </header>

              <div className="support-widget-transcript" aria-live="polite">
                {supportConversation.status === 'waiting_for_support' && (
                  <p className="support-widget-notice">Your inquiry is saved. An administrator will reply here when available.</p>
                )}
                {supportConversation.status === 'assigned' && (
                  <p className="support-widget-notice">An administrator accepted your inquiry and will reply here.</p>
                )}
                {supportConversation.status === 'resolved' && (
                  <p className="support-widget-notice">This inquiry has been answered and resolved. You can return to AI Chat or reopen Live Chat.</p>
                )}
                {supportConversation.status === 'ended_by_student' && (
                  <p className="support-widget-notice">You ended this conversation. You can return to AI Chat or reopen Live Support.</p>
                )}
                {supportConversation.messages.map((message) => {
                  const mapped = mapSupportMessage(message)
                  const isUser = mapped.sender === 'user'
                  return (
                    <div
                      key={message.clientMessageId || message._id}
                      className={`support-widget-row support-widget-row-${mapped.sender}`}
                    >
                      {!isUser && (
                        <div className="support-widget-avatar" aria-hidden="true">
                          <img src={upangLogo} alt="" />
                        </div>
                      )}
                      <div className={`support-widget-message support-widget-message-${mapped.sender}`}>
                        {mapped.sender === 'admin' && (
                          <div className="support-widget-sender-header">
                            <span className="support-widget-badge">LIVE AGENT</span>
                            <strong className="support-widget-admin-name">{mapped.senderName || 'Support administrator'}</strong>
                          </div>
                        )}
                        <p>{mapped.text}</p>
                        <div className="support-widget-meta">
                          {mapped.timestamp && <span className="support-widget-time">{mapped.timestamp}</span>}
                          {message.pending && <small>Waiting for connection…</small>}
                          {isUser && !message.pending && <span className="support-widget-ticks" aria-hidden="true">✓✓</span>}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {['resolved', 'ended_by_student'].includes(supportConversation.status) ? (
                <div className="support-widget-actions">
                  <button type="button" onClick={handleReturnToAI}>Return to AI Chat</button>
                  <button type="button" onClick={handleReopenSupport} disabled={supportBusy}>
                    {supportBusy ? 'Reopening…' : 'Reopen Live Chat'}
                  </button>
                </div>
              ) : (
                <form className="support-widget-composer" onSubmit={handleSupportMessageSubmit}>
                  <input
                    value={supportDraft}
                    maxLength={2000}
                    onChange={(event) => setSupportDraft(event.target.value)}
                    placeholder="Message the support team…"
                    aria-label="Message live support"
                  />
                  <button type="submit" disabled={!supportDraft.trim()} aria-label="Send support message">Send</button>
                </form>
              )}
              {!['resolved', 'ended_by_student'].includes(supportConversation.status) && (
                <div className="support-widget-end-actions">
                  {confirmEndSupport ? (
                    <>
                      <span>End this support conversation?</span>
                      <button type="button" className="support-widget-end-confirm" onClick={() => void handleEndSupport()} disabled={endingSupport}>
                        {endingSupport ? 'Ending…' : 'Yes, end'}
                      </button>
                      <button type="button" className="support-widget-end-cancel" onClick={() => setConfirmEndSupport(false)} disabled={endingSupport}>
                        Keep chatting
                      </button>
                    </>
                  ) : (
                    <button type="button" className="support-widget-end-trigger" onClick={() => setConfirmEndSupport(true)}>
                      End conversation
                    </button>
                  )}
                </div>
              )}
            </section>
          )}
          {!supportPanelOpen && (
            <button
              type="button"
              className="support-widget-bubble"
              onClick={handleSupportPanelToggle}
              aria-expanded={false}
              aria-label={`Open Live Support${supportUnreadCount
                ? `, ${supportUnreadCount} new ${supportUnreadCount === 1 ? 'reply' : 'replies'}`
                : `: ${supportConversation.status === 'waiting_for_support'
                  ? 'Waiting for an administrator'
                  : supportConversation.status === 'assigned'
                    ? 'Administrator assigned'
                    : supportConversation.status === 'live_chat'
                      ? 'View your support chat'
                      : supportConversation.status === 'ended_by_student'
                        ? 'Ended by you'
                        : 'View answered inquiry'}`}`}
            >
              <svg className="support-widget-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5 7.9 7.9 0 0 1-3.3-.72L4 20l1.72-4.48A7.9 7.9 0 0 1 5 12a7.5 7.5 0 1 1 15 0v-.5Z" />
                <path d="M8.5 12h.01M12 12h.01M15.5 12h.01" />
              </svg>
              {supportUnreadCount > 0 && (
                <span className="support-widget-unread" aria-hidden="true">
                  {supportUnreadCount > 9 ? '9+' : supportUnreadCount}
                </span>
              )}
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
            <span
              className="toast-duration-bar"
              style={{ animationDuration: `${toast.duration}ms` }}
              aria-hidden="true"
            />
          </div>
        ))}
      </div>
    </div>
  )
}

function HomeLoadingScreen() {
  return (
    <main className="home-loading" role="status" aria-live="polite">
      <div className="home-loading-mark">
        <img src={upangLogo} alt="" className="home-loading-logo" />
      </div>
      <p className="home-loading-kicker">UPANG ASSIST</p>
      <h1>Preparing your campus assistant</h1>
      <div className="home-loading-bar" aria-hidden="true"><span></span></div>
      <p className="home-loading-note">Loading your personalized experience...</p>
    </main>
  )
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

function createClientId(prefix) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`
}

function mapSupportMessage(message) {
  const sender = message.sender === 'student' ? 'user' : message.sender
  return {
    id: message.clientMessageId || String(message._id),
    sender,
    senderName: message.senderName,
    text: message.text,
    timestamp: message.createdAt
      ? new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '',
  }
}

const LEGAL_POLICIES = {
  // Increment a document's version whenever its content changes.
  terms: {
    version: '1.0.0',
    title: 'Terms & Conditions',
    sections: [
      {
        heading: '1. Acceptance of Terms',
        paragraphs: [
          'By creating an account or using UPang Assist, you agree to be bound by these Terms & Conditions. If you do not agree with any part of these terms, you should not access or use the platform.',
          'UPang Assist is a student and faculty support platform for PHINMA University of Pangasinan information, campus guidance, and general assistance. It is intended to provide helpful information and should not replace official university communications or decisions.',
        ],
      },
      {
        heading: '2. Use of the Service',
        paragraphs: [
          'You agree to use UPang Assist only for lawful, educational, and campus-related purposes. You must not use the system to harass, mislead, impersonate others, or attempt unauthorized access to university systems or personal data.',
          'You are responsible for the accuracy of the information you provide during registration and for maintaining the confidentiality of your account credentials.',
        ],
      },
      {
        heading: '3. Availability and Accuracy',
        paragraphs: [
          'UPang Assist may provide general information about registrar services, campus offices, tuition, scholarships, and enrollment procedures. While we strive to keep information accurate and up to date, we do not guarantee that all details are current or final.',
          'For critical decisions, official deadlines, financial obligations, academic requirements, and policy matters, always verify with the appropriate university office, registrar, or department.',
        ],
      },
      {
        heading: '4. Intellectual Property',
        paragraphs: [
          'All branding, design elements, text, graphics, and software features associated with UPang Assist are the property of the platform owner or its authorized partners unless otherwise stated. You may not copy, repurpose, or distribute platform content without permission.',
        ],
      },
      {
        heading: '5. Limitation of Liability',
        paragraphs: [
          'UPang Assist is provided on an “as is” basis. We do not guarantee uninterrupted access, error-free responses, or the completeness of all information. In no event shall the platform owner or affiliated parties be liable for direct, indirect, incidental, or consequential damages arising from use of the service.',
        ],
      },
      {
        heading: '6. Termination and Changes',
        paragraphs: [
          'We may suspend or discontinue access to UPang Assist at any time for operational, legal, or security reasons. We also reserve the right to update or revise these Terms & Conditions whenever necessary to reflect changes in service, regulations, or platform features.',
        ],
      },
    ],
  },
  privacy: {
    version: '1.0.0',
    title: 'Privacy Policy',
    sections: [
      {
        heading: '1. Information We Collect',
        paragraphs: [
          'When you register or use UPang Assist, we may collect information such as your name, email address, role, and device-related usage data needed to deliver the service and improve your experience.',
          'We may also collect information about the way you interact with the platform, including questions asked, preferences, and basic account activity for support and performance monitoring.',
        ],
      },
      {
        heading: '2. How We Use Your Information',
        paragraphs: [
          'We use your information to create and maintain your account, personalize content, provide campus-related assistance, and improve the quality and reliability of the service.',
          'We may also use aggregate or anonymized information to monitor usage patterns, system performance, and product enhancements.',
        ],
      },
      {
        heading: '3. Confidentiality and Security',
        paragraphs: [
          'We treat account information as confidential and use reasonable administrative, technical, and organizational safeguards to protect it from unauthorized access, disclosure, and misuse.',
          'However, no online system is completely secure. While we take care to protect your data, we cannot guarantee absolute security against unforeseen vulnerabilities or malicious activity.',
        ],
      },
      {
        heading: '4. Data Sharing',
        paragraphs: [
          'We do not sell your personal information to third parties. We may share limited information with trusted service providers who support hosting, security, analytics, or technical operations, only as necessary to run the platform.',
          'Information may also be disclosed when required by law, university policy, legal process, or to protect the rights and safety of users or the institution.',
        ],
      },
      {
        heading: '5. Your Choices and Rights',
        paragraphs: [
          'You may update your account information or preferences within the application as available. You may also choose to use the platform in guest mode without creating an account for some features.',
          'If you believe your personal data is inaccurate or no longer needed, you may contact the platform administrator or support channel to request assistance with correction or account-related inquiries.',
        ],
      },
      {
        heading: '6. Updates to This Policy',
        paragraphs: [
          'This Privacy Policy may be updated from time to time to reflect changes in service, legal requirements, or data practices. Continued use of UPang Assist after such updates indicates your acceptance of the revised policy.',
        ],
      },
    ],
  },
}

function LegalDocumentModal({ type, onClose, onReachEnd, onConfirm, hasReachedEnd }) {
  const policy = LEGAL_POLICIES[type]
  const modalRef = useRef(null)
  const documentBodyRef = useRef(null)

  useEffect(() => {
    const previousFocus = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    documentBodyRef.current?.focus()

    return () => {
      document.body.style.overflow = previousOverflow
      previousFocus?.focus?.()
    }
  }, [])

  if (!policy) return null

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }

    if (event.key !== 'Tab') return
    const focusableElements = modalRef.current?.querySelectorAll(
      'button:not([disabled]), [tabindex="0"]'
    )
    if (!focusableElements?.length) return

    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]
    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault()
      lastElement.focus()
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault()
      firstElement.focus()
    }
  }

  const handleDocumentScroll = (event) => {
    const { scrollTop, clientHeight, scrollHeight } = event.currentTarget
    if (scrollTop > 0 && scrollTop + clientHeight >= scrollHeight - 2) {
      onReachEnd(type, policy.version)
    }
  }

  return (
    <div className="legal-modal-backdrop" onClick={onClose}>
      <section
        ref={modalRef}
        className="legal-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="legal-modal-title"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="legal-modal-header">
          <div>
            <p className="legal-kicker">UPang Assist · Version {policy.version}</p>
            <h2 id="legal-modal-title">{policy.title}</h2>
          </div>
          <button
            type="button"
            className="legal-modal-close"
            onClick={onClose}
            aria-label="Close legal document"
          >
            ✕
          </button>
        </div>

        <div
          ref={documentBodyRef}
          className="legal-modal-body"
          role="region"
          aria-label={`${policy.title} document`}
          tabIndex={0}
          onScroll={handleDocumentScroll}
        >
          {policy.sections.map((section) => (
            <section className="legal-section" key={section.heading}>
              <h3>{section.heading}</h3>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </section>
          ))}
        </div>
        <div className={`legal-modal-footer ${hasReachedEnd ? 'is-complete' : ''}`}>
          <p className="legal-modal-status" role="status" aria-live="polite">
            {hasReachedEnd
              ? 'You have reached the end of this document.'
              : 'Scroll to the end of this document to continue.'}
          </p>
          <button
            type="button"
            className="legal-modal-confirm"
            disabled={!hasReachedEnd}
            onClick={() => onConfirm(type, policy.version)}
          >
            I have read and agree
          </button>
        </div>
      </section>
    </div>
  )
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 48 48">
      <path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.6c3.9-3.6 6.1-8.8 6.1-15Z" />
      <path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.6-5.1c-1.8 1.2-4.1 2-6.9 2-5.3 0-9.8-3.6-11.4-8.4H5.8v5.2A20 20 0 0 0 24 44Z" />
      <path fill="#FBBC05" d="M12.6 27.6a12 12 0 0 1 0-7.2v-5.2H5.8a20 20 0 0 0 0 17.6l6.8-5.2Z" />
      <path fill="#EA4335" d="M24 12c3 0 5.7 1 7.8 3.1l5.8-5.8C34.1 6 29.5 4 24 4A20 20 0 0 0 5.8 15.2l6.8 5.2C14.2 15.6 18.7 12 24 12Z" />
    </svg>
  )
}

function LoginPage({ onGuest, onSignUp, onAuthenticated }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [authError, setAuthError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const googleButtonRef = useRef(null)
  const onAuthenticatedRef = useRef(onAuthenticated)

  useEffect(() => {
    onAuthenticatedRef.current = onAuthenticated
  }, [onAuthenticated])

  useEffect(() => {
    if (!googleClientId) return undefined
    let cancelled = false
    let script = document.getElementById('google-identity-services')
    const handleScriptError = () => {
      if (!cancelled) setAuthError('Google sign-in could not load. Check your internet connection and try again.')
    }
    const initializeGoogleButton = () => {
      const identity = window.google?.accounts?.id
      if (cancelled || !identity || !googleButtonRef.current) return
      googleButtonRef.current.replaceChildren()
      identity.initialize({
        client_id: googleClientId,
        callback: async (response = {}) => {
          const { credential } = response
          if (!credential) {
            setAuthError('Google sign-in did not return a credential. Please try again.')
            return
          }
          setAuthError('')
          setIsSubmitting(true)
          try {
            const response = await fetch(`${apiBaseUrl}/auth/google`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ credential }),
            })
            const data = await parseAuthResponse(response, 'Google sign-in failed.')
            onAuthenticatedRef.current(data)
          } catch (error) {
            console.error('Google sign-in failed:', error)
            setAuthError(getAuthErrorMessage(error, 'Google sign-in failed. Please try again.'))
          } finally {
            setIsSubmitting(false)
          }
        },
      })
      identity.renderButton(googleButtonRef.current, {
        theme: 'outline',
        size: 'large',
        shape: 'rectangular',
        text: 'continue_with',
        width: 200,
        logo_alignment: 'left',
      })
    }

    if (!script) {
      script = document.createElement('script')
      script.id = 'google-identity-services'
      script.src = 'https://accounts.google.com/gsi/client'
      script.async = true
      script.defer = true
      script.addEventListener('load', initializeGoogleButton)
      script.addEventListener('error', handleScriptError)
      document.head.appendChild(script)
    } else {
      script.addEventListener('load', initializeGoogleButton)
      script.addEventListener('error', handleScriptError)
      initializeGoogleButton()
    }
    return () => {
      cancelled = true
      script?.removeEventListener('load', initializeGoogleButton)
      script?.removeEventListener('error', handleScriptError)
    }
  }, [])

  const handleGoogleButtonFallback = () => {
    setAuthError('Google sign-in is not configured. Set VITE_GOOGLE_CLIENT_ID in the student app and GOOGLE_CLIENT_ID in the API.')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setAuthError('')
    setIsSubmitting(true)
    try {
      const response = await fetch(`${apiBaseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await parseAuthResponse(response, 'Sign-in failed.')
      onAuthenticated(data)
    } catch (error) {
      console.error('Sign-in failed:', error)
      setAuthError(getAuthErrorMessage(error, 'Sign-in failed. Please try again.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="login-screen-root">
      {/* ── Left Branded Visual Panel ── */}
      <section
        className="login-visual-panel"
        style={{
          backgroundImage: `linear-gradient(135deg, rgba(14, 43, 28, 0.88) 0%, rgba(9, 29, 18, 0.84) 100%), url(${upangCampus})`,
        }}
        aria-label="PHINMA University of Pangasinan"
      >
        <div className="visual-top-content">
          <div className="visual-torch-badge">
            <img src={upangLogo} alt="PHINMA UPang Emblem" className="torch-logo-img" />
          </div>
          <p className="visual-kicker-text">PHINMA EDUCATION</p>
          <h2 className="visual-main-title">Upang Assist</h2>
          <p className="visual-sub-brand">PHINMA University of Pangasinan</p>
          <p className="visual-subtitle-text">Making Lives Better Through Education</p>

          <div className="visual-bottom-footer">
            DAGUPAN CITY • URDANETA CITY CAMPUS
          </div>
        </div>
      </section>

      {/* ── Right Form Panel ── */}
      <section className="login-form-panel">
        <div className="form-panel-watermark" aria-hidden="true">
          <img src={upangLogo} alt="" />
        </div>

        <div className="form-panel-topbar">
          <div className="topbar-mode-toggle" aria-label="Account mode">
            <span className="mode-toggle-item active">Log In</span>
            <button type="button" className="mode-toggle-item" onClick={onSignUp}>Sign Up</button>
          </div>
        </div>

        <div className="form-panel-body">
          <div className="portal-badge-pill">
            STUDENT &amp; FACULTY PORTAL
          </div>

          <h1 className="form-main-heading">
            Welcome Back to Upang<br />
            <span className="heading-highlight-gold">Assist</span>
          </h1>

          <p className="form-instruction-text">
            Enter your credentials to access campus chatbot.
          </p>

          <form className="auth-form-fields" onSubmit={handleSubmit}>
            <div className="auth-field-group">
              <label htmlFor="email" className="auth-field-label">Student Email Address</label>
              <div className="auth-input-container">
                <svg className="auth-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
                <input
                  id="email"
                  type="email"
                  placeholder="student@up.phinmaed.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="auth-field-group">
              <div className="auth-field-label-row">
                <label htmlFor="password" className="auth-field-label">Password</label>
              </div>
              <div className="auth-input-container">
                <svg className="auth-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="auth-pwd-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <label className="auth-remember-row">
              <input type="checkbox" />
              <span>Remember this device</span>
            </label>

            <button className="auth-submit-gradient-btn" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Signing in…' : 'Log In →'}
            </button>
            {authError && <p className="auth-legal-error" role="alert">{authError}</p>}
          </form>

          <div className="auth-or-divider">
            <span>OR CONTINUE WITH</span>
          </div>

          <div className="auth-social-grid">
            {googleClientId ? (
              <div className="auth-google-button-slot" ref={googleButtonRef} aria-label="Continue with Google">
                {!window.google?.accounts?.id && <span className="auth-google-loading">Loading Google sign-in…</span>}
              </div>
            ) : (
              <button
                type="button"
                className="auth-social-card auth-google-fallback"
                onClick={handleGoogleButtonFallback}
              >
                <GoogleMark />
                <span>Continue with Google</span>
              </button>
            )}
            <button
              type="button"
              className="auth-social-card"
              onClick={() => onGuest()}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2d553b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                <path d="M6 12v5c3 3 9 3 12 0v-5" />
              </svg>
              <span>Continue as Guest</span>
            </button>
          </div>

          <p className="auth-bottom-footer">
            Don't have an account yet? <button type="button" onClick={onSignUp}>Sign Up Now</button>
          </p>
        </div>
      </section>
    </main>
  )
}

function SignupPage({ onBack, onAuthenticated }) {
  const [form, setForm] = useState({
    fullName: '',
    course: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [legalConfirmations, setLegalConfirmations] = useState({
    terms: { version: LEGAL_POLICIES.terms.version, readAt: null, acceptedAt: null },
    privacy: { version: LEGAL_POLICIES.privacy.version, readAt: null, acceptedAt: null },
  })
  const [activeLegalDoc, setActiveLegalDoc] = useState(null)
  const [legalFormError, setLegalFormError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCourseDropdownOpen, setIsCourseDropdownOpen] = useState(false)
  const courseDropdownRef = useRef(null)
  const courseNativeSelectRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (courseDropdownRef.current && !courseDropdownRef.current.contains(event.target)) {
        setIsCourseDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((currentForm) => ({ ...currentForm, [name]: value }))
  }

  const handleSelectCourse = (selectedCourse) => {
    setForm((current) => ({ ...current, course: selectedCourse }))
    setIsCourseDropdownOpen(false)
    if (courseNativeSelectRef.current) {
      courseNativeSelectRef.current.value = selectedCourse
    }
  }

  const handleClearCourse = () => {
    setForm((prev) => ({ ...prev, course: '' }))
    if (courseNativeSelectRef.current) {
      courseNativeSelectRef.current.value = ''
    }
  }

  const handleCourseKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setIsCourseDropdownOpen((prev) => !prev)
    } else if (event.key === 'Escape') {
      setIsCourseDropdownOpen(false)
    }
  }

  const isLegalDocumentRead = (type) => (
    legalConfirmations[type].version === LEGAL_POLICIES[type].version
    && Boolean(legalConfirmations[type].readAt)
  )

  const isLegalDocumentAccepted = (type) => (
    isLegalDocumentRead(type) && Boolean(legalConfirmations[type].acceptedAt)
  )

  const handleLegalDocumentRead = (type, version) => {
    setLegalConfirmations((current) => {
      if (current[type].version === version && current[type].readAt) return current
      return {
        ...current,
        [type]: { version, readAt: new Date().toISOString(), acceptedAt: null },
      }
    })
  }

  const handleLegalDocumentConfirm = (type, version) => {
    if (!isLegalDocumentRead(type) || LEGAL_POLICIES[type].version !== version) return

    setLegalConfirmations((current) => ({
      ...current,
      [type]: {
        version,
        readAt: current[type].readAt || new Date().toISOString(),
        acceptedAt: new Date().toISOString(),
      },
    }))
    setLegalFormError('')
    setActiveLegalDoc(null)
  }

  const handleLegalAcceptanceChange = (type) => {
    setActiveLegalDoc(type)
    setLegalFormError('')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!isLegalDocumentAccepted('terms') || !isLegalDocumentAccepted('privacy')) {
      setLegalFormError('Read both documents to the end and check both agreement boxes before creating your account.')
      return
    }
    if (form.password !== form.confirmPassword) {
      setLegalFormError('Passwords do not match.')
      return
    }
    if (form.password.length < 12) {
      setLegalFormError('Use a password with at least 12 characters.')
      return
    }
    setLegalFormError('')
    setIsSubmitting(true)
    try {
      const response = await fetch(`${apiBaseUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.fullName,
          email: form.email,
          password: form.password,
          course: form.course,
          accountType: 'student',
        }),
      })
      const data = await parseAuthResponse(response, 'Account creation failed.')
      onAuthenticated(data)
    } catch (error) {
      console.error('Account creation failed:', error)
      setLegalFormError(getAuthErrorMessage(error, 'Account creation failed. Please try again.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      {activeLegalDoc && (
        <LegalDocumentModal
          type={activeLegalDoc}
          onClose={() => setActiveLegalDoc(null)}
          onReachEnd={handleLegalDocumentRead}
          onConfirm={handleLegalDocumentConfirm}
          hasReachedEnd={isLegalDocumentRead(activeLegalDoc)}
        />
      )}
      <main className="login-screen-root signup-screen-root">
      {/* ── Left Branded Visual Panel ── */}
      <section
        className="login-visual-panel"
        style={{
          backgroundImage: `linear-gradient(135deg, rgba(14, 43, 28, 0.88) 0%, rgba(9, 29, 18, 0.84) 100%), url(${upangCampus})`,
        }}
        aria-label="PHINMA University of Pangasinan"
      >
        <div className="visual-top-content">
          <div className="visual-torch-badge">
            <img src={upangLogo} alt="PHINMA UPang Emblem" className="torch-logo-img" />
          </div>
          <p className="visual-kicker-text">PHINMA EDUCATION</p>
          <h2 className="visual-main-title">Upang Assist</h2>
          <p className="visual-sub-brand">PHINMA University of Pangasinan</p>
          <p className="visual-subtitle-text">Making Lives Better Through Education</p>

          <div className="visual-bottom-footer">
            DAGUPAN CITY • URDANETA CITY CAMPUS
          </div>
        </div>
      </section>

      {/* ── Right Form Panel ── */}
      <section className="login-form-panel">
        <div className="form-panel-watermark" aria-hidden="true">
          <img src={upangLogo} alt="" />
        </div>

        <div className="form-panel-topbar">
          <div className="topbar-mode-toggle" aria-label="Account mode">
            <button type="button" className="mode-toggle-item" onClick={onBack}>Log In</button>
            <span className="mode-toggle-item active">Sign Up</span>
          </div>
        </div>

        <div className="form-panel-body">
          <div className="portal-badge-pill">
            STUDENT &amp; FACULTY PORTAL
          </div>

          <h1 className="form-main-heading">
            Create Your Account<br />
            <span className="heading-highlight-gold">Upang Assist</span>
          </h1>

          <form className="auth-form-fields" onSubmit={handleSubmit}>
            <div className="auth-field-group">
              <label htmlFor="full-name" className="auth-field-label">Full Name</label>
              <div className="auth-input-container">
                <svg className="auth-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <input
                  id="full-name"
                  name="fullName"
                  type="text"
                  placeholder="e.g. Juan Dela Cruz"
                  value={form.fullName}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="auth-field-group auth-course-field-group">
              <div className="auth-field-label-row">
                <label htmlFor="signup-course" className="auth-field-label">Course</label>
                {form.course && (
                  <button
                    type="button"
                    className="auth-field-action-link"
                    onClick={handleClearCourse}
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="auth-course-picker-wrapper" ref={courseDropdownRef}>
                <select
                  id="signup-course"
                  name="course"
                  ref={courseNativeSelectRef}
                  value={form.course}
                  onChange={handleChange}
                  required
                  className="auth-course-native-hidden"
                  tabIndex={-1}
                >
                  <option value="" disabled>Select your course</option>
                  {collegeCourses.map(({ college, courses }) => (
                    <optgroup label={college} key={college}>
                      {courses.map((course) => (
                        <option value={course} key={course}>{course}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>

                <div
                  className={`auth-input-container auth-course-input-container ${isCourseDropdownOpen ? 'is-focused' : ''} ${form.course ? 'has-value' : ''}`}
                  onClick={() => setIsCourseDropdownOpen((prev) => !prev)}
                  role="combobox"
                  aria-expanded={isCourseDropdownOpen}
                  aria-haspopup="listbox"
                  aria-controls="signup-course-dropdown"
                  tabIndex={0}
                  onKeyDown={handleCourseKeyDown}
                >
                  <svg className="auth-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m22 10-10-5-10 5 10 5 10-5Z" />
                    <path d="M6 12v5c3.5 3 8.5 3 12 0v-5" />
                    <path d="M22 10v6" />
                  </svg>
                  <div className={`auth-course-input-text ${!form.course ? 'is-placeholder' : ''}`}>
                    {form.course || 'Select your course'}
                  </div>
                  <div className={`auth-select-arrow ${isCourseDropdownOpen ? 'is-open' : ''}`} aria-hidden="true">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                </div>

                {isCourseDropdownOpen && (
                  <div
                    id="signup-course-dropdown"
                    className="auth-course-dropdown-menu"
                    role="listbox"
                    aria-label="Courses"
                  >
                    {collegeCourses.map(({ college, courses }) => (
                      <div key={college} className="auth-course-menu-group">
                        <div className="auth-course-group-header">
                          <span>{college}</span>
                        </div>
                        {courses.map((course) => {
                          const isSelected = form.course === course
                          return (
                            <div
                              key={course}
                              role="option"
                              aria-selected={isSelected}
                              className={`auth-course-menu-item ${isSelected ? 'is-selected' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation()
                                handleSelectCourse(course)
                              }}
                            >
                              <span className="auth-course-menu-item-text">{course}</span>
                              {isSelected && (
                                <svg className="auth-course-check-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {form.course && (
                <div className="auth-course-pill-preview">
                  <span className="auth-course-college-tag">
                    {collegeCourses.find((c) => c.courses.includes(form.course))?.college || 'PHINMA UPang'}
                  </span>
                </div>
              )}
            </div>

            <div className="auth-field-group">
              <label htmlFor="signup-email" className="auth-field-label">Email Address</label>
              <div className="auth-input-container">
                <svg className="auth-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
                <input
                  id="signup-email"
                  name="email"
                  type="email"
                  placeholder="student@up.phinmaed.com"
                  value={form.email}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="auth-field-group">
              <label htmlFor="signup-password" className="auth-field-label">Password</label>
              <div className="auth-input-container">
                <svg className="auth-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <input
                  id="signup-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={handleChange}
                  required
                />
                <button
                  type="button"
                  className="auth-pwd-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="auth-field-group">
              <label htmlFor="confirm-password" className="auth-field-label">Confirm Password</label>
              <div className="auth-input-container">
                <svg className="auth-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <input
                  id="confirm-password"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  required
                />
                <button
                  type="button"
                  className="auth-pwd-toggle"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                >
                  {showConfirmPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="auth-terms-box">
              <label className="auth-checkbox-label">
                <input
                  type="checkbox"
                  checked={isLegalDocumentAccepted('terms')}
                  onChange={() => handleLegalAcceptanceChange('terms')}
                  required
                />
                <span>
                  I agree to the{' '}
                  <button
                    type="button"
                    className="auth-legal-link"
                    onClick={() => {
                      setLegalFormError('')
                      setActiveLegalDoc('terms')
                    }}
                  >
                    Terms &amp; Conditions
                  </button>
                </span>
              </label>
              <label className="auth-checkbox-label">
                <input
                  type="checkbox"
                  checked={isLegalDocumentAccepted('privacy')}
                  onChange={() => handleLegalAcceptanceChange('privacy')}
                  required
                />
                <span>
                  I accept the{' '}
                  <button
                    type="button"
                    className="auth-legal-link"
                    onClick={() => {
                      setLegalFormError('')
                      setActiveLegalDoc('privacy')
                    }}
                  >
                    Privacy Policy
                  </button>
                </span>
              </label>
            </div>

            {legalFormError && <p className="auth-legal-error" role="alert">{legalFormError}</p>}

            <button className="auth-submit-gradient-btn" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating account…' : 'Create Account →'}
            </button>
          </form>

          <p className="auth-bottom-footer">
            Already have an account? <button type="button" onClick={onBack}>Log In</button>
          </p>
        </div>
      </section>
      </main>
    </>
  )
}

/* ── Reusable toggle switch component ── */
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
        onClick={(e) => { e.stopPropagation(); onChange(!checked) }}
        aria-label={label}
      >
        <span className="toggle-switch-thumb" />
      </button>
    </div>
  )
}
