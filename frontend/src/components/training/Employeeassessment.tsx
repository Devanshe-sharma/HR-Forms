import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import {
  Upload, FileText, Video, FileCheck,
  Link as LinkIcon, X, Eye, ChevronRight,
  CheckCircle, Clock, AlertCircle,
} from 'lucide-react';
import { getRole, can } from '../../config/rbac';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:5000/api';
const api = axios.create({ baseURL: API_BASE });
api.interceptors.request.use((config) => {
  const role = getRole();
  if (role) config.headers['x-user-role'] = role;
  return config;
});

// ─── Types ────────────────────────────────────────────────────────────────────

interface CompletedTraining {
  _id: string;
  trainingId: string;
  trainingName: string;
  capabilityArea: string;
  capabilitySkill: string;
  trainerName: string;
  trainingDate: string;
  contentPdfLink?: string;
  videoLink?: string;
  assessmentLink?: string;
  maxAttempts: number;
}

interface AssessmentRecord {
  _id: string;
  trainingId: string;
  trainingName: string;
  employeeName: string;
  employeeId: string;
  score: number;
  maxScore: number;
  attemptNumber: number;
  submittedAt: string;
  status: 'Pass' | 'Fail';
}

type ContentMode = 'link' | 'upload';

interface ContentState {
  pdfMode:    ContentMode;
  pdfLink:    string;
  pdfFile:    File | null;
  videoMode:  ContentMode;
  videoLink:  string;
  videoFile:  File | null;
  assessMode: ContentMode;
  assessLink: string;
  assessFile: File | null;
}

// Dummy MCQ questions for the assessment form
const DUMMY_QUESTIONS = [
  {
    id: 1,
    question: 'What is the primary objective of this training?',
    options: [
      'To improve technical skills',
      'To understand the topic deeply',
      'To meet compliance requirements',
      'All of the above',
    ],
  },
  {
    id: 2,
    question: 'Which of the following best describes what you learned?',
    options: [
      'New concepts and frameworks',
      'Hands-on practical skills',
      'Industry best practices',
      'All of the above',
    ],
  },
  {
    id: 3,
    question: 'How confident are you in applying this knowledge?',
    options: [
      'Very confident',
      'Somewhat confident',
      'Need more practice',
      'Not confident yet',
    ],
  },
  {
    id: 4,
    question: 'Which area needs further improvement after this training?',
    options: [
      'Theoretical understanding',
      'Practical application',
      'Communication of concepts',
      'None — fully covered',
    ],
  },
  {
    id: 5,
    question: 'Would you recommend this training to colleagues?',
    options: [
      'Definitely yes',
      'Probably yes',
      'Not sure',
      'No',
    ],
  },
];

// ─── Small helpers ────────────────────────────────────────────────────────────

