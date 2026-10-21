// components/training/EmailRecipientField.tsx
// ─────────────────────────────────────────────────────────────────────────────
// A free-text, comma-separated email field (still fully editable by hand)
// plus a "+ Add" dropdown of current employees — picking one appends their
// real official/personal email (not an employee_id) to the field. Used for
// every training mail's To/CC inputs so HR doesn't have to remember or type
// addresses by hand, but nothing is ever locked to only-dropdown-selected
// people.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import axios from 'axios';
import { getRole } from '../../config/rbac';

const API_BASE = process.env.REACT_APP_REACT_APP_API_BASE_URL;
const api = axios.create({ baseURL: API_BASE });
api.interceptors.request.use((config) => {
  const role = getRole();
  if (role) config.headers['x-user-role'] = role;
  return config;
});

type PickableEmployee = { name: string; email: string; dept: string };

// Module-level cache — every field on the page shares one fetch instead of
// each To/CC input re-requesting the full employee list.
let cachedEmployees: PickableEmployee[] | null = null;
let inflightFetch: Promise<PickableEmployee[]> | null = null;

async function loadEmployeesOnce(): Promise<PickableEmployee[]> {
  if (cachedEmployees) return cachedEmployees;
  if (!inflightFetch) {
    inflightFetch = api.get('/onboarding/employee-master').then((res) => {
      const current = (res.data?.data?.employees || []).filter((e: any) => e.is_current && e.email);
      cachedEmployees = current.map((e: any) => ({
        name: e.full_name || '',
        email: e.email,
        dept: e.department || '',
      }));
      return cachedEmployees!;
    }).catch(() => {
      cachedEmployees = [];
      return cachedEmployees;
    });
  }
  return inflightFetch;
}

export default function EmailRecipientField({
  label, value, onChange, placeholder, required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  const [employees, setEmployees] = useState<PickableEmployee[]>([]);

  useEffect(() => {
    loadEmployeesOnce().then(setEmployees);
  }, []);

  const addEmail = (email: string) => {
    if (!email) return;
    const existing = value.split(',').map((s) => s.trim()).filter(Boolean);
    if (existing.some((e) => e.toLowerCase() === email.toLowerCase())) return;
    onChange([...existing, email].join(', '));
  };

  return (
    <div>
      <label className="block text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1">
        {label}{required ? ' *' : ''}
      </label>
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || 'comma-separated email addresses'}
          className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value=""
          onChange={(e) => addEmail(e.target.value)}
          className="border border-gray-300 rounded-md px-2 py-2 text-xs text-gray-500 max-w-[9rem] focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">+ Add person…</option>
          {employees.map((e) => (
            <option key={e.email} value={e.email}>{e.name}{e.dept ? ` — ${e.dept}` : ''}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
