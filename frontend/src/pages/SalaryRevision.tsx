'use client';

import { useEffect, useState, type ChangeEvent } from 'react';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import { Search, Plus, Trash2, ChevronDown, Upload, Download, Edit2 } from 'lucide-react';

type CTCBreakdown = {
  basic: number;
  hra: number;
  telephonic_allowance: number;           // Monthly
  conveyance_allowance: number;            // Monthly
  childrens_education_allowance: number;
  supplementary_allowance: number;
  employer_pf: number;
  employer_esi: number;
  gross_monthly: number;                   // Auto
  monthly_ctc: number;                     // Auto
  gratuity: number;                        // Auto
  medical_premium: number;                 // Default 7734
  medical_reimbursement_annual: number;
  vehicle_reimbursement_annual: number;
  driver_reimbursement_annual: number;
  telephone_reimbursement_annual: number;
  meals_reimbursement_annual: number;
  uniform_reimbursement_annual: number;
  leave_travel_allowance_annual: number;
  annual_bonus: number;
  annual_performance_incentive: number;
  travel_allowance: number;                // ← ADDED (was missing!)
};

type Contract = {
  id: number;
  contract_amount: number;
  contract_period_months: number;
  start_date: string;
  end_date?: string | null;
  is_active: boolean;
  breakdown: CTCBreakdown;
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
  photo?: string;

  annual_ctc: number;
  contract_amount: number;
  contract_period_months: number;
  sal_applicable_from: string;

  basic: number;
  hra: number;
  travel_allowance: number;
  childrens_education_allowance: number;
  supplementary_allowance: number;
  employer_pf: number;
  employer_esi: number;
  gross_monthly: number;
  monthly_ctc: number;
  gratuity: number;
  medical_premium: number;
  medical_reimbursement_annual: number;
  vehicle_reimbursement_annual: number;
  driver_reimbursement_annual: number;
  telephone_reimbursement_annual: number;
  meals_reimbursement_annual: number;
  uniform_reimbursement_annual: number;
  leave_travel_allowance_annual: number;
  annual_bonus: number;
  annual_performance_incentive: number;

  contracts: Contract[];
  archived?: boolean;
};


const categories = ['All', 'Employee', 'Consultant', 'Intern', 'Temporary Staff', 'Contract Based'];

