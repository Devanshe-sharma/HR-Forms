'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import flatpickr from 'flatpickr';
import 'flatpickr/dist/flatpickr.min.css';
import { Plus, Edit, Trash2, Globe, UserCheck } from 'lucide-react';

// --- TYPES ---
type Employee = {
  name: string;
  dept: string;
  desig: string;
  email: string;
};

type Training = {
  _id?: string;
  topic: string;
  description: string;
  trainingDate?: string | Date;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Scheduled' | 'Archived';
  priority: 'P1' | 'P2' | 'P3';
  remark?: string;
  trainer: {
    name: string;
    isExternal: boolean;
    department?: string;
    designation?: string;
    source?: string;
    organisation?: string;
    mobile?: string;
    email?: string;
  };
};

export default function TrainingPage() {
  const [searchParams] = useSearchParams();
  const currentTab = searchParams.get('tab') || 'hr';

  // Data States
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [trainingList, setTrainingList] = useState<Training[]>([]);
  
  // UI Toggle States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [trainerType, setTrainerType] = useState<'internal' | 'external'>('internal');

  // Form State
  const [formData, setFormData] = useState({
    topic: '',
    description: '',
    priority: 'P3',
    internalTrainer: '',
    dept: '',
    desig: '',
    source: '',
    extName: '',
    org: '',
    mobile: '',
    email: ''
  });

  const API_BASE = process.env.NODE_ENV === 'development' ? 'http://localhost:5000/api' : '/api';

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [tRes, eRes] = await Promise.all([
          axios.get(`${API_BASE}/training`),
          axios.get(`${API_BASE}/employees?lightweight=true`)
        ]);
        setTrainingList(tRes.data.data || []);
        setEmployees(eRes.data.data || []);
      } catch (err) {
        console.error("Data load failed", err);
      }
    };
    fetchData();
  }, []);

  // --- FORM HANDLERS ---
  const handleInternalSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const emp = employees.find(emp => emp.name === e.target.value);
    setFormData({
      ...formData,
      internalTrainer: e.target.value,
      dept: emp?.dept || '',
      desig: emp?.desig || ''
    });
  };

  const submitProposal = async (e: React.FormEvent) => {
  e.preventDefault();

  const trainerName = trainerType === 'internal' ? formData.internalTrainer : formData.extName;
  
  if (!trainerName) return alert("Trainer Name is required");

  const payload = {
    topic: formData.topic,
    description: formData.description,
    trainingDate: new Date(), // Sending current date as a valid Date object
    proposedByRole: 'HR',
    proposedByName: 'HR Admin',
    status: 'Under Review',
    priority: formData.priority,
    trainer: {
      name: trainerName,
      isExternal: trainerType === 'external',
      department: trainerType === 'internal' ? formData.dept : undefined,
      designation: trainerType === 'internal' ? formData.desig : undefined,
      externalOrg: trainerType === 'external' ? formData.org : undefined,
      externalContact: trainerType === 'external' ? (formData.mobile || formData.email) : undefined
    }
  };

  try {
    const res = await axios.post(`${API_BASE}/training`, payload);
    if (res.data.success) {
      alert("Proposal Submitted Successfully!");
      setIsFormOpen(false);
      refreshData(); // Refresh table
    }
  } catch (err: any) {
    console.error("Submission failed:", err.response?.data || err.message);
    alert("Error: " + (err.response?.data?.error || "Server could not process request"));
  }
};

  return (
    <div className="flex min-h-screen bg-[#f4f6f2]">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Navbar />
        
        <main className="p-8 pt-20 max-w-7xl mx-auto w-full">
          {currentTab === 'hr' && (
            <div className="space-y-8">
              
              {/* --- 1. HR FORM SECTION --- */}
              <section className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div 
                  className="p-6 border-b flex justify-between items-center cursor-pointer hover:bg-gray-50 transition"
                  onClick={() => setIsFormOpen(!isFormOpen)}
                >
                  <div className="flex items-center gap-3">
                    <div className="bg-[#7a8b2e] p-2 rounded-lg text-white">
                      <Plus size={20} />
                    </div>
                    <h3 className="font-bold text-gray-800 text-lg">Create New Training Proposal</h3>
                  </div>
                  <span className="text-gray-400 text-sm font-bold">{isFormOpen ? 'Collapse' : 'Expand Form'}</span>
                </div>

                {isFormOpen && (
                  <form onSubmit={submitProposal} className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-top-4 duration-300">
                    <div className="md:col-span-2">
                      <label className="hr-label">Training Topic *</label>
                      <input required className="hr-input" placeholder="e.g. Behavioral Skills Workshop" 
                        onChange={e => setFormData({...formData, topic: e.target.value})} />
                    </div>
                    <div className="md:col-span-2">
                      <label className="hr-label">Topic Description *</label>
                      <textarea required className="hr-input h-24" placeholder="Mention key learning objectives..."
                        onChange={e => setFormData({...formData, description: e.target.value})} />
                    </div>
                    
                    <div>
                      <label className="hr-label">Priority</label>
                      <select className="hr-input" onChange={e => setFormData({...formData, priority: e.target.value})}>
                        <option value="P3">P3 (Medium)</option>
                        <option value="P2">P2 (High)</option>
                        <option value="P1">P1 (Urgent)</option>
                      </select>
                    </div>

                    {/* --- TRAINER TOGGLE --- */}
                    <div className="md:col-span-2 bg-gray-50 p-6 rounded-xl border border-gray-100">
                      <div className="flex gap-6 mb-6">
                        <button type="button" onClick={() => setTrainerType('internal')} 
                          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs transition ${trainerType === 'internal' ? 'bg-[#7a8b2e] text-white' : 'bg-white text-gray-400'}`}>
                          <UserCheck size={14}/> Internal Trainer
                        </button>
                        <button type="button" onClick={() => setTrainerType('external')} 
                          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs transition ${trainerType === 'external' ? 'bg-[#7a8b2e] text-white' : 'bg-white text-gray-400'}`}>
                          <Globe size={14}/> External Consultant
                        </button>
                      </div>

                      {trainerType === 'internal' ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="hr-label text-[10px]">Trainer Name (Employee DB)</label>
                            <select className="hr-input" onChange={handleInternalSelect}>
                              <option value="">Select Employee</option>
                              {employees.map(e => <option key={e.email} value={e.name}>{e.name}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="hr-label text-[10px]">Department</label>
                            <input className="hr-input bg-gray-100 cursor-not-allowed" value={formData.dept} readOnly />
                          </div>
                          <div>
                            <label className="hr-label text-[10px]">Designation</label>
                            <input className="hr-input bg-gray-100 cursor-not-allowed" value={formData.desig} readOnly />
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <input className="hr-input" placeholder="Source (e.g. LinkedIn)" onChange={e => setFormData({...formData, source: e.target.value})} />
                          <input className="hr-input" placeholder="Trainer Name" onChange={e => setFormData({...formData, extName: e.target.value})} />
                          <input className="hr-input" placeholder="Organisation" onChange={e => setFormData({...formData, org: e.target.value})} />
                          <div className="flex gap-2">
                            <input className="hr-input" placeholder="Mobile" onChange={e => setFormData({...formData, mobile: e.target.value})} />
                            <input className="hr-input" placeholder="Email" onChange={e => setFormData({...formData, email: e.target.value})} />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="md:col-span-2 flex justify-end gap-4">
                      <button type="button" onClick={() => setIsFormOpen(false)} className="px-6 py-2 text-gray-400 font-bold">Discard</button>
                      <button type="submit" className="bg-[#7a8b2e] text-white px-10 py-2 rounded-xl font-bold shadow-lg shadow-green-100 hover:bg-[#4f5a22] transition">Submit for Management Approval</button>
                    </div>
                  </form>
                )}
              </section>

              {/* --- 2. HR TABLE SECTION --- */}
              <section className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-6 bg-gray-50 border-b">
                  <h3 className="font-bold text-gray-700 uppercase text-xs tracking-widest">Training Inventory Control Panel</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-white text-[10px] font-black text-gray-400 uppercase tracking-tighter border-b">
                      <tr>
                        <th className="p-4">Sno.</th>
                        <th className="p-4">Training Topic</th>
                        <th className="p-4">Description</th>
                        <th className="p-4">Trainer Name</th>
                        <th className="p-4">Status</th>
                        <th className="p-4">Date</th>
                        <th className="p-4">Priority</th>
                        <th className="p-4 text-center">Remark</th>
                        <th className="p-4 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs divide-y divide-gray-100">
                      {trainingList.map((t, i) => (
                        <tr key={t._id} className="hover:bg-gray-50/50 transition group">
                          <td className="p-4 text-gray-400">{i + 1}</td>
                          <td className="p-4 font-bold text-gray-800">{t.topic}</td>
                          <td className="p-4 text-gray-500 max-w-[150px] truncate">{t.description}</td>
                          <td className="p-4 font-medium text-blue-600 underline decoration-blue-100">{t.trainer.name}</td>
                          <td className="p-4">
                            <span className={`status-pill ${t.status.toLowerCase()}`}>{t.status}</span>
                          </td>
                          <td className="p-4 text-gray-600 font-mono italic">{t.trainingDate ? new Date(t.trainingDate).toLocaleDateString() : 'TBD'}</td>
                          <td className="p-4">
                            <span className={`priority-text ${t.priority.toLowerCase()}`}>{t.priority}</span>
                          </td>
                          <td className="p-4 text-center text-gray-400 italic font-medium">{t.remark || '--'}</td>
                          <td className="p-4 text-center">
                            <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition">
                              <button className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg"><Edit size={14}/></button>
                              <button className="p-2 hover:bg-red-50 text-red-600 rounded-lg"><Trash2 size={14}/></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}

          {/* Other Tabs handled here */}
          {currentTab !== 'hr' && <div className="text-gray-400 italic">Content for {currentTab} view</div>}
        </main>
      </div>

      <style>{`
        .hr-label { font-size: 11px; font-weight: 800; color: #9ca3af; text-transform: uppercase; margin-bottom: 6px; display: block; }
        .hr-input { width: 100%; border: 2px solid #f3f4f6; border-radius: 0.75rem; padding: 0.6rem 1rem; outline: none; transition: all 0.2s; font-size: 13px; font-weight: 600; }
        .hr-input:focus { border-color: #7a8b2e; background-color: #fff; }
        
        .status-pill { padding: 3px 10px; border-radius: 6px; font-size: 9px; font-weight: 900; text-transform: uppercase; }
        .status-pill.pending { background: #fef3c7; color: #92400e; }
        .status-pill.scheduled { background: #dbeafe; color: #1e40af; }
        .status-pill.approved { background: #dcfce7; color: #166534; }
        
        .priority-text { font-weight: 900; }
        .priority-text.p1 { color: #ef4444; }
        .priority-text.p2 { color: #f97316; }
        .priority-text.p3 { color: #7a8b2e; }
      `}</style>
    </div>
  );
}

function refreshData() {
  throw new Error('Function not implemented.');
}
