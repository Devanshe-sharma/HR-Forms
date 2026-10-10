// pages/Recruitment/applicantTypes.ts
// ─────────────────────────────────────────────────────────────────────────────
// Shared types + constants used across all 4 stage components
// (CandidateInformationTab, ScreenerRoundTab, InterviewRoundTab,
// OfferPlacementTab) and the main AllApplicants page that orchestrates them.
// ─────────────────────────────────────────────────────────────────────────────

export type StatusType = 'New' | 'Reviewed' | 'Shortlisted' | 'Rejected' | 'Hired';

// The fixed HR -> Technical -> Management pipeline (see backend's
// utils/roundPipeline.js) — a round can only be added once the round before
// it in this order has passed.
export type RoundType = 'hr' | 'tech' | 'mgmt';
export const ROUND_TYPE_ORDER: RoundType[] = ['hr', 'tech', 'mgmt'];
export const ROUND_TYPE_LABELS: Record<RoundType, string> = {
  hr: 'HR Round', tech: 'Technical Round', mgmt: 'Management Round',
};

// HR Round only — candidate-background subform, prefilled from the
// candidate's profile the first time the round is opened, then
// independently editable.
export interface HrBackground {
  nativePlace:         string;
  residingIn:          string;
  commuteType:         string;
  age:                 string;
  family:              string;
  education:           string;
  hobbies:             string;
  experienceSummary:   string;
  currentCtc:          string;
  pfApplicable:        string;
  expectedCtc:         string;
  recommendedCtc:      string;
  currentCompany:      string;
  noticePeriodSummary: string;
  whenCanJoin:         string;
  reasonForLeaving:    string;
  skillsSummary:       string;
}

export interface InterviewRound {
  _id:                   string;
  roundType:             RoundType;
  roundNumber:           number;
  stage:                 string;
  schedulingStatus:      string;
  cancellationReason:    string;
  scheduledDate:         string;
  scheduledTime:         string;
  interviewer:           string;
  mode:                  string;
  meetingLink:           string;
  candidateConfirmation: string;
  note:                  string;
  feedback:              string;
  interviewerFeedbackStatus: string;
  hrBackground?:         HrBackground;
  bond?:                 string;
}

// A round "passes" once Done with a positive recommendation for its type —
// mirrors backend's hasPassedRound(). Technical can't be scheduled until HR
// passes; Management can't be scheduled until Technical passes.
const POSITIVE_FEEDBACK_BY_TYPE: Record<RoundType, string[]> = {
  hr:   ['Recommended as P1', 'Recommended as P2'],
  tech: ['Recommended as P1', 'Recommended as P2'],
  mgmt: ['Select', 'Select with Conditions'],
};
export function hasPassedRound(rounds: InterviewRound[] | undefined, roundType: RoundType): boolean {
  return (rounds || []).some(
    (r) => r.roundType === roundType && r.schedulingStatus === 'Done' && POSITIVE_FEEDBACK_BY_TYPE[roundType].includes(r.interviewerFeedbackStatus),
  );
}
export function roundLabel(roundType: RoundType, roundNumber: number): string {
  const base = ROUND_TYPE_LABELS[roundType];
  return roundNumber > 1 ? `${base} ${roundNumber}` : base;
}

export const HR_RECOMMENDATION_OPTIONS = ['Recommended as P1', 'Recommended as P2', 'Not Recommended', 'Candidate on Hold'];
export const TECH_RECOMMENDATION_OPTIONS = ['Recommended as P1', 'Recommended as P2', 'Not Recommended', 'Candidate on Hold'];
export const MGMT_RECOMMENDATION_OPTIONS = ['Select', 'Select with Conditions', 'Hold', 'Reject'];
export const BOND_OPTIONS = ['Not discussed', 'Willing to sign bond', 'Negotiable', 'Not willing'];
export const RATING_OPTIONS = ['Poor', 'Below Expectations', 'Meets Expectations', 'Good', 'Excellent'];

export interface OfferLetter {
  source:        '' | 'generated' | 'uploaded';
  generatedHtml: string;
  fileName:      string;
  driveLink:     string;
  updatedAt:     string | null;
}

export interface FinalDecision {
  decision:     string;
  offeredCTC:   string;
  joiningDate:  string;
  decisionDate: string;
  notes:        string;
  offerLetter?: OfferLetter;
}

// Post-acceptance tracking up to the candidate's actual first day — distinct
// from finalDecision.joiningDate (the originally planned date agreed at
// offer time).
export interface Joining {
  confirmedDate: string | null;
  actualDate:    string | null;
  status:        '' | 'Joining Pending' | 'Joined' | 'Did Not Join' | 'Offer Withdrawn';
  docsStatus:    'Pending' | 'Partially Received' | 'Complete';
  bgvStatus:     'Not Applicable' | 'Pending' | 'In Progress' | 'Cleared' | 'Adverse';
  remarks:       string;
}

