const configuredApiBaseUrl = (process.env.REACT_APP_API_URL || '').trim().replace(/\/$/, '');
const isProduction = process.env.NODE_ENV === 'production';

export const apiUrl = (endpoint) => {
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  if (configuredApiBaseUrl) {
    return `${configuredApiBaseUrl}${path}`;
  }

  // The local frontend runs separately from the API on port 3001.
  // Keep production deployments served by the API on relative URLs.
  const frontendPort = typeof window !== 'undefined' ? window.location.port : '';
  const isLocalFrontend = ['3000', '5173'].includes(frontendPort);
  if (isProduction && !isLocalFrontend) {
    return path;
  }

  const frontendHost = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  return `http://${frontendHost}:3001${path}`;
};

const getToken = () => {
  return localStorage.getItem('token');
};

export const setToken = (token) => {
  localStorage.setItem('token', token);
};

export const removeToken = () => {
  localStorage.removeItem('token');
};

const fetchWithAuth = async (endpoint, options = {}) => {
  const token = getToken();
  
  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  };

  const url = apiUrl(endpoint);
  console.log(`API Request: ${options.method || 'GET'} ${url}`);

  try {
    const response = await fetch(url, config);
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      if (response.status === 401) {
        removeToken();
        throw new Error('Your session has expired. Please sign in again before continuing.');
      }
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      console.error(`Network error connecting to ${url}. Is the API server running and reachable?`);
      throw new Error('Unable to connect to server. Make sure the backend is running and the API URL is correct.');
    }
    console.error(`API Error (${endpoint}):`, error);
    throw error;
  }
};

