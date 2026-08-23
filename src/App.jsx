import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth, ROLES } from './contexts/AuthContext'
import { NotificationProvider } from './contexts/NotificationContext'
import GlobalNotificationRenderer from './components/GlobalNotificationRenderer'
import Sidebar from './components/Sidebar'
import AdminRoute from './components/AdminRoute'
import AuthenticatedLayout from './components/AuthenticatedLayout'
import BackButton from './components/BackButton'
import LoginPage from './pages/LoginPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import LandingPage from './pages/LandingPage'
import { LayoutDashboard, Users, Home, User, Shield, ChevronDown, DollarSign, Shirt } from 'lucide-react'

import GuardDashboard from './pages/GuardDashboard'
import ClientIntakeForm from './pages/ClientIntakeForm'
import ProfilePage from './pages/ProfilePage'
import SetPasswordPage from './pages/SetPasswordPage'
import EmailVerificationPage from './pages/EmailVerificationPage'

import DirectorDashboard from './pages/director/DirectorDashboard'
import DirectorPolicies from './pages/director/DirectorPolicies'
import DirectorResources from './pages/director/DirectorResources'
import DirectorPayroll from './pages/director/DirectorPayroll'
import DirectorSites from './pages/director/DirectorSites'
import DirectorRequests from './pages/director/DirectorRequests'
import DirectorFinancialReports from './pages/director/DirectorFinancialReports'
import DirectorPortal from './components/DirectorPortal'
import DirectorUserManagement from './pages/director/DirectorUserManagement'

import ManagerDashboard from './pages/manager/ManagerDashboard'
import ManagerPayroll from './pages/manager/ManagerPayroll'
import ManagerSites from './pages/manager/ManagerSites'

import SupervisorDashboard from './pages/supervisor/SupervisorDashboard'
import SupervisorShifts from './pages/supervisor/SupervisorShifts'
import SupervisorNotices from './pages/supervisor/SupervisorNotices'
import SupervisorIncidents from './pages/supervisor/SupervisorIncidents'
import SupervisorUniformRequest from './pages/supervisor/SupervisorUniformRequest'
import SupervisorGuards from './pages/supervisor/SupervisorGuards'
import SupervisorSites from './pages/supervisor/SupervisorSites'
import SupervisorPayroll from './pages/supervisor/SupervisorPayroll'
import SupervisorAttendance from './pages/supervisor/SupervisorAttendance'

import AdminDashboard from './pages/admin/AdminDashboard'
import AdminAuditLog from './pages/admin/AdminAuditLog'
import AdminUsers from './pages/admin/AdminUserManagement'
import AdminSiteManagement from './pages/admin/SiteManagement'
import AdminLayout from './components/AdminLayout'

const AdminFinancial = () => <div className="p-8"><h1 className="text-3xl font-bold">Financial Overview</h1></div>
const AdminResignations = () => <div className="p-8"><h1 className="text-3xl font-bold">Resignations</h1></div>
const AdminCompliance = () => <div className="p-8"><h1 className="text-3xl font-bold">Compliance</h1></div>

import SiteDetails from './pages/admin/SiteDetails'
const ManagerSiteDetails = () => <SiteDetails />
const DirectorSiteDetails = () => <SiteDetails />

const FinanceDashboard = () => <div className="p-8"><h1 className="text-3xl font-bold">Payroll</h1></div>
const FinanceLedger = () => <div className="p-8"><h1 className="text-3xl font-bold">Financial Ledger</h1></div>

import SecretaryUniform from './pages/secretary/SecretaryUniform'
import SecretaryDashboard from './pages/secretary/SecretaryDashboard'
import SecretaryPayroll from './pages/secretary/SecretaryPayroll'
import SecretaryContracts from './pages/secretary/SecretaryContracts'
import SecretaryAttendance from './pages/secretary/SecretaryAttendance'
import SecretaryDocuments from './pages/secretary/SecretaryDocuments'
import SecretaryApplications from './pages/secretary/SecretaryApplications'
import SecretarySchedule from './pages/secretary/SecretarySchedule'
import { secretaryAPI } from './services/api'
const SecretaryReports = () => <div className="p-8"><h1 className="text-3xl font-bold">Reports</h1></div>
const SecretaryGuards = () => <div className="p-8"><h1 className="text-3xl font-bold">Guard Records</h1></div>

