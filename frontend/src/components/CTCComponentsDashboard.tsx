'use client';

import React, { useState, useEffect } from 'react';
import { Edit2, Trash2, Save, X, Loader2 } from 'lucide-react';

interface CTCComponentType {
  _id?: string;
  name: string;
  code: string;
  formula: string;
  order: number;
  is_active: boolean;
  show_in_documents: boolean;
}

const CTCComponentsDashboard: React.FC = () => {
  const [components, setComponents] = useState<CTCComponentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<CTCComponentType>({
    name: '',
    code: '',
    formula: '0',
    order: 0,
    is_active: true,
    show_in_documents: true,
  });

  // Use fallback URL – replace with your real backend URL
  // For production: use NEXT_PUBLIC_API_BASE in .env
  const API_URL = 'http://localhost:5000/api/ctc-components/';

  // Fetch all components
  const fetchComponents = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(API_URL);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `HTTP error ${res.status}`);
      }
      const data = await res.json();

      // Safety: ensure data is an array
      if (!Array.isArray(data)) {
        throw new Error('Invalid response format from server (expected array)');
      }

      setComponents(data.sort((a: CTCComponentType, b: CTCComponentType) => a.order - b.order));
    } catch (err: any) {
      setError(err.message || 'Failed to load CTC components. Is backend running?');
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComponents();
  }, []);

  // Reset form
  const resetForm = () => {
    setEditingId(null);
    setFormData({
      name: '',
      code: '',
      formula: '0',
      order: components.length + 1,
      is_active: true,
      show_in_documents: true,
    });
  };

  // Start editing
  const startEdit = (comp: CTCComponentType) => {
    if (!comp._id) return;
    setEditingId(comp._id);
    setFormData(comp);
  };

  // Cancel
  const cancelEdit = () => {
    resetForm();
  };

  // Save
  const saveComponent = async () => {
    if (saving) return;
    if (!formData.name.trim() || !formData.code.trim()) {
      setError('Name and Code are required');
      return;
    }

    if (!editingId && components.some(c => c.code.toUpperCase() === formData.code.toUpperCase())) {
      setError('This code already exists. Choose a unique code.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const isNew = !editingId;
      const method = isNew ? 'POST' : 'PATCH';
      const url = isNew ? API_URL : `${API_URL}${editingId}/`;

      const payload = {
        ...formData,
        code: formData.code.toUpperCase().trim(),
        order: formData.order || components.length + 1,
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `Failed to ${isNew ? 'create' : 'update'}`);
      }

      const saved = await res.json();

      if (isNew) {
        setComponents([...components, saved].sort((a, b) => a.order - b.order));
      } else {
        setComponents(components.map(c => (c._id === editingId ? saved : c)));
      }

      resetForm();
      alert('Component saved!');
    } catch (err: any) {
      setError(err.message || 'Error saving component');
    } finally {
      setSaving(false);
    }
  };

  // Delete
  const deleteComponent = async (id: string) => {
    if (!window.confirm('Delete permanently?')) return;

    try {
      const res = await fetch(`${API_URL}${id}/`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');

      setComponents(components.filter(c => c._id !== id));
      alert('Deleted');
    } catch (err: any) {
      setError(err.message || 'Error deleting');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-teal-600" />
          <p className="mt-4 text-gray-600">Loading components...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-800">CTC Components Dashboard</h1>
            <p className="text-gray-600 mt-2">
              Manage salary components for letters, revisions & payslips
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Form */}
        <div className="bg-white rounded-xl shadow p-6 md:p-8 mb-10">
          <h2 className="text-2xl font-semibold mb-6">
            {editingId ? 'Edit Component' : 'Add New Component'}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-teal-500"
                placeholder="e.g. Internet Allowance"
              />
            </div>

            {/* Code */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Code (Unique) *</label>
              <input
                type="text"
                value={formData.code}
                onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-teal-500"
                placeholder="e.g. INTERNET"
              />
              <p className="text-xs text-gray-500 mt-1">Uppercase, no spaces</p>
            </div>

            {/* Formula */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Formula</label>
              <input
                type="text"
                value={formData.formula}
                onChange={e => setFormData({ ...formData, formula: e.target.value })}
                className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-teal-500"
                placeholder="e.g. BASIC * 0.4 or IF(GROSS < 21000, 1000, 0)"
              />
            </div>

            {/* Order */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Order</label>
              <input
                type="number"
                value={formData.order}
                onChange={e => setFormData({ ...formData, order: Number(e.target.value) || 0 })}
                className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-teal-500"
                min="0"
              />
            </div>

            {/* Checkboxes */}
            <div className="flex flex-col gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                  className="h-5 w-5 text-teal-600 rounded"
                />
                <span className="text-sm font-medium">Active</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.show_in_documents}
                  onChange={e => setFormData({ ...formData, show_in_documents: e.target.checked })}
                  className="h-5 w-5 text-teal-600 rounded"
                />
                <span className="text-sm font-medium">Show in Documents</span>
              </label>
            </div>

            {/* Buttons */}
            <div className="flex items-end gap-3">
              <button
                onClick={saveComponent}
                disabled={saving}
                className={`px-6 py-3 rounded-lg text-white font-medium flex items-center gap-2 transition ${
                  saving ? 'bg-teal-400 cursor-not-allowed' : 'bg-teal-600 hover:bg-teal-700'
                }`}
              >
                {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save size={18} />}
                {saving ? 'Saving...' : editingId ? 'Update' : 'Add'}
              </button>

              {editingId && (
                <button
                  onClick={cancelEdit}
                  className="px-6 py-3 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 flex items-center gap-2"
                >
                  <X size={18} /> Cancel
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <div className="p-6 border-b">
            <h2 className="text-2xl font-semibold">
              All CTC Components ({components.length})
            </h2>
          </div>

          {components.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              No components yet. Add one above.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Order</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Name</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Code</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Formula</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Status</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Docs</th>
                    <th className="px-6 py-4 text-center text-sm font-medium text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {components.map(comp => (
                    <tr key={comp._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm">{comp.order}</td>
                      <td className="px-6 py-4 font-medium">{comp.name}</td>
                      <td className="px-6 py-4 text-sm font-mono">{comp.code}</td>
                      <td className="px-6 py-4 text-sm font-mono text-gray-600 truncate max-w-xs">
                        {comp.formula || '—'}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            comp.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {comp.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center text-lg">
                        {comp.show_in_documents ? '✓' : '✗'}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex justify-center gap-3">
                          <button
                            onClick={() => startEdit(comp)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            onClick={() => comp._id && deleteComponent(comp._id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="mt-10 text-center text-sm text-gray-500">
          Changes here affect new salary revisions and document generation.
        </p>
      </div>
    </div>
  );
};

export default CTCComponentsDashboard;