'use client';

import { Link } from 'react-router-dom';
import CandidateApplicationForm from './Candidate/page';

export default function OutsiderDashboard() {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-lime-600 shadow-lg">
        <div className="container mx-auto px-6 py-5 flex justify-between items-center">
          <a href="/" className="text-white text-3xl font-bold">Brisk Olive</a>
          <Link to="/" className="text-white text-lg hover:underline">← Back to Home</Link>
        </div>
      </nav>

      <main className="container mx-auto px-6 pt-12 pb-20">
        <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-16">
          <h1 className="text-4xl font-bold text-center text-lime-600 mb-12">
            Candidate Application Form
          </h1>
          <CandidateApplicationForm />
        </div>
      </main>
    </div>
  );
}