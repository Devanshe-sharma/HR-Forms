import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { CheckCircle, Clock, Share2, Users } from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';

import CandidatesTab from './AllApplicants';
import ReferralsTab from './ReferralsList';
import { OfferJoiningTab } from './OfferJoiningPage';
import { TimelineHistoryDashboardTab } from './TimelineHistoryPage';
import { usePageVisibility } from '../../contexts/PageVisibilityContext';

type PageTab = 'candidates' | 'referrals' | 'offerJoining' | 'timelineHistory';

const TABS: { id: PageTab; label: string; icon: typeof Users; pageKey: string }[] = [
  { id: 'candidates',      label: 'Candidates',         icon: Users,       pageKey: 'recruitment.candidates' },
  { id: 'referrals',       label: 'Referrals',          icon: Share2,      pageKey: 'recruitment.referrals' },
  { id: 'offerJoining',    label: 'Offer & Joining',    icon: CheckCircle, pageKey: 'recruitment.offerJoining' },
  { id: 'timelineHistory', label: 'Timeline & History', icon: Clock,       pageKey: 'recruitment.timelineHistory' },
];

// Reached from two sidebar links ("Candidate Management" → /applicants,
// "Referrals" → /referrals) plus an optional ?tab= override, so the
// starting tab is derived from whichever of those got the user here.
function getInitialTab(pathname: string, tabParam: string | null): PageTab {
  if (tabParam === 'referrals' || tabParam === 'offerJoining' || tabParam === 'timelineHistory') return tabParam;
  if (pathname.startsWith('/referrals')) return 'referrals';
  if (pathname.startsWith('/offer-joining')) return 'offerJoining';
  if (pathname.startsWith('/timeline-history')) return 'timelineHistory';
  return 'candidates';
}

const CandidatesReferrals: React.FC = () => {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { canViewKey } = usePageVisibility();

  const visibleTabs = useMemo(
    () => TABS.filter((tab) => canViewKey(tab.pageKey)),
    [canViewKey]
  );

  const [activeTab, setActiveTab] = useState<PageTab>(() => getInitialTab(location.pathname, searchParams.get('tab')));

  useEffect(() => {
    setActiveTab(getInitialTab(location.pathname, searchParams.get('tab')));
  }, [location.pathname, searchParams]);

  useEffect(() => {
    if (visibleTabs.length && !visibleTabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(visibleTabs[0].id);
    }
  }, [activeTab, visibleTabs]);

  const handleTabChange = (tab: PageTab) => {
    setActiveTab(tab);
    setSearchParams(tab === 'candidates' ? {} : { tab });
  };

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
            {visibleTabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => handleTabChange(id)}
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
          {activeTab === 'candidates' && <CandidatesTab />}
          {activeTab === 'referrals' && <ReferralsTab />}
          {activeTab === 'offerJoining' && <OfferJoiningTab />}
          {activeTab === 'timelineHistory' && <TimelineHistoryDashboardTab />}
        </main>
      </div>
    </div>
  );
};

export default CandidatesReferrals;
