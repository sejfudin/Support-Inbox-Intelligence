import AppRoutes from './routes/AppRoutes';
import UserPreferencesSync from './components/UserPreferencesSync';
import DailyReminderSync from './components/DailyReminderSync';
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
        {/* Renders nothing — asks the server to re-check this intern's daily
            reminder whenever they turn up inside the 10:30–11:00 window. Inside
            `SocketProvider` because the reminder is delivered over the socket. */}
        <DailyReminderSync />
        <AppRoutes />
        <Toaster richColors closeButton position="top-right" />
      </SocketProvider>
    </AuthProvider>
  );
}

export default App;
