'use client';

import { useEffect, useState, type ChangeEvent } from 'react';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import { Search, Plus, Trash2, ChevronDown, Upload } from 'lucide-react';

type Contract = {
  id: number;
  contract_amount: number;
  contract_period_months: number;
  start_date: string;
  end_date?: string | null;
  is_active: boolean;
};

type Employee = {
  id: number;
  employee_id: string;
  full_name: string;
  department: string;
  designation: string;
  joining_date: string;
  employee_category: string;
  mobile: string;
  annual_ctc: number;
  basic: number;
  hra: number;
  travel_allowance: number;
  childrens_education_allowance: number;
  supplementary_allowance: number;
  employer_pf: number;
  employer_esi: number;
  annual_bonus: number;
  annual_performance_incentive: number;
  medical_premium: number;
  medical_reimbursement_annual: number;
  vehicle_reimbursement_annual: number;
  driver_reimbursement_annual: number;
  telephone_reimbursement_annual: number;
  meals_reimbursement_annual: number;
  uniform_reimbursement_annual: number;
  leave_travel_allowance_annual: number;
  gross_monthly: number;
  monthly_ctc: number;
  gratuity: number;
  contract_amount: number | null;
  contract_period_months: number | null;
  equivalent_monthly_ctc: number | null;
  photo?: string;
  contracts: Contract[];
  archived?: boolean;
};

const categories = ['All', 'Employee', 'Consultant', 'Intern', 'Temporary Staff', 'Contract Based'];

