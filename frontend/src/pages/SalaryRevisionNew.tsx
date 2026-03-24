import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import { Search, Plus, Edit, Save, X, Filter, Download, Calendar, User, Building, Mail, DollarSign, TrendingUp, AlertCircle } from 'lucide-react';
import axios from 'axios';

const API_BASE = 'http://localhost:5000/api';

// Configure axios defaults
const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor for auth headers
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  const userName = localStorage.getItem('userName');
  const userRole = localStorage.getItem('userRole');
  
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (userName) {
    config.headers['x-user-name'] = userName;
  }
  if (userRole) {
    config.headers['x-user-role'] = userRole;
  }
  
  return config;
});

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

interface Employee {
  _id: string;
  employee_id: string;
  full_name: string;
  department: string;
  designation: string;
  email: string;
  annual_ctc: number;
  monthly_ctc: number;
  joining_date: string;
  employee_category: string;
}

interface CTCComponent {
  _id: string;
  name: string;
  code: string;
  formula: string;
  order: number;
  is_active: boolean;
}

interface PMSScore {
  kpi_score: number;
  hygiene_score: number;
  growth_score: number;
  total_score: number;
}

interface SalaryRevision {
  _id?: string;
  employee_id: string;
  employee_name: string;
  department: string;
  designation: string;
  applicable_date: string;
  category: 'Employee' | 'Consultant';
  decision: 'Increment' | 'PIP';
  increment_percentage: number;
  manager_recommendation: number;
  management_recommendation: number;
  final_increment_percentage: number;
  previous_ctc: number;
  new_ctc: number;
  pip_duration?: number;
  pip_due_date?: string;
  pip_reason?: string;
  pms_scores: PMSScore;
  salary_structure: Record<string, number>;
  status: 'Draft' | 'Submitted' | 'Approved' | 'Rejected';
  created_at: string;
  updated_at: string;
}

