'use client';

import { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import { Search, Loader2, FileText, User, Phone, Building2, Briefcase } from 'lucide-react';
import { ChevronDownIcon, DocumentTextIcon } from '@heroicons/react/24/outline';

interface CTCComponent {
  _id: string;
  name: string;
  code: string;
  formula: string;
  order: number;
  is_active: boolean;
  show_in_documents: boolean;
}

// Sourced from Onboarding (the single source of truth), not a separate
// Employee collection — is_current/is_exited are real, persisted values,
// not a client-only flag that resets on reload.
interface Employee {
  _id: string;
  employee_id: string;
  full_name: string;
  department: string;
  designation: string;
  joining_date: string | null;
  employee_category: string;
  mobile: string;
  photo?: string;
  is_current: boolean;
  is_exited: boolean;
  annual_ctc: number;
  monthly_ctc: number;
  contract_amount: number | null;
  contract_period_months: number | null;
  sal_applicable_from: string | null;
  basic: string;
  hra: string;
  telephone_allowance: string;
  travel_allowance: string;
  childrens_education_allowance: string;
  employer_pf: string;
  employer_esi: string;
  annual_bonus: string;
  annual_performance_incentive: string;
  medical_premium: string;
  medical_reimbursement_annual: string;
  vehicle_reimbursement_annual: string;
  driver_reimbursement_annual: string;
  telephone_reimbursement_annual: string;
  meals_reimbursement_annual: string;
  uniform_reimbursement_annual: string;
  leave_travel_allowance_annual: string;
  gross_monthly: string;
  gratuity: string;
}

const categories = ['All', 'Employee', 'Consultant', 'Intern', 'Temporary Staff', 'Contract Based'];
const API_BASE = process.env.REACT_APP_REACT_APP_API_BASE_URL;

const CATEGORY_COLORS: Record<string, string> = {
  Employee: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  Consultant: 'bg-amber-50 text-amber-700 border-amber-200',
  Intern: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Temporary Staff': 'bg-sky-50 text-sky-700 border-sky-200',
  'Contract Based': 'bg-rose-50 text-rose-700 border-rose-200',
};

export default function EmployeeContractsPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [ctcComponents, setCtcComponents] = useState<CTCComponent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [tab, setTab] = useState<'active' | 'archive'>('active');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch employees — same Onboarding source used by the Employees page,
  // just with the fuller CTC field set this page needs. Current AND
  // exited both come back together, split into tabs below via the real
  // is_current/is_exited flags.
  const fetchEmployees = async () => {
    try {
      const res = await fetch(`${API_BASE}/onboarding/employee-letters-source`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      let employeeData: Employee[] = data?.data ?? [];
      employeeData = employeeData.sort((a, b) =>
        (a.full_name || '').localeCompare(b.full_name || '')
      );
      setEmployees(employeeData);
    } catch (err) {
      console.error('Failed to fetch employees:', err);
      setEmployees([]);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  // Fetch CTC Components
  useEffect(() => {
    const fetchCtc = async () => {
      try {
        const res = await fetch(`${API_BASE}/ctc-components/`);
        if (!res.ok) throw new Error('Failed to fetch CTC components');
        const data = await res.json();
        if (!Array.isArray(data)) throw new Error('Invalid CTC data format');
        setCtcComponents(
          data
            .filter((c: CTCComponent) => c.is_active)
            .sort((a: CTCComponent, b: CTCComponent) => a.order - b.order)
        );
      } catch (err: any) {
        setError('Failed to load CTC components');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchCtc();
  }, []);

  const activeEmployees = employees.filter((e) => e.is_current);
  const archivedEmployees = employees.filter((e) => e.is_exited);
  const currentList = tab === 'active' ? activeEmployees : archivedEmployees;

  const filtered = currentList.filter((emp) => {
    const matchesSearch =
      emp.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.employee_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.department?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || emp.employee_category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const formatSalary = (salary: number | string | null) => {
    const num = Number(salary);
    if (isNaN(num) || num === 0) return '—';
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(num);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '—';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid date';
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const getInitials = (name: string) =>
    (name || '').split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) || '??';

  const fieldMap: Record<string, keyof Employee> = {
    BASIC: 'basic',
    HRA: 'hra',
    TELEPHONE: 'telephone_allowance',
    CONVEYANCE: 'travel_allowance',
    EDUCATION: 'childrens_education_allowance',
    GROSS_MONTHLY: 'gross_monthly',
    ESIC: 'employer_esi',
    PF: 'employer_pf',
    MONTHLY_CTC: 'monthly_ctc',
    MED_REIMB: 'medical_reimbursement_annual',
    VEHICLE: 'vehicle_reimbursement_annual',
    DRIVER: 'driver_reimbursement_annual',
    TEL_REIMB: 'telephone_reimbursement_annual',
    MEALS: 'meals_reimbursement_annual',
    UNIFORM: 'uniform_reimbursement_annual',
    LTA: 'leave_travel_allowance_annual',
    ANNUAL_BONUS: 'annual_bonus',
    PERF_INCENTIVE: 'annual_performance_incentive',
    MED_PREMIUM: 'medical_premium',
    GRATUITY: 'gratuity',
    ANNUAL_CTC: 'annual_ctc',
  };

  const letterItems = [
    { type: 'salary-revision', label: 'Employee Letter' },
    { type: 'confirmation', label: 'Confirmation Letter' },
    { type: 'consultant-contract', label: 'Consultant Contract' },
    { type: 'salary-breakdown', label: 'Salary Breakdown' },
    { type: 'non-compete-agreement', label: 'Non-Compete Agreement' },
    { type: 'non-disclosure-agreement', label: 'Non Disclosure Agreement' },
    { type: 'code-of-ethics', label: 'Code of Ethics' },
    { type: 'internship-certificate', label: 'Internship Certificate' },
    { type: 'experience-certificate', label: 'Experience Certificate' },
    {
      type: 'exit-clearance',
      label: 'Exit Clearance Form',
      directLink: 'https://docs.google.com/document/d/1d8MFqQAISbuOwP0SGM3IWBWf2J2V9s1O/edit',
    },
    { type: 'Appointment-letter', label: 'Appointment Letter' },
    { type: 'offer-letter', label: 'Offer Letter' },
  ];

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <div className="fixed inset-y-0 left-0 w-64 bg-white shadow-sm overflow-y-auto z-10">
        <Sidebar />
      </div>

      <div className="flex-1 flex flex-col ml-64">
        <div className="fixed top-0 left-64 right-0 z-40 bg-white shadow-sm">
          <Navbar />
        </div>

        <main className="flex-1 overflow-y-auto pt-20 pb-10 px-8">
          <div className="max-w-7xl mx-auto">

            {/* Header */}
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Employee Documents</h1>
              <p className="text-sm text-slate-500 mt-1">Manage contracts, CTC and generate employee letters</p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
                {error}
              </div>
            )}

            {/* Filters bar */}
            <div className="flex flex-wrap gap-3 mb-6 items-center bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
                <button
                  onClick={() => setTab('active')}
                  className={`px-4 py-2 rounded-md font-medium text-sm transition ${
                    tab === 'active' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Active <span className="text-slate-400">({activeEmployees.length})</span>
                </button>
                <button
                  onClick={() => setTab('archive')}
                  className={`px-4 py-2 rounded-md font-medium text-sm transition ${
                    tab === 'archive' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Archive <span className="text-slate-400">({archivedEmployees.length})</span>
                </button>
              </div>

              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-4 py-2 border border-slate-200 rounded-lg bg-white text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-200"
              >
                {categories.map((cat) => (
                  <option key={cat}>{cat}</option>
                ))}
              </select>

              <div className="relative flex-1 min-w-[240px]">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                <input
                  type="text"
                  placeholder="Search by name, ID or department..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center py-24">
                <Loader2 className="h-9 w-9 animate-spin text-slate-400" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                  <User className="text-slate-400" size={28} />
                </div>
                <p className="text-slate-500 font-medium">No employees found</p>
                <p className="text-slate-400 text-sm mt-1">Try adjusting your search or filters</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filtered.map((emp) => {
                  const catStyle = CATEGORY_COLORS[emp.employee_category] || 'bg-slate-50 text-slate-600 border-slate-200';
                  return (
                    <div
                      key={emp._id}
                      onClick={() => setSelectedEmployee(emp)}
                      className="bg-white rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-md cursor-pointer transition-all p-5 group"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          {emp.photo ? (
                            <img
                              src={emp.photo}
                              alt={emp.full_name}
                              className="w-12 h-12 rounded-full object-cover border border-slate-200"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-slate-900 flex items-center justify-center text-white text-sm font-semibold">
                              {getInitials(emp.full_name)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 text-sm truncate">{emp.full_name || 'Unnamed'}</p>
                            <p className="text-xs text-slate-400">{emp.employee_id || 'No ID'}</p>
                          </div>
                        </div>
                      </div>

                      <div className="mb-3 space-y-1">
                        <p className="text-sm font-medium text-slate-700 truncate flex items-center gap-1.5">
                          <Briefcase size={13} className="text-slate-400 flex-shrink-0" />
                          {emp.designation || '—'}
                        </p>
                        <p className="text-xs text-slate-500 truncate flex items-center gap-1.5">
                          <Building2 size={13} className="text-slate-400 flex-shrink-0" />
                          {emp.department || '—'}
                        </p>
                      </div>

                      {emp.employee_category && (
                        <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full border mb-3 ${catStyle}`}>
                          {emp.employee_category}
                        </span>
                      )}

                      <div className="pt-3 border-t border-slate-100 space-y-1.5">
                        <div className="flex justify-between items-baseline">
                          <span className="text-xs text-slate-500">Annual CTC</span>
                          <span className="font-bold text-slate-900 text-sm">{formatSalary(emp.annual_ctc)}</span>
                        </div>
                        <div className="flex justify-between items-baseline">
                          <span className="text-xs text-slate-500">Monthly CTC</span>
                          <span className="font-semibold text-slate-600 text-sm">{formatSalary(emp.monthly_ctc)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Employee Details Modal */}
      {selectedEmployee && (
        <div
          className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedEmployee(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedEmployee(null)}
              className="absolute top-4 right-4 z-10 text-slate-400 hover:text-slate-700 text-3xl font-light w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-100 transition"
              aria-label="Close"
            >
              ×
            </button>

            <div className="flex items-start gap-4 p-6 border-b border-slate-100 bg-slate-50/50">
              <div className="flex-shrink-0">
                {selectedEmployee.photo ? (
                  <img
                    src={selectedEmployee.photo}
                    alt={selectedEmployee.full_name}
                    className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-sm"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-slate-900 flex items-center justify-center text-white text-xl font-semibold shadow-sm">
                    {getInitials(selectedEmployee.full_name)}
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="text-lg font-bold text-slate-900 truncate">
                      {selectedEmployee.full_name || 'Unnamed Employee'}
                    </h2>
                    <p className="text-sm text-slate-600 mt-0.5">
                      {selectedEmployee.designation || '—'} • {selectedEmployee.department || '—'}
                    </p>
                  </div>

                  {/* Letters Dropdown — moved up next to the profile so it's
                      immediately visible, rather than buried at the bottom */}
                  <div className="relative flex-shrink-0">
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 transition focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      onClick={() => document.getElementById('letter-dropdown')?.classList.toggle('hidden')}
                    >
                      <DocumentTextIcon className="h-4 w-4" />
                      Download Documents
                      <ChevronDownIcon className="h-4 w-4" aria-hidden="true" />
                    </button>

                    <div
                      id="letter-dropdown"
                      className="hidden absolute right-0 z-10 mt-2 w-72 origin-top-right rounded-lg bg-white shadow-xl ring-1 ring-slate-200 focus:outline-none overflow-hidden"
                    >
                      <div className="py-1 max-h-80 overflow-y-auto">
                        {letterItems.map((item) => (
                          <button
                            key={item.type}
                            onClick={() => {
                              if (!selectedEmployee) return;

                              if (item.directLink) {
                                window.open(item.directLink, '_blank', 'noopener,noreferrer');
                              } else {
                                const params = new URLSearchParams({
                                  type: item.type,
                                  empId: selectedEmployee._id,
                                  name: selectedEmployee.full_name || '',
                                  dept: selectedEmployee.department || '',
                                  desig: selectedEmployee.designation || '',
                                  joining: formatDate(selectedEmployee.joining_date),
                                  ctc: (selectedEmployee.annual_ctc || 0).toString(),
                                });
                                window.open(`/letter?${params.toString()}`, '_blank');
                              }

                              document.getElementById('letter-dropdown')?.classList.add('hidden');
                            }}
                            className="flex items-center gap-2.5 w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 transition"
                          >
                            <FileText size={15} className="text-slate-400 flex-shrink-0" />
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-500">
                  <span className="flex items-center gap-1"><User size={12} /> {selectedEmployee.employee_id || '—'}</span>
                  <span className="flex items-center gap-1"><Phone size={12} /> {selectedEmployee.mobile || '—'}</span>
                  <span>{selectedEmployee.employee_category || '—'}</span>
                  <span>Joined {formatDate(selectedEmployee.joining_date)}</span>
                </div>
              </div>
            </div>

            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-base font-semibold text-slate-900">Current CTC</h3>
                <span className="text-xs text-slate-400">Editable via Salary Revision</span>
              </div>

              <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
                <div className="grid grid-cols-3 gap-4 mb-5 text-center">
                  {[
                    { label: 'Annual CTC', value: formatSalary(selectedEmployee.annual_ctc) },
                    { label: 'Monthly CTC', value: formatSalary(selectedEmployee.monthly_ctc) },
                    { label: 'Effective From', value: formatDate(selectedEmployee.sal_applicable_from) },
                  ].map((item) => (
                    <div key={item.label} className="bg-white rounded-lg py-3 border border-slate-100">
                      <p className="text-xs text-slate-500 mb-1">{item.label}</p>
                      <p className="font-bold text-slate-900 text-sm">{item.value}</p>
                    </div>
                  ))}
                </div>

                <h4 className="text-sm font-semibold text-slate-700 mb-3">CTC Breakdown</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                  {ctcComponents.map((comp) => {
                    const field = fieldMap[comp.code] || 'basic';
                    const value = Number(selectedEmployee[field as keyof Employee]) || 0;

                    return (
                      <div
                        key={comp._id}
                        className="bg-white rounded-lg p-3 text-center border border-slate-100"
                      >
                        <p className="text-[11px] font-medium text-slate-500 mb-1 truncate">{comp.name}</p>
                        <p className="text-sm font-bold text-slate-900">
                          {formatSalary(value)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}