function ModeToggle({ mode, onChange }: { mode: ContentMode; onChange: (m: ContentMode) => void }) {
  return (
    <div className="flex rounded-md overflow-hidden border border-gray-300 text-xs">
      <button type="button" onClick={() => onChange('link')}
        className={`flex items-center gap-1 px-2.5 py-1.5 transition-colors ${mode === 'link' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
        <LinkIcon className="w-3 h-3" /> Link
      </button>
      <button type="button" onClick={() => onChange('upload')}
        className={`flex items-center gap-1 px-2.5 py-1.5 border-l border-gray-300 transition-colors ${mode === 'upload' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
        <Upload className="w-3 h-3" /> Upload
      </button>
    </div>
  );
}

interface FileInputProps {
  mode: ContentMode;
  linkVal: string;
  fileVal: File | null;
  accept: string;
  placeholder: string;
  onModeChange: (m: ContentMode) => void;
  onLinkChange: (v: string) => void;
  onFileChange: (f: File | null) => void;
}

function FileInput({ mode, linkVal, fileVal, accept, placeholder, onModeChange, onLinkChange, onFileChange }: FileInputProps) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-1.5">
      <ModeToggle mode={mode} onChange={onModeChange} />
      {mode === 'link' ? (
        <input type="url" value={linkVal} onChange={e => onLinkChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-3 py-2 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
      ) : (
        <>
          <input ref={ref} type="file" accept={accept} className="hidden"
            onChange={e => onFileChange(e.target.files?.[0] ?? null)} />
          {fileVal ? (
            <div className="flex items-center justify-between px-2 py-1.5 bg-blue-50 border border-blue-200 rounded-md">
              <span className="text-xs text-blue-700 truncate max-w-[160px]">{fileVal.name}</span>
              <button type="button" onClick={() => { onFileChange(null); if (ref.current) ref.current.value = ''; }}
                className="text-blue-400 hover:text-blue-600 ml-1"><X className="w-3.5 h-3.5" /></button>
            </div>
          ) : (
            <button type="button" onClick={() => ref.current?.click()}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 border-2 border-dashed border-gray-300 rounded-md text-xs text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors">
              <Upload className="w-3.5 h-3.5" /> Choose file
            </button>
          )}
        </>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function EmployeeAssessment() {
  const [trainings, setTrainings]         = useState<CompletedTraining[]>([]);
  const [assessments, setAssessments]     = useState<AssessmentRecord[]>([]);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState('');

  // Which training is selected to take the assessment
  const [selectedTraining, setSelectedTraining] = useState<CompletedTraining | null>(null);

  // View: 'list' | 'upload' | 'take' | 'results'
  const [view, setView] = useState<'list' | 'upload' | 'take' | 'results'>('list');

  // Content upload state (for trainer)
  const [content, setContent] = useState<ContentState>({
    pdfMode: 'link', pdfLink: '', pdfFile: null,
    videoMode: 'link', videoLink: '', videoFile: null,
    assessMode: 'link', assessLink: '', assessFile: null,
  });
  const [uploadLoading, setUploadLoading] = useState(false);

  // Assessment form answers (questionId → selectedOption index)
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);

  const isTrainer = can('training', 'update'); // trainer role can upload content

  const loadTrainings = async () => {
    setLoading(true);
    try {
      const res = await api.get('/training-schedules?status=Completed');
      setTrainings(res.data?.data || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load trainings');
    } finally {
      setLoading(false);
    }
  };

  const loadAssessments = async () => {
    try {
      const res = await api.get('/training-assessments');
      setAssessments(res.data?.data || []);
    } catch (err: any) {
      console.error('Failed to load assessments:', err);
    }
  };

  useEffect(() => { loadTrainings(); loadAssessments(); }, []);

  // Pre-fill content state when a training is selected for upload
  const openUpload = (t: CompletedTraining) => {
    setSelectedTraining(t);
    setContent({
      pdfMode: 'link',   pdfLink: t.contentPdfLink  || '', pdfFile: null,
      videoMode: 'link', videoLink: t.videoLink      || '', videoFile: null,
      assessMode: 'link',assessLink: t.assessmentLink || '', assessFile: null,
    });
    setView('upload');
    setError('');
  };

  const openAssessment = (t: CompletedTraining) => {
    setSelectedTraining(t);
    setAnswers({});
    setSubmitted(false);
    setScore(0);
    setView('take');
    setError('');
  };

  // ── Upload file helper ──────────────────────────────────────────────────────
  const uploadFile = async (file: File, fieldName: string): Promise<string> => {
    const fd = new FormData();
    fd.append(fieldName, file);
    const res = await api.post('/uploads/training-content', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data?.url || '';
  };

  // ── Save uploaded content ───────────────────────────────────────────────────
  const saveContent = async () => {
    if (!selectedTraining) return;
    setUploadLoading(true);
    try {
      const contentPdfLink = content.pdfMode === 'upload' && content.pdfFile
        ? await uploadFile(content.pdfFile, 'contentPdf') : content.pdfLink.trim();
      const videoLink = content.videoMode === 'upload' && content.videoFile
        ? await uploadFile(content.videoFile, 'video') : content.videoLink.trim();
      const assessmentLink = content.assessMode === 'upload' && content.assessFile
        ? await uploadFile(content.assessFile, 'assessment') : content.assessLink.trim();

      await api.patch(`/training-schedules/${selectedTraining._id}`, {
        contentPdfLink, videoLink, assessmentLink,
      });
      await loadTrainings();
      setView('list');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save content');
    } finally {
      setUploadLoading(false);
    }
  };

  // ── Submit assessment ───────────────────────────────────────────────────────
  const submitAssessment = async () => {
    // Correct answer = index 3 ("All of the above" / best answer) for dummy questions
    // In real app this would come from backend question data
    const correct = DUMMY_QUESTIONS.filter(q => answers[q.id] === 3).length;
    const total   = DUMMY_QUESTIONS.length;
    const pct     = Math.round((correct / total) * 100);
    const pass    = pct >= 60;

    setScore(pct);
    setSubmitted(true);

    try {
      await api.post('/training-assessments', {
        trainingId:    selectedTraining?.trainingId,
        trainingName:  selectedTraining?.trainingName,
        score:         correct,
        maxScore:      total,
        attemptNumber: 1,
        status:        pass ? 'Pass' : 'Fail',
      });
      await loadAssessments();
    } catch (err: any) {
      console.error('Failed to save assessment:', err);
    }
  };

  const contentUploaded = (t: CompletedTraining) =>
    !!(t.contentPdfLink || t.videoLink || t.assessmentLink);

  const myAssessment = (trainingId: string) =>
    assessments.find(a => a.trainingId === trainingId);

  // ── Views ───────────────────────────────────────────────────────────────────

  // ── VIEW: Upload content (trainer only) ────────────────────────────────────
  if (view === 'upload' && selectedTraining) {
    return (
      <div className="p-6 max-w-2xl">
        <button onClick={() => setView('list')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
          ← Back
        </button>
        <h2 className="text-xl text-gray-700 mb-1">Upload Training Content</h2>
        <p className="text-gray-400 text-sm mb-6">{selectedTraining.trainingName}</p>

        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">{error}</div>}

        <div className="space-y-4">
          {/* PDF */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3 text-sm font-medium text-gray-700">
              <FileText className="w-4 h-4 text-red-400" /> Content PDF
            </div>
            <FileInput
              mode={content.pdfMode} linkVal={content.pdfLink} fileVal={content.pdfFile}
              accept=".pdf,.doc,.docx,.ppt,.pptx" placeholder="https://example.com/content.pdf"
              onModeChange={m => setContent(p => ({ ...p, pdfMode: m }))}
              onLinkChange={v => setContent(p => ({ ...p, pdfLink: v }))}
              onFileChange={f => setContent(p => ({ ...p, pdfFile: f }))}
            />
          </div>

          {/* Video */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3 text-sm font-medium text-gray-700">
              <Video className="w-4 h-4 text-purple-400" /> Training Video
            </div>
            <FileInput
              mode={content.videoMode} linkVal={content.videoLink} fileVal={content.videoFile}
              accept="video/*,.mp4,.mov" placeholder="https://youtube.com/watch?v=..."
              onModeChange={m => setContent(p => ({ ...p, videoMode: m }))}
              onLinkChange={v => setContent(p => ({ ...p, videoLink: v }))}
              onFileChange={f => setContent(p => ({ ...p, videoFile: f }))}
            />
          </div>

          {/* Assessment */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3 text-sm font-medium text-gray-700">
              <FileCheck className="w-4 h-4 text-green-400" /> Assessment / Quiz Link
            </div>
            <FileInput
              mode={content.assessMode} linkVal={content.assessLink} fileVal={content.assessFile}
              accept=".pdf,.xlsx,.csv" placeholder="https://forms.google.com/..."
              onModeChange={m => setContent(p => ({ ...p, assessMode: m }))}
              onLinkChange={v => setContent(p => ({ ...p, assessLink: v }))}
              onFileChange={f => setContent(p => ({ ...p, assessFile: f }))}
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={() => setView('list')}
            className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200">
            Cancel
          </button>
          <button onClick={saveContent} disabled={uploadLoading}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
            <Upload className="w-4 h-4" />
            {uploadLoading ? 'Saving...' : 'Save Content'}
          </button>
        </div>
      </div>
    );
  }

  // ── VIEW: Take assessment (employee) ───────────────────────────────────────
  if (view === 'take' && selectedTraining) {
    return (
      <div className="p-6 max-w-2xl">
        <button onClick={() => setView('list')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
          ← Back
        </button>

        {submitted ? (
          /* Result screen */
          <div className="text-center py-8">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl font-bold
              ${score >= 60 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
              {score}%
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-1">
              {score >= 60 ? '🎉 Passed!' : '❌ Not Passed'}
            </h3>
            <p className="text-gray-500 text-sm mb-6">
              You scored {score}% ({score >= 60 ? 'Pass' : 'Fail'}) on {selectedTraining.trainingName}
            </p>
            <button onClick={() => setView('list')}
              className="px-5 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm">
              Back to Trainings
            </button>
          </div>
        ) : (
          /* Question form */
          <>
            <h2 className="text-xl text-gray-700 mb-1">Assessment</h2>
            <p className="text-gray-400 text-sm mb-2">{selectedTraining.trainingName}</p>

            {/* Study material links */}
            {(selectedTraining.contentPdfLink || selectedTraining.videoLink) && (
              <div className="mb-5 p-3 bg-blue-50 border border-blue-100 rounded-lg flex flex-wrap gap-4">
                <span className="text-xs font-medium text-blue-700">Study material:</span>
                {selectedTraining.contentPdfLink && (
                  <a href={selectedTraining.contentPdfLink} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800">
                    <FileText className="w-3.5 h-3.5" /> Content PDF
                  </a>
                )}
                {selectedTraining.videoLink && (
                  <a href={selectedTraining.videoLink} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800">
                    <Video className="w-3.5 h-3.5" /> Video
                  </a>
                )}
              </div>
            )}

            <div className="space-y-5">
              {DUMMY_QUESTIONS.map((q, qi) => (
                <div key={q.id} className="border border-gray-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-gray-800 mb-3">
                    {qi + 1}. {q.question}
                  </p>
                  <div className="space-y-2">
                    {q.options.map((opt, oi) => (
                      <label key={oi}
                        className={`flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer border transition-colors
                          ${answers[q.id] === oi
                            ? 'border-blue-400 bg-blue-50'
                            : 'border-gray-200 hover:bg-gray-50'}`}>
                        <input type="radio" name={`q${q.id}`}
                          checked={answers[q.id] === oi}
                          onChange={() => setAnswers(p => ({ ...p, [q.id]: oi }))}
                          className="text-blue-600" />
                        <span className="text-sm text-gray-700">{opt}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex items-center justify-between">
              <p className="text-xs text-gray-400">
                {Object.keys(answers).length} / {DUMMY_QUESTIONS.length} answered
              </p>
              <button
                onClick={submitAssessment}
                disabled={Object.keys(answers).length < DUMMY_QUESTIONS.length}
                className="flex items-center gap-2 px-5 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-40 text-sm">
                <CheckCircle className="w-4 h-4" /> Submit Assessment
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  // ── VIEW: Training list ────────────────────────────────────────────────────
  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-xl text-gray-700 mb-1">Employee Assessment</h2>
        <p className="text-gray-400 text-sm">
          {isTrainer
            ? 'Upload training content · Employees can then take the assessment below'
            : 'Complete assessments for your attended trainings'}
        </p>
      </div>

      {error && <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">{error}</div>}

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : trainings.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-5xl mb-3">📝</div>
          <p className="font-medium">No completed trainings yet</p>
          <p className="text-sm mt-1">Assessments will appear here once trainings are marked complete.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {trainings.map(t => {
            const uploaded  = contentUploaded(t);
            const myResult  = myAssessment(t.trainingId);

            return (
              <div key={t._id} className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-3 hover:shadow-sm transition-shadow">
                {/* Title */}
                <div>
                  <h3 className="font-semibold text-gray-800 text-sm leading-snug">{t.trainingName}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">{t.capabilitySkill}</p>
                </div>

                {/* Meta */}
                <div className="flex flex-wrap gap-2">
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">{t.trainerName}</span>
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                    {new Date(t.trainingDate).toLocaleDateString()}
                  </span>
                </div>

                {/* Content status indicators */}
                <div className="flex gap-3 text-xs">
                  <span className={`flex items-center gap-1 ${t.contentPdfLink ? 'text-green-600' : 'text-gray-300'}`}>
                    <FileText className="w-3.5 h-3.5" /> PDF
                  </span>
                  <span className={`flex items-center gap-1 ${t.videoLink ? 'text-green-600' : 'text-gray-300'}`}>
                    <Video className="w-3.5 h-3.5" /> Video
                  </span>
                  <span className={`flex items-center gap-1 ${t.assessmentLink ? 'text-green-600' : 'text-gray-300'}`}>
                    <FileCheck className="w-3.5 h-3.5" /> Assessment
                  </span>
                </div>

                {/* Assessment result badge */}
                {myResult && (
                  <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full w-fit
                    ${myResult.status === 'Pass' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {myResult.status === 'Pass'
                      ? <CheckCircle className="w-3.5 h-3.5" />
                      : <AlertCircle className="w-3.5 h-3.5" />}
                    {myResult.status} — {myResult.score}/{myResult.maxScore}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 mt-auto pt-1">
                  {/* Trainer: upload content */}
                  {isTrainer && (
                    <button onClick={() => openUpload(t)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-blue-300 text-blue-600 rounded-md hover:bg-blue-50 transition-colors">
                      <Upload className="w-3.5 h-3.5" />
                      {uploaded ? 'Update Content' : 'Upload Content'}
                    </button>
                  )}

                  {/* Employee: take assessment (only if content uploaded & not already passed) */}
                  {!isTrainer && uploaded && (!myResult || myResult.status === 'Fail') && (
                    <button onClick={() => openAssessment(t)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors">
                      <ChevronRight className="w-3.5 h-3.5" />
                      {myResult ? `Retry (Attempt ${myResult.attemptNumber + 1})` : 'Take Assessment'}
                    </button>
                  )}

                  {/* Not uploaded yet */}
                  {!isTrainer && !uploaded && (
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <Clock className="w-3.5 h-3.5" /> Awaiting content upload
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}