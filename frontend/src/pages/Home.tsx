import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-lime-50 to-white flex items-center justify-center">
      <div className="text-center p-12 max-w-4xl">
        <h1 className="text-6xl font-bold text-lime-700 mb-8">
          Welcome to Brisk Olive HR Portal
        </h1>

        <div className="space-y-10">
          <Link
            to="/company-orientation"
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