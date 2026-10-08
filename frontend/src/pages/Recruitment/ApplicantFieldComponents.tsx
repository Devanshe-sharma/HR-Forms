// pages/Recruitment/ApplicantFieldComponents.tsx
import React from 'react';

// Shared label/placeholder styling for every candidate-management field —
// labels a touch darker than before (text-gray-400 read as washed-out),
// placeholders explicitly light grey (previously unstyled, so some
// browsers rendered typed-placeholder text as plain black).
export const FIELD_LABEL_CLASS = 'text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block';
export const FIELD_PLACEHOLDER_CLASS = 'placeholder:text-gray-400 placeholder:font-normal';

export const Field = ({ label, value }: { label: string; value?: string | boolean }) => (
  <div>
    <p className={FIELD_LABEL_CLASS}>{label}</p>
    <p className="text-sm text-gray-800 font-medium">
      {value === true ? 'Yes' : value === false ? 'No' : value || '—'}
    </p>
  </div>
);

export const EditField = ({
  label, name, value, onChange, type = 'text', inputClassName = '', placeholder,
}: {
  label: string; name: string; value: string;
  onChange: (n: string, v: string) => void; type?: string; inputClassName?: string; placeholder?: string;
}) => (
  <div>
    <label className={FIELD_LABEL_CLASS}>{label}</label>
    <input
      type={type}
      value={value || ''}
      onChange={(e) => onChange(name, e.target.value)}
      placeholder={placeholder}
      className={`w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400 ${FIELD_PLACEHOLDER_CLASS} ${inputClassName}`}
    />
  </div>
);

export const EditSelect = ({
  label, name, value, options, onChange, placeholder,
}: {
  label: string; name: string; value: string;
  options: string[]; onChange: (n: string, v: string) => void;
  // When set, shows an unselected placeholder option instead of silently
  // defaulting to whatever `options[0]` happens to be.
  placeholder?: string;
}) => (
  <div>
    <label className={FIELD_LABEL_CLASS}>{label}</label>
    <select
      value={value || ''}
      onChange={(e) => onChange(name, e.target.value)}
      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400"
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => <option key={o}>{o}</option>)}
    </select>
  </div>
);