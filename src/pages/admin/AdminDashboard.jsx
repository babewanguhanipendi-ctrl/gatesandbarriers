import { Link } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  DollarSign,
  FileText,
  Landmark,
  MapPin,
  Package,
  Shield,
  UserRound,
  Users
} from 'lucide-react'

const getStaffTabIcon = (label) => {
  if (label === 'Dashboard') return Activity
  if (label.includes('Payroll') || label.includes('Financial')) return DollarSign
  if (label.includes('Attendance')) return ClipboardCheck
  if (label.includes('Shift')) return Clock3
  if (label.includes('Incident')) return AlertTriangle
  if (label.includes('Site') || label.includes('Roster')) return MapPin
  if (label.includes('Document') || label.includes('Report')) return FileText
  if (label.includes('Schedule')) return CalendarDays
  if (label.includes('Policy')) return ClipboardList
  if (label.includes('Resource')) return Package
  if (label.includes('Contract')) return Landmark
  if (label.includes('Notice')) return Bell
  if (label.includes('Uniform')) return Shield
  if (label.includes('Applicant') || label.includes('User') || label.includes('Guard')) return Users
  if (label.includes('Contact') || label.includes('Profile')) return UserRound
  if (label.includes('Briefing') || label.includes('Training')) return BarChart3
  return FileText
}

const AdminDashboard = () => {
  const adminModules = [
    {
      title: 'User Management',
      emoji: '👥',
      path: '/admin/users',
      color: 'bg-blue-500'
    },
    {
      title: 'Site Management',
      emoji: '🏢',
      path: '/admin/sites',
      color: 'bg-purple-500'
    },
    {
      title: 'Financial',
      emoji: '💰',
      path: '/admin/financial',
      color: 'bg-green-500'
    },
    {
      title: 'Audit Logs',
      emoji: '📋',
      path: '/admin/audits',
      color: 'bg-orange-500'
    },
    {
      title: 'Resignations',
      emoji: '📄',
      path: '/admin/resignations',
      color: 'bg-yellow-500'
    },
    {
      title: 'Compliance',
      emoji: '✅',
      path: '/admin/compliance',
      color: 'bg-teal-500'
    }
  ]

  const staffPortals = [
    {
      role: 'Manager',
      color: 'bg-blue-500',
      tabs: [
        ['Dashboard', '/manager'], ['Active Shifts', '/manager/shifts'], ['Incidents', '/manager/incidents'],
        ['Attendance', '/manager/attendance'], ['Inspections', '/manager/inspections'], ['Sites', '/manager/sites'],
        ['Documents', '/manager/documents'], ['Applicants', '/manager/applicants'], ['Payroll', '/manager/payroll'],
        ['Guard Management', '/manager/users']
      ]
    },
    {
      role: 'Director',
      color: 'bg-purple-500',
      tabs: [
        ['Dashboard', '/director'], ['Financial Reports', '/director/financial-reports'], ['Policies', '/director/policies'],
        ['Resources', '/director/resources'], ['Sites', '/director/sites'], ['Payroll', '/director/payroll'],
        ['Contract Approvals', '/director/requests'], ['Company Schedules', '/director/portal'], ['User Management', '/director/users']
      ]
    },
    {
      role: 'Secretary',
      color: 'bg-amber-500',
      tabs: [
        ['Dashboard', '/secretary'], ['Reports', '/secretary/reports'], ['Guard Records', '/secretary/guards'],
        ['Uniform Management', '/secretary/uniform'], ['Payroll', '/secretary/payroll'], ['Client Contracts', '/secretary/contracts'],
        ['Attendance & Records', '/secretary/attendance'], ['Document Inbox', '/secretary/documents'],
        ['Applications', '/secretary/applications'], ['Company Schedule', '/secretary/schedule']
      ]
    },
    {
      role: 'Supervisor',
      color: 'bg-cyan-500',
      tabs: [
        ['Dashboard', '/supervisor'], ['Managed Sites', '/supervisor/sites'], ['Guard Roster', '/supervisor/guards'],
        ['Active Shifts', '/supervisor/shifts'], ['Attendance', '/supervisor/attendance'], ['Incidents', '/supervisor/incidents'],
        ['Notices', '/supervisor/notices'], ['Uniform Requests', '/supervisor/uniform'], ['Payroll', '/supervisor/payroll']
      ]
    },
    {
      role: 'Guard',
      color: 'bg-emerald-500',
      tabs: [
        ['Dashboard', '/guard'], ['Attendance', '/guard/attendance'], ['My Shifts', '/guard/shifts'],
        ['My Payroll', '/guard/payroll'], ['Incidents', '/guard/incidents'], ['Briefings', '/guard/briefings'],
        ['Schedule', '/guard/schedule'], ['Emergency Contacts', '/guard/contacts'], ['Training & Profile', '/guard/training'],
        ['Uniform', '/guard/uniform'], ['Resignation', '/guard/resignation']
      ]
    }
  ]

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Dashboard</h1>
        <p className="text-gray-600">System oversight & management controls</p>
      </div>

      {/* Admin Modules - Compact Icon Buttons */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Management Controls</h2>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
          {adminModules.map((module) => (
            <Link
              key={module.path}
              to={module.path}
              className="group flex flex-col items-center justify-center p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-200 hover:-translate-y-1"
            >
              <div className={`w-14 h-14 flex items-center justify-center rounded-full ${module.color} text-white text-2xl mb-2 group-hover:scale-110 transition-transform duration-200`}>
                {module.emoji}
              </div>
              <span className="text-xs font-semibold text-gray-700 text-center">
                {module.title}
              </span>
            </Link>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Staff Portal Tabs</h2>
        <div className="space-y-6">
          {staffPortals.map((portal) => (
            <section key={portal.role}>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">{portal.role} Portal</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {portal.tabs.map(([label, path]) => {
                  const Icon = getStaffTabIcon(label)
                  return (
                  <Link
                    key={path}
                    to={path}
                    className="group flex min-h-24 flex-col items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white p-3 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
                  >
                    <span className={`flex h-10 w-10 items-center justify-center rounded-full ${portal.color} text-white`}>
                      <Icon size={19} aria-hidden="true" />
                    </span>
                    <span className="text-xs font-semibold text-gray-700">{label}</span>
                  </Link>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}

export default AdminDashboard