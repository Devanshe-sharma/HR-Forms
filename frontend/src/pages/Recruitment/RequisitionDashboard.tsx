'use client';

import React, { useState, useEffect } from 'react';
import {
  Plus, Search, FileText, User,
  ChevronRight, Clock, Building2, Calendar,
  Filter, Download, RefreshCcw
} from 'lucide-react';
import { Link } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';

const API_BASE = process.env.REACT_APP_REACT_APP_API_BASE_URL || 'http://localhost:5000/api';

// Matches the real HiringRequisition Mongoose schema
interface Requisition {
  _id: string;
  serial_no: number;
  requisitioner_name: string;
  hiring_dept: string;
  designation: string;
  request_date: string;
  planned_joined: string;
  hiring_status: string;
  fmsStatus: 'Open' | 'Closed';
}

const RequisitionDashboard: React.FC = () => {
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRequisitions = async () => {
    setIsRefreshing(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/hiringrequisitions`);
      if (!res.ok) throw new Error('Failed to load requisitions');
      const data = await res.json();
      setRequisitions(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error loading requisitions:', err);
      setError('Could not load requisitions. Check your connection and try again.');
      setRequisitions([]);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchRequisitions();
  }, []);

  const getStatusStyle = (status: string) => {
    const s = status?.toLowerCase() || '';
    if (s.includes('joined') || s.includes('fulfilled') || s.includes('filled')) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (s.includes('started') || s.includes('progress')) return 'bg-blue-100 text-blue-700 border-blue-200';
    if (s.includes('new')) return 'bg-purple-100 text-purple-700 border-purple-200';
    if (s.includes('stopped') || s.includes('cancel') || s.includes('hold')) return 'bg-rose-100 text-rose-700 border-rose-200';
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  const filteredData = requisitions.filter(req =>
    req.designation?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    req.requisitioner_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    req.hiring_dept?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#F8FAFC]">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Navbar />

        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          <div className="max-w-7xl pt-10 mx-auto">

            {/* TOP HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
              <div>
                <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Hiring Pipeline</h1>
                <p className="text-slate-500 mt-1">Manage and track departmental recruitment requisitions</p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={fetchRequisitions}
                  className={`p-2.5 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-all ${isRefreshing ? 'animate-spin' : ''}`}
                >
                  <RefreshCcw size={20} />
                </button>
                <Link
                  to="/new-hiring-requisition"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-5 rounded-xl shadow-indigo-200 shadow-lg transition-all active:scale-95"
                >
                  <Plus size={20} />
                  New Requisition
                </Link>
              </div>
            </div>

            {error && (
              <div className="mb-6 px-4 py-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm">
                {error}
              </div>
            )}

            {/* STATS OVERVIEW */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <StatCard title="Total Requests" value={requisitions.length} icon={<FileText />} color="text-indigo-600" bg="bg-indigo-50" />
              <StatCard title="Active Hiring" value={requisitions.filter(r => r.fmsStatus === 'Open').length} icon={<Clock />} color="text-amber-600" bg="bg-amber-50" />
              <StatCard title="Closed / Filled" value={requisitions.filter(r => r.fmsStatus === 'Closed').length} icon={<User />} color="text-emerald-600" bg="bg-emerald-50" />
              <StatCard title="Departments" value={new Set(requisitions.map(r => r.hiring_dept)).size} icon={<Building2 />} color="text-rose-600" bg="bg-rose-50" />
            </div>

            {/* TABLE CONTAINER */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-5 border-b border-slate-100 bg-white flex flex-col sm:flex-row items-center gap-4">
                <div className="relative flex-1 w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    placeholder="Search by role, department or name..."
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <button className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50">
                    <Filter size={16} /> Filter
                  </button>
                  <button className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50">
                    <Download size={16} /> Export
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50/50 text-slate-500 text-[11px] uppercase tracking-widest font-bold">
                      <th className="px-6 py-4">Requisition Info</th>
                      <th className="px-6 py-4">Department</th>
                      <th className="px-6 py-4">Requester</th>
                      <th className="px-6 py-4">Hiring Plan</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      <TableSkeleton />
                    ) : filteredData.map((req) => (
                      <tr key={req._id} className="hover:bg-indigo-50/30 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-indigo-500 mb-0.5">
                              REQ-{req.serial_no}
                            </span>
                            <span className="font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">
                              {req.designation}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-slate-600">
                            <div className="p-1.5 bg-slate-100 rounded-md text-slate-500">
                              <Building2 size={14} />
                            </div>
                            <span className="text-sm font-medium">{req.hiring_dept}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white text-[10px] font-bold">
                              {req.requisitioner_name?.substring(0, 2).toUpperCase()}
                            </div>
                            <span className="text-sm text-slate-700 font-medium">{req.requisitioner_name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1.5 text-xs text-slate-500">
                              <Calendar size={12} /> Target: {req.planned_joined || '—'}
                            </div>
                            <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className={`h-full ${req.fmsStatus === 'Open' ? 'bg-indigo-500' : 'bg-emerald-500'} w-2/3`}></div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-lg text-[10px] font-bold border ${getStatusStyle(req.hiring_status)}`}>
                            {req.hiring_status?.toUpperCase() || 'NEW'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Link
                            to={`/requisition/${req._id}`}
                            className="inline-flex items-center justify-center w-9 h-9 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                          >
                            <ChevronRight size={20} />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {!loading && filteredData.length === 0 && (
                <div className="py-24 text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-50 rounded-2xl text-slate-300 mb-4">
                    <FileText size={32} />
                  </div>
                  <h3 className="text-slate-900 font-bold">No results found</h3>
                  <p className="text-slate-500 text-sm mt-1">
                    {requisitions.length === 0
                      ? 'No requisitions have been submitted yet.'
                      : "Try adjusting your search to find what you're looking for."}
                  </p>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, icon, color, bg }: any) => (
  <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between transition-transform hover:-translate-y-1">
    <div>
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <p className="text-2xl font-black text-slate-900 mt-1">{value}</p>
    </div>
    <div className={`p-3 ${bg} ${color} rounded-2xl`}>
      {React.cloneElement(icon, { size: 24 })}
    </div>
  </div>
);

const TableSkeleton = () => (
  <>
    {[1, 2, 3, 4, 5].map((i) => (
      <tr key={i} className="animate-pulse">
        <td className="px-6 py-6"><div className="h-4 bg-slate-100 rounded w-32"></div></td>
        <td className="px-6 py-6"><div className="h-4 bg-slate-100 rounded w-24"></div></td>
        <td className="px-6 py-6"><div className="h-4 bg-slate-100 rounded w-28"></div></td>
        <td className="px-6 py-6"><div className="h-4 bg-slate-100 rounded w-20"></div></td>
        <td className="px-6 py-6"><div className="h-4 bg-slate-100 rounded w-16"></div></td>
        <td className="px-6 py-6"><div className="h-8 w-8 bg-slate-100 rounded-full ml-auto"></div></td>
      </tr>
    ))}
  </>
);

export default RequisitionDashboard;