import { useCallback, useEffect, useState } from 'react'
import { Activity, ChevronLeft, ChevronRight, GraduationCap, Pencil, Search, ShieldCheck, UsersRound, UserRoundCheck, UserRoundX, X } from 'lucide-react'
import { apiRequest } from '../../api'
import './user-roles.css'

const PAGE_SIZE_OPTIONS = [10, 25, 50]

function formatDate(value) {
  if (!value) return 'Never'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Never' : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function initials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '?'
}

export default function UserRolesView({ currentUserId }) {
  const [data, setData] = useState({ users: [], counts: { total: 0, roles: {}, statuses: {} }, pagination: { page: 1, pages: 1, total: 0, limit: 10 } })
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [role, setRole] = useState('all')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingUser, setEditingUser] = useState(null)
  const [saving, setSaving] = useState(false)

  const loadUsers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit), search, role, status })
      const result = await apiRequest(`/admin/users?${params}`)
      setData(result)
      setError('')
    } catch (requestError) {
      setError(requestError.message || 'Unable to load user accounts.')
    } finally {
      setLoading(false)
    }
  }, [page, limit, search, role, status])

  useEffect(() => { void loadUsers() }, [loadUsers])

  const submitSearch = (event) => {
    event.preventDefault()
    setPage(1)
    setSearch(searchInput.trim())
  }
  const saveUser = async (event) => {
    event.preventDefault()
    if (!editingUser) return
    setSaving(true)
    try {
      await apiRequest(`/admin/users/${encodeURIComponent(editingUser._id)}`, { method: 'PATCH', body: JSON.stringify({ status: editingUser.status }) })
      setEditingUser(null)
      await loadUsers()
    } catch (requestError) { setError(requestError.message || 'Unable to update user account.') }
    finally { setSaving(false) }
  }
  const toggleUserStatus = async (user) => {
    const nextStatus = user.status === 'active' ? 'inactive' : 'active'
    if (nextStatus === 'inactive' && !window.confirm(`Set ${user.name}'s account to inactive? They will no longer be able to sign in.`)) return
    try {
      await apiRequest(`/admin/users/${encodeURIComponent(user._id)}`, { method: 'PATCH', body: JSON.stringify({ status: nextStatus }) })
      await loadUsers()
    } catch (requestError) { setError(requestError.message || 'Unable to update account status.') }
  }
  const pagination = data.pagination
  const start = pagination.total ? (pagination.page - 1) * pagination.limit + 1 : 0
  const end = Math.min(pagination.page * pagination.limit, pagination.total)

  return (
    <section className="user-roles-page">
      <header className="user-roles-heading">
        <div><p className="user-roles-kicker">Account administration</p><h1>User Roles</h1><p>Review registered accounts, assigned access roles, and account status.</p></div>
        <button type="button" className="user-roles-refresh" onClick={() => void loadUsers()} disabled={loading}><Activity className={loading ? 'is-spinning' : ''} />Refresh</button>
      </header>

      <div className="user-roles-stats" aria-label="Account summary">
        <article className="user-roles-stat"><span className="user-roles-stat-icon gold"><UsersRound /></span><div><span>Total accounts</span><strong>{data.counts.total || 0}</strong><small>Registered users</small></div></article>
        <article className="user-roles-stat"><span className="user-roles-stat-icon green"><GraduationCap /></span><div><span>Students</span><strong>{data.counts.roles?.student || 0}</strong><small>Student access</small></div></article>
        <article className="user-roles-stat"><span className="user-roles-stat-icon gold"><ShieldCheck /></span><div><span>Administrators</span><strong>{data.counts.roles?.admin || 0}</strong><small>Admin access</small></div></article>
        <article className="user-roles-stat"><span className="user-roles-stat-icon green"><span className="user-roles-live-dot" /></span><div><span>Active accounts</span><strong>{data.counts.statuses?.active || 0}</strong><small>Can sign in</small></div></article>
        <article className="user-roles-stat"><span className="user-roles-stat-icon amber"><UserRoundX /></span><div><span>Inactive accounts</span><strong>{data.counts.statuses?.inactive || 0}</strong><small>Sign-in disabled</small></div></article>
      </div>

      {error && <div className="user-roles-error" role="alert">{error}<button type="button" onClick={() => setError('')} aria-label="Dismiss">×</button></div>}

      <div className="user-roles-panel">
        <div className="user-roles-panel-header"><div><h2>Accounts</h2><p>Search and filter users by account role or status.</p></div><span className="user-roles-result-count">{pagination.total} results</span></div>
        <form className="user-roles-filters" onSubmit={submitSearch}>
          <label className="user-roles-search"><Search aria-hidden="true" /><input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search name, email, or course" aria-label="Search users" /><button type="submit">Search</button></label>
          <label className="user-roles-select-label"><span>Role</span><select value={role} onChange={(event) => { setRole(event.target.value); setPage(1) }} aria-label="Filter users by role"><option value="all">All roles</option><option value="student">Student</option><option value="admin">Administrator</option></select></label>
          <label className="user-roles-select-label"><span>Status</span><select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }} aria-label="Filter users by status"><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
        </form>

        <div className="user-roles-table-wrap"><table className="user-roles-table"><thead><tr><th>User</th><th>Course</th><th>Role</th><th>Status</th><th>Last login</th><th>Joined</th><th>Actions</th></tr></thead>
          <tbody>{data.users.map((user) => <tr key={user._id}>
            <td><div className="user-roles-person"><span className={`user-roles-avatar ${user.role === 'admin' ? 'admin' : ''}`}>{initials(user.name)}</span><span><strong>{user.name}</strong><small>{user.email}</small></span></div></td>
            <td><span className="user-roles-course">{user.course || '—'}</span></td>
            <td><span className={`user-roles-role ${user.role}`} >{user.role === 'admin' ? <ShieldCheck /> : <GraduationCap />}{user.role === 'admin' ? 'Administrator' : 'Student'}</span></td>
            <td><span className={`user-roles-status ${user.status}`}><i />{user.status === 'active' ? 'Active' : 'Inactive'}</span></td>
            <td>{formatDate(user.lastLoginAt)}</td><td>{formatDate(user.createdAt)}</td>
            <td><div className="user-roles-actions"><button type="button" onClick={() => setEditingUser({ ...user })} aria-label={`Edit ${user.name}`}><Pencil />Edit</button><button type="button" className={user.status === 'active' ? 'inactive' : 'activate'} onClick={() => void toggleUserStatus(user)} disabled={String(user._id) === currentUserId} aria-label={`${user.status === 'active' ? 'Set inactive' : 'Set active'}: ${user.name}`}>{user.status === 'active' ? <><UserRoundX />Set inactive</> : <><UserRoundCheck />Set active</>}</button></div></td>
          </tr>)}</tbody>
        </table>
        {!data.users.length && <div className="user-roles-empty">{loading ? 'Loading user accounts…' : 'No accounts match these filters.'}</div>}
        </div>

        <footer className="user-roles-pagination"><div className="user-roles-page-size"><span>Rows per page</span><select value={limit} onChange={(event) => { setLimit(Number(event.target.value)); setPage(1) }} aria-label="Rows per page">{PAGE_SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size}</option>)}</select><span className="user-roles-showing">{start}–{end} of {pagination.total}</span></div>
          <div className="user-roles-page-controls"><span>Page {pagination.page} of {pagination.pages}</span><button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={pagination.page <= 1 || loading} aria-label="Previous page"><ChevronLeft /></button><button type="button" onClick={() => setPage((current) => Math.min(pagination.pages, current + 1))} disabled={pagination.page >= pagination.pages || loading} aria-label="Next page"><ChevronRight /></button></div>
        </footer>
      </div>
      {editingUser && <div className="user-roles-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setEditingUser(null) }}><section className="user-roles-modal" role="dialog" aria-modal="true" aria-labelledby="user-edit-title"><header><div><h2 id="user-edit-title">Edit account</h2><p>{editingUser.name} · {editingUser.email}</p></div><button type="button" onClick={() => setEditingUser(null)} disabled={saving} aria-label="Close"><X /></button></header><form onSubmit={saveUser}><label>Role<span className={`user-roles-role ${editingUser.role}`} aria-readonly="true">{editingUser.role === 'admin' ? <ShieldCheck /> : <GraduationCap />}{editingUser.role === 'admin' ? 'Administrator' : 'Student'}</span></label><label>Account status<select value={editingUser.status} onChange={(event) => setEditingUser((current) => ({ ...current, status: event.target.value }))}><option value="active">Active</option><option value="inactive">Inactive</option></select></label><footer><button type="button" onClick={() => setEditingUser(null)} disabled={saving}>Cancel</button><button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button></footer></form></section></div>}
    </section>
  )
}
