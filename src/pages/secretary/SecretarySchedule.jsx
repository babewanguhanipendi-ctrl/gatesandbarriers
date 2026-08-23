import React, { useState, useEffect } from 'react';
import { directorAPI, secretaryAPI } from '../../services/api';
import ConfirmModal from '../../components/ConfirmModal';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  MapPin, 
  Plus, 
  Edit2, 
  Trash2, 
  X,
  Filter,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

const SecretarySchedule = ({ readOnly = false, api = null }) => {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [scheduleToDelete, setScheduleToDelete] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterEventType, setFilterEventType] = useState('all');

  // Calendar navigation state
  const [currentDate, setCurrentDate] = useState(new Date());

  // Determine which API to use
  const scheduleAPI = api || (readOnly ? secretaryAPI : directorAPI);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    event_date: '',
    start_time: '',
    end_time: '',
    venue: '',
    event_type: 'meeting',
    priority: 'medium',
    target_audience: 'all',
    notify_all: false,
    notes: ''
  });

  useEffect(() => {
    fetchSchedules();
  }, [filterStatus, filterEventType]);

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const parseSchedulesResponse = (response) => {
    if (response && response.data && Array.isArray(response.data.schedules)) {
      return response.data.schedules;
    } else if (Array.isArray(response.data)) {
      return response.data;
    } else if (response && response.schedules) {
      return response.schedules;
    }
    console.warn('Unexpected response format:', response);
    return [];
  };

  const fetchSchedules = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterStatus !== 'all') params.status = filterStatus;
      if (filterEventType !== 'all') params.event_type = filterEventType;

      const response = await scheduleAPI.getSchedules(params);
      setSchedules(parseSchedulesResponse(response));
    } catch (error) {
      console.error('Fetch schedules error:', error);
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  };

  // Convert "HH:MM(:SS)" time strings to minutes for reliable comparisons
  const toMinutes = (time) => {
    const [h, m] = String(time || '').slice(0, 5).split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  // Returns an existing schedule that would run concurrently with the given time range
  const findTimeConflict = (dateStr, startTime, endTime, excludeId = null) => {
    const newStart = toMinutes(startTime);
    const newEnd = toMinutes(endTime);
    return schedules.find(schedule => {
      if (excludeId && schedule.id === excludeId) return false;
      if (schedule.event_date !== dateStr) return false;
      if (['cancelled', 'postponed'].includes(schedule.status)) return false;
      const existingStart = toMinutes(schedule.start_time);
      const existingEnd = toMinutes(schedule.end_time);
      // Overlap: existing starts before new ends AND existing ends after new starts
      return existingStart < newEnd && existingEnd > newStart;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate time range
    if (toMinutes(formData.end_time) <= toMinutes(formData.start_time)) {
      showNotification('End time must be after start time', 'error');
      return;
    }

    // Prevent scheduling concurrent meetings on the same date
    const conflict = findTimeConflict(
      formData.event_date,
      formData.start_time,
      formData.end_time,
      editingSchedule ? editingSchedule.id : null
    );
    if (conflict) {
      showNotification(
        `Time conflict: "${conflict.title}" is already scheduled from ${String(conflict.start_time).slice(0, 5)} to ${String(conflict.end_time).slice(0, 5)} on this date. No two meetings can run concurrently.`,
        'error'
      );
      return;
    }

    setLoading(true);

    try {
      if (editingSchedule) {
        const response = await scheduleAPI.updateSchedule(editingSchedule.id, formData);
        if (response && response.data) {
          showNotification('Schedule updated successfully');
          setEditingSchedule(null);
        }
      } else {
        const response = await scheduleAPI.createSchedule(formData);
        if (response && response.data) {
          showNotification('Schedule created successfully');
        }
      }

      setShowModal(false);
      resetForm();
      fetchSchedules();
    } catch (error) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to save schedule';
      showNotification(errorMessage, 'error');
      console.error('Save schedule error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (schedule) => {
    setEditingSchedule(schedule);
    setFormData({
      title: schedule.title,
      description: schedule.description || '',
      event_date: schedule.event_date,
      start_time: schedule.start_time,
      end_time: schedule.end_time,
      venue: schedule.venue,
      event_type: schedule.event_type,
      priority: schedule.priority,
      target_audience: schedule.target_audience || 'all',
      notify_all: schedule.notify_all || false,
      notes: schedule.notes || '',
      status: schedule.status || 'scheduled'
    });
    setShowDetailModal(false);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    setScheduleToDelete(id);
  };

  const confirmDelete = async () => {
    if (!scheduleToDelete) return;

    try {
      const response = await scheduleAPI.deleteSchedule(scheduleToDelete);
      if (response && response.data) {
        showNotification('Schedule deleted successfully');
        setShowDetailModal(false);
        fetchSchedules();
      }
    } catch (error) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to delete schedule';
      showNotification(errorMessage, 'error');
      console.error('Delete schedule error:', error);
    } finally {
      setScheduleToDelete(null);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      event_date: '',
      start_time: '',
      end_time: '',
      venue: '',
      event_type: 'meeting',
      priority: 'medium',
      target_audience: 'all',
      notify_all: false,
      notes: ''
    });
    setEditingSchedule(null);
  };

  const openAddModal = (dateStr = '') => {
    resetForm();
    if (dateStr) {
      setFormData(prev => ({ ...prev, event_date: dateStr }));
    }
    setShowModal(true);
  };

  const getPriorityBadge = (priority) => {
    const colors = {
      low: 'badge-info',
      medium: 'badge-warning',
      high: 'badge-warning',
      critical: 'badge-danger'
    };
    return colors[priority] || 'badge-warning';
  };

  const getStatusBadge = (status) => {
    const colors = {
      scheduled: 'badge-info',
      completed: 'badge-success',
      cancelled: 'badge-danger',
      postponed: 'badge-warning'
    };
    return colors[status] || 'badge-warning';
  };

  const getEventTypeLabel = (type) => {
    const labels = {
      meeting: 'Meeting',
      training: 'Training',
      event: 'Event',
      deadline: 'Deadline',
      other: 'Other'
    };
    return labels[type] || type;
  };

  // Calendar Helper Logic
  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const currentMonthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  // Generate matrix for days of the month grid
  const generateCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    
    const days = [];
    
    // Padding for previous month trailing days
    const prevMonthTotalDays = new Date(year, month, 0).getDate();
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = prevMonthTotalDays - i;
      const d = new Date(year, month - 1, dayNum);
      days.push({ date: d, isCurrentMonth: false });
    }

    // Current month days
    for (let i = 1; i <= totalDays; i++) {
      const d = new Date(year, month, i);
      days.push({ date: d, isCurrentMonth: true });
    }

    // Padding for next month leading days to complete full grid rows (up to 42 cells)
    const remainingCells = 42 - days.length;
    for (let i = 1; i <= remainingCells; i++) {
      const d = new Date(year, month + 1, i);
      days.push({ date: d, isCurrentMonth: false });
    }

    return days;
  };

  const calendarDays = generateCalendarDays();

  // Format a Date object as YYYY-MM-DD (local timezone)
  const formatDateStr = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Map schedules to YYYY-MM-DD string lookup for clean rendering
  const getEventsForDate = (dateObj) => {
    return schedules.filter(schedule => schedule.event_date === formatDateStr(dateObj));
  };

  // Click handler for any day cell (empty or with events).
  // Fetches the latest schedules first: if the date already has scheduled
  // meeting(s), they are displayed instead of scheduling another meeting.
  const handleCalendarCellClick = async (cellDate) => {
    const dateStr = formatDateStr(cellDate);
    let dayEvents = getEventsForDate(cellDate);

    try {
      const params = {};
      if (filterStatus !== 'all') params.status = filterStatus;
      if (filterEventType !== 'all') params.event_type = filterEventType;

      const response = await scheduleAPI.getSchedules(params);
      const fetched = parseSchedulesResponse(response);
      setSchedules(fetched);
      dayEvents = fetched.filter(schedule => schedule.event_date === dateStr);
    } catch (error) {
      console.error('Refresh schedules error:', error);
    }

    if (dayEvents && dayEvents.length > 0) {
      // Date already has scheduled meeting(s): show them instead of creating another
      setSelectedEvent(dayEvents[0]);
      setShowDetailModal(true);
    } else if (!readOnly) {
      // No events on this date: open the add modal with the date pre-filled
      openAddModal(dateStr);
    }
  };

  // All events scheduled on the currently selected event's date
  const selectedDayEvents = selectedEvent
    ? schedules.filter(s => s.event_date === selectedEvent.event_date)
    : [];

  return (
    <div className="min-h-screen bg-gray-50">
      <ConfirmModal
        isOpen={scheduleToDelete !== null}
        onClose={() => setScheduleToDelete(null)}
        onConfirm={confirmDelete}
        title="Delete Schedule"
        message="Are you sure you want to delete this schedule?"
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Company Schedules</h1>
              <p className="text-gray-600 mt-1">
                {readOnly ? 'View company-wide schedules and events' : 'Manage company-wide schedules, meetings, and events'}
              </p>
            </div>
            {!readOnly && (
              <button
                className="btn btn-primary flex items-center gap-2"
                onClick={() => openAddModal()}
              >
                <Plus className="w-5 h-5" />
                Add Schedule
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters and Controls */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Filter className="w-5 h-5 text-gray-600" />
            <div className="flex flex-wrap gap-4">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="form-select"
              >
                <option value="all">All Statuses</option>
                <option value="scheduled">Scheduled</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
                <option value="postponed">Postponed</option>
              </select>

              <select
                value={filterEventType}
                onChange={(e) => setFilterEventType(e.target.value)}
                className="form-select"
              >
                <option value="all">All Event Types</option>
                <option value="meeting">Meeting</option>
                <option value="training">Training</option>
                <option value="event">Event</option>
                <option value="deadline">Deadline</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          {/* Month Navigation */}
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-800 min-w-[180px] text-center">{currentMonthName}</h2>
            <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
              <button onClick={prevMonth} className="p-2 hover:bg-gray-100 text-gray-600 transition-colors" title="Previous Month">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button onClick={() => setCurrentDate(new Date())} className="px-3 py-1 text-sm font-medium text-gray-600 hover:bg-gray-100 border-x border-gray-200 transition-colors">
                Today
              </button>
              <button onClick={nextMonth} className="p-2 hover:bg-gray-100 text-gray-600 transition-colors" title="Next Month">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Google Calendar Grid View */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-16 text-center flex flex-col items-center justify-center gap-4">
              <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              <div className="text-gray-600">Loading calendar schedules...</div>
            </div>
          ) : (
            <div>
              {/* Day headers */}
              <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider py-3">
                <div>Sun</div>
                <div>Mon</div>
                <div>Tue</div>
                <div>Wed</div>
                <div>Thu</div>
                <div>Fri</div>
                <div>Sat</div>
              </div>

              {/* Grid cells */}
              <div className="grid grid-cols-7 auto-rows-fr bg-gray-200 gap-px">
                {calendarDays.map((cell, index) => {
                  const dayEvents = getEventsForDate(cell.date);
                  const isToday = new Date().toDateString() === cell.date.toDateString();
                  const hasEvents = dayEvents.length > 0;

                  return (
                    <div 
                      key={index} 
                      onClick={() => handleCalendarCellClick(cell.date)}
                      className={`bg-white min-h-[120px] p-2 flex flex-col transition-colors relative group cursor-pointer ${
                        cell.isCurrentMonth ? 'bg-white hover:bg-gray-50/80' : 'bg-gray-50 text-gray-400 hover:bg-gray-100/50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-sm font-medium h-7 w-7 flex items-center justify-center rounded-full ${
                          isToday ? 'bg-primary text-white font-bold' : cell.isCurrentMonth ? 'text-gray-700' : 'text-gray-400'
                        }`}>
                          {cell.date.getDate()}
                        </span>
                        {!readOnly && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              openAddModal(formatDateStr(cell.date));
                            }}
                            className={`p-1 text-gray-400 hover:text-primary transition-opacity ${
                              hasEvents ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                            }`}
                            title={hasEvents ? 'Add another schedule on this date' : 'Add schedule on this date'}
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {/* Events List inside Day Cell */}
                      <div className="flex-1 flex flex-col gap-1 overflow-y-auto max-h-[90px] pr-1">
                        {dayEvents.map((event) => (
                          <div
                            key={event.id}
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              setSelectedEvent(event); 
                              setShowDetailModal(true); 
                            }}
                            className={`text-xs px-2 py-1 rounded-md truncate cursor-pointer transition-all shadow-xs border-l-4 ${
                              event.priority === 'critical' ? 'bg-red-50 text-red-700 border-red-500 hover:bg-red-100' :
                              event.priority === 'high' ? 'bg-amber-50 text-amber-700 border-amber-500 hover:bg-amber-100' :
                              'bg-blue-50 text-blue-700 border-blue-500 hover:bg-blue-100'
                            }`}
                            title={`${event.start_time} - ${event.title}`}
                          >
                            <span className="font-semibold">{event.start_time}</span> {event.title}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Event Details Popup Modal */}
      {showDetailModal && selectedEvent && (
        <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className={`badge ${getStatusBadge(selectedEvent.status)} text-xs`}>
                {selectedEvent.status}
              </span>
              <button className="modal-close" onClick={() => setShowDetailModal(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="modal-body space-y-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900">{selectedEvent.title}</h3>
                {selectedEvent.description && (
                  <p className="text-gray-600 mt-1 text-sm">{selectedEvent.description}</p>
                )}
              </div>

              {/* Switch between multiple events already scheduled on this date */}
              {selectedDayEvents.length > 1 && (
                <div className="border border-gray-200 rounded-lg p-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    {selectedDayEvents.length} events scheduled on this date
                  </p>
                  <div className="flex flex-col gap-1 max-h-32 overflow-y-auto">
                    {selectedDayEvents.map(ev => (
                      <button
                        key={ev.id}
                        onClick={() => setSelectedEvent(ev)}
                        className={`text-left text-xs px-2 py-1.5 rounded-md border-l-4 transition-colors ${
                          ev.id === selectedEvent.id
                            ? 'bg-blue-50 text-gray-900 border-blue-500 font-semibold'
                            : 'bg-gray-50 text-gray-600 border-gray-300 hover:bg-gray-100'
                        }`}
                      >
                        <span className="font-semibold">{String(ev.start_time).slice(0, 5)}</span> — {ev.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-gray-400" />
                  <span>{selectedEvent.event_date}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span>{selectedEvent.start_time} - {selectedEvent.end_time}</span>
                </div>
                <div className="flex items-center gap-2 col-span-2">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  <span>{selectedEvent.venue}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <span className="badge badge-info text-xs">{getEventTypeLabel(selectedEvent.event_type)}</span>
                <span className={`badge ${getPriorityBadge(selectedEvent.priority)} text-xs`}>Priority: {selectedEvent.priority}</span>
                <span className="badge badge-secondary text-xs">Audience: {selectedEvent.target_audience || 'all'}</span>
              </div>

              {selectedEvent.notes && (
                <div className="text-xs text-gray-500 bg-yellow-50 border border-yellow-100 p-2.5 rounded-md">
                  <span className="font-semibold block text-yellow-800 mb-0.5">Notes:</span>
                  {selectedEvent.notes}
                </div>
              )}
            </div>
            
            <div className="modal-footer flex justify-between items-center">
              <div>
                {!readOnly && (
                  <div className="flex gap-2">
                    <button
                      className="btn btn-secondary btn-sm flex items-center gap-1"
                      onClick={() => {
                        setShowDetailModal(false);
                        openAddModal(selectedEvent.event_date);
                      }}
                      title="Add another event on this date"
                    >
                      <Plus className="w-4 h-4" /> Add Event
                    </button>
                    <button
                      className="btn btn-primary btn-sm flex items-center gap-1"
                      onClick={() => handleEdit(selectedEvent)}
                    >
                      <Edit2 className="w-4 h-4" /> Edit
                    </button>
                    <button
                      className="btn btn-danger btn-sm flex items-center gap-1"
                      onClick={() => handleDelete(selectedEvent.id)}
                    >
                      <Trash2 className="w-4 h-4" /> Delete
                    </button>
                  </div>
                )}
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowDetailModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Form Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => { setShowModal(false); resetForm(); }}>
          <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingSchedule ? 'Edit Schedule' : 'Add New Schedule'}</h3>
              <button 
                className="modal-close" 
                onClick={() => { setShowModal(false); resetForm(); }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="form-label">Title *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="e.g., Monthly Director Meeting"
                      required
                    />
                  </div>

                  <div>
                    <label className="form-label">Description</label>
                    <textarea
                      className="form-input"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Brief description of the event"
                      rows="3"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="form-label">Event Date *</label>
                      <input
                        type="date"
                        className="form-input"
                        value={formData.event_date}
                        onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
                        required
                      />
                    </div>

                    <div>
                      <label className="form-label">Event Type *</label>
                      <select
                        className="form-select"
                        value={formData.event_type}
                        onChange={(e) => setFormData({ ...formData, event_type: e.target.value })}
                      >
                        <option value="meeting">Meeting</option>
                        <option value="training">Training</option>
                        <option value="event">Event</option>
                        <option value="deadline">Deadline</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="form-label">Start Time *</label>
                      <input
                        type="time"
                        className="form-input"
                        value={formData.start_time}
                        onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                        required
                      />
                    </div>

                    <div>
                      <label className="form-label">End Time *</label>
                      <input
                        type="time"
                        className="form-input"
                        value={formData.end_time}
                        onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="form-label">Venue *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.venue}
                      onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                      placeholder="e.g., Main Conference Room"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="form-label">Priority</label>
                      <select
                        className="form-select"
                        value={formData.priority}
                        onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="critical">Critical</option>
                      </select>
                    </div>

                    <div>
                      <label className="form-label">Target Audience</label>
                      <select
                        className="form-select"
                        value={formData.target_audience}
                        onChange={(e) => setFormData({ ...formData, target_audience: e.target.value })}
                      >
                        <option value="all">All Staff</option>
                        <option value="directors">Directors</option>
                        <option value="managers">Managers</option>
                        <option value="supervisors">Supervisors</option>
                        <option value="guards">Guards</option>
                        <option value="secretaries">Secretaries</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="notify_all"
                      checked={formData.notify_all}
                      onChange={(e) => setFormData({ ...formData, notify_all: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <label htmlFor="notify_all" className="text-sm text-gray-700">
                      Send notification to all users
                    </label>
                  </div>

                  <div>
                    <label className="form-label">Additional Notes</label>
                    <textarea
                      className="form-input"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Any additional information or instructions"
                      rows="3"
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => { setShowModal(false); resetForm(); }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                >
                  {loading ? 'Saving...' : editingSchedule ? 'Update Schedule' : 'Create Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 notification notification-${notification.type}`}>
          {notification.message}
        </div>
      )}
    </div>
  );
};

export default SecretarySchedule;