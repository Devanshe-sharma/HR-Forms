'use client';

import { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import { Download, FileText, Edit2, Plus, Save, X } from 'lucide-react';
import jsPDF from 'jspdf';
// import html2canvas from 'html2canvas';
import { ChevronDown } from 'lucide-react';

type Employee = {
  last_name: any;
  middle_name: string;
  first_name: any;
  reporting_manager: string;
  id: number;
  employee_id: string;
  full_name: string;
  email: string;
  department: string;
  designation: string;
  current_salary: number;
  joining_date: string;
  contracts: Contract[];
  payslips: Payslip[];
  photo?: string;
};

type Contract = {
  id: number;
  contract_type: string;
  start_date: string;
  end_date: string | null;
  salary: number;
  is_active: boolean;
};

type Payslip = {
  id: number;
  month: string;
  file: string | null;
};

const contractTypes = ["Full-time", "Part-time", "Intern", "Temporary Staff", "Contract Based"];

export default function SalaryRevisionPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [openDownloadMenu, setOpenDownloadMenu] = useState<number | null>(null);

  const [newContract, setNewContract] = useState({
    contract_type: "Full-time",
    salary: 0,
    start_date: "",
    end_date: "",
    is_active: true
  });

  useEffect(() => {
    fetch('http://127.0.0.1:8000/api/employees/')
      .then(res => res.json())
      .then(data => setEmployees(data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const formatSalary = (salary: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(salary);
  };

  // Get current salary from active contract
  const getCurrentSalary = (employee: Employee) => {
    const activeContract = employee.contracts.find(c => c.is_active);
    return activeContract ? activeContract.salary : employee.current_salary;
  };

  const handleSaveEdit = () => {
    if (selectedEmployee && editingContract) {
      const updatedContracts = selectedEmployee.contracts.map(c =>
        c.id === editingContract.id ? editingContract : c
      );
      const updatedEmp = { ...selectedEmployee, contracts: updatedContracts };
      setEmployees(employees.map(e => e.id === selectedEmployee.id ? updatedEmp : e));
      setSelectedEmployee(updatedEmp);
      setEditingContract(null);
    }
  };

  const handleAddNewContract = () => {
    if (selectedEmployee) {
      const newId = Math.max(...selectedEmployee.contracts.map(c => c.id), 0) + 1;
      const newC = {
        id: newId,
        contract_type: newContract.contract_type,
        salary: newContract.salary,
        start_date: newContract.start_date,
        end_date: newContract.end_date || null,
        is_active: newContract.is_active
      };

      const updatedContracts = [...selectedEmployee.contracts, newC];
      const updatedEmp = { ...selectedEmployee, contracts: updatedContracts };
      setEmployees(employees.map(e => e.id === selectedEmployee.id ? updatedEmp : e));
      setSelectedEmployee(updatedEmp);
      setIsAddingNew(false);
      setNewContract({ contract_type: "Full-time", salary: 0, start_date: "", end_date: "", is_active: true });
    }
  };

 const generateSalaryRevisionLetter = (emp: Employee) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  let y = 20;

  /* ===== HEADER ===== */
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Strictly Personal & Confidential", pageWidth / 2, y, { align: "center" });

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");

  y += 15;
  doc.text(`Date: ${new Date().toLocaleDateString("en-IN")}`, 20, y);
  y += 8;
  doc.text(`Employee ID: ${emp.employee_id}`, 20, y);
  y += 8;
  doc.text(`Name: ${emp.full_name}`, 20, y);
  y += 8;
  doc.text("Address:", 20, y);

  /* ===== SUBJECT ===== */
  y += 15;
  doc.setFont("helvetica", "bold");
  doc.text("Sub: Salary Revision", 20, y);

  y += 12;
  doc.setFont("helvetica", "normal");
  doc.text(`Dear ${emp.full_name},`, 20, y);

  y += 10;
  doc.text(
    "1. We are pleased to inform you that your salary has been revised upwards.",
    20,
    y
  );

  y += 8;
  doc.text("2. The revised salary details are as follows:", 20, y);

  /* ===== MAIN DETAILS BOX ===== */
  y += 6;

  const boxX = 20;
  const boxWidth = pageWidth - 40;
  const labelColWidth = 60;
  const rowHeight = 9;

  const rows = [
    ["Date applicable", new Date().toLocaleDateString("en-IN")],
    ["Company", "Brisk Olive Business Solutions Pvt Ltd"],
    ["Department", emp.department],
    ["Designation", emp.designation],
    ["Reporting To", emp.reporting_manager || ""],
    ["Annual CTC", formatSalary(emp.current_salary)],
    ["Details of CTC", "Attached as Annexure 'A'"],
    ["Benefits", "As per Company Policy"],
  ];

  const boxHeight = rows.length * rowHeight + 6;

  // Outer border
  doc.rect(boxX, y, boxWidth, boxHeight);

  // Vertical divider
  doc.line(boxX + labelColWidth, y, boxX + labelColWidth, y + boxHeight);

  let textY = y + 8;

  rows.forEach(([label, value]) => {
    doc.setFont("helvetica", "normal");
    doc.text(label, boxX + 4, textY);
    doc.text(value, boxX + labelColWidth + 4, textY);
    textY += rowHeight;
  });

  y += boxHeight + 10;

  /* ===== TERMS BOX ===== */
  const termsHeight = 20;

  doc.rect(boxX, y, boxWidth, termsHeight);
  doc.line(boxX + labelColWidth, y, boxX + labelColWidth, y + termsHeight);

  doc.text("Other Terms and Conditions", boxX + 4, y + 8);

  doc.text(
    "All other Terms and Conditions of your employment remains unchanged, as per your initial appointment letter, or subsequent instructions, if any.",
    boxX + labelColWidth + 4,
    y + 8,
    { maxWidth: boxWidth - labelColWidth - 8 }
  );

  y += termsHeight + 15;

  /* ===== FOOTER ===== */
  doc.text(
    "We congratulate you and wish you success in your endeavours.",
    20,
    y
  );

  y += 15;
  doc.text("For Brisk Olive Business Solutions Pvt Ltd", 20, y);

  y += 15;
  doc.text("Authorised Signatory", 20, y);

  doc.save(`Salary_Revision_${emp.employee_id}.pdf`);
};


  const generateConfirmationLetter = (emp: Employee) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  let y = 20;
  const currentDate = new Date().toLocaleDateString("en-IN");

  /* ===== HEADER ===== */
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Strictly Personal & Confidential", pageWidth / 2, y, { align: "center" });

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");

  y += 15;
  doc.text(`Date: ${currentDate}`, 20, y);

  y += 10;
  doc.text(`Employee ID: ${emp.employee_id}`, 20, y);

  y += 15;
  doc.text(`First Name: ${emp.first_name}`, 20, y);
  y += 8;
  doc.text(`Middle Name: ${emp.middle_name || ""}`, 20, y);
  y += 8;
  doc.text(`Surname: ${emp.last_name}`, 20, y);

  /* ===== SUBJECT ===== */
  y += 20;
  doc.setFont("helvetica", "bold");
  doc.text("Sub: Confirmation Letter", 20, y);

  /* ===== BODY ===== */
  y += 15;
  doc.setFont("helvetica", "normal");
  doc.text(`Dear ${emp.full_name},`, 20, y);

  y += 12;
  doc.text(
    `Following completion of your confirmation period, we are pleased to inform you that your employment with the Company has been confirmed with effect from ${currentDate}.`,
    20,
    y,
    { maxWidth: pageWidth - 40 }
  );

  y += 18;
  doc.text(
    "All other Terms and Conditions of your employment remain unchanged as per your initial appointment letter, or subsequent instructions, if any.",
    20,
    y,
    { maxWidth: pageWidth - 40 }
  );

  y += 18;
  doc.text(
    "We congratulate you and wish you success in your endeavours.",
    20,
    y
  );

  /* ===== FOOTER ===== */
  y += 25;
  doc.text("For Brisk Olive Business Solutions Pvt Ltd", 20, y);

  y += 20;
  doc.text("Authorised Signatory", 20, y);

  y += 20;
  doc.text(
    "I accept the Company's terms and conditions and confirm my taking up the above position.",
    20,
    y,
    { maxWidth: pageWidth - 40 }
  );

  /* ===== SIGNATURE BLOCK ===== */
  y += 20;
  doc.text("Signatures of Employee:", 20, y);

  y += 12;
  doc.text(`First Name: ${emp.first_name}`, 20, y);
  y += 8;
  doc.text(`Middle Name: ${emp.middle_name || ""}`, 20, y);
  y += 8;
  doc.text(`Surname: ${emp.last_name}`, 20, y);

  y += 12;
  doc.text("Date: ___________________________", 20, y);

  doc.save(`Confirmation_Letter_${emp.employee_id}.pdf`);
};



  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar />
        <main className="flex-1 overflow-y-auto p-20">
          <h1 className="text-4xl font-bold text-center text-gray-800 mb-12">
            Salary Revision Dashboard
          </h1>

          {loading ? (
            <div className="text-center py-20 text-3xl text-gray-600">Loading employees...</div>
          ) : employees.length === 0 ? (
            <div className="text-center py-20 text-3xl text-gray-600">No employees found</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
              {employees.map((emp) => {
                const displayedSalary = getCurrentSalary(emp);

                return (
                  <div
                    key={emp.id}
                    className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-shadow border border-gray-200"
                  >
                    {/* Header with Photo, Name, ID, Department */}
                    <div className="p-6 border-b border-gray-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <img
                            src={emp.photo || "https://via.placeholder.com/80"}
                            alt={emp.full_name}
                            className="w-16 h-16 rounded-full object-cover border-2 border-gray-300"
                          />
                          <div>
                            <h3 className="text-xl font-bold text-gray-900">{emp.full_name}</h3>
                            <p className="text-sm text-gray-500">{emp.employee_id}</p>
                          </div>
                        </div>
                        <span className="bg-lime-100 text-lime-800 px-4 py-2 rounded-full text-sm font-semibold">
                          {emp.department}
                        </span>
                      </div>
                    </div>

                    {/* Details */}
                    <div className="p-6 space-y-3 text-sm text-gray-700">
                      <p><strong>Email:</strong> {emp.email}</p>
                      <p><strong>Designation:</strong> {emp.designation}</p>
                      <p><strong>Current Salary:</strong> {formatSalary(displayedSalary)}</p>
                      <p><strong>Joining:</strong> {new Date(emp.joining_date).toLocaleDateString('en-IN')}</p>
                    </div>

                    {/* Buttons */}
                    <div className="p-6 pt-0 flex gap-4">
                     {/* Download Button with Dropdown */}
                    <div className="relative">
                    <button
                        onClick={() => setOpenDownloadMenu(openDownloadMenu === emp.id ? null : emp.id)}
                        className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition font-medium"
                    >
                        <Download size={18} />
                        Download Documents
                        <ChevronDown size={18} className={`transition ${openDownloadMenu === emp.id ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Dropdown Menu */}
                    {openDownloadMenu === emp.id && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-2xl border border-gray-200 z-10 overflow-hidden">
                        <button
                            onClick={() => {
                            generateSalaryRevisionLetter(emp);
                            setOpenDownloadMenu(null);
                            }}
                            className="w-full text-left px-6 py-3 hover:bg-gray-100 transition flex items-center gap-3"
                        >
                            <FileText size={18} />
                            Salary Revision Letter
                        </button>
                        <button
                            onClick={() => {
                            generateConfirmationLetter(emp);
                            setOpenDownloadMenu(null);
                            }}
                            className="w-full text-left px-6 py-3 hover:bg-gray-100 transition flex items-center gap-3"
                        >
                            <FileText size={18} />
                            Confirmation Letter
                        </button>
                        <button
                            onClick={() => {
                            alert("Consultant Letter - Coming Soon!");
                            setOpenDownloadMenu(null);
                            }}
                            className="w-full text-left px-6 py-3 hover:bg-gray-100 transition flex items-center gap-3"
                        >
                            <FileText size={18} />
                            Consultant Letter
                        </button>
                        <button
                            onClick={() => {
                            alert("Offer Letter - Coming Soon!");
                            setOpenDownloadMenu(null);
                            }}
                            className="w-full text-left px-6 py-3 hover:bg-gray-100 transition flex items-center gap-3"
                        >
                            <FileText size={18} />
                            Offer Letter
                        </button>
                        <button
                            onClick={() => {
                            alert("Offer Letter Breakdown - Coming Soon!");
                            setOpenDownloadMenu(null);
                            }}
                            className="w-full text-left px-6 py-3 hover:bg-gray-100 transition flex items-center gap-3 border-t"
                        >
                            <FileText size={18} />
                            Offer Letter Breakdown
                        </button>
                        </div>
                    )}
                    </div>
                      <button
                        onClick={() => setSelectedEmployee(emp)}
                        className="flex-1 flex items-center justify-center gap-2 bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 transition font-medium"
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
        </main>
      </div>

      {/* Contracts Modal with Add & Edit */}
      {selectedEmployee && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-3xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto p-12">
            <div className="flex justify-between items-center mb-10">
              <h2 className="text-4xl font-bold text-gray-800">
                Contracts — {selectedEmployee.full_name}
              </h2>
              <button
                onClick={() => {
                  setSelectedEmployee(null);
                  setEditingContract(null);
                  setIsAddingNew(false);
                }}
                className="text-5xl text-gray-500 hover:text-gray-700 transition"
              >
                ×
              </button>
            </div>

            {/* Add New Contract Button */}
            <button
              onClick={() => setIsAddingNew(true)}
              className="mb-8 flex items-center gap-3 bg-green-600 text-white px-6 py-4 rounded-xl hover:bg-green-700 transition font-bold"
            >
              <Plus size={28} />
              Add New Contract
            </button>

            {/* Add New Contract Form */}
            {isAddingNew && (
              <div className="bg-blue-50 rounded-2xl p-8 mb-10 border-2 border-blue-200">
                <h3 className="text-2xl font-bold mb-6 text-blue-900">New Contract</h3>
                <div className="grid grid-cols-2 gap-6">
                  <select
                    value={newContract.contract_type}
                    onChange={(e) => setNewContract({ ...newContract, contract_type: e.target.value })}
                    className="px-4 py-3 rounded-lg border border-gray-300 text-lg"
                  >
                    {contractTypes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <input
                    type="number"
                    placeholder="Salary"
                    value={newContract.salary}
                    onChange={(e) => setNewContract({ ...newContract, salary: Number(e.target.value) })}
                    className="px-4 py-3 rounded-lg border border-gray-300 text-lg"
                  />
                  <input
                    type="date"
                    value={newContract.start_date}
                    onChange={(e) => setNewContract({ ...newContract, start_date: e.target.value })}
                    className="px-4 py-3 rounded-lg border border-gray-300 text-lg"
                  />
                  <input
                    type="date"
                    value={newContract.end_date}
                    onChange={(e) => setNewContract({ ...newContract, end_date: e.target.value })}
                    className="px-4 py-3 rounded-lg border border-gray-300 text-lg"
                  />
                </div>
                <label className="flex items-center gap-3 mt-6 text-lg">
                  <input
                    type="checkbox"
                    checked={newContract.is_active}
                    onChange={(e) => setNewContract({ ...newContract, is_active: e.target.checked })}
                    className="w-6 h-6"
                  />
                  Active Contract
                </label>
                <div className="mt-6 flex gap-4">
                  <button
                    onClick={handleAddNewContract}
                    className="bg-green-600 text-white px-8 py-3 rounded-lg hover:bg-green-700 font-bold"
                  >
                    Save New Contract
                  </button>
                  <button
                    onClick={() => setIsAddingNew(false)}
                    className="bg-gray-600 text-white px-8 py-3 rounded-lg hover:bg-gray-700 font-bold"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Existing Contracts */}
            <div className="space-y-8">
              {selectedEmployee.contracts.length === 0 ? (
                <p className="text-center text-2xl text-gray-600 py-16">No contracts found</p>
              ) : (
                selectedEmployee.contracts.map((contract) => (
                  <div key={contract.id} className="bg-gray-50 rounded-xl p-6 border border-gray-300">
                    {editingContract?.id === contract.id ? (
                      // Edit Mode
                      <div className="space-y-6">
                        <select
                          value={editingContract.contract_type}
                          onChange={(e) => setEditingContract({ ...editingContract, contract_type: e.target.value })}
                          className="w-full px-4 py-3 rounded-lg border border-gray-300 text-lg"
                        >
                          {contractTypes.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <input
                          type="number"
                          value={editingContract.salary}
                          onChange={(e) => setEditingContract({ ...editingContract, salary: Number(e.target.value) })}
                          className="w-full px-4 py-3 rounded-lg border border-gray-300 text-lg"
                        />
                        <input
                          type="date"
                          value={editingContract.start_date}
                          onChange={(e) => setEditingContract({ ...editingContract, start_date: e.target.value })}
                          className="w-full px-4 py-3 rounded-lg border border-gray-300 text-lg"
                        />
                        <input
                          type="date"
                          value={editingContract.end_date || ""}
                          onChange={(e) => setEditingContract({ ...editingContract, end_date: e.target.value || null })}
                          className="w-full px-4 py-3 rounded-lg border border-gray-300 text-lg"
                        />
                        <label className="flex items-center gap-3 text-lg">
                          <input
                            type="checkbox"
                            checked={editingContract.is_active}
                            onChange={(e) => setEditingContract({ ...editingContract, is_active: e.target.checked })}
                            className="w-6 h-6"
                          />
                          Active
                        </label>
                        <div className="flex gap-4">
                          <button
                            onClick={handleSaveEdit}
                            className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 flex items-center gap-2"
                          >
                            <Save size={20} />
                            Save
                          </button>
                          <button
                            onClick={() => setEditingContract(null)}
                            className="bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 flex items-center gap-2"
                          >
                            <X size={20} />
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      // View Mode
                      <div className="flex justify-between items-start">
                        <div className="space-y-3">
                          <p className="text-2xl font-bold text-gray-800">{contract.contract_type}</p>
                          <p className="text-lg"><strong>Salary:</strong> {formatSalary(contract.salary)}</p>
                          <p className="text-lg">
                            <strong>Status:</strong>{' '}
                            <span className={contract.is_active ? "text-green-600 font-bold" : "text-red-600 font-bold"}>
                              {contract.is_active ? "Active" : "Inactive"}
                            </span>
                          </p>
                          <p className="text-lg"><strong>Start Date:</strong> {new Date(contract.start_date).toLocaleDateString('en-IN')}</p>
                          {contract.end_date && (
                            <p className="text-lg"><strong>End Date:</strong> {new Date(contract.end_date).toLocaleDateString('en-IN')}</p>
                          )}
                        </div>
                        <button
                          onClick={() => setEditingContract(contract)}
                          className="bg-orange-600 text-white p-4 rounded-lg hover:bg-orange-700"
                        >
                          <Edit2 size={24} />
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}