'use client';

import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';

export default function HRDashboard() {
  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Navbar */}
        <Navbar />

        {/* Blank Dashboard Content */}
        <main className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <h1 className="text-5xl font-bold text-gray-800 mb-8">
              Welcome to HR Dashboard
            </h1>
            <p className="text-2xl text-gray-600 mb-12">
              Select an option from the sidebar to get started
            </p>
            {/* <div className="bg-gray-200 border-2 border-dashed rounded-xl w-96 h-96 mx-auto" /> */}
          </div>
        </main>
      </div>
    </div>
  );
}


 