import AppRoutes from './routes/AppRoutes';
import UserPreferencesSync from './components/UserPreferencesSync';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { Toaster } from './components/ui/sonner';

function App() {
  return (
    <AuthProvider>
      {/* Renders nothing — it is the bridge between the auth state and
          `ThemeConfigProvider`, which is mounted above the query client. */}
      <UserPreferencesSync />
      <SocketProvider>
        <AppRoutes />
        <Toaster richColors closeButton position="top-right" />
      </SocketProvider>
    </AuthProvider>
  );
}

export default App;
