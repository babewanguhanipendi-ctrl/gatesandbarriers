DROP TABLE IF EXISTS email_outbox CASCADE;
DROP TABLE IF EXISTS secretary_tasks CASCADE;
DROP TABLE IF EXISTS meetings CASCADE;
DROP TABLE IF EXISTS company_schedules CASCADE;
DROP TABLE IF EXISTS financial_reports CASCADE;
DROP TABLE IF EXISTS treasury_disbursements CASCADE;
DROP TABLE IF EXISTS payslips CASCADE;
DROP TABLE IF EXISTS payroll_runs CASCADE;
DROP TABLE IF EXISTS attendance_reports CASCADE;
DROP TABLE IF EXISTS attendance_compliance CASCADE;
DROP TABLE IF EXISTS attendance_exceptions CASCADE;
DROP TABLE IF EXISTS guard_off_status CASCADE;
DROP TABLE IF EXISTS allocations CASCADE;
DROP TABLE IF EXISTS supervisor_allocations CASCADE;
DROP TABLE IF EXISTS clock_ins CASCADE;
DROP TABLE IF EXISTS leave_records CASCADE;
DROP TABLE IF EXISTS pay_rates CASCADE;
DROP TABLE IF EXISTS financial_ledgers CASCADE;
DROP TABLE IF EXISTS system_settings CASCADE;
DROP TABLE IF EXISTS document_transfers CASCADE;
DROP TABLE IF EXISTS policies CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS audits CASCADE;
DROP TABLE IF EXISTS financial_ledger CASCADE;
DROP TABLE IF EXISTS applications CASCADE;
DROP TABLE IF EXISTS requests CASCADE;
DROP TABLE IF EXISTS uniform_requests CASCADE;
DROP TABLE IF EXISTS uniforms CASCADE;
DROP TABLE IF EXISTS shift_handovers CASCADE;
DROP TABLE IF EXISTS shifts CASCADE;
DROP TABLE IF EXISTS sites CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS allocated_work_numbers CASCADE;

DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  work_number VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'director', 'manager', 'supervisor', 'secretary', 'guard')),
  account_status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (account_status IN ('active', 'resigning', 'disabled')),
  join_date DATE NOT NULL DEFAULT CURRENT_DATE,
  hire_date DATE NOT NULL DEFAULT CURRENT_DATE,
  uniform_status VARCHAR(50) NOT NULL DEFAULT 'allocated' CHECK (uniform_status IN ('pending', 'allocated', 'complete', 'na')),
  last_active_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  site_id UUID,
  phone_number VARCHAR(50),
  password_reset_token VARCHAR(255),
  password_reset_code VARCHAR(20),
  password_reset_expires_at TIMESTAMP,
  pending_password_hash VARCHAR(255),
  pending_password_set_at TIMESTAMP,
  password_reset_verify_token VARCHAR(255),
  password_reset_verified_at TIMESTAMP,
  email_verification_token VARCHAR(255),
  email_verified_at TIMESTAMP,
  id_number VARCHAR(100) UNIQUE,
  emergency_contact VARCHAR(255),
  emergency_phone VARCHAR(50),
  resignation_date DATE,
  resignation_reason TEXT,
  resignation_letter_url TEXT,
  compliance_risk BOOLEAN DEFAULT FALSE,
  profile_picture_url TEXT,
  shift_type VARCHAR(50) DEFAULT 'day' CHECK (shift_type IN ('day', 'night', 'overtime')),
  daily_rate DECIMAL(10,2) DEFAULT 254.00,
  tenure_years DECIMAL(4,2) DEFAULT 0,
  available_for_overtime BOOLEAN DEFAULT TRUE,
  last_overtime_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_work_number ON users(work_number);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_account_status ON users(account_status);
