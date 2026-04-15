import { AuthProvider } from '@/context/AuthContext';
import { AppRouter } from '@/app/router';

export function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}
