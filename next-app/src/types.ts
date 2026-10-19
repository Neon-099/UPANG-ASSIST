export type AdminTab = 'dashboard' | 'knowledge' | 'inquiries' | 'users' | 'settings'

export type Category =
  | 'Registrar & Records'
  | 'Tuition & Cashier'
  | 'Scholarships (Hawak Kamay)'
  | 'Campus Buildings & Rooms'
  | 'Enrollment & Advising'
  | 'Clinic & Student Health'
  | 'Guidance & Counseling'
  | 'General Campus Info'

export interface KnowledgeItem {
  id: string
  title: string
  category: Category
  keywords: string[]
  response: string
  followUps: string[]
  status: 'active' | 'draft' | 'archived'
  updatedAt: string
  viewsCount: number
}

export interface InquiryLog {
  id: string
  studentName: string
  studentId: string
  query: string
  responseSnippet: string
  category: Category
  timestamp: string
  rating: number // 1 to 5
  status: 'Waiting for Support' | 'Assigned' | 'Live Chat' | 'Resolved' | 'Ended by Student'
  conversationId: string
  assignedTo: string | null
  messages: SupportMessage[]
}

export interface SupportMessage {
  _id?: string
  clientMessageId: string
  sender: 'student' | 'assistant' | 'admin'
  senderName: string
  text: string
  createdAt: string
}

export interface UserAccount {
  id: string
  name: string
  email: string
  role: 'Admin' | 'Staff' | 'Faculty' | 'Student'
  department: string
  status: 'Active' | 'Suspended' | 'Pending'
  lastActive: string
}

export interface SystemSettings {
  botName: string
  botRole: string
  aiGreeting: string
  aiFallbackResponse: string
  temperature: number
  escalationEmailRegistrar: string
  escalationEmailCashier: string
  escalationEmailScholarship: string
  adminPort: number
  studentPort: number
  serverPort: number
}