CREATE INDEX idx_users_site_id ON users(site_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_password_reset_token ON users(password_reset_token);
CREATE INDEX idx_users_password_reset_verify_token ON users(password_reset_verify_token);
CREATE INDEX idx_users_shift_type ON users(shift_type);

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE allocated_work_numbers (
    work_number VARCHAR(50) PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    role VARCHAR(50) NOT NULL,
  allocated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_allocated_work_numbers_user_id ON allocated_work_numbers(user_id);
CREATE INDEX idx_allocated_work_numbers_role ON allocated_work_numbers(role);

CREATE TRIGGER update_allocated_work_numbers_updated_at
  BEFORE UPDATE ON allocated_work_numbers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE supervisor_allocations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supervisor_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  area VARCHAR(50) NOT NULL CHECK (area IN ('town', 'nyali')),
  shift_type VARCHAR(50) NOT NULL CHECK (shift_type IN ('day', 'night')),
  motorcycle BOOLEAN DEFAULT FALSE,
  motor_gear BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(supervisor_id)
);

CREATE INDEX idx_supervisor_allocations_supervisor_id ON supervisor_allocations(supervisor_id);
CREATE INDEX idx_supervisor_allocations_area ON supervisor_allocations(area);
CREATE INDEX idx_supervisor_allocations_shift_type ON supervisor_allocations(shift_type);

CREATE TABLE system_settings (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_name VARCHAR(255) NOT NULL,
  location VARCHAR(255) NOT NULL,
  address TEXT NOT NULL,
  client_name VARCHAR(255) NOT NULL,
  contact_number VARCHAR(50),
  required_guards INTEGER NOT NULL DEFAULT 1,
  day_rate DECIMAL(10,2) NOT NULL,
  night_rate DECIMAL(10,2) NOT NULL,
  amount_offered DECIMAL(10,2) DEFAULT 0.00,
  supervisor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  contract_start DATE,
  contract_end DATE,
  contract_document_url TEXT,
  latitude DECIMAL(10, 7),
  longitude DECIMAL(10, 7),
  geofence_radius INTEGER NOT NULL DEFAULT 100,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sites_supervisor_id ON sites(supervisor_id);
CREATE INDEX idx_sites_latitude ON sites(latitude);
CREATE INDEX idx_sites_longitude ON sites(longitude);
CREATE INDEX idx_sites_status ON sites(status);
CREATE INDEX idx_sites_contract_dates ON sites(contract_start, contract_end);
CREATE INDEX idx_sites_created_by ON sites(created_by);
CREATE INDEX idx_sites_created_at ON sites(created_at DESC);

CREATE TRIGGER update_sites_updated_at
  BEFORE UPDATE ON sites
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE shifts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  guard_id UUID REFERENCES users(id) ON DELETE CASCADE,
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  shift_type VARCHAR(50) NOT NULL CHECK (shift_type IN ('day', 'night', 'overtime')),
  status VARCHAR(50) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'missed', 'cancelled')),
  check_in_time TIMESTAMP,
  check_out_time TIMESTAMP,
  start_time TIMESTAMP,
  end_time TIMESTAMP,
  hourly_rate DECIMAL(10,2) DEFAULT 234.00,
  daily_rate DECIMAL(10,2),
  notes TEXT,
  verified BOOLEAN DEFAULT FALSE,
  verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
  verified_at TIMESTAMP,
  is_overtime BOOLEAN DEFAULT FALSE,
  overtime_reason TEXT,
  allocated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  check_in_latitude DECIMAL(10, 7),
  check_in_longitude DECIMAL(10, 7),
  check_in_accuracy DECIMAL(10, 2),
  check_in_geofence_verified BOOLEAN DEFAULT FALSE,
  check_out_latitude DECIMAL(10, 7),
  check_out_longitude DECIMAL(10, 7),
  check_out_geofence_verified BOOLEAN DEFAULT FALSE,
  tied_to_inspection BOOLEAN DEFAULT FALSE,
  inspection_checklist_id UUID,
  overtime_approved BOOLEAN DEFAULT FALSE,
  overtime_approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  overtime_approved_at TIMESTAMP,
  manual_override BOOLEAN DEFAULT FALSE,
  manual_override_by UUID REFERENCES users(id) ON DELETE SET NULL,
  manual_override_at TIMESTAMP,
  manual_override_reason TEXT,
  supervisor_clock_in BOOLEAN DEFAULT FALSE,
  supervisor_clock_in_by UUID REFERENCES users(id) ON DELETE SET NULL,
  clock_in_method VARCHAR(50) DEFAULT 'normal',
  clock_out_method VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(guard_id, site_id, date, shift_type, is_overtime)
);

