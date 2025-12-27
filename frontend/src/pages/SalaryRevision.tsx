'use client';

import { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import { Download, FileText, Edit2 } from 'lucide-react';

type Employee = {
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

export default function SalaryRevisionPage() {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

    useEffect(() => {
        fetch('http://127.0.0.1:8000/api/employees/')
            .then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .then(data => {
                setEmployees(data);
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to load employees:", err);
                setLoading(false);
            });
    }, []);

    const formatSalary = (salary: number) => {
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(salary);
    };

    return (
        <div className="flex h-screen bg-gray-100">
            {/* Sidebar */}
            <Sidebar />

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Navbar */}
                <Navbar />

                {/* Scrollable Content */}
                <main className="flex-1 overflow-y-auto p-20">
                    <h1 className="text-5xl font-bold text-center text-gray-800 mb-16">
                        Salary Revision Dashboard
                    </h1>

                    {loading ? (
                        <div className="text-center py-32">
                            <div className="text-4xl font-bold text-gray-600">Loading employees...</div>
                        </div>
                    ) : employees.length === 0 ? (
                        <div className="text-center py-32">
                            <div className="text-4xl font-bold text-gray-600">No employees found</div>
                            <p className="text-xl text-gray-500 mt-6">
                                Add employees in Django admin or check the API.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10 max-w-7xl mx-auto">
                            {employees.map((emp) => (
                                <div
                                    key={emp.id}
                                    className="bg-white rounded-2xl border border-gray-200 p-6
             hover:shadow-lg transition-all hover:-translate-y-1"
                                >
                                    {/* Header */}
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h3 className="text-lg font-semibold text-gray-800">
                                                {emp.full_name}
                                            </h3>
                                            <p className="text-xs text-gray-500">{emp.employee_id}</p>
                                        </div>

                                        <span className="text-xs font-medium px-3 py-1 rounded-full
                     bg-indigo-50 text-indigo-700">
                                            {emp.department}
                                        </span>
                                    </div>

                                    {/* Info */}
                                    <div className="space-y-1 text-sm text-gray-600 mb-4">
                                        <p>{emp.designation}</p>
                                        <p className="font-semibold text-gray-800">
                                            {formatSalary(emp.current_salary)}
                                        </p>
                                        <p className="text-xs">
                                            Joined: {new Date(emp.joining_date).toLocaleDateString('en-IN')}
                                        </p>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-3">
                                        <button
                                            className="flex-1 flex items-center justify-center gap-2
                 text-sm font-medium py-2 rounded-lg
                 bg-gray-100 hover:bg-gray-200 transition"
                                        >
                                            <Download size={16} />
                                            Payslip
                                        </button>

                                        <button
                                            onClick={() => setSelectedEmployee(emp)}
                                            className="flex-1 flex items-center justify-center gap-2
                 text-sm font-medium py-2 rounded-lg
                 bg-indigo-600 text-white hover:bg-indigo-700 transition"
                                        >
                                            <FileText size={16} />
                                            Contracts
                                        </button>
                                    </div>
                                </div>

                            ))}
                        </div>
                    )}
                </main>
            </div>

            {/* Contracts Modal */}
            {selectedEmployee && (
                <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-6">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto p-12">
                        <div className="flex justify-between items-center mb-10">
                            <h2 className="text-4xl font-bold text-gray-800">
                                Contracts — {selectedEmployee.full_name}
                            </h2>
                            <button
                                onClick={() => setSelectedEmployee(null)}
                                className="text-5xl text-gray-500 hover:text-gray-700 transition"
                            >
                                ×
                            </button>
                        </div>

                        <div className="space-y-8">
                            {selectedEmployee.contracts.length === 0 ? (
                                <p className="text-center text-2xl text-gray-600 py-16">No contracts found</p>
                            ) : (
                                selectedEmployee.contracts.map((contract) => (
                                    <div key={contract.id} className="bg-gray-50 rounded-2xl p-10 border-2 border-gray-300">
                                        <div className="flex justify-between items-start">
                                            <div className="space-y-4">
                                                <p className="text-3xl font-bold text-gray-800">{contract.contract_type}</p>
                                                <p className="text-2xl"><strong>Salary:</strong> {formatSalary(contract.salary)}</p>
                                                <p className="text-xl">
                                                    <strong>Status:</strong>{' '}
                                                    <span className={contract.is_active ? "text-green-600 font-bold" : "text-red-600 font-bold"}>
                                                        {contract.is_active ? "Active" : "Inactive"}
                                                    </span>
                                                </p>
                                                <p className="text-xl"><strong>Start Date:</strong> {new Date(contract.start_date).toLocaleDateString('en-IN')}</p>
                                                {contract.end_date && (
                                                    <p className="text-xl"><strong>End Date:</strong> {new Date(contract.end_date).toLocaleDateString('en-IN')}</p>
                                                )}
                                            </div>

                                            <button className="bg-orange-600 text-white p-6 rounded-2xl hover:bg-orange-700 transition">
                                                <Edit2 size={32} />
                                            </button>
                                        </div>
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