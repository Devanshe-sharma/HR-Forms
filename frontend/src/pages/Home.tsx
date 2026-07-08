import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";

export default function Home() {
  const navigate = useNavigate();

  // Matches the same check ProtectedRoute uses now — a real jwtToken set
  // by Login.tsx after a successful backend login. Previously this
  // checked different keys (role/token) and redirected externally to
  // operations.briskolive.com, which is what caused the endless loop —
  // that domain can never see this domain's localStorage, so it looked
  // "logged in" there but never here.
  const token = localStorage.getItem("jwtToken");
  const name = localStorage.getItem("name") || "";
  const designation = localStorage.getItem("designation") || "";

  useEffect(() => {
    if (!token) {
      navigate("/login", { replace: true });
    }
  }, [token, navigate]);

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-lime-50 to-white">
        <p className="text-gray-500 text-sm">Redirecting to login…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-lime-50 to-white flex items-center justify-center">
      <div className="text-center p-12 max-w-4xl">
        <h1 className="text-6xl font-bold text-lime-700 mb-8">
          Welcome to Brisk Olive HR Portal
        </h1>
        <p className="text-xl text-gray-700 mb-12">
          You are logged in as: <span className="font-bold text-lime-800">{name}{designation ? ` (${designation})` : ""}</span>
        </p>

        <div className="space-y-10">
          <Link
            to="/hr-dashboard"
            className="block px-16 py-8 bg-lime-600 text-white text-3xl font-bold rounded-2xl hover:bg-lime-700 transition shadow-2xl transform hover:scale-105"
          >
            Open HR Dashboard →
          </Link>

          <Link
            to="/outsider-dashboard"
            className="block px-16 py-8 bg-blue-600 text-white text-3xl font-bold rounded-2xl hover:bg-blue-700 transition shadow-2xl transform hover:scale-105"
          >
            Outsider Dashboard →
          </Link>
        </div>
      </div>
    </div>
  );
}