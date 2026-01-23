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

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />

      {/* Employee dashboards */}
      <Route path="/hr-dashboard" element={
        <ProtectedRoute>
          <HRDashboard />
        </ProtectedRoute>
      } />

      {/* Outsider */}
      <Route path="/outsider-dashboard" element={<OutsiderDashboard />} />
      <Route path="/candidate-application" element={<CandidateApplicationPage />} />

      {/* Protected routes */}
      <Route path="/salary-revision" element={
        <ProtectedRoute>
          <SalaryRevision />
        </ProtectedRoute>
      } />
      <Route path="/recruitment" element={
        <ProtectedRoute>
          <Recruitment />
        </ProtectedRoute>
      } />

      <Route path="/ctc-components" element={
        <ProtectedRoute>
          <CTCComponentsDashboard />
        </ProtectedRoute>
      } />

      <Route path="/letter" element={
        <ProtectedRoute>
          <LetterTemplate />
        </ProtectedRoute>
      } />

      {/* Placeholder protected routes for pages under development */}
      <Route path="/employees" element={
        <ProtectedRoute>
          <ComingSoon />
        </ProtectedRoute>
      } />
      <Route path="/candidates" element={
        <ProtectedRoute>
          <ComingSoon />
        </ProtectedRoute>
      } />

      <Route path="/applicants" element={<AllApplicants />} />

      {/* Catch-all: Show ComingSoon if logged in, else redirect to login */}
      <Route path="*" element={
        <ProtectedRoute>
          <ComingSoon />
        </ProtectedRoute>
      } />
      <Route 
        path="/new-hiring-requisition" 
        element={
          <ProtectedRoute>
            <NewRequisitionForm />
          </ProtectedRoute>
        } 
      />
    </Routes>
  );
}
