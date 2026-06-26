'use client';

import { useEffect, useState, type ChangeEvent } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSearchParams, Link } from 'react-router-dom';
import Select from 'react-select';
import * as z from 'zod';

console.log("API_BASE =", process.env.REACT_APP_REACT_APP_API_BASE_URL);
const API_BASE = process.env.REACT_APP_REACT_APP_API_BASE_URL || 'http://localhost:5000/api';

// ── Schema ────────────────────────────────────────────────────────────────────
const formSchema = z.object({
  full_name:             z.string().min(1, 'Full name is required'),
  email:                 z.string().email('Invalid email'),
  dial_code:             z.string().min(1, 'Country code is required'),
  mobile:                z.string().regex(/^\d{10}$/, 'Must be exactly 10 digits'),
  whatsapp_same:         z.boolean().optional(),
  dob:                   z.string().min(1, 'Date of birth is required'),

  country:               z.string().min(1, 'Country is required'),
  state:                 z.string().min(1, 'State is required'),
  city:                  z.string().min(1, 'City is required'),
  pin_code:              z.string().length(6, 'Must be 6 digits'),
  relocation:            z.enum(['Yes', 'No']),

  // No longer user-selected — comes from the job posting URL params
  job_id:                 z.union([z.string(), z.number()]).optional(),
  designation:             z.string().min(1, 'No role selected — please apply from the careers page'),
  designation_id:          z.number().optional(),

  highest_qualification: z.string().min(1, 'Required'),
  experience:            z.enum(['Yes', 'No']),
  total_experience:      z.string().optional(),
  current_ctc:           z.string().optional(),
  notice_period:         z.string().optional(),
  expected_monthly_ctc:  z.string().min(1, 'Required'),

  hindi_read:    z.string().min(1, 'Required'),
  hindi_write:   z.string().min(1, 'Required'),
  hindi_speak:   z.string().min(1, 'Required'),
  english_read:  z.string().min(1, 'Required'),
  english_write: z.string().min(1, 'Required'),
  english_speak: z.string().min(1, 'Required'),

  facebookLink:    z.string().url().optional().or(z.literal('')),
  linkedin:        z.string().url().optional().or(z.literal('')),
  short_video_url: z.string().url().optional().or(z.literal('')),
});

type FormData = z.infer<typeof formSchema>;

// ── Types ─────────────────────────────────────────────────────────────────────
type Country = { name: string; dialCode: string };
type GeoItem = { name: string };

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
};

const PROFICIENCY = ['Beginner', 'Intermediate', 'Professional'];

