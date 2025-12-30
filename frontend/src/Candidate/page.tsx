'use client';

import { useEffect, useState, type ChangeEvent } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const formSchema = z.object({
  full_name: z.string().min(1, 'Full name is required'),
  email: z.string().email('Invalid email'),
  countries_code: z.string().min(1, 'Country code is required'),
  mobile: z.string().regex(/^\d{10}$/, 'Mobile number must be exactly 10 digits'),
  whatsapp_same: z.boolean().optional(),
  dob: z.string().min(1, 'Date of birth is required'),
  state: z.string().min(1, 'State is required'),
  city: z.string().min(1, 'City is required'),
  pin_code: z.string().length(6, 'Pin code must be 6 digits'),
  relocation: z.enum(['Yes', 'No']),
  designation: z.string().min(1, 'Profile is required'),
  highest_qualification: z.string().min(1, 'Qualifications are required'),
  experience: z.enum(['Yes', 'No']),
  total_experience: z.string().optional(),
  current_ctc: z.string().optional(),
  notice_period: z.string().optional(),
  expected_monthly_ctc: z.string().min(1, 'Expected CTC is required'),
  hindi_read: z.string().min(1),
  hindi_write: z.string().min(1),
  hindi_speak: z.string().min(1),
  english_read: z.string().min(1),
  english_write: z.string().min(1),
  english_speak: z.string().min(1),
  facebookLink: z.string().url().optional().or(z.literal('')),
  linkedin: z.string().url().optional().or(z.literal('')),
  short_video_url: z.string().url().optional().or(z.literal('')),
});

type FormData = z.infer<typeof formSchema>;

type Country = { id: number; code: string; name: string };
type State = { id: number; name: string };
type City = { id: number; name: string };

const designations = [
  "Executive Assistant",
  "Process Coordinator",
  "Driver",
  "Data Management Executive",
  "Mechanical Design Engineer",
  "Mechanical Design Intern",
  "Defence Director",
  "Head Operations",
  "Deputy Head",
  "Operations Manager",
  "Project Manager",
  "Manager HR",
  "Digital Marketing Manager",
  "Production Head",
  // Add all your designations here
];

