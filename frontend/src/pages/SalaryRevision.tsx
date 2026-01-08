'use client';

import { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import { Search, Trash2, ChevronDown, Upload, Download, Edit2, Settings } from 'lucide-react';
import Link from 'next/link';

interface CTCComponent {
  id: number;
  name: string;
  code: string;
  formula: string;
  order: number;
  is_active: boolean;
  show_in_documents: boolean;
}

interface Contract {
  id: number;
  contract_amount: number;
  contract_period_months: number;
  start_date: string;
  end_date?: string | null;
  is_active: boolean;
  breakdown: Record<string, number>; // Dynamic: e.g., { "BASIC": 500000, "HRA": 200000 }
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
  contract_amount: number;
  contract_period_months: number;
  sal_applicable_from: string;
  contracts: Contract[];
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
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);

  const [contractForm, setContractForm] = useState<{
    annual_ctc: number;
    contract_period_months: number;
    start_date: string;
  }>({
    annual_ctc: 0,
    contract_period_months: 12,
    start_date: new Date().toISOString().split('T')[0],
  });

  // Fetch employees
  useEffect(() => {
    fetch(`${API_BASE}/employees/`)
      .then(res => res.json())
      .then((data: any[]) => {
        const enriched = data.map(emp => ({
          ...emp,
          contracts: emp.contracts || [],
          photo: emp.photo || null,
          archived: false,
        }));
        setEmployees(enriched);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  // Fetch CTC Components (for dynamic display)
  useEffect(() => {
    fetch(`${API_BASE}/ctc-components/`)
      .then(res => res.json())
      .then(data => {
        setCtcComponents(data.filter((c: CTCComponent) => c.is_active).sort((a: any, b: any) => a.order - b.order));
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

  const formatSalary = (salary: number) => {
    if (!salary || salary === 0) return '—';
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(salary);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '—';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid Date';
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const getActiveContract = (emp: Employee) => {
    return emp.contracts.find(c => c.is_active) || null;
  };

  const openContractModal = (emp: Employee) => {
    setCurrentEmployee(emp);
    const active = getActiveContract(emp);
    setContractForm({
      annual_ctc: active?.contract_amount || 0,
      contract_period_months: active?.contract_period_months || 12,
      start_date: active?.start_date || new Date().toISOString().split('T')[0],
    });
    setShowContractModal(true);
  };

  const saveContract = async () => {
    if (!currentEmployee) return;

    const payload = {
      contract_amount: contractForm.annual_ctc,
      contract_period_months: contractForm.contract_period_months,
      sal_applicable_from: contractForm.start_date,
    };

    try {
      const res = await fetch(`${API_BASE}/employees/${currentEmployee.id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Save failed');

      const updated = await res.json();
      setEmployees(prev => prev.map(e => e.id === currentEmployee.id ? updated : e));
      setShowContractModal(false);
      alert('CTC updated successfully! Breakdown will be recalculated using current rules.');
    } catch (err) {
      alert('Failed to save. Please try again.');
    }
  };

  const archiveEmployee = (employee: Employee) => {
    setEmployees(prev => prev.map(e => e.id === employee.id ? { ...e, archived: true } : e));
    setSelectedEmployee(null);
  };

  const downloadContractLetter = (contract: Contract, type: string) => {
    if (!selectedEmployee) return;
    const params = new URLSearchParams({
      type,
      name: selectedEmployee.full_name,
      empId: selectedEmployee.employee_id,
      dept: selectedEmployee.department,
      desig: selectedEmployee.designation,
      joining: formatDate(selectedEmployee.joining_date),
      contractAmount: contract.contract_amount.toString(),
      periodMonths: contract.contract_period_months.toString(),
      startDate: formatDate(contract.start_date),
      endDate: contract.end_date ? formatDate(contract.end_date) : 'Ongoing',
    });
    window.open(`/letter.html?${params.toString()}`, '_blank');
  };

  const downloadOfferLetter = () => {
    if (!selectedEmployee) return;
    const active = getActiveContract(selectedEmployee);
    const params = new URLSearchParams({
      type: 'offer',
      name: selectedEmployee.full_name,
      empId: selectedEmployee.employee_id,
      dept: selectedEmployee.department,
      desig: selectedEmployee.designation,
      joining: formatDate(selectedEmployee.joining_date),
      ctc: active ? active.contract_amount.toString() : '0',
    });
    window.open(`/letter.html?${params.toString()}`, '_blank');
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto">
            {/* Header with CTC Components Link */}
            <div className="flex justify-between items-center mb-8">
              <h1 className="text-3xl font-bold text-gray-800">Employee Contracts</h1>
              <Link href="/ctc-components">
                <button className="flex items-center gap-3 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium shadow transition">
                  <Settings size={20} />
                  Manage CTC Components
                </button>
              </Link>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-4 mb-6 items-center">
              <div className="flex gap-2">
                <button
                  onClick={() => setTab('active')}
                  className={`px-5 py-2.5 rounded-lg font-medium ${tab === 'active' ? 'bg-gray-800 text-white' : 'bg-gray-200 text-gray-700'}`}
                >
                  Active ({activeEmployees.length})
                </button>
                <button
                  onClick={() => setTab('archive')}
                  className={`px-5 py-2.5 rounded-lg font-medium ${tab === 'archive' ? 'bg-gray-800 text-white' : 'bg-gray-200 text-gray-700'}`}
                >
                  Archive ({archivedEmployees.length})
                </button>
              </div>

              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-4 py-2.5 border border-gray-300 rounded-lg bg-white"
              >
                {categories.map(cat => <option key={cat}>{cat}</option>)}
              </select>

              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Search employees..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-500"
                />
              </div>
            </div>

            {/* Employee Grid */}
            {loading ? (
              <p className="text-center py-12 text-gray-500 text-lg">Loading employees...</p>
            ) : filtered.length === 0 ? (
              <p className="text-center py-12 text-gray-500 text-lg">No employees found</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
                {filtered.map(emp => {
                  const active = getActiveContract(emp);
                  return (
                    <div
                      key={emp.id}
                      onClick={() => setSelectedEmployee(emp)}
                      className="bg-white rounded-xl shadow hover:shadow-xl cursor-pointer transition p-6 border border-gray-100"
                    >
                      <div className="flex items-center gap-4 mb-4">
                        {emp.photo ? (
                          <img src={emp.photo} alt={emp.full_name} className="w-14 h-14 rounded-full object-cover" />
                        ) : (
                          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center text-white text-xl font-bold">
                            {getInitials(emp.full_name)}
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-gray-900">{emp.full_name}</p>
                          <p className="text-sm text-gray-500">{emp.employee_id}</p>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{emp.designation}</p>
                      <p className="text-xs text-gray-500 mb-4">{emp.department}</p>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Annual CTC</span>
                          <span className="font-semibold">{formatSalary(active?.contract_amount || 0)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Monthly</span>
                          <span className="font-semibold text-teal-600">
                            {formatSalary(active ? Math.round(active.contract_amount / active.contract_period_months) : 0)}
                          </span>
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedEmployee(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[92vh] overflow-y-auto p-10" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex justify-between items-start mb-10">
              <div className="flex items-start gap-8">
                <div>
                  {selectedEmployee.photo ? (
                    <img src={selectedEmployee.photo} alt={selectedEmployee.full_name} className="w-32 h-32 rounded-full object-cover border-4 border-gray-200 shadow-lg" />
                  ) : (
                    <div className="w-32 h-32 rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center text-white text-4xl font-bold shadow-lg">
                      {getInitials(selectedEmployee.full_name)}
                    </div>
                  )}
                  <label className="block mt-4 cursor-pointer">
                    <input type="file" accept="image/*" onChange={() => {}} className="hidden" />
                    <span className="flex items-center justify-center gap-2 px-5 py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-900 text-sm font-medium">
                      <Upload size={18} /> Upload Photo
                    </span>
                  </label>
                </div>
                <div>
                  <h2 className="text-3xl font-bold text-gray-800">{selectedEmployee.full_name}</h2>
                  <p className="text-xl text-gray-700 mt-1">{selectedEmployee.designation} • {selectedEmployee.department}</p>
                  <div className="mt-6 space-y-2 text-base text-gray-600">
                    <p><strong>Employee ID:</strong> {selectedEmployee.employee_id}</p>
                    <p><strong>Mobile:</strong> {selectedEmployee.mobile}</p>
                    <p><strong>Category:</strong> {selectedEmployee.employee_category}</p>
                    <p><strong>Joining Date:</strong> {formatDate(selectedEmployee.joining_date)}</p>
                  </div>
                </div>
              </div>
              {tab === 'active' && (
                <button
                  onClick={() => archiveEmployee(selectedEmployee)}
                  className="px-6 py-4 bg-red-600 text-white rounded-xl hover:bg-red-700 font-semibold flex items-center gap-3"
                >
                  <Trash2 size={20} /> Archive Employee
                </button>
              )}
            </div>

            {/* Current Active Contract */}
            <div className="mt-12">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-bold text-gray-800">Current Active Contract</h3>
                <button
                  onClick={() => openContractModal(selectedEmployee)}
                  className="flex items-center gap-3 px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium shadow"
                >
                  <Edit2 size={20} /> Update Annual CTC
                </button>
              </div>

              {(() => {
                const active = getActiveContract(selectedEmployee);
                if (!active) {
                  return <p className="text-center text-gray-500 py-12 text-lg">No active contract</p>;
                }

                return (
                  <div className="bg-gradient-to-r from-teal-50 to-cyan-50 rounded-2xl p-10 border-2 border-teal-200">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-12">
                      <div className="text-center">
                        <p className="text-gray-600 text-lg">Annual CTC</p>
                        <p className="text-4xl font-bold text-teal-800 mt-3">{formatSalary(active.contract_amount)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-gray-600 text-lg">Period</p>
                        <p className="text-4xl font-bold text-teal-800 mt-3">{active.contract_period_months} months</p>
                      </div>
                      <div className="text-center">
                        <p className="text-gray-600 text-lg">Monthly CTC</p>
                        <p className="text-4xl font-bold text-teal-800 mt-3">
                          {formatSalary(Math.round(active.contract_amount / active.contract_period_months))}
                        </p>
                      </div>
                    </div>

                    <h4 className="text-xl font-semibold text-gray-800 mb-6 text-center">CTC Breakdown</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                      {ctcComponents.map(comp => {
                        const value = active.breakdown[comp.code] || 0;
                        return (
                          <div key={comp.id} className="bg-white rounded-xl p-6 shadow border text-center">
                            <p className="text-sm text-gray-600 mb-2">{comp.name}</p>
                            <p className="text-xl font-bold text-gray-800">{formatSalary(value)}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Contract History */}
            <div className="mt-16">
              <h3 className="text-2xl font-bold text-gray-800 mb-8">Contract History</h3>
              {selectedEmployee.contracts.length === 0 ? (
                <p className="text-center text-gray-500 py-12 text-lg">No previous contracts</p>
              ) : (
                <div className="space-y-8">
                  {selectedEmployee.contracts
                    .sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime())
                    .map(contract => (
                      <div
                        key={contract.id}
                        className={`p-10 rounded-2xl border-2 ${contract.is_active ? 'border-teal-500 bg-teal-50' : 'border-gray-300 bg-gray-50'}`}
                      >
                        <div className="flex justify-between items-start mb-8">
                          <div>
                            {contract.is_active && (
                              <span className="bg-teal-600 text-white px-5 py-2 rounded-full text-sm font-bold mb-3 inline-block">
                                CURRENT ACTIVE
                              </span>
                            )}
                            <p className="text-3xl font-bold text-gray-800 mb-3">₹{formatSalary(contract.contract_amount)} / year</p>
                            <p className="text-gray-600">
                              Period: {contract.contract_period_months} months • Start: {formatDate(contract.start_date)}
                            </p>
                          </div>
                          <div className="flex gap-4">
                            <button
                              onClick={() => openContractModal(selectedEmployee)}
                              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                            >
                              <Edit2 size={18} /> Edit
                            </button>
                            <div className="relative group">
                              <button className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium">
                                <Download size={18} /> Download
                                <ChevronDown size={16} />
                              </button>
                              <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-2xl border hidden group-hover:block z-10">
                                <button onClick={() => downloadContractLetter(contract, 'contract')} className="block w-full text-left px-5 py-3 hover:bg-gray-100">Contract Letter</button>
                                <button onClick={() => downloadContractLetter(contract, 'appointment')} className="block w-full text-left px-5 py-3 hover:bg-gray-100">Appointment Letter</button>
                                <button onClick={() => downloadContractLetter(contract, 'offer')} className="block w-full text-left px-5 py-3 hover:bg-gray-100">Offer Letter</button>
                                <button onClick={() => downloadContractLetter(contract, 'increment')} className="block w-full text-left px-5 py-3 hover:bg-gray-100 border-t">Increment Letter</button>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                          {ctcComponents.map(comp => {
                            const value = contract.breakdown[comp.code] || 0;
                            return (
                              <div key={comp.id} className="bg-white rounded-xl p-5 border">
                                <p className="text-sm text-gray-600">{comp.name}</p>
                                <p className="text-xl font-bold text-gray-800 mt-2">{formatSalary(value)}</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Generate Letters */}
            <div className="mt-16 pb-8">
              <h3 className="text-2xl font-bold text-gray-800 mb-6">Generate Letters</h3>
              <button
                onClick={downloadOfferLetter}
                className="px-8 py-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-semibold text-lg shadow-lg"
              >
                Download Offer Letter
              </button>
            </div>

            <button
              onClick={() => setSelectedEmployee(null)}
              className="absolute top-6 right-6 text-gray-400 hover:text-gray-700 text-4xl font-light"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Contract Update Modal */}
      {showContractModal && currentEmployee && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowContractModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full p-10" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-3xl font-bold text-gray-800">Update Annual CTC</h2>
              <button onClick={() => setShowContractModal(false)} className="text-gray-400 hover:text-gray-700 text-4xl">×</button>
            </div>

            <p className="text-xl text-gray-700 mb-10">
              <strong>{currentEmployee.full_name}</strong> • {currentEmployee.designation}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
              <div>
                <label className="block text-lg font-medium text-gray-700 mb-3">Annual CTC</label>
                <input
                  type="number"
                  value={contractForm.annual_ctc}
                  onChange={(e) => setContractForm({ ...contractForm, annual_ctc: Number(e.target.value) || 0 })}
                  className="w-full px-6 py-5 text-2xl border-2 border-gray-300 rounded-xl focus:border-teal-500"
                  placeholder="e.g. 1200000"
                />
              </div>
              <div>
                <label className="block text-lg font-medium text-gray-700 mb-3">Contract Period (months)</label>
                <input
                  type="number"
                  value={contractForm.contract_period_months}
                  onChange={(e) => setContractForm({ ...contractForm, contract_period_months: Number(e.target.value) || 12 })}
                  className="w-full px-6 py-5 text-xl border-2 border-gray-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-lg font-medium text-gray-700 mb-3">Effective From</label>
                <input
                  type="date"
                  value={contractForm.start_date}
                  onChange={(e) => setContractForm({ ...contractForm, start_date: e.target.value })}
                  className="w-full px-6 py-5 text-xl border-2 border-gray-300 rounded-xl"
                />
              </div>
            </div>

            <div className="bg-gradient-to-r from-teal-50 to-cyan-50 rounded-2xl p-10 border-2 border-teal-200">
              <h3 className="text-2xl font-bold text-center mb-6">Auto-Calculated Breakdown</h3>
              <p className="text-center text-gray-600 mb-8">
                Based on current rules in{' '}
                <Link href="/ctc-components" className="text-teal-700 underline font-medium">
                  CTC Components Dashboard
                </Link>
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {ctcComponents.map(comp => (
                  <div key={comp.id} className="bg-white rounded-xl p-6 shadow text-center">
                    <p className="text-sm text-gray-600 mb-2">{comp.name}</p>
                    <p className="text-2xl font-bold text-teal-700">Auto</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-6 mt-12">
              <button
                onClick={() => setShowContractModal(false)}
                className="px-8 py-4 bg-gray-200 text-gray-800 rounded-xl font-semibold text-lg hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={saveContract}
                className="px-8 py-4 bg-teal-600 text-white rounded-xl font-semibold text-lg shadow-lg hover:bg-teal-700"
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