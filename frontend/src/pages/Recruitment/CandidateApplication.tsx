'use client';

import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSearchParams, Link } from 'react-router-dom';
import Select from 'react-select';
import CreatableSelect from 'react-select/creatable';
import * as z from 'zod';

const API_BASE = process.env.REACT_APP_REACT_APP_API_BASE_URL || 'http://localhost:5000/api';

const CANDIDATE_TYPE_OPTIONS = ['Fresher', 'Experienced', 'Intern'] as const;
const WORK_MODE_OPTIONS = ['Remote', 'Hybrid', 'On-site'] as const;
const SOURCE_OPTIONS = ['Referral', 'Naukri', 'LinkedIn', 'Careers Page', 'Walk-in', 'Campus', 'Other'] as const;
const LANGUAGE_OPTIONS = [
  'Hindi', 'English', 'Punjabi', 'Bengali', 'Tamil', 'Telugu',
  'Marathi', 'Gujarati', 'Kannada', 'Malayalam', 'Urdu',
];
const CURRENT_YEAR = new Date().getFullYear();

// Maps a job link's ?src= query param onto the manual-fallback source list,
// so the field is system-captured whenever possible instead of relying
// purely on self-report (self-reported channel data is unreliable for
// cost-per-hire / source-effectiveness analysis on its own).
const SOURCE_PARAM_MAP: Record<string, (typeof SOURCE_OPTIONS)[number]> = {
  linkedin: 'LinkedIn', naukri: 'Naukri', referral: 'Referral',
  careers: 'Careers Page', career: 'Careers Page', campus: 'Campus', walkin: 'Walk-in',
};

// ── Schema ────────────────────────────────────────────────────────────────────
const formSchema = z
  .object({
    // Step 1 — Job & Personal
    full_name: z.string().min(1, 'Full name is required'),
    candidateType: z.enum(CANDIDATE_TYPE_OPTIONS, { errorMap: () => ({ message: 'Please select a candidate type' }) }),
    email: z.string().email('Invalid email'),
    dial_code: z.string().min(1, 'Country code is required'),
    mobile: z.string().regex(/^\d{10}$/, 'Must be exactly 10 digits'),
    whatsapp_same: z.boolean().optional(),
    whatsappNumber: z.string().optional(),
    dob: z.string().min(1, 'Date of birth is required'),

    state: z.string().min(1, 'State is required'),
    city: z.string().min(1, 'City is required'),
    pin_code: z.string().regex(/^\d{6}$/, 'Must be exactly 6 digits'),
    relocation: z.enum(['Yes', 'No']),
    candidateSource: z.union([z.enum(SOURCE_OPTIONS), z.literal('')]).optional(),
    sourceDetail: z.string().optional(),

    job_id: z.union([z.string(), z.number()]).optional(),
    designation: z.string().min(1, 'No role selected — please apply from the careers page'),
    designation_id: z.number().optional(),

    // Step 2 — Education & Experience
    highest_qualification: z.string().min(1, 'Required'),
    educationSpecialization: z.string().min(1, 'Required'),
    collegeUniversity: z.string().optional(),
    graduationYear: z.string().optional(),
    courseName: z.string().optional(),
    semesterOrYear: z.string().optional(),
    internshipDuration: z.string().optional(),
    total_experience: z.string().optional(),
    relevantExperience: z.string().optional(),
    current_company: z.string().optional(),
    current_designation: z.string().optional(),

    // Step 3 — Skills & Compensation
    primarySkills: z.array(z.string()).min(1, 'Add at least one primary skill'),
    secondarySkills: z.array(z.string()).optional(),
    languagesKnown: z.array(z.string()).min(1, 'Select at least one language'),
    otherLanguage: z.string().optional(),
    current_ctc: z.string().optional(),
    expected_annual_ctc: z.string().min(1, 'Expected CTC is required'),

    // Step 4 — Availability & Preferences
    notice_period: z.string().optional(),
    expectedJoiningDate: z.string().min(1, 'Expected joining date is required'),
    preferredWorkMode: z.union([z.enum(WORK_MODE_OPTIONS), z.literal('')]).optional(),

    // Step 5 — Resume & Screening (profiles)
    linkedin: z.string().url().optional().or(z.literal('')),
    githubPortfolio: z.string().url().optional().or(z.literal('')),
    short_video_url: z.string().url().optional().or(z.literal('')),

    // Step 6 — Review & Submit
    consentGiven: z.boolean().refine((v) => v === true, { message: 'You must accept the declaration to submit' }),
  })
  .superRefine((data, ctx) => {
    const num = (
      val: string | undefined, path: string,
      opts: { min: number; max: number; label: string; integer?: boolean },
    ) => {
      if (!val) return;
      const n = Number(val);
      if (Number.isNaN(n)) { ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message: `${opts.label} must be a number` }); return; }
      if (opts.integer && !Number.isInteger(n)) { ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message: `${opts.label} must be a whole number` }); return; }
      if (n < opts.min || n > opts.max) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message: `${opts.label} must be between ${opts.min} and ${opts.max}` });
    };

    // WhatsApp — only meaningful when it differs from the mobile number
    if (!data.whatsapp_same) {
      if (!data.whatsappNumber) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['whatsappNumber'], message: 'Enter a WhatsApp number, or check "same as mobile"' });
      else if (!/^\d{10}$/.test(data.whatsappNumber)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['whatsappNumber'], message: 'Must be exactly 10 digits' });
    }

    // Candidate-type-conditional requireds
    if (data.candidateType === 'Experienced') {
      if (!data.total_experience) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['total_experience'], message: 'Required for experienced candidates' });
      if (!data.relevantExperience) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['relevantExperience'], message: 'Required for experienced candidates' });
      else if (data.total_experience && Number(data.relevantExperience) > Number(data.total_experience)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['relevantExperience'], message: 'Cannot exceed total experience' });
      }
    }
    if (data.candidateType === 'Intern') {
      if (!data.courseName) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['courseName'], message: 'Required for interns' });
      if (!data.semesterOrYear) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['semesterOrYear'], message: 'Required for interns' });
      if (!data.internshipDuration) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['internshipDuration'], message: 'Required for interns' });
    }

    // Numeric bounds — catches negative values, garbage strings, and
    // wildly unrealistic figures without pretending to price-check CTC
    num(data.total_experience, 'total_experience', { min: 0, max: 50, label: 'Total experience' });
    num(data.relevantExperience, 'relevantExperience', { min: 0, max: 50, label: 'Relevant experience' });
    num(data.current_ctc, 'current_ctc', { min: 0, max: 100000000, label: 'Current CTC' });
    num(data.expected_annual_ctc, 'expected_annual_ctc', { min: 0, max: 100000000, label: 'Expected CTC' });
    num(data.notice_period, 'notice_period', { min: 0, max: 180, label: 'Notice period (days)', integer: true });
    num(data.graduationYear, 'graduationYear', { min: 1970, max: CURRENT_YEAR + 1, label: 'Graduation year', integer: true });

    // DOB sanity — catches empty-ish garbage and unrealistic ages without a rigid rule
    if (data.dob) {
      const ageYears = (Date.now() - new Date(data.dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25);
      if (Number.isNaN(ageYears)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['dob'], message: 'Invalid date' });
      else if (ageYears < 16 || ageYears > 70) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['dob'], message: 'Please enter a valid date of birth' });
    }

    // LinkedIn should actually be a LinkedIn URL, not just any valid URL
    if (data.linkedin && !/linkedin\.com/i.test(data.linkedin)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['linkedin'], message: 'Must be a linkedin.com profile URL' });
    }
  });

