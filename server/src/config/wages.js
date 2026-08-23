/**
 * Central Wage & Deduction Configuration (HIGHEST PRIORITY BUSINESS RULES)
 *
 * Fixed Shift Wage Baselines for a standard 12-hour shift:
 *   - Guard:      KES 254 per standard 12-hour shift
 *   - Supervisor: KES 400 per standard 12-hour shift
 *
 * Both baselines are stored in the `system_settings` table and are fully
 * editable via the manager/admin portal (see routes/manager.js settings endpoints).
 *
 * Deduction Exemptions:
 *   - Supervisors are STRICTLY EXEMPT from uniform fees, gear fees, and any
 *     equipment deductions. All deduction calculation logic MUST call
 *     isDeductionExempt() and skip supervisors entirely.
 */

const DEFAULT_GUARD_SHIFT_RATE = 254.0;
const DEFAULT_SUPERVISOR_SHIFT_RATE = 400.0;

// Used only for scheduled shift windows, never for pay calculation.
const STANDARD_SHIFT_HOURS = 12;

// A standard shift is 12 hours long.
// Settings keys used in the system_settings table.
const SETTING_KEYS = {
  guardShiftRate: 'guard_shift_rate',
  supervisorShiftRate: 'supervisor_shift_rate'
};

// Roles that are exempt from ALL uniform/gear/equipment deductions.
const DEDUCTION_EXEMPT_ROLES = ['supervisor'];

// Ledger types/descriptions used for uniform, gear, and equipment charges.
const isFeeDeduction = ({ type, description, metadata } = {}) => {
  const searchableText = [type, description, metadata]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return searchableText.includes('uniform') ||
    searchableText.includes('gear') ||
    searchableText.includes('equipment');
};

/**
 * Returns true when the given role is exempt from uniform/gear/equipment
 * deductions. Supervisors are always exempt.
 */
const isDeductionExempt = (role) => {
  return DEDUCTION_EXEMPT_ROLES.includes(String(role || '').toLowerCase());
};

/**
 * Reads the editable wage baselines from the system_settings table.
 * Falls back to the fixed defaults (guard 254 / supervisor 400) when the
 * settings table or individual keys are missing.
 *
 * @param {object} db - Database adapter exposing query(sql, params)
 * @returns {Promise<{guardShiftRate:number, supervisorShiftRate:number}>}
 */
const getWageRates = async (db) => {
  const rates = {
    guardShiftRate: DEFAULT_GUARD_SHIFT_RATE,
    supervisorShiftRate: DEFAULT_SUPERVISOR_SHIFT_RATE,
  };

  if (!db) return rates;

  try {
    const result = await db.query(
      'SELECT key, value FROM system_settings WHERE key = ANY($1::text[])',
      [[SETTING_KEYS.guardShiftRate, SETTING_KEYS.supervisorShiftRate]]
    );

    for (const row of result.rows) {
      const parsed = parseFloat(row.value);
      if (!Number.isFinite(parsed) || parsed < 0) continue;
      if (row.key === SETTING_KEYS.guardShiftRate) rates.guardShiftRate = parsed;
      if (row.key === SETTING_KEYS.supervisorShiftRate) rates.supervisorShiftRate = parsed;
    }
  } catch (error) {
    // Table may not exist yet during first boot; fall back to defaults.
    console.warn('[wages] Falling back to default wage rates:', error.message);
  }

  return rates;
};

/**
 * Resolves the per-shift baseline rate for a user role using the
 * currently configured wage rates.
 */
const getShiftRateForRole = (role, rates) => {
  const normalizedRole = String(role || '').toLowerCase();
  const resolvedRates = rates || {
    guardShiftRate: DEFAULT_GUARD_SHIFT_RATE,
    supervisorShiftRate: DEFAULT_SUPERVISOR_SHIFT_RATE,
    standardShiftHours: STANDARD_SHIFT_HOURS
  };

  if (normalizedRole === 'supervisor') {
    return resolvedRates.supervisorShiftRate;
  }
  return resolvedRates.guardShiftRate;
};

module.exports = {
  DEFAULT_GUARD_SHIFT_RATE,
  DEFAULT_SUPERVISOR_SHIFT_RATE,
  STANDARD_SHIFT_HOURS,
  SETTING_KEYS,
  DEDUCTION_EXEMPT_ROLES,
  isDeductionExempt,
  isFeeDeduction,
  getWageRates,
  getShiftRateForRole
};