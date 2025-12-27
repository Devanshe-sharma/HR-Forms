'use client';

import { Link } from "react-router-dom";

export default function OutsiderDashboard() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-lime-50 to-white">
      {/* Navbar */}
      <nav className="bg-lime-600 shadow-xl">
        <div className="container mx-auto px-6 py-6 flex justify-between items-center">
          <h1 className="text-white text-4xl font-bold">Brisk Olive HR Portal</h1>
          <Link to="/" className="text-white text-lg hover:underline flex items-center gap-2">
            ← Back to Home
          </Link>
        </div>
      </nav>

      {/* Welcome Content */}
      <main className="container mx-auto px-6 pt-20 pb-40 text-center">
        <h2 className="text-5xl font-bold text-lime-800 mb-8">
          Welcome to Outsider Dashboard
        </h2>
        <p className="text-2xl text-gray-700 mb-12 max-w-3xl mx-auto">
          Thank you for your interest in joining Brisk Olive.<br />
          Please click the button below to open the candidate application form.
        </p>

        {/* Big Button to Open Form */}
        <Link
          to="/candidate-application"
          className="inline-block px-16 py-8 bg-lime-600 text-white text-3xl font-bold rounded-2xl hover:bg-lime-700 transition shadow-2xl transform hover:scale-105"
        >
          Open Candidate Application Form →
        </Link>
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 text-white text-center py-8">
        <p className="text-lg">© 2025 Brisk Olive. All rights reserved.</p>
      </footer>
    </div>
  );
}