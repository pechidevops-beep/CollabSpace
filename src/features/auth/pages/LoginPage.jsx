import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { AnimatedAuthDemo } from '../components/AnimatedAuthDemo';

export default function LoginPage() {
  const { signInWithEmail } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const formData = new FormData(e.target);
    const email = formData.get('Email');
    const password = formData.get('Password');
    try {
      await signInWithEmail({ email, password });
      navigate('/app');
    } catch (err) {
      setError(err.message ?? 'Failed to sign in');
    }
  };

  const goTo = () => navigate('/auth/signup');

  return (
    <div className="relative min-h-screen overflow-hidden text-slate-50">
      <div className="absolute inset-0 app-background" />
      <div className="absolute inset-0 drizzle-layer" />
      <div className="relative flex min-h-screen">
        <AnimatedAuthDemo mode="login" onSubmit={handleSubmit} goTo={goTo} />
        {error && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 rounded-md border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-xs text-rose-400">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
