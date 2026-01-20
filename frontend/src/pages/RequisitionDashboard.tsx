import React, { useState, useEffect } from 'react';
import { Plus, Search, FileText, User, Briefcase, ChevronRight, Clock } from 'lucide-react';
import { Link } from 'react-router-dom'; // Assuming you use react-router
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';

interface Requisition {
  id: string;
  serial_no: string;
  job_title: string;
  department: string;
  requisitioner: string;
  request_date: string;
  target_joining: string;
  status: 'Pending' | 'Approved' | 'In Progress' | 'Fulfilled' | 'Cancelled';
}

const RequisitionDashboard: React.FC = () => {
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Fetching data from your Django API
  useEffect(() => {
    fetch('https://hr-forms.onrender.com/api/hiring-requisitions/')
      .then(res => res.json())
      .then(data => setRequisitions(data))
      .catch(err => console.error("Error loading requisitions:", err));
  }, []);

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'Approved': return 'bg-blue-100 text-blue-700';
      case 'In Progress': return 'bg-amber-100 text-amber-700';
      case 'Fulfilled': return 'bg-green-100 text-green-700';
      case 'Cancelled': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const filteredData = requisitions.filter(req => 
    req.job_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    req.requisitioner.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <Navbar />

        <main className="flex-1 overflow-auto p-8">
          {/* HEADER SECTION */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Hiring Requisitions</h1>
              <p className="text-gray-500">Track and manage internal department hiring requests</p>
            </div>

            {/* ACTION BUTTON IN CORNER */}
            <Link 
              to="/new-hiring-requisition" 
              className="flex items-center gap-2 bg-lime-400 hover:bg-lime-500 text-black font-bold py-2.5 px-5 rounded-lg shadow-sm transition-all active:scale-95"
            >
              <Plus size={20} />
              Start New Hiring
            </Link>
          </div>

          {/* QUICK STATS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
              <div className="p-3 bg-amber-50 text-amber-600 rounded-lg"><Clock size={24}/></div>
              <div>
                <p className="text-sm text-gray-500">Active Requests</p>
                <p className="text-xl font-bold">{requisitions.filter(r => r.status !== 'Fulfilled').length}</p>
              </div>
            </div>
            {/* Add more stat cards as needed */}
          </div>

          {/* SEARCH & TABLE */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center gap-3">
              <Search className="text-gray-400" size={20} />
              <input 
                type="text" 
                placeholder="Search by role or requisitioner..."
                className="flex-1 outline-none text-sm"
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                    <th className="px-6 py-4 font-semibold">Serial & Role</th>
                    <th className="px-6 py-4 font-semibold">Department</th>
                    <th className="px-6 py-4 font-semibold">Requested By</th>
                    <th className="px-6 py-4 font-semibold">Timeline</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                    <th className="px-6 py-4 font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredData.map((req) => (
                    <tr key={req.id} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-gray-400">{req.serial_no}</span>
                          <span className="font-bold text-gray-800">{req.job_title}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-600 flex items-center gap-2">
                          <Briefcase size={14} className="text-gray-400" /> {req.department}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-600 flex items-center gap-2">
                          <User size={14} className="text-gray-400" /> {req.requisitioner}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col text-xs">
                          <span className="text-gray-400">Target Joining:</span>
                          <span className="font-semibold text-gray-700">{req.target_joining}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase ${getStatusStyle(req.status)}`}>
                          {req.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all">
                          <ChevronRight size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {filteredData.length === 0 && (
              <div className="py-20 text-center">
                <FileText size={48} className="mx-auto text-gray-200 mb-4" />
                <p className="text-gray-400 italic">No requisitions found matching your search.</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default RequisitionDashboard;