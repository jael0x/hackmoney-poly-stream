/**
 * Main App Component
 * Root component with routing and providers
 */

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { wagmiConfig } from './config/wagmi';
import { Header } from './components/layout/Header';
import { Home } from './pages/Home';
import { Market } from './pages/Market';
import { Admin } from './pages/Admin';
import { TestYellow } from './pages/TestYellow';

// Create a query client for React Query
const queryClient = new QueryClient();

/**
 * Main App component
 * Sets up providers and routing
 */
function App() {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <Router>
          <div className="min-h-screen bg-gray-950">
            <Header />
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/market" element={<Market />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/test" element={<TestYellow />} />
            </Routes>
          </div>
        </Router>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export default App;