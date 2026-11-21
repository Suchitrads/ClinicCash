import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import LandingPage from './pages/Landing/LandingPage';
import DashboardPage from './pages/Dashboard/DashboardPage';
import ReceivablesPage from './pages/Receivables/ReceivablesPage';
import InvoicesPage from './pages/Invoices/InvoicesPage';
import ForecastPage from './pages/Forecast/ForecastPage';
import FundingChainPage from './pages/FundingChain/FundingChainPage';
import BillsPage from './pages/Bills/BillsPage';
import PaymentPlansPage from './pages/PaymentPlans/PaymentPlansPage';
import RemindersPage from './pages/Reminders/RemindersPage';
import AlertsPage from './pages/Alerts/AlertsPage';
import SettingsPage from './pages/Settings/SettingsPage';
import GapCloserPage from './pages/GapCloser/GapCloserPage';
import ReportsPage from './pages/Reports/ReportsPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/dashboard" element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="receivables" element={<ReceivablesPage />} />
        <Route path="invoices" element={<InvoicesPage />} />
        <Route path="forecast" element={<ForecastPage />} />
        <Route path="funding-chain" element={<FundingChainPage />} />
        <Route path="gap-closer" element={<GapCloserPage />} />
        <Route path="bills" element={<BillsPage />} />
        <Route path="payment-plans" element={<PaymentPlansPage />} />
        <Route path="reminders" element={<RemindersPage />} />
        <Route path="alerts" element={<AlertsPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
