'use client';

import { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import { Download, FileText, Edit2, Plus, Save, X, Search, ChevronDown } from 'lucide-react';
import jsPDF from 'jspdf';

type ContractBreakdown = {
  basicHRA: number;
  telephoneAllowance: number;
  travelAllowance: number;
  childrensEducationAllowance: number;
  supplementaryAllowance: number;
  grossMonthly: number;
  employerPF: number;
  employerESI: number;
  monthlyCTC: number;
  medicalReimbursementAnnual: number;
  vehicleReimbursementAnnual: number;
  driverReimbursementAnnual: number;
  telephoneReimbursementAnnual: number;
  mealsReimbursementAnnual: number;
  uniformReimbursementAnnual: number;
  leaveTravelAllowanceAnnual: number;
  annualBonus: number;
  annualPerformanceIncentive: number;
  medicalPremium: number;
  gratuity: number;
};

type Contract = {
  id: number;
  contract_type: string;
  start_date: string;
  end_date: string | null;
  salary: number; // Final Annual or Total Contract CTC
  is_active: boolean;
  breakdown?: ContractBreakdown;
  contractAmount?: number; // For fixed-term contracts
  contractPeriodMonths?: number;
};

type Employee = {
  id: number;
  employee_id: string;
  full_name: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  email: string;
  department: string;
  designation: string;
  current_salary: number;
  joining_date: string;
  reporting_manager?: string;
  contracts: Contract[];
  payslips: { id: number; month: string; file: string | null }[];
  photo?: string;
};

const contractTypes = ["Full-time", "Part-time", "Intern", "Temporary Staff", "Contract Based"];

const defaultBreakdown: ContractBreakdown = {
  basicHRA: 0,
  telephoneAllowance: 0,
  travelAllowance: 0,
  childrensEducationAllowance: 0,
  supplementaryAllowance: 0,
  grossMonthly: 0,
  employerPF: 0,
  employerESI: 0,
  monthlyCTC: 0,
  medicalReimbursementAnnual: 0,
  vehicleReimbursementAnnual: 0,
  driverReimbursementAnnual: 0,
  telephoneReimbursementAnnual: 0,
  mealsReimbursementAnnual: 0,
  uniformReimbursementAnnual: 0,
  leaveTravelAllowanceAnnual: 0,
  annualBonus: 0,
  annualPerformanceIncentive: 0,
  medicalPremium: 0,
  gratuity: 0,
};

const isFixedTermContract = (type: string) =>
  ["Contract Based", "Temporary Staff", "Intern"].includes(type);

export default function SalaryRevisionPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [openDownloadMenu, setOpenDownloadMenu] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const [newContract, setNewContract] = useState<{
    contract_type: string;
    salary: number;
    start_date: string;
    end_date: string;
    is_active: boolean;
    breakdown?: ContractBreakdown;
    contractAmount?: number;
    contractPeriodMonths?: number;
  }>({
    contract_type: "Full-time",
    salary: 0,
    start_date: new Date().toISOString().split('T')[0],
    end_date: "",
    is_active: true,
    breakdown: { ...defaultBreakdown },
    contractAmount: 0,
    contractPeriodMonths: 1,
  });

  useEffect(() => {
    fetch('https://hr-forms.onrender.com/api/employees/')
      .then(res => res.json())
      .then(data => {
        setEmployees(data);
        setFilteredEmployees(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    const filtered = employees.filter(emp =>
      emp.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.employee_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.department.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredEmployees(filtered);
  }, [searchTerm, employees]);

  const formatSalary = (salary: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(salary);
  };

  const getCurrentSalary = (employee: Employee) => {
    const active = employee.contracts.find(c => c.is_active);
    return active ? active.salary : employee.current_salary;
  };

  const calculateFullTimeCTC = (breakdown: ContractBreakdown): number => {
    const grossMonthly =
      breakdown.basicHRA +
      breakdown.telephoneAllowance +
      breakdown.travelAllowance +
      breakdown.childrensEducationAllowance +
      breakdown.supplementaryAllowance;

    const monthlyCTC = grossMonthly + breakdown.employerPF + breakdown.employerESI;

    const annualExtras =
      breakdown.medicalReimbursementAnnual +
      breakdown.vehicleReimbursementAnnual +
      breakdown.driverReimbursementAnnual +
      breakdown.telephoneReimbursementAnnual +
      breakdown.mealsReimbursementAnnual +
      breakdown.uniformReimbursementAnnual +
      breakdown.leaveTravelAllowanceAnnual +
      breakdown.annualBonus +
      breakdown.annualPerformanceIncentive +
      breakdown.medicalPremium +
      breakdown.gratuity;

    return monthlyCTC * 12 + annualExtras;
  };

  const updateBreakdownAndCTC = (updatedBreakdown: ContractBreakdown) => {
    const gross = updatedBreakdown.basicHRA + updatedBreakdown.telephoneAllowance + updatedBreakdown.travelAllowance +
      updatedBreakdown.childrensEducationAllowance + updatedBreakdown.supplementaryAllowance;

    const monthlyCTC = gross + updatedBreakdown.employerPF + updatedBreakdown.employerESI;

    setNewContract(prev => ({
      ...prev,
      breakdown: { ...updatedBreakdown, grossMonthly: gross, monthlyCTC },
      salary: calculateFullTimeCTC({ ...updatedBreakdown, grossMonthly: gross, monthlyCTC }),
    }));
  };

  const calculateMonthlyCTC = () => {
    if (!newContract.contractAmount || !newContract.contractPeriodMonths || newContract.contractPeriodMonths === 0)
      return 0;
    return newContract.contractAmount / newContract.contractPeriodMonths;
  };

  const handleAddNewContract = () => {
    if (!selectedEmployee) return;

    const newId = Math.max(...selectedEmployee.contracts.map(c => c.id), 0) + 1;

    const finalContract: Contract = {
      id: newId,
      contract_type: newContract.contract_type,
      salary: newContract.salary,
      start_date: newContract.start_date,
      end_date: newContract.end_date || null,
      is_active: newContract.is_active,
      breakdown: newContract.contract_type === "Full-time" ? newContract.breakdown : undefined,
      contractAmount: isFixedTermContract(newContract.contract_type) ? newContract.contractAmount : undefined,
      contractPeriodMonths: isFixedTermContract(newContract.contract_type) ? newContract.contractPeriodMonths : undefined,
    };

    let updatedContracts = [...selectedEmployee.contracts, finalContract];

    if (newContract.is_active) {
      updatedContracts = updatedContracts.map(c => ({ ...c, is_active: c.id === newId }));
    }

    const updatedEmp = { ...selectedEmployee, contracts: updatedContracts };
    updateEmployeeInState(updatedEmp);

    // Reset form
    setIsAddingNew(false);
    setNewContract({
      contract_type: "Full-time",
      salary: 0,
      start_date: new Date().toISOString().split('T')[0],
      end_date: "",
      is_active: true,
      breakdown: { ...defaultBreakdown },
      contractAmount: 0,
      contractPeriodMonths: 1,
    });
  };

  const updateEmployeeInState = (updatedEmp: Employee) => {
    setEmployees(prev => prev.map(e => e.id === updatedEmp.id ? updatedEmp : e));
    setFilteredEmployees(prev => prev.map(e => e.id === updatedEmp.id ? updatedEmp : e));
    setSelectedEmployee(updatedEmp);
  };

  const generateSalaryRevisionLetter = (emp: Employee) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 30;

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Brisk Olive Business Solutions Pvt Ltd", pageWidth / 2, y, { align: "center" });
    y += 15;
    doc.setFontSize(11);
    doc.text("Strictly Personal & Confidential", pageWidth / 2, y, { align: "center" });

    y += 25;
    doc.setFont("helvetica", "normal");
    doc.text(`Date: ${new Date().toLocaleDateString("en-IN")}`, 20, y);
    y += 10;
    doc.text(`Employee ID: ${emp.employee_id}`, 20, y);
    y += 10;
    doc.text(`Name: ${emp.full_name}`, 20, y);

    y += 25;
    doc.setFont("helvetica", "bold");
    doc.text("Subject: Salary Revision", 20, y);

    y += 20;
    doc.setFont("helvetica", "normal");
    doc.text(`Dear ${emp.full_name},`, 20, y);
    y += 15;
    doc.text("We are pleased to inform you that your compensation has been revised.", 20, y, { maxWidth: pageWidth - 40 });
    y += 15;
    doc.text(`Your new Annual CTC is: ${formatSalary(getCurrentSalary(emp))}`, 20, y);

    y += 30;
    doc.text("All other terms remain unchanged.", 20, y, { maxWidth: pageWidth - 40 });

    y += 40;
    doc.text("For Brisk Olive Business Solutions Pvt Ltd", 20, y);
    y += 25;
    doc.text("Authorized Signatory", 20, y);

    doc.save(`Salary_Revision_${emp.employee_id}.pdf`);
  };

  const generateConfirmationLetter = (emp: Employee) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 30;

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Brisk Olive Business Solutions Pvt Ltd", pageWidth / 2, y, { align: "center" });
    y += 20;

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`Date: ${new Date().toLocaleDateString("en-IN")}`, 20, y);
    y += 15;
    doc.text(`Employee ID: ${emp.employee_id}`, 20, y);
    y += 15;
    doc.text(`Name: ${emp.full_name}`, 20, y);

    y += 30;
    doc.setFont("helvetica", "bold");
    doc.text("Subject: Confirmation of Employment", 20, y);

    y += 20;
    doc.setFont("helvetica", "normal");
    doc.text(`Dear ${emp.full_name},`, 20, y);
    y += 15;
    doc.text("We are pleased to confirm your employment with effect from today.", 20, y, { maxWidth: pageWidth - 40 });

    y += 40;
    doc.text("For Brisk Olive Business Solutions Pvt Ltd", 20, y);
    y += 25;
    doc.text("Authorized Signatory", 20, y);

    doc.save(`Confirmation_${emp.employee_id}.pdf`);
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar />
        <main className="flex-1 overflow-y-auto p-8 lg:p-12">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-4xl font-bold text-center text-gray-800 mb-10">
              Salary Revision Dashboard
            </h1>

            <div className="mb-10 max-w-md mx-auto">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Search by name, ID, or department..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-6 py-4 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
                />
              </div>
            </div>

            {loading ? (
              <div className="text-center py-20 text-3xl text-gray-600">Loading employees...</div>
            ) : filteredEmployees.length === 0 ? (
              <div className="text-center py-20 text-3xl text-gray-600">
                {searchTerm ? "No matching employees" : "No employees found"}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                {filteredEmployees.map((emp) => {
                  const currentSalary = getCurrentSalary(emp);
                  return (
                    <div key={emp.id} className="bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all border border-gray-200 overflow-hidden">
                      <div className="p-6 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <img
                              src={emp.photo || "https://via.placeholder.com/80"}
                              alt={emp.full_name}
                              className="w-16 h-16 rounded-full object-cover border-4 border-white shadow-md"
                            />
                            <div>
                              <h3 className="text-lg font-bold text-gray-900">{emp.full_name}</h3>
                              <p className="text-sm text-gray-600">{emp.employee_id}</p>
                            </div>
                          </div>
                          <span className="bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-xs font-semibold">
                            {emp.department}
                          </span>
                        </div>
                      </div>

                      <div className="p-6 space-y-3">
                        <p className="text-sm text-gray-600"><strong>Role:</strong> {emp.designation}</p>
                        <p className="text-2xl font-bold text-indigo-700">{formatSalary(currentSalary)}</p>
                        <p className="text-sm text-gray-500">Joined: {new Date(emp.joining_date).toLocaleDateString('en-IN')}</p>
                      </div>

                      <div className="p-6 pt-0 flex gap-3">
                        <div className="relative flex-1">
                          <button
                            onClick={() => setOpenDownloadMenu(openDownloadMenu === emp.id ? null : emp.id)}
                            className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-xl hover:bg-blue-700 font-medium text-sm"
                          >
                            <Download size={18} />
                            Documents
                            <ChevronDown size={16} className={`transition ${openDownloadMenu === emp.id ? 'rotate-180' : ''}`} />
                          </button>

                          {openDownloadMenu === emp.id && (
                            <div className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-xl shadow-2xl border border-gray-200 z-20">
                              {[
                                { label: "Salary Revision Letter", action: () => generateSalaryRevisionLetter(emp) },
                                { label: "Confirmation Letter", action: () => generateConfirmationLetter(emp) },
                                { label: "Consultant Letter", action: () => alert("Coming soon!") },
                                { label: "Offer Letter", action: () => alert("Coming soon!") },
                                { label: "Offer Breakdown", action: () => alert("Coming soon!") },
                              ].map((item, i) => (
                                <button
                                  key={i}
                                  onClick={() => { item.action(); setOpenDownloadMenu(null); }}
                                  className="w-full text-left px-5 py-3 hover:bg-gray-100 flex items-center gap-3 text-sm"
                                >
                                  <FileText size={16} />
                                  {item.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        <button
                          onClick={() => setSelectedEmployee(emp)}
                          className="flex-1 bg-purple-600 text-white py-3 rounded-xl hover:bg-purple-700 font-medium flex items-center justify-center gap-2 text-sm"
                        >
                          <FileText size={18} />
                          Contracts
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Contracts Modal */}
      {selectedEmployee && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setSelectedEmployee(null)}>
          <div className="bg-white rounded-3xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-10">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-3xl font-bold text-gray-800">
                  Contracts — {selectedEmployee.full_name}
                </h2>
                <button onClick={() => setSelectedEmployee(null)} className="text-4xl text-gray-500 hover:text-gray-700">×</button>
              </div>

              <button
                onClick={() => setIsAddingNew(true)}
                className="mb-8 flex items-center gap-3 bg-green-600 text-white px-6 py-4 rounded-xl hover:bg-green-700 font-bold text-lg"
              >
                <Plus size={28} />
                Add New Contract
              </button>

              {isAddingNew && (
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-3xl p-10 mb-10 border-2 border-blue-300">
                  <h3 className="text-3xl font-bold mb-8 text-blue-900">New Contract Details</h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                    <div>
                      <label className="block text-lg font-semibold mb-2">Contract Type</label>
                      <select
                        value={newContract.contract_type}
                        onChange={(e) => setNewContract({ ...newContract, contract_type: e.target.value })}
                        className="w-full px-5 py-4 rounded-lg border border-gray-300 text-lg"
                      >
                        {contractTypes.map(t => <option key={t}>{t}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="block text-lg font-semibold mb-2">Start Date</label>
                      <input type="date" value={newContract.start_date} onChange={e => setNewContract({ ...newContract, start_date: e.target.value })} className="w-full px-5 py-4 rounded-lg border border-gray-300 text-lg" />
                    </div>

                    <div>
                      <label className="block text-lg font-semibold mb-2">End Date (Optional)</label>
                      <input type="date" value={newContract.end_date} onChange={e => setNewContract({ ...newContract, end_date: e.target.value })} className="w-full px-5 py-4 rounded-lg border border-gray-300 text-lg" />
                    </div>

                    <div className="flex items-end">
                      <label className="flex items-center gap-3 text-lg">
                        <input type="checkbox" checked={newContract.is_active} onChange={e => setNewContract({ ...newContract, is_active: e.target.checked })} className="w-6 h-6" />
                        Mark as Active
                      </label>
                    </div>
                  </div>

                  {/* Conditional CTC Section */}
                  <div className="mt-10">
                    <h4 className="text-2xl font-bold text-indigo-800 mb-6">
                      {newContract.contract_type === "Full-time" ? "CTC Breakdown" :
                       newContract.contract_type === "Part-time" ? "Fixed Annual Salary" :
                       "Fixed-Term Contract Details"}
                    </h4>

                    {/* Full-time Breakdown */}
                    {newContract.contract_type === "Full-time" && (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 bg-white rounded-2xl p-8 shadow-inner">
                        {Object.keys(defaultBreakdown).map((key) => {
                          const label = key
                            .replace(/([A-Z])/g, ' $1')
                            .replace(/^./, str => str.toUpperCase())
                            .replace('Hra', 'HRA')
                            .replace('Pf', 'PF')
                            .replace('Esi', 'ESI')
                            .replace('Telephone Allowance', 'Telephone Allowance');

                          return (
                            <div key={key}>
                              <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                              <input
                                type="number"
                                value={(newContract.breakdown as any)[key] || 0}
                                onChange={(e) => {
                                  const updated = { ...(newContract.breakdown || defaultBreakdown), [key]: Number(e.target.value) };
                                  updateBreakdownAndCTC(updated);
                                }}
                                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 text-lg"
                                placeholder="0"
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Part-time */}
                    {newContract.contract_type === "Part-time" && (
                      <div>
                        <label className="block text-xl font-bold mb-4">Annual Fixed Salary (₹)</label>
                        <input
                          type="number"
                          value={newContract.salary}
                          onChange={(e) => setNewContract({ ...newContract, salary: Number(e.target.value) })}
                          className="w-full md:w-1/2 px-6 py-5 rounded-xl border-2 border-indigo-400 focus:ring-4 focus:ring-indigo-500 text-3xl font-bold"
                        />
                      </div>
                    )}

                    {/* Fixed-term Contracts */}
                    {isFixedTermContract(newContract.contract_type) && (
                      <div className="space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div>
                            <label className="block text-xl font-bold mb-3">Total Contract Amount (₹)</label>
                            <input
                              type="number"
                              value={newContract.contractAmount || ""}
                              onChange={(e) => {
                                const amount = Number(e.target.value);
                                setNewContract({ ...newContract, contractAmount: amount, salary: amount });
                              }}
                              className="w-full px-6 py-5 rounded-xl border-2 border-green-400 focus:ring-4 focus:ring-green-500 text-3xl font-bold bg-green-50"
                              placeholder="600000"
                            />
                          </div>
                          <div>
                            <label className="block text-xl font-bold mb-3">Contract Period (Months)</label>
                            <input
                              type="number"
                              min="1"
                              value={newContract.contractPeriodMonths || ""}
                              onChange={(e) => setNewContract({ ...newContract, contractPeriodMonths: Number(e.target.value) })}
                              className="w-full px-6 py-5 rounded-xl border-2 border-purple-400 focus:ring-4 focus:ring-purple-500 text-3xl font-bold bg-purple-50"
                              placeholder="12"
                            />
                          </div>
                        </div>

                        <div className="bg-gradient-to-r from-teal-500 to-cyan-600 rounded-2xl p-8 text-white">
                          <p className="text-2xl font-bold mb-4">Equivalent Monthly CTC</p>
                          <p className="text-5xl font-black">{formatSalary(calculateMonthlyCTC())}</p>
                        </div>

                        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-8 text-white">
                          <p className="text-2xl font-bold">Total Contract Value (CTC)</p>
                          <p className="text-5xl font-black mt-4">{formatSalary(newContract.salary)}</p>
                        </div>
                      </div>
                    )}

                    {/* Final CTC Summary */}
                    <div className="mt-12 p-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-3xl text-white text-center shadow-2xl">
                      <p className="text-3xl font-bold mb-4">Final CTC</p>
                      <p className="text-6xl font-black">{formatSalary(newContract.salary)}</p>
                      <p className="text-xl mt-6 opacity-90">
                        {newContract.contract_type === "Full-time" && "From detailed breakdown"}
                        {newContract.contract_type === "Part-time" && "Fixed annual"}
                        {isFixedTermContract(newContract.contract_type) && "Total contract amount"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-10 flex gap-6">
                    <button onClick={handleAddNewContract} className="bg-green-600 text-white px-10 py-5 rounded-xl hover:bg-green-700 font-bold text-xl shadow-lg">
                      Save Contract
                    </button>
                    <button onClick={() => setIsAddingNew(false)} className="bg-gray-600 text-white px-10 py-5 rounded-xl hover:bg-gray-700 font-bold text-xl">
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Existing Contracts */}
              <div className="space-y-6">
                {selectedEmployee.contracts.length === 0 ? (
                  <p className="text-center text-2xl text-gray-500 py-12">No contracts yet</p>
                ) : (
                  selectedEmployee.contracts.sort((a, b) => b.id - a.id).map(contract => (
                    <div key={contract.id} className="bg-gray-50 rounded-xl p-8 border border-gray-300">
                      <div className="flex justify-between items-start">
                        <div className="space-y-3">
                          <div className="flex items-center gap-4">
                            <h4 className="text-2xl font-bold text-gray-800">{contract.contract_type}</h4>
                            <span className={`px-4 py-2 rounded-full text-sm font-bold ${contract.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                              {contract.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                          <p className="text-xl font-semibold text-indigo-700">{formatSalary(contract.salary)}</p>
                          <p><strong>Start:</strong> {new Date(contract.start_date).toLocaleDateString('en-IN')}</p>
                          {contract.end_date && <p><strong>End:</strong> {new Date(contract.end_date).toLocaleDateString('en-IN')}</p>}
                          {isFixedTermContract(contract.contract_type) && contract.contractPeriodMonths && (
                            <p><strong>Period:</strong> {contract.contractPeriodMonths} months</p>
                          )}
                        </div>
                        <button
                          onClick={() => setEditingContract(contract)}
                          className="bg-orange-500 text-white p-4 rounded-xl hover:bg-orange-600"
                        >
                          <Edit2 size={24} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}