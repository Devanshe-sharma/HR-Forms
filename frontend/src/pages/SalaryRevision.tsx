'use client';

import { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import { Search, Trash2, Edit2, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ChevronDownIcon, DocumentTextIcon } from '@heroicons/react/24/outline';

interface CTCComponent {
  id: number;
  name: string;
  code: string;
  formula: string;
  order: number;
  is_active: boolean;
  show_in_documents: boolean;
}

interface Employee {
  id: number;
  employee_id: string;
  full_name: string;
  department: string;
  designation: string;
  joining_date: string;
  employee_category: string;
  mobile: string;
  photo?: string;
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
  supplementary_allowance: string;
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
  archived?: boolean;
}

const categories = ['All', 'Employee', 'Consultant', 'Intern', 'Temporary Staff', 'Contract Based'];
const API_BASE = 'https://hr-forms.onrender.com/api';

export default function EmployeeContractsPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [ctcComponents, setCtcComponents] = useState<CTCComponent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [tab, setTab] = useState<'active' | 'archive'>('active');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [showContractModal, setShowContractModal] = useState(false);

  // Form state for editable fields (key = field name in Employee model)
  const [contractForm, setContractForm] = useState<Record<string, number>>({
    basic: 0,
    hra: 0,
    telephone_allowance: 0,
    travel_allowance: 0,
    childrens_education_allowance: 0,
    supplementary_allowance: 0,
    employer_pf: 0,
    employer_esi: 0,
    annual_bonus: 0,
    annual_performance_incentive: 0,
    medical_premium: 0,
    medical_reimbursement_annual: 0,
    vehicle_reimbursement_annual: 0,
    driver_reimbursement_annual: 0,
    telephone_reimbursement_annual: 0,
    meals_reimbursement_annual: 0,
    uniform_reimbursement_annual: 0,
    leave_travel_allowance_annual: 0,
    contract_amount: 0,
    contract_period_months: 12,
  });

  // Fetch employees
  useEffect(() => {
    fetch(`${API_BASE}/employees/`)
      .then((res) => res.json())
      .then((data) => {
        setEmployees(
          data.map((emp: any) => ({
            ...emp,
            archived: false,
          }))
        );
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  // Fetch CTC Components
  useEffect(() => {
    fetch(`${API_BASE}/ctc-components/`)
      .then((res) => res.json())
      .then((data) => {
        setCtcComponents(
          data
            .filter((c: CTCComponent) => c.is_active)
            .sort((a: CTCComponent, b: CTCComponent) => a.order - b.order)
        );
      })
      .catch((err) => console.error('Failed to load CTC components', err));
  }, []);

  const activeEmployees = employees.filter((e) => !e.archived);
  const archivedEmployees = employees.filter((e) => e.archived);
  const currentList = tab === 'active' ? activeEmployees : archivedEmployees;

  const filtered = currentList.filter((emp) => {
    const matchesSearch =
      emp.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.employee_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.department.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || emp.employee_category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const formatSalary = (salary: number | string) => {
    const num = Number(salary);
    if (!num || num === 0) return '—';
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(num);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const getInitials = (name: string) =>
    name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

  const openContractModal = (emp: Employee) => {
    setSelectedEmployee(emp);

    // Pre-fill form with current values from employee
    const initialForm: Record<string, number> = {
      basic: Number(emp.basic) || 0,
      hra: Number(emp.hra) || 0,
      telephone_allowance: Number(emp.telephone_allowance) || 0,
      travel_allowance: Number(emp.travel_allowance) || 0,
      childrens_education_allowance: Number(emp.childrens_education_allowance) || 0,
      supplementary_allowance: Number(emp.supplementary_allowance) || 0,
      employer_pf: Number(emp.employer_pf) || 0,
      employer_esi: Number(emp.employer_esi) || 0,
      annual_bonus: Number(emp.annual_bonus) || 0,
      annual_performance_incentive: Number(emp.annual_performance_incentive) || 0,
      medical_premium: Number(emp.medical_premium) || 0,
      medical_reimbursement_annual: Number(emp.medical_reimbursement_annual) || 0,
      vehicle_reimbursement_annual: Number(emp.vehicle_reimbursement_annual) || 0,
      driver_reimbursement_annual: Number(emp.driver_reimbursement_annual) || 0,
      telephone_reimbursement_annual: Number(emp.telephone_reimbursement_annual) || 0,
      meals_reimbursement_annual: Number(emp.meals_reimbursement_annual) || 0,
      uniform_reimbursement_annual: Number(emp.uniform_reimbursement_annual) || 0,
      leave_travel_allowance_annual: Number(emp.leave_travel_allowance_annual) || 0,
      contract_amount: Number(emp.contract_amount) || 0,
      contract_period_months: Number(emp.contract_period_months) || 12,
    };

    setContractForm(initialForm);
    setShowContractModal(true);
  };

  const saveContract = async () => {
    if (!selectedEmployee) return;

    // Prepare payload - only include fields that exist in Employee model
    const payload: Record<string, any> = {
      contract_amount: contractForm.contract_amount ? Number(contractForm.contract_amount) : null,
      contract_period_months: contractForm.contract_period_months ? Number(contractForm.contract_period_months) : null,
      sal_applicable_from: contractForm.start_date || null,
    };

    // Add all editable CTC fields
    Object.entries(contractForm).forEach(([key, value]) => {
      if (key !== 'contract_amount' && key !== 'contract_period_months' && key !== 'start_date') {
        payload[key] = Number(value) || 0;
      }
    });

    console.log('PATCH Payload to Employee:', payload);

    try {
      const res = await fetch(`${API_BASE}/employees/${selectedEmployee.id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let errorMessage = await res.text();
        try {
          const jsonError = await res.json();
          errorMessage = jsonError.detail || JSON.stringify(jsonError);
        } catch {}
        console.error('Server Error:', res.status, errorMessage);
        throw new Error(`Failed: ${res.status} - ${errorMessage.slice(0, 200)}...`);
      }

      const updated = await res.json();
      console.log('Updated Employee:', updated);

      // Update local state with fresh data
      setEmployees((prev) => prev.map((e) => (e.id === selectedEmployee.id ? updated : e)));
      setShowContractModal(false);
      alert('CTC updated successfully! All fields saved.');
    } catch (err: any) {
      console.error('Save failed:', err);
      alert('Failed to save: ' + err.message);
    }
  };

  const archiveEmployee = (employee: Employee) => {
    setEmployees((prev) => prev.map((e) => (e.id === employee.id ? { ...e, archived: true } : e)));
    setSelectedEmployee(null);
  };

//   const downloadLetter = (letterType: string) => {
//   if (!selectedEmployee) return;

//   const params = new URLSearchParams({
//     type: letterType,
//     empId: selectedEmployee.employee_id,
//     name: selectedEmployee.full_name,
//     dept: selectedEmployee.department,
//     desig: selectedEmployee.designation,
//     joining: formatDate(selectedEmployee.joining_date),
//     ctc: (selectedEmployee.annual_ctc || 0).toString(),
//     // Add more params if needed: contract_amount, etc.
//   });

//   // Opens in new tab
//   window.open(`/letter?${params.toString()}`, '_blank');
// };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Fixed Sidebar */}
      <div className="fixed inset-y-0 left-0 z-1 w-64 bg-white shadow-lg overflow-y-auto">
        <Sidebar />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col ml-64">
        {/* Fixed Navbar */}
        <div className="fixed top-0 left-64 right-0 z-40 bg-white shadow-md">
          <Navbar />
        </div>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto pt-20 pb-10 px-6">
          <div className="max-w-7xl mx-auto">
            {/* Page Header */}
            <div className="flex justify-between items-center mb-8 mt-8">
              <h1 className="text-3xl font-bold text-gray-800">Employee Documents</h1>
              <Link to="/ctc-components">
                <button className="flex items-center gap-3 px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-semibold shadow-lg transition">
                  <Settings size={22} />
                  Manage CTC Components
                </button>
              </Link>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-4 mb-8 items-center">
              <div className="flex gap-3">
                <button
                  onClick={() => setTab('active')}
                  className={`px-6 py-3 rounded-xl font-medium transition ${
                    tab === 'active' ? 'bg-gray-800 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Active ({activeEmployees.length})
                </button>
                <button
                  onClick={() => setTab('archive')}
                  className={`px-6 py-3 rounded-xl font-medium transition ${
                    tab === 'archive' ? 'bg-gray-800 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Archive ({archivedEmployees.length})
                </button>
              </div>

              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-5 py-3 border border-gray-300 rounded-xl bg-white font-medium"
              >
                {categories.map((cat) => (
                  <option key={cat}>{cat}</option>
                ))}
              </select>

              <div className="relative flex-1 max-w-lg">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={22} />
                <input
                  type="text"
                  placeholder="Search employees..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-6 py-3 border border-gray-300 rounded-xl focus:outline-none focus:border-teal-500 text-lg"
                />
              </div>
            </div>

            {/* Employee Grid */}
            {loading ? (
              <p className="text-center py-20 text-gray-500 text-xl">Loading employees...</p>
            ) : filtered.length === 0 ? (
              <p className="text-center py-20 text-gray-500 text-xl">No employees found</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
                {filtered.map((emp) => (
                  <div
                    key={emp.id}
                    onClick={() => setSelectedEmployee(emp)}
                    className="bg-white rounded-2xl shadow-lg hover:shadow-2xl cursor-pointer transition-all p-6 border border-gray-100"
                  >
                    <div className="flex items-center gap-5 mb-5">
                      {emp.photo ? (
                        <img
                          src={emp.photo}
                          alt={emp.full_name}
                          className="w-16 h-16 rounded-full object-cover border-4 border-gray-200"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center text-white text-2xl font-bold">
                          {getInitials(emp.full_name)}
                        </div>
                      )}
                      <div>
                        <p className="font-bold text-gray-900 text-lg truncate">{emp.full_name}</p>
                        <p className="text-sm text-gray-500">{emp.employee_id}</p>
                      </div>
                    </div>
                    <p className="text-base text-gray-700 mb-2 font-medium truncate">{emp.designation}</p>
                    <p className="text-sm text-gray-500 mb-6 truncate">{emp.department}</p>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600 font-medium">Annual CTC</span>
                        <span className="font-bold text-teal-700 text-lg">{formatSalary(emp.annual_ctc || 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 font-medium">Monthly CTC</span>
                        <span className="font-semibold text-teal-600">{formatSalary(emp.monthly_ctc || 0)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Employee Details Modal */}
{selectedEmployee && (
  <div
    className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
    onClick={() => setSelectedEmployee(null)}
  >
    <div
      className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto relative"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Prominent Close Button */}
      <button
        onClick={() => setSelectedEmployee(null)}
        className="absolute top-4 right-4 z-10 text-gray-500 hover:text-gray-800 text-4xl font-light p-2 rounded-full hover:bg-gray-100 transition"
        aria-label="Close modal"
      >
        ×
      </button>

      {/* Compact Header */}
      <div className="flex items-start gap-5 p-5 border-b">
        <div className="flex-shrink-0">
          {selectedEmployee.photo ? (
            <img
              src={selectedEmployee.photo}
              alt={selectedEmployee.full_name}
              className="w-20 h-20 rounded-full object-cover border-4 border-gray-200 shadow-sm"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center text-white text-2xl font-bold shadow-sm">
              {getInitials(selectedEmployee.full_name)}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold text-gray-900 truncate">
            {selectedEmployee.full_name}
          </h2>
          <p className="text-base text-gray-600 mt-1">
            {selectedEmployee.designation} • {selectedEmployee.department}
          </p>

          <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
            <p><span className="font-medium">ID:</span> {selectedEmployee.employee_id}</p>
            <p><span className="font-medium">Mobile:</span> {selectedEmployee.mobile}</p>
            <p><span className="font-medium">Category:</span> {selectedEmployee.employee_category}</p>
            <p><span className="font-medium">Joining:</span> {formatDate(selectedEmployee.joining_date)}</p>
          </div>
        </div>

        {/* Close & Archive */}
        <div className="flex flex-col items-end gap-2">
          <button
            onClick={() => setSelectedEmployee(null)}
            className="text-gray-400 hover:text-gray-600 text-3xl leading-none"
          >
            ×
          </button>
          {tab === 'active' && (
            <button
              onClick={() => archiveEmployee(selectedEmployee)}
              className="px-4 py-1.5 bg-red-50 text-red-700 rounded-md hover:bg-red-100 text-sm font-medium flex items-center gap-1.5"
            >
              <Trash2 size={14} /> Archive
            </button>
          )}
        </div>
      </div>

      {/* Current Active Contract */}
      <div className="p-5">
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-lg font-bold text-gray-900">Current Active Contract</h3>
          <button
            onClick={() => openContractModal(selectedEmployee)}
            className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-medium"
          >
            <Edit2 size={14} /> Update CTC
          </button>
        </div>

              <div className="bg-gray-50 rounded-xl p-5">
                <div className="grid grid-cols-3 gap-4 mb-5 text-center text-sm">
                  <div>
                    <p className="text-gray-600">Annual CTC</p>
                    <p className="font-bold text-teal-700 text-base">
                      {formatSalary(selectedEmployee.annual_ctc || 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Monthly CTC</p>
                    <p className="font-bold text-teal-700 text-base">
                      {formatSalary(selectedEmployee.monthly_ctc || 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Effective From</p>
                    <p className="font-medium text-teal-700 text-base">
                      {selectedEmployee.sal_applicable_from ? formatDate(selectedEmployee.sal_applicable_from) : 'Not set'}
                    </p>
                  </div>
                </div>

                {/* Compact CTC Breakdown */}
                <h4 className="text-base font-semibold text-gray-800 mb-3">CTC Breakdown</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {ctcComponents.map((comp) => {
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

                    const field = fieldMap[comp.code] || 'basic';
                    const value = Number(selectedEmployee[field]) || 0;

                    return (
                      <div
                        key={comp.id}
                        className="bg-white rounded-lg p-3 shadow-sm text-center border border-gray-100"
                      >
                        <p className="text-xs font-medium text-gray-600 mb-1 truncate">{comp.name}</p>
                        <p className="text-base font-bold text-teal-700">
                          {formatSalary(value)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Document Letters Dropdown */}
      <div className="p-5 border-t">
        <div className="relative inline-block text-left w-full">
          <div>
            <button
              type="button"
              className="inline-flex w-full justify-center gap-x-3 rounded-md bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              onClick={() => document.getElementById('letter-dropdown')?.classList.toggle('hidden')}
            >
              <DocumentTextIcon className="h-5 w-5" />
              Download Documents
              <ChevronDownIcon className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          <div
            id="letter-dropdown"
            className="hidden absolute right-0 z-10 mt-2 w-72 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none"
          >
            <div className="py-1">
              {[
                { type: 'salary-revision', label: 'Salary Revision Letter' },
                { type: 'confirmation', label: 'Confirmation Letter' },
                { type: 'consultant-contract', label: 'Consultant Contract' },
                { type: 'salary-breakdown', label: 'Salary Breakdown' },
                { type: 'non-compete-agreement', label: 'Non-Compete Agreement' },
                { type: 'non-disclosure-agreement', label: 'Non Disclosure Agreement' },
                { type: 'code-of-ethics', label: 'Code of Ethics' },
              ].map((item) => (
                <button
                  key={item.type}
                  onClick={() => {
                    if (!selectedEmployee) return;
                    const params = new URLSearchParams({
                      type: item.type,
                      empId: selectedEmployee.id.toString(),
                      name: selectedEmployee.full_name,
                      dept: selectedEmployee.department,
                      desig: selectedEmployee.designation,
                      joining: formatDate(selectedEmployee.joining_date),
                      ctc: (selectedEmployee.annual_ctc || 0).toString(),
                    });
                    window.open(`/letter?${params.toString()}`, '_blank');
                    // Optional: close dropdown
                    document.getElementById('letter-dropdown')?.classList.add('hidden');
                  }}
                  className="block w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-100"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
)}

      {/* Compact Contract Update Modal */}
      {showContractModal && selectedEmployee && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
          onClick={() => setShowContractModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Prominent Close Button */}
            <button
              onClick={() => setShowContractModal(false)}
              className="absolute top-4 right-4 z-10 text-gray-500 hover:text-gray-800 text-4xl font-light p-2 rounded-full hover:bg-gray-100 transition"
              aria-label="Close modal"
            >
              ×
            </button>

            {/* Header */}
            <div className="p-6 pb-4 border-b">
              <h2 className="text-2xl font-bold text-gray-900">
                Update CTC — {selectedEmployee.full_name}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {selectedEmployee.designation} • {selectedEmployee.department}
              </p>
            </div>

            {/* Current Saved Snapshot */}
            <div className="p-6 pb-4 bg-gray-50 border-b">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Currently Saved</h3>
              <div className="grid grid-cols-3 gap-6 text-sm">
                <div>
                  <p className="text-gray-600">Annual CTC</p>
                  <p className="font-bold text-teal-700">{formatSalary(selectedEmployee.annual_ctc || 0)}</p>
                </div>
                <div>
                  <p className="text-gray-600">Monthly CTC</p>
                  <p className="font-bold text-teal-700">{formatSalary(selectedEmployee.monthly_ctc || 0)}</p>
                </div>
                <div>
                  <p className="text-gray-600">Effective From</p>
                  <p className="font-medium text-teal-700">
                    {selectedEmployee.sal_applicable_from ? formatDate(selectedEmployee.sal_applicable_from) : 'Not set'}
                  </p>
                </div>
              </div>
            </div>

            {/* Editable Fields - Compact Grid */}
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Edit CTC Components</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {ctcComponents.map((comp) => {
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

                  const field = fieldMap[comp.code] || 'basic';
                  const savedValue = Number(selectedEmployee[field]) || 0;

                  return (
                    <div key={comp.id} className="space-y-1">
                      <label className="block text-xs font-medium text-gray-700 truncate">
                        {comp.name}
                      </label>
                      <input
                        type="number"
                        value={contractForm[field] ?? savedValue}
                        onChange={(e) => {
                          const value = Number(e.target.value) || 0;
                          setContractForm((prev) => ({
                            ...prev,
                            [field]: value,
                          }));
                        }}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                        placeholder="0"
                      />
                    </div>
                  );
                })}
              </div>

              {/* Live Total Preview */}
              <div className="mt-6 p-4 bg-teal-50 rounded-xl text-center">
                <p className="text-sm text-gray-600">New Estimated Annual CTC</p>
                <p className="text-2xl font-bold text-teal-700 mt-1">
                  {formatSalary(
                    Object.values(contractForm).reduce<number>((sum, val) => sum + Number(val || 0), 0)
                  )}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-4 p-6 border-t">
              <button
                onClick={() => setShowContractModal(false)}
                className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={saveContract}
                className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-medium shadow"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}