type FormData = z.infer<typeof formSchema>;

const STEP_FIELDS: (keyof FormData)[][] = [
  ['full_name', 'candidateType', 'email', 'dob', 'dial_code', 'mobile', 'whatsapp_same', 'whatsappNumber', 'state', 'city', 'pin_code', 'relocation'],
  ['highest_qualification', 'educationSpecialization', 'collegeUniversity', 'graduationYear', 'courseName', 'semesterOrYear', 'internshipDuration', 'total_experience', 'relevantExperience', 'current_company', 'current_designation'],
  ['primarySkills', 'secondarySkills', 'languagesKnown', 'otherLanguage', 'current_ctc', 'expected_annual_ctc'],
  ['notice_period', 'expectedJoiningDate', 'preferredWorkMode'],
  ['linkedin', 'githubPortfolio', 'short_video_url'],
  ['consentGiven'],
];

const STEP_TITLES = [
  'Job & Personal Information',
  'Education & Experience',
  'Skills & Compensation',
  'Availability & Preferences',
  'Resume & Screening',
  'Review & Submit',
];

// ── Types ─────────────────────────────────────────────────────────────────────
type Country = { name: string; dialCode: string };
type GeoItem = { name: string };

type ScreeningQuestion = {
  _id: string;
  text: string;
  type: 'mcq' | 'yesno' | 'numeric' | 'text' | 'experience' | 'skill';
  options: string[];
  required: boolean;
  minValue: number | null;
  maxValue: number | null;
};