CREATE INDEX idx_shifts_guard_id ON shifts(guard_id);
CREATE INDEX idx_shifts_check_in_geofence_verified ON shifts(check_in_geofence_verified);
CREATE INDEX idx_shifts_overtime_approved ON shifts(overtime_approved);
CREATE INDEX idx_shifts_manual_override ON shifts(manual_override);
CREATE INDEX idx_shifts_site_id ON shifts(site_id);
CREATE INDEX idx_shifts_date ON shifts(date);
CREATE INDEX idx_shifts_status ON shifts(status);
CREATE INDEX idx_shifts_end_time ON shifts(end_time);
CREATE INDEX idx_shifts_start_time ON shifts(start_time);
CREATE INDEX idx_shifts_verified ON shifts(verified);
CREATE UNIQUE INDEX idx_shifts_one_active_guard
  ON shifts(guard_id)
  WHERE check_in_time IS NOT NULL AND end_time IS NULL;

CREATE TRIGGER update_shifts_updated_at
  BEFORE UPDATE ON shifts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE allocations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  guard_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE NOT NULL,
  allocated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  shift_type VARCHAR(50) NOT NULL CHECK (shift_type IN ('day', 'night', 'overtime')),
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(guard_id, site_id, date, shift_type)
);

CREATE INDEX idx_allocations_guard_id ON allocations(guard_id);
CREATE INDEX idx_allocations_site_id ON allocations(site_id);
CREATE INDEX idx_allocations_date ON allocations(date);

CREATE TABLE guard_off_status (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  guard_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  status_type VARCHAR(50) NOT NULL CHECK (status_type IN ('off_day', 'leave', 'absent', 'sick')),
  start_date DATE NOT NULL,
  end_date DATE,
  reason TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_guard_off_status_guard_id ON guard_off_status(guard_id);
CREATE INDEX idx_guard_off_status_dates ON guard_off_status(start_date, end_date);

-- Operations domain: immutable clock events and leave eligibility records.
CREATE TABLE clock_ins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shift_id UUID REFERENCES shifts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  clock_in_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  clock_out_at TIMESTAMP,
  method VARCHAR(50) NOT NULL DEFAULT 'normal',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT clock_ins_valid_times CHECK (clock_out_at IS NULL OR clock_out_at >= clock_in_at)
);

CREATE INDEX idx_clock_ins_user_id ON clock_ins(user_id);
CREATE INDEX idx_clock_ins_shift_id ON clock_ins(shift_id);

CREATE TABLE leave_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'approved', 'rejected', 'cancelled')),
  paid_full_salary BOOLEAN NOT NULL DEFAULT FALSE,
  worked_during_leave BOOLEAN NOT NULL DEFAULT FALSE,
  overtime_shift_id UUID REFERENCES shifts(id) ON DELETE SET NULL,
  reason TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT leave_records_valid_dates CHECK (end_date >= start_date)
);

CREATE INDEX idx_leave_records_user_dates ON leave_records(user_id, start_date, end_date);

CREATE TRIGGER update_leave_records_updated_at
  BEFORE UPDATE ON leave_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE uniforms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  guard_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  shirt BOOLEAN DEFAULT FALSE,
  rungu BOOLEAN DEFAULT FALSE,
  rungu_holder BOOLEAN DEFAULT FALSE,
  trouser BOOLEAN DEFAULT FALSE,
  belt BOOLEAN DEFAULT FALSE,
  whistle BOOLEAN DEFAULT FALSE,
  shoes BOOLEAN DEFAULT FALSE,
  raincoat BOOLEAN DEFAULT FALSE,
  torch BOOLEAN DEFAULT FALSE,
  monthly_deduction DECIMAL(10,2) DEFAULT 300.00,
  total_deductions DECIMAL(10,2) DEFAULT 0.00,
  deductions_remaining DECIMAL(10,2) DEFAULT 0.00,
  is_complete BOOLEAN DEFAULT FALSE,
  issued_at TIMESTAMP,
  issued_by UUID REFERENCES users(id) ON DELETE SET NULL,
  completed_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_uniforms_guard_id ON uniforms(guard_id);
CREATE INDEX idx_uniforms_is_complete ON uniforms(is_complete);

