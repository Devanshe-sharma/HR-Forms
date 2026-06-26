'use client';

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const API_BASE = process.env.REACT_APP_REACT_APP_API_BASE_URL || 'http://localhost:5000/api';

// ── Types ─────────────────────────────────────────────────────────────────────
type OpenJob = {
  _id: string;
  serial_no: number;
  designation: string;
  hiring_dept: string;
  candidate_experience_level?: string | null;
  role_link?: string;
  jd_link?: string;
  createdAt: string;
};

export default function CareersPage() {
  const [jobs, setJobs]       = useState<OpenJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');

  useEffect(() => {
    fetch(`${API_BASE}/hiringrequisitions/open`)
      .then((r) => r.json())
      .then((res) => {
        setJobs(Array.isArray(res?.data) ? res.data : []);
        setLoading(false);
      })
      .catch(() => {
        setJobs([]);
        setLoading(false);
      });
  }, []);

  const filtered = jobs.filter((j) => {
    const q = search.toLowerCase();
    return !q ||
      j.designation.toLowerCase().includes(q) ||
      j.hiring_dept.toLowerCase().includes(q);
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-lime-50 to-white">

      {/* Navbar */}
      <nav className="bg-lime-600 shadow-xl">
        <div className="container mx-auto px-6 py-6 flex justify-between items-center">
          <h1 className="text-white text-3xl sm:text-4xl font-bold">Brisk Olive Careers</h1>
        </div>
      </nav>

      {/* Hero */}
      <header className="container mx-auto px-6 pt-16 pb-10 text-center">
        <h2 className="text-4xl sm:text-5xl font-bold text-lime-800 mb-4">
          Join the Brisk Olive Team
        </h2>
        <p className="text-xl text-gray-700 max-w-2xl mx-auto">
          We're always looking for great people. Browse our open positions below and apply directly.
        </p>
      </header>

      {/* Search */}
      <div className="container mx-auto px-6 max-w-2xl mb-10">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by role or department…"
          className="w-full px-5 py-3 rounded-xl border border-gray-300 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-lime-400 focus:border-lime-500 text-base"
        />
      </div>

      {/* Job list */}
      <main className="container mx-auto px-6 pb-24 max-w-4xl">

        {loading && (
          <div className="grid gap-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 bg-white border border-gray-200 rounded-2xl animate-pulse" />
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-20">
            <p className="text-2xl text-gray-500 font-semibold">No open positions right now</p>
            <p className="text-gray-400 mt-2">Check back soon — new roles are added regularly.</p>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="grid gap-5">
            {filtered.map((job) => (
              <Link
                key={job._id}
                to={`/candidate-application?job_id=${job.serial_no}&designation=${encodeURIComponent(job.designation)}`}
                className="block bg-white border border-gray-200 hover:border-lime-400 rounded-2xl p-6 shadow-sm hover:shadow-lg transition group"
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <p className="text-xs font-bold text-lime-600 mb-1">JOB ID: REQ-{job.serial_no}</p>
                    <h3 className="text-2xl font-bold text-gray-800 group-hover:text-lime-700 transition">
                      {job.designation}
                    </h3>
                    <p className="text-gray-500 mt-1">{job.hiring_dept}</p>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    {job.candidate_experience_level && (
                      <span className="px-3 py-1 rounded-full bg-lime-100 text-lime-700 text-xs font-semibold">
                        {job.candidate_experience_level}
                      </span>
                    )}
                    <span className="px-5 py-2 bg-lime-600 group-hover:bg-lime-700 text-white text-sm font-bold rounded-lg transition">
                      Apply Now →
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 text-white text-center py-5">
        <p className="text-lg">© 2026 Brisk Olive. All rights reserved.</p>
      </footer>
    </div>
  );
}