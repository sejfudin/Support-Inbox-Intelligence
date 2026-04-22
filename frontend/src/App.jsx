import AppRoutes from './routes/AppRoutes'
import { AuthProvider } from './context/AuthContext'
import { SocketProvider } from './context/SocketContext'
import { Toaster } from './components/ui/sonner';

function App() {
  return (
  <AuthProvider>
  <SocketProvider>
  <AppRoutes />
  <Toaster richColors closeButton position="top-right" />
  </SocketProvider>
  </AuthProvider>
  )
}

export default App