CREATE TRIGGER update_uniforms_updated_at
  BEFORE UPDATE ON uniforms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE uniform_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  guard_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  item_name VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'disbursed', 'rejected')),
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMP,
  processed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  delivery_status VARCHAR(50) DEFAULT 'pending_delivery' CHECK (delivery_status IN ('pending_delivery', 'delivered', 'delayed')),
  guard_confirmed BOOLEAN DEFAULT FALSE,
  follow_up_requested BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_uniform_requests_guard_id ON uniform_requests(guard_id);
CREATE INDEX idx_uniform_requests_status ON uniform_requests(status);
CREATE INDEX idx_uniform_requests_requested_at ON uniform_requests(requested_at DESC);
CREATE INDEX idx_uniform_requests_delivery_status ON uniform_requests(delivery_status);
CREATE INDEX idx_uniform_requests_guard_confirmed ON uniform_requests(guard_confirmed);
CREATE INDEX idx_uniform_requests_follow_up ON uniform_requests(follow_up_requested);
CREATE INDEX idx_uniform_requests_supervisor_delivery ON uniform_requests(guard_id, delivery_status, follow_up_requested) WHERE status = 'disbursed';

CREATE TRIGGER update_uniform_requests_updated_at
  BEFORE UPDATE ON uniform_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE shift_handovers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shift_id UUID REFERENCES shifts(id) ON DELETE CASCADE NOT NULL,
  guard_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE NOT NULL,
  notes TEXT NOT NULL,
  next_guard_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'read', 'archived')),
  read_at TIMESTAMP,
  archived_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_shift_handovers_shift_id ON shift_handovers(shift_id);
CREATE INDEX idx_shift_handovers_guard_id ON shift_handovers(guard_id);
CREATE INDEX idx_shift_handovers_site_id ON shift_handovers(site_id);
CREATE INDEX idx_shift_handovers_next_guard_id ON shift_handovers(next_guard_id);
CREATE INDEX idx_shift_handovers_status ON shift_handovers(status);
CREATE INDEX idx_shift_handovers_created_at ON shift_handovers(created_at DESC);

CREATE TRIGGER update_shift_handovers_updated_at
  BEFORE UPDATE ON shift_handovers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contractor_name VARCHAR(255) NOT NULL,
  contractor_email VARCHAR(255) NOT NULL,
  contractor_phone VARCHAR(50),
  site_location VARCHAR(255) NOT NULL,
  property_type VARCHAR(100) NOT NULL,
  coverage_hours VARCHAR(100) NOT NULL,
  guards_needed INTEGER NOT NULL,
  entry_points TEXT,
  risk_notes TEXT,
  security_type VARCHAR(100) NOT NULL,
  budget_estimate DECIMAL(12,2),
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'approved', 'rejected', 'completed')),
  assigned_role VARCHAR(50) NOT NULL DEFAULT 'director' CHECK (assigned_role IN ('manager', 'secretary', 'director')),
  email_confirmed_at TIMESTAMP,
  reply_subject TEXT,
  reply_body TEXT,
  replied_at TIMESTAMP,
  forwarded_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_requests_status ON requests(status);
CREATE INDEX idx_requests_created_at ON requests(created_at DESC);

CREATE TRIGGER update_requests_updated_at
  BEFORE UPDATE ON requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  position VARCHAR(100) NOT NULL DEFAULT 'guard' CHECK (position = 'guard'),
  experience TEXT,
  message TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'shortlisted', 'rejected', 'hired')),
  assigned_role VARCHAR(50) NOT NULL DEFAULT 'manager' CHECK (assigned_role IN ('manager', 'secretary', 'director')),
  work_number VARCHAR(50),
  reply_subject TEXT,
  reply_body TEXT,
  replied_at TIMESTAMP,
  forwarded_at TIMESTAMP,
  notes TEXT,
  contract_document_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_applications_status ON applications(status);
CREATE INDEX idx_applications_created_at ON applications(created_at DESC);

CREATE TRIGGER update_applications_updated_at
  BEFORE UPDATE ON applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE financial_ledger (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  guard_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  site_id UUID REFERENCES sites(id) ON DELETE SET NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('uniform', 'penalty', 'bonus', 'salary', 'resignation', 'advance')),
  amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled', 'overdue')),
  installment_count INTEGER DEFAULT 1,
  installments_paid INTEGER DEFAULT 0,
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_financial_ledger_guard_id ON financial_ledger(guard_id);
CREATE INDEX idx_financial_ledger_type ON financial_ledger(type);

