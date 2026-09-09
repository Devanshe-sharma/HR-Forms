import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

const API_BASE = process.env.REACT_APP_REACT_APP_API_BASE_URL || 'http://localhost:5000/api';

type RequiredDoc = { key: string; label: string };
type UploadedDoc = { docType: string; fileName: string; driveLink: string; uploadedAt: string };

type Context = {
  full_name: string;
  designation: string;
  joiningDate: string | null;
  requiredDocuments: RequiredDoc[];
  uploadedDocuments: UploadedDoc[];
};

export default function CandidateDocumentUpload() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const sig = searchParams.get('sig') || '';

  const [context, setContext] = useState<Context | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Files staged per doc key across every section — nothing is uploaded,
  // and no candidate folder is created, until the single Submit button
  // below is clicked.
  const [pendingFiles, setPendingFiles] = useState<Record<string, File[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState(false);

  const loadContext = () => {
    if (!id || !sig) { setError('This link is invalid.'); setLoading(false); return; }
    fetch(`${API_BASE}/applicant-records/${id}/document-upload-context?sig=${encodeURIComponent(sig)}`)
      .then((r) => r.json())
      .then((res) => {
        if (!res.success) { setError(res.message || 'This link could not be verified.'); setLoading(false); return; }
        setContext(res.data);
        setLoading(false);
      })
      .catch(() => { setError('Something went wrong loading this page.'); setLoading(false); });
  };

  useEffect(loadContext, [id, sig]);

  const uploadedFor = (docType: string) =>
    (context?.uploadedDocuments || []).filter((d) => d.docType === docType);

  const handleFileChange = (key: string, fileList: FileList | null) => {
    setPendingFiles((prev) => ({ ...prev, [key]: fileList ? Array.from(fileList) : [] }));
  };

  const totalStaged = Object.values(pendingFiles).reduce((sum, files) => sum + files.length, 0);

  const handleSubmit = async () => {
    if (totalStaged === 0) return;

    setSubmitting(true);
    setError('');
    setJustSubmitted(false);
    try {
      const formData = new FormData();
      for (const [key, files] of Object.entries(pendingFiles)) {
        files.forEach((f) => formData.append(key, f));
      }

      const res = await fetch(`${API_BASE}/applicant-records/${id}/upload-documents?sig=${encodeURIComponent(sig)}`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || 'Failed to upload — please try again.');
        return;
      }
      setPendingFiles({});
      setJustSubmitted(true);
      loadContext();
    } catch {
      setError('Failed to upload — please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading…</div>;
  }

  if (error && !context) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-center px-4">
        <p className="text-gray-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <nav className="bg-slate-800 shadow-xl">
        <div className="container mx-auto px-6 py-6">
          <h1 className="text-white text-2xl sm:text-3xl font-bold">Document Upload</h1>
        </div>
      </nav>

      <div className="container mx-auto px-6 py-10 max-w-2xl">
        <div className="bg-white rounded-xl shadow p-6 mb-6 space-y-1.5">
          <p className="text-sm text-gray-500">Candidate</p>
          <p className="text-xl font-bold text-slate-800">{context?.full_name}</p>
          <p className="text-sm text-gray-600">{context?.designation}</p>
          {context?.joiningDate && (
            <p className="text-sm text-gray-600">
              <span className="font-semibold text-gray-500">Joining Date:</span>{' '}
              {new Date(context.joiningDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          )}
          <p className="text-sm text-gray-500 pt-2">
            Select each document below, then submit them all together. You can come back and submit more anytime before your joining day.
          </p>
        </div>

        {justSubmitted && !error && (
          <p className="text-sm text-lime-700 bg-lime-50 border border-lime-200 rounded-lg px-4 py-2 mb-4">
            Documents submitted successfully.
          </p>
        )}
        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

        <div className="space-y-4">
          {context?.requiredDocuments.map((doc) => {
            const uploaded = uploadedFor(doc.key);
            const staged = pendingFiles[doc.key] || [];
            return (
              <div key={doc.key} className="bg-white rounded-xl shadow p-5">
                <p className="text-sm font-semibold text-gray-700 mb-2">{doc.label}</p>

                {uploaded.length > 0 && (
                  <ul className="mb-3 space-y-1">
                    {uploaded.map((u, i) => (
                      <li key={i} className="text-xs">
                        <a href={u.driveLink} target="_blank" rel="noreferrer" className="text-lime-700 underline">
                          ✓ {u.fileName}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}

                <input
                  type="file"
                  multiple
                  onChange={(e) => handleFileChange(doc.key, e.target.files)}
                  className="text-xs w-full"
                />
                {staged.length > 0 && (
                  <p className="text-xs text-slate-500 mt-1">
                    {staged.length} file{staged.length === 1 ? '' : 's'} selected — not submitted yet
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <div className="sticky bottom-0 mt-6 pt-4 pb-6 bg-gradient-to-t from-white via-white to-transparent">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={totalStaged === 0 || submitting}
            className="w-full bg-slate-800 hover:bg-slate-900 disabled:opacity-40 text-white font-semibold py-3 rounded-lg transition"
          >
            {submitting
              ? 'Submitting…'
              : totalStaged > 0
                ? `Submit ${totalStaged} Document${totalStaged === 1 ? '' : 's'}`
                : 'Select documents to submit'}
          </button>
        </div>
      </div>
    </div>
  );
}
