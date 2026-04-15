export function getAuthErrorCode(error: unknown) {
  return typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code?: unknown }).code === 'string'
    ? ((error as { code: string }).code as string)
    : null;
}

export function toFriendlyAuthError(error: unknown, fallback: string) {
  const code = getAuthErrorCode(error);

  switch (code) {
    case 'auth/email-already-in-use':
      return new Error(
        'This email already has an account. Use the same password to continue setup, or sign in instead.',
      );
    case 'auth/invalid-credential':
      return new Error('The email or password is incorrect.');
    case 'auth/invalid-email':
      return new Error('Enter a valid email address.');
    case 'auth/weak-password':
      return new Error('Password should be at least 6 characters long.');
    case 'auth/operation-not-allowed':
      return new Error(
        'Email/password authentication is disabled in Firebase. Enable it in Firebase Console > Authentication > Sign-in method.',
      );
    case 'auth/too-many-requests':
      return new Error('Too many auth attempts. Wait a moment and try again.');
    case 'auth/network-request-failed':
      return new Error('Network request failed. Check your internet connection and try again.');
    case 'auth/user-disabled':
      return new Error('This Firebase account has been disabled.');
    default:
      return error instanceof Error ? error : new Error(fallback);
  }
}
