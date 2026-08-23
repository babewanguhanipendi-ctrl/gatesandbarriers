import { businessLogicAPI, auditsAPI, dashboardAPI } from './api.js'

// Re-export dashboardAPI for components that import from businessLogic
export { dashboardAPI }

/**
 * Payroll Engine - Calculates monthly pay for guards
 * 
 * Business Rules:
 * 1. Base Pay = (Day Shifts * SiteDayRate) + (Night Shifts * SiteNightRate)
 * 2. Uniform Deduction: If join_date is within the last 3 months, deduct monthly installment
 * 3. Penalty Tranches: Apply current month's installment from pending penalties
 * 4. Off-Day Bonus: If guard worked 2 off-days (total shifts > standard), add bonus
 */
export const calculateMonthlyPay = async (guardId, month) => {
  try {
    const data = await businessLogicAPI.calculateMonthlyPay(guardId, month)
    return data
  } catch (error) {
    console.error('Error calculating monthly pay:', error)
    throw error
  }
}

/**
 * Attendance Monitor - Checks for AWOL (Absent Without Leave) guards
 * 
 * Business Rule:
 * - If no activity for 5 days, trigger urgent notification to Manager
 * - Scans all active guards' last_active_date
 */
export const checkAWOLStatus = async () => {
  try {
    const data = await businessLogicAPI.checkAWOLStatus()
    return data
  } catch (error) {
    console.error('Error checking AWOL status:', error)
    throw error
  }
}

/**
 * Resignation & Compliance - Initiates guard resignation
 * 
 * Business Rules:
 * 1. Set account_status to 'resigning' and resignation_date to current date
 * 2. Trigger 30-day countdown logic
 * 3. If no resignation_letter_url, flag as compliance_risk: true
 */
export const initiateResignation = async (guardId, reason, resignationLetterUrl = null) => {
  try {
    const data = await businessLogicAPI.initiateResignation({
      reason,
      resignation_letter_url: resignationLetterUrl
    })
    return data
  } catch (error) {
    console.error('Error initiating resignation:', error)
    throw error
  }
}

/**
 * Audit Approval - Approves field audit and creates penalty
 * 
 * Business Rules:
 * 1. Update audit status to 'resolved'
 * 2. Insert penalty record into financial_ledger
 * 3. Automatically split penalty into installments
 */
export const approveAudit = async (auditId, penaltyAmount, installmentCount) => {
  try {
    const data = await auditsAPI.approve(auditId, {
      penalty_amount: penaltyAmount,
      installment_count: installmentCount
    })

    return {
      success: true,
      audit: data.audit,
      message: `Audit approved. Penalty of KES ${penaltyAmount} split into ${installmentCount} installments.`
    }
  } catch (error) {
    console.error('Error approving audit:', error)
    throw error
  }
}

/**
 * Helper: Get guards with resignation countdown
 * Returns guards in 'resigning' status with days remaining
 */
export const getResignationCountdown = async () => {
  try {
    const data = await businessLogicAPI.getResignationCountdown()
    return data
  } catch (error) {
    console.error('Error getting resignation countdown:', error)
    throw error
  }
}

/**
 * Helper: Check and update expired resignations
 * Should be called periodically to disable accounts past 30-day notice
 */
export const processExpiredResignations = async () => {
  try {
    const data = await dashboardAPI.processExpiredResignations()
    return data
  } catch (error) {
    console.error('Error processing expired resignations:', error)
    throw error
  }
}