export default function EmployeeContractsPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [tab, setTab] = useState<'active' | 'archive'>('active');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  const [showContractModal, setShowContractModal] = useState(false);
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const [editingContract, setEditingContract] = useState<Contract | null>(null);

  const [contractForm, setContractForm] = useState<{
    contract_amount: number;
    contract_period_months: number;
    start_date: string;
    end_date: string | null;
    breakdown: CTCBreakdown;
  }>({
    contract_amount: 0,
    contract_period_months: 12,
    start_date: new Date().toISOString().split('T')[0],
    end_date: null,
    breakdown: {
      basic: 0,
      hra: 0,
      telephonic_allowance: 0,
      conveyance_allowance: 0,
      childrens_education_allowance: 0,
      supplementary_allowance: 0,
      employer_pf: 1800,
      employer_esi: 0,
      gross_monthly: 0,
      monthly_ctc: 0,
      gratuity: 0,
      medical_premium: 7734,
      medical_reimbursement_annual: 0,
      vehicle_reimbursement_annual: 0,
      driver_reimbursement_annual: 0,
      telephone_reimbursement_annual: 0,
      meals_reimbursement_annual: 0,
      uniform_reimbursement_annual: 0,
      leave_travel_allowance_annual: 0,
      annual_bonus: 0,
      annual_performance_incentive: 0,
      travel_allowance: 0,
    },
  });

  useEffect(() => {
    fetch('https://hr-forms.onrender.com/api/employees/')
      .then((res) => res.json())
      .then((data: any[]) => {
        const enriched = data.map((emp) => ({
          ...emp,
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
  const archiveEmployee = (employee: Employee) => {
  setEmployees(prev =>
    prev.map(e =>
      e.id === employee.id
        ? { ...e, archived: true }
        : e
    )
  );

  setSelectedEmployee(null); // close modal
};

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
    return emp.contracts.find((c) => c.is_active) || null;
  };

  const calculateBreakdown = (form: typeof contractForm) => {
  const basic = form.breakdown.basic || 0;

  const hra = form.breakdown.hra > 0 ? form.breakdown.hra : Math.round(basic * 0.4);

  const statutoryBonus = basic < 21000 ? Math.round(13580 * 0.0833) : 0;

  const grossMonthly =
    basic +
    hra +
    (form.breakdown.telephonic_allowance || 0) +
    (form.breakdown.conveyance_allowance || 0) +
    (form.breakdown.childrens_education_allowance || 0) +
    (form.breakdown.supplementary_allowance || 0) +
    (form.breakdown.travel_allowance || 0) +
    statutoryBonus;

  const employerESIC = grossMonthly < 21000 ? Math.round(grossMonthly * 0.0325) : 0;

  const employerPF = form.breakdown.employer_pf > 0 ? form.breakdown.employer_pf : 1800;

  const monthlyCTC = grossMonthly + employerESIC + employerPF;

  const gratuity = Math.round((15 / 26) * basic);

  const mediclaim = form.breakdown.medical_premium > 0 ? form.breakdown.medical_premium : 7734;

  const annualAllowances =
    (form.breakdown.medical_reimbursement_annual || 0) +
    (form.breakdown.vehicle_reimbursement_annual || 0) +
    (form.breakdown.driver_reimbursement_annual || 0) +
    (form.breakdown.telephone_reimbursement_annual || 0) +
    (form.breakdown.meals_reimbursement_annual || 0) +
    (form.breakdown.uniform_reimbursement_annual || 0) +
    (form.breakdown.leave_travel_allowance_annual || 0) +
    (form.breakdown.annual_bonus || 0) +
    (form.breakdown.annual_performance_incentive || 0);

  const annualCTC = monthlyCTC * 12 + gratuity + mediclaim + annualAllowances;

  return {
    ...form.breakdown,
    hra,
    gross_monthly: grossMonthly,
    employer_esi: employerESIC,
    employer_pf: employerPF,
    monthly_ctc: monthlyCTC,
    gratuity,
    medical_premium: mediclaim,
    // ← Yeh add karna zaroori tha!
    contract_amount: annualCTC,
  };
};


  const openContractModal = (emp: Employee, contract: Contract | null = null) => {
  setCurrentEmployee(emp);
  if (contract) {
    // Editing existing contract (from frontend history)
    setEditingContract(contract);
    setContractForm({
      contract_amount: contract.contract_amount,
      contract_period_months: contract.contract_period_months,
      start_date: contract.start_date,
      end_date: contract.end_date || null,
      breakdown: { ...contract.breakdown },
    });
  } else {
    setEditingContract(null);
    
    // Load saved values from database (Employee model fields)
    setContractForm({
      contract_amount: emp.contract_amount || 0,
      contract_period_months: emp.contract_period_months || 12,
      start_date: emp.sal_applicable_from || new Date().toISOString().split('T')[0],
      end_date: null,
      breakdown: {
        basic: Number(emp.basic) || 0,
        hra: Number(emp.hra) || 0,
        telephonic_allowance: 0, // not in model yet
        conveyance_allowance: 0, // not in model yet
        travel_allowance: Number(emp.travel_allowance) || 0,
        childrens_education_allowance: Number(emp.childrens_education_allowance) || 0,
        supplementary_allowance: Number(emp.supplementary_allowance) || 0,
        employer_pf: Number(emp.employer_pf) || 1800,
        employer_esi: Number(emp.employer_esi) || 0,
        gross_monthly: Number(emp.gross_monthly) || 0,
        monthly_ctc: Number(emp.monthly_ctc) || 0,
        gratuity: Number(emp.gratuity) || 0,
        medical_premium: Number(emp.medical_premium) || 7734,
        medical_reimbursement_annual: Number(emp.medical_reimbursement_annual) || 0,
        vehicle_reimbursement_annual: Number(emp.vehicle_reimbursement_annual) || 0,
        driver_reimbursement_annual: Number(emp.driver_reimbursement_annual) || 0,
        telephone_reimbursement_annual: Number(emp.telephone_reimbursement_annual) || 0,
        meals_reimbursement_annual: Number(emp.meals_reimbursement_annual) || 0,
        uniform_reimbursement_annual: Number(emp.uniform_reimbursement_annual) || 0,
        leave_travel_allowance_annual: Number(emp.leave_travel_allowance_annual) || 0,
        annual_bonus: Number(emp.annual_bonus) || 0,
        annual_performance_incentive: Number(emp.annual_performance_incentive) || 0,
      },
    });
  }
  setShowContractModal(true);
};

  const saveContract = async () => {
  if (!currentEmployee || !currentEmployee.id) return;

  const recalculated = calculateBreakdown(contractForm);
  const finalAnnualCTC = recalculated.contract_amount;

  // ← ID add kar diya!
  const latestContract: Contract = {
    id: editingContract?.id || Date.now(),  // Edit mode mein old ID, new mein timestamp
    contract_amount: finalAnnualCTC,
    contract_period_months: contractForm.contract_period_months,
    start_date: contractForm.start_date,
    end_date: contractForm.end_date,
    is_active: true,
    breakdown: recalculated,
  };

  // Update local contracts array
  let updatedContracts = currentEmployee.contracts.filter(c => !c.is_active); // Previous only
  updatedContracts.unshift(latestContract); // New active on top

  // Payload for backend (map to Employee model fields)
  const payload = {
    basic: recalculated.basic || 0,
    hra: recalculated.hra || 0,
    travel_allowance: recalculated.travel_allowance || 0,
    childrens_education_allowance: recalculated.childrens_education_allowance || 0,
    supplementary_allowance: recalculated.supplementary_allowance || 0,
    employer_pf: recalculated.employer_pf || 1800,
    employer_esi: recalculated.employer_esi || 0,
    annual_bonus: recalculated.annual_bonus || 0,
    annual_performance_incentive: recalculated.annual_performance_incentive || 0,
    medical_premium: recalculated.medical_premium || 7734,
    medical_reimbursement_annual: recalculated.medical_reimbursement_annual || 0,
    vehicle_reimbursement_annual: recalculated.vehicle_reimbursement_annual || 0,
    driver_reimbursement_annual: recalculated.driver_reimbursement_annual || 0,
    telephone_reimbursement_annual: recalculated.telephone_reimbursement_annual || 0,
    meals_reimbursement_annual: recalculated.meals_reimbursement_annual || 0,
    uniform_reimbursement_annual: recalculated.uniform_reimbursement_annual || 0,
    leave_travel_allowance_annual: recalculated.leave_travel_allowance_annual || 0,
    contract_amount: finalAnnualCTC,
    contract_period_months: contractForm.contract_period_months,
  };

  try {
    const response = await fetch(`https://hr-forms.onrender.com/api/employees/${currentEmployee.id}/`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) throw new Error('Save failed');

    const updatedEmployee = await response.json();

    setEmployees(prev => prev.map(e => e.id === currentEmployee.id ? updatedEmployee : e));

    setShowContractModal(false);
    setEditingContract(null);
    alert('Contract saved successfully! 🎉');
  } catch (error) {
    console.error(error);
    alert('Failed to save contract');
  }
};

  const downloadContractLetter = (contract: Contract, letterType: 'contract' | 'offer' | 'appointment' | 'increment' = 'contract') => {
  if (!selectedEmployee) return;

  const monthlyCTC = Math.round(contract.contract_amount / contract.contract_period_months);

  const params = new URLSearchParams({
    type: letterType,
    name: selectedEmployee.full_name,
    empId: selectedEmployee.employee_id,
    dept: selectedEmployee.department,
    desig: selectedEmployee.designation,
    joining: formatDate(selectedEmployee.joining_date),
    contractAmount: contract.contract_amount.toLocaleString('en-IN'),
    periodMonths: contract.contract_period_months.toString(),
    monthlyCTC: monthlyCTC.toLocaleString('en-IN'),
    startDate: formatDate(contract.start_date),
    endDate: contract.end_date ? formatDate(contract.end_date) : 'Ongoing',
    status: contract.is_active ? 'Current' : 'Previous',

    // Full CTC Breakdown
    basic: contract.breakdown.basic.toString(),
    hra: contract.breakdown.hra.toString(),
    travel_allowance: contract.breakdown.travel_allowance.toString(),
    childrens_education_allowance: contract.breakdown.childrens_education_allowance.toString(),
    supplementary_allowance: contract.breakdown.supplementary_allowance.toString(),
    employer_pf: contract.breakdown.employer_pf.toString(),
    employer_esi: contract.breakdown.employer_esi.toString(),
    annual_bonus: contract.breakdown.annual_bonus.toString(),
    annual_performance_incentive: contract.breakdown.annual_performance_incentive.toString(),
    medical_premium: contract.breakdown.medical_premium.toString(),
    medical_reimbursement_annual: contract.breakdown.medical_reimbursement_annual.toString(),
    vehicle_reimbursement_annual: contract.breakdown.vehicle_reimbursement_annual.toString(),
    driver_reimbursement_annual: contract.breakdown.driver_reimbursement_annual.toString(),
    telephone_reimbursement_annual: contract.breakdown.telephone_reimbursement_annual.toString(),
    meals_reimbursement_annual: contract.breakdown.meals_reimbursement_annual.toString(),
    uniform_reimbursement_annual: contract.breakdown.uniform_reimbursement_annual.toString(),
    leave_travel_allowance_annual: contract.breakdown.leave_travel_allowance_annual.toString(),
    gross_monthly: contract.breakdown.gross_monthly.toString(),
    monthly_ctc: contract.breakdown.monthly_ctc.toString(),
    gratuity: contract.breakdown.gratuity.toString(),
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
    ctc: active ? active.contract_amount.toLocaleString('en-IN') : '0',
  });
  window.open(`/letter.html?${params.toString()}`, '_blank');
};

  function handlePhotoUpload(_event: ChangeEvent<HTMLInputElement>): void {
    throw new Error('Function not implemented.');
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar />
        <main className="flex-1 overflow-y-auto p-4">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-2xl font-medium text-gray-800 mb-6">Employee Contracts</h1>

            {/* Filters & Search */}
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

            {/* Employee Cards */}
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
                        <div className="flex justify-between"><span className="text-gray-600">Contract</span><span>{formatSalary(active?.contract_amount || 0)}</span></div>
                        <div className="flex justify-between"><span className="text-gray-600">Monthly</span><span>{formatSalary(active ? Math.round(active.contract_amount / active.contract_period_months) : 0)}</span></div>
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
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setSelectedEmployee(null)}>
          <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto p-8" onClick={(e) => e.stopPropagation()}>
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
                    <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                    <span className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 text-sm font-medium">
                      <Upload size={16} /> Upload Photo
                    </span>
                  </label>
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-semibold text-gray-800">{selectedEmployee.full_name}</h2>
                  <p className="text-lg text-gray-700">{selectedEmployee.designation} • {selectedEmployee.department}</p>
                  <div className="mt-4 space-y-2 text-sm text-gray-600">
                    <p><strong>Employee ID:</strong> {selectedEmployee.employee_id}</p>
                    <p><strong>Mobile:</strong> {selectedEmployee.mobile}</p>
                    <p><strong>Category:</strong> {selectedEmployee.employee_category}</p>
                    <p><strong>Joining Date:</strong> {formatDate(selectedEmployee.joining_date)}</p>
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                {tab === 'active' && (
                  <button
                    onClick={() => archiveEmployee(selectedEmployee)}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium flex items-center gap-2"
                  >
                    <Trash2 size={16} /> Archive
                  </button>

                )}
              </div>
            </div>

            {/* Current Contract with Full Breakdown */}
            <div className="border-t pt-6 mb-8">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-medium">Current Active Contract</h3>
                <button onClick={() => openContractModal(selectedEmployee)} className="bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 flex items-center gap-2 text-sm">
                  <Plus size={18} /> Add New Contract
                </button>
              </div>

              {(() => {
                const active = getActiveContract(selectedEmployee);
                if (!active) {
                  return <p className="text-center text-gray-500 py-8">No active contract</p>;
                }

                return (
                  <div className="bg-teal-50 border border-teal-500 rounded-lg p-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                      <div className="text-center">
                        <p className="text-gray-600 text-sm">Contract Amount</p>
                        <p className="text-3xl font-bold">{formatSalary(active.contract_amount)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-gray-600 text-sm">Period</p>
                        <p className="text-3xl font-bold">{active.contract_period_months} months</p>
                      </div>
                      <div className="text-center">
                        <p className="text-gray-600 text-sm">Monthly CTC</p>
                        <p className="text-3xl font-bold text-teal-700">{formatSalary(Math.round(active.contract_amount / active.contract_period_months))}</p>
                      </div>
                    </div>

                    <div className="border-t pt-6">
                      <h4 className="font-medium text-lg mb-4">CTC Breakdown</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        {Object.entries(active.breakdown).map(([key, value]) => (
                          <div key={key}>
                            <p className="text-gray-600 capitalize">{key.replace(/_/g, ' ')}</p>
                            <p className="font-medium">{formatSalary(value)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Contract History - Active on Top */}
            <div className="border-t pt-6 mb-8">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-medium">Contract History</h3>
                <button onClick={() => openContractModal(selectedEmployee)} className="bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 flex items-center gap-2 text-sm">
                  <Plus size={18} /> Add New Contract
                </button>
              </div>

              <div className="space-y-6">
                {selectedEmployee.contracts.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No contracts added yet</p>
                ) : (
                  <>
                    {/* Active Contract - Always on Top */}
                    {selectedEmployee.contracts
                      .filter(c => c.is_active)
                      .map((contract) => (
                        <div key={contract.id} className="p-6 rounded-lg border-2 border-teal-500 bg-teal-50 shadow-md">
                          <div className="flex justify-between items-start mb-4">
                            {/* Left: Contract Info */}
                            <div>
                              <div className="flex items-center gap-3 mb-2">
                                <span className="bg-teal-600 text-white px-3 py-1 rounded-full text-xs font-bold">
                                  CURRENT ACTIVE
                                </span>
                                <p className="text-xl font-bold">₹{formatSalary(contract.contract_amount)} / year</p>
                              </div>
                              <p className="text-sm text-gray-600">Period: {contract.contract_period_months} months</p>
                              <p className="text-sm text-gray-600">Start: {formatDate(contract.start_date)}</p>
                            </div>

                            {/* Right: Edit Button + Download Dropdown */}
                            <div className="flex items-center gap-3">
                              {/* Edit Button */}
                              <button
                                onClick={() => openContractModal(selectedEmployee, contract)}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition"
                              >
                                <Edit2 size={16} /> Edit Contract
                              </button>

                              {/* Download Dropdown */}
                              <div className="relative group">
                                <button className="flex items-center gap-2 px-5 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium shadow transition">
                                  <Download size={18} /> Download Letter
                                  <ChevronDown size={16} />
                                </button>

                                {/* Dropdown Menu */}
                                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-gray-200 z-10 hidden group-hover:block">
                                  <button
                                    onClick={() => downloadContractLetter(contract, 'contract')}
                                    className="block w-full text-left px-4 py-3 hover:bg-gray-100 text-sm"
                                  >
                                    Contract Letter
                                  </button>
                                  <button
                                    onClick={() => downloadContractLetter(contract, 'appointment')}
                                    className="block w-full text-left px-4 py-3 hover:bg-gray-100 text-sm"
                                  >
                                    Appointment Letter
                                  </button>
                                  <button
                                    onClick={() => downloadContractLetter(contract, 'offer')}
                                    className="block w-full text-left px-4 py-3 hover:bg-gray-100 text-sm"
                                  >
                                    Offer Letter
                                  </button>
                                  <button
                                    onClick={() => downloadContractLetter(contract, 'increment')}
                                    className="block w-full text-left px-4 py-3 hover:bg-gray-100 text-sm border-t"
                                  >
                                    Increment Letter
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* CTC Breakdown */}
                          <div className="mt-5">
                            <p className="font-medium text-gray-700 mb-3">CTC Breakdown</p>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              {Object.entries(contract.breakdown).map(([key, value]) => (
                                <div key={key} className="bg-white p-3 rounded border">
                                  <p className="text-gray-600 capitalize text-xs">{key.replace(/_/g, ' ')}</p>
                                  <p className="font-semibold">{formatSalary(value)}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}

                    {/* Previous Contracts */}
                    {selectedEmployee.contracts.filter(c => !c.is_active).length > 0 && (
                      <div>
                        <h4 className="text-lg font-medium text-gray-700 mb-4">Previous Contracts</h4>
                        <div className="space-y-4">
                          {selectedEmployee.contracts
                            .filter(c => !c.is_active)
                            .sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime())
                            .map((contract) => (
                              <div key={contract.id} className="p-5 rounded-lg border border-gray-300 bg-gray-50">
                                <div className="flex justify-between items-start mb-4">
                                  <div>
                                    <p className="font-semibold">₹{formatSalary(contract.contract_amount)} / year</p>
                                    <p className="text-sm text-gray-600">Period: {contract.contract_period_months} months</p>
                                    <p className="text-sm text-gray-600">
                                      {formatDate(contract.start_date)} → {formatDate(contract.end_date || '')}
                                    </p>
                                    <span className="inline-block mt-2 px-3 py-1 rounded-full text-xs bg-gray-500 text-white">
                                      Previous
                                    </span>
                                  </div>
                                </div>
                                <div className="flex gap-3">
                                  {/* Edit Button for Previous */}
                                  <button
                                    onClick={() => openContractModal(selectedEmployee, contract)}
                                    className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm font-medium"
                                  >
                                    <Edit2 size={16} /> Edit
                                  </button>
                                  {/* Dropdown for Previous Contract */}
                                  <div className="relative group">
                                    <button className="flex items-center gap-2 px-5 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-800 text-sm font-medium">
                                      <Download size={18} />
                                      Download Letter
                                      <ChevronDown size={16} />
                                    </button>
                                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-gray-200 z-10 hidden group-hover:block">
                                      <button onClick={() => downloadContractLetter(contract, 'contract')} className="block w-full text-left px-4 py-3 hover:bg-gray-100 text-sm">
                                        Previous Contract Letter
                                      </button>
                                      <button onClick={() => downloadContractLetter(contract, 'increment')} className="block w-full text-left px-4 py-3 hover:bg-gray-100 text-sm">
                                        Increment Letter (Old)
                                      </button>
                                      <button onClick={() => downloadContractLetter(contract, 'appointment')} className="block w-full text-left px-4 py-3 hover:bg-gray-100 text-sm border-t">
                                        Old Appointment Letter
                                      </button>
                                    </div>
                                  </div>
                                </div>

                                {/* Previous Breakdown */}
                                <div className="mt-4 text-sm text-gray-600">
                                  <p className="font-medium mb-2">Previous CTC Breakdown</p>
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {Object.entries(contract.breakdown).map(([key, value]) => (
                                      <div key={key} className="bg-white p-2 rounded text-xs">
                                        <p className="text-gray-500 capitalize">{key.replace(/_/g, ' ')}</p>
                                        <p>{formatSalary(value)}</p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Letters */}
            <div className="border-t pt-6">
              <h3 className="text-xl font-medium mb-4">Generate Letters</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button onClick={downloadOfferLetter} className="py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm">
                  Download Offer Letter
                </button>
              </div>
            </div>

            <button onClick={() => setSelectedEmployee(null)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-3xl">×</button>
          </div>
        </div>
      )}

{/* Contract Modal - Full Breakdown */}
{showContractModal && currentEmployee && (
  <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowContractModal(false)}>
    <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[92vh] overflow-y-auto p-8" onClick={(e) => e.stopPropagation()}>
      {/* Header */}
      <div className="flex justify-between items-center mb-8 border-b pb-4">
        <h2 className="text-3xl font-bold text-gray-800">
          {editingContract ? 'Edit' : 'Add New'} Contract
        </h2>
        <button
          onClick={() => setShowContractModal(false)}
          className="text-gray-400 hover:text-gray-600 text-3xl font-light"
        >
          ×
        </button>
      </div>

      <p className="text-xl text-gray-700 mb-8">
        <span className="font-semibold">{currentEmployee.full_name}</span> • {currentEmployee.designation}
      </p>

      {/* Editable CTC Breakdown Fields */}
      <div className="mb-10">
        <h3 className="text-xl font-semibold text-gray-800 mb-6">CTC Breakdown (All Fields Editable)</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {Object.entries(contractForm.breakdown).map(([key, value]) => (
            <div key={key} className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 capitalize">
                {key.replace(/_/g, ' ')}
                {key === 'hra' && <span className="text-xs text-blue-600 ml-2">(Auto: 40% of Basic)</span>}
                {key === 'gross_monthly' && <span className="text-xs text-green-600 ml-2">(Auto)</span>}
                {key === 'monthly_ctc' && <span className="text-xs text-green-600 ml-2">(Auto)</span>}
                {key === 'gratuity' && <span className="text-xs text-green-600 ml-2">(Auto)</span>}
              </label>
              <input
                type="number"
                value={value || ''}
                onChange={(e) => {
                  const inputValue = e.target.value === '' ? 0 : Number(e.target.value);
                  const newBreakdown = {
                    ...contractForm.breakdown,
                    [key]: inputValue,
                  };

                  const recalculated = calculateBreakdown({
                    ...contractForm,
                    breakdown: newBreakdown,
                  });

                  setContractForm({
                    ...contractForm,
                    breakdown: recalculated,
                    contract_amount: recalculated.contract_amount,
                  });
                }}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-base"
                placeholder="0"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Contract Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Contract Period (months)</label>
          <input
            type="number"
            min="1"
            value={contractForm.contract_period_months}
            onChange={(e) => setContractForm({ ...contractForm, contract_period_months: Number(e.target.value) || 12 })}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
          <input
            type="date"
            value={contractForm.start_date}
            onChange={(e) => setContractForm({ ...contractForm, start_date: e.target.value })}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
      </div>

      {/* Final Summary - Live Calculation */}
      <div className="bg-gradient-to-r from-teal-50 to-cyan-50 rounded-xl p-8 border-2 border-teal-200 mb-10">
        <h3 className="text-2xl font-bold text-center text-teal-800 mb-8">Final Summary</h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <p className="text-gray-600 text-sm mb-2">Gross Monthly</p>
            <p className="text-3xl font-bold text-teal-700">
              {formatSalary(contractForm.breakdown.gross_monthly || 0)}
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <p className="text-gray-600 text-sm mb-2">Monthly CTC</p>
            <p className="text-3xl font-bold text-teal-700">
              {formatSalary(contractForm.breakdown.monthly_ctc || 0)}
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <p className="text-gray-600 text-sm mb-2">Gratuity (Annual)</p>
            <p className="text-3xl font-bold text-teal-700">
              {formatSalary(contractForm.breakdown.gratuity || 0)}
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 text-center col-span-2 md:col-span-1">
            <p className="text-gray-700 text-lg mb-2 font-semibold">Total Annual CTC</p>
            <p className="text-4xl font-extrabold text-teal-800">
              {formatSalary(contractForm.contract_amount || 0)}
            </p>
          </div>
        </div>

        {/* Saved Database Values for Reference */}
        <div className="mt-8 pt-6 border-t border-teal-200 text-center">
          <p className="text-sm text-gray-600 mb-2">Currently Saved in Database</p>
          <p className="text-base font-medium text-gray-800">
            Annual CTC: <span className="text-teal-700 font-bold">{formatSalary(currentEmployee.annual_ctc || 0)}</span> 
            {' • '} 
            Monthly CTC: <span className="text-teal-700 font-bold">{formatSalary(currentEmployee?.monthly_ctc || 0)}</span>
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4 justify-end">
        <button
          onClick={() => setShowContractModal(false)}
          className="px-8 py-4 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-semibold text-lg transition"
        >
          Cancel
        </button>
        <button
          onClick={saveContract}
          className="px-8 py-4 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-semibold text-lg shadow-lg transition"
        >
          Save Contract
        </button>
      </div>
    </div>
  </div>
)}
    </div>
  );
}