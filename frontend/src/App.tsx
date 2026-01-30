import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import HRDashboard from "./pages/HRDashboard";
import OutsiderDashboard from "./pages/OutsiderDashboard";
import CandidateApplicationPage from "./Candidate/page";
import SalaryRevision from "./pages/SalaryRevision";
import ProtectedRoute from './components/ProtectedRoute';
import Recruitment from "./pages/RequisitionDashboard";
import CTCComponentsDashboard from "./components/CTCComponentsDashboard";
import LetterTemplate from "./pages/LetterTemplate";
import ComingSoon from "./pages/ComingSoon";
import AllApplicants from "./pages/AllApplicants";
import NewRequisitionForm from "./pages/new-requisition-form";
import TrainingPage from "./pages/TrainingPage";
import Requisition from "./pages/Requisition";
import Onboarding from "./pages/Onboarding";
import Exit from "./pages/Exit";


export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />

      {/* Employee dashboards */}
      <Route
        path="/hr-dashboard"
        element={
          <ProtectedRoute>
            <HRDashboard />
          </ProtectedRoute>
        }
      />

      {/* Outsider */}
      <Route path="/outsider-dashboard" element={<OutsiderDashboard />} />
      <Route path="/candidate-application" element={<CandidateApplicationPage />} />

      {/* Protected core routes */}
      <Route
        path="/salary-revision"
        element={
          <ProtectedRoute>
            <SalaryRevision />
          </ProtectedRoute>
        }
      />

      <Route
        path="/recruitment"
        element={
          <ProtectedRoute>
            <Recruitment />
          </ProtectedRoute>
        }
      />

      <Route
        path="/ctc-components"
        element={
          <ProtectedRoute>
            <CTCComponentsDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/letter"
        element={
          <ProtectedRoute>
            <LetterTemplate />
          </ProtectedRoute>
        }
      />

      <Route
        path="/employees"
        element={
          <ProtectedRoute>
            <ComingSoon />
          </ProtectedRoute>
        }
      />

      <Route
        path="/candidates"
        element={
          <ProtectedRoute>
            <ComingSoon />
          </ProtectedRoute>
        }
      />

      <Route
        path="/applicants"
        element={
          <ProtectedRoute>
            <AllApplicants />
          </ProtectedRoute>
        }
      />

      <Route
        path="/new-hiring-requisition"
        element={
          <ProtectedRoute>
            <NewRequisitionForm />
          </ProtectedRoute>
        }
      />

      <Route
        path="/training-page"
        element={
          <ProtectedRoute>
            <TrainingPage />
          </ProtectedRoute>
        }
      />

      {/* ✅ Catch-all ALWAYS LAST */}
      <Route
        path="*"
        element={
          <ProtectedRoute>
            <ComingSoon />
          </ProtectedRoute>
        }
      />
       <Route
        path="/requisition"
        element={
          <ProtectedRoute>
            <Requisition />
          </ProtectedRoute>
        }
      />
      <Route
        path="/onboarding"
        element={
          <ProtectedRoute>
            <Onboarding />
          </ProtectedRoute>
        }
      />
      <Route
        path="/exit"
        element={
          <ProtectedRoute>
            <Exit />
          </ProtectedRoute>
        }
      />

    </Routes>
  );
}
