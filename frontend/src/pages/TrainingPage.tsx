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
  status: 'Pending' | 'Approved' | 'Rejected' | 'Scheduled';
  date?: string;
  reason?: string;
};

const initialEmployees: Employee[] = [
  { name: 'Anusha Barwal', dept: 'HR', desig: 'Manager', score: 0 },
  { name: 'Laksh Otwal', dept: 'Operations', desig: 'Executive', score: 0 },
  { name: 'Tanish Sharma', dept: 'Finance', desig: 'Accounts', score: 0 },
];

type Tab = 'hr' | 'mgmt' | 'emp' | 'score';

export default function TrainingPage() {
  const [activeTab, setActiveTab] = useState<Tab>('hr');
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees);
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [attendanceLog, setAttendanceLog] = useState<Record<number, string[]>>({});

  // HR form state
  const [form, setForm] = useState({
    topic: '',
    desc: '',
    trainerType: 'internal' as 'internal' | 'external',
    trainer: '',           // stores email for internal
    dept: '',
    desig: '',
    extSource: '',
    extName: '',
    extOrg: '',
    extMobile: '',
    extEmail: '',
  });

  // Trainers list + loading/error
  const [trainers, setTrainers] = useState<TrainerOption[]>([]);
  const [loadingTrainers, setLoadingTrainers] = useState(false);
  const [trainerError, setTrainerError] = useState<string | null>(null);

  // Rejection modal states
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectProposalId, setRejectProposalId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Schedule/Reschedule modal states
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

  const API_BASE = process.env.NODE_ENV === 'development'
    ? 'http://localhost:5000/api'
    : '/api';

  // Fetch trainers (HR tab)
  useEffect(() => {
    if (activeTab !== 'hr') return;

    const fetchTrainers = async () => {
      setLoadingTrainers(true);
      setTrainerError(null);
      try {
        const res = await fetch(`${API_BASE}/employees?lightweight=true`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const responseData = await res.json();
        let rawEmployees = Array.isArray(responseData)
          ? responseData
          : (responseData.data || responseData.employees || []);

        rawEmployees = rawEmployees.sort((a: any, b: any) =>
          (a.full_name || a.name || '').localeCompare(b.full_name || b.name || '')
        );

        const formatted = rawEmployees
          .map((emp: any) => ({
            name: emp.full_name || emp.name || '',
            dept: emp.department || emp.dept || '',
            desig: emp.designation || emp.desig || '',
            email: emp.official_email || emp.email || emp.officialEmail || '',
          }))
          .filter((t: { name: string; email: string; }) => t.name.trim() && t.email.trim());

        setTrainers(formatted);

        if (formatted.length === 0) {
          setTrainerError('No employees found in the system.');
        }
      } catch (err: any) {
        console.error('Failed to load trainers:', err);
        setTrainerError(`Could not load employee list: ${err.message || 'Server error'}`);
      } finally {
        setLoadingTrainers(false);
      }
    };

    fetchTrainers();
  }, [activeTab]);

  // Fetch trainings based on tab
  useEffect(() => {
    const fetchTrainings = async () => {
      try {
        let url = `${API_BASE}/training-proposals`;
        if (activeTab === 'mgmt') url += '?status=Pending';

        const res = await axios.get(url);
        if (res.data.success) {
          setTrainings(res.data.data || []);
        }
      } catch (err) {
        console.error('Failed to fetch trainings:', err);
      }
    };

    fetchTrainings();
  }, [activeTab]);

  const refreshTrainings = async () => {
    try {
      const res = await axios.get(`${API_BASE}/training-proposals`);
      if (res.data.success) setTrainings(res.data.data || []);
    } catch (err) {
      console.error('Refresh failed:', err);
    }
  };

  const handleTrainerSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedEmail = e.target.value;
    const selected = trainers.find((t) => t.email === selectedEmail);

    setForm((prev) => ({
      ...prev,
      trainer: selectedEmail,
      dept: selected?.dept || '',
      desig: selected?.desig || '',
    }));
  };

  const submitTraining = async () => {
    if (!form.topic.trim() || !form.desc.trim()) {
      alert('Topic and Description are required');
      return;
    }

    const trainerName =
      form.trainerType === 'internal'
        ? trainers.find((t) => t.email === form.trainer)?.name || ''
        : form.extName.trim();

    if (!trainerName) {
      alert('Trainer name is required');
      return;
    }

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
        alert('Training proposal submitted successfully!');
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
      } else {
        alert(res.data.error || 'Failed to submit proposal');
      }
    } catch (err: any) {
      console.error('Submit error:', err);
      alert(err.response?.data?.error || 'Failed to submit. Check if backend is running.');
    }
  };

  const approve = async (id: string) => {
    try {
      const res = await axios.patch(`${API_BASE}/training-proposals/${id}/approve`);
      if (res.data.success) {
        refreshTrainings();
        alert('Proposal approved');
      }
    } catch (err) {
      alert('Failed to approve proposal');
    }
  };

  const openRejectModal = (id: string) => {
    setRejectProposalId(id);
    setRejectReason('');
    setShowRejectModal(true);
  };

  const confirmReject = async () => {
    if (!rejectProposalId || !rejectReason.trim()) {
      alert('Please enter a rejection reason');
      return;
    }

    try {
      const res = await axios.patch(
        `${API_BASE}/training-proposals/${rejectProposalId}/reject`,
        { reason: rejectReason.trim() }
      );
      if (res.data.success) {
        refreshTrainings();
        alert('Proposal rejected');
      }
    } catch (err) {
      alert('Failed to reject proposal');
    } finally {
      setShowRejectModal(false);
      setRejectProposalId(null);
      setRejectReason('');
    }
  };

  // Open calendar modal for Schedule / Reschedule
  const openScheduleModal = (training: Training, isResched: boolean = false) => {
    setSelectedTrainingForSchedule(training);
    setIsReschedule(isResched);
    setSelectedDate(training.date || '');
    setShowScheduleModal(true);
  };

  // Save date/time to backend
  const patchDateToBackend = async (id: string, newDate: string) => {
    try {
      const res = await axios.patch(`${API_BASE}/training-proposals/${id}`, {
        date: newDate,
      });
      if (!res.data.success) {
        console.warn('Backend date update failed:', res.data);
      }
    } catch (err) {
      console.error('Failed to update date in database:', err);
    }
  };

  // Confirm schedule/reschedule from modal
  const confirmScheduleOrReschedule = () => {
    if (!selectedTrainingForSchedule || !selectedDate) {
      alert('Please select a date and time');
      return;
    }

    const updated = trainings.map((t) =>
      t._id === selectedTrainingForSchedule._id
        ? {
            ...t,
            date: selectedDate,
            ...(isReschedule ? {} : { status: 'Scheduled' as const }),
          }
        : t
    );

    setTrainings(updated as Training[]);

    // Increment score only on first schedule (not reschedule)
    if (
      !isReschedule &&
      selectedTrainingForSchedule.trainerType === 'internal' &&
      selectedTrainingForSchedule.status !== 'Scheduled'
    ) {
      setEmployees((prev) =>
        prev.map((e) =>
          e.name === selectedTrainingForSchedule.trainerName ? { ...e, score: e.score + 1 } : e
        )
      );
    }

    const index = trainings.findIndex((t) => t._id === selectedTrainingForSchedule._id);
    if (index >= 0 && !attendanceLog[index]) {
      setAttendanceLog((prev) => ({ ...prev, [index]: [] }));
    }

    // Save to database
    if (selectedTrainingForSchedule._id) {
      patchDateToBackend(selectedTrainingForSchedule._id, selectedDate);
    }

    refreshTrainings();
    setShowScheduleModal(false);
    setSelectedTrainingForSchedule(null);
    setSelectedDate('');
  };

  // Initialize flatpickr with time picker
  useEffect(() => {
    if (!showScheduleModal || !calendarInputRef.current) return;

    if (calendarRef.current) calendarRef.current.destroy();

    calendarRef.current = flatpickr(calendarInputRef.current, {
      dateFormat: 'd-M-Y h:i K', // 20-Jan-2026 03:30 PM
      defaultDate: selectedDate || new Date(),
      minDate: 'today',
      enableTime: true,
      time_24hr: false,
      minuteIncrement: 15,
      onChange: (selectedDates) => {
        if (selectedDates[0]) {
          const formatted = selectedDates[0].toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          }).replace(/ /g, '-') + ' ' +
            selectedDates[0].toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
            });
          setSelectedDate(formatted);
        }
      },
    });

    return () => {
      if (calendarRef.current) calendarRef.current.destroy();
    };
  }, [showScheduleModal]);

  const submitFeedback = () => {
    if (selectedTrainingIndex < 0 || !selectedEmp) {
      alert('Please select employee and training');
      return;
    }

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
    setEmployees((prevEmp) =>
      prevEmp.map((emp) => {
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

  const pendingTrainings = trainings.filter((t) => t.status === 'Pending');
  const scheduledTrainings = trainings.filter((t) => t.status === 'Scheduled');

  return (
    <div className="flex min-h-screen w-full bg-gray-50">
      <Sidebar />

      <div className="flex-1 flex flex-col">
        <Navbar />

        <div className="flex-1 overflow-y-auto">
          <div className="min-h-full bg-gray-50">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-20">
              <h1 className="text-xl md:text-2xl font-semibold text-gray-800">
                Brisk Olive – Training Automation HRMS
              </h1>
            </header>

            {/* Tabs Navigation */}
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

            {/* Main Content */}
            <main className="container mx-auto p-5 md:p-6 max-w-7xl pb-12">
              {/* HR Tab */}
              {activeTab === 'hr' && (
                <div className="space-y-8">
                  {/* Proposal Form */}
                  <div className="bg-white p-6 rounded-xl shadow-md">
                    <h3 className="text-xl font-bold text-gray-800 mb-6">
                      HR – Training Proposal & Scheduling
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

                  {/* All Trainings Table */}
                  <div className="bg-white p-6 rounded-xl shadow-md">
                    <h4 className="text-lg font-bold text-gray-800 mb-4">
                      All Trainings – HR Control Panel
                    </h4>

                    {trainings.length === 0 ? (
                      <p className="text-gray-500 text-center py-8">
                        No trainings have been submitted yet.
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Topic
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Trainer
                              </th>
                              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Status
                              </th>
                              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Date & Time
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
                            {trainings.map((t) => (
                              <tr key={t._id || t.topic} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap">{t.topic}</td>
                                <td className="px-6 py-4 whitespace-nowrap">{t.trainerName}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                  <span
                                    className={`font-bold ${
                                      t.status === 'Approved' ? 'text-green-600' :
                                      t.status === 'Rejected' ? 'text-red-600' :
                                      t.status === 'Scheduled' ? 'text-blue-600' :
                                      'text-yellow-600'
                                    }`}
                                  >
                                    {t.status}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                  {t.date || '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-center space-x-2">
                                  {t.status === 'Approved' && (
                                    <button
                                      onClick={() => openScheduleModal(t, false)}
                                      className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 text-sm transition"
                                      disabled={savingSchedule}
                                    >
                                      Schedule
                                    </button>
                                  )}
                                  {t.status === 'Scheduled' && (
                                    <button
                                      onClick={() => openScheduleModal(t, true)}
                                      className="bg-purple-600 text-white px-3 py-1 rounded hover:bg-purple-700 text-sm transition"
                                      disabled={savingSchedule}
                                    >
                                      Reschedule
                                    </button>
                                  )}
                                </td>
                                <td className="px-6 py-4">{t.reason || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Management Tab */}
              {activeTab === 'mgmt' && (
                <div className="bg-white p-6 rounded-xl shadow-md mb-8">
                  <h3 className="text-xl font-bold text-gray-800 mb-6">
                    Management – Approve / Reject Proposals
                  </h3>

                  {pendingTrainings.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">
                      No pending training proposals at the moment.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Topic
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Trainer
                            </th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {pendingTrainings.map((t) => (
                            <tr key={t._id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap">{t.topic}</td>
                              <td className="px-6 py-4 whitespace-nowrap">{t.trainerName}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-center space-x-3">
                                <button
                                  onClick={() => approve(t._id!)}
                                  className="bg-green-600 text-white px-4 py-1.5 rounded hover:bg-green-700 text-sm"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => openRejectModal(t._id!)}
                                  className="bg-red-600 text-white px-4 py-1.5 rounded hover:bg-red-700 text-sm"
                                >
                                  Reject
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Employee Feedback Tab */}
              {activeTab === 'emp' && (
                <div className="bg-white p-6 rounded-xl shadow-md mb-8">
                  <h3 className="text-xl font-bold text-gray-800 mb-6">
                    Training Feedback & Attendance
                  </h3>

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
                            {emp.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-medium text-gray-700 mb-1">Training Session</label>
                      <select
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={selectedTrainingIndex}
                        onChange={(e) => setSelectedTrainingIndex(Number(e.target.value))}
                      >
                        <option value={-1}>-- Select Training --</option>
                        {scheduledTrainings.map((t, i) => (
                          <option key={i} value={trainings.indexOf(t)}>
                            {t.topic} ({t.date || 'Date TBD'})
                          </option>
                        ))}
                      </select>
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

                  <div className="mt-8 flex flex-wrap gap-4">
                    <button
                      onClick={submitFeedback}
                      className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition shadow-sm"
                    >
                      Submit Feedback
                    </button>

                    <button
                      onClick={finalizeAttendance}
                      className="bg-gray-700 text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-800 transition shadow-sm"
                    >
                      Finalize Attendance (Apply Penalties)
                    </button>
                  </div>
                </div>
              )}

              {/* Scorecard Tab */}
              {activeTab === 'score' && (
                <div className="bg-white p-6 rounded-xl shadow-md mb-8">
                  <h3 className="text-xl font-bold text-gray-800 mb-6">
                    Employee Training Scorecard
                  </h3>

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
              Reject Training Proposal
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

      {/* Schedule / Reschedule Modal with Calendar + Time Picker */}
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
              <label className="block font-medium text-gray-700 mb-2">
                Date & Time
              </label>
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