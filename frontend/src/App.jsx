import AppRoutes from './routes/AppRoutes'
import { AuthProvider } from './context/AuthContext'
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from './components/ui/sonner';
import { queryClient } from './lib/queryClient';

function App() {
  return (
  <QueryClientProvider client={queryClient}>
  <AuthProvider>
  <AppRoutes />
  <Toaster richColors closeButton position="top-right" />
  </AuthProvider>
  </QueryClientProvider>
  )
}

export default App
