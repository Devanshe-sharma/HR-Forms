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
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-12 rounded-2xl shadow-2xl text-center">
          <h2 className="text-4xl font-bold text-red-600 mb-6">Access Denied</h2>
          <p className="text-xl text-gray-700 mb-8">Unauthorized access</p>
          <Link
            to="/"
            className="px-8 py-4 bg-lime-600 text-white font-bold rounded-lg hover:bg-lime-700 transition"
          >
            Back to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-lime-50 to-white">
      {/* Navbar */}
      <nav className="bg-lime-600 shadow-xl">
        <div className="container mx-auto px-6 py-6">
          <h1 className="text-white text-4xl font-bold text-center">
            Brisk Olive HR Portal
          </h1>
        </div>
      </nav>

      {/* Welcome Section */}
      <div className="container mx-auto px-6 pt-16 text-center">
        <h2 className="text-5xl font-bold text-lime-800 mb-4">
          Welcome back!
        </h2>
        <p className="text-2xl text-gray-700 mb-12">
          Logged in as: <span className="font-bold text-lime-700">{role}</span>
        </p>

        {/* Dashboard Links */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 max-w-4xl mx-auto">
          {/* Outsider Link */}
          {role === "Employees and outsiders" && (
            <div className="bg-white rounded-3xl shadow-2xl p-12 hover:shadow-3xl transition transform hover:-translate-y-2">
              <h3 className="text-3xl font-bold text-gray-800 mb-6">
                Candidate Application
              </h3>
              <p className="text-xl text-gray-600 mb-10">
                Submit your application to join Brisk Olive team
              </p>
              <Link
                to="/outsider-dashboard"
                className="inline-block px-12 py-6 bg-lime-600 text-white text-2xl font-bold rounded-xl hover:bg-lime-700 transition"
              >
                Open Application Form →
              </Link>
            </div>
          )}

          {/* HR Link */}
          {(role === "HR Department" || role === "Management" || role === "DAA Department") && (
            <div className="bg-white rounded-3xl shadow-2xl p-12 hover:shadow-3xl transition transform hover:-translate-y-2">
              <h3 className="text-3xl font-bold text-gray-800 mb-6">
                HR Dashboard
              </h3>
              <p className="text-xl text-gray-600 mb-10">
                Manage applications, view candidates, and more
              </p>
              <Link
                to="/hr-dashboard"
                className="inline-block px-12 py-6 bg-blue-600 text-white text-2xl font-bold rounded-xl hover:bg-blue-700 transition"
              >
                Go to HR Dashboard →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}