import React from 'react'
import {
  LayoutDashboard,
  BookOpen,
  MessageSquareText,
  Users,
  Settings,
  X,
} from 'lucide-react'
import type { AdminTab } from '../types'

interface SidebarProps {
  currentTab: AdminTab
  onSelectTab: (tab: AdminTab) => void
  isOpen: boolean
  onCloseMobile?: () => void
}

const navItems: { id: AdminTab; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'knowledge', label: 'Knowledge Base', icon: BookOpen },
  { id: 'inquiries', label: 'Inquiries', icon: MessageSquareText },
  { id: 'users', label: 'Users & Roles', icon: Users },
  { id: 'settings', label: 'Settings', icon: Settings },
]

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  isOpen,
  onCloseMobile,
}) => {
  const handleNavClick = (tab: AdminTab) => {
    onSelectTab(tab)
    onCloseMobile?.()
  }

  return (
    <>
      {isOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
        />
      )}

      <aside
        className={`
          portal-sidebar fixed inset-y-0 left-0 z-50 flex h-dvh w-72 max-w-[calc(100vw-1rem)] shrink-0 flex-col border-r transition-transform duration-200
          md:static md:h-[calc(100dvh-4rem)] md:w-64 md:translate-x-0 md:flex md:sticky md:top-16
          ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        <div className="portal-sidebar__header flex items-center justify-between border-b px-5 py-4 md:hidden">
          <span className="portal-sidebar__brand font-bold text-sm gold-gradient-text">UPang Assist</span>
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Close navigation"
            className="portal-sidebar__close rounded-lg p-2"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav aria-label="Portal navigation" className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3">
          {navItems.map(({ id, label, icon: Icon }) => {
            const isActive = currentTab === id

            return (
              <button
                key={id}
                type="button"
                aria-current={isActive ? 'page' : undefined}
                onClick={() => handleNavClick(id)}
                className={`portal-sidebar__item flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left text-sm font-medium transition-colors ${
                  isActive ? 'portal-sidebar__item--active' : ''
                }`}
              >
                <Icon
                  className={`portal-sidebar__icon h-4 w-4 shrink-0 ${
                    isActive ? 'portal-sidebar__icon--active' : ''
                  }`}
                />
                <span>{label}</span>
              </button>
            )
          })}
        </nav>
      </aside>
    </>
  )
}