export const authAPI = {
  login: async (workNumber, password) => {
    const data = await fetchWithAuth('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ work_number: workNumber, password }),
    });
    if (data.token) {
      setToken(data.token);
    }
    return data;
  },

  bootstrap: (userData) => {
    return fetchWithAuth('/api/auth/bootstrap', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  },

  register: (userData) => {
    return fetchWithAuth('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  },

  forgotPassword: (data) => {
    return fetchWithAuth('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  resetPassword: (data) => {
    return fetchWithAuth('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  verifyPasswordReset: (token) => {
    return fetchWithAuth('/api/auth/verify-password-reset', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  },

  verifyEmail: (token) => {
    return fetchWithAuth('/api/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  },

  logout: () => {
    removeToken();
  },

  getProfile: () => {
    return fetchWithAuth('/api/auth/me');
  },

  updateProfile: (data) => {
    return fetchWithAuth('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  setPassword: (data) => {
    return fetchWithAuth('/api/auth/set-password', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  changePassword: (currentPassword, newPassword) => {
    return fetchWithAuth('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    });
  },

  refreshToken: () => {
    return fetchWithAuth('/api/auth/refresh', {
      method: 'POST',
    });
  },
};

export const usersAPI = {
  getAll: (filters = {}) => {
    const params = new URLSearchParams(filters);
    return fetchWithAuth(`/api/users?${params}`);
  },

  getById: (id) => {
    return fetchWithAuth(`/api/users/${id}`);
  },

  create: (data) => {
    return fetchWithAuth('/api/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update: (id, data) => {
    return fetchWithAuth(`/api/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  updateRate: (id, daily_rate) => {
    return fetchWithAuth(`/api/users/${id}/rate`, {
      method: 'PATCH',
      body: JSON.stringify({ daily_rate }),
    });
  },

  delete: (id) => {
    return fetchWithAuth(`/api/users/${id}`, {
      method: 'DELETE',
    });
  },

  updateRole: (id, role) => {
    return fetchWithAuth(`/api/users/${id}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
  },

  getEmergencyContacts: (id) => {
    return fetchWithAuth(`/api/users/${id}/emergency-contacts`);
  },

  updateEmergencyContacts: (id, data) => {
    return fetchWithAuth(`/api/users/${id}/emergency-contacts`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  getGuards: (filters = {}) => {
    const params = new URLSearchParams(filters);
    return fetchWithAuth(`/api/users/guards?${params}`);
  },
};

export const sitesAPI = {
  getAll: (filters = {}) => {
    const params = new URLSearchParams(filters);
    return fetchWithAuth(`/api/sites?${params}`);
  },

  getById: (id) => {
    return fetchWithAuth(`/api/sites/${id}`);
  },

  create: (data) => {
    return fetchWithAuth('/api/sites', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update: (id, data) => {
    return fetchWithAuth(`/api/sites/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  delete: (id) => {
    return fetchWithAuth(`/api/sites/${id}`, {
      method: 'DELETE',
    });
  },
};

export const shiftsAPI = {
  getAll: (filters = {}) => {
    const params = new URLSearchParams(filters);
    return fetchWithAuth(`/api/shifts?${params}`);
  },

  getById: (id) => {
    return fetchWithAuth(`/api/shifts/${id}`);
  },

  create: (data) => {
    return fetchWithAuth('/api/shifts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update: (id, data) => {
    return fetchWithAuth(`/api/shifts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  delete: (id) => {
    return fetchWithAuth(`/api/shifts/${id}`, {
      method: 'DELETE',
    });
  },

  clockIn: (data) => {
    return fetchWithAuth('/api/shifts/clock-in', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  clockOut: (data = {}) => {
    return fetchWithAuth('/api/shifts/clock-out', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  allocateOvertime: (data) => {
    return fetchWithAuth('/api/shifts/overtime', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getMyAssignedSite: () => {
    return fetchWithAuth('/api/shifts/my-assigned-site');
  },

  getMySchedule: (weekOffset = 0) => {
    return fetchWithAuth(`/api/shifts/my-schedule?week_offset=${weekOffset}`);
  },

  getCurrentShift: () => {
    return fetchWithAuth('/api/shifts/current');
  },

  getNextMilestone: () => {
    return fetchWithAuth('/api/shifts/next-milestone');
  },

  getNextGuard: (siteId, date) => {
    const params = new URLSearchParams({ site_id: siteId, date });
    return fetchWithAuth(`/api/shifts/next-guard?${params}`);
  },

  submitHandover: (shiftId, notes, nextGuardId) => {
    return fetchWithAuth('/api/shifts/handover', {
      method: 'POST',
      body: JSON.stringify({ shift_id: shiftId, notes, next_guard_id: nextGuardId }),
    });
  },

  respondToShift: (id, response, note = '') => {
    return fetchWithAuth(`/api/shifts/${id}/respond`, {
      method: 'POST',
      body: JSON.stringify({ response, note }),
    });
  },

  supervisorClockIn: (data) => {
    return fetchWithAuth('/api/shifts/supervisor-clock-in', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  reverseLateFine: (id, reason = '') => {
    return fetchWithAuth(`/api/shifts/${id}/reverse-late-fine`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },
};

export const financialAPI = {
  getAll: (filters = {}) => {
    const params = new URLSearchParams(filters);
    return fetchWithAuth(`/api/financial?${params}`);
  },

  getById: (id) => {
    return fetchWithAuth(`/api/financial/${id}`);
  },

  create: (data) => {
    return fetchWithAuth('/api/financial', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update: (id, data) => {
    return fetchWithAuth(`/api/financial/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  delete: (id) => {
    return fetchWithAuth(`/api/financial/${id}`, {
      method: 'DELETE',
    });
  },
};

export const auditsAPI = {
  getAll: (filters = {}) => {
    const params = new URLSearchParams(filters);
    return fetchWithAuth(`/api/audits?${params}`);
  },

  getById: (id) => {
    return fetchWithAuth(`/api/audits/${id}`);
  },

  create: (data) => {
    return fetchWithAuth('/api/audits', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  approve: (id, data) => {
    return fetchWithAuth(`/api/audits/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  reject: (id, reason) => {
    return fetchWithAuth(`/api/audits/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  delete: (id) => {
    return fetchWithAuth(`/api/audits/${id}`, {
      method: 'DELETE',
    });
  },
};

export const notificationsAPI = {
  getAll: (filters = {}) => {
    const params = new URLSearchParams(filters);
    return fetchWithAuth(`/api/notifications?${params}`);
  },

  getUnreadCount: () => {
    return fetchWithAuth('/api/notifications/unread-count');
  },

  markAsRead: (id) => {
    return fetchWithAuth(`/api/notifications/${id}/read`, {
      method: 'PATCH',
    });
  },

  markAllAsRead: () => {
    return fetchWithAuth('/api/notifications/read-all', {
      method: 'PATCH',
    });
  },

  create: (data) => {
    return fetchWithAuth('/api/notifications', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  delete: (id) => {
    return fetchWithAuth(`/api/notifications/${id}`, {
      method: 'DELETE',
    });
  },
};

export const dashboardAPI = {
  getAdminStats: () => {
    return fetchWithAuth('/api/dashboard/admin');
  },

  getManagementStats: () => {
    return fetchWithAuth('/api/dashboard/management');
  },

  getGuardStats: () => {
    return fetchWithAuth('/api/dashboard/guard');
  },

  processExpiredResignations: () => {
    return fetchWithAuth('/api/dashboard/process-resignations', {
      method: 'POST',
    });
  },
};

export const requestsAPI = {
  create: (data) => {
    return fetchWithAuth('/api/requests', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getAll: (filters = {}) => {
    const params = new URLSearchParams(filters);
    return fetchWithAuth(`/api/requests?${params}`);
  },

  getById: (id) => {
    return fetchWithAuth(`/api/requests/${id}`);
  },

  update: (id, data) => {
    return fetchWithAuth(`/api/requests/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  delete: (id) => {
    return fetchWithAuth(`/api/requests/${id}`, {
      method: 'DELETE',
    });
  },

  reply: (id, data) => {
    return fetchWithAuth(`/api/requests/${id}/reply`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  forward: (id, assignedRole) => {
    return fetchWithAuth(`/api/requests/${id}/forward`, {
      method: 'POST',
      body: JSON.stringify({ assigned_role: assignedRole }),
    });
  },
};

export const applicationsAPI = {
  create: (data) => {
    return fetchWithAuth('/api/applications', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getAll: (filters = {}) => {
    const params = new URLSearchParams(filters);
    return fetchWithAuth(`/api/applications?${params}`);
  },

  update: (id, data) => {
    return fetchWithAuth(`/api/applications/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  forward: (id, assignedRole) => {
    return fetchWithAuth(`/api/applications/${id}/forward`, {
      method: 'POST',
      body: JSON.stringify({ assigned_role: assignedRole }),
    });
  },

  reply: (id, data) => {
    return fetchWithAuth(`/api/applications/${id}/reply`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

export const businessLogicAPI = {
  calculateMonthlyPay: (guardId, month) => {
    return fetchWithAuth(`/api/business/payroll?guard_id=${guardId}&month=${month}`);
  },

  checkAWOLStatus: () => {
    return fetchWithAuth('/api/business/awol');
  },

  initiateResignation: (data) => {
    return fetchWithAuth('/api/business/resignation', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getResignationCountdown: () => {
    return fetchWithAuth('/api/business/resignation-countdown');
  },
};

// Wage settings (fixed shift wage baselines - editable via manager/admin portal)
export const settingsAPI = {
  getWageRates: () => {
    return fetchWithAuth('/api/manager/settings/wages');
  },

  updateWageRates: ({ guardShiftRate, supervisorShiftRate }) => {
    const payload = {};
    if (guardShiftRate !== undefined) payload.guardShiftRate = guardShiftRate;
    if (supervisorShiftRate !== undefined) payload.supervisorShiftRate = supervisorShiftRate;
    return fetchWithAuth('/api/manager/settings/wages', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },
};

export const directorAPI = {
  getDashboard: () => {
    return fetchWithAuth('/api/director/dashboard');
  },

  getAnalytics: (period = 'month') => {
    return fetchWithAuth(`/api/director/analytics?period=${period}`);
  },

  getPolicies: () => {
    return fetchWithAuth('/api/director/policies');
  },

  createPolicy: (policyData) => {
    return fetchWithAuth('/api/director/policies', {
      method: 'POST',
      body: JSON.stringify(policyData),
    });
  },

  updatePolicy: (id, policyData) => {
    return fetchWithAuth(`/api/director/policies/${id}`, {
      method: 'PUT',
      body: JSON.stringify(policyData),
    });
  },

  getResources: () => {
    return fetchWithAuth('/api/director/resources');
  },

  // Contracts
  getContracts: (filters = {}) => {
    const params = new URLSearchParams(filters);
    return fetchWithAuth(`/api/director/contracts?${params}`);
  },

  approveContract: (id, action, notes = '') => {
    return fetchWithAuth(`/api/director/contracts/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ action, notes }),
    });
  },

  // Payroll
  getPayrollSummaries: (filters = {}) => {
    const params = new URLSearchParams(filters);
    return fetchWithAuth(`/api/director/payroll?${params}`);
  },

  signOffPayroll: (id, data) => {
    return fetchWithAuth(`/api/director/payroll/${id}/sign-off`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Treasury Disbursements
  getTreasuryDisbursements: (filters = {}) => {
    const params = new URLSearchParams(filters);
    return fetchWithAuth(`/api/director/treasury?${params}`);
  },

  authorizeDisbursement: (id, data) => {
    return fetchWithAuth(`/api/director/treasury/${id}/disburse`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Legacy alias
  getDisbursements: (filters = {}) => {
    const params = new URLSearchParams(filters);
    return fetchWithAuth(`/api/director/treasury?${params}`);
  },

  // Financial Reports
  getFinancialReports: (filters = {}) => {
    const params = new URLSearchParams(filters);
    return fetchWithAuth(`/api/director/financial-reports?${params}`);
  },

  generateFinancialReport: (reportData) => {
    return fetchWithAuth('/api/director/financial-reports/generate', {
      method: 'POST',
      body: JSON.stringify(reportData),
    });
  },

  // Company Schedules
  getSchedules: (filters = {}) => {
    const params = new URLSearchParams(filters);
    return fetchWithAuth(`/api/director/schedules?${params}`);
  },

  createSchedule: (scheduleData) => {
    return fetchWithAuth('/api/director/schedules', {
      method: 'POST',
      body: JSON.stringify(scheduleData),
    });
  },

  updateSchedule: (id, scheduleData) => {
    return fetchWithAuth(`/api/director/schedules/${id}`, {
      method: 'PUT',
      body: JSON.stringify(scheduleData),
    });
  },

  deleteSchedule: (id) => {
    return fetchWithAuth(`/api/director/schedules/${id}`, {
      method: 'DELETE',
    });
  },
};

export const managerAPI = {
  getDashboard: () => {
    return fetchWithAuth('/api/manager/dashboard');
  },

  getActiveShifts: () => {
    return fetchWithAuth('/api/manager/shifts');
  },

  createAllocation: (data) => {
    return fetchWithAuth('/api/supervisor/allocations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getAttendance: () => {
    return fetchWithAuth('/api/manager/attendance');
  },

  getSupervisorAllocations: () => {
    return fetchWithAuth('/api/supervisor/allocations');
  },

  clockInSupervisor: (data) => {
    return fetchWithAuth('/api/manager/supervisors/clock-in', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getAttendancePersonDetails: (personId) => {
    return fetchWithAuth(`/api/manager/attendance/${personId}/details`);
  },

  getLiveBoard: () => {
    return fetchWithAuth('/api/manager/attendance/live-board');
  },

  getExceptions: (status = 'open', limit = 50) => {
    const params = new URLSearchParams({ status, limit });
    return fetchWithAuth(`/api/manager/attendance/exceptions?${params}`);
  },

  resolveException: (id, data) => {
    return fetchWithAuth(`/api/manager/attendance/exceptions/${id}/resolve`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  getCompliance: (week_start = '') => {
    const params = new URLSearchParams();
    if (week_start) params.append('week_start', week_start);
    const query = params.toString();
    return fetchWithAuth(`/api/manager/attendance/compliance${query ? `?${query}` : ''}`);
  },

  getAttendanceAuditLogs: (limit = 50) => {
    return fetchWithAuth(`/api/manager/attendance/audit-logs?limit=${limit}`);
  },

  getAttendanceSummary: (period = 'daily', date = '') => {
    const params = new URLSearchParams({ period });
    if (date) params.append('date', date);
    return fetchWithAuth(`/api/manager/attendance/summary?${params}`);
  },

  exportPayrollAttendance: (start_date, end_date) => {
    const params = new URLSearchParams({ start_date, end_date });
    return fetchWithAuth(`/api/manager/attendance/export-payroll?${params}`);
  },

  getSiteInspections: () => {
    return fetchWithAuth('/api/manager/inspections');
  },

  getDocuments: () => {
    return fetchWithAuth('/api/manager/documents');
  },

  createAccountRequest: (data) => {
    return fetchWithAuth('/api/manager/account-request', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  createUniformRequest: (data) => {
    return fetchWithAuth('/api/manager/uniform-request', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  createShift: (data) => {
    return fetchWithAuth('/api/manager/shifts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getIncidents: () => {
    return fetchWithAuth('/api/manager/incidents');
  },

  reportIncident: (incidentData) => {
    return fetchWithAuth('/api/manager/incidents', {
      method: 'POST',
      body: JSON.stringify(incidentData),
    });
  },

  updateIncident: (id, data) => {
    return fetchWithAuth(`/api/manager/incidents/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  getStaff: () => {
    return fetchWithAuth('/api/manager/staff');
  },

  generateReport: (reportData) => {
    return fetchWithAuth('/api/manager/reports', {
      method: 'POST',
      body: JSON.stringify(reportData),
    });
  },
};

export const uniformRequestsAPI = {
  create: (data) => {
    return fetchWithAuth('/api/uniform-requests', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getMyRequests: () => {
    return fetchWithAuth('/api/uniform-requests/my');
  },

  getAll: (filters = {}) => {
    const params = new URLSearchParams(filters);
    return fetchWithAuth(`/api/uniform-requests?${params}`);
  },

  updateStatus: (id, data) => {
    return fetchWithAuth(`/api/uniform-requests/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  confirmReceipt: (id, received, follow_up = false) => {
    return fetchWithAuth(`/api/uniform-requests/${id}/confirm-receipt`, {
      method: 'PATCH',
      body: JSON.stringify({ received, follow_up }),
    });
  },

  updateDeliveryStatus: (id, delivery_status) => {
    return fetchWithAuth(`/api/uniform-requests/${id}/delivery-status`, {
      method: 'PATCH',
      body: JSON.stringify({ delivery_status }),
    });
  },

  getDeliveryAssignments: () => {
    return fetchWithAuth('/api/uniform-requests/delivery-assignments');
  },
};

export const secretaryAPI = {
  getDashboard: () => {
    return fetchWithAuth('/api/secretary/dashboard');
  },

  getUniformRequests: () => {
    return fetchWithAuth('/api/secretary/uniform-requests');
  },

  updateUniformRequest: (id, data) => {
    return fetchWithAuth(`/api/secretary/uniform-requests/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  createUniformRequest: (data) => {
    return fetchWithAuth('/api/secretary/uniform-requests', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getContracts: () => {
    return fetchWithAuth('/api/secretary/contracts');
  },

  sendContractEmail: (id, data) => {
    return fetchWithAuth(`/api/secretary/contracts/${id}/send-email`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Company Schedules
  getSchedules: (filters = {}) => {
    const params = new URLSearchParams(filters);
    return fetchWithAuth(`/api/secretary/schedules?${params}`);
  },

  createSchedule: (scheduleData) => {
    return fetchWithAuth('/api/secretary/schedules', {
      method: 'POST',
      body: JSON.stringify(scheduleData),
    });
  },

  updateSchedule: (id, scheduleData) => {
    return fetchWithAuth(`/api/secretary/schedules/${id}`, {
      method: 'PUT',
      body: JSON.stringify(scheduleData),
    });
  },

  deleteSchedule: (id) => {
    return fetchWithAuth(`/api/secretary/schedules/${id}`, {
      method: 'DELETE',
    });
  },
};

export const supervisorAPI = {
  getDashboard: () => {
    return fetchWithAuth('/api/supervisor/dashboard');
  },

  getDocuments: (filters = {}) => {
    const params = new URLSearchParams(filters);
    return fetchWithAuth(`/api/supervisor/documents?${params}`);
  },

  sendDocument: (documentData) => {
    return fetchWithAuth('/api/supervisor/documents/send', {
      method: 'POST',
      body: JSON.stringify(documentData),
    });
  },

  getDocumentTemplates: () => {
    return fetchWithAuth('/api/supervisor/documents/templates');
  },

  getGuards: (filters = {}) => {
    const params = new URLSearchParams(filters);
    return fetchWithAuth(`/api/supervisor/guards?${params}`);
  },

  getRoster: () => {
    return fetchWithAuth('/api/supervisor/guards');
  },

  getLiveShifts: () => {
    return fetchWithAuth('/api/supervisor/shifts/live');
  },

  markShiftMissed: (id, reason) => {
    return fetchWithAuth(`/api/supervisor/shifts/${id}/missed`, {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    });
  },

  getNotices: (filters = {}) => {
    const params = new URLSearchParams(filters);
    return fetchWithAuth(`/api/supervisor/notices?${params}`);
  },

  postNotice: (noticeData) => {
    return fetchWithAuth('/api/supervisor/notices', {
      method: 'POST',
      body: JSON.stringify(noticeData),
    });
  },

  getIncidents: () => {
    return fetchWithAuth('/api/supervisor/incidents');
  },

  escalateIncident: (id, notes) => {
    return fetchWithAuth(`/api/supervisor/incidents/${id}/escalate`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    });
  },

  createAllocation: (data) => {
    return fetchWithAuth('/api/supervisor/guard-allocations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getAllocations: () => {
    return fetchWithAuth('/api/supervisor/guard-allocations');
  },

  getDutyAllocation: () => {
    return fetchWithAuth('/api/supervisor/allocations');
  },

  getManagedSites: () => {
    return fetchWithAuth('/api/supervisor/managed-sites');
  },

  getActiveShifts: (filters = {}) => {
    const params = new URLSearchParams(filters);
    const query = params.toString();
    return fetchWithAuth(`/api/supervisor/shifts/active${query ? `?${query}` : ''}`);
  },

  getMissedOffShifts: () => {
    return fetchWithAuth('/api/supervisor/shifts/missed-off');
  },

  getScheduledOvertime: () => {
    return fetchWithAuth('/api/supervisor/overtime/scheduled');
  },

  searchGuards: (query) => {
    const params = new URLSearchParams({ q: query });
    return fetchWithAuth(`/api/supervisor/guards/search?${params}`);
  },

  getUncoveredSites: () => {
    return fetchWithAuth('/api/supervisor/sites/uncovered');
  },

  allocateOvertime: (data) => {
    return fetchWithAuth('/api/supervisor/overtime/allocate', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

export default {
  auth: authAPI,
  users: usersAPI,
  sites: sitesAPI,
  shifts: shiftsAPI,
  financial: financialAPI,
  audits: auditsAPI,
  notifications: notificationsAPI,
  dashboard: dashboardAPI,
  businessLogic: businessLogicAPI,
  requests: requestsAPI,
  applications: applicationsAPI,
  supervisor: supervisorAPI,
  secretary: secretaryAPI,
};