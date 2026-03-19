'use client';

import React from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import CapabilityManagement from '../components/training/CapabilityManagement';
import TrainingTopicManagement from '../components/training/TrainingTopicManagement';
import TrainingApproval from '../components/training/TrainingApproval';
import FinalTrainingScheduling from '../components/training/FinalTrainingScheduling';
import ManagerEvaluation from '../components/training/Managerevaluation';
import SkillGapReport from '../components/training/Skillgapreport';
import EmployeeAssessment from '../components/training/Employeeassessment';
import EmployeeFeedback from '../components/training/Employeefeedback';
import TrainingDelivery from '../components/training/Trainingdelivery';
import TrainingScorecard from '../components/training/Trainingscorecard';

// ─── Types ────────────────────────────────────────────────────────────────────

type MainTab = 'HR' | 'manager' | 'skillgap' | 'management' | 'employee' | 'delivery' | 'scorecard';
type HRSubTab = 'capability' | 'topics' | 'scheduling';
type EmployeeSubTab = 'assessment' | 'feedback';

// ─── Component ────────────────────────────────────────────────────────────────

export default function TrainingPageImpl() {
  const location = useLocation();
  const params   = new URLSearchParams(location.search);

  const mainTab = (params.get('tab')    || 'HR')          as MainTab;
  const hrSub   = (params.get('hrSub')  || 'capability')  as HRSubTab;
  const empSub  = (params.get('empSub') || 'assessment')  as EmployeeSubTab;

  // ── Navbar height breakdown ──────────────────────────────────────────────
  //  Blue AppBar (title only)   :  56px  — always
  //  White main tab row         :  40px  — always on /training-page
  //  White sub-tab row          :  40px  — only for HR and employee tabs
  //
  //  All tabs except HR/employee  →  56 + 40        =  96px
  //  HR / employee                →  56 + 40 + 40   = 136px
  // ────────────────────────────────────────────────────────────────────────
  const hasSubTabs = mainTab === 'HR' || mainTab === 'employee';
  const topMargin  = hasSubTabs ? 'mt-[136px]' : 'mt-[96px]';

  const renderContent = () => {
    switch (mainTab) {

      // ── HR: Capability → Topics → Scheduling ──────────────────────────
      case 'HR':
        return (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            {hrSub === 'capability'  && <CapabilityManagement />}
            {hrSub === 'topics'      && <TrainingTopicManagement />}
            {hrSub === 'scheduling'  && <FinalTrainingScheduling />}
          </div>
        );

      // ── Manager Evaluation ────────────────────────────────────────────
      case 'manager':
        return (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <ManagerEvaluation />
          </div>
        );

      // ── Skill Gap Report ──────────────────────────────────────────────
      case 'skillgap':
        return (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <SkillGapReport />
          </div>
        );

      // ── Management Approval ───────────────────────────────────────────
      case 'management':
        return (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <TrainingApproval />
          </div>
        );

      // ── Employee: Assessment → Feedback ───────────────────────────────
      case 'employee':
        return (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            {empSub === 'assessment' && <EmployeeAssessment />}
            {empSub === 'feedback'   && <EmployeeFeedback />}
          </div>
        );

      // ── Training Delivery ─────────────────────────────────────────────
      case 'delivery':
        return (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <TrainingDelivery />
          </div>
        );

      // ── Scorecard ─────────────────────────────────────────────────────
      case 'scorecard':
        return (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <TrainingScorecard />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Navbar />
        <main className={`p-4 ${topMargin}`}>
          {renderContent()}
        </main>
      </div>
    </div>
  );
}