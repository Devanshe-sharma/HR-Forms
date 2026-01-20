import React, { useState, useEffect } from 'react';
import { ExternalLink, Video, Mail, Phone, Loader2, CheckCircle2 } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast'; // New import
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';

type StatusType = 

  | 'Applied' | 'Shortlisted' | 'Rejected' | '1st' | '2nd' | '3rd' 

  | 'Final Interview Round' | 'Selected' | 'Offer Letter Sent' 

  | 'Offer Letter Accepted' | 'Offer Letter Accepted But Not Joined' | 'Joined';



interface Candidate {

  id: number;

  full_name: string;

  email: string;

  phone: string;

  current_ctc: string;

  experience: 'Yes' | 'No';

  location: string; 

  linkedin: string;

  short_video_url: string;

  status: StatusType;

}



const STATUS_OPTIONS: StatusType[] = [

  'Applied', 'Shortlisted', 'Rejected', '1st', '2nd', '3rd', 

  'Final Interview Round', 'Selected', 'Offer Letter Sent', 

  'Offer Letter Accepted', 'Offer Letter Accepted But Not Joined', 'Joined'

];

const CandidateTable: React.FC = () => {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null); // Track specific row update

  useEffect(() => {
    fetch('https://hr-forms.onrender.com/api/candidate-applications/')
      .then(res => res.json())
      .then(data => {
        setCandidates(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleStatusChange = async (id: number, newStatus: StatusType) => {
    setUpdatingId(id); // Set local loading for this row
    const original = [...candidates];
    
    // Optimistic UI update
    setCandidates(prev => prev.map(c => c.id === id ? { ...c, status: newStatus } : c));

    try {
      const response = await fetch(`https://hr-forms.onrender.com/api/candidate-applications/${id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) throw new Error();

      // Show Success UI Feedback
      toast.success(`Status updated for ${original.find(c => c.id === id)?.full_name}`, {
        duration: 3000,
        icon: <CheckCircle2 className="text-green-500" size={20} />,
      });

    } catch {
      setCandidates(original);
      toast.error("Failed to sync with database.");
    } finally {
      setUpdatingId(null); // Remove local loading
    }
  };

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* Toast Container */}
      <Toaster position="top-right" />

      <div className="w-64 flex-shrink-0 z-1 bg-white border-r">
        <Sidebar />
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-16 bg-white shadow-sm z-20 flex items-center px-4">
          <Navbar />
        </div>

        <main className="flex-1 overflow-auto p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800">Recruitment Tracker</h1>
            <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm">
              {candidates.length} Applicants
            </span>
          </div>

          {loading ? (
            <div className="flex justify-center mt-20"><Loader2 className="animate-spin text-blue-600" size={40}/></div>
          ) : (
            <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 border-b font-semibold text-gray-600">
                  <tr>
                    <th className="p-4">Name</th>
                    <th className="p-4">Contact</th>
                    <th className="p-4">Current Sal</th>
                    <th className="p-4">Exp</th>
                    <th className="p-4">Location</th>
                    <th className="p-4 text-center">Profiles</th>
                    <th className="p-4">Status Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {candidates.map(candidate => (
                    <tr 
                      key={candidate.id} 
                      className={`transition-colors duration-200 ${updatingId === candidate.id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                    >
                      <td className="p-4 font-bold text-gray-900">{candidate.full_name}</td>
                      <td className="p-4 space-y-1">
                        <div className="flex items-center gap-2 text-gray-600"><Mail size={14}/>{candidate.email}</div>
                        <div className="flex items-center gap-2 text-gray-400 text-xs"><Phone size={14}/>{candidate.phone}</div>
                      </td>
                      <td className="p-4 font-medium">{candidate.current_ctc || 'N/A'}</td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          candidate.experience === 'Yes' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {candidate.experience === 'Yes' ? 'EXP' : 'FRESH'}
                        </span>
                      </td>
                      <td className="p-4 text-gray-500">{candidate.location}</td>
                      <td className="p-4">
                        <div className="flex justify-center gap-3">
                          {candidate.linkedin && <a href={candidate.linkedin} target="_blank" className="text-blue-500 hover:scale-110 transition-transform"><ExternalLink size={16}/></a>}
                          {candidate.short_video_url && <a href={candidate.short_video_url} target="_blank" className="text-red-500 hover:scale-110 transition-transform"><Video size={16}/></a>}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <select 
                            disabled={updatingId === candidate.id}
                            value={candidate.status}
                            onChange={(e) => handleStatusChange(candidate.id, e.target.value as StatusType)}
                            className={`border rounded p-1 text-xs font-semibold bg-white cursor-pointer outline-none transition-all ${
                              updatingId === candidate.id ? 'opacity-50 cursor-not-allowed' : 'hover:border-blue-400'
                            }`}
                          >
                            {STATUS_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                          {updatingId === candidate.id && <Loader2 className="animate-spin text-blue-500" size={16} />}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default CandidateTable;