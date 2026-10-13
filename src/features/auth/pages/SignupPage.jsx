import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { AuthBrandPanel } from '../components/AuthBrandPanel';
import { getFriendlyAuthErrorMessage } from '../utils/authErrors';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { ThemeToggle } from '../../../components/ui/ThemeToggle';
import { Eye, EyeOff, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';

export default function SignupPage() {
  const { signUpWithEmail, signInWithGoogle } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [generalError, setGeneralError] = useState('');
  const [successInfo, setSuccessInfo] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const validateName = (val) => {
    if (!val.trim()) {
      setNameError('Full name is required');
      return false;
    }
    if (val.trim().length < 2) {
      setNameError('Full name must be at least 2 characters');
      return false;
    }
    setNameError('');
    return true;
  };

  const validateEmail = (val) => {
    if (!val.trim()) {
      setEmailError('Email address is required');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(val.trim())) {
      setEmailError('Please enter a valid email address');
      return false;
    }
    setEmailError('');
    return true;
  };

  const validatePassword = (val) => {
    if (!val) {
      setPasswordError('Password is required');
      return false;
    }
    if (val.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return false;
    }
    setPasswordError('');
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGeneralError('');
    setSuccessInfo('');

    const isNameValid = validateName(fullName);
    const isEmailValid = validateEmail(email);
    const isPasswordValid = validatePassword(password);

    if (!isNameValid || !isEmailValid || !isPasswordValid) {
      return;
    }

    setIsLoading(true);
    try {
      await signUpWithEmail({
        email: email.trim(),
        password,
        fullName: fullName.trim(),
      });
      setSuccessInfo('Account created! Please check your inbox to confirm your email, then sign in.');
      setTimeout(() => {
        navigate('/auth/login');
      }, 2500);
    } catch (err) {
      setGeneralError(getFriendlyAuthErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGeneralError('');
    setIsGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setGeneralError(getFriendlyAuthErrorMessage(err));
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-canvas text-text-main selection:bg-brand/20">
      {/* Left: Product Mockup & Brand Panel */}
      <AuthBrandPanel />

      {/* Right: Auth Form Panel */}
      <div className="relative flex-1 flex flex-col justify-between p-6 sm:p-12 lg:p-16 overflow-y-auto">
        {/* Top bar */}
        <div className="flex items-center justify-between w-full max-w-md mx-auto">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs text-text-sub hover:text-text-main transition-colors"
          >
            <ArrowLeft size={14} />
            <span>Back to home</span>
          </Link>
          <ThemeToggle />
        </div>

        {/* Center Form Container */}
        <div className="w-full max-w-sm mx-auto my-auto py-8">
          <div className="mb-8">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-text-main">
              Create your account
            </h1>
            <p className="text-xs sm:text-sm text-text-sub mt-1.5">
              Start collaborating with your team or classroom.
            </p>
          </div>

          {/* Success Info Banner */}
          {successInfo && (
            <div className="mb-6 p-3.5 rounded-lg bg-semantic-success/10 border border-semantic-success/20 flex items-start gap-2.5 text-xs text-semantic-success animate-fadeIn">
              <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
              <span className="leading-relaxed">{successInfo}</span>
            </div>
          )}

          {/* General Error Banner */}
          {generalError && (
            <div className="mb-6 p-3.5 rounded-lg bg-semantic-danger/10 border border-semantic-danger/20 flex items-start gap-2.5 text-xs text-semantic-danger animate-fadeIn">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span className="leading-relaxed">{generalError}</span>
            </div>
          )}

          {/* Google Sign-in */}
          <Button
            type="button"
            variant="outline"
            className="w-full h-10 mb-5 flex items-center justify-center gap-2.5 font-normal text-xs hover:bg-subtle"
            onClick={handleGoogleSignIn}
            disabled={isLoading || isGoogleLoading}
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>{isGoogleLoading ? 'Connecting...' : 'Continue with Google'}</span>
          </Button>

          {/* Divider */}
          <div className="relative my-6 text-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border-dim" />
            </div>
            <span className="relative px-3 bg-canvas text-[11px] text-text-dim uppercase tracking-wider">
              or register with email
            </span>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <Input
              id="fullName"
              label="Full name"
              type="text"
              placeholder="Alex Johnson"
              autoComplete="name"
              value={fullName}
              error={nameError}
              disabled={isLoading}
              required
              onChange={(e) => {
                setFullName(e.target.value);
                if (nameError) validateName(e.target.value);
              }}
              onBlur={(e) => validateName(e.target.value)}
            />

            <Input
              id="email"
              label="Email address"
              type="email"
              placeholder="name@organization.com"
              autoComplete="email"
              value={email}
              error={emailError}
              disabled={isLoading}
              required
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) validateEmail(e.target.value);
              }}
              onBlur={(e) => validateEmail(e.target.value)}
            />

            <Input
              id="password"
              label="Password"
              type={showPassword ? 'text' : 'password'}
              placeholder="At least 6 characters"
              autoComplete="new-password"
              value={password}
              error={passwordError}
              helperText={!passwordError ? 'Minimum 6 characters' : undefined}
              disabled={isLoading}
              required
              onChange={(e) => {
                setPassword(e.target.value);
                if (passwordError) validatePassword(e.target.value);
              }}
              onBlur={(e) => validatePassword(e.target.value)}
              rightElement={
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-text-dim hover:text-text-main p-1 transition-colors focus:outline-none"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              }
            />

            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                className="w-full h-10 font-medium text-xs shadow-sm"
                isLoading={isLoading}
                disabled={isLoading}
              >
                {isLoading ? 'Creating account...' : 'Create account'}
              </Button>
            </div>
          </form>

          {/* Footer Link */}
          <div className="mt-6 text-center text-xs text-text-sub">
            Already have an account?{' '}
            <Link
              to="/auth/login"
              className="text-text-main font-medium hover:underline transition-colors"
            >
              Sign in
            </Link>
          </div>
        </div>

        {/* Bottom copyright/terms note */}
        <div className="w-full max-w-sm mx-auto text-center text-[11px] text-text-dim">
          <span>By signing up, you agree to our Terms of Service and Privacy Policy.</span>
        </div>
      </div>
    </div>
  );
}
