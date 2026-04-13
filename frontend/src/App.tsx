import { Routes, Route } from "react-router-dom";

import Home from "./pages/Home";
import HRDashboard from "./pages/HRDashboard";
import OutsiderDashboard from "./pages/OutsiderDashboard";
import CandidateApplicationPage from "./pages/CandidateApplication";
import EmployeeLetter from "./pages/EmployeeLetter";
import Profile from "./pages/Profile";
import Configuration from "./pages/Configruation";
import ProtectedRoute from "./components/ProtectedRoute";

import Recruitment from "./pages/RequisitionDashboard";
import CTCComponentsDashboard from "./components/CTCComponentsDashboard";
import LetterTemplate from "./pages/LetterTemplate";
import ComingSoon from "./pages/ComingSoon";
import AllApplicants from "./pages/AllApplicants";
import NewRequisitionForm from "./pages/new-requisition-form";
import TrainingPage from "./pages/TrainingPageNew";
import Outing from "./pages/Outing";
import PMSDashboard from "./pages/PMSDashboard";
import Requisition from "./pages/Requisition";
import Onboarding from "./pages/Onboarding";
import NewOnboarding from "./pages/onboarding/NewOnboarding";
import OnboardingDashboard from "./pages/onboarding/Dashboard";
import UpdateOnboarding from "./pages/onboarding/updateonboarding";
import Exit from "./pages/Exit";
import Confirmationspage from "./pages/Confirmationspage";
import DeptOrientationPage from "./pages/Deptorientationpage";
import Companyorientationpage from "./pages/Companyorientationpage";
import EmployeesPage from "./pages/EmployeesPage";
import ArchivedEmployeesPage from "./pages/ArchivedEmployeesPage";
import SalaryRevisionNew from "./pages/SalaryRevisionNew";
import { ThemeProvider } from "./contexts/ThemeContext";

export default function App() {
  return (
    <ThemeProvider>
      <Routes>

        {/* Public Routes */}
        <Route path="/" element={<Home />} />
        <Route path="/outsider-dashboard" element={<OutsiderDashboard />} />
        <Route path="/candidate-application" element={<CandidateApplicationPage />} />

        {/* Protected Routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/hr-dashboard" element={<HRDashboard />} />
          <Route path="/employee-letters" element={<EmployeeLetter />} />
          <Route path="/salary-revision" element={<SalaryRevisionNew />} />
          <Route path="/recruitment" element={<Recruitment />} />
          <Route path="/ctc-components" element={<CTCComponentsDashboard />} />
          <Route path="/letter" element={<LetterTemplate />} />
          <Route path="/employees" element={<EmployeesPage />} />
          <Route path="/employees/archive" element={<ArchivedEmployeesPage />} />
          <Route path="/candidates" element={<ComingSoon />} />
          <Route path="/applicants" element={<AllApplicants />} />
          <Route path="/new-hiring-requisition" element={<NewRequisitionForm />} />
          <Route path="/training-page" element={<TrainingPage />} />
          <Route path="/outing" element={<Outing />} />
          <Route path="/requisition" element={<Requisition />} />
          <Route path="/onboarding" element={<OnboardingDashboard />} />
          <Route path="/onboarding/dashboard" element={<OnboardingDashboard />} />
          <Route path="/new-onboarding" element={<NewOnboarding />} />
          <Route path="/onboarding/update/:id" element={<UpdateOnboarding />} />
          <Route path="/exits" element={<Exit />} />

          <Route path="/company-orientation" element={<Companyorientationpage />} />
          <Route path="/dept-orientation" element={<DeptOrientationPage />} />
          <Route path="/attendance" element={<ComingSoon />} />
          <Route path="/checklist-delegation" element={<ComingSoon />} />
          <Route path="/confirmations" element={<Confirmationspage />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/configuration" element={<Configuration />} />
          <Route path="/salary-sheet" element={<ComingSoon />} />
          <Route path="/pms" element={<PMSDashboard />} />

          {/* Catch-all */}
          <Route path="*" element={<ComingSoon />} />
        </Route>

      </Routes>
    </ThemeProvider>
  );
}