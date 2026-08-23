import React, { useState, useEffect } from 'react';
import { directorAPI, secretaryAPI } from '../services/api';
import { useNavigate } from 'react-router-dom';
import './DirectorPortal.css';
import SecretarySchedule from '../pages/secretary/SecretarySchedule';

// Remove axios import - using directorAPI instead

const DirectorPortal = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('contracts');
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);

  // Contracts state
  const [contracts, setContracts] = useState([]);
  const [contractFilter, setContractFilter] = useState('all');

  // Payroll Sign-Off state (Phase 1)
  const [payrollRuns, setPayrollRuns] = useState([]);
  const [payrollFilter, setPayrollFilter] = useState('pending_review');
  const [selectedPayroll, setSelectedPayroll] = useState(null);

  // Treasury Disbursement state (Phase 2)
  const [disbursements, setDisbursements] = useState([]);
  const [treasuryFilter, setTreasuryFilter] = useState('pending_authorization');
  const [selectedDisbursement, setSelectedDisbursement] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [treasuryNotes, setTreasuryNotes] = useState('');

  // Financial Reports state
  const [financialData, setFinancialData] = useState(null);
  const [reportPeriod, setReportPeriod] = useState('month');
  const [reportLocation, setReportLocation] = useState('all');
  const [generatingReport, setGeneratingReport] = useState(false);

  useEffect(() => {
    if (activeTab === 'contracts') fetchContracts();
    else if (activeTab === 'payroll_signoff') fetchPayroll();
    else if (activeTab === 'treasury') fetchTreasury();
    else if (activeTab === 'financial') fetchFinancialReports();
  }, [activeTab, contractFilter, payrollFilter, treasuryFilter, reportPeriod, reportLocation]);

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // ============================================
  // CONTRACTS
  // ============================================
  const fetchContracts = async () => {
    setLoading(true);
    try {
      const data = await directorAPI.getContracts({ status: contractFilter });
      setContracts(data?.contracts || []);
    } catch (error) {
      console.error('Fetch contracts error:', error);
      console.error('Error details:', {
        message: error.message,
        data: error.data
      });
      showNotification('Failed to fetch contracts. Please try again.', 'error');
      setContracts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleContractAction = async (id, action) => {
    try {
      const data = await directorAPI.approveContract(id, action, '');
      showNotification(data?.message || `Contract ${action}d successfully`);
      fetchContracts();
    } catch (error) {
      const errorMessage = error.data?.error || error.message || 'Failed to process contract';
      showNotification(errorMessage, 'error');
      console.error('Contract action error:', error);
    }
  };

  // ============================================
  // PAYROLL SIGN-OFF (Phase 1)
  // ============================================
  const fetchPayroll = async () => {
    setLoading(true);
    try {
      const data = await directorAPI.getPayrollSummaries({ status: payrollFilter, location: 'all' });
      setPayrollRuns(data?.payrollRuns || []);
    } catch (error) {
      showNotification('Failed to fetch payroll summaries', 'error');
      console.error('Fetch payroll error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePayrollSignOff = async (id, action) => {
    try {
      const data = await directorAPI.signOffPayroll(id, { action, notes: '' });
      showNotification(data?.message || 'Payroll processed successfully');
      fetchPayroll();
    } catch (error) {
      const errorMessage = error.data?.error || error.message || 'Failed to process payroll sign-off';
      showNotification(errorMessage, 'error');
      console.error('Payroll sign-off error:', error);
    }
  };

  const printPayrollReceipt = (payrollRun) => {
    const printWindow = window.open('', '_blank');
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Payroll Receipt - ${payrollRun.id}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
          .info { margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #000; padding: 8px; text-align: left; }
          th { background-color: #f0f0f0; }
          .total { font-weight: bold; margin-top: 20px; text-align: right; }
          .footer { margin-top: 40px; text-align: center; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>PAYROLL RECEIPT</h1>
          <p>Payroll Run ID: ${payrollRun.id}</p>
          <p>Run Date: ${payrollRun.run_date}</p>
        </div>
        
        <div class="info">
          <p><strong>Period:</strong> ${payrollRun.period_start} to ${payrollRun.period_end}</p>
          <p><strong>Location:</strong> ${payrollRun.location?.toUpperCase()}</p>
          <p><strong>Status:</strong> ${payrollRun.status}</p>
          <p><strong>Guard Count:</strong> ${payrollRun.guard_count}</p>
        </div>

        <table>
          <thead>
            <tr>
              <th>Guard Name</th>
              <th>Work Number</th>
              <th>Days Worked</th>
              <th>Daily Rate (KES)</th>
              <th>Basic Salary (KES)</th>
              <th>Overtime (KES)</th>
              <th>Bonus (KES)</th>
              <th>Gross Salary (KES)</th>
              <th>Uniform Deduction (KES)</th>
              <th>Motor Gear (KES)</th>
              <th>Total Deductions (KES)</th>
              <th>Net Salary (KES)</th>
            </tr>
          </thead>
          <tbody>
            ${payrollRun.payslips?.map(payslip => `
              <tr>
                <td>${payslip.guard_name}</td>
                <td>${payslip.work_number}</td>
                <td>${payslip.days_worked}</td>
                <td>${parseFloat(payslip.daily_rate).toFixed(2)}</td>
                <td>${parseFloat(payslip.basic_salary).toFixed(2)}</td>
                <td>${parseFloat(payslip.overtime_pay).toFixed(2)}</td>
                <td>${parseFloat(payslip.bonus_amount).toFixed(2)}</td>
                <td>${parseFloat(payslip.gross_salary).toFixed(2)}</td>
                <td>${parseFloat(payslip.uniform_deduction).toFixed(2)}</td>
                <td>${parseFloat(payslip.motor_gear_deduction).toFixed(2)}</td>
                <td>${parseFloat(payslip.total_deductions).toFixed(2)}</td>
                <td>${parseFloat(payslip.net_salary).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="total">
          <p>Total Gross Amount: KES ${parseFloat(payrollRun.total_gross_amount).toFixed(2)}</p>
          <p>Total Deductions: KES ${parseFloat(payrollRun.total_deductions).toFixed(2)}</p>
          <p>Total Net Payable: KES ${parseFloat(payrollRun.total_net_amount).toFixed(2)}</p>
        </div>

        <div class="footer">
          <p>Generated on: ${new Date().toLocaleString()}</p>
          <p>This is a system-generated receipt</p>
        </div>
      </body>
      </html>
    `;
    
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
  };

  // ============================================
  // TREASURY DISBURSEMENT (Phase 2)
  // ============================================
  const fetchTreasury = async () => {
    setLoading(true);
    try {
      const data = await directorAPI.getTreasuryDisbursements({ status: treasuryFilter });
      setDisbursements(data?.disbursements || []);
    } catch (error) {
      showNotification('Failed to fetch treasury disbursements', 'error');
      console.error('Fetch treasury error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTreasuryDisburse = async (id, action) => {
    try {
      const payload = {
        action,
        notes: treasuryNotes || undefined,
        payment_method: action === 'authorize' ? paymentMethod : undefined,
        reference_number: action === 'authorize' ? referenceNumber || undefined : undefined
      };

      const data = await directorAPI.authorizeDisbursement(id, payload);
      showNotification(data?.message || 'Disbursement processed successfully');
      setPaymentMethod('bank_transfer');
      setReferenceNumber('');
      setTreasuryNotes('');
      setSelectedDisbursement(null);
      fetchTreasury();
    } catch (error) {
      const errorMessage = error.data?.error || error.message || 'Failed to process disbursement';
      showNotification(errorMessage, 'error');
      console.error('Treasury disbursement error:', error);
    }
  };

  const printDisbursementReceipt = (disbursement) => {
    const printWindow = window.open('', '_blank');
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Disbursement Receipt - ${disbursement.id}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
          .info { margin-bottom: 20px; }
          .summary { display: flex; justify-content: space-around; margin: 20px 0; }
          .metric { text-align: center; border: 1px solid #000; padding: 15px; flex: 1; margin: 0 10px; }
          .metric h3 { margin: 0; font-size: 18px; }
          .metric p { margin: 10px 0 0; font-size: 24px; font-weight: bold; }
          .footer { margin-top: 40px; text-align: center; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>TREASURY DISBURSEMENT RECEIPT</h1>
          <p>Disbursement ID: ${disbursement.id}</p>
          <p>Date: ${disbursement.disbursement_date}</p>
        </div>
        
        <div class="summary">
          <div class="metric">
            <h3>Total Amount</h3>
            <p>KES ${parseFloat(disbursement.total_amount).toFixed(2)}</p>
          </div>
          <div class="metric">
            <h3>Status</h3>
            <p>${disbursement.status.toUpperCase()}</p>
          </div>
          <div class="metric">
            <h3>Payment Method</h3>
            <p>${(disbursement.payment_method || 'N/A').toUpperCase()}</p>
          </div>
        </div>

        <div class="info">
          <p><strong>Payroll Period:</strong> ${disbursement.period_start} to ${disbursement.period_end}</p>
          <p><strong>Location:</strong> ${disbursement.payroll_location?.toUpperCase()}</p>
          <p><strong>Site:</strong> ${disbursement.site_name || 'N/A'}</p>
          <p><strong>Guard Count:</strong> ${disbursement.guard_count || 'N/A'}</p>
          <p><strong>Reference Number:</strong> ${disbursement.reference_number || 'N/A'}</p>
          <p><strong>Authorized By:</strong> ${disbursement.authorized_by_name || 'N/A'}</p>
          <p><strong>Authorized At:</strong> ${disbursement.authorized_at ? new Date(disbursement.authorized_at).toLocaleString() : 'N/A'}</p>
          ${disbursement.notes ? `<p><strong>Notes:</strong> ${disbursement.notes}</p>` : ''}
        </div>

        <div class="footer">
          <p>Generated on: ${new Date().toLocaleString()}</p>
          <p>This is a system-generated treasury disbursement receipt</p>
        </div>
      </body>
      </html>
    `;
    
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
  };

  // ============================================
  // FINANCIAL REPORTS
  // ============================================
  const fetchFinancialReports = async () => {
    setLoading(true);
    try {
      const data = await directorAPI.getFinancialReports({ period: reportPeriod, location: reportLocation });
      setFinancialData(data);
    } catch (error) {
      showNotification('Failed to fetch financial reports', 'error');
      console.error('Fetch financial reports error:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateFinancialReport = async () => {
    setGeneratingReport(true);
    try {
      const data = await directorAPI.generateFinancialReport({
        report_type: reportPeriod,
        period_start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        period_end: new Date().toISOString().split('T')[0],
        location: reportLocation
      });
      
      showNotification(data?.message || 'Financial report generated successfully');
      fetchFinancialReports();
    } catch (error) {
      const errorMessage = error.data?.error || error.message || 'Failed to generate report';
      showNotification(errorMessage, 'error');
      console.error('Generate report error:', error);
    } finally {
      setGeneratingReport(false);
    }
  };

  const printFinancialReport = () => {
    if (!financialData) return;

    const printWindow = window.open('', '_blank');
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Financial Report - ${reportPeriod}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
          .summary { display: flex; justify-content: space-around; margin: 20px 0; }
          .metric { text-align: center; border: 1px solid #000; padding: 15px; flex: 1; margin: 0 10px; }
          .metric h3 { margin: 0; font-size: 18px; }
          .metric p { margin: 10px 0 0; font-size: 24px; font-weight: bold; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #000; padding: 8px; text-align: left; }
          th { background-color: #f0f0f0; }
          .comparison { display: flex; justify-content: space-between; margin-top: 30px; }
          .location-section { flex: 1; margin: 0 10px; border: 1px solid #000; padding: 15px; }
          .footer { margin-top: 40px; text-align: center; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>FINANCIAL REPORT</h1>
          <p>Period: ${reportPeriod.toUpperCase()}</p>
          <p>Generated: ${new Date().toLocaleString()}</p>
        </div>

        <div class="summary">
          <div class="metric">
            <h3>Total Revenue</h3>
            <p>KES ${financialData.summary.totalRevenue.toFixed(2)}</p>
          </div>
          <div class="metric">
            <h3>Total Wages</h3>
            <p>KES ${financialData.summary.totalWages.toFixed(2)}</p>
          </div>
          <div class="metric">
            <h3>Total Bonuses</h3>
            <p>KES ${financialData.summary.totalBonuses.toFixed(2)}</p>
          </div>
          <div class="metric">
            <h3>Net Profit</h3>
            <p>KES ${financialData.summary.netProfit.toFixed(2)}</p>
          </div>
        </div>

        <div class="comparison">
          <div class="location-section">
            <h2>TOWN</h2>
            <p><strong>Revenue:</strong> KES ${parseFloat(financialData.comparison.town.revenue?.monthly_revenue || 0).toFixed(2)}</p>
            <p><strong>Wages:</strong> KES ${parseFloat(financialData.comparison.town.wages?.total_net || 0).toFixed(2)}</p>
            <p><strong>Bonuses:</strong> KES ${parseFloat(financialData.comparison.town.bonuses?.total_bonuses || 0).toFixed(2)}</p>
            <p><strong>Deductions:</strong> KES ${parseFloat(financialData.comparison.town.deductions?.total_deductions || 0).toFixed(2)}</p>
          </div>
          <div class="location-section">
            <h2>NYALI</h2>
            <p><strong>Revenue:</strong> KES ${parseFloat(financialData.comparison.nyali.revenue?.monthly_revenue || 0).toFixed(2)}</p>
            <p><strong>Wages:</strong> KES ${parseFloat(financialData.comparison.nyali.wages?.total_net || 0).toFixed(2)}</p>
            <p><strong>Bonuses:</strong> KES ${parseFloat(financialData.comparison.nyali.bonuses?.total_bonuses || 0).toFixed(2)}</p>
            <p><strong>Deductions:</strong> KES ${parseFloat(financialData.comparison.nyali.deductions?.total_deductions || 0).toFixed(2)}</p>
          </div>
        </div>

        <div class="footer">
          <p>This is a system-generated financial report</p>
        </div>
      </body>
      </html>
    `;
    
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
  };

  // ============================================
  // RENDER FUNCTIONS
  // ============================================
  const renderContracts = () => (
    <div className="tab-content">
      <div className="tab-header">
        <h2>Contract Sign-offs</h2>
        <select value={contractFilter} onChange={(e) => setContractFilter(e.target.value)}>
          <option value="all">All Contracts</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {loading ? (
        <div className="loading">Loading contracts...</div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Contractor/Guard</th>
                <th>Contact</th>
                <th>Location/Site</th>
                <th>Status</th>
                <th>Forwarded</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {contracts.length === 0 ? (
                <tr>
                  <td colSpan="7" className="no-data">No contracts found</td>
                </tr>
              ) : (
                contracts.map((contract) => (
                  <tr key={contract.id}>
                    <td>
                      <span className={`badge badge-${contract.contract_type === 'Guard Application' ? 'info' : 'warning'}`}>
                        {contract.contract_type}
                      </span>
                    </td>
                    <td>{contract.contractor_name || contract.full_name}</td>
                    <td>{contract.contractor_email || contract.email}</td>
                    <td>{contract.site_location || contract.position}</td>
                    <td>
                      <span className={`badge badge-${contract.status === 'approved' ? 'success' : contract.status === 'rejected' ? 'danger' : 'warning'}`}>
                        {contract.status}
                      </span>
                    </td>
                    <td>{contract.forwarded_at ? new Date(contract.forwarded_at).toLocaleDateString() : 'N/A'}</td>
                    <td>
                      {contract.status === 'pending' && (
                        <div className="action-buttons">
                          <button
                            className="btn btn-success btn-sm"
                            onClick={() => handleContractAction(contract.id, 'approve')}
                          >
                            Approve
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleContractAction(contract.id, 'reject')}
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const renderPayrollSignOff = () => (
    <div className="tab-content">
      <div className="phase-badge phase-1">Phase 1: Payroll Calculation Sign-Off</div>
      <div className="tab-header">
        <h2>Payroll Sign-Off</h2>
        <p className="tab-description">Review and lock payroll calculations including daily rates (500/600 KES), Nyali +1000 KES bonuses, uniform deductions, and overtime. This only verifies calculations — treasury release is a separate step.</p>
        <div className="filter-group">
          <select value={payrollFilter} onChange={(e) => setPayrollFilter(e.target.value)}>
            <option value="pending_review">Pending Review (Awaiting Sign-Off)</option>
            <option value="signed_off">Signed Off</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="loading">Loading payroll summaries...</div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Run Date</th>
                <th>Period</th>
                <th>Location</th>
                <th>Guards</th>
                <th>Gross (KES)</th>
                <th>Deductions (KES)</th>
                <th>Net Payable (KES)</th>
                <th>Status</th>
                <th>Signed Off By</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {payrollRuns.length === 0 ? (
                <tr>
                  <td colSpan="10" className="no-data">No payroll runs found for sign-off</td>
                </tr>
              ) : (
                payrollRuns.map((run) => (
                  <tr key={run.id}>
                    <td>{run.run_date}</td>
                    <td>{run.period_start} to {run.period_end}</td>
                    <td>
                      <span className="badge badge-info">{run.location?.toUpperCase()}</span>
                    </td>
                    <td>{run.guard_count}</td>
                    <td>{parseFloat(run.total_gross_amount).toFixed(2)}</td>
                    <td>{parseFloat(run.total_deductions).toFixed(2)}</td>
                    <td><strong>{parseFloat(run.total_net_amount).toFixed(2)}</strong></td>
                    <td>
                      <span className={`badge badge-${run.status === 'signed_off' ? 'success' : run.status === 'cancelled' ? 'danger' : 'warning'}`}>
                        {run.status === 'signed_off' ? 'Signed Off' : run.status}
                      </span>
                    </td>
                    <td>{run.signed_off_by_name || '-'}</td>
                    <td>
                      <div className="action-buttons">
                        {run.status === 'pending_review' && (
                          <>
                            <button
                              className="btn btn-success btn-sm"
                              onClick={() => handlePayrollSignOff(run.id, 'approve')}
                              title="Sign off payroll calculations"
                            >
                              Sign Off
                            </button>
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => handlePayrollSignOff(run.id, 'reject')}
                              title="Reject payroll calculations"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => {
                            setSelectedPayroll(run);
                            printPayrollReceipt(run);
                          }}
                        >
                          Print
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const renderTreasuryDisbursement = () => (
    <div className="tab-content">
      <div className="phase-badge phase-2">Phase 2: Treasury Disbursement & Capital Release</div>
      <div className="tab-header">
        <h2>Treasury Disbursement</h2>
        <p className="tab-description">Authorize the release of capital funds for payroll runs that have been signed off. This step actually releases money — ensure calculations are verified first.</p>
        <div className="filter-group">
          <select value={treasuryFilter} onChange={(e) => setTreasuryFilter(e.target.value)}>
            <option value="pending_authorization">Pending Authorization</option>
            <option value="disbursed">Disbursed</option>
            <option value="processing">Processing</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
            <option value="all">All</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="loading">Loading treasury disbursements...</div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Payroll Period</th>
                <th>Location</th>
                <th>Amount (KES)</th>
                <th>Payment Method</th>
                <th>Reference</th>
                <th>Status</th>
                <th>Authorized By</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {disbursements.length === 0 ? (
                <tr>
                  <td colSpan="9" className="no-data">No treasury disbursements found</td>
                </tr>
              ) : (
                disbursements.map((disb) => (
                  <tr key={disb.id}>
                    <td>{disb.disbursement_date}</td>
                    <td>{disb.period_start} to {disb.period_end}</td>
                    <td>
                      <span className="badge badge-info">{disb.payroll_location?.toUpperCase()}</span>
                    </td>
                    <td><strong className="amount-kes">{parseFloat(disb.total_amount).toFixed(2)} KES</strong></td>
                    <td>{disb.payment_method?.toUpperCase() || '-'}</td>
                    <td>{disb.reference_number || '-'}</td>
                    <td>
                      <span className={`badge badge-${disb.status === 'disbursed' ? 'success' : disb.status === 'failed' || disb.status === 'cancelled' ? 'danger' : 'warning'}`}>
                        {disb.status === 'disbursed' ? 'Disbursed' : disb.status === 'pending_authorization' ? 'Pending Auth' : disb.status}
                      </span>
                    </td>
                    <td>{disb.authorized_by_name || '-'}</td>
                    <td>
                      <div className="action-buttons">
                        {disb.status === 'pending_authorization' && (
                          <>
                            <button
                              className="btn btn-success btn-sm"
                              onClick={() => setSelectedDisbursement(disb)}
                              title="Authorize fund release"
                            >
                              Authorize
                            </button>
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => handleTreasuryDisburse(disb.id, 'reject')}
                              title="Reject disbursement"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {disb.status === 'disbursed' && (
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => printDisbursementReceipt(disb)}
                            title="Print receipt"
                          >
                            Print
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Authorization Modal */}
      {selectedDisbursement && (
        <div className="modal-overlay" onClick={() => setSelectedDisbursement(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Authorize Treasury Disbursement</h3>
              <button className="modal-close" onClick={() => setSelectedDisbursement(null)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="disbursement-summary">
                <p><strong>Payroll Period:</strong> {selectedDisbursement.period_start} to {selectedDisbursement.period_end}</p>
                <p><strong>Location:</strong> {selectedDisbursement.payroll_location?.toUpperCase()}</p>
                <p><strong>Site:</strong> {selectedDisbursement.site_name || 'N/A'}</p>
                <p><strong>Guard Count:</strong> {selectedDisbursement.guard_count || 'N/A'}</p>
                <p className="total-amount"><strong>Total Amount to Disburse:</strong> KES {parseFloat(selectedDisbursement.total_amount).toFixed(2)}</p>
              </div>

              <div className="form-group">
                <label>Payment Method:</label>
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="mpesa">M-Pesa</option>
                  <option value="cash">Cash</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>

              <div className="form-group">
                <label>Reference Number (optional):</label>
                <input
                  type="text"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  placeholder="e.g., Bank transaction ID"
                />
              </div>

              <div className="form-group">
                <label>Notes (optional):</label>
                <textarea
                  value={treasuryNotes}
                  onChange={(e) => setTreasuryNotes(e.target.value)}
                  placeholder="Any additional notes for this disbursement"
                  rows="3"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedDisbursement(null)}>
                Cancel
              </button>
              <button
                className="btn btn-success"
                onClick={() => handleTreasuryDisburse(selectedDisbursement.id, 'authorize')}
              >
                Confirm & Release Funds
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderFinancialReports = () => (
    <div className="tab-content">
      <div className="tab-header">
        <h2>Site Financial Reports (Town vs Nyali)</h2>
        <div className="filter-group">
          <select value={reportPeriod} onChange={(e) => setReportPeriod(e.target.value)}>
            <option value="week">Last Week</option>
            <option value="month">Last Month</option>
            <option value="quarter">Last Quarter</option>
            <option value="year">Last Year</option>
          </select>
          <select value={reportLocation} onChange={(e) => setReportLocation(e.target.value)}>
            <option value="all">All Locations</option>
            <option value="town">Town</option>
            <option value="nyali">Nyali</option>
          </select>
          <button
            className="btn btn-primary"
            onClick={generateFinancialReport}
            disabled={generatingReport}
          >
            {generatingReport ? 'Generating...' : 'Generate Report'}
          </button>
          <button
            className="btn btn-secondary"
            onClick={printFinancialReport}
            disabled={!financialData}
          >
            Print Report
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading">Loading financial reports...</div>
      ) : financialData ? (
        <div className="financial-dashboard">
          <div className="summary-cards">
            <div className="summary-card">
              <h3>Total Revenue</h3>
              <p className="amount">KES {financialData.summary.totalRevenue.toFixed(2)}</p>
            </div>
            <div className="summary-card">
              <h3>Total Wages</h3>
              <p className="amount">KES {financialData.summary.totalWages.toFixed(2)}</p>
            </div>
            <div className="summary-card">
              <h3>Total Bonuses</h3>
              <p className="amount">KES {financialData.summary.totalBonuses.toFixed(2)}</p>
            </div>
            <div className="summary-card">
              <h3>Net Profit</h3>
              <p className="amount profit">KES {financialData.summary.netProfit.toFixed(2)}</p>
            </div>
          </div>

          <div className="comparison-section">
            <h3>Location Comparison</h3>
            <div className="comparison-cards">
              <div className="location-card town">
                <h4>TOWN</h4>
                <div className="metric">
                  <label>Revenue:</label>
                  <p>KES {parseFloat(financialData.comparison.town.revenue?.monthly_revenue || 0).toFixed(2)}</p>
                </div>
                <div className="metric">
                  <label>Wages:</label>
                  <p>KES {parseFloat(financialData.comparison.town.wages?.total_net || 0).toFixed(2)}</p>
                </div>
                <div className="metric">
                  <label>Bonuses:</label>
                  <p>KES {parseFloat(financialData.comparison.town.bonuses?.total_bonuses || 0).toFixed(2)}</p>
                </div>
                <div className="metric">
                  <label>Deductions:</label>
                  <p>KES {parseFloat(financialData.comparison.town.deductions?.total_deductions || 0).toFixed(2)}</p>
                </div>
              </div>

              <div className="location-card nyali">
                <h4>NYALI</h4>
                <div className="metric">
                  <label>Revenue:</label>
                  <p>KES {parseFloat(financialData.comparison.nyali.revenue?.monthly_revenue || 0).toFixed(2)}</p>
                </div>
                <div className="metric">
                  <label>Wages:</label>
                  <p>KES {parseFloat(financialData.comparison.nyali.wages?.total_net || 0).toFixed(2)}</p>
                </div>
                <div className="metric">
                  <label>Bonuses:</label>
                  <p>KES {parseFloat(financialData.comparison.nyali.bonuses?.total_bonuses || 0).toFixed(2)}</p>
                </div>
                <div className="metric">
                  <label>Deductions:</label>
                  <p>KES {parseFloat(financialData.comparison.nyali.deductions?.total_deductions || 0).toFixed(2)}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="breakdown-section">
            <h3>Payroll Breakdown</h3>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Location</th>
                    <th>Site</th>
                    <th>Guards</th>
                    <th>Gross (KES)</th>
                    <th>Deductions (KES)</th>
                    <th>Net (KES)</th>
                  </tr>
                </thead>
                <tbody>
                  {financialData.payrollBreakdown?.map((run) => (
                    <tr key={run.id}>
                      <td>{run.run_date}</td>
                      <td>{run.location?.toUpperCase()}</td>
                      <td>{run.site_name}</td>
                      <td>{run.guard_count}</td>
                      <td>{parseFloat(run.total_gross_amount).toFixed(2)}</td>
                      <td>{parseFloat(run.total_deductions).toFixed(2)}</td>
                      <td><strong>{parseFloat(run.total_net_amount).toFixed(2)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="no-data">No financial data available. Generate a report to view analytics.</div>
      )}
    </div>
  );

  return (
    <div className="director-portal">
      {notification && (
        <div className={`notification notification-${notification.type}`}>
          {notification.message}
        </div>
      )}

      <div className="portal-header">
        <h1>Director Portal</h1>
        <p>Final Authorization, Payroll Sign-Off, Treasury Disbursement & Financial Reporting</p>
      </div>

      <div className="workflow-steps">
        <div className={`workflow-step ${activeTab === 'contracts' ? 'active' : ''}`}>
          <span className="step-number">1</span>
          <span className="step-label">Contract Sign-Offs</span>
        </div>
        <div className="workflow-arrow">→</div>
        <div className={`workflow-step ${activeTab === 'payroll_signoff' ? 'active' : ''}`}>
          <span className="step-number">2</span>
          <span className="step-label">Payroll Sign-Off</span>
        </div>
        <div className="workflow-arrow">→</div>
        <div className={`workflow-step ${activeTab === 'treasury' ? 'active' : ''}`}>
          <span className="step-number">3</span>
          <span className="step-label">Treasury Disbursement</span>
        </div>
        <div className="workflow-arrow">→</div>
        <div className={`workflow-step ${activeTab === 'financial' ? 'active' : ''}`}>
          <span className="step-number">4</span>
          <span className="step-label">Financial Reports</span>
        </div>
        <div className="workflow-arrow">→</div>
        <div className={`workflow-step ${activeTab === 'schedules' ? 'active' : ''}`}>
          <span className="step-number">5</span>
          <span className="step-label">Company Schedules</span>
        </div>
      </div>

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'contracts' ? 'active' : ''}`}
          onClick={() => setActiveTab('contracts')}
        >
          Contract Sign-offs
        </button>
        <button
          className={`tab ${activeTab === 'payroll_signoff' ? 'active' : ''}`}
          onClick={() => setActiveTab('payroll_signoff')}
        >
          Payroll Sign-Off
        </button>
        <button
          className={`tab ${activeTab === 'treasury' ? 'active' : ''}`}
          onClick={() => setActiveTab('treasury')}
        >
          Treasury Disbursement
        </button>
        <button
          className={`tab ${activeTab === 'financial' ? 'active' : ''}`}
          onClick={() => setActiveTab('financial')}
        >
          Financial Reports
        </button>
        <button
          className={`tab ${activeTab === 'schedules' ? 'active' : ''}`}
          onClick={() => setActiveTab('schedules')}
        >
          Company Schedules
        </button>
      </div>

      <div className="tab-content-wrapper">
        {activeTab === 'contracts' && renderContracts()}
        {activeTab === 'payroll_signoff' && renderPayrollSignOff()}
        {activeTab === 'treasury' && renderTreasuryDisbursement()}
        {activeTab === 'financial' && renderFinancialReports()}
        {activeTab === 'schedules' && <SecretarySchedule readOnly={false} />}
      </div>
    </div>
  );
};

export default DirectorPortal;