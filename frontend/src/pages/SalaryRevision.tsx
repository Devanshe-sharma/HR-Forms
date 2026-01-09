'use client';

import { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import { Search, Trash2, ChevronDown, Upload, Download, Edit2, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';

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
  // CTC fields (as strings from API)
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

  const [contractForm, setContractForm] = useState({
    annual_ctc: 0,
    contract_period_months: 12,
    start_date: new Date().toISOString().split('T')[0],
  });

  // Fetch employees
  useEffect(() => {
    fetch(`${API_BASE}/employees/`)
      .then(res => res.json())
      .then(data => {
        setEmployees(data.map((emp: any) => ({
          ...emp,
          archived: false,
        })));
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  // Fetch CTC Components
  useEffect(() => {
    fetch(`${API_BASE}/ctc-components/`)
      .then(res => res.json())
      .then(data => {
        setCtcComponents(
          data
            .filter((c: CTCComponent) => c.is_active)
            .sort((a: CTCComponent, b: CTCComponent) => a.order - b.order)
        );
      })
      .catch(err => console.error('Failed to load CTC components', err));
  }, []);

  const activeEmployees = employees.filter(e => !e.archived);
  const archivedEmployees = employees.filter(e => e.archived);
  const currentList = tab === 'active' ? activeEmployees : archivedEmployees;

  const filtered = currentList.filter(emp => {
    const matchesSearch = emp.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
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

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  // Fixed: getActiveContract implemented (currently using direct fields)
  const getActiveContract = (emp: Employee) => {
    return {
      contract_amount: emp.contract_amount || emp.annual_ctc || 0,
      contract_period_months: emp.contract_period_months || 12,
      start_date: emp.sal_applicable_from || '',
      breakdown: {} as Record<string, number>, // not used now
    };
  };

  const openContractModal = (emp: Employee) => {
    setSelectedEmployee(emp);
    setContractForm({
      annual_ctc: Number(emp.contract_amount) || Number(emp.annual_ctc) || 0,
      contract_period_months: emp.contract_period_months || 12,
      start_date: emp.sal_applicable_from || new Date().toISOString().split('T')[0],
    });
    setShowContractModal(true);
  };

  const saveContract = async () => {
    if (!selectedEmployee) return;

    const payload = {
      contract_amount: contractForm.annual_ctc,
      contract_period_months: contractForm.contract_period_months,
      sal_applicable_from: contractForm.start_date,
    };

    try {
      const res = await fetch(`${API_BASE}/employees/${selectedEmployee.id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error('Save failed: ' + JSON.stringify(error));
      }

      const updated = await res.json();
      setEmployees(prev => prev.map(e => e.id === selectedEmployee.id ? updated : e));
      setShowContractModal(false);
      alert('CTC updated successfully! Breakdown has been recalculated.');
    } catch (err: any) {
      console.error(err);
      alert('Failed to save: ' + err.message);
    }
  };

  const archiveEmployee = (employee: Employee) => {
    setEmployees(prev => prev.map(e => e.id === employee.id ? { ...e, archived: true } : e));
    setSelectedEmployee(null);
  };

  const downloadOfferLetter = () => {
    if (!selectedEmployee) return;

    const params = new URLSearchParams({
      type: 'offer',
      name: selectedEmployee.full_name,
      empId: selectedEmployee.employee_id,
      dept: selectedEmployee.department,
      desig: selectedEmployee.designation,
      joining: formatDate(selectedEmployee.joining_date),
      ctc: (selectedEmployee.annual_ctc || 0).toString(),
    });

    window.open(`/letter.html?${params.toString()}`, '_blank');
  };

  return (
    <div className="flex h-screen bg-gray-50">
        {/* Fixed Sidebar */}
        <div className="fixed inset-y-0 left-0 z-1 w-64 bg-white shadow-lg">
          <Sidebar />
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col ml-64"> {/* ← Sidebar width ke baad start */}
          {/* Fixed Navbar */}
          <div className="fixed top-0 left-64 right-0 z-40 bg-white shadow-md">
            <Navbar />
          </div>

          {/* Scrollable Main Content - Starts below Navbar */}
          <main className="flex-1 overflow-y-auto pt-20 pb-10 px-6"> {/* ← pt-20 = Navbar height */}
            <div className="max-w-7xl mx-auto">
              {/* Header */}
              <div className="flex justify-between items-center mb-8 mt-8">
                <h1 className="text-3xl font-bold text-gray-800">Employee Contracts</h1>
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
                <button onClick={() => setTab('active')} className={`px-6 py-3 rounded-xl font-medium transition ${tab === 'active' ? 'bg-gray-800 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>
                  Active ({activeEmployees.length})
                </button>
                <button onClick={() => setTab('archive')} className={`px-6 py-3 rounded-xl font-medium transition ${tab === 'archive' ? 'bg-gray-800 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>
                  Archive ({archivedEmployees.length})
                </button>
              </div>

              <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="px-5 py-3 border border-gray-300 rounded-xl bg-white font-medium">
                {categories.map(cat => <option key={cat}>{cat}</option>)}
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
                {filtered.map(emp => (
                  <div
                    key={emp.id}
                    onClick={() => setSelectedEmployee(emp)}
                    className="bg-white rounded-2xl shadow-lg hover:shadow-2xl cursor-pointer transition-all p-6 border border-gray-100"
                  >
                    <div className="flex items-center gap-5 mb-5">
                      {emp.photo ? (
                        <img src={emp.photo} alt={emp.full_name} className="w-16 h-16 rounded-full object-cover border-4 border-gray-200" />
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center text-white text-2xl font-bold">
                          {getInitials(emp.full_name)}
                        </div>
                      )}
                      <div>
                        <p className="font-bold text-gray-900 text-lg">{emp.full_name}</p>
                        <p className="text-sm text-gray-500">{emp.employee_id}</p>
                      </div>
                    </div>
                    <p className="text-base text-gray-700 mb-2 font-medium">{emp.designation}</p>
                    <p className="text-sm text-gray-500 mb-6">{emp.department}</p>
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
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-6" onClick={() => setSelectedEmployee(null)}>
          <div className="bg-white rounded-3xl shadow-3xl max-w-7xl w-full max-h-[95vh] overflow-y-auto p-10" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex justify-between items-start mb-12">
              <div className="flex items-start gap-10">
                <div>
                  {selectedEmployee.photo ? (
                    <img src={selectedEmployee.photo} alt={selectedEmployee.full_name} className="w-40 h-40 rounded-full object-cover border-8 border-gray-100 shadow-2xl" />
                  ) : (
                    <div className="w-40 h-40 rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center text-white text-5xl font-bold shadow-2xl">
                      {getInitials(selectedEmployee.full_name)}
                    </div>
                  )}
                  <label className="block mt-6 cursor-pointer">
                    <input type="file" accept="image/*" onChange={() => {}} className="hidden" />
                    <span className="flex items-center justify-center gap-3 px-8 py-4 bg-gray-800 text-white rounded-xl hover:bg-gray-900 font-semibold shadow-lg transition">
                      <Upload size={22} /> Upload Photo
                    </span>
                  </label>
                </div>
                <div>
                  <h2 className="text-4xl font-bold text-gray-800 mb-2">{selectedEmployee.full_name}</h2>
                  <p className="text-2xl text-gray-700 mb-8">{selectedEmployee.designation} • {selectedEmployee.department}</p>
                  <div className="grid grid-cols-2 gap-8 text-lg">
                    <div>
                      <p className="text-gray-600"><strong>Employee ID:</strong> {selectedEmployee.employee_id}</p>
                      <p className="text-gray-600"><strong>Mobile:</strong> {selectedEmployee.mobile}</p>
                    </div>
                    <div>
                      <p className="text-gray-600"><strong>Category:</strong> {selectedEmployee.employee_category}</p>
                      <p className="text-gray-600"><strong>Joining Date:</strong> {formatDate(selectedEmployee.joining_date)}</p>
                    </div>
                  </div>
                </div>
              </div>
              {tab === 'active' && (
                <button
                  onClick={() => archiveEmployee(selectedEmployee)}
                  className="px-8 py-5 bg-red-600 text-white rounded-2xl hover:bg-red-700 font-bold text-xl flex items-center gap-4 shadow-lg transition"
                >
                  <Trash2 size={24} /> Archive Employee
                </button>
              )}
            </div>

            {/* Current Active Contract */}
            <div className="mb-16">
              <div className="flex justify-between items-center mb-10">
                <h3 className="text-3xl font-bold text-gray-800">Current Active Contract</h3>
                <button
                  onClick={() => openContractModal(selectedEmployee)}
                  className="flex items-center gap-4 px-8 py-5 bg-teal-600 text-white rounded-2xl hover:bg-teal-700 font-bold text-xl shadow-2xl transition"
                >
                  <Edit2 size={24} /> Update Annual CTC
                </button>
              </div>

              <div className="bg-gradient-to-r from-teal-50 to-cyan-50 rounded-3xl p-12 border-4 border-teal-200">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-16 text-center">
                  <div>
                    <p className="text-gray-700 text-xl mb-4">Annual CTC</p>
                    <p className="text-5xl font-extrabold text-teal-800">
                      {formatSalary(selectedEmployee.annual_ctc || 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-700 text-xl mb-4">Monthly CTC</p>
                    <p className="text-5xl font-extrabold text-teal-800">
                      {formatSalary(selectedEmployee.monthly_ctc || 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-700 text-xl mb-4">Effective From</p>
                    <p className="text-4xl font-bold text-teal-800">
                      {selectedEmployee.sal_applicable_from ? formatDate(selectedEmployee.sal_applicable_from) : 'Not set'}
                    </p>
                  </div>
                </div>

                <h4 className="text-3xl font-bold text-center text-gray-800 mb-10">CTC Breakdown</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
                  {ctcComponents.map(comp => {
                    const fieldMap: Record<string, keyof Employee> = {
                      'BASIC': 'basic',
                      'HRA': 'hra',
                      'TELEPHONE': 'telephone_allowance',
                      'CONVEYANCE': 'travel_allowance',
                      'EDUCATION': 'childrens_education_allowance',
                      'GROSS_MONTHLY': 'gross_monthly',
                      'ESIC': 'employer_esi',
                      'PF': 'employer_pf',
                      'MONTHLY_CTC': 'monthly_ctc',
                      'MED_REIMB': 'medical_reimbursement_annual',
                      'VEHICLE': 'vehicle_reimbursement_annual',
                      'DRIVER': 'driver_reimbursement_annual',
                      'TEL_REIMB': 'telephone_reimbursement_annual',
                      'MEALS': 'meals_reimbursement_annual',
                      'UNIFORM': 'uniform_reimbursement_annual',
                      'LTA': 'leave_travel_allowance_annual',
                      'ANNUAL_BONUS': 'annual_bonus',
                      'PERF_INCENTIVE': 'annual_performance_incentive',
                      'MED_PREMIUM': 'medical_premium',
                      'GRATUITY': 'gratuity',
                      'ANNUAL_CTC': 'annual_ctc',
                    };

                    const field = fieldMap[comp.code] || 'basic';
                    const value = Number(selectedEmployee[field]) || 0;

                    return (
                      <div key={comp.id} className="bg-white rounded-2xl p-8 shadow-2xl text-center border-2 border-gray-100 hover:border-teal-300 transition">
                        <p className="text-lg font-semibold text-gray-700 mb-4">{comp.name}</p>
                        <p className="text-3xl font-extrabold text-teal-700 mb-3">
                          {formatSalary(value)}
                        </p>
                        {comp.formula && (
                          <p className="text-sm text-gray-500 italic">Formula: {comp.formula}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-center gap-8 mt-16 pb-10">
              <button
                onClick={downloadOfferLetter}
                className="px-12 py-6 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 font-bold text-2xl shadow-2xl transition"
              >
                Download Offer Letter
              </button>
            </div>

            <button
              onClick={() => setSelectedEmployee(null)}
              className="absolute top-8 right-8 text-gray-400 hover:text-gray-700 text-5xl font-light"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Contract Update Modal */}
      {showContractModal && selectedEmployee && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-6" onClick={() => setShowContractModal(false)}>
          <div className="bg-white rounded-3xl shadow-3xl max-w-5xl w-full p-12" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-10">
              <h2 className="text-4xl font-bold text-gray-800">Update Annual CTC</h2>
              <button onClick={() => setShowContractModal(false)} className="text-gray-400 hover:text-gray-700 text-5xl">×</button>
            </div>

            <p className="text-2xl text-gray-700 mb-12">
              <strong>{selectedEmployee.full_name}</strong> • {selectedEmployee.designation}
            </p>

            {/* Current Saved Values */}
            <div className="bg-gray-50 rounded-2xl p-8 mb-12 border-2 border-gray-200">
              <h3 className="text-2xl font-semibold text-gray-800 mb-6">Currently Saved in Database</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-10 text-xl">
                <div className="text-center">
                  <p className="text-gray-600 mb-3">Annual CTC</p>
                  <p className="text-3xl font-bold text-teal-700">{formatSalary(selectedEmployee.annual_ctc || 0)}</p>
                </div>
                <div className="text-center">
                  <p className="text-gray-600 mb-3">Contract Period</p>
                  <p className="text-3xl font-bold text-teal-700">{selectedEmployee.contract_period_months || 12} months</p>
                </div>
                <div className="text-center">
                  <p className="text-gray-600 mb-3">Effective From</p>
                  <p className="text-3xl font-bold text-teal-700">
                    {selectedEmployee.sal_applicable_from ? formatDate(selectedEmployee.sal_applicable_from) : 'Not set'}
                  </p>
                </div>
              </div>
            </div>

            {/* Update Form */}
            <h3 className="text-2xl font-semibold text-gray-800 mb-8">Enter New Values</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
              <div>
                <label className="block text-xl font-medium text-gray-700 mb-4">New Annual CTC (₹)</label>
                <input
                  type="number"
                  value={contractForm.annual_ctc}
                  onChange={(e) => setContractForm({ ...contractForm, annual_ctc: Number(e.target.value) || 0 })}
                  className="w-full px-8 py-6 text-3xl border-4 border-gray-300 rounded-2xl focus:border-teal-600 focus:outline-none"
                  placeholder="e.g. 1500000"
                />
              </div>
              <div>
                <label className="block text-xl font-medium text-gray-700 mb-4">Contract Period (months)</label>
                <input
                  type="number"
                  min="1"
                  value={contractForm.contract_period_months}
                  onChange={(e) => setContractForm({ ...contractForm, contract_period_months: Number(e.target.value) || 12 })}
                  className="w-full px-8 py-6 text-2xl border-4 border-gray-300 rounded-2xl focus:border-teal-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xl font-medium text-gray-700 mb-4">Effective From</label>
                <input
                  type="date"
                  value={contractForm.start_date}
                  onChange={(e) => setContractForm({ ...contractForm, start_date: e.target.value })}
                  className="w-full px-8 py-6 text-2xl border-4 border-gray-300 rounded-2xl focus:border-teal-600 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-8 mt-16">
              <button
                onClick={() => setShowContractModal(false)}
                className="px-12 py-6 bg-gray-200 text-gray-800 rounded-2xl font-bold text-2xl hover:bg-gray-300 transition"
              >
                Cancel
              </button>
              <button
                onClick={saveContract}
                className="px-12 py-6 bg-teal-600 text-white rounded-2xl font-bold text-2xl shadow-2xl hover:bg-teal-700 transition"
              >
                Save & Recalculate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}