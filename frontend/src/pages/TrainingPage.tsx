'use client';

import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import flatpickr from 'flatpickr';
import 'flatpickr/dist/flatpickr.min.css';

type Employee = {
  name: string;
  dept: string;
  desig: string;
  score: number;
};

type TrainerOption = {
  name: string;
  dept: string;
  desig: string;
  email: string;
};

type ExternalInfo = {
  source: string;
  org: string;
  mobile: string;
  email: string;
};

type Training = {
  _id?: string;
  topic: string;
  desc: string;
  trainerType: 'internal' | 'external';
  trainerName: string;
  trainerDept?: string;
  trainerDesig?: string;
  external?: ExternalInfo;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Scheduled' | 'Archived';
  date?: string;
  reason?: string;
  isSuggestion?: boolean;
  priority?: 'P1' | 'P2' | 'P3';
};

type Tab = 'hr' | 'mgmt' | 'emp' | 'score';

export default function TrainingPage() {
  const [activeTab, setActiveTab] = useState<Tab>('hr');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [attendanceLog, setAttendanceLog] = useState<Record<number, string[]>>({});

  // HR form state
  const [form, setForm] = useState({
    topic: '',
    desc: '',
    trainerType: 'internal' as 'internal' | 'external',
    trainer: '',
    dept: '',
    desig: '',
    extSource: '',
    extName: '',
    extOrg: '',
    extMobile: '',
    extEmail: '',
  });

  // Trainers + HR table filters + editing
  const [trainers, setTrainers] = useState<TrainerOption[]>([]);
  const [loadingTrainers, setLoadingTrainers] = useState(false);
  const [trainerError, setTrainerError] = useState<string | null>(null);

  const [trainerFilter, setTrainerFilter] = useState('');
  const [quarterFilter, setQuarterFilter] = useState('');
  const [fyFilter, setFyFilter] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Training; direction: 'asc' | 'desc' }>({
    key: 'date',
    direction: 'desc',
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<Training>>({});
  const datePickers = useRef<Map<string, flatpickr.Instance>>(new Map());

  // Rejection modal
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectProposalId, setRejectProposalId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Schedule/Reschedule modal
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedTrainingForSchedule, setSelectedTrainingForSchedule] = useState<Training | null>(null);
  const [isReschedule, setIsReschedule] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [savingSchedule, setSavingSchedule] = useState(false);

  const calendarRef = useRef<flatpickr.Instance | null>(null);
  const calendarInputRef = useRef<HTMLInputElement>(null);

  // Feedback states
  const [selectedEmp, setSelectedEmp] = useState('');
  const [selectedTrainingIndex, setSelectedTrainingIndex] = useState(-1);
  const [feedback, setFeedback] = useState({
    overall: '',
    content: '',
    missing: '',
    helpful: '',
  });

  // Management suggestion form + list
  const [suggestionForm, setSuggestionForm] = useState({
    topic: '',
    desc: '',
    trainerName: '',
    reason: '',
    priority: '',
  });
  const [suggestions, setSuggestions] = useState<any[]>([]);

  const API_BASE = process.env.NODE_ENV === 'development'
    ? 'http://localhost:5000/api'
    : '/api';

  // Fetch trainers (HR tab)
  // Auto-set default quarter & FY + auto-archive past trainings
useEffect(() => {
  if (activeTab !== 'hr' && activeTab !== 'mgmt') return;

  const now = new Date();

  const archiveOldTrainings = async () => {
    const pastScheduled = trainings.filter(t => 
      t.status === 'Scheduled' && 
      t.date && 
      new Date(t.date) < now
    );

    if (pastScheduled.length === 0) return;

    console.log(`Archiving ${pastScheduled.length} past trainings...`);

    for (const t of pastScheduled) {
      if (t._id) {
        try {
          await axios.patch(`${API_BASE}/training-proposals/${t._id}`, {
            status: 'Archived',
            archivedAt: new Date().toISOString(),
          });
        } catch (err) {
          console.error('Failed to archive:', t._id, err);
        }
      }
    }

    // Refresh after archiving
    refreshTrainings();
  };

  archiveOldTrainings();
}, [activeTab, trainings]);

  // Fetch employees (emp + score tabs)
  useEffect(() => {
    if (activeTab !== 'emp' && activeTab !== 'score') return;

    const fetchEmployees = async () => {
      try {
        const res = await fetch(`${API_BASE}/employees?lightweight=true`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        let raw = Array.isArray(data) ? data : (data.data || data.employees || []);

        const formatted: Employee[] = raw.map((emp: any) => ({
          name: emp.full_name || emp.name || '',
          dept: emp.department || emp.dept || '',
          desig: emp.designation || emp.desig || '',
          score: emp.score || 0,
        }));

        setEmployees(formatted);
      } catch (err) {
        console.error('Failed to load employees:', err);
      }
    };

    fetchEmployees();
  }, [activeTab]);

  // Fetch trainings + suggestions (when tab changes)
  useEffect(() => {
  const fetchTrainings = async () => {
    try {
      let url = `${API_BASE}/training-proposals`;
      if (activeTab === 'mgmt') url += '?status=Pending';

      const res = await axios.get(url);
      if (res.data.success) {
        let fetchedTrainings = res.data.data || [];

        // Auto-archive past Scheduled trainings (only in HR/Mgmt tabs)
        if (activeTab === 'hr' || activeTab === 'mgmt') {
          const now = new Date();
          const toArchive = fetchedTrainings.filter((t: { status: string; date: string | number | Date; }) => 
            t.status === 'Scheduled' && 
            t.date && 
            new Date(t.date) < now
          );

          if (toArchive.length > 0) {
            console.log(`Auto-archiving ${toArchive.length} past trainings...`);

            for (const t of toArchive) {
              if (t._id) {
                try {
                  await axios.patch(`${API_BASE}/training-proposals/${t._id}`, {
                    status: 'Archived',
                    // Optional: add archivedAt timestamp
                    archivedAt: now.toISOString()
                  });
                } catch (archiveErr) {
                  console.error(`Failed to archive training ${t._id}:`, archiveErr);
                }
              }
            }

            // Re-fetch after archiving to show updated statuses
            const refreshed = await axios.get(url);
            if (refreshed.data.success) {
              fetchedTrainings = refreshed.data.data || [];
            }
          }
        }

        setTrainings(fetchedTrainings);
      }
    } catch (err) {
      console.error('Fetch trainings failed:', err);
    }
  };

  const fetchSuggestions = async () => {
    if (activeTab !== 'mgmt') return;
    try {
      const res = await axios.get(`${API_BASE}/training-proposals?isSuggestion=true`);
      if (res.data.success) {
        setSuggestions(res.data.data || []);
      }
    } catch (err) {
      console.error('Fetch suggestions failed:', err);
    }
  };

  fetchTrainings();
  fetchSuggestions();
}, [activeTab]);

  const refreshTrainings = async () => {
    try {
      const res = await axios.get(`${API_BASE}/training-proposals`);
      if (res.data.success) setTrainings(res.data.data || []);
    } catch (err) {
      console.error('Refresh failed:', err);
    }
  };


  

  // ────────────────────────────────────────────────
  // HR Table Filter & Sort
  // ────────────────────────────────────────────────

  const filteredTrainings = trainings
    .filter((t) => {
      if (trainerFilter && t.trainerName !== trainerFilter) return false;

      if (quarterFilter && t.date) {
        const [d, m, y] = t.date.split(/[- :]/);
        const month = new Date(`${m} ${d}, ${y}`).getMonth() + 1;
        const q = Math.ceil(month / 3);
        if (`Q${q}` !== quarterFilter) return false;
      }

      if (fyFilter && t.date) {
        const [d, m, y] = t.date.split(/[- :]/);
        const dateObj = new Date(`${m} ${d}, ${y}`);
        const fyStart = dateObj.getMonth() >= 3 ? dateObj.getFullYear() : dateObj.getFullYear() - 1;
        if (`FY ${fyStart}-${fyStart + 1}` !== fyFilter) return false;
      }

      if (showArchived) {
        return t.status === 'Rejected' || (t.status === 'Scheduled' && new Date(t.date || '1970') < new Date());
      }

      return !t.isSuggestion; // Hide suggestions from main HR table
    })
    .sort((a, b) => {
      if (!sortConfig.key) return 0;
      let aVal: any = a[sortConfig.key] ?? '';
      let bVal: any = b[sortConfig.key] ?? '';
      if (sortConfig.key === 'date' && a.date && b.date) {
        aVal = new Date(a.date).getTime();
        bVal = new Date(b.date).getTime();
      }
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

  const handleSort = (key: keyof Training) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  // ────────────────────────────────────────────────
  // Inline Editing (HR table)
  // ────────────────────────────────────────────────

  const startEdit = (training: Training) => {
    setEditingId(training._id || '');
    setEditValues({ ...training });
  };

  const saveEdit = async (id?: string) => {
    if (!id || !editingId) return;
    try {
      const res = await axios.patch(`${API_BASE}/training-proposals/${id}`, editValues);
      if (res.data.success) {
        refreshTrainings();
        setEditingId(null);
        setEditValues({});
        alert('Training updated successfully');
      }
    } catch (err: any) {
      alert('Failed to update: ' + (err.response?.data?.error || err.message));
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValues({});
  };

  // ────────────────────────────────────────────────
  // Quarter & FY Helpers
  // ────────────────────────────────────────────────

  const getAvailableFYs = () => {
    const fys = new Set<string>();
    trainings.forEach((t) => {
      if (t.date) {
        const [d, m, y] = t.date.split(/[- :]/);
        const dateObj = new Date(`${m} ${d}, ${y}`);
        const fyStart = dateObj.getMonth() >= 3 ? dateObj.getFullYear() : dateObj.getFullYear() - 1;
        fys.add(`FY ${fyStart}-${fyStart + 1}`);
      }
    });
    return Array.from(fys).sort().reverse();
  };

  // ────────────────────────────────────────────────
  // HR Submit proposals
  // ────────────────────────────────────────────────

  const handleTrainerSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const email = e.target.value;
    const selected = trainers.find((t) => t.email === email);
    setForm((prev) => ({
      ...prev,
      trainer: email,
      dept: selected?.dept || '',
      desig: selected?.desig || '',
    }));
  };

  const submitTraining = async () => {
    if (!form.topic.trim() || !form.desc.trim()) return alert('Topic and Description required');

    const trainerName =
      form.trainerType === 'internal'
        ? trainers.find((t) => t.email === form.trainer)?.name || ''
        : form.extName.trim();

    if (!trainerName) return alert('Trainer name required');

    const payload = {
      topic: form.topic.trim(),
      desc: form.desc.trim(),
      trainerType: form.trainerType,
      trainerName,
      trainerDept: form.dept.trim() || undefined,
      trainerDesig: form.desig.trim() || undefined,
      external:
        form.trainerType === 'external'
          ? {
              source: form.extSource.trim(),
              org: form.extOrg.trim(),
              mobile: form.extMobile.trim(),
              email: form.extEmail.trim(),
            }
          : undefined,
    };

    try {
      const res = await axios.post(`${API_BASE}/training-proposals`, payload);
      if (res.data.success) {
        alert('Submitted successfully!');
        setForm({
          topic: '',
          desc: '',
          trainerType: 'internal',
          trainer: '',
          dept: '',
          desig: '',
          extSource: '',
          extName: '',
          extOrg: '',
          extMobile: '',
          extEmail: '',
        });
        refreshTrainings();
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to submit');
    }
  };

  // ────────────────────────────────────────────────
  // Management Suggestion Submit (now uses same endpoint)
  // ────────────────────────────────────────────────

  const submitSuggestion = async () => {
    if (
      !suggestionForm.topic.trim() ||
      !suggestionForm.desc.trim() ||
      !suggestionForm.reason.trim() ||
      !suggestionForm.priority
    ) {
      alert('Please fill all required fields');
      return;
    }

    const payload = {
      topic: suggestionForm.topic.trim(),
      desc: suggestionForm.desc.trim(),
      trainerName: suggestionForm.trainerName.trim() || undefined,
      reason: suggestionForm.reason.trim(),
      priority: suggestionForm.priority,
      isSuggestion: true,
    };

    try {
      const res = await axios.post(`${API_BASE}/training-proposals`, payload);
      if (res.data.success) {
        // Refresh both trainings and suggestions
        refreshTrainings();
        const sugRes = await axios.get(`${API_BASE}/training-proposals?isSuggestion=true`);
        if (sugRes.data.success) setSuggestions(sugRes.data.data || []);

        setSuggestionForm({
          topic: '',
          desc: '',
          trainerName: '',
          reason: '',
          priority: '',
        });

        alert('Suggestion submitted successfully!');
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to submit suggestion');
    }
  };

  // ────────────────────────────────────────────────
  // Other handlers (approve, reject, schedule, feedback, etc.)
  // ────────────────────────────────────────────────

  const approve = async (id: string) => {
    try {
      const res = await axios.patch(`${API_BASE}/training-proposals/${id}/approve`);
      if (res.data.success) refreshTrainings();
    } catch (err) {
      alert('Approve failed');
    }
  };

  const openRejectModal = (id: string) => {
    setRejectProposalId(id);
    setRejectReason('');
    setShowRejectModal(true);
  };

  const confirmReject = async () => {
    if (!rejectProposalId || !rejectReason.trim()) return alert('Reason required');
    try {
      const res = await axios.patch(
        `${API_BASE}/training-proposals/${rejectProposalId}/reject`,
        { reason: rejectReason.trim() }
      );
      if (res.data.success) refreshTrainings();
    } catch (err) {
      alert('Reject failed');
    } finally {
      setShowRejectModal(false);
      setRejectProposalId(null);
      setRejectReason('');
    }
  };

  const openScheduleModal = (training: Training, isResched: boolean = false) => {
    setSelectedTrainingForSchedule(training);
    setIsReschedule(isResched);
    setSelectedDate(training.date || '');
    setShowScheduleModal(true);
  };

  const confirmScheduleOrReschedule = async () => {
    if (!selectedTrainingForSchedule || !selectedDate) {
      alert('Please select a date and time');
      return;
    }

    setSavingSchedule(true);

    try {
      const updatedTraining = {
        ...selectedTrainingForSchedule,
        date: selectedDate,
        status: isReschedule ? selectedTrainingForSchedule.status : 'Scheduled' as const,
      };

      setTrainings((prev) =>
        prev.map((t) =>
          t._id === selectedTrainingForSchedule._id ? updatedTraining : t
        )
      );

      if (selectedTrainingForSchedule._id) {
        await axios.patch(`${API_BASE}/training-proposals/${selectedTrainingForSchedule._id}`, {
          date: selectedDate,
          status: isReschedule ? undefined : 'Scheduled',
        });
      }

      if (
        !isReschedule &&
        selectedTrainingForSchedule.trainerType === 'internal' &&
        selectedTrainingForSchedule.status !== 'Scheduled'
      ) {
        setEmployees((prev) =>
          prev.map((e) =>
            e.name === selectedTrainingForSchedule.trainerName
              ? { ...e, score: e.score + 1 }
              : e
          )
        );
      }

      const index = trainings.findIndex((t) => t._id === selectedTrainingForSchedule._id);
      if (index >= 0 && !attendanceLog[index]) {
        setAttendanceLog((prev) => ({ ...prev, [index]: [] }));
      }

      await refreshTrainings();
      alert(isReschedule ? 'Training rescheduled!' : 'Training scheduled successfully!');
    } catch (err: any) {
      console.error('Schedule error:', err);
      alert('Failed to schedule/reschedule training');
    } finally {
      setSavingSchedule(false);
      setShowScheduleModal(false);
      setSelectedTrainingForSchedule(null);
      setSelectedDate('');
    }
  };

  useEffect(() => {
    if (!showScheduleModal || !calendarInputRef.current) return;

    if (calendarRef.current) calendarRef.current.destroy();

    calendarRef.current = flatpickr(calendarInputRef.current, {
      dateFormat: 'd-M-Y h:i K',
      defaultDate: selectedDate || new Date(),
      minDate: 'today',
      enableTime: true,
      time_24hr: false,
      minuteIncrement: 15,
      onChange: (selectedDates) => {
        if (selectedDates[0]) {
          const datePart = selectedDates[0].toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          }).replace(/ /g, '-');
          const timePart = selectedDates[0].toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          });
          setSelectedDate(`${datePart} ${timePart}`);
        }
      },
    });

    return () => {
      calendarRef.current?.destroy();
    };
  }, [showScheduleModal]);

  const submitFeedback = () => {
    if (selectedTrainingIndex < 0 || !selectedEmp) return alert('Select employee and training');

    const log = attendanceLog[selectedTrainingIndex] || [];
    if (!log.includes(selectedEmp)) {
      setAttendanceLog((prev) => ({
        ...prev,
        [selectedTrainingIndex]: [...log, selectedEmp],
      }));
    }

    alert('Feedback submitted');
    setFeedback({ overall: '', content: '', missing: '', helpful: '' });
  };

  const finalizeAttendance = () => {
    setEmployees((prev) =>
      prev.map((emp) => {
        let penalty = 0;
        trainings.forEach((t, i) => {
          if (t.status === 'Scheduled' && !attendanceLog[i]?.includes(emp.name)) {
            penalty -= 1;
          }
        });
        return { ...emp, score: emp.score + penalty };
      })
    );
    alert('Attendance finalized – penalties applied');
  };

  const pendingTrainings = trainings.filter((t) => t.status === 'Pending' && !t.isSuggestion);
  const scheduledTrainings = trainings.filter((t) => t.status === 'Scheduled');

  return (
    <div className="flex min-h-screen w-full bg-gray-50">
      <Sidebar />

      <div className="flex-1 flex flex-col">
        <Navbar />

        <div className="flex-1 overflow-y-auto">
          <div className="min-h-full bg-gray-50">
            <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-20">
              <h1 className="text-xl md:text-2xl font-semibold text-gray-800">
                Brisk Olive – Training Automation HRMS
              </h1>
            </header>

            <nav className="bg-gradient-to-r from-blue-700 to-blue-600 px-4 py-4 flex gap-3 md:gap-4 justify-center md:justify-start shadow-md sticky top-0 z-10">
              {(['hr', 'mgmt', 'emp', 'score'] as Tab[]).map((tab) => {
                const isActive = activeTab === tab;
                const label =
                  tab === 'hr'
                    ? 'HR'
                    : tab === 'mgmt'
                    ? 'Management'
                    : tab === 'emp'
                    ? 'Employee'
                    : 'Scorecard';

                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`
                      group relative px-6 py-2.5 
                      font-semibold text-sm md:text-base
                      rounded-lg overflow-hidden
                      transition-all duration-300 ease-out
                      ${isActive ? 'bg-white text-blue-700 shadow-xl scale-105' : 'text-white hover:text-white'}
                      focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2 focus:ring-offset-blue-600
                    `}
                  >
                    <span
                      className={`
                        absolute inset-0 bg-white/20 
                        transform -translate-x-full 
                        transition-transform duration-500 ease-out
                        group-hover:translate-x-0
                      `}
                    />
                    <span className="relative z-10 transition-transform duration-300 group-hover:-translate-y-0.5">
                      {label}
                    </span>
                    {isActive && (
                      <span className="absolute -bottom-1 left-1/2 h-1 w-8 bg-white rounded-full -translate-x-1/2 animate-pulse" />
                    )}
                  </button>
                );
              })}
            </nav>

            <main className="container mx-auto p-5 md:p-6 max-w-7xl pb-12">
              {activeTab === 'hr' && (
                <div className="space-y-8">
                  {/* HR proposals Form */}
                  <div className="bg-white p-6 rounded-xl shadow-md">
                    <h3 className="text-xl font-bold text-gray-800 mb-6">
                      HR – Training proposals & Scheduling
                    </h3>

                    <div className="grid gap-5 md:grid-cols-2">
                      <div className="md:col-span-2">
                        <label className="block font-medium text-gray-700 mb-1">Training Topic *</label>
                        <input
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={form.topic}
                          onChange={(e) => setForm({ ...form, topic: e.target.value })}
                          placeholder="e.g. Leadership Skills Workshop"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block font-medium text-gray-700 mb-1">Description *</label>
                        <textarea
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg min-h-[110px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={form.desc}
                          onChange={(e) => setForm({ ...form, desc: e.target.value })}
                          placeholder="Brief description of the training content and objectives..."
                        />
                      </div>

                      <div>
                        <label className="block font-medium text-gray-700 mb-1">Trainer Type</label>
                        <select
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={form.trainerType}
                          onChange={(e) =>
                            setForm({ ...form, trainerType: e.target.value as 'internal' | 'external' })
                          }
                        >
                          <option value="internal">Internal Trainer</option>
                          <option value="external">External Trainer</option>
                        </select>
                      </div>

                      {form.trainerType === 'internal' ? (
                        <>
                          <div>
                            <label className="block font-medium text-gray-700 mb-1">Trainer Name *</label>
                            {loadingTrainers ? (
                              <div className="text-gray-500">Loading employees...</div>
                            ) : trainerError ? (
                              <div className="text-red-600">{trainerError}</div>
                            ) : (
                              <select
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={form.trainer}
                                onChange={handleTrainerSelect}
                                required
                              >
                                <option value="">-- Select Employee --</option>
                                {trainers.map((t) => (
                                  <option key={t.email} value={t.email}>
                                    {t.name}
                                    {t.dept && ` • ${t.dept}`}
                                    {t.desig && ` (${t.desig})`}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>

                          <div>
                            <label className="block font-medium text-gray-700 mb-1">Department</label>
                            <input
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 cursor-not-allowed"
                              value={form.dept}
                              disabled
                              readOnly
                            />
                          </div>

                          <div>
                            <label className="block font-medium text-gray-700 mb-1">Designation</label>
                            <input
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 cursor-not-allowed"
                              value={form.desig}
                              disabled
                              readOnly
                            />
                          </div>
                        </>
                      ) : (
                        <>
                          <div>
                            <label className="block font-medium text-gray-700 mb-1">Trainer Name *</label>
                            <input
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                              value={form.extName}
                              onChange={(e) => setForm({ ...form, extName: e.target.value })}
                              placeholder="e.g. Dr. Rajesh Kumar"
                            />
                          </div>
                          <div>
                            <label className="block font-medium text-gray-700 mb-1">Source/Platform</label>
                            <input
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                              value={form.extSource}
                              onChange={(e) => setForm({ ...form, extSource: e.target.value })}
                              placeholder="e.g. LinkedIn, Upwork, Consultant"
                            />
                          </div>
                          <div>
                            <label className="block font-medium text-gray-700 mb-1">Organisation</label>
                            <input
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                              value={form.extOrg}
                              onChange={(e) => setForm({ ...form, extOrg: e.target.value })}
                            />
                          </div>
                          <div>
                            <label className="block font-medium text-gray-700 mb-1">Mobile</label>
                            <input
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                              value={form.extMobile}
                              onChange={(e) => setForm({ ...form, extMobile: e.target.value })}
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label className="block font-medium text-gray-700 mb-1">Email</label>
                            <input
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                              type="email"
                              value={form.extEmail}
                              onChange={(e) => setForm({ ...form, extEmail: e.target.value })}
                            />
                          </div>
                        </>
                      )}
                    </div>

                    <button
                      onClick={submitTraining}
                      className="mt-8 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition shadow-sm"
                      disabled={loadingTrainers}
                    >
                      Submit for Management Approval
                    </button>
                  </div>

                  {/* Filtered & Editable Table (HR) */}
                    {/* Filtered & Editable Table (HR) */}
                    <div className="bg-white p-6 rounded-xl shadow-md">
                      <h4 className="text-lg font-bold text-gray-800 mb-4">
                        All Trainings – HR Control Panel
                      </h4>

                      {/* Filters */}
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Trainer Name</label>
                          <select
                            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={trainerFilter}
                            onChange={(e) => setTrainerFilter(e.target.value)}
                          >
                            <option value="">All Trainers</option>
                            {Array.from(new Set(trainings.map((t) => t.trainerName))).map((name) => (
                              <option key={name} value={name}>
                                {name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Quarter</label>
                          <select
                            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={quarterFilter}
                            onChange={(e) => setQuarterFilter(e.target.value)}
                          >
                            <option value="">All Quarters</option>
                            <option value="Q1">Q1 (Jan–Mar)</option>
                            <option value="Q2">Q2 (Apr–Jun)</option>
                            <option value="Q3">Q3 (Jul–Sep)</option>
                            <option value="Q4">Q4 (Oct–Dec)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Financial Year</label>
                          <select
                            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={fyFilter}
                            onChange={(e) => setFyFilter(e.target.value)}
                          >
                            <option value="">All FY</option>
                            {getAvailableFYs().map((fy) => (
                              <option key={fy} value={fy}>
                                {fy}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex items-end">
                          <label className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={showArchived}
                              onChange={(e) => setShowArchived(e.target.checked)}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <span className="text-sm text-gray-700">Show Archived only</span>
                          </label>
                        </div>
                      </div>

                {/* HR Table */}
                {filteredTrainings.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    No trainings match the selected filters.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">S.No.</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('topic')}>
                            Training Topic {sortConfig.key === 'topic' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Topic Description</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('trainerName')}>
                            Trainer Name {sortConfig.key === 'trainerName' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                          </th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('date')}>
                            Date of Training {sortConfig.key === 'date' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                          </th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Remarks</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredTrainings.map((t, idx) => (
                          <tr key={t._id || idx} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{idx + 1}</td>

                            <td className="px-6 py-4 whitespace-nowrap">
                              {editingId === t._id ? (
                                <input
                                  value={editValues.topic ?? t.topic}
                                  onChange={(e) => setEditValues((v) => ({ ...v, topic: e.target.value }))}
                                  className="w-full px-2 py-1 border rounded"
                                />
                              ) : (
                                t.topic
                              )}
                            </td>

                            <td className="px-6 py-4">
                              {editingId === t._id ? (
                                <textarea
                                  value={editValues.desc ?? t.desc}
                                  onChange={(e) => setEditValues((v) => ({ ...v, desc: e.target.value }))}
                                  className="w-full px-2 py-1 border rounded min-h-[60px]"
                                />
                              ) : (
                                t.desc
                              )}
                            </td>

                            <td className="px-6 py-4 whitespace-nowrap">
                              {editingId === t._id ? (
                                <input
                                  value={editValues.trainerName ?? t.trainerName}
                                  onChange={(e) => setEditValues((v) => ({ ...v, trainerName: e.target.value }))}
                                  className="w-full px-2 py-1 border rounded"
                                />
                              ) : (
                                t.trainerName
                              )}
                            </td>

                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              {editingId === t._id ? (
                                <select
                                  value={editValues.status ?? t.status}
                                  onChange={(e) => setEditValues((v) => ({ ...v, status: e.target.value as any }))}
                                  className="px-2 py-1 border rounded"
                                >
                                  <option value="Pending">Pending</option>
                                  <option value="Approved">Approved</option>
                                  <option value="Rejected">Rejected</option>
                                  <option value="Scheduled">Scheduled</option>
                                  <option value="Archived">Archived</option>
                                </select>
                              ) : (
                                <span
                                  className={`font-bold ${
                                    t.status === 'Approved'
                                      ? 'text-green-600'
                                      : t.status === 'Rejected'
                                      ? 'text-red-600'
                                      : t.status === 'Scheduled'
                                      ? 'text-blue-600'
                                      : t.status === 'Archived'
                                      ? 'text-gray-600'
                                      : 'text-yellow-600'
                                  }`}
                                >
                                  {t.status}
                                </span>
                              )}
                            </td>

                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              {editingId === t._id ? (
                                <input
                                  type="text"
                                  ref={(el) => {
                                    if (el && !datePickers.current.has(t._id!)) {
                                      datePickers.current.set(
                                        t._id!,
                                        flatpickr(el, {
                                          dateFormat: 'd-M-Y h:i K',
                                          defaultDate: editValues.date ?? t.date ?? '',
                                          enableTime: true,
                                          time_24hr: false,
                                          minuteIncrement: 15,
                                          onChange: (dates) => {
                                            if (dates[0]) {
                                              const d = dates[0];
                                              const formatted =
                                                d
                                                  .toLocaleDateString('en-GB', {
                                                    day: '2-digit',
                                                    month: 'short',
                                                    year: 'numeric',
                                                  })
                                                  .replace(/ /g, '-') +
                                                ' ' +
                                                d.toLocaleTimeString('en-US', {
                                                  hour: 'numeric',
                                                  minute: '2-digit',
                                                  hour12: true,
                                                });
                                              setEditValues((v) => ({ ...v, date: formatted }));
                                            }
                                          },
                                        })
                                      );
                                    }
                                  }}
                                  className="w-full px-2 py-1 border rounded"
                                />
                              ) : (
                                t.date || '-'
                              )}
                            </td>

                            {/* New Priority Column */}
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              {editingId === t._id ? (
                                <select
                                  value={editValues.priority ?? t.priority ?? ''}
                                  onChange={(e) => setEditValues((v) => ({ ...v, priority: (e.target.value || undefined) as 'P1' | 'P2' | 'P3' | undefined }))}
                                  className="px-2 py-1 border rounded"
                                >
                                  <option value="">None</option>
                                  <option value="P1">P1</option>
                                  <option value="P2">P2</option>
                                  <option value="P3">P3</option>
                                </select>
                              ) : (
                                <span
                                  className={`font-medium ${
                                    t.priority === 'P1'
                                      ? 'text-red-600'
                                      : t.priority === 'P2'
                                      ? 'text-orange-600'
                                      : t.priority === 'P3'
                                      ? 'text-green-600'
                                      : 'text-gray-500'
                                  }`}
                                >
                                  {t.priority || '-'}
                                </span>
                              )}
                            </td>

                            <td className="px-6 py-4 whitespace-nowrap text-center space-x-2">
                              {editingId === t._id ? (
                                <>
                                  <button
                                    onClick={() => saveEdit(t._id)}
                                    className="text-green-600 hover:underline"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={cancelEdit}
                                    className="text-red-600 hover:underline"
                                  >
                                    Cancel
                                  </button>
                                </>
                              ) : (
                                <>
                                  {t.status === 'Approved' && !t.date && (
                                    <button
                                      onClick={() => openScheduleModal(t, false)}
                                      className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                                      disabled={savingSchedule}
                                    >
                                      Schedule
                                    </button>
                                  )}
                                  {t.status === 'Scheduled' && (
                                    <button
                                      onClick={() => openScheduleModal(t, true)}
                                      className="bg-purple-600 text-white px-3 py-1 rounded text-sm hover:bg-purple-700"
                                      disabled={savingSchedule}
                                    >
                                      Reschedule
                                    </button>
                                  )}
                                  <button
                                    onClick={() => startEdit(t)}
                                    className="text-indigo-600 hover:underline text-sm"
                                  >
                                    Edit
                                  </button>
                                </>
                              )}
                            </td>

                            <td className="px-6 py-4">
                              {editingId === t._id ? (
                                <input
                                  value={editValues.reason ?? t.reason ?? ''}
                                  onChange={(e) => setEditValues((v) => ({ ...v, reason: e.target.value }))}
                                  className="w-full px-2 py-1 border rounded"
                                />
                              ) : (
                                t.reason || '-'
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
                </div>
              )}

              {activeTab === 'mgmt' && (
  <div className="space-y-8">
    {/* Management – All Trainings Table (same structure as HR) */}
    <div className="bg-white p-6 rounded-xl shadow-md">
      <h3 className="text-xl font-bold text-gray-800 mb-6">
        Management – All Training proposals
      </h3>

      {/* Filters (same as HR) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Trainer Name</label>
          <select
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={trainerFilter}
            onChange={(e) => setTrainerFilter(e.target.value)}
          >
            <option value="">All Trainers</option>
            {Array.from(new Set(trainings.map(t => t.trainerName))).map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Quarter</label>
          <select
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={quarterFilter}
            onChange={(e) => setQuarterFilter(e.target.value)}
          >
            <option value="">All Quarters</option>
            <option value="Q1">Q1 (Jan–Mar)</option>
            <option value="Q2">Q2 (Apr–Jun)</option>
            <option value="Q3">Q3 (Jul–Sep)</option>
            <option value="Q4">Q4 (Oct–Dec)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Financial Year</label>
          <select
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={fyFilter}
            onChange={(e) => setFyFilter(e.target.value)}
          >
            <option value="">All FY</option>
            {getAvailableFYs().map((fy) => (
              <option key={fy} value={fy}>
                {fy}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-end">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <span className="text-sm text-gray-700">Show Archived only</span>
          </label>
        </div>
      </div>

      {/* Table – same as HR */}
      {filteredTrainings.length === 0 ? (
        <p className="text-gray-500 text-center py-8">
          No trainings match the selected filters.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  S.No.
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('topic')}
                >
                  Training Topic{' '}
                  {sortConfig.key === 'topic' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Topic Description
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('trainerName')}
                >
                  Trainer Name{' '}
                  {sortConfig.key === 'trainerName' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th
                  className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('date')}
                >
                  Date of Training{' '}
                  {sortConfig.key === 'date' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Action
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Remarks
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredTrainings.map((t, idx) => (
                <tr key={t._id || idx} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{idx + 1}</td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    {editingId === t._id ? (
                      <input
                        value={editValues.topic ?? t.topic}
                        onChange={(e) => setEditValues((v) => ({ ...v, topic: e.target.value }))}
                        className="w-full px-2 py-1 border rounded"
                      />
                    ) : (
                      t.topic
                    )}
                  </td>

                  <td className="px-6 py-4">
                    {editingId === t._id ? (
                      <textarea
                        value={editValues.desc ?? t.desc}
                        onChange={(e) => setEditValues((v) => ({ ...v, desc: e.target.value }))}
                        className="w-full px-2 py-1 border rounded min-h-[60px]"
                      />
                    ) : (
                      t.desc
                    )}
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    {editingId === t._id ? (
                      <input
                        value={editValues.trainerName ?? t.trainerName}
                        onChange={(e) => setEditValues((v) => ({ ...v, trainerName: e.target.value }))}
                        className="w-full px-2 py-1 border rounded"
                      />
                    ) : (
                      t.trainerName
                    )}
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {editingId === t._id ? (
                      <select
                        value={editValues.status ?? t.status}
                        onChange={(e) => setEditValues((v) => ({ ...v, status: e.target.value as any }))}
                        className="px-2 py-1 border rounded"
                      >
                        <option value="Pending">Pending</option>
                        <option value="Approved">Approved</option>
                        <option value="Rejected">Rejected</option>
                        <option value="Scheduled">Scheduled</option>
                        <option value="Archived">Archived</option>
                      </select>
                    ) : (
                      <span
                        className={`font-bold ${
                          t.status === 'Approved'
                            ? 'text-green-600'
                            : t.status === 'Rejected'
                            ? 'text-red-600'
                            : t.status === 'Scheduled'
                            // ? 'text-blue-600'
                            // : t.status === 'Archived'
                            ? 'text-gray-600'
                            : 'text-yellow-600'
                        }`}
                      >
                        {t.status}
                      </span>
                    )}
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {editingId === t._id ? (
                      <input
                        type="text"
                        ref={(el) => {
                          if (el && !datePickers.current.has(t._id!)) {
                            datePickers.current.set(
                              t._id!,
                              flatpickr(el, {
                                dateFormat: 'd-M-Y h:i K',
                                defaultDate: editValues.date ?? t.date ?? '',
                                enableTime: true,
                                time_24hr: false,
                                minuteIncrement: 15,
                                onChange: (dates) => {
                                  if (dates[0]) {
                                    const d = dates[0];
                                    const formatted =
                                      d
                                        .toLocaleDateString('en-GB', {
                                          day: '2-digit',
                                          month: 'short',
                                          year: 'numeric',
                                        })
                                        .replace(/ /g, '-') +
                                      ' ' +
                                      d.toLocaleTimeString('en-US', {
                                        hour: 'numeric',
                                        minute: '2-digit',
                                        hour12: true,
                                      });
                                    setEditValues((v) => ({ ...v, date: formatted }));
                                  }
                                },
                              })
                            );
                          }
                        }}
                        className="w-full px-2 py-1 border rounded"
                      />
                    ) : (
                      t.date || '-'
                    )}
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap text-center space-x-2">
                    {editingId === t._id ? (
                      <>
                        <button
                          onClick={() => saveEdit(t._id)}
                          className="text-green-600 hover:underline"
                        >
                          Save
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="text-red-600 hover:underline"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        {t.status === 'Pending' && (
                          <>
                            <button
                              onClick={() => approve(t._id!)}
                              className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => openRejectModal(t._id!)}
                              className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => startEdit(t)}
                          className="text-indigo-600 hover:underline text-sm"
                        >
                          Edit
                        </button>
                      </>
                    )}
                  </td>

                  <td className="px-6 py-4">
                    {editingId === t._id ? (
                      <input
                        value={editValues.reason ?? t.reason ?? ''}
                        onChange={(e) => setEditValues((v) => ({ ...v, reason: e.target.value }))}
                        className="w-full px-2 py-1 border rounded"
                      />
                    ) : (
                      t.reason || '-'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  </div>
)}

              {activeTab === 'emp' && (
                <div className="bg-white p-6 rounded-xl shadow-md mb-8">
                  <h3 className="text-xl font-bold text-gray-800 mb-6">
                    Training Feedback & Attendance
                  </h3>

                  {employees.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">
                      Loading employees... or no employees found in the system.
                    </p>
                  ) : (
                    <div className="grid gap-5 md:grid-cols-2">
                      <div>
                        <label className="block font-medium text-gray-700 mb-1">Your Name</label>
                        <select
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={selectedEmp}
                          onChange={(e) => setSelectedEmp(e.target.value)}
                        >
                          <option value="">-- Select Employee --</option>
                          {employees.map((emp) => (
                            <option key={emp.name} value={emp.name}>
                              {emp.name} ({emp.dept} - {emp.desig})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block font-medium text-gray-700 mb-1">Training Session</label>
                        {scheduledTrainings.length === 0 ? (
                          <p className="text-gray-500 py-2 italic">
                            No scheduled trainings available yet.
                          </p>
                        ) : (
                          <select
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={selectedTrainingIndex}
                            onChange={(e) => setSelectedTrainingIndex(Number(e.target.value))}
                          >
                            <option value={-1}>-- Select Training --</option>
                            {scheduledTrainings.map((t, idx) => (
                              <option key={t._id || idx} value={trainings.indexOf(t)}>
                                {t.topic}
                                {t.date ? ` (${t.date})` : ' (Date TBD)'}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>

                      <div>
                        <label className="block font-medium text-gray-700 mb-1">Overall Rating</label>
                        <select
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={feedback.overall}
                          onChange={(e) => setFeedback({ ...feedback, overall: e.target.value })}
                        >
                          <option value="">-- Select --</option>
                          {[1, 2, 3, 4, 5].map((v) => (
                            <option key={v} value={v.toString()}>
                              {v} Stars
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block font-medium text-gray-700 mb-1">Content Quality</label>
                        <select
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={feedback.content}
                          onChange={(e) => setFeedback({ ...feedback, content: e.target.value })}
                        >
                          <option value="">-- Select --</option>
                          {[1, 2, 3, 4, 5].map((v) => (
                            <option key={v} value={v.toString()}>
                              {v} Stars
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="md:col-span-2">
                        <label className="block font-medium text-gray-700 mb-1">What was missing?</label>
                        <textarea
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg min-h-[90px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={feedback.missing}
                          onChange={(e) => setFeedback({ ...feedback, missing: e.target.value })}
                          placeholder="Suggestions for improvement..."
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block font-medium text-gray-700 mb-1">How was it helpful?</label>
                        <textarea
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg min-h-[90px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={feedback.helpful}
                          onChange={(e) => setFeedback({ ...feedback, helpful: e.target.value })}
                          placeholder="Key takeaways and benefits..."
                        />
                      </div>
                    </div>
                  )}

                  <div className="mt-8 flex flex-wrap gap-4">
                    <button
                      onClick={submitFeedback}
                      className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition shadow-sm"
                      disabled={employees.length === 0 || scheduledTrainings.length === 0}
                    >
                      Submit Feedback
                    </button>

                    <button
                      onClick={finalizeAttendance}
                      className="bg-gray-700 text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-800 transition shadow-sm"
                      disabled={employees.length === 0}
                    >
                      Finalize Attendance (Apply Penalties)
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'score' && (
                <div className="bg-white p-6 rounded-xl shadow-md mb-8">
                  <h3 className="text-xl font-bold text-gray-800 mb-6">
                    Employee Training Scorecard
                  </h3>

                  {employees.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">
                      Loading employees... or no employees found.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Name
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Department
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Designation
                            </th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Training Score
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {employees.map((emp, i) => (
                            <tr key={i} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap font-medium">{emp.name}</td>
                              <td className="px-6 py-4 whitespace-nowrap">{emp.dept}</td>
                              <td className="px-6 py-4 whitespace-nowrap">{emp.desig}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-center">
                                <span
                                  className={`font-bold text-lg ${
                                    emp.score < 0 ? 'text-red-600' : 'text-green-600'
                                  }`}
                                >
                                  {emp.score}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </main>
          </div>
        </div>
      </div>

      {/* Rejection Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              Reject Training proposals
            </h3>
            <p className="text-gray-600 mb-4">
              Please provide a reason for rejection:
            </p>
            <textarea
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 min-h-[120px] resize-y"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter detailed reason here..."
            />
            <div className="mt-6 flex justify-end gap-4">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason('');
                }}
                className="px-5 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition"
              >
                Cancel
              </button>
              <button
                onClick={confirmReject}
                disabled={!rejectReason.trim()}
                className={`px-5 py-2 rounded-lg text-white font-medium transition ${
                  rejectReason.trim()
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-red-400 cursor-not-allowed'
                }`}
              >
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule / Reschedule Modal */}
      {showScheduleModal && selectedTrainingForSchedule && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              {isReschedule ? 'Reschedule Training' : 'Schedule Training'}
            </h3>
            <p className="text-gray-600 mb-4">
              Select date & time for: <strong>{selectedTrainingForSchedule.topic}</strong>
            </p>

            <div className="mb-6">
              <label className="block font-medium text-gray-700 mb-2">Date & Time</label>
              <input
                ref={calendarInputRef}
                type="text"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Select date and time..."
                value={selectedDate}
                readOnly
              />
            </div>

            <div className="flex justify-end gap-4">
              <button
                onClick={() => setShowScheduleModal(false)}
                className="px-5 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition"
                disabled={savingSchedule}
              >
                Cancel
              </button>
              <button
                onClick={confirmScheduleOrReschedule}
                disabled={!selectedDate || savingSchedule}
                className={`px-5 py-2 rounded-lg text-white font-medium transition ${
                  selectedDate && !savingSchedule
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : 'bg-blue-400 cursor-not-allowed'
                }`}
              >
                {savingSchedule ? 'Saving...' : (isReschedule ? 'Confirm Reschedule' : 'Confirm Schedule')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}