export default function CandidateApplicationPage() {
  const [countries, setCountries] = useState<Country[]>([]);
  const [states, setStates] = useState<State[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [loadingStates, setLoadingStates] = useState(true);
  const [loadingCities, setLoadingCities] = useState(false);
  const [showExperience, setShowExperience] = useState(false);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);



  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      experience: 'No',
      relocation: 'Yes',
      whatsapp_same: false,
      countries_code: '+91', // ✅ ADD THIS
    },
  });


  const watchedState = watch('state');
  const experience = watch('experience');

  // Fetch countries for phone code
  useEffect(() => {
    fetch('https://hr-forms.onrender.com/api/countries/')
      .then((res) => res.json())
      .then((data: Country[]) => setCountries(data.sort((a, b) => a.name.localeCompare(b.name))))
      .catch((err) => console.error(err));
  }, []);

  // Fetch states
  useEffect(() => {
    setLoadingStates(true);
    fetch('https://hr-forms.onrender.com/api/states/')
      .then((res) => res.json())
      .then((data: State[]) => {
        setStates(data.sort((a, b) => a.name.localeCompare(b.name)));
        setLoadingStates(false);
      })
      .catch((err) => {
        console.error(err);
        setLoadingStates(false);
      });
  }, []);

  // Fetch cities when state changes
  useEffect(() => {
    if (!watchedState) {
      setCities([]);
      setValue('city', '');
      return;
    }
    setLoadingCities(true);
    fetch(`https://hr-forms.onrender.com/api/cities/?state=${watchedState}`)
      .then((res) => res.json())
      .then((data: City[]) => {
        setCities(data.sort((a, b) => a.name.localeCompare(b.name)));
        setLoadingCities(false);
      })
      .catch((err) => {
        console.error(err);
        setLoadingCities(false);
      });
  }, [watchedState, setValue]);

  useEffect(() => {
    setShowExperience(experience === 'Yes');
  }, [experience]);


  const onSubmit = async (data: FormData) => {
    console.log("Form data:", data);

    setIsSubmitting(true);

    try {
      const payload = {
        full_name: data.full_name,
        email: data.email,
        phone: data.countries_code + data.mobile,
        whatsapp_same: data.whatsapp_same || false,
        dob: data.dob,
        state: data.state,  // This is ID from dropdown
        city: data.city,    // This is ID from dropdown
        pin_code: data.pin_code,
        relocation: data.relocation,
        designation: data.designation,
        highest_qualification: data.highest_qualification,
        experience: data.experience,
        total_experience: data.total_experience || "",
        current_ctc: data.current_ctc || "",
        notice_period: data.notice_period || "",
        expected_monthly_ctc: data.expected_monthly_ctc,
        hindi_read: data.hindi_read,
        hindi_write: data.hindi_write,
        hindi_speak: data.hindi_speak,
        english_read: data.english_read,
        english_write: data.english_write,
        english_speak: data.english_speak,
        facebookLink: data.facebookLink || "",
        linkedin: data.linkedin || "",
        short_video_url: data.short_video_url || "",
      };

      console.log("Sending payload:", payload);

      const response = await fetch('https://hr-forms.onrender.com/api/candidate-applications/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const result = await response.json();
        console.log("SUCCESS! Data saved:", result);
        alert("Application submitted successfully! 🎉 Thank you!");
        // Optional: reset form or redirect
      } else {
        const error = await response.text();
        console.error("Error from backend:", error);
        alert("Submission failed: " + error);
      }
    } catch (err) {
      console.error("Network error:", err);
      alert("Network error. Is the Django server running?");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    setResumeFile(e.target.files?.[0] || null);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-2xl shadow-2xl">
      <h2 className="text-4xl font-bold text-center text-lime-600 mb-10">Candidate Application Form</h2>

      <form onSubmit={handleSubmit(onSubmit, (errors) => { console.log(' FORM ERRORS:', errors); alert('Form has errors. Check console 👀'); })} className="space-y-8" >
        {/* Full Name */}
        <div>
          <label className="block text-lg font-medium text-gray-800 mb-2">Full Name</label>
          <input
            type="text"
            {...register('full_name')}
            className="w-full px-5 py-3 border border-gray-300 rounded-lg focus:ring-4 focus:ring-lime-200 focus:border-lime-500"
            placeholder="Enter your full name"
          />
          {errors.full_name && <p className="text-red-500 text-sm mt-1">{errors.full_name.message}</p>}
        </div>

        {/* Email */}
        <div>
          <label className="block text-lg font-medium text-gray-800 mb-2">Email</label>
          <input
            type="email"
            {...register('email')}
            className="w-full px-5 py-3 border border-gray-300 rounded-lg focus:ring-4 focus:ring-lime-200 focus:border-lime-500"
            placeholder="your.email@example.com"
          />
          {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>}
        </div>

        {/* Mobile */}
        <div>
          <label className="block text-lg font-medium text-gray-800 mb-2">Mobile Number</label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <select
              {...register('countries_code')}
              className="px-5 py-3 border border-gray-300 rounded-lg focus:ring-4 focus:ring-lime-200 focus:border-lime-500"
            >
              <option value="">Select Code</option>
              {countries.map((c) => (
                <option key={c.id} value={c.code}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
            <input
              type="tel"
              {...register('mobile')}
              className="md:col-span-2 px-5 py-3 border border-gray-300 rounded-lg focus:ring-4 focus:ring-lime-200 focus:border-lime-500"
              placeholder="9876543210"
            />
          </div>
          <div className="mt-4 flex items-center">
            <input type="checkbox" {...register('whatsapp_same')} className="mr-3 h-5 w-5" />
            <label className="text-gray-700">Same number for WhatsApp?</label>
          </div>
        </div>

        {/* DOB */}
        <div>
          <label className="block text-lg font-medium text-gray-800 mb-2">Date of Birth</label>
          <input
            type="date"
            {...register('dob')}
            className="w-full px-5 py-3 border border-gray-300 rounded-lg focus:ring-4 focus:ring-lime-200 focus:border-lime-500"
          />
        </div>

        {/* Location */}
        <div>
          <label className="block text-lg font-medium text-gray-800 mb-4">Location</label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">State</label>
              <select
                {...register('state')}
                className="w-full px-5 py-3 border border-gray-300 rounded-lg focus:ring-4 focus:ring-lime-200 focus:border-lime-500"
                onChange={(e) => {
                  setValue('state', e.target.value);
                  setValue('city', '');
                }}
              >
                <option value="" disabled>{loadingStates ? 'Loading...' : 'Select State'}</option>
                {states.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
              <select
                {...register('city')}
                className="w-full px-5 py-3 border border-gray-300 rounded-lg focus:ring-4 focus:ring-lime-200 focus:border-lime-500"
                disabled={!watchedState || loadingCities}
              >
                <option value="" disabled>{loadingCities ? 'Loading...' : 'Select City'}</option>
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Pin Code */}
        <div>
          <label className="block text-lg font-medium text-gray-800 mb-2">Pin Code</label>
          <input
            type="text"
            {...register('pin_code')}
            className="w-full px-5 py-3 border border-gray-300 rounded-lg focus:ring-4 focus:ring-lime-200 focus:border-lime-500"
            placeholder="110001"
          />
        </div>

        {/* Relocation */}
        <div>
          <p className="text-lg font-medium text-gray-800 mb-4">
            Are you open to relocating to Noida Sector 63?
          </p>
          <div className="flex gap-10">
            <label className="flex items-center">
              <input type="radio" value="Yes" {...register('relocation')} className="mr-3" />
              <span className="text-gray-700">Yes</span>
            </label>
            <label className="flex items-center">
              <input type="radio" value="No" {...register('relocation')} className="mr-3" />
              <span className="text-gray-700">No</span>
            </label>
          </div>
        </div>

        {/* Designation */}
        <div>
          <label className="block text-lg font-medium text-gray-800 mb-2">Profile Applying For</label>
          <select
            {...register('designation')}
            className="w-full px-5 py-3 border border-gray-300 rounded-lg focus:ring-4 focus:ring-lime-200 focus:border-lime-500"
          >
            <option value="" disabled>Select Designation</option>
            {designations.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        {/* Highest Qualification */}
        <div>
          <label className="block text-lg font-medium text-gray-800 mb-2">
            Highest Qualification <span className="text-red-500">*</span>
          </label>

          <input
            type="text"
            {...register('highest_qualification')}
            className="w-full px-5 py-3 border border-gray-300 rounded-lg focus:ring-4 focus:ring-lime-200 focus:border-lime-500"
            placeholder="e.g. B.Tech, MBA, Diploma, 12th"
          />

          {errors.highest_qualification && (
            <p className="text-red-500 text-sm mt-1">
              {errors.highest_qualification.message}
            </p>
          )}
        </div>



        {/* Experience */}
        <div>
          <p className="text-lg font-medium text-gray-800 mb-4">Do you have previous work experience?</p>
          <div className="flex gap-10">
            <label className="flex items-center">
              <input type="radio" value="Yes" {...register('experience')} className="mr-3" />
              <span>Yes</span>
            </label>
            <label className="flex items-center">
              <input type="radio" value="No" {...register('experience')} className="mr-3" />
              <span>No</span>
            </label>
          </div>
        </div>

        {showExperience && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 bg-lime-50 rounded-xl">
            <div>
              <label className="block text-sm font-medium mb-2">Total Experience (years)</label>
              <input type="number" {...register('total_experience')} className="w-full px-5 py-3 border rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Current CTC (₹)</label>
              <input type="text" {...register('current_ctc')} className="w-full px-5 py-3 border rounded-lg" placeholder="6,00,000" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Notice Period (days)</label>
              <input type="number" {...register('notice_period')} className="w-full px-5 py-3 border rounded-lg" />
            </div>
          </div>
        )}

        {/* Expected CTC */}
        <div>
          <label className="block text-lg font-medium text-gray-800 mb-2">Expected Annual CTC (₹)</label>
          <input
            type="text"
            {...register('expected_monthly_ctc')}
            className="w-full px-5 py-3 border border-gray-300 rounded-lg focus:ring-4 focus:ring-lime-200 focus:border-lime-500"
            placeholder="8,00,000"
          />
        </div>

        {/* Language Proficiency */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <div>
            <h3 className="text-2xl font-bold text-gray-800 mb-6">Hindi Proficiency</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Read</label>
                <select {...register('hindi_read')} className="w-full px-5 py-3 border rounded-lg">
                  <option value="">Select</option>
                  <option>Beginner</option>
                  <option>Intermediate</option>
                  <option>Professional</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Write</label>
                <select {...register('hindi_write')} className="w-full px-5 py-3 border rounded-lg">
                  <option value="">Select</option>
                  <option>Beginner</option>
                  <option>Intermediate</option>
                  <option>Professional</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Speak</label>
                <select {...register('hindi_speak')} className="w-full px-5 py-3 border rounded-lg">
                  <option value="">Select</option>
                  <option>Beginner</option>
                  <option>Intermediate</option>
                  <option>Professional</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-2xl font-bold text-gray-800 mb-6">English Proficiency</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Read</label>
                <select {...register('english_read')} className="w-full px-5 py-3 border rounded-lg">
                  <option value="">Select</option>
                  <option>Beginner</option>
                  <option>Intermediate</option>
                  <option>Professional</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Write</label>
                <select {...register('english_write')} className="w-full px-5 py-3 border rounded-lg">
                  <option value="">Select</option>
                  <option>Beginner</option>
                  <option>Intermediate</option>
                  <option>Professional</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Speak</label>
                <select {...register('english_speak')} className="w-full px-5 py-3 border rounded-lg">
                  <option value="">Select</option>
                  <option>Beginner</option>
                  <option>Intermediate</option>
                  <option>Professional</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Social Links */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-lg font-medium text-gray-800 mb-2">Facebook Profile (Optional)</label>
            <input
              type="url"
              {...register('facebookLink')}
              className="w-full px-5 py-3 border border-gray-300 rounded-lg"
              placeholder="https://facebook.com/..."
            />
          </div>
          <div>
            <label className="block text-lg font-medium text-gray-800 mb-2">LinkedIn Profile (Optional)</label>
            <input
              type="url"
              {...register('linkedin')}
              className="w-full px-5 py-3 border border-gray-300 rounded-lg"
              placeholder="https://linkedin.com/in/..."
            />
          </div>
        </div>

        {/* Resume Upload */}
        <div>
          <label className="block text-lg font-medium text-gray-800 mb-2">Upload Resume (PDF only)</label>
          <input
            type="file"
            accept=".pdf"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-600 file:mr-4 file:py-3 file:px-6 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-lime-50 file:text-lime-700 hover:file:bg-lime-100"
          />
          {resumeFile && <p className="mt-2 text-green-600">Selected: {resumeFile.name}</p>}
        </div>

        {/* Video URL */}
        <div>
          <label className="block text-lg font-medium text-gray-800 mb-2">3-Minute Resume Video URL (Optional)</label>
          <input
            type="url"
            {...register('short_video_url')}
            className="w-full px-5 py-3 border border-gray-300 rounded-lg"
            placeholder="https://youtube.com/..."
          />
        </div>

        {/* Submit */}
        {/* Submit Button with Spinner Loader */}
        <div className="text-center pt-8">
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-16 py-5 bg-lime-600 text-white text-2xl font-bold rounded-xl hover:bg-lime-700 disabled:opacity-70 disabled:cursor-not-allowed transition flex items-center justify-center gap-4 mx-auto min-w-64"
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin h-8 w-8 text-white" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Submitting...</span>
              </>
            ) : (
              'Submit Application'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}