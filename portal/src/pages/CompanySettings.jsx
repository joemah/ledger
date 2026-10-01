import { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { Upload, Save } from 'lucide-react';

const EMPTY = {
  name: '',
  tagline: '',
  invoice_prefix: '',
  location_label: '',
  logo: '',
  address: '',
  city: '',
  postal_code: '',
  country: '',
  email: '',
  phone: '',
  website: '',
  vat_number: '',
  iban: '',
  bic: '',
  bank_name: '',
  social_linkedin: '',
  social_twitter: '',
  social_instagram: '',
  social_facebook: '',
};

export default function CompanySettings() {
  const [form, setForm] = useState(EMPTY);
  const [companyId, setCompanyId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await api.entities.Company.filter({}, { limit: 1 });
        const existing = res.items[0];
        if (existing) {
          setForm({ ...EMPTY, ...existing });
          setCompanyId(existing.id);
        }
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    })();
  }, []);

  const handleLogo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await api.integrations.Core.UploadPublicFile({ file });
      setForm({ ...form, logo: res.file_url });
    } catch (err) {
      console.error(err);
    }
    setUploading(false);
  };

  const save = async () => {
    if (!form.name) return;
    setSaving(true);
    setSavedMsg('');
    try {
      if (companyId) {
        await api.entities.Company.update(companyId, form);
      } else {
        const created = await api.entities.Company.create(form);
        setCompanyId(created.id);
      }
      setSavedMsg('Company details saved.');
      setTimeout(() => setSavedMsg(''), 3000);
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  };

  const sections = [
    {
      title: 'Company Identity',
      hint: 'Invoice prefix sets the start of every invoice number — new invoices auto-generate as PREFIX-YEAR-SEQ (e.g. CONS-2026-0001). The sequence resets each year.',
      fields: [
        { key: 'name', label: 'Company Name', required: true, full: true },
        { key: 'tagline', label: 'Tagline', full: true },
        { key: 'invoice_prefix', label: 'Invoice Prefix' },
        { key: 'email', label: 'Email' },
        { key: 'phone', label: 'Phone' },
        { key: 'website', label: 'Website' },
      ],
    },
    {
      title: 'Location & Address',
      hint: 'Remote-based? Just fill in the Location Label (e.g. "Remote", "Remote — Global") and leave the street address blank. All fields here are optional.',
      fields: [
        { key: 'location_label', label: 'Location Label (e.g. Remote, Remote — Global)', full: true },
        { key: 'address', label: 'Street Address', full: true },
        { key: 'city', label: 'City' },
        { key: 'postal_code', label: 'Postal Code' },
        { key: 'country', label: 'Country' },
        { key: 'vat_number', label: 'VAT Number', full: true },
      ],
    },
    {
      title: 'Bank Details (shown on invoice footer)',
      fields: [
        { key: 'bank_name', label: 'Bank Name', full: true },
        { key: 'iban', label: 'IBAN' },
        { key: 'bic', label: 'BIC / SWIFT' },
      ],
    },
    {
      title: 'Social Links',
      fields: [
        { key: 'social_linkedin', label: 'LinkedIn' },
        { key: 'social_twitter', label: 'Twitter / X' },
        { key: 'social_instagram', label: 'Instagram' },
        { key: 'social_facebook', label: 'Facebook' },
      ],
    },
  ];

  if (loading) return <div className="p-10 text-sm text-neutral-400">Loading...</div>;

  return (
    <div className="p-10 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-neutral-900">Company Settings</h1>
        <p className="text-sm text-neutral-500 mt-1">This information appears on every invoice you create</p>
      </div>

      {/* Logo upload */}
      <div className="bg-white border border-neutral-200 rounded-xl p-6 mb-6">
        <label className="block text-xs font-medium text-neutral-500 mb-3 uppercase tracking-wider">Logo</label>
        <div className="flex items-center gap-6">
          <div className="w-32 h-20 bg-neutral-900 rounded-lg flex items-center justify-center overflow-hidden">
            {form.logo ? (
              <img src={form.logo} alt="logo" className="max-h-16 max-w-28 object-contain" />
            ) : (
              <span className="text-white/30 text-xs">No logo</span>
            )}
          </div>
          <div>
            <label className="inline-flex items-center gap-2 px-4 py-2 border border-neutral-300 rounded-lg text-sm cursor-pointer hover:bg-neutral-50 transition">
              <Upload size={16} />
              {uploading ? 'Uploading...' : 'Upload Logo'}
              <input type="file" accept="image/*" className="hidden" onChange={handleLogo} />
            </label>
            <p className="text-xs text-neutral-400 mt-2">PNG or SVG with transparent background works best on the black header</p>
            {form.logo && (
              <button onClick={() => setForm({ ...form, logo: '' })} className="text-xs text-red-500 mt-1 hover:underline">
                Remove logo
              </button>
            )}
          </div>
        </div>
      </div>

      {sections.map((section) => (
        <div key={section.title} className="bg-white border border-neutral-200 rounded-xl p-6 mb-6">
          <h2 className="text-sm font-semibold text-neutral-900 mb-1">{section.title}</h2>
          {section.hint && <p className="text-xs text-neutral-400 mb-4">{section.hint}</p>}
          {!section.hint && <div className="mb-3" />}
          <div className="grid grid-cols-2 gap-4">
            {section.fields.map((f) => (
              <div key={f.key} className={f.full ? 'col-span-2' : ''}>
                <label className="block text-xs font-medium text-neutral-500 mb-1.5">
                  {f.label}{f.required && <span className="text-red-400"> *</span>}
                </label>
                <input
                  type="text"
                  value={form[f.key] || ''}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-900 transition"
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="flex items-center gap-4">
        <button
          onClick={save}
          disabled={saving || !form.name}
          className="flex items-center gap-2 px-6 py-2.5 bg-neutral-900 text-white rounded-lg text-sm font-medium hover:bg-neutral-800 disabled:opacity-50 transition"
        >
          <Save size={16} />
          {saving ? 'Saving...' : 'Save Company'}
        </button>
        {savedMsg && <span className="text-sm text-emerald-600">{savedMsg}</span>}
      </div>
    </div>
  );
}