CREATE TRIGGER update_financial_ledger_updated_at
  BEFORE UPDATE ON financial_ledger
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Financial domain: rates and ledger entries are explicitly denominated in KES.
CREATE TABLE pay_rates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'director', 'manager', 'supervisor', 'secretary', 'guard')),
  rate_type VARCHAR(30) NOT NULL CHECK (rate_type IN ('shift', 'hourly', 'overtime')),
  amount_shillings DECIMAL(12,2) NOT NULL CHECK (amount_shillings >= 0),
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pay_rates_valid_dates CHECK (effective_to IS NULL OR effective_to >= effective_from),
  UNIQUE(role, rate_type, effective_from)
);

CREATE TABLE financial_ledgers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  site_id UUID REFERENCES sites(id) ON DELETE SET NULL,
  leave_record_id UUID REFERENCES leave_records(id) ON DELETE SET NULL,
  entry_type VARCHAR(40) NOT NULL CHECK (entry_type IN ('revenue', 'wage', 'paid_leave', 'overtime', 'deduction', 'adjustment')),
  amount_shillings DECIMAL(12,2) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'KES' CHECK (currency = 'KES'),
  description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_financial_ledgers_user_id ON financial_ledgers(user_id);
CREATE INDEX idx_financial_ledgers_entry_type ON financial_ledgers(entry_type);

CREATE TABLE audits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  guard_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE NOT NULL,
  issue_type VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'resolved')),
  priority VARCHAR(50) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  penalty_amount DECIMAL(10,2),
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audits_guard_id ON audits(guard_id);
CREATE INDEX idx_audits_status ON audits(status);

CREATE TRIGGER update_audits_updated_at
  BEFORE UPDATE ON audits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  type VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  priority VARCHAR(50) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  read BOOLEAN DEFAULT FALSE,
  metadata JSONB,
  target_role VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  user_name VARCHAR(255),
  user_email VARCHAR(255),
  action VARCHAR(255) NOT NULL,
  type VARCHAR(100) NOT NULL CHECK (type IN ('user_management', 'financial', 'audit', 'system', 'security', 'uniform', 'attendance', 'shift', 'document')),
  description TEXT NOT NULL,
  ip_address VARCHAR(50),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

CREATE TABLE policies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  category VARCHAR(100) NOT NULL CHECK (category IN ('security', 'hr', 'safety', 'compliance', 'operational')),
  priority VARCHAR(50) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  version VARCHAR(50) NOT NULL DEFAULT '1.0',
  created_by UUID REFERENCES users(id) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_policies_category ON policies(category);
CREATE INDEX idx_policies_created_at ON policies(created_at DESC);

CREATE TRIGGER update_policies_updated_at
  BEFORE UPDATE ON policies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE document_transfers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  recipient_id UUID REFERENCES users(id) ON DELETE SET NULL,
  recipient_role VARCHAR(50) CHECK (recipient_role IN ('manager', 'secretary', 'guard', 'all')),
  document_type VARCHAR(100) NOT NULL CHECK (document_type IN (
    'incident_report',
    'shift_change_sop',
    'handover_notes',
    'daily_instructions',
    'training_material',
    'policy_update',
    'contract_application',
    'other'
  )),
  related_id UUID,
  title VARCHAR(255) NOT NULL,
  content TEXT,
  file_url TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'read', 'archived')),
  priority VARCHAR(50) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  read_at TIMESTAMP,
  archived_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_document_transfers_sender_id ON document_transfers(sender_id);
CREATE INDEX idx_document_transfers_recipient_id ON document_transfers(recipient_id);
CREATE INDEX idx_document_transfers_recipient_role ON document_transfers(recipient_role);
CREATE INDEX idx_document_transfers_status ON document_transfers(status);
CREATE INDEX idx_document_transfers_created_at ON document_transfers(created_at DESC);
CREATE INDEX idx_document_transfers_document_type ON document_transfers(document_type);

