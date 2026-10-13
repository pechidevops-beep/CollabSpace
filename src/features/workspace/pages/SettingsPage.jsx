import React, { useEffect, useState } from 'react';
import PageTransition from '../../../components/shared/PageTransition';
import { useAuth } from '../../../context/AuthContext';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import { ThemeToggle } from '../../../components/ui/ThemeToggle';
import { User, Shield, Moon } from 'lucide-react';

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
      setStatus('Profile updated successfully.');
      setTimeout(() => setStatus(''), 3000);
    } catch (err) {
      setError(err?.message || 'Failed to update profile.');
    }
    setSaving(false);
  };

  return (
    <PageTransition>
      <div className="max-w-3xl space-y-6 pb-8 animate-fade-up">
        <header>
          <h1 className="text-xl sm:text-2xl font-semibold text-text-main tracking-tight">Settings</h1>
          <p className="text-xs text-text-sub mt-1">Manage your profile, theme, and workspace preferences.</p>
        </header>

        {/* Profile Section */}
        <section className="p-5 rounded-[14px] bg-surface border border-border-dim shadow-subtle space-y-4">
          <div className="flex items-center gap-2">
            <User size={16} className="text-accent" />
            <h2 className="text-sm font-semibold text-text-main">Profile Information</h2>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <Input
              label="Full Name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your full name"
            />

            <div className="flex items-center gap-3 pt-1">
              <Button
                type="submit"
                variant="primary"
                size="sm"
                loading={saving}
                disabled={saving}
              >
                Save Changes
              </Button>
              {status && <span className="text-xs text-semantic-success font-medium animate-fadeIn">{status}</span>}
              {error && <span className="text-xs text-semantic-danger font-medium animate-fadeIn">{error}</span>}
            </div>
          </form>
        </section>

        {/* Theme & Appearance Section */}
        <section className="p-5 rounded-[14px] bg-surface border border-border-dim shadow-subtle space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Moon size={16} className="text-accent" />
              <div>
                <h2 className="text-sm font-semibold text-text-main">Theme Mode</h2>
                <p className="text-xs text-text-sub mt-0.5">Toggle between Dark and Light mode.</p>
              </div>
            </div>
            <ThemeToggle />
          </div>
        </section>

        {/* Account Details Section */}
        <section className="p-5 rounded-[14px] bg-surface border border-border-dim shadow-subtle space-y-3">
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-accent" />
            <h2 className="text-sm font-semibold text-text-main">Account Details</h2>
          </div>

          <div className="text-xs divide-y divide-border-dim">
            <div className="flex items-center justify-between py-2.5">
              <span className="text-text-sub">Email</span>
              <span className="text-text-main font-mono">{user?.email || 'Unavailable'}</span>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <span className="text-text-sub">User ID</span>
              <span className="text-text-dim font-mono text-[11px]">{user?.id || 'Unavailable'}</span>
            </div>
          </div>
        </section>
      </div>
    </PageTransition>
  );
}
