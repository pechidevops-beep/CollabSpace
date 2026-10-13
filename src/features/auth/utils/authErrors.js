export function getFriendlyAuthErrorMessage(error) {
  if (!error) return '';
  const message = typeof error === 'string' ? error : error.message || '';
  const lower = message.toLowerCase();

  if (lower.includes('failed to fetch') || lower.includes('network') || lower.includes('fetch')) {
    return 'Unable to reach the authentication service. Please check your internet connection.';
  }
  if (lower.includes('invalid login credentials') || lower.includes('invalid credentials')) {
    return 'Incorrect email or password. Please verify your details and try again.';
  }
  if (lower.includes('user already registered') || lower.includes('already exists')) {
    return 'An account with this email address already exists. Please sign in instead.';
  }
  if (lower.includes('password') && lower.includes('at least 6')) {
    return 'Your password must be at least 6 characters long.';
  }
  if (lower.includes('email not confirmed')) {
    return 'Please check your email inbox to verify your account before logging in.';
  }
  if (lower.includes('rate limit') || lower.includes('too many requests')) {
    return 'Too many login attempts. Please wait a moment before trying again.';
  }
  if (lower.includes('signup disabled')) {
    return 'New user signups are temporarily disabled. Please contact the workspace admin.';
  }

  // Fallback to sanitized message if readable, otherwise safe default
  if (message.length > 0 && message.length < 120 && !message.includes('{') && !message.includes('http')) {
    return message;
  }

  return 'An error occurred during authentication. Please try again.';
}