export default function SalaryRevisionPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [tab, setTab] = useState<'active' | 'archive'>('active');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  // Contract Modal
  const [showContractModal, setShowContractModal] = useState(false);
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  const [contractForm, setContractForm] = useState({
    contract_amount: 0,
    contract_period_months: 12,
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
  });

  // Salary Revision Modal
  const [showSalaryModal, setShowSalaryModal] = useState(false);
  const [salaryForm, setSalaryForm] = useState<any>({});

  useEffect(() => {
    fetch('https://hr-forms.onrender.com/api/employees/')
      .then((res) => res.json())
      .then((data: any[]) => {
        const enriched = data.map((emp) => ({
          ...emp,
          basic: parseFloat(emp.basic || '0'),
          hra: parseFloat(emp.hra || '0'),
          travel_allowance: parseFloat(emp.travel_allowance || '0'),
          childrens_education_allowance: parseFloat(emp.childrens_education_allowance || '0'),
          supplementary_allowance: parseFloat(emp.supplementary_allowance || '0'),
          employer_pf: parseFloat(emp.employer_pf || '0'),
          employer_esi: parseFloat(emp.employer_esi || '0'),
          annual_bonus: parseFloat(emp.annual_bonus || '0'),
          annual_performance_incentive: parseFloat(emp.annual_performance_incentive || '0'),
          medical_premium: parseFloat(emp.medical_premium || '0'),
          medical_reimbursement_annual: parseFloat(emp.medical_reimbursement_annual || '0'),
          vehicle_reimbursement_annual: parseFloat(emp.vehicle_reimbursement_annual || '0'),
          driver_reimbursement_annual: parseFloat(emp.driver_reimbursement_annual || '0'),
          telephone_reimbursement_annual: parseFloat(emp.telephone_reimbursement_annual || '0'),
          meals_reimbursement_annual: parseFloat(emp.meals_reimbursement_annual || '0'),
          uniform_reimbursement_annual: parseFloat(emp.uniform_reimbursement_annual || '0'),
          leave_travel_allowance_annual: parseFloat(emp.leave_travel_allowance_annual || '0'),
          gross_monthly: parseFloat(emp.gross_monthly || '0'),
          monthly_ctc: parseFloat(emp.monthly_ctc || '0'),
          gratuity: parseFloat(emp.gratuity || '0'),
          annual_ctc: parseFloat(emp.annual_ctc || '0'),
          contract_amount: emp.contract_amount ? parseFloat(emp.contract_amount) : null,
          contract_period_months: emp.contract_period_months ? parseInt(emp.contract_period_months) : null,
          equivalent_monthly_ctc: emp.equivalent_monthly_ctc ? parseFloat(emp.equivalent_monthly_ctc) : null,
          contracts: emp.contracts || [],
          photo: emp.photo || null,
          archived: false,
        }));
        setEmployees(enriched);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const activeEmployees = employees.filter(e => !e.archived);
  const archivedEmployees = employees.filter(e => e.archived);
  const currentList = tab === 'active' ? activeEmployees : archivedEmployees;

  const filtered = currentList.filter((emp) => {
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
    const day = String(date.getDate()).padStart(2, '0');
    const month = date.toLocaleString('en-US', { month: 'short' });
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
  };

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const getActiveContract = (emp: Employee) => {
    const active = emp.contracts.find((c) => c.is_active);
    if (active) {
      return {
        contract_amount: active.contract_amount,
        contract_period_months: active.contract_period_months,
        equivalent_monthly_ctc: Math.round(active.contract_amount / active.contract_period_months),
      };
    }
    return {
      contract_amount: emp.contract_amount || 0,
      contract_period_months: emp.contract_period_months || 0,
      equivalent_monthly_ctc: emp.equivalent_monthly_ctc || 0,
    };
  };

  const archiveEmployee = (emp: Employee) => {
    if (!confirm(`Move ${emp.full_name} to Archive?`)) return;
    setEmployees(employees.map(e => e.id === emp.id ? { ...e, archived: true } : e));
    setSelectedEmployee(null);
  };

  // Photo Upload - Fully Implemented
  const handlePhotoUpload = (e: ChangeEvent<HTMLInputElement>) => {
    if (!selectedEmployee || !e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const updatedEmployees = employees.map(emp =>
        emp.id === selectedEmployee.id ? { ...emp, photo: base64String } : emp
      );
      setEmployees(updatedEmployees);
      setSelectedEmployee({ ...selectedEmployee, photo: base64String });
    };
    reader.readAsDataURL(file);
  };

  // Contract Functions
  const openContractModal = (emp: Employee, contract: Contract | null = null) => {
    setCurrentEmployee(emp);
    if (contract) {
      setEditingContract(contract);
      setContractForm({
        contract_amount: contract.contract_amount,
        contract_period_months: contract.contract_period_months,
        start_date: contract.start_date,
        end_date: contract.end_date || '',
      });
    } else {
      setEditingContract(null);
      setContractForm({
        contract_amount: 0,
        contract_period_months: 12,
        start_date: new Date().toISOString().split('T')[0],
        end_date: '',
      });
    }
    setShowContractModal(true);
  };

  const saveContract = () => {
    if (!currentEmployee || contractForm.contract_amount <= 0 || contractForm.contract_period_months <= 0) return;
    const newContract: Contract = {
      id: editingContract?.id || Date.now(),
      contract_amount: contractForm.contract_amount,
      contract_period_months: contractForm.contract_period_months,
      start_date: contractForm.start_date,
      end_date: contractForm.end_date || null,
      is_active: true,
    };

    const updated = employees.map((emp) =>
      emp.id === currentEmployee.id
        ? {
            ...emp,
            contracts: editingContract
              ? emp.contracts.map((c) => (c.id === editingContract.id ? newContract : { ...c, is_active: false }))
              : [...emp.contracts.map((c) => ({ ...c, is_active: false })), newContract],
            contract_amount: newContract.contract_amount,
            contract_period_months: newContract.contract_period_months,
            equivalent_monthly_ctc: Math.round(newContract.contract_amount / newContract.contract_period_months),
          }
        : emp
    );

    setEmployees(updated);
    setShowContractModal(false);
  };

  // Salary Revision
  const openSalaryRevision = () => {
    if (!selectedEmployee) return;
    setSalaryForm({ ...selectedEmployee });
    setShowSalaryModal(true);
  };

  const calculateNewCTC = () => {
    const monthly = salaryForm.basic + salaryForm.hra + salaryForm.travel_allowance +
                    salaryForm.childrens_education_allowance + salaryForm.supplementary_allowance +
                    salaryForm.employer_pf + salaryForm.employer_esi;
    const annual = salaryForm.annual_bonus + salaryForm.annual_performance_incentive +
                   salaryForm.medical_premium + salaryForm.medical_reimbursement_annual +
                   salaryForm.vehicle_reimbursement_annual + salaryForm.driver_reimbursement_annual +
                   salaryForm.telephone_reimbursement_annual + salaryForm.meals_reimbursement_annual +
                   salaryForm.uniform_reimbursement_annual + salaryForm.leave_travel_allowance_annual +
                   salaryForm.gratuity;
    return monthly * 12 + annual;
  };

  const saveSalaryRevision = () => {
    if (!selectedEmployee) return;
    const newCTC = calculateNewCTC();
    const updated = employees.map((emp) =>
      emp.id === selectedEmployee.id ? { ...emp, ...salaryForm, annual_ctc: newCTC } : emp
    );
    setEmployees(updated);
    setSelectedEmployee({ ...selectedEmployee, ...salaryForm, annual_ctc: newCTC });
    setShowSalaryModal(false);
  };

  // Download Letters
  const downloadLetter = (type: 'revision' | 'offer' | 'consultant') => {
    if (!selectedEmployee) return;
    const active = getActiveContract(selectedEmployee);
    const params = new URLSearchParams({
      type,
      name: selectedEmployee.full_name,
      empId: selectedEmployee.employee_id,
      dept: selectedEmployee.department,
      desig: selectedEmployee.designation,
      ctc: selectedEmployee.annual_ctc.toLocaleString('en-IN'),
      joining: formatDate(selectedEmployee.joining_date),
      ...(type === 'consultant' && {
        contractAmount: active.contract_amount.toLocaleString('en-IN'),
        period: active.contract_period_months.toString(),
        monthlyCtc: active.equivalent_monthly_ctc.toLocaleString('en-IN'),
      })
    });
    window.open(`/letter.html?${params.toString()}`, '_blank');
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar />
        <main className="flex-1 overflow-y-auto p-4">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-2xl font-medium text-gray-800 mb-6">Salary Revision</h1>

            <div className="flex flex-wrap gap-4 mb-6 items-center">
              <div className="flex gap-2">
                <button onClick={() => setTab('active')} className={`px-4 py-2 rounded text-sm font-medium ${tab === 'active' ? 'bg-gray-800 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                  Active ({activeEmployees.length})
                </button>
                <button onClick={() => setTab('archive')} className={`px-4 py-2 rounded text-sm font-medium ${tab === 'archive' ? 'bg-gray-800 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                  Archive ({archivedEmployees.length})
                </button>
              </div>

              <div className="relative">
                <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}
                  className="appearance-none bg-white border border-gray-300 rounded px-4 py-2 pr-8 text-sm focus:outline-none focus:border-gray-500">
                  {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
                <ChevronDown size={16} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>

            <div className="mb-6 max-w-xs">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded border border-gray-300 text-sm focus:outline-none focus:border-gray-400" />
              </div>
            </div>

            {loading ? (
              <p className="text-center text-gray-500 py-8">Loading...</p>
            ) : filtered.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No employees found</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
                {filtered.map((emp) => {
                  const active = getActiveContract(emp);
                  return (
                    <div
                      key={emp.id}
                      className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md cursor-pointer transition"
                      onClick={() => setSelectedEmployee(emp)}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        {emp.photo ? (
                          <img src={emp.photo} alt={emp.full_name} className="w-12 h-12 rounded-full object-cover border-2 border-gray-300" />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-gray-600 flex items-center justify-center text-white font-medium text-lg">
                            {getInitials(emp.full_name)}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">{emp.full_name}</p>
                          <p className="text-xs text-gray-500">{emp.employee_id}</p>
                        </div>
                      </div>
                      <p className="text-xs text-gray-600 mb-1">{emp.designation}</p>
                      <p className="text-xs text-gray-500 mb-3">{emp.department}</p>
                      <div className="text-xs space-y-1">
                        <div className="flex justify-between"><span className="text-gray-600">Contract</span><span>{formatSalary(active.contract_amount)}</span></div>
                        <div className="flex justify-between"><span className="text-gray-600">Monthly</span><span>{formatSalary(active.equivalent_monthly_ctc)}</span></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Employee Details Modal with Photo Upload */}
      {selectedEmployee && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setSelectedEmployee(null)}>
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-start gap-5">
                <div>
                  {selectedEmployee.photo ? (
                    <img src={selectedEmployee.photo} alt={selectedEmployee.full_name} className="w-28 h-28 rounded-full object-cover border-4 border-gray-200 shadow" />
                  ) : (
                    <div className="w-28 h-28 rounded-full bg-gray-600 flex items-center justify-center text-white text-3xl font-medium shadow">
                      {getInitials(selectedEmployee.full_name)}
                    </div>
                  )}
                  <label className="block mt-3 cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                    <span className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 text-sm font-medium">
                      <Upload size={16} /> Upload Photo
                    </span>
                  </label>
                </div>
                <div>
                  <h2 className="text-2xl font-semibold text-gray-800">{selectedEmployee.full_name}</h2>
                  <p className="text-lg text-gray-700">{selectedEmployee.designation} • {selectedEmployee.department}</p>
                  <div className="mt-3 space-y-1 text-sm text-gray-600">
                    <p><strong>Employee ID:</strong> {selectedEmployee.employee_id}</p>
                    <p><strong>Mobile:</strong> {selectedEmployee.mobile}</p>
                    <p><strong>Category:</strong> {selectedEmployee.employee_category}</p>
                    <p><strong>Joining Date:</strong> {formatDate(selectedEmployee.joining_date)}</p>
                    <p><strong>Annual CTC:</strong> {formatSalary(selectedEmployee.annual_ctc)}</p>
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                {tab === 'active' && (
                  <button onClick={() => archiveEmployee(selectedEmployee)} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium flex items-center gap-2">
                    <Trash2 size={16} /> Archive
                  </button>
                )}
                <button onClick={openSalaryRevision} className="px-5 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm font-medium">
                  Revise Salary
                </button>
              </div>
            </div>

            {/* Current Contract */}
            <div className="border-t pt-6 mb-8">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-medium">Current Contract</h3>
                <button onClick={() => openContractModal(selectedEmployee)} className="bg-teal-600 text-white p-2 rounded-lg hover:bg-teal-700">
                  <Plus size={20} />
                </button>
              </div>
              {(() => {
                const active = getActiveContract(selectedEmployee);
                return (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                    <div className="bg-gray-50 p-5 rounded-lg">
                      <p className="text-gray-600 text-sm">Contract Amount</p>
                      <p className="text-2xl font-bold">{formatSalary(active.contract_amount)}</p>
                    </div>
                    <div className="bg-gray-50 p-5 rounded-lg">
                      <p className="text-gray-600 text-sm">Period</p>
                      <p className="text-2xl font-bold">{active.contract_period_months || '—'} months</p>
                    </div>
                    <div className="bg-gray-50 p-5 rounded-lg">
                      <p className="text-gray-600 text-sm">Monthly Equivalent</p>
                      <p className="text-2xl font-bold text-teal-700">{formatSalary(active.equivalent_monthly_ctc)}</p>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Download Letters */}
            <div className="border-t pt-6">
              <h3 className="text-xl font-medium mb-4">Generate & Download Letters</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button onClick={() => downloadLetter('offer')} className="py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm">
                  Download Offer Letter
                </button>
                <button onClick={() => downloadLetter('revision')} className="py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm">
                  Salary Revision Letter
                </button>
                {(selectedEmployee.employee_category === 'Consultant' || selectedEmployee.employee_category === 'Contract Based') && (
                  <button onClick={() => downloadLetter('consultant')} className="py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium text-sm">
                    Consultant Contract
                  </button>
                )}
              </div>
            </div>

            <button onClick={() => setSelectedEmployee(null)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-3xl">
              ×
            </button>
          </div>
        </div>
      )}

      {/* Contract Modal */}
      {showContractModal && currentEmployee && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowContractModal(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-medium mb-4">{editingContract ? 'Edit' : 'Add New'} Contract</h2>
            <p className="text-sm text-gray-600 mb-5">{currentEmployee.full_name}</p>
            <div className="space-y-4">
              <input type="number" placeholder="Contract Amount (₹)" value={contractForm.contract_amount} onChange={(e) => setContractForm({...contractForm, contract_amount: Number(e.target.value)})} className="w-full px-4 py-2 border rounded-lg" />
              <input type="number" placeholder="Period (months)" value={contractForm.contract_period_months} onChange={(e) => setContractForm({...contractForm, contract_period_months: Number(e.target.value)})} className="w-full px-4 py-2 border rounded-lg" />
              <input type="date" value={contractForm.start_date} onChange={(e) => setContractForm({...contractForm, start_date: e.target.value})} className="w-full px-4 py-2 border rounded-lg" />
              <input type="date" placeholder="End Date (optional)" value={contractForm.end_date} onChange={(e) => setContractForm({...contractForm, end_date: e.target.value})} className="w-full px-4 py-2 border rounded-lg" />
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={saveContract} className="flex-1 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900">Save</button>
              <button onClick={() => setShowContractModal(false)} className="flex-1 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Salary Revision Modal */}
      {showSalaryModal && selectedEmployee && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowSalaryModal(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-2xl font-medium mb-6">Revise Salary — {selectedEmployee.full_name}</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              {Object.keys(salaryForm).filter(key => !['id', 'employee_id', 'full_name', 'department', 'designation', 'joining_date', 'employee_category', 'mobile', 'contracts', 'archived', 'photo', 'contract_amount', 'contract_period_months', 'equivalent_monthly_ctc'].includes(key)).map((key) => (
                <div key={key}>
                  <label className="block text-gray-700 capitalize mb-1">{key.replace(/_/g, ' ')}</label>
                  <input
                    type="number"
                    value={salaryForm[key]}
                    onChange={(e) => setSalaryForm({ ...salaryForm, [key]: Number(e.target.value) })}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-gray-500"
                  />
                </div>
              ))}
            </div>
            <div className="mt-8 p-5 bg-gradient-to-r from-teal-50 to-green-50 rounded-lg text-center">
              <p className="text-gray-700 font-medium">New Annual CTC</p>
              <p className="text-3xl font-bold text-teal-700 mt-2">{formatSalary(calculateNewCTC())}</p>
            </div>
            <div className="flex gap-4 mt-8">
              <button onClick={saveSalaryRevision} className="flex-1 py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-900 font-medium">Save Revision</button>
              <button onClick={() => setShowSalaryModal(false)} className="flex-1 py-3 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}