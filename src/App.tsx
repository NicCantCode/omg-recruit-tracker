import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import DashboardLayout from "./layouts/DashboardLayout";
import Login from "./pages/Login";
import Locked from "./pages/Locked";
import RequireApproved from "./components/RequireApproved";

import Dashboard from "./pages/Dashboard";
import Recruits from "./pages/Recruits";
import Ranks from "./pages/Ranks";
import Settings from "./pages/Settings";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route
          index
          element={
            <RequireApproved>
              <Dashboard />
            </RequireApproved>
          }
        />

        <Route path="locked" element={<Locked />} />

        <Route
          path="recruits"
          element={
            <RequireApproved>
              <Recruits />
            </RequireApproved>
          }
        />

        <Route
          path="ranks"
          element={
            <RequireApproved>
              <Ranks />
            </RequireApproved>
          }
        />

        <Route path="settings" element={<Settings />} />

        {/* Fallback redirect inside the authentication shell. */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