type JobDetails = {
  serial_no: number;
  designation: string;
  hiring_dept: string;
  hiring_dept_email?: string;
  dept_group_email?: string;
  candidate_experience_level?: string | null;
  role_link?: string;
  jd_link?: string;
  fmsStatus?: 'Open' | 'Closed';
  required_skills?: string[];
  role_category?: 'General' | 'Technical' | 'Design' | 'ClientFacing';
  remote_eligible?: boolean;
  base_location?: string;
  screeningQuestions?: ScreeningQuestion[];
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function CandidateApplicationPage() {
  const [searchParams] = useSearchParams();
  const jobIdParam       = searchParams.get('job_id');
  const designationParam = searchParams.get('designation');
  const srcParam         = searchParams.get('src');

  const [countries,    setCountries]    = useState<Country[]>([]);
  const [states,       setStates]       = useState<GeoItem[]>([]);
  const [cities,       setCities]       = useState<GeoItem[]>([]);

  const [job,         setJob]         = useState<JobDetails | null>(null);
  const [loadingJob,   setLoadingJob]  = useState(true);
  const [jobError,     setJobError]    = useState<string | null>(null);

  const [loadingCountries, setLoadingCountries] = useState(true);
  const [loadingStates,    setLoadingStates]    = useState(true);
  const [loadingCities,    setLoadingCities]    = useState(false);

  const [dialCode,     setDialCode]     = useState('+91');
  const [resumeFile,   setResumeFile]   = useState<File | null>(null);
  const [resumeError,  setResumeError]  = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted,    setSubmitted]    = useState(false);

  const [currentStep, setCurrentStep] = useState(0);
  const [screeningAnswers, setScreeningAnswers] = useState<Record<string, string>>({});
  const [screeningErrors,  setScreeningErrors]  = useState<Record<string, string>>({});
  const [stepError, setStepError] = useState<string | null>(null);
  const sourceAutoCaptured = !!(srcParam && SOURCE_PARAM_MAP[srcParam.toLowerCase()]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    trigger,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      candidateType: 'Fresher',
      relocation:    'Yes',
      whatsapp_same: true,
      dial_code:     '+91',
      primarySkills:   [],
      secondarySkills: [],
      languagesKnown:  [],
      candidateSource: sourceAutoCaptured ? SOURCE_PARAM_MAP[(srcParam as string).toLowerCase()] : '',
    },
  });

  const watchedState    = watch('state');
  const candidateType   = watch('candidateType');
  const whatsappSame    = watch('whatsapp_same');
  const primarySkills   = watch('primarySkills');
  const secondarySkills = watch('secondarySkills');
  const languagesKnown  = watch('languagesKnown');

  useEffect(() => {
    if (!jobIdParam) {
      setJobError('No job selected. Please apply from the careers page.');
      setLoadingJob(false);
      return;
    }

    fetch(`${API_BASE}/hiringrequisitions/open`)
      .then((r) => r.json())
      .then((res) => {
        const jobs: JobDetails[] = Array.isArray(res?.data) ? res.data : [];
        const matched = jobs.find((j) => String(j.serial_no) === String(jobIdParam));

        if (matched) {
          setJob(matched);
          setValue('job_id', matched.serial_no, { shouldValidate: true });
          setValue('designation', matched.designation, { shouldValidate: true });
        } else if (designationParam) {
          setJob({
            serial_no: Number(jobIdParam),
            designation: designationParam,
            hiring_dept: '',
            fmsStatus: 'Closed',
          });
          setValue('job_id', Number(jobIdParam), { shouldValidate: true });
          setValue('designation', designationParam, { shouldValidate: true });
          setJobError('This position may no longer be accepting applications. You can still submit, and our team will review it.');
        } else {
          setJobError('This job posting could not be found. Please go back to the careers page and select a position.');
        }
        setLoadingJob(false);
      })
      .catch(() => {
        if (designationParam) {
          setJob({
            serial_no: Number(jobIdParam),
            designation: designationParam,
            hiring_dept: '',
          });
          setValue('job_id', Number(jobIdParam), { shouldValidate: true });
          setValue('designation', designationParam, { shouldValidate: true });
        } else {
          setJobError('Could not load job details. Please try again from the careers page.');
        }
        setLoadingJob(false);
      });
  }, [jobIdParam, designationParam, setValue]);

  useEffect(() => {
    fetch(`${API_BASE}/geo/countries`)
      .then((r) => r.json())
      .then((data) => {
        setCountries(Array.isArray(data) ? data : []);
        setLoadingCountries(false);
      })
      .catch((err) => {
        console.error(err);
        setCountries([]);
        setLoadingCountries(false);
      });
  }, []);

  useEffect(() => {
    setLoadingStates(true);
    fetch(`${API_BASE}/geo/states`)
      .then((r) => r.json())
      .then((data) => {
        setStates(Array.isArray(data) ? data : []);
        setLoadingStates(false);
      })
      .catch(() => {
        setStates([]);
        setLoadingStates(false);
      });
  }, []);

  useEffect(() => {
    if (!watchedState) { setCities([]); setValue('city', ''); return; }
    setLoadingCities(true);
    fetch(`${API_BASE}/geo/cities?state=${encodeURIComponent(watchedState)}`)
      .then((r) => r.json())
      .then((data) => {
        setCities(Array.isArray(data) ? data : []);
        setLoadingCities(false);
      })
      .catch(() => {
        setCities([]);
        setLoadingCities(false);
      });
  }, [watchedState, setValue]);

  const countryOptions = countries.map((c) => ({
    value: c.dialCode,
    label: `${c.dialCode} ${c.name}`,
  }));

  const skillOptions = useMemo(
    () => (job?.required_skills ?? []).map((s) => ({ value: s, label: s })),
    [job],
  );

  const isTechnicalOrDesign = job?.role_category === 'Technical' || job?.role_category === 'Design';
  const isClientFacing      = job?.role_category === 'ClientFacing';
  const isRemoteEligible    = !!job?.remote_eligible;
  const screeningQuestions  = job?.screeningQuestions ?? [];

  // ── Resume file handler ───────────────────────────────────────────────────────
  const handleResumeChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (!file) { setResumeFile(null); setResumeError(null); return; }
    if (file.type !== 'application/pdf') {
      setResumeFile(null);
      setResumeError('Only PDF files are accepted');
      e.target.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setResumeFile(null);
      setResumeError('File must be under 5MB');
      e.target.value = '';
      return;
    }
    setResumeError(null);
    setResumeFile(file);
  };

  const handleScreeningChange = (questionId: string, value: string) => {
    setScreeningAnswers((prev) => ({ ...prev, [questionId]: value }));
    setScreeningErrors((prev) => ({ ...prev, [questionId]: '' }));
  };

  const validateScreeningAnswers = () => {
    const nextErrors: Record<string, string> = {};
    screeningQuestions.forEach((q) => {
      if (q.required && !(screeningAnswers[q._id] || '').trim()) {
        nextErrors[q._id] = 'This question is required';
      }
    });
    setScreeningErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  // ── Step navigation ───────────────────────────────────────────────────────────
  const goNext = async () => {
    setStepError(null);
    const fields = STEP_FIELDS[currentStep];
    const valid = await trigger(fields, { shouldFocus: true });
    if (!valid) return;

    if (currentStep === 4) {
      if (!resumeFile) { setResumeError('Resume is required'); setStepError('Please attach your resume before continuing.'); return; }
      if (!validateScreeningAnswers()) { setStepError('Please answer all required screening questions before continuing.'); return; }
    }

    setCurrentStep((s) => Math.min(s + 1, STEP_TITLES.length - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goBack = () => {
    setStepError(null);
    setCurrentStep((s) => Math.max(s - 1, 0));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ── Submit ───────────────────────────────────────────────────────────────────
  const onSubmit = async (data: FormData) => {
    if (!resumeFile) {
      setResumeError('Resume is required');
      setCurrentStep(4);
      return;
    }
    if (!validateScreeningAnswers()) {
      setCurrentStep(4);
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('full_name', data.full_name);
      formData.append('candidateType', data.candidateType);
      formData.append('email', data.email);
      formData.append('phone', dialCode + data.mobile);
      formData.append('whatsapp_same', String(data.whatsapp_same || false));
      formData.append('whatsappNumber', data.whatsapp_same ? '' : (data.whatsappNumber || ''));
      formData.append('dob', data.dob);
      formData.append('state', data.state);
      formData.append('city', data.city);
      formData.append('pin_code', data.pin_code);
      formData.append('relocation', data.relocation);
      formData.append('candidateSource', data.candidateSource || '');
      formData.append('sourceDetail', data.sourceDetail || '');
      if (data.job_id !== undefined) formData.append('job_id', String(data.job_id));
      formData.append('designation', data.designation);
      if (data.designation_id !== undefined) formData.append('designation_id', String(data.designation_id));

      formData.append('highest_qualification', data.highest_qualification);
      formData.append('educationSpecialization', data.educationSpecialization);
      formData.append('collegeUniversity', data.collegeUniversity || '');
      formData.append('graduationYear', data.graduationYear || '');
      formData.append('courseName', data.candidateType === 'Intern' ? (data.courseName || '') : '');
      formData.append('semesterOrYear', data.candidateType === 'Intern' ? (data.semesterOrYear || '') : '');
      formData.append('internshipDuration', data.candidateType === 'Intern' ? (data.internshipDuration || '') : '');

      const isExperienced = data.candidateType === 'Experienced';
      formData.append('total_experience', isExperienced ? (data.total_experience || '') : '');
      formData.append('relevantExperience', isExperienced ? (data.relevantExperience || '') : '');
      formData.append('current_company', isExperienced ? (data.current_company || '') : '');
      formData.append('current_designation', isExperienced ? (data.current_designation || '') : '');
      formData.append('current_ctc', isExperienced ? (data.current_ctc || '') : '');
      formData.append('notice_period', isExperienced ? (data.notice_period || '') : '');

      formData.append('expected_annual_ctc', data.expected_annual_ctc);
      formData.append('expectedJoiningDate', data.expectedJoiningDate);
      formData.append('preferredWorkMode', isRemoteEligible ? (data.preferredWorkMode || '') : '');

      formData.append('primarySkills', JSON.stringify(data.primarySkills || []));
      formData.append('secondarySkills', JSON.stringify(data.secondarySkills || []));

      formData.append('languagesKnown', JSON.stringify(data.languagesKnown || []));
      formData.append('otherLanguage', data.otherLanguage || '');

      formData.append('linkedin', data.linkedin || '');
      formData.append('githubPortfolio', isTechnicalOrDesign ? (data.githubPortfolio || '') : '');
      formData.append('short_video_url', isClientFacing ? (data.short_video_url || '') : '');

      const answers = screeningQuestions.map((q) => ({
        questionId: q._id,
        questionText: q.text,
        answer: screeningAnswers[q._id] || '',
      }));
      formData.append('screeningAnswers', JSON.stringify(answers));

      formData.append('consentGiven', String(data.consentGiven));
      formData.append('resume', resumeFile);

      const res = await fetch(`${API_BASE}/candidate-applications`, {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        setSubmitted(true);
      } else {
        const errJson = await res.json().catch(() => null);
        alert('Submission failed: ' + (errJson?.message || 'Please try again.'));
      }
    } catch {
      alert('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputCls  = 'w-full px-4 py-3 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-lime-400 focus:border-lime-500 text-sm transition';
  const selectCls = inputCls;
  const errCls    = 'text-red-500 text-xs mt-1';
  const labelCls  = 'block text-sm font-semibold text-gray-700 mb-1.5';

  const reactSelectStyles = {
    control: (base: any, state: any) => ({
      ...base,
      minHeight: '46px',
      borderColor: state.isFocused ? '#84cc16' : '#d1d5db',
      borderRadius: '0.5rem',
      fontSize: '0.875rem',
      boxShadow: state.isFocused ? '0 0 0 2px #bef264' : 'none',
      '&:hover': { borderColor: '#84cc16' },
    }),
    menu:    (base: any) => ({ ...base, zIndex: 50, fontSize: '0.875rem' }),
    option:  (base: any, state: any) => ({
      ...base,
      backgroundColor: state.isSelected ? '#65a30d' : state.isFocused ? '#f7fee7' : 'white',
      color: state.isSelected ? 'white' : '#111827',
    }),
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-lime-50">
        <div className="text-center p-10">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-3xl font-bold text-lime-700 mb-2">Application Submitted!</h2>
          <p className="text-gray-600">Thank you. Our team will be in touch with you shortly.</p>
        </div>
      </div>
    );
  }

  if (!loadingJob && !job) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center p-10 max-w-md">
          <p className="text-2xl font-bold text-gray-800 mb-3">No position selected</p>
          <p className="text-gray-500 mb-6">{jobError}</p>
          <Link to="/careers" className="inline-block px-8 py-3 bg-lime-600 hover:bg-lime-700 text-white font-bold rounded-xl transition">
            View Open Positions
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-lg overflow-hidden">

        <div className="bg-lime-600 px-8 py-6">
          <h1 className="text-2xl font-bold text-white">Candidate Application</h1>
          <p className="text-lime-100 text-sm mt-1">Fill in your details to apply. All fields marked * are required.</p>
        </div>

        <div className="px-8 pt-6">
          {loadingJob ? (
            <div className="h-20 bg-gray-100 rounded-xl animate-pulse" />
          ) : job && (
            <div className="bg-lime-50 border border-lime-200 rounded-xl p-5">
              <p className="text-xs font-bold text-lime-600 mb-1">
                {job.serial_no ? `JOB ID: REQ-${job.serial_no}` : ''}
              </p>
              <h2 className="text-xl font-bold text-gray-800">{job.designation}</h2>
              {job.hiring_dept && <p className="text-gray-500 text-sm mt-0.5">{job.hiring_dept}</p>}

              {jobError && (
                <p className="text-amber-700 text-sm mt-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  {jobError}
                </p>
              )}

              {(job.role_link || job.jd_link) && (
                <div className="flex gap-4 mt-3 text-sm">
                  {job.role_link && (
                    <a href={job.role_link} target="_blank" rel="noopener noreferrer" className="text-lime-700 underline font-medium">
                      View role document
                    </a>
                  )}
                  {job.jd_link && (
                    <a href={job.jd_link} target="_blank" rel="noopener noreferrer" className="text-lime-700 underline font-medium">
                      View job description
                    </a>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Step progress ── */}
        <div className="px-8 pt-6">
          <div className="flex items-center gap-1">
            {STEP_TITLES.map((title, i) => (
              <div key={title} className="flex-1 flex flex-col items-center">
                <div className={`w-full h-1.5 rounded-full mb-2 ${i <= currentStep ? 'bg-lime-500' : 'bg-gray-200'}`} />
                <span className={`text-[10px] text-center leading-tight hidden sm:block ${i === currentStep ? 'text-lime-700 font-bold' : 'text-gray-400'}`}>
                  {title}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2 sm:hidden">Step {currentStep + 1} of {STEP_TITLES.length}: <span className="font-semibold text-gray-600">{STEP_TITLES[currentStep]}</span></p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="px-8 py-8">

          <input type="hidden" {...register('job_id')} />
          <input type="hidden" {...register('designation')} />
          {errors.designation && <p className={errCls}>{errors.designation.message}</p>}

          {/* ══════════ STEP 1 — Job & Personal Information ══════════ */}
          {currentStep === 0 && (
            <div className="space-y-8">
              <section>
                <h2 className="text-base font-bold text-gray-500 uppercase tracking-widest mb-5">Personal Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="md:col-span-2">
                    <label className={labelCls}>Full Name *</label>
                    <input type="text" {...register('full_name')} className={inputCls} placeholder="Rahul Sharma" />
                    {errors.full_name && <p className={errCls}>{errors.full_name.message}</p>}
                  </div>

                  <div className="md:col-span-2">
                    <label className={labelCls}>You are applying as a *</label>
                    <div className="flex gap-4 mt-1">
                      {CANDIDATE_TYPE_OPTIONS.map((t) => (
                        <label key={t} className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 border rounded-lg text-sm font-semibold cursor-pointer transition ${
                          candidateType === t ? 'border-lime-500 bg-lime-50 text-lime-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                        }`}>
                          <input type="radio" value={t} {...register('candidateType')} className="accent-lime-600" />
                          {t}
                        </label>
                      ))}
                    </div>
                    {errors.candidateType && <p className={errCls}>{errors.candidateType.message}</p>}
                  </div>

                  <div>
                    <label className={labelCls}>Email *</label>
                    <input type="email" {...register('email')} className={inputCls} placeholder="rahul@example.com" />
                    {errors.email && <p className={errCls}>{errors.email.message}</p>}
                  </div>

                  <div>
                    <label className={labelCls}>Date of Birth *</label>
                    <input type="date" {...register('dob')} className={inputCls} />
                    {errors.dob && <p className={errCls}>{errors.dob.message}</p>}
                  </div>

                  <div className="md:col-span-2">
                    <label className={labelCls}>Mobile Number *</label>
                    <div className="flex gap-3 items-start">
                      <div className="w-44 shrink-0">
                        <Select
                          options={countryOptions}
                          isLoading={loadingCountries}
                          defaultValue={{ value: '+91', label: '+91 India' }}
                          onChange={(opt: any) => {
                            setDialCode(opt?.value || '+91');
                            setValue('dial_code', opt?.value || '+91');
                          }}
                          isSearchable
                          placeholder="Code"
                          styles={reactSelectStyles}
                        />
                      </div>
                      <input
                        type="tel"
                        {...register('mobile')}
                        className={`flex-1 ${inputCls}`}
                        placeholder="9876543210"
                      />
                    </div>
                    {errors.mobile && <p className={errCls}>{errors.mobile.message}</p>}
                    <label className="flex items-center gap-2 mt-2 text-sm text-gray-600 cursor-pointer">
                      <input type="checkbox" {...register('whatsapp_same')} className="h-4 w-4 accent-lime-600" />
                      Same number for WhatsApp
                    </label>
                    {!whatsappSame && (
                      <div className="mt-2">
                        <input type="tel" {...register('whatsappNumber')} className={inputCls} placeholder="WhatsApp number (10 digits)" />
                        {errors.whatsappNumber && <p className={errCls}>{errors.whatsappNumber.message}</p>}
                      </div>
                    )}
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-base font-bold text-gray-500 uppercase tracking-widest mb-5">Location</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className={labelCls}>State *</label>
                    <select
                      {...register('state')}
                      className={selectCls}
                      onChange={(e) => { setValue('state', e.target.value); setValue('city', ''); }}
                    >
                      <option value="">{loadingStates ? 'Loading…' : 'Select State'}</option>
                      {states.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
                    </select>
                    {errors.state && <p className={errCls}>{errors.state.message}</p>}
                  </div>

                  <div>
                    <label className={labelCls}>City *</label>
                    <select
                      {...register('city')}
                      className={selectCls}
                      disabled={!watchedState || loadingCities}
                    >
                      <option value="">{loadingCities ? 'Loading…' : 'Select City'}</option>
                      {cities.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
                    </select>
                    {errors.city && <p className={errCls}>{errors.city.message}</p>}
                  </div>

                  <div>
                    <label className={labelCls}>Pin Code *</label>
                    <input type="text" {...register('pin_code')} className={inputCls} placeholder="110001" maxLength={6} />
                    {errors.pin_code && <p className={errCls}>{errors.pin_code.message}</p>}
                  </div>

                  <div>
                    <label className={labelCls}>
                      Open to relocate{job?.base_location ? ` to ${job.base_location}` : ' for this role'}? *
                    </label>
                    <div className="flex gap-6 mt-2">
                      {(['Yes', 'No'] as const).map((v) => (
                        <label key={v} className="flex items-center gap-2 text-sm cursor-pointer">
                          <input type="radio" value={v} {...register('relocation')} className="accent-lime-600" />
                          {v}
                        </label>
                      ))}
                    </div>
                  </div>

                  {!sourceAutoCaptured && (
                    <div className="md:col-span-2">
                      <label className={labelCls}>How did you hear about this opening?</label>
                      <select {...register('candidateSource')} className={selectCls}>
                        <option value="">Select (optional)</option>
                        {SOURCE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              </section>
            </div>
          )}

          {/* ══════════ STEP 2 — Education & Experience ══════════ */}
          {currentStep === 1 && (
            <div className="space-y-8">
              <section>
                <h2 className="text-base font-bold text-gray-500 uppercase tracking-widest mb-5">Education</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className={labelCls}>Highest Qualification *</label>
                    <input type="text" {...register('highest_qualification')} className={inputCls} placeholder="e.g. B.Tech, MBA, 12th" />
                    {errors.highest_qualification && <p className={errCls}>{errors.highest_qualification.message}</p>}
                  </div>
                  <div>
                    <label className={labelCls}>Specialization *</label>
                    <input type="text" {...register('educationSpecialization')} className={inputCls} placeholder="e.g. Computer Science" />
                    {errors.educationSpecialization && <p className={errCls}>{errors.educationSpecialization.message}</p>}
                  </div>
                  <div>
                    <label className={labelCls}>College / University</label>
                    <input type="text" {...register('collegeUniversity')} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Graduation Year</label>
                    <input type="number" {...register('graduationYear')} className={inputCls} placeholder="2024" />
                    {errors.graduationYear && <p className={errCls}>{errors.graduationYear.message}</p>}
                  </div>

                  {candidateType === 'Intern' && (
                    <>
                      <div>
                        <label className={labelCls}>Course Name *</label>
                        <input type="text" {...register('courseName')} className={inputCls} />
                        {errors.courseName && <p className={errCls}>{errors.courseName.message}</p>}
                      </div>
                      <div>
                        <label className={labelCls}>Current Semester / Year *</label>
                        <input type="text" {...register('semesterOrYear')} className={inputCls} placeholder="e.g. 6th Semester" />
                        {errors.semesterOrYear && <p className={errCls}>{errors.semesterOrYear.message}</p>}
                      </div>
                      <div>
                        <label className={labelCls}>Internship Duration Available *</label>
                        <input type="text" {...register('internshipDuration')} className={inputCls} placeholder="e.g. 3 months" />
                        {errors.internshipDuration && <p className={errCls}>{errors.internshipDuration.message}</p>}
                      </div>
                    </>
                  )}
                </div>
              </section>

              {candidateType === 'Experienced' && (
                <section>
                  <h2 className="text-base font-bold text-gray-500 uppercase tracking-widest mb-5">Professional Experience</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className={labelCls}>Total Experience (years) *</label>
                      <input type="number" step="0.1" {...register('total_experience')} className={inputCls} placeholder="3" />
                      {errors.total_experience && <p className={errCls}>{errors.total_experience.message}</p>}
                    </div>
                    <div>
                      <label className={labelCls}>Relevant Experience (years) *</label>
                      <input type="number" step="0.1" {...register('relevantExperience')} className={inputCls} placeholder="2" />
                      {errors.relevantExperience && <p className={errCls}>{errors.relevantExperience.message}</p>}
                    </div>
                    <div>
                      <label className={labelCls}>Current Company</label>
                      <input type="text" {...register('current_company')} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Current Designation</label>
                      <input type="text" {...register('current_designation')} className={inputCls} />
                    </div>
                  </div>
                </section>
              )}
            </div>
          )}

          {/* ══════════ STEP 3 — Skills & Compensation ══════════ */}
          {currentStep === 2 && (
            <div className="space-y-8">
              <section>
                <h2 className="text-base font-bold text-gray-500 uppercase tracking-widest mb-5">Skills</h2>
                <div className="grid grid-cols-1 gap-5">
                  <div>
                    <label className={labelCls}>Primary Skills *</label>
                    <CreatableSelect
                      isMulti
                      options={skillOptions}
                      value={(primarySkills || []).map((s) => ({ value: s, label: s }))}
                      onChange={(opts: any) => setValue('primarySkills', (opts || []).map((o: any) => o.value), { shouldValidate: true })}
                      placeholder={skillOptions.length ? 'Select or type a skill…' : 'Type a skill and press Enter…'}
                      styles={reactSelectStyles}
                    />
                    {errors.primarySkills && <p className={errCls}>{errors.primarySkills.message as string}</p>}
                  </div>
                  <div>
                    <label className={labelCls}>Secondary Skills</label>
                    <CreatableSelect
                      isMulti
                      options={skillOptions}
                      value={(secondarySkills || []).map((s) => ({ value: s, label: s }))}
                      onChange={(opts: any) => setValue('secondarySkills', (opts || []).map((o: any) => o.value))}
                      placeholder="Optional"
                      styles={reactSelectStyles}
                    />
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-base font-bold text-gray-500 uppercase tracking-widest mb-5">Languages Known</h2>
                <div className="flex flex-wrap gap-2.5">
                  {LANGUAGE_OPTIONS.map((lang) => {
                    const checked = (languagesKnown || []).includes(lang);
                    return (
                      <label
                        key={lang}
                        className={`px-4 py-2 rounded-lg border text-sm font-medium cursor-pointer transition ${
                          checked ? 'border-lime-500 bg-lime-50 text-lime-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="hidden"
                          checked={checked}
                          onChange={() => {
                            const next = checked
                              ? (languagesKnown || []).filter((l) => l !== lang)
                              : [...(languagesKnown || []), lang];
                            setValue('languagesKnown', next, { shouldValidate: true });
                          }}
                        />
                        {lang}
                      </label>
                    );
                  })}
                </div>
                {errors.languagesKnown && <p className={errCls}>{errors.languagesKnown.message as string}</p>}
                <div className="mt-3 max-w-xs">
                  <label className={labelCls}>Other language</label>
                  <input type="text" {...register('otherLanguage')} className={inputCls} placeholder="e.g. Nepali" />
                </div>
              </section>

              <section>
                <h2 className="text-base font-bold text-gray-500 uppercase tracking-widest mb-5">Compensation</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {candidateType === 'Experienced' && (
                    <div>
                      <label className={labelCls}>Current Annual CTC (₹)</label>
                      <input type="number" {...register('current_ctc')} className={inputCls} placeholder="600000" />
                      {errors.current_ctc && <p className={errCls}>{errors.current_ctc.message}</p>}
                    </div>
                  )}
                  <div>
                    <label className={labelCls}>Expected Annual CTC (₹) *</label>
                    <input type="number" {...register('expected_annual_ctc')} className={inputCls} />
                    {errors.expected_annual_ctc && <p className={errCls}>{errors.expected_annual_ctc.message}</p>}
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* ══════════ STEP 4 — Availability & Preferences ══════════ */}
          {currentStep === 3 && (
            <section>
              <h2 className="text-base font-bold text-gray-500 uppercase tracking-widest mb-5">Availability &amp; Preferences</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {candidateType === 'Experienced' && (
                  <div>
                    <label className={labelCls}>Notice Period (days)</label>
                    <input type="number" {...register('notice_period')} className={inputCls} placeholder="30" />
                    {errors.notice_period && <p className={errCls}>{errors.notice_period.message}</p>}
                  </div>
                )}
                <div>
                  <label className={labelCls}>Expected Joining Date *</label>
                  <input type="date" {...register('expectedJoiningDate')} className={inputCls} />
                  {errors.expectedJoiningDate && <p className={errCls}>{errors.expectedJoiningDate.message}</p>}
                </div>
                {isRemoteEligible && (
                  <div>
                    <label className={labelCls}>Preferred Work Mode</label>
                    <select {...register('preferredWorkMode')} className={selectCls}>
                      <option value="">Select (optional)</option>
                      {WORK_MODE_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ══════════ STEP 5 — Resume & Screening ══════════ */}
          {currentStep === 4 && (
            <div className="space-y-8">
              <section>
                <h2 className="text-base font-bold text-gray-500 uppercase tracking-widest mb-5">
                  Social &amp; Media <span className="text-gray-400 normal-case font-normal tracking-normal">(Optional)</span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className={labelCls}>LinkedIn Profile</label>
                    <input type="url" {...register('linkedin')} className={inputCls} placeholder="https://linkedin.com/in/..." />
                    {errors.linkedin && <p className={errCls}>{errors.linkedin.message}</p>}
                  </div>
                  {isTechnicalOrDesign && (
                    <div>
                      <label className={labelCls}>GitHub / Portfolio</label>
                      <input type="url" {...register('githubPortfolio')} className={inputCls} placeholder="https://github.com/..." />
                      {errors.githubPortfolio && <p className={errCls}>{errors.githubPortfolio.message}</p>}
                    </div>
                  )}
                  {isClientFacing && (
                    <div className="md:col-span-2">
                      <label className={labelCls}>3-Minute Resume Video URL</label>
                      <input type="url" {...register('short_video_url')} className={inputCls} placeholder="https://youtube.com/..." />
                      {errors.short_video_url && <p className={errCls}>{errors.short_video_url.message}</p>}
                    </div>
                  )}
                </div>
              </section>

              <section>
                <h2 className="text-base font-bold text-gray-500 uppercase tracking-widest mb-5">Resume *</h2>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleResumeChange}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-5 file:rounded-lg file:border-0 file:font-semibold file:bg-lime-50 file:text-lime-700 hover:file:bg-lime-100 cursor-pointer"
                />
                {resumeFile && <p className="mt-2 text-xs text-green-600">✓ {resumeFile.name}</p>}
                {resumeError && <p className={errCls}>{resumeError}</p>}
              </section>

              {screeningQuestions.length > 0 && (
                <section>
                  <h2 className="text-base font-bold text-gray-500 uppercase tracking-widest mb-5">Screening Questions</h2>
                  <div className="space-y-5">
                    {screeningQuestions.map((q) => (
                      <div key={q._id}>
                        <label className={labelCls}>{q.text}{q.required ? ' *' : ''}</label>
                        {q.type === 'mcq' && (
                          <div className="flex flex-wrap gap-3 mt-1">
                            {q.options.map((opt) => (
                              <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer border border-gray-200 rounded-lg px-3 py-2">
                                <input
                                  type="radio"
                                  name={`screen-${q._id}`}
                                  checked={screeningAnswers[q._id] === opt}
                                  onChange={() => handleScreeningChange(q._id, opt)}
                                  className="accent-lime-600"
                                />
                                {opt}
                              </label>
                            ))}
                          </div>
                        )}
                        {q.type === 'yesno' && (
                          <div className="flex gap-6 mt-1">
                            {['Yes', 'No'].map((opt) => (
                              <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer">
                                <input
                                  type="radio"
                                  name={`screen-${q._id}`}
                                  checked={screeningAnswers[q._id] === opt}
                                  onChange={() => handleScreeningChange(q._id, opt)}
                                  className="accent-lime-600"
                                />
                                {opt}
                              </label>
                            ))}
                          </div>
                        )}
                        {(q.type === 'numeric' || q.type === 'experience') && (
                          <input
                            type="number"
                            min={q.minValue ?? undefined}
                            max={q.maxValue ?? undefined}
                            value={screeningAnswers[q._id] || ''}
                            onChange={(e) => handleScreeningChange(q._id, e.target.value)}
                            className={inputCls}
                          />
                        )}
                        {(q.type === 'text' || q.type === 'skill') && (
                          <input
                            type="text"
                            value={screeningAnswers[q._id] || ''}
                            onChange={(e) => handleScreeningChange(q._id, e.target.value)}
                            className={inputCls}
                          />
                        )}
                        {screeningErrors[q._id] && <p className={errCls}>{screeningErrors[q._id]}</p>}
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}

          {/* ══════════ STEP 6 — Review & Submit ══════════ */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <section>
                <h2 className="text-base font-bold text-gray-500 uppercase tracking-widest mb-4">Review Your Application</h2>
                <div className="bg-gray-50 border border-gray-200 rounded-xl divide-y divide-gray-200 text-sm">
                  {[
                    ['Applying as', watch('candidateType')],
                    ['Name', watch('full_name')],
                    ['Email', watch('email')],
                    ['Mobile', `${dialCode} ${watch('mobile')}`],
                    ['Location', [watch('city'), watch('state')].filter(Boolean).join(', ')],
                    ['Highest Qualification', watch('highest_qualification')],
                    ['Specialization', watch('educationSpecialization')],
                    ['Primary Skills', (primarySkills || []).join(', ')],
                    ['Expected CTC', watch('expected_annual_ctc') ? `₹${watch('expected_annual_ctc')}` : ''],
                    ['Expected Joining Date', watch('expectedJoiningDate')],
                    ['Resume', resumeFile?.name || 'Not attached'],
                  ].filter(([, v]) => v).map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-4 px-4 py-2.5">
                      <span className="text-gray-500 font-medium">{label}</span>
                      <span className="text-gray-800 font-semibold text-right">{value}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <label className="flex items-start gap-3 text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-xl p-4 cursor-pointer">
                  <input type="checkbox" {...register('consentGiven')} className="h-4 w-4 mt-0.5 accent-lime-600" />
                  <span>
                    I declare that the information provided in this application is true and accurate to the best of
                    my knowledge, and I consent to Brisk Olive processing this data for recruitment purposes. *
                  </span>
                </label>
                {errors.consentGiven && <p className={errCls}>{errors.consentGiven.message}</p>}
              </section>
            </div>
          )}

          {stepError && (
            <p className="text-red-500 text-sm mt-6 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{stepError}</p>
          )}

          {/* ── Step navigation ── */}
          <div className="pt-8 flex items-center gap-3">
            {currentStep > 0 && (
              <button
                type="button"
                onClick={goBack}
                className="px-6 py-3 border border-gray-300 text-gray-600 font-semibold rounded-xl hover:bg-gray-50 transition"
              >
                Back
              </button>
            )}
            <div className="flex-1" />
            {currentStep < STEP_TITLES.length - 1 ? (
              <button
                type="button"
                onClick={goNext}
                className="px-8 py-3 bg-lime-600 hover:bg-lime-700 text-white font-bold rounded-xl transition"
              >
                Continue
              </button>
            ) : (
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-8 py-3 bg-lime-600 hover:bg-lime-700 disabled:opacity-60 text-white font-bold rounded-xl transition flex items-center justify-center gap-3"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Submitting…
                  </>
                ) : 'Submit Application'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