export interface ExcelTestAnswer { question: string; answer: string }
export interface ExcelTest {
  sentAt:  string | null;
  status:  '' | 'Sent' | 'Submitted' | 'Graded';
  answers: ExcelTestAnswer[];
  marks:   boolean[];
  score:   number | null;
}

export interface DiscAssessment {
  sentAt:  string | null;
  status:  '' | 'Sent' | 'Completed';
  scores:  { D: number; I: number; S: number; C: number };
  primary: '' | 'D' | 'I' | 'S' | 'C';
}

export interface LinkedApplication {
  position:       string;
  date:           string | null;
  source:         string;
  applicationRef: string | null;
}

export interface CandidateEvent {
  key:    string;
  label:  string;
  when:   string;
  detail: string;
}

export interface UploadedDocument {
  docType:    string;
  fileName:   string;
  driveLink:  string;
  uploadedAt: string;
}

// Mirrors backend's utils/requiredCandidateDocuments.js — this app has no
// shared package between frontend and backend, so the list is duplicated;
// keep both in sync if it ever changes.
export const REQUIRED_CANDIDATE_DOCUMENTS: { key: string; label: string }[] = [
  { key: 'resume', label: 'Resume' },
  { key: 'photos', label: '2 Passport Size Colour Photographs' },
  { key: 'panOrVoterId', label: 'A Copy of PAN Card / Voter ID Card' },
  { key: 'aadhar', label: 'A Copy of Aadhar Card' },
  { key: 'bankDetails', label: 'A Copy of Bank Details' },
  { key: 'uan', label: 'A Copy of UAN Number, if Applicable' },
  { key: 'educationCertificates', label: 'A Copy of Education Certificates - 10th, 12th, Graduation, Post Graduation' },
  { key: 'previousCompanyDocs', label: "A Copy of Previous Company Details - Experience Letter, Last 3 Months' Salary Slips, if Applicable" },
];

export interface ApplicantRecord {
  _id:                   string;
  applicationRef:        string;
  full_name:             string;
  email:                 string;
  phone:                 string;
  whatsapp_same:         boolean;
  dob:                   string;
  country:               string;
  state:                 string;
  city:                  string;
  pin_code:              string;
  relocation:            string;
  designation:           string;
  designation_id?:       number;
  highest_qualification: string;
  experience:            'Yes' | 'No';
  total_experience:      string;
  current_ctc:           string;
  notice_period:         string;
  expected_monthly_ctc:  string;
  languagesKnown:  string[];
  otherLanguage:   string;
  facebookLink:    string;
  linkedin:        string;
  short_video_url: string;
  resume:          string;
  internalNotes:   string;
  rejectionMailSentAt: string | null;
  status:          StatusType;
  // Stage 1 — Screener Round
  screenerName:    string;
  screenerStatus:  string;
  screenerNotes:   string;
  // Stage 2 — Interview Round
  interviewRounds: InterviewRound[];
  interviewFinalStatus: string;
  // Stage 3 — Offer & Placement
  finalDecision:   FinalDecision;
  offerLetterSentAt?:         string | null;
  documentsUploadFolderLink?: string;
  uploadedDocuments?:         UploadedDocument[];
  createdAt:       string;
  // ── ATS-style additions ──────────────────────────────────────────────
  job_id?:          number | null;
  atsMatchScore?:   number | null;
  excelTest?:       ExcelTest;
  discAssessment?:  DiscAssessment;
  applications?:    LinkedApplication[];
  events?:          CandidateEvent[];
  joining?:         Joining;
}

export const API_BASE = process.env.REACT_APP_REACT_APP_API_BASE_URL || 'http://localhost:5000/api';

export const STATUS_OPTIONS: StatusType[] = ['New', 'Reviewed', 'Shortlisted', 'Rejected', 'Hired'];

export const STATUS_COLORS: Record<string, string> = {
  New:         'bg-blue-100   text-blue-700',
  Reviewed:    'bg-slate-100  text-slate-700',
  Shortlisted: 'bg-yellow-100 text-yellow-700',
  Rejected:    'bg-red-100    text-red-700',
  Hired:       'bg-green-100  text-green-700',
};

export const SCREENER_STATUS_OPTIONS = ['Shortlisted', 'Rejected', 'Candidate On Hold', 'Profile On Hold'];

export const SCREENER_STATUS_COLORS: Record<string, string> = {
  Shortlisted:         'bg-yellow-100 text-yellow-700',
  Rejected:            'bg-red-100    text-red-700',
  'Candidate On Hold': 'bg-orange-100 text-orange-700',
  'Profile On Hold':   'bg-purple-100 text-purple-700',
};

