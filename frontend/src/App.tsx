import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Home from "./pages/Home";
import HRDashboard from "./pages/HRDashboard";
import PrivateRoute from "./components/PrivateRoute";
import OutsiderDashboard from "./pages/OutsiderDashboard";


export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route
          path="/home"
          element={
            <PrivateRoute>
              <Home />
            </PrivateRoute>
          }
        />
        <Route
          path="/hr-dashboard"
          element={
            <PrivateRoute>
              <HRDashboard />
            </PrivateRoute>
          }
        />
        <Route
          path="/outsider-dashboard"
          element={
            <PrivateRoute>
              <OutsiderDashboard />
              
            </PrivateRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