const GuardShifts = () => <div className="p-8"><h1 className="text-3xl font-bold">My Shifts</h1></div>
const GuardPayroll = () => <div className="p-8"><h1 className="text-3xl font-bold">My Payroll</h1></div>
const GuardResignation = () => <div className="p-8"><h1 className="text-3xl font-bold">Resignation</h1></div>

import GuardAttendance from './pages/guard/GuardAttendance'
import GuardIncidents from './pages/guard/GuardIncidents'
import GuardBriefings from './pages/guard/GuardBriefings'
const GuardContacts = () => <div className="p-8"><h1 className="text-3xl font-bold">Emergency Contacts</h1><p className="mt-4 text-gray-600">Quick access to emergency contacts.</p></div>
const GuardTraining = () => <div className="p-8"><h1 className="text-3xl font-bold">Training & Profile</h1><p className="mt-4 text-gray-600">View training records and profile.</p></div>

import ManagerActiveShifts from './pages/manager/ManagerActiveShifts'
import ManagerApplicants from './pages/manager/ManagerApplicants'
import ManagerAttendance from './pages/manager/ManagerAttendance'
import ManagerSiteInspections from './pages/manager/ManagerSiteInspections'
import ManagerDocuments from './pages/manager/ManagerDocuments'
import ManagerIncidents from './pages/manager/ManagerIncidents'
import ManagerUserManagement from './pages/manager/ManagerUserManagement'

import GuardUniformRequest from './pages/guard/GuardUniformRequest'
import GuardUniform from './pages/guard/GuardUniform'
import GuardSchedule from './pages/guard/GuardSchedule'

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#1a2a6c] border-t-transparent rounded-full animate-spin" />
          <div className="text-sm text-gray-400">Loading...</div>
        </div>
      </div>
    )
  }

  if (!profile) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles && profile.role !== ROLES.ADMIN && !allowedRoles.includes(profile.role)) {
    return <Navigate to="/" replace />
  }

  return children
}

