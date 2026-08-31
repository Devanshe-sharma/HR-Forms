import React, { useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { Users, Share2 } from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';

import CandidatesTab from './AllApplicants';
import ReferralsTab from './ReferralsList';

type PageTab = 'candidates' | 'referrals';

const TABS: { id: PageTab; label: string; icon: typeof Users }[] = [
  { id: 'candidates', label: 'Candidates', icon: Users },
  { id: 'referrals',  label: 'Referrals',  icon: Share2 },
];

// Reached from two sidebar links ("Candidate Management" → /applicants,
// "Referrals" → /referrals) plus an optional ?tab= override, so the
// starting tab is derived from whichever of those got the user here.
const CandidatesReferrals: React.FC = () => {
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const initialTab: PageTab =
    (searchParams.get('tab') as PageTab) ||
    (location.pathname.startsWith('/referrals') ? 'referrals' : 'candidates');

  const [activeTab, setActiveTab] = useState<PageTab>(initialTab);

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      <div className="w-64 flex-shrink-0 z-10 bg-white border-r">
        <Sidebar />
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-16 bg-white shadow-sm z-20 flex items-center px-4">
          <Navbar />
        </div>

        <div className="bg-white border-b px-6">
          <div className="flex gap-1">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-1.5 px-4 py-3 text-sm font-semibold border-b-2 transition -mb-px ${
                  activeTab === id
                    ? 'border-lime-500 text-lime-700'
                    : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                <Icon size={15} />
                {label}
              </button>
            ))}
          </div>
        </div>

        <main className="flex-1 overflow-auto p-6">
          {activeTab === 'candidates' ? <CandidatesTab /> : <ReferralsTab />}
        </main>
      </div>
    </div>
  );
};

export default CandidatesReferrals;
