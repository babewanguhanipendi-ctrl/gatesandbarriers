/**
 * ResponsiveTable Component
 * Automatically converts table rows to card layout on mobile screens.
 * Optimized for mobile access with touch-friendly tap targets.
 */

import { ChevronRight } from 'lucide-react'
import BrandLogo from './BrandLogo'

/**
 * MobileCard: renders a single row as a card on small screens.
 * @param {Object} row - The row data object
 * @param {Array} columns - Column definitions [{ key, label, render, hideOnMobile }]
 * @param {Function} onRowClick - Optional click handler for the card
 */
const MobileCard = ({ row, columns, onRowClick, rowIndex }) => {
  // Filter out columns hidden on mobile
  const visibleColumns = columns.filter(col => !col.hideOnMobile)

  return (
    <div
      className={`bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3 ${
        onRowClick ? 'cursor-pointer active:scale-[0.99] transition-transform' : ''
      }`}
      onClick={() => onRowClick && onRowClick(row)}
      role={onRowClick ? 'button' : undefined}
      tabIndex={onRowClick ? 0 : undefined}
      onKeyDown={onRowClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onRowClick(row) } : undefined}
    >
      {visibleColumns.map((col, i) => {
        // First column is the header/title
        if (i === 0) {
          return (
            <div key={col.key || i} className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                {col.render ? col.render(row) : <span className="font-semibold text-gray-900">{row[col.key]}</span>}
              </div>
              {onRowClick && <ChevronRight size={18} className="text-gray-300 ml-2 shrink-0" />}
            </div>
          )
        }

        const value = col.render ? col.render(row) : row[col.key]
        if (value === null || value === undefined || value === false) return null

        return (
          <div key={col.key || i} className="flex items-start justify-between gap-2">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider shrink-0 min-w-[70px]">
              {col.label}
            </span>
            <div className="text-sm text-gray-700 text-right flex-1 min-w-0">
              {value}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/**
 * ResponsiveTable - renders as a standard table on desktop,
 * and switches to a card-based layout on mobile screens.
 *
 * Usage:
 * <ResponsiveTable
 *   columns={[
 *     { key: 'name', label: 'Name', render: (row) => <strong>{row.name}</strong> },
 *     { key: 'status', label: 'Status', hideOnMobile: true },
 *   ]}
 *   rows={data}
 *   onRowClick={(row) => console.log(row)}
 *   emptyMessage="No records found"
 *   loading={false}
 * />
 */
const ResponsiveTable = ({
  columns = [],
  rows = [],
  onRowClick,
  emptyMessage = 'No data available',
  loading = false,
  loadingMessage = 'Loading...',
}) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-[#1a2a6c] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-400">{loadingMessage}</p>
        </div>
      </div>
    )
  }

  if (!rows || rows.length === 0) {
    return (
      <div className="text-center py-16 px-4">
        <BrandLogo className="w-16 h-16 rounded-2xl mx-auto mb-4 p-1.5" />
        <p className="text-gray-500 font-medium">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <>
      {/* Desktop Table View (hidden on mobile) */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {columns.map((col, i) => (
                <th
                  key={col.key || i}
                  className={`px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider ${
                    i === columns.length - 1 ? 'text-right' : ''
                  }`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.map((row, index) => (
              <tr
                key={row.id || index}
                className={`hover:bg-gray-50 transition-colors ${
                  onRowClick ? 'cursor-pointer' : ''
                }`}
                onClick={() => onRowClick && onRowClick(row)}
                role={onRowClick ? 'button' : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                onKeyDown={onRowClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onRowClick(row) } : undefined}
              >
                {columns.map((col, j) => (
                  <td key={col.key || j} className={`px-4 py-3 ${j === columns.length - 1 ? 'text-right' : ''}`}>
                    {col.render ? col.render(row) : (
                      <span className="text-sm text-gray-700">{row[col.key]}</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View (hidden on desktop) */}
      <div className="md:hidden space-y-3">
        {rows.map((row, index) => (
          <MobileCard
            key={row.id || index}
            row={row}
            columns={columns}
            onRowClick={onRowClick}
            rowIndex={index}
          />
        ))}
      </div>
    </>
  )
}

export default ResponsiveTable


