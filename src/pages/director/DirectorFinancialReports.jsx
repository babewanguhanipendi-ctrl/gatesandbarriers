import { useState, useEffect, useRef } from 'react'
import { directorAPI } from '../../services/api'
import { DollarSign, TrendingUp, TrendingDown, Calendar, MapPin, Download, Printer, RefreshCw, Users, Award, Activity, BarChart3, Clock } from 'lucide-react'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

const DirectorFinancialReports = () => {
  const [financialData, setFinancialData] = useState(null)
  const [analytics, setAnalytics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [reportPeriod, setReportPeriod] = useState('month')
  const [reportLocation, setReportLocation] = useState('all')
  const [error, setError] = useState(null)
  const [generatingPDF, setGeneratingPDF] = useState(false)
  const [pdfError, setPDFError] = useState(null)
  const reportRef = useRef(null)

  useEffect(() => {
    fetchData()
  }, [reportPeriod, reportLocation])

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [reportsData, analyticsData] = await Promise.all([
        directorAPI.getFinancialReports({
          period: reportPeriod,
          location: reportLocation
        }),
        directorAPI.getAnalytics(reportPeriod)
      ])
      setFinancialData(reportsData)
      setAnalytics(analyticsData)
    } catch (error) {
      console.error('Error fetching data:', error)
      setError(error.message || 'Failed to load financial data')
    } finally {
      setLoading(false)
    }
  }

  const generateReport = async () => {
    try {
      setGenerating(true)
      const endDate = new Date().toISOString().split('T')[0]
      const startDate = new Date()
      
      // Calculate start date based on period
      switch (reportPeriod) {
        case 'week':
          startDate.setDate(startDate.getDate() - 7)
          break
        case 'month':
          startDate.setMonth(startDate.getMonth() - 1)
          break
        case 'quarter':
          startDate.setMonth(startDate.getMonth() - 3)
          break
        case 'year':
          startDate.setFullYear(startDate.getFullYear() - 1)
          break
      }

      await directorAPI.generateFinancialReport({
        report_type: reportPeriod,
        period_start: startDate.toISOString().split('T')[0],
        period_end: endDate,
        location: reportLocation
      })

      alert('Financial report generated successfully')
      fetchData()
    } catch (error) {
      console.error('Error generating report:', error)
      alert(error.response?.data?.error || 'Failed to generate report')
    } finally {
      setGenerating(false)
    }
  }

  const generatePDF = async () => {
    try {
      setGeneratingPDF(true)
      setPDFError(null)

      if (!reportRef.current) {
        throw new Error('Report container not found')
      }

      const element = reportRef.current
      
      // Use html2canvas to capture the element
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      })

      // Calculate dimensions
      const imgData = canvas.toDataURL('image/png')
      const imgWidth = 210 // A4 width in mm
      const pageHeight = 297 // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      
      // Create PDF
      const pdf = new jsPDF('p', 'mm', 'a4')
      let heightLeft = imgHeight
      let position = 0

      // Add first page
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight

      // Add additional pages if needed
      while (heightLeft > 0) {
        position = heightLeft - imgHeight
        pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
      }

      // Generate filename with period and location
      const periodLabel = reportPeriod.charAt(0).toUpperCase() + reportPeriod.slice(1)
      const locationLabel = reportLocation === 'all' ? 'All-Locations' : reportLocation.charAt(0).toUpperCase() + reportLocation.slice(1)
      const timestamp = new Date().toISOString().split('T')[0]
      const filename = `Financial-Report-${periodLabel}-${locationLabel}-${timestamp}.pdf`

      // Save the PDF
      pdf.save(filename)
      
      alert('PDF report generated successfully!')
    } catch (error) {
      console.error('Error generating PDF:', error)
      setPDFError(error.message || 'Failed to generate PDF')
      alert('Failed to generate PDF. Please try again.')
    } finally {
      setGeneratingPDF(false)
    }
  }

  const printReport = () => {
    window.print()
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount || 0)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#1a2a6c] border-t-transparent rounded-full animate-spin" />
          <div className="text-lg text-gray-600">Loading financial reports & analytics...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-4 max-w-md">
          <div className="text-red-600 text-center">
            <p className="text-xl font-semibold mb-2">Unable to load data</p>
            <p className="text-sm text-gray-600 mb-4">{error}</p>
          </div>
          <button
            onClick={fetchData}
            className="px-4 py-2 bg-[#1a2a6c] text-white rounded-lg hover:bg-[#1a2a6c]/90"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  const summary = analytics?.summary || financialData?.summary || {}

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Financial Reports & Analytics</h1>
          <p className="text-gray-600 mt-1">Comprehensive financial insights and analytics dashboard</p>
        </div>
        <div className="flex items-center gap-2 bg-white rounded-lg border border-gray-200 p-1">
          {['week', 'month', 'quarter', 'year'].map((p) => (
            <button
              key={p}
              onClick={() => setReportPeriod(p)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                reportPeriod === p
                  ? 'bg-[#1a2a6c] text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <MapPin size={18} className="text-gray-500" />
            <label className="text-sm font-medium text-gray-700">Location:</label>
            <select
              value={reportLocation}
              onChange={(e) => setReportLocation(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#1a2a6c] focus:border-transparent"
            >
              <option value="all">All Locations</option>
              <option value="town">Town</option>
              <option value="nyali">Nyali</option>
            </select>
          </div>
          <div className="flex gap-3 ml-auto">
            <button
              onClick={generateReport}
              disabled={generating}
              className="px-4 py-2 bg-[#1a2a6c] text-white rounded-lg hover:bg-[#1a2a6c]/90 flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw size={18} className={generating ? 'animate-spin' : ''} />
              {generating ? 'Generating...' : 'Generate Report'}
            </button>
            <button
              onClick={generatePDF}
              disabled={generatingPDF || (!financialData && !analytics)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 disabled:opacity-50"
            >
              <Download size={18} className={generatingPDF ? 'animate-spin' : ''} />
              {generatingPDF ? 'Generating PDF...' : 'Download PDF'}
            </button>
            <button
              onClick={printReport}
              disabled={!financialData && !analytics}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50"
            >
              <Printer size={18} />
              Print Report
            </button>
          </div>
        </div>
        {pdfError && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {pdfError}
          </div>
        )}
      </div>

      {/* Report Content - Printable Area */}
      <div ref={reportRef} id="financial-report-print-container">
        {/* Financial Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl shadow-lg p-6 text-white">
            <div className="flex items-center justify-between mb-2">
              <TrendingDown size={24} />
              <span className="text-sm font-medium opacity-90">Total Wages</span>
            </div>
            <p className="text-3xl font-bold">KES {formatCurrency(summary.totalWages)}</p>
          </div>

          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp size={24} />
              <span className="text-sm font-medium opacity-90">Total Bonuses</span>
            </div>
            <p className="text-3xl font-bold">KES {formatCurrency(summary.totalBonuses)}</p>
          </div>

          <div className={`bg-gradient-to-br ${summary.netProfit >= 0 ? 'from-purple-500 to-purple-600' : 'from-orange-500 to-orange-600'} rounded-xl shadow-lg p-6 text-white`}>
            <div className="flex items-center justify-between mb-2">
              <DollarSign size={24} />
              <span className="text-sm font-medium opacity-90">Net Profit</span>
            </div>
            <p className="text-3xl font-bold">KES {formatCurrency(summary.netProfit)}</p>
          </div>
        </div>

        {/* Location Comparison */}
        {financialData?.comparison && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Town */}
            <div className="bg-white rounded-xl shadow-sm border-2 border-blue-200 p-6">
              <h3 className="text-xl font-bold text-blue-600 mb-4 pb-2 border-b-2 border-blue-600">
                TOWN LOCATION
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm text-gray-600">Revenue</p>
                    <p className="text-xs text-gray-500">Monthly site revenue</p>
                  </div>
                  <p className="text-xl font-bold text-gray-900">
                    KES {formatCurrency(financialData.comparison?.town?.revenue?.monthly_revenue)}
                  </p>
                </div>
                <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm text-gray-600">Wages</p>
                    <p className="text-xs text-gray-500">Total net payroll</p>
                  </div>
                  <p className="text-xl font-bold text-gray-900">
                    KES {formatCurrency(financialData.comparison?.town?.wages?.total_net)}
                  </p>
                </div>
                <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm text-gray-600">Bonuses</p>
                    <p className="text-xs text-gray-500">Nyali +1000 KES monthly</p>
                  </div>
                  <p className="text-xl font-bold text-gray-900">
                    KES {formatCurrency(financialData.comparison?.town?.bonuses?.total_bonuses)}
                  </p>
                </div>
                <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm text-gray-600">Deductions</p>
                    <p className="text-xs text-gray-500">Uniform & motor gear</p>
                  </div>
                  <p className="text-xl font-bold text-red-600">
                    KES {formatCurrency(financialData.comparison?.town?.deductions?.total_deductions)}
                  </p>
                </div>
              </div>
            </div>

            {/* Nyali */}
            <div className="bg-white rounded-xl shadow-sm border-2 border-orange-200 p-6">
              <h3 className="text-xl font-bold text-orange-600 mb-4 pb-2 border-b-2 border-orange-600">
                NYALI LOCATION
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm text-gray-600">Revenue</p>
                    <p className="text-xs text-gray-500">Monthly site revenue</p>
                  </div>
                  <p className="text-xl font-bold text-gray-900">
                    KES {formatCurrency(financialData.comparison?.nyali?.revenue?.monthly_revenue)}
                  </p>
                </div>
                <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm text-gray-600">Wages</p>
                    <p className="text-xs text-gray-500">Total net payroll (254/300 KES rates)</p>
                  </div>
                  <p className="text-xl font-bold text-gray-900">
                    KES {formatCurrency(financialData.comparison?.nyali?.wages?.total_net)}
                  </p>
                </div>
                <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm text-gray-600">Bonuses</p>
                    <p className="text-xs text-gray-500">Nyali +1000 KES monthly bonus</p>
                  </div>
                  <p className="text-xl font-bold text-gray-900">
                    KES {formatCurrency(financialData.comparison?.nyali?.bonuses?.total_bonuses)}
                  </p>
                </div>
                <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm text-gray-600">Deductions</p>
                    <p className="text-xs text-gray-500">Uniform & motor gear</p>
                  </div>
                  <p className="text-xl font-bold text-red-600">
                    KES {formatCurrency(financialData.comparison?.nyali?.deductions?.total_deductions)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Revenue Trends by Location */}
        {analytics?.revenueTrends && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <DollarSign className="w-6 h-6 text-green-600" />
              Revenue Trends by Location
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {analytics.revenueTrends.map((location, idx) => (
                <div key={idx} className={`border-2 rounded-lg p-6 ${location.location === 'town' ? 'border-blue-200 bg-blue-50' : 'border-orange-200 bg-orange-50'}`}>
                  <h3 className="text-lg font-bold mb-4" style={{color: location.location === 'town' ? '#2563eb' : '#ea5800'}}>
                    {location.location?.toUpperCase()}
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Active Sites:</span>
                      <span className="font-bold">{location.active_sites || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Daily Revenue:</span>
                      <span className="font-bold">KES {formatCurrency(location.daily_revenue)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Monthly Revenue:</span>
                      <span className="font-bold text-lg">KES {formatCurrency(location.monthly_revenue)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Wage Bill Analysis */}
        {analytics?.wageBill && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <TrendingDown className="w-6 h-6 text-red-600" />
              Wage Bill Analysis
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {analytics.wageBill.map((location, idx) => (
                <div key={idx} className={`border-2 rounded-lg p-6 ${location.location === 'town' ? 'border-blue-200 bg-blue-50' : 'border-orange-200 bg-orange-50'}`}>
                  <h3 className="text-lg font-bold mb-4" style={{color: location.location === 'town' ? '#2563eb' : '#ea5800'}}>
                    {location.location?.toUpperCase()}
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Payroll Runs:</span>
                      <span className="font-bold">{location.payroll_runs || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Guards Paid:</span>
                      <span className="font-bold">{location.guard_count || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Avg Daily Rate:</span>
                      <span className="font-bold">KES {formatCurrency(location.avg_daily_rate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Gross:</span>
                      <span className="font-bold">KES {formatCurrency(location.total_gross)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Bonuses:</span>
                      <span className="font-bold text-green-600">KES {formatCurrency(location.total_bonuses)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Deductions:</span>
                      <span className="font-bold text-red-600">KES {formatCurrency(location.total_deductions)}</span>
                    </div>
                    <div className="flex justify-between border-t-2 pt-2">
                      <span className="text-gray-800 font-semibold">Net Paid:</span>
                      <span className="font-bold text-lg">KES {formatCurrency(location.total_net)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Client Retention & Acquisition */}
        {analytics?.summary && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Users className="w-6 h-6 text-purple-600" />
              Client Retention & Acquisition
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="text-center p-6 bg-purple-50 rounded-lg">
                <p className="text-4xl font-bold text-purple-600">{summary.activeClients || 0}</p>
                <p className="text-sm text-gray-600 mt-2">Active Clients</p>
              </div>
              <div className="text-center p-6 bg-green-50 rounded-lg">
                <p className="text-4xl font-bold text-green-600">{summary.newClients || 0}</p>
                <p className="text-sm text-gray-600 mt-2">New This Period</p>
              </div>
              <div className="text-center p-6 bg-red-50 rounded-lg">
                <p className="text-4xl font-bold text-red-600">{summary.lostClients || 0}</p>
                <p className="text-sm text-gray-600 mt-2">Lost This Period</p>
              </div>
              <div className="text-center p-6 bg-blue-50 rounded-lg">
                <p className="text-4xl font-bold text-blue-600">{summary.retentionRate || 0}%</p>
                <p className="text-sm text-gray-600 mt-2">Retention Rate</p>
              </div>
            </div>
          </div>
        )}

        {/* Recruitment Metrics */}
        {analytics?.summary && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Award className="w-6 h-6 text-orange-600" />
              Recruitment Metrics
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <p className="text-3xl font-bold text-orange-600">{summary.totalApplications || 0}</p>
                <p className="text-sm text-gray-600 mt-1">Total Applications</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-3xl font-bold text-green-600">{summary.totalHired || 0}</p>
                <p className="text-sm text-gray-600 mt-1">Hired</p>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <p className="text-3xl font-bold text-red-600">{summary.totalRejected || 0}</p>
                <p className="text-sm text-gray-600 mt-1">Rejected</p>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <p className="text-3xl font-bold text-yellow-600">{summary.totalPending || 0}</p>
                <p className="text-sm text-gray-600 mt-1">Pending</p>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-3xl font-bold text-blue-600">
                  {summary.totalApplications > 0
                    ? Math.round((summary.totalHired / summary.totalApplications) * 100)
                    : 0}%
                </p>
                <p className="text-sm text-gray-600 mt-1">Conversion Rate</p>
              </div>
            </div>
          </div>
        )}

        {/* Site Security Trends */}
        {analytics?.summary && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Activity className="w-6 h-6 text-red-600" />
              Site Security Trends
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <p className="text-3xl font-bold text-red-600">{summary.totalIncidents || 0}</p>
                <p className="text-sm text-gray-600 mt-1">Total Incidents</p>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <p className="text-3xl font-bold text-yellow-600">{summary.pendingIncidents || 0}</p>
                <p className="text-sm text-gray-600 mt-1">Pending</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-3xl font-bold text-green-600">{summary.resolvedIncidents || 0}</p>
                <p className="text-sm text-gray-600 mt-1">Resolved</p>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-3xl font-bold text-blue-600">{summary.resolutionRate || 0}%</p>
                <p className="text-sm text-gray-600 mt-1">Resolution Rate</p>
              </div>
            </div>
          </div>
        )}

        {/* Payroll Trends */}
        {analytics?.payrollTrends && analytics.payrollTrends.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Calendar className="w-6 h-6 text-indigo-600" />
              Payroll Trends by Location
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Month</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Runs</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Guards</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Gross (KES)</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Deductions (KES)</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Net (KES)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {analytics.payrollTrends.map((trend, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm">
                        {new Date(trend.month).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs font-medium rounded ${
                          trend.location === 'town' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'
                        }`}>
                          {trend.location?.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-right">{trend.payroll_runs || 0}</td>
                      <td className="px-4 py-3 text-sm text-right">{trend.total_guards || 0}</td>
                      <td className="px-4 py-3 text-sm text-right">{formatCurrency(trend.total_gross)}</td>
                      <td className="px-4 py-3 text-sm text-right text-red-600">{formatCurrency(trend.total_deductions)}</td>
                      <td className="px-4 py-3 text-sm text-right font-semibold text-green-600">{formatCurrency(trend.total_net)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Payroll Breakdown */}
        {financialData?.payrollBreakdown && financialData.payrollBreakdown.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Payroll Breakdown</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Site</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Guards</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Gross (KES)</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Deductions (KES)</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Net (KES)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {financialData.payrollBreakdown.map((run) => (
                    <tr key={run.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm">{run.run_date}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs font-medium rounded ${
                          run.location === 'town' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'
                        }`}>
                          {run.location?.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">{run.site_name}</td>
                      <td className="px-4 py-3 text-sm text-right">{run.guard_count}</td>
                      <td className="px-4 py-3 text-sm text-right">{formatCurrency(run.total_gross_amount)}</td>
                      <td className="px-4 py-3 text-sm text-right text-red-600">{formatCurrency(run.total_deductions)}</td>
                      <td className="px-4 py-3 text-sm text-right font-semibold text-green-600">{formatCurrency(run.total_net_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {!financialData && !analytics && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <DollarSign size={48} className="text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No financial data available</p>
          <p className="text-sm text-gray-500 mt-2">Click "Generate Report" to create a new financial report</p>
        </div>
      )}
    </div>
  )
}

export default DirectorFinancialReports