import React, { useState } from 'react'
import {
  UserPlus,
  Search,
  Shield,
  GraduationCap,
  Briefcase,
  X,
} from 'lucide-react'
import type { UserAccount } from '../types'

interface UsersViewProps {
  users: UserAccount[]
  onAddUser: (user: Omit<UserAccount, 'id' | 'lastActive'>) => void
  onUpdateRole: (id: string, role: UserAccount['role']) => void
}

export const UsersView: React.FC<UsersViewProps> = ({
  users,
  onAddUser,
  onUpdateRole,
}) => {
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('All')
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Form State
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<UserAccount['role']>('Student')
  const [department, setDepartment] = useState('BS Information Technology (CITE)')

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    onAddUser({
      name,
      email,
      role,
      department,
      status: 'Active',
    })
    setName('')
    setEmail('')
    setIsModalOpen(false)
  }

  const filtered = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.department.toLowerCase().includes(search.toLowerCase())
    const matchesRole = roleFilter === 'All' || u.role === roleFilter
    return matchesSearch && matchesRole
  })

  return (
    <div className="min-w-0 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-black text-white tracking-tight">
              Campus User Accounts & Roles
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#df9e28]/20 text-[#f0b445] border border-[#df9e28]/40">
              {users.length} Users Registered
            </span>
          </div>
          <p className="text-xs text-white/60 mt-1">
            Manage administrative privileges, faculty members, and student access for Upang Assist.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-[#df9e28] to-[#f0b445] hover:brightness-110 text-[#08170f] shadow-lg shadow-black/30 transition-all self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4 stroke-[2.5]" />
          <span>Add Account</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 glass-panel p-3 rounded-2xl">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, or college department..."
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-white/10 bg-white/5 text-white placeholder-white/40 focus:outline-none focus:border-[#f0b445]"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto">
          {['All', 'Admin', 'Faculty', 'Staff', 'Student'].map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                roleFilter === r
                  ? 'bg-gradient-to-r from-[#df9e28] to-[#f0b445] text-[#08170f] shadow-sm'
                  : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="glass-panel rounded-3xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead className="border-b border-white/10 text-white/50 uppercase tracking-wider text-[10px] font-bold">
              <tr>
                <th className="py-3.5 px-4">User</th>
                <th className="py-3.5 px-4">Role</th>
                <th className="py-3.5 px-4">College / Department</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Last Active</th>
                <th className="py-3.5 px-4 text-right">Modify Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map((user) => (
                <tr key={user.id} className="hover:bg-white/[0.04] transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#df9e28]/25 to-[#10b981]/25 border border-[#df9e28]/40 flex items-center justify-center font-bold text-[#f0b445]">
                        {user.name.slice(0, 1)}
                      </div>
                      <div>
                        <div className="font-bold text-white">{user.name}</div>
                        <div className="text-[11px] text-white/40 font-mono">{user.email}</div>
                      </div>
                    </div>
                  </td>

                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        user.role === 'Admin'
                          ? 'bg-[#df9e28]/20 text-[#f0b445] border border-[#df9e28]/40'
                          : user.role === 'Faculty'
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                          : user.role === 'Staff'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      }`}
                    >
                      {user.role === 'Admin' && <Shield className="w-3 h-3" />}
                      {user.role === 'Faculty' && <Briefcase className="w-3 h-3" />}
                      {user.role === 'Student' && <GraduationCap className="w-3 h-3" />}
                      {user.role}
                    </span>
                  </td>

                  <td className="py-3 px-4 text-white/80">
                    {user.department}
                  </td>

                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                      {user.status}
                    </span>
                  </td>

                  <td className="py-3 px-4 font-mono text-[11px] text-white/40">
                    {user.lastActive}
                  </td>

                  <td className="py-3 px-4 text-right">
                    <select
                      value={user.role}
                      onChange={(e) => onUpdateRole(user.id, e.target.value as UserAccount['role'])}
                      className="px-2.5 py-1 rounded-xl border border-white/10 bg-[#08170f] text-white text-[11px] focus:outline-none focus:border-[#f0b445]"
                    >
                      <option value="Student">Student</option>
                      <option value="Faculty">Faculty</option>
                      <option value="Staff">Staff</option>
                      <option value="Admin">Admin</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-in fade-in">
          <div className="bg-[#0c2217] rounded-3xl border border-[#df9e28]/40 w-full max-w-md max-h-[calc(100dvh-1.5rem)] overflow-y-auto shadow-2xl p-4 sm:p-6">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-sm font-extrabold text-white">Add Campus Account</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-xl text-white/60 hover:text-white hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAdd} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-white/80 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Maria Clarissa Santos"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-white/5 text-white placeholder-white/40 focus:outline-none focus:border-[#f0b445]"
                />
              </div>

              <div>
                <label className="block font-bold text-white/80 mb-1">
                  UPang Official Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="student@up.phinma.edu.ph"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-white/5 text-white placeholder-white/40 focus:outline-none focus:border-[#f0b445]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-white/80 mb-1">
                    System Role
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserAccount['role'])}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-[#08170f] text-white focus:outline-none focus:border-[#f0b445]"
                  >
                    <option value="Student">Student</option>
                    <option value="Faculty">Faculty</option>
                    <option value="Staff">Staff</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-white/80 mb-1">
                    Department
                  </label>
                  <input
                    type="text"
                    required
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="e.g. CEA, CBT, CITE"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-white/5 text-white placeholder-white/40 focus:outline-none focus:border-[#f0b445]"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-white/10 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-white/60 hover:bg-white/10 hover:text-white font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl font-bold bg-gradient-to-r from-[#df9e28] to-[#f0b445] text-[#08170f] shadow-lg shadow-black/30 hover:brightness-110"
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
