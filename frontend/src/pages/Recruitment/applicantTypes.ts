// pages/Recruitment/applicantTypes.ts
// ─────────────────────────────────────────────────────────────────────────────
// Shared types + constants used across all 4 stage components
// (CandidateInformationTab, ScreenerRoundTab, InterviewRoundTab,
// OfferPlacementTab) and the main AllApplicants page that orchestrates them.
// ─────────────────────────────────────────────────────────────────────────────

export type StatusType = 'New' | 'Reviewed' | 'Shortlisted' | 'Rejected' | 'Hired';

export interface InterviewRound {
  _id:           string;
  roundNumber:   number;
  stage:         string;
  customStage:   string;
  scheduledDate: string;
  interviewer:   string;
  mode:          string;
  feedback:      string;
  result:        string;
}

export interface FinalDecision {
  decision:     string;
  offeredCTC:   string;
  joiningDate:  string;
  decisionDate: string;
  notes:        string;
}

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
  hindi_read:    string; hindi_write:   string; hindi_speak:   string;
  english_read:  string; english_write: string; english_speak: string;
  facebookLink:    string;
  linkedin:        string;
  short_video_url: string;
  resume:          string;
  internalNotes:   string;
  status:          StatusType;
  // Stage 1 — Screener Round
  screenerName:    string;
  screenerStatus:  string;
  screenerNotes:   string;
  // Stage 2 — Interview Round
  interviewRounds: InterviewRound[];
  // Stage 3 — Offer & Placement
  finalDecision:   FinalDecision;
  createdAt:       string;
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
  'HR Round', 'Technical Round 1', 'Technical Round 2',
  'Assessment', 'CEO Round', 'MD Round', 'Other',
];

export const RESULT_OPTIONS  = ['Pending', 'Selected', 'Rejected', 'On Hold'];
export const MODE_OPTIONS    = ['Face-to-face', 'Video Call', 'Phone', 'Not decided'];
export const DECISION_OPTIONS = ['Pending', 'Offer Made', 'Rejected', 'On Hold', 'Candidate Withdrew'];

export const RESULT_COLORS: Record<string, string> = {
  Pending:     'bg-gray-100    text-gray-600',
  Selected:    'bg-green-100   text-green-700',
  Rejected:    'bg-red-100     text-red-700',
  'On Hold':   'bg-yellow-100  text-yellow-700',
  Pass:        'bg-green-100   text-green-700',
  Fail:        'bg-red-100     text-red-700',
  'No Show':   'bg-orange-100  text-orange-700',
  Rescheduled: 'bg-purple-100  text-purple-700',
};

export const DECISION_COLORS: Record<string, string> = {
  Pending:              'bg-gray-100    text-gray-600',
  'Offer Made':         'bg-green-100   text-green-700',
  Rejected:             'bg-red-100     text-red-700',
  'On Hold':            'bg-yellow-100  text-yellow-700',
  'Candidate Withdrew': 'bg-orange-100  text-orange-700',
};