import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { AnimatedAuthDemo } from '../components/AnimatedAuthDemo';

export default function SignupPage() {
  const { signUpWithEmail } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');
    const formData = new FormData(e.target);
    const fullName = formData.get('Full name');
    const email = formData.get('Email');
    const password = formData.get('Password');
    try {
      await signUpWithEmail({ email, password, fullName });
      setInfo('Check your inbox to confirm your email, then sign in.');
      setTimeout(() => {
        navigate('/auth/login');
      }, 1500);
    } catch (err) {
      setError(err.message ?? 'Failed to sign up');
    }
  };

  const goTo = () => navigate('/auth/login');

  return (
    <div className="relative min-h-screen overflow-hidden text-slate-50">
      <div className="absolute inset-0 app-background" />
      <div className="absolute inset-0 drizzle-layer" />
      <div className="relative flex min-h-screen">
        <AnimatedAuthDemo mode="signup" onSubmit={handleSubmit} goTo={goTo} />
        {error && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 rounded-md border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-xs text-rose-400">
            {error}
          </div>
        )}
        {info && !error && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs text-emerald-400">
            {info}
          </div>
        )}
      </div>
    </div>
  );
}
