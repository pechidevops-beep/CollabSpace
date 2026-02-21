import React, { useEffect, useState } from 'react';
import PageTransition from '../../../components/shared/PageTransition';
import { useAuth } from '../../../context/AuthContext';

export default function SettingsPage() {
  const { user, profile, updateProfile } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setFullName(profile?.full_name || '');
  }, [profile?.full_name]);

  const handleSave = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setStatus('');
    try {
      await updateProfile({
        full_name: fullName.trim() || null,
      });
      setStatus('Profile updated.');
    } catch (err) {
      setError(err?.message || 'Failed to update profile.');
    }
    setSaving(false);
  };

  return (
    <PageTransition>
      <div className="max-w-3xl space-y-6 pb-8">
        <header>
          <h1 className="text-2xl font-bold text-white tracking-tight">Settings</h1>
          <p className="text-sm text-slate-400 mt-1">Manage your profile and account info.</p>
        </header>

        <section className="glass-panel p-6 rounded-xl space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-200">Profile</h2>
            <p className="text-xs text-slate-500 mt-1">Update your display name.</p>
          </div>

          <form onSubmit={handleSave} className="space-y-3">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Full name</label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:border-brand-500"
                placeholder="Your name"
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={saving}
                className="btn btn-primary text-xs"
              >
                {saving ? 'Saving...' : 'Save changes'}
              </button>
              {status && <span className="text-xs text-emerald-400">{status}</span>}
              {error && <span className="text-xs text-rose-400">{error}</span>}
            </div>
          </form>
        </section>

        <section className="glass-panel p-6 rounded-xl space-y-2">
          <h2 className="text-sm font-semibold text-slate-200">Account</h2>
          <div className="text-xs text-slate-400">
            <div className="flex items-center justify-between border-b border-slate-800 py-2">
              <span>Email</span>
              <span className="text-slate-200">{user?.email || 'Unavailable'}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span>User ID</span>
              <span className="text-slate-200">{user?.id || 'Unavailable'}</span>
            </div>
          </div>
        </section>
      </div>
    </PageTransition>
  );
}
