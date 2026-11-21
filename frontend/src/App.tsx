import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import { ComingSoon } from './components/common/ComingSoon';
import LandingPage from './pages/Landing/LandingPage';
import DashboardPage from './pages/Dashboard/DashboardPage';
import ReceivablesPage from './pages/Receivables/ReceivablesPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/dashboard" element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="receivables" element={<ReceivablesPage />} />
        <Route path="invoices" element={<ComingSoon title="Invoices" />} />
        <Route path="forecast" element={<ComingSoon title="Cash Flow Forecast" />} />
        <Route path="funding-chain" element={<ComingSoon title="Funding Chain" />} />
        <Route path="gap-closer" element={<ComingSoon title="Gap Closer" />} />
        <Route path="bills" element={<ComingSoon title="Bills & Expenses" />} />
        <Route path="payment-plans" element={<ComingSoon title="Payment Plans" />} />
        <Route path="reminders" element={<ComingSoon title="Reminders" />} />
        <Route path="alerts" element={<ComingSoon title="Alerts" />} />
        <Route path="reports" element={<ComingSoon title="Reports & Analytics" />} />
        <Route path="settings" element={<ComingSoon title="Settings" />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
