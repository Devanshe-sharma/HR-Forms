'use client';

import React, { useState, useEffect } from 'react';
import { Edit2, Trash2, Save, X, } from 'lucide-react';

interface CTCComponentType {
  id?: number;
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
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<CTCComponentType>({
    name: '',
    code: '',
    formula: '0',
    order: 0,
    is_active: true,
    show_in_documents: true,
  });

  const API_URL = 'https://hr-forms.onrender.com/api/ctc-components/';

  // Fetch all components
  const fetchComponents = async () => {
    try {
      const res = await fetch(API_URL);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setComponents(data.sort((a: any, b: any) => a.order - b.order));
      setLoading(false);
    } catch (err) {
      alert('Error loading CTC components');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComponents();
  }, []);

  // Start editing
  const startEdit = (comp: CTCComponentType) => {
    setEditingId(comp.id!);
    setFormData(comp);
  };

  // Cancel edit
  const cancelEdit = () => {
    setEditingId(null);
    setFormData({
      name: '',
      code: '',
      formula: '0',
      order: 0,
      is_active: true,
      show_in_documents: true,
    });
  };

  // Save (create or update)
  const saveComponent = async () => {
    if (!formData.name || !formData.code) {
      alert('Name and Code are required');
      return;
    }

    try {
      const method = editingId ? 'PATCH' : 'POST';
      const url = editingId ? `${API_URL}${editingId}/` : API_URL;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          order: formData.order || components.length + 1,
        }),
      });

      if (!res.ok) throw new Error('Save failed');

      const saved = await res.json();

      if (editingId) {
        setComponents(components.map(c => c.id === editingId ? saved : c));
      } else {
        setComponents([...components, saved]);
      }

      cancelEdit();
      alert('Component saved successfully!');
    } catch (err) {
      alert('Error saving component');
    }
  };

  // Delete
  const deleteComponent = async (id: number) => {
    if (!window.confirm('Delete this component permanently?')) return;

    try {
      await fetch(`${API_URL}${id}/`, { method: 'DELETE' });
      setComponents(components.filter(c => c.id !== id));
      alert('Deleted successfully');
    } catch (err) {
      alert('Error deleting');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">CTC Components Dashboard</h1>
          <p className="text-gray-600">Loading components...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-4xl font-bold text-gray-800">CTC Components Dashboard</h1>
            <p className="text-gray-600 mt-2">HR can add, edit, delete, and configure salary components here</p>
          </div>
        </div>

        {/* Add/Edit Form */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-10">
          <h2 className="text-2xl font-semibold mb-6">
            {editingId ? 'Edit Component' : 'Add New Component'}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                placeholder="e.g., Internet Allowance"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Code (Unique)</label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                placeholder="e.g., INTERNET"
              />
              <p className="text-xs text-gray-500 mt-1">Used in formulas. No spaces, uppercase.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Formula</label>
              <input
                type="text"
                value={formData.formula}
                onChange={(e) => setFormData({ ...formData, formula: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                placeholder="e.g., BASIC * 0.05 or 2000 or IF(GROSS_MONTHLY < 21000, 1000, 0)"
              />
              <p className="text-xs text-gray-500 mt-1">Use codes like BASIC, HRA, CTC. Supports +, -, *, /, IF()</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Order</label>
              <input
                type="number"
                value={formData.order}
                onChange={(e) => setFormData({ ...formData, order: Number(e.target.value) })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg"
              />
            </div>

            <div className="flex items-end gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-5 h-5 text-teal-600 rounded focus:ring-teal-500"
                />
                <span className="text-sm font-medium">Active</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.show_in_documents}
                  onChange={(e) => setFormData({ ...formData, show_in_documents: e.target.checked })}
                  className="w-5 h-5 text-teal-600 rounded focus:ring-teal-500"
                />
                <span className="text-sm font-medium">Show in Letters</span>
              </label>
            </div>

            <div className="flex items-end gap-3">
              <button
                onClick={saveComponent}
                className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium flex items-center gap-2"
              >
                <Save size={18} />
                {editingId ? 'Update' : 'Add'} Component
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

        {/* Components List */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="p-6 border-b">
            <h2 className="text-2xl font-semibold">All CTC Components ({components.length})</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Order</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Name</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Code</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Formula</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Status</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Documents</th>
                  <th className="px-6 py-4 text-center text-sm font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {components.map((comp) => (
                  <tr key={comp.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm">{comp.order}</td>
                    <td className="px-6 py-4 font-medium">{comp.name}</td>
                    <td className="px-6 py-4 text-sm font-mono bg-gray-100 px-3 py-1 rounded">{comp.code}</td>
                    <td className="px-6 py-4 text-sm font-mono text-gray-600 max-w-xs truncate">{comp.formula || '0'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${comp.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {comp.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {comp.show_in_documents ? '✓' : '✗'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-3">
                        <button
                          onClick={() => startEdit(comp)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                          title="Edit"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => deleteComponent(comp.id!)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                          title="Delete"
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
        </div>

        <div className="mt-10 text-center text-gray-500 text-sm">
          Changes here instantly affect all new salary revisions and document generation.
        </div>
      </div>
    </div>
  );
};

export default CTCComponentsDashboard;