CREATE TRIGGER update_document_transfers_updated_at
  BEFORE UPDATE ON document_transfers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE meetings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID REFERENCES requests(id) ON DELETE SET NULL UNIQUE,
  contractor_name VARCHAR(255) NOT NULL,
  contractor_email VARCHAR(255) NOT NULL,
  director_id UUID REFERENCES users(id) ON DELETE SET NULL,
  secretary_id UUID REFERENCES users(id) ON DELETE SET NULL,
  scheduled_date TIMESTAMP NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  meeting_type VARCHAR(50) NOT NULL DEFAULT 'consultation',
  status VARCHAR(50) NOT NULL DEFAULT 'scheduled',
  location TEXT,
  agenda TEXT,
  notes TEXT,
  reschedule_reason TEXT,
  original_date TIMESTAMP,
  email_sent BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE secretary_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
  request_id UUID REFERENCES requests(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  task_type VARCHAR(50) NOT NULL,
  priority VARCHAR(50) NOT NULL DEFAULT 'medium',
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  subject VARCHAR(255) NOT NULL,
  body TEXT,
  recipient_email VARCHAR(255),
  recipient_name VARCHAR(255),
  scheduled_date TIMESTAMP,
  completed_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE company_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  venue VARCHAR(255) NOT NULL,
  event_type VARCHAR(100) NOT NULL DEFAULT 'meeting' CHECK (event_type IN ('meeting', 'training', 'event', 'deadline', 'other')),
  priority VARCHAR(50) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status VARCHAR(50) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'postponed')),
  created_by UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  target_audience VARCHAR(50) CHECK (target_audience IN ('all', 'directors', 'managers', 'supervisors', 'guards', 'secretaries')),
  notify_all BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_company_schedules_event_date ON company_schedules(event_date);
CREATE INDEX idx_company_schedules_status ON company_schedules(status);
CREATE INDEX idx_company_schedules_created_by ON company_schedules(created_by);
CREATE INDEX idx_company_schedules_event_type ON company_schedules(event_type);
CREATE INDEX idx_company_schedules_priority ON company_schedules(priority);
CREATE INDEX idx_company_schedules_created_at ON company_schedules(created_at DESC);

CREATE TRIGGER update_company_schedules_updated_at
  BEFORE UPDATE ON company_schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE email_outbox (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipient_email VARCHAR(255) NOT NULL,
  recipient_name VARCHAR(255),
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  related_type VARCHAR(50) NOT NULL,
  related_id UUID,
  status VARCHAR(50) NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'failed')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  sent_at TIMESTAMP
);

CREATE INDEX idx_email_outbox_status ON email_outbox(status);
CREATE INDEX idx_email_outbox_created_at ON email_outbox(created_at DESC);

-- Payroll and Financial Tables
CREATE TABLE payroll_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
  location VARCHAR(50) NOT NULL CHECK (location IN ('town', 'nyali')),
  run_date DATE NOT NULL DEFAULT CURRENT_DATE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  guard_count INTEGER NOT NULL DEFAULT 0,
  total_gross_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_deductions DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_net_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  status VARCHAR(50) NOT NULL DEFAULT 'pending_approval' CHECK (status IN ('pending_approval', 'approved', 'disbursed', 'cancelled', 'draft')),
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payroll_runs_site_id ON payroll_runs(site_id);
CREATE INDEX idx_payroll_runs_location ON payroll_runs(location);
CREATE INDEX idx_payroll_runs_status ON payroll_runs(status);
CREATE INDEX idx_payroll_runs_run_date ON payroll_runs(run_date DESC);
CREATE INDEX idx_payroll_runs_created_at ON payroll_runs(created_at DESC);

CREATE TRIGGER update_payroll_runs_updated_at
  BEFORE UPDATE ON payroll_runs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE payslips (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payroll_run_id UUID REFERENCES payroll_runs(id) ON DELETE CASCADE NOT NULL,
  guard_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  days_worked INTEGER NOT NULL DEFAULT 0,
  daily_rate DECIMAL(10,2) NOT NULL,
  gross_salary DECIMAL(10,2) NOT NULL,
  bonus_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  uniform_deduction DECIMAL(10,2) NOT NULL DEFAULT 0,
  motor_gear_deduction DECIMAL(10,2) NOT NULL DEFAULT 0,
  advance_deduction DECIMAL(10,2) NOT NULL DEFAULT 0,
  penalty_deduction DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_deductions DECIMAL(10,2) NOT NULL DEFAULT 0,
  net_salary DECIMAL(10,2) NOT NULL,
  payment_status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'processing', 'completed', 'failed')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payslips_payroll_run_id ON payslips(payroll_run_id);
