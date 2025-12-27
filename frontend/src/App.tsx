import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './components/Auth/Login';
import { ProtectedRoute } from './components/Auth/ProtectedRoute';
import { Layout } from './components/Layout/Layout';
import { RconConsole } from './components/Console/RconConsole';
import { ServerSettings, ModsManager } from './components/Management';
import { About } from './components/About';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/console" replace />} />
          <Route path="console" element={<RconConsole />} />
          <Route path="settings" element={<ServerSettings />} />
          <Route path="mods" element={<ModsManager />} />
          <Route path="about" element={<About />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
