import type { KnowledgeItem, InquiryLog, UserAccount, SystemSettings } from '../types'

export const INITIAL_KNOWLEDGE: KnowledgeItem[] = []

export const INITIAL_INQUIRIES: InquiryLog[] = []

export const INITIAL_USERS: UserAccount[] = []

export const INITIAL_SETTINGS: SystemSettings = {
  botName: 'Bexie (UPang AI Assistant)',
  botRole: 'Campus Information & Academic Navigation Assistant',
  aiGreeting: 'Hello, Guest! I am here to assist you with anything regarding PHINMA University of Pangasinan.',
  aiFallbackResponse: "I am not completely certain about this specific detail. Would you like me to connect you with the appropriate University office or provide their window contact hours?",
  temperature: 0.35,
  escalationEmailRegistrar: 'registrar.up@phinmaed.com',
  escalationEmailCashier: 'cashier.up@phinmaed.com',
  escalationEmailScholarship: 'scholarships.up@phinmaed.com',
  adminPort: 5174,
  studentPort: 5173,
  serverPort: 3000,
}