export default function SalaryRevisionPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [ctcComponents, setCtcComponents] = useState<CTCComponent[]>([]);
  const [revisions, setRevisions] = useState<SalaryRevision[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingRevision, setEditingRevision] = useState<SalaryRevision | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    department: '',
    designation: '',
    duration: '',
    decision: ''
  });

  const [formData, setFormData] = useState<Partial<SalaryRevision>>({
    applicable_date: new Date().toISOString().split('T')[0],
    category: 'Employee',
    decision: 'Increment',
    increment_percentage: 0,
    manager_recommendation: 0,
    management_recommendation: 0,
    final_increment_percentage: 0,
    pms_scores: {
      kpi_score: 0,
      hygiene_score: 0,
      growth_score: 0,
      total_score: 0
    },
    salary_structure: {},
    status: 'Draft'
  });

  // Fetch employees
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const res = await api.get('/employees/');
        console.log('Employees API response:', res.data);
        setEmployees(res.data.data || []);
      } catch (error) {
        console.error('Failed to fetch employees:', error);
      }
    };
    fetchEmployees();
  }, []);

  // Fetch CTC components
  useEffect(() => {
    const fetchCTCComponents = async () => {
      try {
        const res = await api.get('/ctc-components/');
        setCtcComponents(res.data.filter((c: CTCComponent) => c.is_active));
      } catch (error) {
        console.error('Failed to fetch CTC components:', error);
      }
    };
    fetchCTCComponents();
  }, []);

  // Fetch revisions
  useEffect(() => {
    const fetchRevisions = async () => {
      setLoading(true);
      try {
        const res = await api.get('/salary-revisions/');
        setRevisions(res.data.data || []);
      } catch (error) {
        console.error('Failed to fetch revisions:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchRevisions();
  }, []);

  // Auto-populate employee details
  const handleEmployeeSelect = (employeeId: string) => {
    const employee = employees.find(emp => emp._id === employeeId);
    if (employee) {
      setSelectedEmployee(employee);
      setFormData(prev => ({
        ...prev,
        employee_id: employee._id,
        employee_name: employee.full_name,
        department: employee.department,
        designation: employee.designation,
        previous_ctc: employee.annual_ctc,
        new_ctc: employee.annual_ctc,
        salary_structure: {}
      }));
    }
  };

  // Calculate final increment percentage
  const calculateFinalIncrement = () => {
    const manager = formData.manager_recommendation || 0;
    const management = formData.management_recommendation || 0;
    const final = management || manager || 0;
    
    setFormData(prev => ({
      ...prev,
      final_increment_percentage: final,
      new_ctc: prev.previous_ctc ? prev.previous_ctc * (1 + final / 100) : 0
    }));
  };

  // Calculate PMS total score
  const calculatePMSScore = () => {
    const total = (formData.pms_scores?.kpi_score || 0) + 
                  (formData.pms_scores?.hygiene_score || 0) + 
                  (formData.pms_scores?.growth_score || 0);
    
    setFormData(prev => ({
      ...prev,
      pms_scores: {
        ...prev.pms_scores!,
        total_score: total
      }
    }));
  };

  // Generate salary structure
  const generateSalaryStructure = () => {
    if (!formData.new_ctc) return;
    
    const newCTC = Number(formData.new_ctc);
    const structure: Record<string, number> = {};
    
    // Basic formulas (can be customized)
    structure.BASIC = newCTC * 0.4; // 40% of CTC
    structure.HRA = newCTC * 0.2; // 20% of CTC
    structure.TELEPHONE = newCTC * 0.05; // 5% of CTC
    structure.CONVEYANCE = newCTC * 0.1; // 10% of CTC
    structure.EDUCATION = newCTC * 0.05; // 5% of CTC
    structure.ANNUAL_BONUS = newCTC * 0.1; // 10% of CTC
    structure.PERF_INCENTIVE = newCTC * 0.05; // 5% of CTC
    
    // Deductions
    structure.PF = structure.BASIC * 0.12; // 12% of Basic
    structure.ESI = Math.min(structure.BASIC * 0.0075, 21000); // 7.5% of Basic, max 21000
    
    // Monthly calculations
    structure.MONTHLY_CTC = newCTC / 12;
    structure.GROSS_MONTHLY = (structure.BASIC + structure.HRA + structure.TELEPHONE + structure.CONVEYANCE + structure.EDUCATION) / 12;
    
    setFormData(prev => ({
      ...prev,
      salary_structure: structure
    }));
  };

  // Save revision
  const saveRevision = async () => {
    if (!selectedEmployee) return;
    
    try {
      const payload = {
        ...formData,
        updated_at: new Date().toISOString()
      };
      
      if (editingRevision) {
        await api.put(`/salary-revisions/${editingRevision._id}`, payload);
      } else {
        await api.post('/salary-revisions/', payload);
      }
      
      setShowForm(false);
      setEditingRevision(null);
      setSelectedEmployee(null);
      // Refresh revisions list
      const res = await api.get('/salary-revisions/');
      setRevisions(res.data.data || []);
    } catch (error) {
      console.error('Failed to save revision:', error);
    }
  };

  // Filter revisions
  const filteredRevisions = revisions.filter(revision => {
    const matchesSearch = revision.employee_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         revision.department.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDepartment = !filters.department || revision.department === filters.department;
    const matchesDesignation = !filters.designation || revision.designation === filters.designation;
    const matchesDecision = !filters.decision || revision.decision === filters.decision;
    
    return matchesSearch && matchesDepartment && matchesDesignation && matchesDecision;
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', { 
      style: 'currency', 
      currency: 'INR', 
      maximumFractionDigits: 0 
    }).format(amount);
  };

  const departments = [...new Set(employees.map(emp => emp.department))];
  const designations = [...new Set(employees.map(emp => emp.designation))];

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <div className="fixed inset-y-0 left-0 w-64 bg-white shadow-lg overflow-y-auto z-10">
        <Sidebar />
      </div>

      <div className="flex-1 flex flex-col ml-64">
        <div className="fixed top-0 left-64 right-0 z-40 bg-white shadow-md">
          <Navbar />
        </div>

        <main className="flex-1 overflow-y-auto pt-16 pb-10 px-6">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex justify-between items-center mb-8 mt-8">
              <div>
                <h1 className="text-3xl font-bold text-gray-800">Salary Revision</h1>
                <p className="text-gray-600 mt-1">Manage employee salary increments and performance improvement plans</p>
              </div>
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-semibold shadow transition"
              >
                <Plus size={20} />
                New Revision
              </button>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
              <div className="flex flex-wrap gap-4 items-center">
                <div className="flex items-center gap-2">
                  <Filter size={18} className="text-gray-500" />
                  <span className="font-medium text-gray-700">Filters:</span>
                </div>
                
                <select
                  value={filters.department}
                  onChange={(e) => setFilters(prev => ({ ...prev, department: e.target.value }))}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">All Departments</option>
                  {departments.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>

                <select
                  value={filters.designation}
                  onChange={(e) => setFilters(prev => ({ ...prev, designation: e.target.value }))}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">All Designations</option>
                  {designations.map(desig => (
                    <option key={desig} value={desig}>{desig}</option>
                  ))}
                </select>

                <select
                  value={filters.decision}
                  onChange={(e) => setFilters(prev => ({ ...prev, decision: e.target.value }))}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">All Decisions</option>
                  <option value="Increment">Increment</option>
                  <option value="PIP">PIP</option>
                </select>

                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="text"
                    placeholder="Search employees..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>

                {(filters.department || filters.designation || filters.decision || searchTerm) && (
                  <button
                    onClick={() => {
                      setFilters({ department: '', designation: '', duration: '', decision: '' });
                      setSearchTerm('');
                    }}
                    className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            </div>

            {/* Revisions Table */}
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PMS Score</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Decision</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Increment %</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">New CTC</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {loading ? (
                      <tr>
                        <td colSpan={8} className="px-6 py-12 text-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                        </td>
                      </tr>
                    ) : filteredRevisions.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                          No salary revisions found
                        </td>
                      </tr>
                    ) : (
                      filteredRevisions.map((revision) => (
                        <tr key={revision._id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <div>
                              <div className="font-medium text-gray-900">{revision.employee_name}</div>
                              <div className="text-sm text-gray-500">{revision.designation}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">{revision.department}</td>
                          <td className="px-6 py-4 text-sm text-gray-900">{revision.pms_scores.total_score}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              revision.decision === 'Increment' 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {revision.decision}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">{revision.final_increment_percentage}%</td>
                          <td className="px-6 py-4 text-sm text-gray-900">{formatCurrency(revision.new_ctc)}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              revision.status === 'Approved' ? 'bg-green-100 text-green-800' :
                              revision.status === 'Submitted' ? 'bg-blue-100 text-blue-800' :
                              revision.status === 'Rejected' ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {revision.status}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  setEditingRevision(revision);
                                  setFormData(revision);
                                  setShowForm(true);
                                }}
                                className="text-blue-600 hover:text-blue-800"
                              >
                                <Edit size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Salary Revision Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900">
                  {editingRevision ? 'Edit Salary Revision' : 'New Salary Revision'}
                </h2>
                <button
                  onClick={() => {
                    setShowForm(false);
                    setEditingRevision(null);
                    setSelectedEmployee(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            <div className="p-6">
              {/* Employee Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Employee
                  </label>
                  <select
                    value={formData.employee_id || ''}
                    onChange={(e) => handleEmployeeSelect(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    disabled={!!editingRevision}
                  >
                    <option value="">Select Employee</option>
                    {employees.map(emp => (
                      <option key={emp._id} value={emp._id}>{emp.full_name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Applicable Date
                  </label>
                  <input
                    type="date"
                    value={formData.applicable_date || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, applicable_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              {/* Auto-fetched Employee Details */}
              {selectedEmployee && (
                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                  <h3 className="font-semibold text-gray-900 mb-3">Employee Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <span className="text-sm text-gray-600">Department:</span>
                      <p className="font-medium">{selectedEmployee.department}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">Designation:</span>
                      <p className="font-medium">{selectedEmployee.designation}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">Email:</span>
                      <p className="font-medium">{selectedEmployee.email}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">Previous CTC:</span>
                      <p className="font-medium">{formatCurrency(selectedEmployee.annual_ctc)}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">Category:</span>
                      <p className="font-medium">{selectedEmployee.employee_category}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">Joining Date:</span>
                      <p className="font-medium">{new Date(selectedEmployee.joining_date).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Decision Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category
                  </label>
                  <select
                    value={formData.category || 'Employee'}
                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value as 'Employee' | 'Consultant' }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="Employee">Employee</option>
                    <option value="Consultant">Consultant</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Decision
                  </label>
                  <select
                    value={formData.decision || 'Increment'}
                    onChange={(e) => setFormData(prev => ({ ...prev, decision: e.target.value as 'Increment' | 'PIP' }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="Increment">Increment</option>
                    <option value="PIP">PIP</option>
                  </select>
                </div>
              </div>

              {/* PMS Scores */}
              <div className="mb-6">
                <h3 className="font-semibold text-gray-900 mb-3">PMS Scores</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">KPI Score</label>
                    <input
                      type="number"
                      value={formData.pms_scores?.kpi_score || 0}
                      onChange={(e) => {
                        setFormData(prev => ({
                          ...prev,
                          pms_scores: { ...prev.pms_scores!, kpi_score: Number(e.target.value) }
                        }));
                        calculatePMSScore();
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Hygiene Score</label>
                    <input
                      type="number"
                      value={formData.pms_scores?.hygiene_score || 0}
                      onChange={(e) => {
                        setFormData(prev => ({
                          ...prev,
                          pms_scores: { ...prev.pms_scores!, hygiene_score: Number(e.target.value) }
                        }));
                        calculatePMSScore();
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Growth Score</label>
                    <input
                      type="number"
                      value={formData.pms_scores?.growth_score || 0}
                      onChange={(e) => {
                        setFormData(prev => ({
                          ...prev,
                          pms_scores: { ...prev.pms_scores!, growth_score: Number(e.target.value) }
                        }));
                        calculatePMSScore();
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Total Score</label>
                    <input
                      type="number"
                      value={formData.pms_scores?.total_score || 0}
                      readOnly
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                    />
                  </div>
                </div>
              </div>

              {/* Increment Recommendations */}
              <div className="mb-6">
                <h3 className="font-semibold text-gray-900 mb-3">Recommendation Structure</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Manager Recommendation %</label>
                    <input
                      type="number"
                      value={formData.manager_recommendation || 0}
                      onChange={(e) => {
                        setFormData(prev => ({ ...prev, manager_recommendation: Number(e.target.value) }));
                        calculateFinalIncrement();
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Management Recommendation %</label>
                    <input
                      type="number"
                      value={formData.management_recommendation || 0}
                      onChange={(e) => {
                        setFormData(prev => ({ ...prev, management_recommendation: Number(e.target.value) }));
                        calculateFinalIncrement();
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Final Increment %</label>
                    <input
                      type="number"
                      value={formData.final_increment_percentage || 0}
                      readOnly
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                    />
                  </div>
                </div>
              </div>

              {/* PIP Details (if PIP selected) */}
              {formData.decision === 'PIP' && (
                <div className="mb-6">
                  <h3 className="font-semibold text-gray-900 mb-3">PIP Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Duration (months)</label>
                      <input
                        type="number"
                        value={formData.pip_duration || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, pip_duration: Number(e.target.value) }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Next Due Date</label>
                      <input
                        type="date"
                        value={formData.pip_due_date || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, pip_due_date: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">PIP Reason</label>
                      <textarea
                        value={formData.pip_reason || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, pip_reason: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        rows={3}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Salary Structure */}
              <div className="mb-6">
                <h3 className="font-semibold text-gray-900 mb-3">Salary Structure</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Previous CTC</label>
                    <input
                      type="number"
                      value={formData.previous_ctc || 0}
                      readOnly
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">New CTC</label>
                    <input
                      type="number"
                      value={formData.new_ctc || 0}
                      onChange={(e) => {
                        setFormData(prev => ({ ...prev, new_ctc: Number(e.target.value) }));
                        generateSalaryStructure();
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={generateSalaryStructure}
                      className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 mt-6"
                    >
                      Generate Structure
                    </button>
                  </div>
                </div>

                {Object.keys(formData.salary_structure || {}).length > 0 && (
                  <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                    {Object.entries(formData.salary_structure || {}).map(([key, value]) => (
                      <div key={key} className="bg-gray-50 p-3 rounded">
                        <div className="text-xs text-gray-600">{key}</div>
                        <div className="font-semibold">{formatCurrency(value)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Form Actions */}
              <div className="flex justify-end gap-4">
                <button
                  onClick={() => {
                    setShowForm(false);
                    setEditingRevision(null);
                    setSelectedEmployee(null);
                  }}
                  className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={saveRevision}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Save size={16} className="inline mr-2" />
                  Save Revision
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
