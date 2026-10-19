import React, { useState, useRef, useEffect } from 'react'
import { ExternalLink, ShieldCheck, Search, RotateCcw, Bell, Check, MessageSquareText, AlertCircle, Sparkles, LogOut } from 'lucide-react'
import upangLogo from '../assets/upang logo.png'
import type { AdminTab } from '../types'

interface NavbarProps {
  userName?: string
  onToggleSidebar?: () => void
  onResetLikeNew?: () => void
  inquiriesCount?: number
  onNavigateTab?: (tab: AdminTab) => void
  onLogout?: () => void
}

interface StaffNotif {
  id: string
  title: string
  desc: string
  time: string
  unread: boolean
  tab?: AdminTab
  type: 'inquiry' | 'alert' | 'system'
}

const DEFAULT_STAFF_NOTIFS: StaffNotif[] = []

export const Navbar: React.FC<NavbarProps> = ({
  userName = 'Engr. Jeremy',
  onToggleSidebar,
  onResetLikeNew,
  inquiriesCount = 2,
  onNavigateTab,
  onLogout,
}) => {
  const [notifs, setNotifs] = useState<StaffNotif[]>(DEFAULT_STAFF_NOTIFS)
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const unreadCount = notifs.filter((n) => n.unread).length || (inquiriesCount > 0 ? inquiriesCount : 0)

  const markAllRead = () => {
    setNotifs((prev) => prev.map((n) => ({ ...n, unread: false })))
  }

  const handleNotifClick = (notif: StaffNotif) => {
    setNotifs((prev) => prev.map((n) => (n.id === notif.id ? { ...n, unread: false } : n)))
    if (notif.tab && onNavigateTab) {
      onNavigateTab(notif.tab)
      setIsOpen(false)
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-white/10 bg-[#0a1a12]/90 backdrop-blur-xl px-2 sm:px-4 md:px-6 transition-colors shadow-lg max-[359px]:h-auto max-[359px]:min-h-16 max-[359px]:flex-wrap max-[359px]:gap-y-1 max-[359px]:py-2">
      <div className="flex min-w-0 items-center gap-3 max-[359px]:flex-1">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="md:hidden p-2 rounded-xl text-white/70 hover:bg-white/10 hover:text-white transition-colors"
            aria-label="Toggle menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}

        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-white/15 to-[#df9e28]/30 p-1.5 flex items-center justify-center border border-[#df9e28]/50 shadow-md">
            <img src={upangLogo} alt="PHINMA UPang" className="h-full w-full object-contain drop-shadow-[0_1px_4px_rgba(240,180,69,0.3)]" />
          </div>
          <div className="max-[399px]:hidden">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base tracking-tight gold-gradient-text">
                UPang Assist
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold bg-[#df9e28]/15 text-[#f0b445] rounded-full border border-[#f0b445]/40 shadow-xs">
                <ShieldCheck className="w-3 h-3 text-[#f0b445]" /> PORTAL
              </span>
            </div>
            <p className="text-[10px] text-white/50 tracking-wide font-medium hidden sm:block">PHINMA UNIVERSITY OF PANGASINAN</p>
          </div>
        </div>
      </div>

      <div className="hidden lg:flex items-center flex-1 max-w-md mx-8">
        <div className="relative w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <input
            type="text"
            placeholder="Search FAQs, student logs, campus directory..."
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-white/10 bg-white/5 text-white placeholder-white/40 focus:outline-none focus:border-[#f0b445]/60 focus:bg-white/8 transition-all"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 max-[359px]:w-full max-[359px]:justify-end max-[359px]:gap-1">
        <a
          href="http://localhost:5173"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open Student Chatbot"
          className="inline-flex items-center gap-1.5 px-2 sm:px-3 py-1.5 text-xs font-semibold rounded-xl text-[#34d399] bg-[#34d399]/10 border border-[#34d399]/30 hover:bg-[#34d399]/20 hover:text-white transition-all shadow-xs"
          title="Open Student Chatbot (localhost:5173)"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
          </span>
          <span className="hidden sm:inline">Student Chatbot</span>
          <span className="hidden font-mono text-[10px] opacity-80 sm:inline">:5173</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>

        {/* Staff Notification Center Bell */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className={`relative p-2 rounded-xl text-white/70 hover:text-[#f0b445] hover:bg-white/10 transition-colors ${
              isOpen ? 'bg-white/10 text-[#f0b445]' : ''
            }`}
            title="Portal Notifications"
            aria-label="Staff Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#f0b445] text-[10px] font-black text-[#0a1a12] shadow-sm">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Staff Notification Dropdown */}
          {isOpen && (
            <div className="fixed right-2 top-[4.5rem] z-50 mt-0 max-h-[calc(100dvh-5rem)] w-[calc(100vw-1rem)] max-w-[20rem] overflow-y-auto rounded-2xl border border-white/10 bg-[#0e2116] p-4 text-white shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-150 sm:absolute sm:right-0 sm:top-auto sm:mt-2 sm:max-h-none sm:w-96 sm:max-w-none">
              <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-sm text-white">Staff Alerts</h4>
                  {unreadCount > 0 && (
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-[#f0b445]/20 text-[#f0b445] border border-[#f0b445]/30">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-[11px] font-medium text-[#f0b445] hover:underline flex items-center gap-1"
                  >
                    <Check className="w-3 h-3" /> Mark all read
                  </button>
                )}
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {notifs.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleNotifClick(item)}
                    className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                      item.unread
                        ? 'border-[#f0b445]/30 bg-[#f0b445]/5 hover:bg-[#f0b445]/10'
                        : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.05]'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5 rounded-lg p-1.5 bg-white/5 border border-white/10 shrink-0">
                        {item.type === 'inquiry' && <MessageSquareText className="w-3.5 h-3.5 text-[#34d399]" />}
                        {item.type === 'alert' && <AlertCircle className="w-3.5 h-3.5 text-[#f0b445]" />}
                        {item.type === 'system' && <Sparkles className="w-3.5 h-3.5 text-sky-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <p className="text-xs font-bold text-white truncate">{item.title}</p>
                          <span className="text-[10px] text-white/40 shrink-0">{item.time}</span>
                        </div>
                        <p className="text-[11px] text-white/70 line-clamp-2 mt-0.5">{item.desc}</p>
                      </div>
                      {item.unread && (
                        <span className="h-2 w-2 rounded-full bg-[#f0b445] shrink-0 mt-1" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {onResetLikeNew && (
          <button
            onClick={onResetLikeNew}
            className="p-2 rounded-xl text-white/70 hover:text-[#f0b445] hover:bg-white/10 transition-colors"
            title="Reset All Data Like New"
            aria-label="Reset All Data Like New"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        )}
        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            className="p-2 rounded-xl text-white/70 hover:text-[#f0b445] hover:bg-white/10 transition-colors"
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}

        <div className="flex items-center gap-2 pl-2 border-l border-white/10">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#10b981] to-[#047857] text-white flex items-center justify-center font-bold text-xs shadow-md border border-white/15">
            {userName.slice(0, 1).toUpperCase()}
          </div>
          <div className="hidden xl:block text-left">
            <div className="text-xs font-bold text-white leading-tight">{userName}</div>
            <div className="text-[10px] text-[#f0b445] font-medium leading-tight">Staff / Manager</div>
          </div>
        </div>
      </div>
    </header>
  )
}