// ── Component ─────────────────────────────────────────────────────────────────
export default function CandidateApplicationPage() {
  const [searchParams] = useSearchParams();
  const jobIdParam       = searchParams.get('job_id');
  const designationParam = searchParams.get('designation');

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted,    setSubmitted]    = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      experience:    'No',
      relocation:    'Yes',
      whatsapp_same: false,
      dial_code:     '+91',
      country:       'India',
    },
  });

  const watchedState = watch('state');
  const experience   = watch('experience');

  // ── Load job details from job_id in URL ──────────────────────────────────────
  // This replaces the old "pick a profile from dropdown" flow entirely —
  // the candidate already chose a job by clicking it on the careers page.
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
          // Fallback: job no longer 'Open' (filled/closed) but we still have
          // the designation passed from the click — let candidate proceed,
          // but flag that this role may no longer be active.
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
        // Network failure — fall back to URL params alone if present
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

  // ── Countries ───────────────────────────────────────────────────────────────
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

  // ── States ──────────────────────────────────────────────────────────────────
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

  // ── Cities (on state change) ─────────────────────────────────────────────────
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

  // ── Country code options for react-select ────────────────────────────────────
  const countryOptions = countries.map((c) => ({
    value: c.dialCode,
    label: `${c.dialCode} ${c.name}`,
  }));

  // ── Submit ───────────────────────────────────────────────────────────────────
  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      const payload = {
        full_name:             data.full_name,
        email:                 data.email,
        phone:                 dialCode + data.mobile,
        whatsapp_same:         data.whatsapp_same || false,
        dob:                   data.dob,
        country:               data.country,
        state:                 data.state,
        city:                  data.city,
        pin_code:              data.pin_code,
        relocation:            data.relocation,
        job_id:                 data.job_id,
        designation:             data.designation,
        designation_id:          data.designation_id,
        highest_qualification: data.highest_qualification,
        experience:            data.experience,
        total_experience:      data.total_experience  || '',
        current_ctc:           data.current_ctc       || '',
        notice_period:         data.notice_period     || '',
        expected_monthly_ctc:  data.expected_monthly_ctc,
        hindi_read:            data.hindi_read,
        hindi_write:           data.hindi_write,
        hindi_speak:           data.hindi_speak,
        english_read:          data.english_read,
        english_write:         data.english_write,
        english_speak:         data.english_speak,
        facebookLink:          data.facebookLink      || '',
        linkedin:              data.linkedin          || '',
        short_video_url:       data.short_video_url   || '',
      };

      const res = await fetch(`${API_BASE}/candidate-applications`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });

      if (res.ok) {
        setSubmitted(true);
      } else {
        const err = await res.text();
        alert('Submission failed: ' + err);
      }
    } catch {
      alert('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Styles ───────────────────────────────────────────────────────────────────
  const inputCls  = 'w-full px-4 py-3 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-lime-400 focus:border-lime-500 text-sm transition';
  const selectCls = inputCls;
  const errCls    = 'text-red-500 text-xs mt-1';
  const labelCls  = 'block text-sm font-semibold text-gray-700 mb-1.5';

  // ── react-select shared styles ───────────────────────────────────────────────
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

  // ── Success screen ───────────────────────────────────────────────────────────
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

  // ── No job selected at all — block the form entirely ────────────────────────
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

        {/* Header */}
        <div className="bg-lime-600 px-8 py-6">
          <h1 className="text-2xl font-bold text-white">Candidate Application</h1>
          <p className="text-lime-100 text-sm mt-1">Fill in your details to apply. All fields marked * are required.</p>
        </div>

        {/* Job context banner — replaces the old profile dropdown */}
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

        <form
          onSubmit={handleSubmit(onSubmit, (e) => console.log('ERRORS', e))}
          className="px-8 py-8 space-y-8"
        >

          {/* Hidden job context fields — locked, not user-editable */}
          <input type="hidden" {...register('job_id')} />
          <input type="hidden" {...register('designation')} />
          {errors.designation && <p className={errCls}>{errors.designation.message}</p>}

          {/* ── Personal Info ── */}
          <section>
            <h2 className="text-base font-bold text-gray-500 uppercase tracking-widest mb-5">Personal Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

              <div className="md:col-span-2">
                <label className={labelCls}>Full Name *</label>
                <input type="text" {...register('full_name')} className={inputCls} placeholder="Rahul Sharma" />
                {errors.full_name && <p className={errCls}>{errors.full_name.message}</p>}
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

              {/* Mobile */}
              <div className="md:col-span-2">
                <label className={labelCls}>Mobile Number *</label>
                <div className="flex gap-3 items-start">

                  {/* Searchable country code */}
                  <div className="w-44 shrink-0">
                    <Select
                      options={countryOptions}
                      isLoading={loadingCountries}
                      defaultValue={{ value: '+91', label: '+91 India' }}
                      onChange={(opt) => {
                        setDialCode(opt?.value || '+91');
                        setValue('dial_code', opt?.value || '+91');
                      }}
                      isSearchable
                      placeholder="Code"
                      styles={reactSelectStyles}
                    />
                  </div>

                  {/* Phone number */}
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
              </div>

            </div>
          </section>

          {/* ── Location ── */}
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
                <label className={labelCls}>Open to relocate to Noida? *</label>
                <div className="flex gap-6 mt-2">
                  {(['Yes', 'No'] as const).map((v) => (
                    <label key={v} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="radio" value={v} {...register('relocation')} className="accent-lime-600" />
                      {v}
                    </label>
                  ))}
                </div>
              </div>

            </div>
          </section>

          {/* ── Professional ── */}
          <section>
            <h2 className="text-base font-bold text-gray-500 uppercase tracking-widest mb-5">Professional Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

              <div className="md:col-span-2">
                <label className={labelCls}>Highest Qualification *</label>
                <input type="text" {...register('highest_qualification')} className={inputCls} placeholder="e.g. B.Tech, MBA, 12th" />
                {errors.highest_qualification && <p className={errCls}>{errors.highest_qualification.message}</p>}
              </div>

              {/* Experience toggle */}
              <div className="md:col-span-2">
                <label className={labelCls}>Previous Work Experience? *</label>
                <div className="flex gap-6 mt-2">
                  {(['Yes', 'No'] as const).map((v) => (
                    <label key={v} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="radio" value={v} {...register('experience')} className="accent-lime-600" />
                      {v}
                    </label>
                  ))}
                </div>
              </div>

              {experience === 'Yes' && (
                <>
                  <div>
                    <label className={labelCls}>Total Experience (years)</label>
                    <input type="number" {...register('total_experience')} className={inputCls} placeholder="3" />
                  </div>
                  <div>
                    <label className={labelCls}>Current CTC (₹)</label>
                    <input type="text" {...register('current_ctc')} className={inputCls} placeholder="6,00,000" />
                  </div>
                  <div>
                    <label className={labelCls}>Notice Period (days)</label>
                    <input type="number" {...register('notice_period')} className={inputCls} placeholder="30" />
                  </div>
                </>
              )}

              <div>
                <label className={labelCls}>Expected Annual CTC </label>
                <input type="text" {...register('expected_monthly_ctc')} className={inputCls}  />
                {errors.expected_monthly_ctc && <p className={errCls}>{errors.expected_monthly_ctc.message}</p>}
              </div>

            </div>
          </section>

          {/* ── Language Proficiency ── */}
          <section>
            <h2 className="text-base font-bold text-gray-500 uppercase tracking-widest mb-5">Language Proficiency</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {([
                { lang: 'hindi',   label: 'Hindi'   },
                { lang: 'english', label: 'English' },
              ] as const).map(({ lang, label }) => (
                <div key={lang}>
                  <p className="font-semibold text-gray-700 mb-3">{label}</p>
                  <div className="grid grid-cols-3 gap-3">
                    {(['read', 'write', 'speak'] as const).map((skill) => {
                      const field = `${lang}_${skill}` as keyof FormData;
                      return (
                        <div key={skill}>
                          <label className="block text-xs text-gray-500 mb-1 capitalize">{skill}</label>
                          <select {...register(field)} className={selectCls}>
                            <option value="">Select</option>
                            {PROFICIENCY.map((p) => <option key={p}>{p}</option>)}
                          </select>
                          {errors[field] && <p className={errCls}>Required</p>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── Optional Links ── */}
          <section>
            <h2 className="text-base font-bold text-gray-500 uppercase tracking-widest mb-5">
              Social & Media <span className="text-gray-400 normal-case font-normal tracking-normal">(Optional)</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className={labelCls}>Facebook Profile</label>
                <input type="url" {...register('facebookLink')} className={inputCls} placeholder="https://facebook.com/..." />
              </div>
              <div>
                <label className={labelCls}>LinkedIn Profile</label>
                <input type="url" {...register('linkedin')} className={inputCls} placeholder="https://linkedin.com/in/..." />
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>3-Minute Resume Video URL</label>
                <input type="url" {...register('short_video_url')} className={inputCls} placeholder="https://youtube.com/..." />
              </div>
            </div>
          </section>

          {/* ── Resume Upload ── */}
          <section>
            <h2 className="text-base font-bold text-gray-500 uppercase tracking-widest mb-5">Resume</h2>
            <input
              type="file"
              accept=".pdf"
              onChange={(e: ChangeEvent<HTMLInputElement>) => setResumeFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-5 file:rounded-lg file:border-0 file:font-semibold file:bg-lime-50 file:text-lime-700 hover:file:bg-lime-100 cursor-pointer"
            />
            {resumeFile && <p className="mt-2 text-xs text-green-600">✓ {resumeFile.name}</p>}
          </section>

          {/* ── Submit ── */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 bg-lime-600 hover:bg-lime-700 disabled:opacity-60 text-white font-bold text-lg rounded-xl transition flex items-center justify-center gap-3"
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
          </div>
        </form>
      </div>
    </div>
  );
}
