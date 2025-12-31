import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Home from "./pages/Home";
import HRDashboard from "./pages/HRDashboard";
import OutsiderDashboard from "./pages/OutsiderDashboard";
import CandidateApplicationPage from "./Candidate/page";
import SalaryRevision from "./pages/SalaryRevision";
import ProtectedRoute from './components/ProtectedRoute';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/home" element={<Home />} />

      {/* Employee dashboards (same UI) */}
      <Route path="/hr-dashboard" element={<HRDashboard />} />

      {/* Outsider */}
      <Route path="/outsider-dashboard" element={<OutsiderDashboard />} />
      <Route path="/candidate-application" element={<CandidateApplicationPage />} />
      <Route path="/salary-revision" element={<ProtectedRoute><SalaryRevision /></ProtectedRoute>} />
      
      {/* Safety */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}
