'use client';

import { useState } from 'react';
import type { PageConfig } from '@/lib/db/pages';

interface Props {
  page: PageConfig;
}

export function PageRenderer({ page }: Props) {
  switch (page.type) {
    case 'registration':
      return <FormPage page={page} />;
    case 'feedback':
      return <FeedbackPage page={page} />;
    case 'checkin':
      return <CheckinPage page={page} />;
    case 'event-page':
      return <EventInfoPage page={page} />;
    case 'custom':
      return <FormPage page={page} />;
    default:
      return <FormPage page={page} />;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GENERIC FORM PAGE (Registration / Custom)
// ═══════════════════════════════════════════════════════════════════════════════

function FormPage({ page }: Props) {
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('submitting');

    try {
      const res = await fetch(`/api/p/${page.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Submission failed');
      }

      setStatus('success');
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong');
    }
  };

  if (status === 'success') {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Submitted!</h2>
          <p className="text-gray-600">
            {page.settings.successMessage || 'Thank you for your submission.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-lg w-full">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">{page.title}</h1>
          {page.settings.description && (
            <p className="text-gray-600 mt-2">{page.settings.description}</p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {page.fields.map((field) => (
            <FieldInput
              key={field.name}
              field={field}
              value={formData[field.name] || ''}
              onChange={(val) => setFormData({ ...formData, [field.name]: val })}
            />
          ))}

          {status === 'error' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
              {errorMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={status === 'submitting'}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium py-3 px-4 rounded-lg transition-colors"
          >
            {status === 'submitting' ? 'Submitting...' : (page.settings.submitButton || 'Submit')}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          Powered by Eventiq
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FEEDBACK PAGE (with star ratings)
// ═══════════════════════════════════════════════════════════════════════════════

function FeedbackPage({ page }: Props) {
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('submitting');

    try {
      const res = await fetch(`/api/p/${page.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Submission failed');
      }

      setStatus('success');
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong');
    }
  };

  if (status === 'success') {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Thank You!</h2>
          <p className="text-gray-600">
            {page.settings.successMessage || 'Your feedback has been recorded.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-lg w-full">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">{page.title}</h1>
          {page.settings.description && (
            <p className="text-gray-600 mt-2">{page.settings.description}</p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {page.fields.map((field) => (
            <FieldInput
              key={field.name}
              field={field}
              value={formData[field.name] || ''}
              onChange={(val) => setFormData({ ...formData, [field.name]: val })}
            />
          ))}

          {status === 'error' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
              {errorMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={status === 'submitting'}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium py-3 px-4 rounded-lg transition-colors"
          >
            {status === 'submitting' ? 'Submitting...' : (page.settings.submitButton || 'Submit Feedback')}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          Powered by Eventiq
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHECK-IN PAGE (QR Scanner)
// ═══════════════════════════════════════════════════════════════════════════════

function CheckinPage({ page }: Props) {
  const [manualCode, setManualCode] = useState('');
  const [status, setStatus] = useState<'idle' | 'checking' | 'success' | 'error'>('idle');
  const [result, setResult] = useState('');

  const handleCheckin = async () => {
    if (!manualCode.trim()) return;
    setStatus('checking');

    try {
      const res = await fetch(`/api/p/${page.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'checkin', code: manualCode.trim() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Check-in failed');

      setStatus('success');
      setResult(data.message || 'Checked in successfully!');
    } catch (err) {
      setStatus('error');
      setResult(err instanceof Error ? err.message : 'Check-in failed');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
        <div className="mb-6">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{page.title}</h1>
          {page.settings.description && (
            <p className="text-gray-600 mt-2">{page.settings.description}</p>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
              Ticket Code / QR Value
            </label>
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Enter ticket code or scan QR"
              className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              onKeyDown={(e) => e.key === 'Enter' && handleCheckin()}
            />
          </div>

          <button
            onClick={handleCheckin}
            disabled={status === 'checking' || !manualCode.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium py-3 px-4 rounded-lg transition-colors"
          >
            {status === 'checking' ? 'Checking...' : 'Check In'}
          </button>

          {(status === 'success' || status === 'error') && (
            <div className={`p-4 rounded-lg ${status === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {result}
            </div>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Powered by Eventiq
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EVENT INFO PAGE
// ═══════════════════════════════════════════════════════════════════════════════

function EventInfoPage({ page }: Props) {
  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-2xl w-full">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{page.title}</h1>
          {page.settings.description && (
            <p className="text-gray-600 mt-3 text-lg">{page.settings.description}</p>
          )}
        </div>

        <div className="space-y-6">
          {page.settings.eventDate && (
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-gray-900">Date</p>
                <p className="text-gray-600">{page.settings.eventDate}</p>
              </div>
            </div>
          )}

          {page.settings.eventVenue && (
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-gray-900">Venue</p>
                <p className="text-gray-600">{page.settings.eventVenue}</p>
              </div>
            </div>
          )}

          {page.settings.eventAgenda && page.settings.eventAgenda.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Agenda</h2>
              <ul className="space-y-2">
                {page.settings.eventAgenda.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <span className="text-gray-700">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {page.settings.registrationLink && (
          <div className="mt-8">
            <a
              href={page.settings.registrationLink}
              className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors text-center"
            >
              Register Now
            </a>
          </div>
        )}

        <p className="text-center text-xs text-gray-400 mt-8">
          Powered by Eventiq
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FIELD INPUT COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

interface FieldInputProps {
  field: PageConfig['fields'][number];
  value: string;
  onChange: (value: string) => void;
}

function FieldInput({ field, value, onChange }: FieldInputProps) {
  const baseInputClass = 'w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900';

  if (field.type === 'rating') {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {field.label} {field.required && <span className="text-red-500">*</span>}
        </label>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => onChange(String(star))}
              className={`w-10 h-10 rounded-lg text-lg transition-colors ${
                Number(value) >= star
                  ? 'bg-yellow-400 text-white'
                  : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
              }`}
            >
              ★
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (field.type === 'textarea') {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {field.label} {field.required && <span className="text-red-500">*</span>}
        </label>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          required={field.required}
          rows={3}
          className={baseInputClass + ' resize-none'}
        />
      </div>
    );
  }

  if (field.type === 'select') {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {field.label} {field.required && <span className="text-red-500">*</span>}
        </label>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
          className={baseInputClass}
        >
          <option value="">Select...</option>
          {(field.options || []).map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>
    );
  }

  if (field.type === 'checkbox') {
    return (
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id={field.name}
          checked={value === 'true'}
          onChange={(e) => onChange(e.target.checked ? 'true' : 'false')}
          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
        />
        <label htmlFor={field.name} className="text-sm font-medium text-gray-700">
          {field.label} {field.required && <span className="text-red-500">*</span>}
        </label>
      </div>
    );
  }

  // text, email, number, date, phone
  const inputType = field.type === 'phone' ? 'tel' : field.type;

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {field.label} {field.required && <span className="text-red-500">*</span>}
      </label>
      <input
        type={inputType}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        required={field.required}
        className={baseInputClass}
      />
    </div>
  );
}
