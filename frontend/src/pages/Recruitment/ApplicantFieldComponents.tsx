// pages/Recruitment/ApplicantFieldComponents.tsx
import React from 'react';

export const Field = ({ label, value }: { label: string; value?: string | boolean }) => (
  <div>
    <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-0.5">{label}</p>
    <p className="text-sm text-gray-800 font-medium">
      {value === true ? 'Yes' : value === false ? 'No' : value || '—'}
    </p>
  </div>
);

export const EditField = ({
  label, name, value, onChange, type = 'text',
}: {
  label: string; name: string; value: string;
  onChange: (n: string, v: string) => void; type?: string;
}) => (
  <div>
    <label className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-0.5 block">{label}</label>
    <input
      type={type}
      value={value || ''}
      onChange={(e) => onChange(name, e.target.value)}
      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400"
    />
  </div>
);

export const EditSelect = ({
  label, name, value, options, onChange,
}: {
  label: string; name: string; value: string;
  options: string[]; onChange: (n: string, v: string) => void;
}) => (
  <div>
    <label className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-0.5 block">{label}</label>
    <select
      value={value || ''}
      onChange={(e) => onChange(name, e.target.value)}
      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400"
    >
      {options.map((o) => <option key={o}>{o}</option>)}
    </select>
  </div>
);