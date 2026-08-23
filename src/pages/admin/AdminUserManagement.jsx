import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { usersAPI, authAPI } from '../../services/api'
import { ROLES } from '../../contexts/AuthContext'
import {
  Users,
  Search,
  Filter,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Trash2,
  Edit,
  Eye,
  UserPlus,
  UserMinus,
  AlertTriangle,
  Phone
} from 'lucide-react'

const ROLE_CONFIG = {
  director: { prefix: 'GBD', min: 1, max: 500, label: '👔 Director', emoji: '👔' },
  manager: { prefix: 'GBM', min: 1, max: 500, label: '📋 Manager', emoji: '📋' },
  supervisor: { prefix: 'GBS', min: 1, max: 500, label: '👁️ Supervisor', emoji: '👁️' },
  secretary: { prefix: 'GBSEC', min: 1, max: 500, label: '📝 Secretary', emoji: '📝' },
  admin: { prefix: 'GBA', min: 1, max: 500, label: '🛡️ Admin', emoji: '🛡️' },
  guard: { prefix: 'GBG', min: 501, max: 2000, label: '💂 Guard', emoji: '💂' }
}

const AdminUserManagement = () => {
  const { profile } = useAuth()
  const [users, setUsers] = useState([])
  const [filteredUsers, setFilteredUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterRole, setFilterRole] = useState('all')
  const [selectedUser, setSelectedUser] = useState(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [showAddModal, setShowAddModal] = useState(false)
  const [showAddConfirmation, setShowAddConfirmation] = useState(false)
  const [addError, setAddError] = useState('')
  const [addForm, setAddForm] = useState({
    full_name: '',
    email: '',
    role: 'guard',
    number: '',
    phone_number: ''
  })
  const [addLoading, setAddLoading] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [userToDelete, setUserToDelete] = useState(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [showEmergencyContactModal, setShowEmergencyContactModal] = useState(false)
  const [selectedUserForEmergencyContact, setSelectedUserForEmergencyContact] = useState(null)

  useEffect(() => {
    loadUsers()
  }, [])

  useEffect(() => {
    filterUsers()
  }, [searchTerm, filterRole, users])

  const loadUsers = async () => {
    try {
      const data = await usersAPI.getAll()

      setUsers(data.users || [])
      setFilteredUsers(data.users || [])
    } catch (error) {
      console.error('Error loading users:', error)
    } finally {
      setLoading(false)
    }
  }

  const filterUsers = () => {
    let filtered = users

    if (searchTerm) {
      filtered = filtered.filter(user => 
        user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    if (filterRole !== 'all') {
      filtered = filtered.filter(user => user.role === filterRole)
    }

    setFilteredUsers(filtered)
  }

  const generateWorkNumber = (role, number) => {
    if (!role || !number) return ''
    const config = ROLE_CONFIG[role]
    if (!config) return ''
    const num = parseInt(number, 10)
    if (isNaN(num)) return ''
    return `${config.prefix}-${String(num).padStart(3, '0')}`
  }

  const getDisplayWorkNumber = () => {
    return generateWorkNumber(addForm.role, addForm.number)
  }

  const validateNumber = (role, number) => {
    if (!role || !number) return { valid: true, error: null }
    const config = ROLE_CONFIG[role]
    if (!config) return { valid: false, error: 'Invalid role' }
    const num = parseInt(number, 10)
    if (isNaN(num)) return { valid: false, error: 'Number must be a valid integer' }
    if (num < config.min || num > config.max) {
      return { valid: false, error: `Number must be between ${config.min} and ${config.max} for ${config.label}` }
    }
    return { valid: true, error: null }
  }

  const handleEditUser = (user) => {
    setSelectedUser(user)
    setEditForm({
      role: user.role,
      account_status: user.account_status
    })
    setShowEditModal(true)
  }

  const handleEmergencyContactClick = (user) => {
    setSelectedUserForEmergencyContact(user)
    setShowEmergencyContactModal(true)
  }

  const handleEmergencyContactSuccess = (updatedUser) => {
    // Update the user in the list with new emergency contact data
    setUsers(prevUsers => 
      prevUsers.map(u => u.id === updatedUser.id ? { ...u, ...updatedUser } : u)
    )
    setFilteredUsers(prevFiltered => 
      prevFiltered.map(u => u.id === updatedUser.id ? { ...u, ...updatedUser } : u)
    )
    
    // Update selectedUser if it's the same user
    if (selectedUser && selectedUser.id === updatedUser.id) {
      setSelectedUser({ ...selectedUser, ...updatedUser })
    }
  }

  const handleSaveUser = async () => {
    try {
      await usersAPI.update(selectedUser.id, editForm)

      alert('User updated successfully')
      setShowEditModal(false)
      await loadUsers()
    } catch (error) {
      console.error('Error updating user:', error)
      alert('Failed to update user')
    }
  }

  const handleDeleteUser = async (userId) => {
    const user = users.find(u => u.id === userId)
    setUserToDelete(user)
    setShowDeleteModal(true)
  }

  const confirmDeleteUser = async () => {
    if (!userToDelete) return

    setDeleteLoading(true)
    try {
      await usersAPI.delete(userToDelete.id)
      alert('User permanently deleted')
      setShowDeleteModal(false)
      setUserToDelete(null)
      await loadUsers()
    } catch (error) {
      console.error('Error deleting user:', error)
      alert(error.message || 'Failed to delete user')
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleAddUser = async () => {
    setAddError('')
    if (!addForm.full_name || !addForm.email || !addForm.role || !addForm.number || !addForm.phone_number) {
      setAddError('Please fill in all required fields')
      return
    }

    const validation = validateNumber(addForm.role, addForm.number)
    if (!validation.valid) {
      setAddError(validation.error)
      return
    }

    setShowAddConfirmation(true)
  }

  const confirmAddUser = async () => {
    setAddLoading(true)
    try {
      const workNumber = generateWorkNumber(addForm.role, addForm.number)
      await authAPI.register({
        ...addForm,
        work_number: workNumber
      })
      alert('User added successfully. Login credentials have been sent to their email.')
      setShowAddModal(false)
      setShowAddConfirmation(false)
      setAddForm({
        full_name: '',
        email: '',
        role: 'guard',
        number: '',
        phone_number: ''
      })
      await loadUsers()
    } catch (error) {
      console.error('Error adding user:', error)
      setAddError(error.message || 'Failed to add user')
      setShowAddConfirmation(false)
    } finally {
      setAddLoading(false)
    }
  }

  const handlePromoteUser = async (userId, newRole) => {
    try {
      await usersAPI.updateRole(userId, newRole)

      alert(`User promoted to ${newRole}`)
      await loadUsers()
    } catch (error) {
      console.error('Error promoting user:', error)
      alert('Failed to update user role')
    }
  }

  const getRoleEmoji = (role) => {
    const config = ROLE_CONFIG[role]
    return config ? config.emoji : '👤'
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'resigning':
        return 'bg-yellow-100 text-yellow-800'
      case 'disabled':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-xl text-gray-600">Loading users...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-600 mt-1">
            {users.length} total users • {filteredUsers.length} showing
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-gradient-to-r from-primary to-secondary text-white rounded-lg font-semibold text-sm flex items-center gap-2 hover:shadow-lg transition-all"
          >
            <UserPlus className="w-4 h-4" />
            Add User
          </button>
          <span className="px-4 py-2 bg-gradient-to-r from-primary to-secondary text-white rounded-lg font-semibold text-sm">
            ADMIN ONLY
          </span>
        </div>
      </div>

      <div className="card">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent appearance-none bg-white"
            >
              <option value="all">All Roles</option>
              <option value="admin">🛡️ Admin</option>
              <option value="director">👔 Director</option>
              <option value="manager">📋 Manager</option>
              <option value="supervisor">👁️ Supervisor</option>
              <option value="secretary">📝 Secretary</option>
              <option value="guard">💂 Guard</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card">
        {filteredUsers.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No users found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                    User
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                    Role
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                    Work Number
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                    Join Date
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                    Uniform
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-semibold">
                          {user.full_name?.charAt(0) || 'U'}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {user.full_name}
                          </p>
                          <p className="text-xs text-gray-500">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{getRoleEmoji(user.role)}</span>
                        <span className="text-sm font-medium text-gray-900 capitalize">
                          {user.role}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-gray-700">
                      {user.work_number}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(user.account_status)}`}>
                        {user.account_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {new Date(user.join_date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        user.uniform_status === 'pending' 
                          ? 'bg-yellow-100 text-yellow-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {['manager', 'director'].includes(user.role) ? 'N/A' : (user.uniform_status === 'na' ? 'N/A' : (user.uniform_status || 'N/A'))}
                      </span>
                    </td>
                     <td className="px-4 py-3">
                       <div className="flex items-center gap-2">
                         <button
                           onClick={() => handleEditUser(user)}
                           className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                           title="Edit User"
                         >
                           <Edit className="w-4 h-4 text-blue-600" />
                         </button>
                         <button
                           onClick={() => handleEmergencyContactClick(user)}
                           className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                           title="Manage Emergency Contact"
                         >
                           <Phone className="w-4 h-4 text-orange-600" />
                         </button>
                         <button
                           onClick={() => setSelectedUser(user)}
                           className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                           title="View Details"
                         >
                           <Eye className="w-4 h-4 text-gray-600" />
                         </button>
                         {user.role !== 'admin' && (
                           <button
                             onClick={() => handleDeleteUser(user.id)}
                             className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                             title="Delete User"
                           >
                             <Trash2 className="w-4 h-4 text-red-600" />
                           </button>
                         )}
                       </div>
                     </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showEditModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Edit User</h2>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  User
                </label>
                <p className="text-gray-900">{selectedUser.full_name}</p>
                <p className="text-sm text-gray-500">{selectedUser.email}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Role
                </label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="guard">💂 Guard</option>
                  <option value="secretary">📝 Secretary</option>
                  <option value="manager">📋 Manager</option>
                  <option value="supervisor">👁️ Supervisor</option>
                  <option value="director">👔 Director</option>
                  <option value="admin">🛡️ Admin</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Account Status
                </label>
                <select
                  value={editForm.account_status}
                  onChange={(e) => setEditForm({ ...editForm, account_status: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="active">Active</option>
                  <option value="resigning">Resigning</option>
                  <option value="disabled">Disabled</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleSaveUser}
                  className="flex-1 btn-gradient"
                >
                  Save Changes
                </button>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedUser && !showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">User Details</h2>
                <button
                  onClick={() => setSelectedUser(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Full Name</label>
                  <p className="text-gray-900">{selectedUser.full_name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Email</label>
                  <p className="text-gray-900">{selectedUser.email}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Role</label>
                  <p className="text-gray-900">
                    {getRoleEmoji(selectedUser.role)} {selectedUser.role}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Status</label>
                  <p className="text-gray-900 capitalize">{selectedUser.account_status}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Join Date</label>
                  <p className="text-gray-900">{new Date(selectedUser.join_date).toLocaleDateString()}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Uniform Status</label>
                  <p className="text-gray-900 capitalize">
                    {['manager', 'director'].includes(selectedUser.role) ? 'N/A' : (selectedUser.uniform_status === 'na' ? 'N/A' : (selectedUser.uniform_status || 'N/A'))}
                  </p>
                </div>
                {selectedUser.site_id && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Site ID</label>
                    <p className="text-gray-900">{selectedUser.site_id}</p>
                  </div>
                )}
                {selectedUser.resignation_date && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Resignation Date</label>
                    <p className="text-gray-900">{new Date(selectedUser.resignation_date).toLocaleDateString()}</p>
                  </div>
                )}
              </div>

                {selectedUser.compliance_risk && (
                  <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-800">
                      <strong>Compliance Risk:</strong> This user has been flagged for compliance issues.
                    </p>
                  </div>
                )}

                {/* Emergency Contact Section */}
                <div className="border-t border-gray-200 pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-900">Emergency Contact</h3>
                    <button
                      onClick={() => handleEmergencyContactClick(selectedUser)}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-colors"
                    >
                      <Phone className="w-4 h-4" />
                      {selectedUser.emergency_contact ? 'Update' : 'Add'} Contact
                    </button>
                  </div>
                  {selectedUser.emergency_contact ? (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-sm text-gray-900">
                        <strong>Name:</strong> {selectedUser.emergency_contact}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        <strong>Phone:</strong> {selectedUser.emergency_phone}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 italic">No emergency contact set</p>
                  )}
                </div>

                <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setSelectedUser(null)
                    handleEditUser(selectedUser)
                  }}
                  className="flex-1 btn-gradient flex items-center justify-center gap-2"
                >
                  <Edit className="w-4 h-4" />
                  Edit User
                </button>
                <button
                  onClick={() => setSelectedUser(null)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && userToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Delete User</h2>
              </div>
            </div>
            <div className="p-6">
              <p className="text-gray-600 mb-4">
                Are you sure you want to permanently delete this user? This action cannot be undone.
              </p>
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <p className="font-semibold text-gray-900">{userToDelete.full_name}</p>
                <p className="text-sm text-gray-500">{userToDelete.email}</p>
                <p className="text-sm text-gray-500">
                  Role: {getRoleEmoji(userToDelete.role)} {userToDelete.role}
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={confirmDeleteUser}
                  disabled={deleteLoading}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-semibold disabled:opacity-50"
                >
                  {deleteLoading ? 'Deleting...' : 'Delete User'}
                </button>
                <button
                  onClick={() => {
                    setShowDeleteModal(false)
                    setUserToDelete(null)
                  }}
                  disabled={deleteLoading}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEmergencyContactModal && selectedUserForEmergencyContact && (
        <EmergencyContactModal
          isOpen={showEmergencyContactModal}
          onClose={() => {
            setShowEmergencyContactModal(false)
            setSelectedUserForEmergencyContact(null)
          }}
          userId={selectedUserForEmergencyContact.id}
          userData={selectedUserForEmergencyContact}
          onSuccess={handleEmergencyContactSuccess}
        />
      )}

  {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Add New User</h2>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              {addError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {addError}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={addForm.full_name}
                  onChange={(e) => setAddForm({ ...addForm, full_name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  required
                  value={addForm.email}
                  onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="john@gmail.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Role *
                </label>
                <select
                  value={addForm.role}
                  onChange={(e) => setAddForm({ ...addForm, role: e.target.value, number: '' })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="director">Director</option>
                  <option value="manager">Manager</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="secretary">Secretary</option>
                  <option value="admin">Admin</option>
                  <option value="guard">Guard</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Work Number *
                </label>
                <div className="space-y-2">
                  <input
                    type="number"
                    required
                    min={ROLE_CONFIG[addForm.role]?.min || 1}
                    max={ROLE_CONFIG[addForm.role]?.max || 2000}
                    value={addForm.number}
                    onChange={(e) => setAddForm({ ...addForm, number: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder={addForm.role === 'guard' ? '501' : String(ROLE_CONFIG[addForm.role]?.min || 1)}
                  />
                  {addForm.role && addForm.number && (
                    <p className="text-xs text-gray-500">
                      Work Number: <span className="font-mono font-semibold">{getDisplayWorkNumber()}</span>
                    </p>
                  )}
                  {addForm.role && (
                    <p className="text-xs text-gray-500">
                      Valid range: {ROLE_CONFIG[addForm.role]?.min} - {ROLE_CONFIG[addForm.role]?.max}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  required
                  value={addForm.phone_number}
                  onChange={(e) => setAddForm({ ...addForm, phone_number: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="0712345678"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleAddUser}
                  disabled={addLoading}
                  className="flex-1 btn-gradient disabled:opacity-50"
                >
                  {addLoading ? 'Adding...' : 'Add User'}
                </button>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAddConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Confirm New User</h2>
              <p className="text-sm text-gray-500 mt-1">Review the details before creating this account.</p>
            </div>
            <div className="p-6 space-y-3">
              <div className="rounded-lg bg-gray-50 p-4 space-y-2 text-sm">
                <p><span className="font-semibold text-gray-700">Full name:</span> {addForm.full_name}</p>
                <p><span className="font-semibold text-gray-700">Email:</span> {addForm.email}</p>
                <p><span className="font-semibold text-gray-700">Role:</span> {ROLE_CONFIG[addForm.role]?.label}</p>
                <p><span className="font-semibold text-gray-700">Work number:</span> <span className="font-mono">{getDisplayWorkNumber()}</span></p>
                <p><span className="font-semibold text-gray-700">Phone:</span> {addForm.phone_number}</p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={confirmAddUser}
                  disabled={addLoading}
                  className="flex-1 btn-gradient disabled:opacity-50"
                >
                  {addLoading ? 'Adding...' : 'Add User'}
                </button>
                <button
                  onClick={() => setShowAddConfirmation(false)}
                  disabled={addLoading}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  Edit Details
                </button>
                <button
                  onClick={() => {
                    setShowAddConfirmation(false)
                    setShowAddModal(false)
                  }}
                  disabled={addLoading}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminUserManagement