import AppRoutes from './routes/AppRoutes'
import { AuthProvider } from './context/AuthContext'
import { SocketProvider } from './context/SocketContext'
import { TicketModalProvider } from './context/TicketModalContext'
import { Toaster } from './components/ui/sonner';

function App() {
  return (
  <AuthProvider>
  <SocketProvider>
  <TicketModalProvider>
  <AppRoutes />
  <Toaster richColors closeButton position="top-right" />
  </TicketModalProvider>
  </SocketProvider>
  </AuthProvider>
  )
}

export default App
