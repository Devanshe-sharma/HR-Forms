import { Link } from "react-router-dom";

export default function Home() {
  const role = localStorage.getItem("role") || "";

  const allowedRoles = [
    "HR Department",
    "Management",
    "DAA Department",
    "Employees and outsiders"
  ];

  if (!allowedRoles.includes(role)) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-red-50 to-white flex items-center justify-center">
        <div className="text-center p-12 bg-white rounded-2xl shadow-2xl">
          <h2 className="text-5xl font-bold text-red-600 mb-6">Access Denied</h2>
          <p className="text-xl text-gray-700 mb-8">You are not authorized to access this portal.</p>
          <Link to="/" className="px-10 py-4 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition">
            Back to Login
          </Link>
        </div>
      </div>
    );
  }

  const isHR = ["HR Department", "Management", "DAA Department"].includes(role);

  return (
    <div className="min-h-screen bg-gradient-to-b from-lime-50 to-white flex items-center justify-center">
      <div className="text-center p-12 max-w-4xl">
        <h1 className="text-6xl font-bold text-lime-700 mb-8">
          Welcome to Brisk Olive HR Portal
        </h1>
        <p className="text-2xl text-gray-700 mb-12">
          You are logged in as: <span className="font-bold text-lime-800">{role}</span>
        </p>

        <div className="space-y-10">
          {isHR && (
            <Link
              to="/hr-dashboard"
              className="block px-16 py-8 bg-lime-600 text-white text-3xl font-bold rounded-2xl hover:bg-lime-700 transition shadow-2xl transform hover:scale-105"
            >
              Open HR Dashboard →
            </Link>
          )}

          {role === "Employees and outsiders" && (
            <Link
              to="/outsider-dashboard"
              className="block px-16 py-8 bg-blue-600 text-white text-3xl font-bold rounded-2xl hover:bg-blue-700 transition shadow-2xl transform hover:scale-105"
            >
              Dashboard
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}