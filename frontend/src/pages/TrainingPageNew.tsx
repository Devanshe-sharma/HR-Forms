import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getRole, trainingTabVisibility } from '../config/rbac';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import CapabilityManagement from '../components/training/CapabilityManagement';
import TrainingTopicManagement from '../components/training/TrainingTopicManagement';
import TrainingApproval from '../components/training/TrainingApproval';
import FinalTrainingScheduling from '../components/training/FinalTrainingScheduling';

type TrainingTab = 'capability' | 'topics' | 'approval' | 'scheduling';

export default function TrainingPageImpl() {
  const location = useLocation();
  const navigate = useNavigate();
  const search = new URLSearchParams(location.search);
  const tabParam = (search.get('tab') || 'capability') as TrainingTab;
  const activeTab = tabParam;

  useEffect(() => {
    const vis = trainingTabVisibility();
    const allowed = (t: string) => vis[t as keyof typeof vis];
    if (activeTab && !allowed(activeTab)) {
      const first = (['capability', 'topics', 'approval', 'scheduling'] as const).find(t => allowed(t));
      if (first) navigate(`/training-page?tab=${first}`, { replace: true });
    }
  }, [activeTab, navigate]);

  const tabs = [
    { 
      id: 'capability' as TrainingTab, 
      label: 'Capability Management', 
      description: 'Manage capability areas and skills',
      icon: '🎯'
    },
    { 
      id: 'topics' as TrainingTab, 
      label: 'Training Topics', 
      description: 'Create training proposals',
      icon: '📚'
    },
    { 
      id: 'approval' as TrainingTab, 
      label: 'Training Approval', 
      description: 'Review and approve proposals',
      icon: '✅'
    },
    { 
      id: 'scheduling' as TrainingTab, 
      label: 'Final Scheduling', 
      description: 'Schedule approved trainings',
      icon: '📅'
    },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'capability':
        return <CapabilityManagement />;
      case 'topics':
        return <TrainingTopicManagement />;
      case 'approval':
        return <TrainingApproval />;
      case 'scheduling':
        return <FinalTrainingScheduling />;
      default:
        return <CapabilityManagement />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <div className="lg:pl-64">
        <Navbar />
        <main className="p-6">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mt-20">Training Management System</h1>
            <p className="text-gray-600">Complete training workflow from capability assessment to final scheduling</p>
          </div>
          {/* Workflow Summary */}
          <div className="mt-8 mb-10 bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-4">🔥 Training Workflow Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="bg-white rounded-lg p-4 border border-blue-200">
                  <div className="text-2xl mb-2">1️⃣</div>
                  <h4 className="font-medium text-blue-900 mb-1">Capability</h4>
                  <p className="text-sm text-blue-700">Create capability areas and skills</p>
                </div>
              </div>
              <div className="text-center">
                <div className="bg-white rounded-lg p-4 border border-blue-200">
                  <div className="text-2xl mb-2">2️⃣</div>
                  <h4 className="font-medium text-blue-900 mb-1">Topics</h4>
                  <p className="text-sm text-blue-700">Create training proposals</p>
                </div>
              </div>
              <div className="text-center">
                <div className="bg-white rounded-lg p-4 border border-blue-200">
                  <div className="text-2xl mb-2">3️⃣</div>
                  <h4 className="font-medium text-blue-900 mb-1">Approval</h4>
                  <p className="text-sm text-blue-700">Management review & approval</p>
                </div>
              </div>
              <div className="text-center">
                <div className="bg-white rounded-lg p-4 border border-blue-200">
                  <div className="text-2xl mb-2">4️⃣</div>
                  <h4 className="font-medium text-blue-900 mb-1">Scheduling</h4>
                  <p className="text-sm text-blue-700">Final training scheduling</p>
                </div>
              </div>
            </div>
            <div className="mt-4 text-sm text-blue-700">
              <p>💡 <strong>Flow:</strong> HR creates Capability → Manager does Assessment → Skill Gap Identified → HR creates Training Topic → Management Approves → HR Schedules Final Training → Training Delivered → Attendance + Assessment + Feedback</p>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="mb-8">
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-8">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => navigate(`/training-page?tab=${tab.id}`)}
                    className={`group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <span className="mr-2 text-lg">{tab.icon}</span>
                    <div className="text-left">
                      <div>{tab.label}</div>
                      <div className="text-xs text-gray-400">{tab.description}</div>
                    </div>
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Tab Content */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            {renderTabContent()}
          </div>

          
        </main>
      </div>
    </div>
  );
}