CREATE INDEX idx_payslips_guard_id ON payslips(guard_id);
CREATE INDEX idx_payslips_payment_status ON payslips(payment_status);

CREATE TRIGGER update_payslips_updated_at
  BEFORE UPDATE ON payslips
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE treasury_disbursements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payroll_run_id UUID REFERENCES payroll_runs(id) ON DELETE CASCADE NOT NULL,
  disbursement_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_amount DECIMAL(12,2) NOT NULL,
  payment_method VARCHAR(50) NOT NULL DEFAULT 'bank_transfer' CHECK (payment_method IN ('bank_transfer', 'mobile_money', 'cash', 'cheque')),
  reference_number VARCHAR(255),
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP,
  processed_at TIMESTAMP,
  processed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_treasury_disbursements_payroll_run_id ON treasury_disbursements(payroll_run_id);
CREATE INDEX idx_treasury_disbursements_status ON treasury_disbursements(status);
CREATE INDEX idx_treasury_disbursements_disbursement_date ON treasury_disbursements(disbursement_date DESC);
CREATE INDEX idx_treasury_disbursements_approved_by ON treasury_disbursements(approved_by);

CREATE TRIGGER update_treasury_disbursements_updated_at
  BEFORE UPDATE ON treasury_disbursements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE financial_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_date DATE NOT NULL DEFAULT CURRENT_DATE,
  report_type VARCHAR(50) NOT NULL CHECK (report_type IN ('week', 'month', 'quarter', 'year')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  location VARCHAR(50) NOT NULL CHECK (location IN ('town', 'nyali', 'all')),
  total_revenue DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_wage_bill DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_bonuses DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_deductions DECIMAL(12,2) NOT NULL DEFAULT 0,
  net_profit DECIMAL(12,2) NOT NULL DEFAULT 0,
  guard_count INTEGER NOT NULL DEFAULT 0,
  site_count INTEGER NOT NULL DEFAULT 0,
  metadata JSONB,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_financial_reports_report_date ON financial_reports(report_date DESC);
CREATE INDEX idx_financial_reports_location ON financial_reports(location);
CREATE INDEX idx_financial_reports_report_type ON financial_reports(report_type);
CREATE INDEX idx_financial_reports_period ON financial_reports(period_start, period_end);

CREATE TRIGGER update_financial_reports_updated_at
  BEFORE UPDATE ON financial_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Attendance & Clock-In/Out System Tables
CREATE TABLE attendance_exceptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shift_id UUID REFERENCES shifts(id) ON DELETE CASCADE,
  guard_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
  exception_type VARCHAR(50) NOT NULL CHECK (exception_type IN (
    'geofence_violation', 'missed_punch_out', 'supervisor_override', 'late_clock_in',
    'early_clock_out', 'unauthorized_overtime', 'consecutive_shift_violation', 'manual_adjustment'
  )),
  severity VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewing', 'resolved', 'dismissed')),
  description TEXT,
  metadata JSONB,
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMP,
  resolution_note TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_attendance_exceptions_shift_id ON attendance_exceptions(shift_id);
CREATE INDEX idx_attendance_exceptions_guard_id ON attendance_exceptions(guard_id);
CREATE INDEX idx_attendance_exceptions_site_id ON attendance_exceptions(site_id);
CREATE INDEX idx_attendance_exceptions_status ON attendance_exceptions(status);
CREATE INDEX idx_attendance_exceptions_type ON attendance_exceptions(exception_type);
CREATE INDEX idx_attendance_exceptions_created_at ON attendance_exceptions(created_at DESC);

CREATE TRIGGER update_attendance_exceptions_updated_at
  BEFORE UPDATE ON attendance_exceptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE attendance_compliance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  guard_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  total_hours_worked DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_shifts INTEGER NOT NULL DEFAULT 0,
  consecutive_shifts INTEGER NOT NULL DEFAULT 0,
  max_consecutive_shifts INTEGER NOT NULL DEFAULT 0,
  overtime_hours DECIMAL(10,2) NOT NULL DEFAULT 0,
  unauthorized_overtime_hours DECIMAL(10,2) NOT NULL DEFAULT 0,
  late_clock_ins INTEGER NOT NULL DEFAULT 0,
  missed_punch_outs INTEGER NOT NULL DEFAULT 0,
  geofence_violations INTEGER NOT NULL DEFAULT 0,
  compliance_status VARCHAR(20) NOT NULL DEFAULT 'compliant' CHECK (compliance_status IN ('compliant', 'warning', 'violation', 'critical')),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(guard_id, week_start)
);

