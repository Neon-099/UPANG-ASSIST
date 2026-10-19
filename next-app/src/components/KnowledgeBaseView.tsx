import React, { useState } from 'react'
import {
  BookOpen,
  Plus,
  Search,
  Tag,
  Edit2,
  Trash2,
  Eye,
  X,
  Sparkles,
} from 'lucide-react'
import type { KnowledgeItem, Category } from '../types'

interface KnowledgeBaseViewProps {
  items: KnowledgeItem[]
  onAddItem: (item: Omit<KnowledgeItem, 'id' | 'viewsCount' | 'updatedAt'>) => void
  onUpdateItem: (id: string, updated: Partial<KnowledgeItem>) => void
  onDeleteItem: (id: string) => void
  isAddModalOpen: boolean
  setIsAddModalOpen: (open: boolean) => void
}

const CATEGORIES: Category[] = [
  'Registrar & Records',
  'Tuition & Cashier',
  'Scholarships (Hawak Kamay)',
  'Campus Buildings & Rooms',
  'Enrollment & Advising',
  'Clinic & Student Health',
  'Guidance & Counseling',
  'General Campus Info',
]

export const KnowledgeBaseView: React.FC<KnowledgeBaseViewProps> = ({
  items,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
  isAddModalOpen,
  setIsAddModalOpen,
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('All')
  const [editingItem, setEditingItem] = useState<KnowledgeItem | null>(null)

  // Form State
  const [formTitle, setFormTitle] = useState('')
  const [formCategory, setFormCategory] = useState<Category>('Registrar & Records')
  const [formKeywords, setFormKeywords] = useState('')
  const [formResponse, setFormResponse] = useState('')
  const [formFollowUps, setFormFollowUps] = useState('')
  const [formStatus, setFormStatus] = useState<'active' | 'draft'>('active')

  const openAddModal = () => {
    setEditingItem(null)
    setFormTitle('')
    setFormCategory('Registrar & Records')
    setFormKeywords('')
    setFormResponse('')
    setFormFollowUps('')
    setFormStatus('active')
    setIsAddModalOpen(true)
  }

  const openEditModal = (item: KnowledgeItem) => {
    setEditingItem(item)
    setFormTitle(item.title)
    setFormCategory(item.category)
    setFormKeywords(item.keywords.join(', '))
    setFormResponse(item.response)
    setFormFollowUps(item.followUps.join(', '))
    setFormStatus(item.status === 'draft' ? 'draft' : 'active')
    setIsAddModalOpen(true)
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    const keywordsArr = formKeywords
      .split(',')
      .map((k) => k.trim().toLowerCase())
      .filter(Boolean)
    const followUpsArr = formFollowUps
      .split(',')
      .map((f) => f.trim())
      .filter(Boolean)

    if (editingItem) {
      onUpdateItem(editingItem.id, {
        title: formTitle,
        category: formCategory,
        keywords: keywordsArr,
        response: formResponse,
        followUps: followUpsArr,
        status: formStatus,
        updatedAt: new Date().toISOString().split('T')[0],
      })
    } else {
      onAddItem({
        title: formTitle,
        category: formCategory,
        keywords: keywordsArr,
        response: formResponse,
        followUps: followUpsArr,
        status: formStatus,
      })
    }
    setIsAddModalOpen(false)
  }

  const filteredItems = items.filter((item) => {
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory
    const matchesSearch =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.keywords.some((k) => k.toLowerCase().includes(searchQuery.toLowerCase())) ||
      item.response.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })

  return (
    <div className="min-w-0 space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-black text-white tracking-tight">
              Knowledge Base & AI Responses
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#df9e28]/20 text-[#f0b445] border border-[#df9e28]/40">
              {items.length} Official FAQs
            </span>
          </div>
          <p className="text-xs text-white/60 mt-1">
            Configure campus information answers, official procedures, and keyword triggers delivered by Bexie AI.
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-[#df9e28] to-[#f0b445] hover:brightness-110 text-[#08170f] shadow-lg shadow-black/30 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>New Knowledge Entry</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 glass-panel p-3 rounded-2xl">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search keywords, topics, or response text..."
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-white/10 bg-white/5 text-white placeholder-white/40 focus:outline-none focus:border-[#f0b445]/60 transition-all"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={() => setSelectedCategory('All')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              selectedCategory === 'All'
                ? 'bg-gradient-to-r from-[#df9e28] to-[#f0b445] text-[#08170f] shadow-sm'
                : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
            }`}
          >
            All Categories
          </button>
          {CATEGORIES.slice(0, 4).map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? 'bg-[#10b981] text-white shadow-sm'
                  : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
              }`}
            >
              {cat.split(' ')[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Knowledge Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredItems.map((item) => (
          <div
            key={item.id}
            className="glass-card rounded-3xl p-5 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between gap-3 mb-2.5">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#df9e28]/15 text-[#f0b445] border border-[#df9e28]/35">
                  {item.category}
                </span>

                <div className="flex items-center gap-1.5">
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      item.status === 'active'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                    {item.status.toUpperCase()}
                  </span>
                  <button
                    onClick={() => openEditModal(item)}
                    className="p-1.5 rounded-lg text-white/50 hover:text-[#f0b445] hover:bg-white/10 transition-colors"
                    title="Edit"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onDeleteItem(item.id)}
                    className="p-1.5 rounded-lg text-white/50 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <h3 className="text-sm font-bold text-white leading-snug mb-2">
                {item.title}
              </h3>

              {/* Keyword Triggers */}
              <div className="flex flex-wrap items-center gap-1 mb-3">
                <Tag className="w-3 h-3 text-[#f0b445] mr-0.5" />
                {item.keywords.map((kw) => (
                  <span
                    key={kw}
                    className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white/5 text-white/80 border border-white/5"
                  >
                    {kw}
                  </span>
                ))}
              </div>

              {/* Response Preview */}
              <div className="bg-black/30 rounded-2xl p-3.5 text-xs text-white/70 border border-white/5 mb-3 font-sans line-clamp-4 leading-relaxed whitespace-pre-line">
                {item.response}
              </div>

              {/* Follow-up Prompts */}
              {item.followUps && item.followUps.length > 0 && (
                <div className="mb-2">
                  <span className="text-[10px] font-bold text-[#f0b445] uppercase tracking-wider block mb-1">
                    Follow-up Suggestion Chips:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {item.followUps.map((chip) => (
                      <span
                        key={chip}
                        className="text-[10px] px-2 py-0.5 rounded-md bg-[#10b981]/15 text-[#34d399] border border-[#10b981]/30 font-medium"
                      >
                        {chip}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-white/40">
              <span className="flex items-center gap-1 font-mono">
                <Eye className="w-3 h-3 text-[#f0b445]" /> {item.viewsCount} queries served
              </span>
              <span>Updated: {item.updatedAt}</span>
            </div>
          </div>
        ))}

        {filteredItems.length === 0 && (
          <div className="col-span-full py-16 text-center glass-panel rounded-3xl">
            <BookOpen className="w-8 h-8 text-white/30 mx-auto mb-2" />
            <p className="text-sm font-bold text-white">No Knowledge Base items found</p>
            <p className="text-xs text-white/50 mt-1">Try changing your search keywords or filter category.</p>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-in fade-in">
          <div className="bg-[#0c2217] rounded-3xl border border-[#df9e28]/40 w-full max-w-xl max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)] overflow-y-auto shadow-2xl p-4 sm:p-6">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-[#df9e28]/20 text-[#f0b445]">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h2 className="text-base font-extrabold text-white">
                  {editingItem ? 'Edit Knowledge Entry' : 'Create Knowledge Base Entry'}
                </h2>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 rounded-xl text-white/60 hover:text-white hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-white/80 mb-1">
                  Title / Subject
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Transcript of Records (TOR) Claiming Procedures"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-white/10 bg-white/5 text-white placeholder-white/40 focus:outline-none focus:border-[#f0b445]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-white/80 mb-1">
                    Category
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as Category)}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-white/10 bg-[#08170f] text-white focus:outline-none focus:border-[#f0b445]"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-white/80 mb-1">
                    Status
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as 'active' | 'draft')}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-white/10 bg-[#08170f] text-white focus:outline-none focus:border-[#f0b445]"
                  >
                    <option value="active">Active (Live in Chat)</option>
                    <option value="draft">Draft (Hidden)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-white/80 mb-1">
                  Trigger Keywords (Comma separated)
                </label>
                <input
                  type="text"
                  required
                  value={formKeywords}
                  onChange={(e) => setFormKeywords(e.target.value)}
                  placeholder="e.g. registrar, transcript, tor, records, good moral"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-white/10 bg-white/5 text-white placeholder-white/40 focus:outline-none focus:border-[#f0b445]"
                />
                <span className="text-[10px] text-white/50 mt-1 block">
                  When a student query contains these words, the assistant presents this verified response.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-white/80 mb-1">
                  Official Response (Markdown supported)
                </label>
                <textarea
                  required
                  rows={6}
                  value={formResponse}
                  onChange={(e) => setFormResponse(e.target.value)}
                  placeholder="Provide detailed instructions, office locations, hours, and bullet points..."
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-white/10 bg-white/5 text-white placeholder-white/40 focus:outline-none focus:border-[#f0b445] font-mono leading-relaxed"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-white/80 mb-1">
                  Suggested Follow-up Prompts (Comma separated)
                </label>
                <input
                  type="text"
                  value={formFollowUps}
                  onChange={(e) => setFormFollowUps(e.target.value)}
                  placeholder="e.g. What are the fees?, How long does it take?"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-white/10 bg-white/5 text-white placeholder-white/40 focus:outline-none focus:border-[#f0b445]"
                />
              </div>

              <div className="pt-4 border-t border-white/10 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white/60 hover:bg-white/10 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-[#df9e28] to-[#f0b445] text-[#08170f] shadow-lg shadow-black/30 hover:brightness-110"
                >
                  {editingItem ? 'Save Changes' : 'Publish Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
