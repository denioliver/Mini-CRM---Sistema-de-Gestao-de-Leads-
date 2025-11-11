import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { LeadsProvider } from "./contexts/LeadsContext";
import PrivateRoute from "./components/PrivateRoute";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Leads from "./pages/Leads";
import LeadDetails from "./pages/LeadDetails";
import LeadForm from "./pages/LeadForm";

function App() {
  return (
    <BrowserRouter basename="/Mini-CRM---Sistema-de-Gestao-de-Leads-">
      <AuthProvider>
        <LeadsProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            <Route
              path="/"
              element={
                <PrivateRoute>
                  <Layout />
                </PrivateRoute>
              }
            >
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="leads" element={<Leads />} />
              <Route path="leads/new" element={<LeadForm />} />
              <Route path="leads/:id" element={<LeadDetails />} />
              <Route path="leads/:id/edit" element={<LeadForm />} />
            </Route>

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </LeadsProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