CREATE INDEX idx_attendance_compliance_guard_id ON attendance_compliance(guard_id);
CREATE INDEX idx_attendance_compliance_week_start ON attendance_compliance(week_start);
CREATE INDEX idx_attendance_compliance_status ON attendance_compliance(compliance_status);

CREATE TRIGGER update_attendance_compliance_updated_at
  BEFORE UPDATE ON attendance_compliance
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE attendance_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_type VARCHAR(20) NOT NULL CHECK (report_type IN ('daily', 'weekly', 'payroll')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  generated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  report_data JSONB,
  file_url TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'generated' CHECK (status IN ('generated', 'exported', 'archived')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_attendance_reports_type ON attendance_reports(report_type);
CREATE INDEX idx_attendance_reports_period ON attendance_reports(period_start, period_end);
CREATE INDEX idx_attendance_reports_created_at ON attendance_reports(created_at DESC);

CREATE TRIGGER update_attendance_reports_updated_at
  BEFORE UPDATE ON attendance_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Haversine distance function for geofencing
CREATE OR REPLACE FUNCTION calculate_gps_distance(lat1 DECIMAL, lon1 DECIMAL, lat2 DECIMAL, lon2 DECIMAL)
RETURNS DECIMAL AS $$
DECLARE R DECIMAL := 6371000; dLat DECIMAL; dLon DECIMAL; a DECIMAL; c DECIMAL;
BEGIN
  IF lat1 IS NULL OR lon1 IS NULL OR lat2 IS NULL OR lon2 IS NULL THEN RETURN NULL; END IF;
  dLat := radians(lat2 - lat1); dLon := radians(lon2 - lon1);
  a := sin(dLat/2) * sin(dLat/2) + cos(radians(lat1)) * cos(radians(lat2)) * sin(dLon/2) * sin(dLon/2);
  c := 2 * asin(sqrt(a));
  RETURN R * c;
END;
$$ LANGUAGE plpgsql;

ALTER TABLE users 
  ADD CONSTRAINT fk_users_site_id 
  FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE SET NULL;

SELECT 
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name AND table_schema = 'public') as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

SELECT indexname, tablename FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

SELECT trigger_name, event_object_table, action_timing, event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Database schema initialized successfully!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Tables created:';
  RAISE NOTICE '  - allocated_work_numbers (Permanent work number tracking ledger)';
  RAISE NOTICE '  - users (Directors, Managers, Supervisors, Guards, Secretaries)';
  RAISE NOTICE '  - sites (site_name, location, client_name, contact_number, required_guards, created_by, contract_document_url)';
  RAISE NOTICE '  - shifts (Active clock-ins, normal/overtime tracking, site allocations, verification, rates)';
  RAISE NOTICE '  - uniforms (Baseline inventory, 300 KES monthly deduction tracking)';
  RAISE NOTICE '  - uniform_requests (Guard requests, 2-item limit, delivery status, supervisor/secretary tracking, follow-ups)';
  RAISE NOTICE '  - shift_handovers (Shift handover notes between guards)';
  RAISE NOTICE '  - requests (Client intake system)';
  RAISE NOTICE '  - applications (Guard work seekers with contract document support)';
  RAISE NOTICE '  - financial_ledger (Financial transactions)';
  RAISE NOTICE '  - audits (Incident reports)';
  RAISE NOTICE '  - notifications (User notifications)';
  RAISE NOTICE '  - audit_logs (System audit trail)';
  RAISE NOTICE '  - policies (Company policies)';
  RAISE NOTICE '  - document_transfers (Supervisor portal + contract application documents)';
  RAISE NOTICE '  - email_outbox (Email queue)';
  RAISE NOTICE '  - company_schedules (Company-wide schedules and events management)';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Next step: Create admin user via POST /api/auth/register';
  RAISE NOTICE '========================================';
END $$;