const MobileBottomNav = () => {
  const { profile, logout } = useAuth()
  const location = useLocation()

  if (!profile) return null

  const getNavItems = () => {
    const items = []
    const role = profile.role

    items.push({ path: '/profile', label: 'Profile', icon: User })

    if (role === ROLES.ADMIN) {
      items.unshift({ path: '/admin', label: 'Admin', icon: Shield })
      items.unshift({ path: '/', label: 'Home', icon: Home })
    } else if (role === ROLES.DIRECTOR) {
      items.unshift({ path: '/director', label: 'Dashboard', icon: LayoutDashboard })
      items.unshift({ path: '/director/financial-reports', label: 'Financial Reports', icon: DollarSign })
    } else if (role === ROLES.MANAGER) {
      items.unshift({ path: '/manager', label: 'Dashboard', icon: LayoutDashboard })
    } else if (role === ROLES.SUPERVISOR) {
      items.unshift({ path: '/supervisor', label: 'Dashboard', icon: LayoutDashboard })
      items.unshift({ path: '/supervisor/uniform', label: 'Uniform', icon: Shirt })
      items.unshift({ path: '/supervisor/incidents', label: 'Incidents', icon: Shield })
    } else if (role === ROLES.SECRETARY) {
      items.unshift({ path: '/secretary', label: 'Dashboard', icon: LayoutDashboard })
    } else if (role === ROLES.GUARD) {
      items.unshift({ path: '/guard', label: 'Dashboard', icon: LayoutDashboard })
    }

    return items
  }

  const navItems = getNavItems()
  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/')

  return (
    <nav className="mobile-action-bar safe-area-bottom">
      {navItems.map((item) => {
        const Icon = item.icon
        const active = isActive(item.path)
        return (
          <Link
            key={item.path}
            to={item.path}
            className={`mobile-action-item ${active ? 'active' : ''}`}
          >
            <Icon size={20} className={active ? 'text-[#1a2a6c]' : 'text-gray-500'} />
            <span>{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}

const DashboardLayout = ({ children, showBackButton = true }) => {
  const { profile } = useAuth()
  
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 p-4 sm:p-6 lg:p-8 mobile-bottom-padding">
        {showBackButton && (
          <div className="mb-4">
            <BackButton fallback={profile?.role ? `/${profile.role}` : '/'} />
          </div>
        )}
        {children}
      </main>
      <MobileBottomNav />
    </div>
  )
}

const AdminLayoutWrapper = ({ children }) => {
  return (
    <div className="min-h-screen bg-gray-50">
      {children}
    </div>
  )
}

const ManagerLayout = ({ children }) => {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 p-4 sm:p-6 lg:p-8 mobile-bottom-padding">
        {children}
      </main>
      <MobileBottomNav />
    </div>
  )
}

const SecretaryLayout = ({ children, showBackButton = true }) => {
  const { profile } = useAuth()
  
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 p-4 sm:p-6 lg:p-8 mobile-bottom-padding">
        {showBackButton && (
          <div className="mb-4">
            <BackButton fallback={profile?.role ? `/${profile.role}` : '/'} />
          </div>
        )}
        {children}
      </main>
      <MobileBottomNav />
    </div>
  )
}

const GuardLayout = ({ children, showBackButton = true }) => {
  const { profile } = useAuth()
  
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 p-4 sm:p-6 lg:p-8 mobile-bottom-padding">
        {showBackButton && (
          <div className="mb-4">
            <BackButton fallback={profile?.role ? `/${profile.role}` : '/'} />
          </div>
        )}
        {children}
      </main>
      <MobileBottomNav />
    </div>
  )
}

const LandingLayout = ({ children }) => {
  return (
    <div className="flex min-h-screen">
      <Sidebar onNavClick={(id) => {
        if (window.__landingScrollTo) {
          window.__landingScrollTo(id)
        }
      }} />
      <main className="flex-1 mobile-bottom-padding">
        {children}
      </main>
    </div>
  )
}

const getDefaultRoute = (role) => {
  switch (role) {
    case ROLES.ADMIN: return '/admin'
    case ROLES.DIRECTOR: return '/director'
    case ROLES.MANAGER: return '/manager'
    case ROLES.SUPERVISOR: return '/supervisor'
    case ROLES.SECRETARY: return '/secretary'
    case ROLES.GUARD: return '/guard'
    default: return '/'
  }
}

const AppRoutes = () => {
  const { profile } = useAuth()

  return (
    <Routes>
      <Route path="/login" element={profile ? <Navigate to={getDefaultRoute(profile.role)} replace /> : <LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />

      <Route path="/admin" element={
        <AdminRoute>
          <AdminLayout><AdminDashboard /></AdminLayout>
        </AdminRoute>
      } />
      <Route path="/admin/users" element={
        <AdminRoute>
          <AdminLayout><AdminUsers /></AdminLayout>
        </AdminRoute>
      } />
      <Route path="/admin/sites" element={
        <AdminRoute>
          <AdminLayout><AdminSiteManagement /></AdminLayout>
        </AdminRoute>
      } />
      <Route path="/admin/sites/:id" element={
        <AdminRoute>
          <AdminLayout><SiteDetails /></AdminLayout>
        </AdminRoute>
      } />
      <Route path="/admin/financial" element={
        <AdminRoute>
          <AdminLayout><AdminFinancial /></AdminLayout>
        </AdminRoute>
      } />
      <Route path="/admin/audits" element={
        <AdminRoute>
          <AdminLayout><AdminAuditLog /></AdminLayout>
        </AdminRoute>
      } />
      <Route path="/admin/resignations" element={
        <AdminRoute>
          <AdminLayout><AdminResignations /></AdminLayout>
        </AdminRoute>
      } />
      <Route path="/admin/compliance" element={
        <AdminRoute>
          <AdminLayout><AdminCompliance /></AdminLayout>
        </AdminRoute>
      } />

      <Route path="/manager" element={
        <ProtectedRoute allowedRoles={[ROLES.MANAGER]}>
          <DashboardLayout><ManagerDashboard /></DashboardLayout>
        </ProtectedRoute>
      } />
      <Route path="/manager/shifts" element={
        <ProtectedRoute allowedRoles={[ROLES.MANAGER]}>
          <DashboardLayout><ManagerActiveShifts /></DashboardLayout>
        </ProtectedRoute>
      } />
      <Route path="/manager/incidents" element={
        <ProtectedRoute allowedRoles={[ROLES.MANAGER]}>
          <DashboardLayout><ManagerIncidents /></DashboardLayout>
        </ProtectedRoute>
      } />
      <Route path="/manager/attendance" element={
        <ProtectedRoute allowedRoles={[ROLES.MANAGER]}>
          <DashboardLayout><ManagerAttendance /></DashboardLayout>
        </ProtectedRoute>
      } />
      <Route path="/manager/inspections" element={
        <ProtectedRoute allowedRoles={[ROLES.MANAGER]}>
          <DashboardLayout><ManagerSiteInspections /></DashboardLayout>
        </ProtectedRoute>
      } />
      <Route path="/manager/sites" element={
        <ProtectedRoute allowedRoles={[ROLES.MANAGER]}>
          <DashboardLayout><ManagerSites /></DashboardLayout>
        </ProtectedRoute>
      } />
      <Route path="/manager/sites/:id" element={
        <ProtectedRoute allowedRoles={[ROLES.MANAGER]}>
          <DashboardLayout><ManagerSiteDetails /></DashboardLayout>
        </ProtectedRoute>
      } />
      <Route path="/manager/documents" element={
        <ProtectedRoute allowedRoles={[ROLES.MANAGER]}>
          <DashboardLayout><ManagerDocuments /></DashboardLayout>
        </ProtectedRoute>
      } />
      <Route path="/manager/applicants" element={
        <ProtectedRoute allowedRoles={[ROLES.MANAGER]}>
          <DashboardLayout><ManagerApplicants /></DashboardLayout>
        </ProtectedRoute>
      } />
      <Route path="/manager/payroll" element={
        <ProtectedRoute allowedRoles={[ROLES.MANAGER]}>
          <DashboardLayout><ManagerPayroll /></DashboardLayout>
        </ProtectedRoute>
      } />
      <Route path="/manager/users" element={
        <ProtectedRoute allowedRoles={[ROLES.MANAGER]}>
          <DashboardLayout><ManagerUserManagement /></DashboardLayout>
        </ProtectedRoute>
      } />

      <Route path="/director" element={
        <ProtectedRoute allowedRoles={[ROLES.DIRECTOR]}>
          <DashboardLayout><DirectorDashboard /></DashboardLayout>
        </ProtectedRoute>
      } />
      <Route path="/director/policies" element={
        <ProtectedRoute allowedRoles={[ROLES.DIRECTOR]}>
          <DashboardLayout><DirectorPolicies /></DashboardLayout>
        </ProtectedRoute>
      } />
      <Route path="/director/resources" element={
        <ProtectedRoute allowedRoles={[ROLES.DIRECTOR]}>
          <DashboardLayout><DirectorResources /></DashboardLayout>
        </ProtectedRoute>
      } />
      <Route path="/director/payroll" element={
        <ProtectedRoute allowedRoles={[ROLES.DIRECTOR]}>
          <DashboardLayout><DirectorPayroll /></DashboardLayout>
        </ProtectedRoute>
      } />
      <Route path="/director/sites" element={
        <ProtectedRoute allowedRoles={[ROLES.DIRECTOR]}>
          <DashboardLayout><DirectorSites /></DashboardLayout>
        </ProtectedRoute>
      } />
      <Route path="/director/sites/:id" element={
        <ProtectedRoute allowedRoles={[ROLES.DIRECTOR]}>
          <DashboardLayout><DirectorSiteDetails /></DashboardLayout>
        </ProtectedRoute>
      } />
       <Route path="/director/requests" element={
         <ProtectedRoute allowedRoles={[ROLES.DIRECTOR]}>
           <DashboardLayout><DirectorRequests /></DashboardLayout>
         </ProtectedRoute>
       } />
       <Route path="/director/financial-reports" element={
         <ProtectedRoute allowedRoles={[ROLES.DIRECTOR]}>
           <DashboardLayout><DirectorFinancialReports /></DashboardLayout>
         </ProtectedRoute>
       } />
       <Route path="/director/portal" element={
         <ProtectedRoute allowedRoles={[ROLES.DIRECTOR]}>
           <DashboardLayout><DirectorPortal /></DashboardLayout>
         </ProtectedRoute>
       } />
       <Route path="/director/users" element={
         <ProtectedRoute allowedRoles={[ROLES.DIRECTOR]}>
           <DashboardLayout><DirectorUserManagement /></DashboardLayout>
         </ProtectedRoute>
       } />

      <Route path="/supervisor" element={
        <ProtectedRoute allowedRoles={[ROLES.SUPERVISOR, ROLES.MANAGER]}>
          <DashboardLayout><SupervisorDashboard /></DashboardLayout>
        </ProtectedRoute>
      } />
      <Route path="/supervisor/shifts" element={
        <ProtectedRoute allowedRoles={[ROLES.SUPERVISOR, ROLES.MANAGER]}>
          <DashboardLayout><SupervisorShifts /></DashboardLayout>
        </ProtectedRoute>
      } />
      <Route path="/supervisor/attendance" element={
        <ProtectedRoute allowedRoles={[ROLES.SUPERVISOR]}>
          <DashboardLayout><SupervisorAttendance /></DashboardLayout>
        </ProtectedRoute>
      } />
      <Route path="/supervisor/notices" element={
        <ProtectedRoute allowedRoles={[ROLES.SUPERVISOR, ROLES.MANAGER]}>
          <DashboardLayout><SupervisorNotices /></DashboardLayout>
        </ProtectedRoute>
      } />
      <Route path="/supervisor/incidents" element={
        <ProtectedRoute allowedRoles={[ROLES.SUPERVISOR, ROLES.MANAGER]}>
          <DashboardLayout><SupervisorIncidents /></DashboardLayout>
        </ProtectedRoute>
      } />
      <Route path="/supervisor/uniform" element={
        <ProtectedRoute allowedRoles={[ROLES.SUPERVISOR]}>
          <DashboardLayout><SupervisorUniformRequest /></DashboardLayout>
        </ProtectedRoute>
      } />
      <Route path="/supervisor/guards" element={
        <ProtectedRoute allowedRoles={[ROLES.SUPERVISOR, ROLES.MANAGER]}>
          <DashboardLayout><SupervisorGuards /></DashboardLayout>
        </ProtectedRoute>
      } />
      <Route path="/supervisor/sites" element={
        <ProtectedRoute allowedRoles={[ROLES.SUPERVISOR, ROLES.MANAGER]}>
          <DashboardLayout><SupervisorSites /></DashboardLayout>
        </ProtectedRoute>
      } />
      <Route path="/supervisor/payroll" element={
        <ProtectedRoute allowedRoles={[ROLES.SUPERVISOR, ROLES.MANAGER]}>
          <DashboardLayout><SupervisorPayroll /></DashboardLayout>
        </ProtectedRoute>
      } />

      <Route path="/request-service" element={<ClientIntakeForm />} />

      <Route path="/finance" element={
        <ProtectedRoute allowedRoles={[ROLES.DIRECTOR, ROLES.SUPERVISOR, ROLES.SECRETARY]}>
          <DashboardLayout><FinanceDashboard /></DashboardLayout>
        </ProtectedRoute>
      } />
      <Route path="/finance/ledger" element={
        <ProtectedRoute allowedRoles={[ROLES.DIRECTOR, ROLES.SUPERVISOR, ROLES.SECRETARY]}>
          <DashboardLayout><FinanceLedger /></DashboardLayout>
        </ProtectedRoute>
      } />

      <Route path="/secretary" element={
        <ProtectedRoute allowedRoles={[ROLES.SECRETARY]}>
          <SecretaryLayout><SecretaryDashboard /></SecretaryLayout>
        </ProtectedRoute>
      } />
      <Route path="/secretary/reports" element={
        <ProtectedRoute allowedRoles={[ROLES.SECRETARY]}>
          <SecretaryLayout><SecretaryReports /></SecretaryLayout>
        </ProtectedRoute>
      } />
      <Route path="/secretary/guards" element={
        <ProtectedRoute allowedRoles={[ROLES.SECRETARY]}>
          <SecretaryLayout><SecretaryGuards /></SecretaryLayout>
        </ProtectedRoute>
      } />
      <Route path="/secretary/uniform" element={
        <ProtectedRoute allowedRoles={[ROLES.SECRETARY]}>
          <SecretaryLayout><SecretaryUniform /></SecretaryLayout>
        </ProtectedRoute>
      } />
      <Route path="/secretary/payroll" element={
        <ProtectedRoute allowedRoles={[ROLES.SECRETARY]}>
          <SecretaryLayout><SecretaryPayroll /></SecretaryLayout>
        </ProtectedRoute>
      } />
      <Route path="/secretary/contracts" element={
        <ProtectedRoute allowedRoles={[ROLES.SECRETARY]}>
          <SecretaryLayout><SecretaryContracts /></SecretaryLayout>
        </ProtectedRoute>
      } />
      <Route path="/secretary/attendance" element={
        <ProtectedRoute allowedRoles={[ROLES.SECRETARY]}>
          <SecretaryLayout><SecretaryAttendance /></SecretaryLayout>
        </ProtectedRoute>
      } />
      <Route path="/secretary/documents" element={
        <ProtectedRoute allowedRoles={[ROLES.SECRETARY]}>
          <SecretaryLayout><SecretaryDocuments /></SecretaryLayout>
        </ProtectedRoute>
      } />
      <Route path="/secretary/applications" element={
        <ProtectedRoute allowedRoles={[ROLES.SECRETARY]}>
          <SecretaryLayout><SecretaryApplications /></SecretaryLayout>
        </ProtectedRoute>
      } />
      <Route path="/secretary/schedule" element={
        <ProtectedRoute allowedRoles={[ROLES.SECRETARY]}>
          <SecretaryLayout><SecretarySchedule api={secretaryAPI} /></SecretaryLayout>
        </ProtectedRoute>
      } />

      <Route path="/guard" element={
        <ProtectedRoute allowedRoles={[ROLES.GUARD]}>
          <GuardLayout><GuardDashboard /></GuardLayout>
        </ProtectedRoute>
      } />
      <Route path="/guard/shifts" element={
        <ProtectedRoute allowedRoles={[ROLES.GUARD]}>
          <GuardLayout><GuardShifts /></GuardLayout>
        </ProtectedRoute>
      } />
      <Route path="/guard/payroll" element={
        <ProtectedRoute allowedRoles={[ROLES.GUARD]}>
          <GuardLayout><GuardPayroll /></GuardLayout>
        </ProtectedRoute>
      } />
      <Route path="/guard/resignation" element={
        <ProtectedRoute allowedRoles={[ROLES.GUARD]}>
          <GuardLayout><GuardResignation /></GuardLayout>
        </ProtectedRoute>
      } />
      <Route path="/guard/attendance" element={
        <ProtectedRoute allowedRoles={[ROLES.GUARD]}>
          <GuardLayout><GuardAttendance /></GuardLayout>
        </ProtectedRoute>
      } />
      <Route path="/guard/incidents" element={
        <ProtectedRoute allowedRoles={[ROLES.GUARD]}>
          <GuardLayout><GuardIncidents /></GuardLayout>
        </ProtectedRoute>
      } />
      <Route path="/guard/briefings" element={
        <ProtectedRoute allowedRoles={[ROLES.GUARD]}>
          <GuardLayout><GuardBriefings /></GuardLayout>
        </ProtectedRoute>
      } />
      <Route path="/guard/schedule" element={
        <ProtectedRoute allowedRoles={[ROLES.GUARD]}>
          <GuardLayout><GuardSchedule /></GuardLayout>
        </ProtectedRoute>
      } />
      <Route path="/guard/contacts" element={
        <ProtectedRoute allowedRoles={[ROLES.GUARD]}>
          <GuardLayout><GuardContacts /></GuardLayout>
        </ProtectedRoute>
      } />
      <Route path="/guard/training" element={
        <ProtectedRoute allowedRoles={[ROLES.GUARD]}>
          <GuardLayout><GuardTraining /></GuardLayout>
        </ProtectedRoute>
      } />
      <Route path="/guard/uniform" element={
        <ProtectedRoute allowedRoles={[ROLES.GUARD]}>
          <GuardLayout><GuardUniform /></GuardLayout>
        </ProtectedRoute>
      } />

      <Route path="/profile" element={
        <ProtectedRoute>
          <DashboardLayout><ProfilePage /></DashboardLayout>
        </ProtectedRoute>
      } />

      <Route path="/set-password" element={<SetPasswordPage />} />
      <Route path="/verify-email" element={<EmailVerificationPage />} />
      <Route path="/" element={<LandingLayout><LandingPage /></LandingLayout>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <NotificationProvider>
          <AppRoutes />
          <GlobalNotificationRenderer />
        </NotificationProvider>
      </AuthProvider>
    </Router>
  )
}

export default App