'use client';

import { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import { Search, Plus, X } from 'lucide-react';

type Employee = {
  id: number;
  employee_id: string;
  full_name: string;
  official_email: string;
  personal_email: string;
  mobile: string;
  department: string;
  designation: string;
  joining_date: string;
  employee_category: string;
  gender: string;
  name_of_buddy: string;
  joining_status: string;
  exit_status: string;
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
  equivalent_monthly_ctc: number;
  contract_amount?: number;
  contract_period_months?: number;
  photo?: string;
};

const fixedTermCategories = ['Intern', 'Temporary Staff', 'Contract Based'];

export default function SalaryRevisionPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddingContract, setIsAddingContract] = useState(false);

  const [newContract, setNewContract] = useState({
    contract_type: 'Full-time',
    contract_amount: 0,
    contract_period_months: 12,
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
      maximumFractionDigits: 0,
    }).format(salary);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-IN').format(num);
  };

  const isFixedTerm = (emp: Employee) => fixedTermCategories.includes(emp.employee_category);

  const handleAddContract = async () => {
    if (!selectedEmployee) return;

    const payload = {
      contract_amount: newContract.contract_amount,
      contract_period_months: newContract.contract_period_months,
      employee_category: newContract.contract_type === 'Full-time' ? 'Employee' : newContract.contract_type,
    };

    try {
      const res = await fetch(`https://hr-forms.onrender.com/api/employees/${selectedEmployee.id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const updatedEmp = await res.json();
        setEmployees(prev => prev.map(e => e.id === updatedEmp.id ? updatedEmp : e));
        setSelectedEmployee(updatedEmp);
        setIsAddingContract(false);
        alert('Contract added successfully!');
      }
    } catch (err) {
      alert('Error adding contract');
    }
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
                {searchTerm ? 'No matching employees' : 'No employees found'}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                {filteredEmployees.map((emp) => (
                  <div key={emp.id} className="bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all border border-gray-200 overflow-hidden">
                    <div className="p-6 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <img
                            src={emp.photo || 'https://via.placeholder.com/80'}
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
                      <p className="text-2xl font-bold text-indigo-700">{formatSalary(emp.annual_ctc)}</p>
                      <p className="text-sm text-gray-500">
                        Joined: {new Date(emp.joining_date).toLocaleDateString('en-IN')}
                      </p>
                    </div>

                    <div className="p-6 pt-0">
                      <button
                        onClick={() => setSelectedEmployee(emp)}
                        className="w-full bg-purple-600 text-white py-4 rounded-xl hover:bg-purple-700 font-medium flex items-center justify-center gap-3 text-lg"
                      >
                        View Full Details
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Full Employee Details Modal */}
      {selectedEmployee && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setSelectedEmployee(null)}>
          <div className="bg-white rounded-3xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-10">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-4xl font-bold text-gray-800">
                  Employee Details — {selectedEmployee.full_name}
                </h2>
                <button onClick={() => setSelectedEmployee(null)} className="text-4xl text-gray-500 hover:text-gray-700">&times;</button>
              </div>

              {/* Personal Details */}
              <h3 className="text-3xl font-bold mb-6 text-indigo-800">Personal Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 rounded-2xl p-8 mb-10">
                <div><p className="text-sm text-gray-600">Employee ID</p><p className="text-xl font-semibold">{selectedEmployee.employee_id}</p></div>
                <div><p className="text-sm text-gray-600">Gender</p><p className="text-xl font-semibold">{selectedEmployee.gender || 'N/A'}</p></div>
                <div><p className="text-sm text-gray-600">Personal Email</p><p className="text-xl font-semibold">{selectedEmployee.personal_email || 'N/A'}</p></div>
                <div><p className="text-sm text-gray-600">Mobile</p><p className="text-xl font-semibold">{selectedEmployee.mobile}</p></div>
                <div><p className="text-sm text-gray-600">Buddy</p><p className="text-xl font-semibold">{selectedEmployee.name_of_buddy || 'N/A'}</p></div>
                <div><p className="text-sm text-gray-600">Status</p><p className="text-xl font-semibold">{selectedEmployee.exit_status}</p></div>
              </div>

              {/* CTC Breakdown */}
              {isFixedTerm(selectedEmployee) ? (
                <div className="bg-gradient-to-br from-teal-50 to-cyan-100 rounded-3xl p-10 mb-10">
                  <h3 className="text-3xl font-bold mb-8 text-teal-900">Fixed-Term Contract</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
                    <div className="bg-white rounded-2xl p-8 shadow-lg">
                      <p className="text-lg text-gray-600 mb-2">Contract Amount</p>
                      <p className="text-4xl font-bold text-teal-700">
                        {formatSalary(selectedEmployee.contract_amount || 0)}
                      </p>
                    </div>
                    <div className="bg-white rounded-2xl p-8 shadow-lg">
                      <p className="text-lg text-gray-600 mb-2">Contract Period</p>
                      <p className="text-4xl font-bold text-purple-700">
                        {selectedEmployee.contract_period_months || 0} months
                      </p>
                    </div>
                    <div className="bg-white rounded-2xl p-8 shadow-lg">
                      <p className="text-lg text-gray-600 mb-2">Monthly CTC</p>
                      <p className="text-4xl font-bold text-indigo-700">
                        {formatSalary(selectedEmployee.equivalent_monthly_ctc || 0)}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <h3 className="text-3xl font-bold mb-6 text-indigo-800">Monthly Salary Components</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 bg-gray-50 rounded-3xl p-8 mb-10">
                    <div><p className="text-sm text-gray-600">Basic</p><p className="text-xl font-semibold">{formatNumber(selectedEmployee.basic)}</p></div>
                    <div><p className="text-sm text-gray-600">HRA</p><p className="text-xl font-semibold">{formatNumber(selectedEmployee.hra)}</p></div>
                    <div><p className="text-sm text-gray-600">Telephone Allowance</p><p className="text-xl font-semibold">{formatNumber(Math.round(selectedEmployee.telephone_reimbursement_annual / 12))}</p></div>
                    <div><p className="text-sm text-gray-600">Travel Allowance</p><p className="text-xl font-semibold">{formatNumber(selectedEmployee.travel_allowance)}</p></div>
                    <div><p className="text-sm text-gray-600">Children's Education</p><p className="text-xl font-semibold">{formatNumber(selectedEmployee.childrens_education_allowance)}</p></div>
                    <div><p className="text-sm text-gray-600">Supplementary</p><p className="text-xl font-semibold">{formatNumber(selectedEmployee.supplementary_allowance)}</p></div>
                    <div className="lg:col-span-3">
                      <p className="text-sm text-gray-600">Gross Monthly</p>
                      <p className="text-2xl font-bold text-green-700">{formatNumber(selectedEmployee.gross_monthly)}</p>
                    </div>
                    <div><p className="text-sm text-gray-600">Employer PF</p><p className="text-xl font-semibold">{formatNumber(selectedEmployee.employer_pf)}</p></div>
                    <div><p className="text-sm text-gray-600">Employer ESI</p><p className="text-xl font-semibold">{formatNumber(selectedEmployee.employer_esi)}</p></div>
                    <div className="lg:col-span-3">
                      <p className="text-sm text-gray-600">Monthly CTC</p>
                      <p className="text-2xl font-bold text-blue-700">{formatNumber(selectedEmployee.monthly_ctc)}</p>
                    </div>
                    <div><p className="text-sm text-gray-600">Annual Bonus</p><p className="text-xl font-semibold">{formatNumber(selectedEmployee.annual_bonus)}</p></div>
                    <div><p className="text-sm text-gray-600">Performance Incentive</p><p className="text-xl font-semibold">{formatNumber(selectedEmployee.annual_performance_incentive)}</p></div>
                    <div><p className="text-sm text-gray-600">Medical Premium</p><p className="text-xl font-semibold">{formatNumber(selectedEmployee.medical_premium)}</p></div>
                    <div><p className="text-sm text-gray-600">Gratuity</p><p className="text-xl font-semibold">{formatNumber(selectedEmployee.gratuity)}</p></div>
                  </div>

                  <h3 className="text-3xl font-bold mb-6 text-indigo-800">Annual Reimbursements</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 bg-gray-50 rounded-3xl p-8 mb-10">
                    <div><p className="text-sm text-gray-600">Medical</p><p className="text-xl font-semibold">{formatNumber(selectedEmployee.medical_reimbursement_annual)}</p></div>
                    <div><p className="text-sm text-gray-600">Vehicle</p><p className="text-xl font-semibold">{formatNumber(selectedEmployee.vehicle_reimbursement_annual)}</p></div>
                    <div><p className="text-sm text-gray-600">Driver</p><p className="text-xl font-semibold">{formatNumber(selectedEmployee.driver_reimbursement_annual)}</p></div>
                    <div><p className="text-sm text-gray-600">Telephone</p><p className="text-xl font-semibold">{formatNumber(selectedEmployee.telephone_reimbursement_annual)}</p></div>
                    <div><p className="text-sm text-gray-600">Meals</p><p className="text-xl font-semibold">{formatNumber(selectedEmployee.meals_reimbursement_annual)}</p></div>
                    <div><p className="text-sm text-gray-600">Uniform</p><p className="text-xl font-semibold">{formatNumber(selectedEmployee.uniform_reimbursement_annual)}</p></div>
                    <div><p className="text-sm text-gray-600">Leave Travel</p><p className="text-xl font-semibold">{formatNumber(selectedEmployee.leave_travel_allowance_annual)}</p></div>
                  </div>
                </>
              )}

              {/* Add Contract Button */}
              <button
                onClick={() => setIsAddingContract(true)}
                className="mb-8 flex items-center gap-3 bg-green-600 text-white px-8 py-4 rounded-xl hover:bg-green-700 font-bold text-xl"
              >
                <Plus size={28} />
                Add Contract / Update Employee Type
              </button>

              {/* Add Contract Form */}
              {isAddingContract && (
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-3xl p-10 mb-10">
                  <h3 className="text-3xl font-bold mb-8 text-blue-900">Add Contract or Update Employee Type</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                      <label className="block text-lg font-semibold mb-2">Employee Type</label>
                      <select
                        value={newContract.contract_type}
                        onChange={(e) => setNewContract({ ...newContract, contract_type: e.target.value })}
                        className="w-full px-5 py-4 rounded-lg border border-gray-300 text-lg"
                      >
                        <option>Full-time</option>
                        <option>Part-time</option>
                        <option>Intern</option>
                        <option>Temporary Staff</option>
                        <option>Contract Based</option>
                      </select>
                    </div>
                    {newContract.contract_type !== 'Full-time' && newContract.contract_type !== 'Part-time' && (
                      <>
                        <div>
                          <label className="block text-lg font-semibold mb-2">Contract Amount (₹)</label>
                          <input
                            type="number"
                            value={newContract.contract_amount}
                            onChange={(e) => setNewContract({ ...newContract, contract_amount: Number(e.target.value) })}
                            className="w-full px-5 py-4 rounded-lg border border-gray-300 text-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-lg font-semibold mb-2">Contract Period (months)</label>
                          <input
                            type="number"
                            value={newContract.contract_period_months}
                            onChange={(e) => setNewContract({ ...newContract, contract_period_months: Number(e.target.value) })}
                            className="w-full px-5 py-4 rounded-lg border border-gray-300 text-lg"
                          />
                        </div>
                      </>
                    )}
                  </div>
                  <div className="mt-8 flex gap-4">
                    <button onClick={handleAddContract} className="bg-green-600 text-white px-8 py-4 rounded-xl hover:bg-green-700 font-bold">
                      Save & Update
                    </button>
                    <button onClick={() => setIsAddingContract(false)} className="bg-gray-600 text-white px-8 py-4 rounded-xl hover:bg-gray-700 font-bold">
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <div className="p-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-3xl text-white text-center shadow-2xl">
                <p className="text-3xl font-bold mb-4">Total Annual CTC</p>
                <p className="text-6xl font-black">{formatSalary(selectedEmployee.annual_ctc)}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}