export const STAGE_OPTIONS = [
  'Technical Round 1', 'Technical Round 2',
  'Assessment (if any)', 'CEO Round', 'MD Round',
];

export const MODE_OPTIONS    = ['Virtual', 'Face-to-Face (F2F)', 'Phone Call', 'Not Decided Yet'];
export const DECISION_OPTIONS = ['Pending', 'Offer Made', 'Rejected', 'On Hold', 'Candidate Withdrew'];

export const SCHEDULING_STATUS_OPTIONS = ['Scheduled', 'Rescheduled', 'Done', 'Cancelled'];

export const SCHEDULING_STATUS_COLORS: Record<string, string> = {
  Scheduled:   'bg-blue-100   text-blue-700',
  Rescheduled: 'bg-orange-100 text-orange-700',
  Done:        'bg-green-100  text-green-700',
  Cancelled:   'bg-red-100    text-red-700',
};

// Overall outcome of the interview stage — distinct from any single
// round's scheduling state or the interviewer's own feedback on a round.
// 'New' is the starting value and is system-controlled only (see
// maybeAdvanceInterviewStatus in routes/applicantRecords.js) — it's listed
// here so an in-progress-less candidate's dropdown still renders correctly,
// but it's always disabled as a manual selection (never selectable again
// once the record has moved past it).
export const INTERVIEW_FINAL_STATUS_OPTIONS = ['New', 'In Progress', 'Shortlisted', 'Rejected'];

export const INTERVIEW_FINAL_STATUS_COLORS: Record<string, string> = {
  New:           'bg-gray-100   text-gray-500',
  'In Progress': 'bg-blue-100   text-blue-700',
  Shortlisted:   'bg-green-100  text-green-700',
  Rejected:      'bg-red-100    text-red-700',
};

// The interviewer's own recommendation/priority ranking for a round —
// feeds into what interviewFinalStatus is allowed to be set to.
export const INTERVIEWER_FEEDBACK_STATUS_OPTIONS = [
  'Recommended as P1', 'Recommended as P2', 'Not Recommended', 'Candidate on Hold',
];

export const INTERVIEWER_FEEDBACK_STATUS_COLORS: Record<string, string> = {
  'Recommended as P1':  'bg-green-100  text-green-700',
  'Recommended as P2':  'bg-lime-100   text-lime-700',
  'Not Recommended':    'bg-red-100    text-red-700',
  'Candidate on Hold':  'bg-yellow-100 text-yellow-700',
};

// Set manually by HR, or by the candidate clicking Yes/Maybe/Can't-attend
// in the schedule/reschedule email.
export const CANDIDATE_CONFIRMATION_OPTIONS = ['Pending', 'Yes', 'Maybe', 'No'];

export const CANDIDATE_CONFIRMATION_COLORS: Record<string, string> = {
  Pending: 'bg-gray-100   text-gray-600',
  Yes:     'bg-green-100  text-green-700',
  Maybe:   'bg-orange-100 text-orange-700',
  No:      'bg-red-100    text-red-700',
};

export const DECISION_COLORS: Record<string, string> = {
  Pending:              'bg-gray-100    text-gray-600',
  'Offer Made':         'bg-green-100   text-green-700',
  Rejected:             'bg-red-100     text-red-700',
  'On Hold':            'bg-yellow-100  text-yellow-700',
  'Candidate Withdrew': 'bg-orange-100  text-orange-700',
};

export const JOINING_STATUS_OPTIONS = ['Joining Pending', 'Joined', 'Did Not Join', 'Offer Withdrawn'];

export const JOINING_STATUS_COLORS: Record<string, string> = {
  '':                   'bg-gray-100   text-gray-500',
  'Joining Pending':    'bg-blue-100   text-blue-700',
  Joined:               'bg-green-100  text-green-700',
  'Did Not Join':       'bg-red-100    text-red-700',
  'Offer Withdrawn':    'bg-orange-100 text-orange-700',
};

export const DOCS_STATUS_OPTIONS = ['Pending', 'Partially Received', 'Complete'];
export const BGV_STATUS_OPTIONS  = ['Not Applicable', 'Pending', 'In Progress', 'Cleared', 'Adverse'];

export const ASSESSMENT_STATUS_COLORS: Record<string, string> = {
  '':          'bg-gray-100   text-gray-500',
  Sent:        'bg-blue-100   text-blue-700',
  Submitted:   'bg-amber-100  text-amber-700',
  Completed:   'bg-green-100  text-green-700',
  Graded:      'bg-green-100  text-green-700',
};

export const DISC_TRAIT_LABELS: Record<'D' | 'I' | 'S' | 'C', string> = {
  D: 'Dominance',
  I: 'Influence',
  S: 'Steadiness',
  C: 'Conscientiousness',
};