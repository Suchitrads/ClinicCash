import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import LandingPage from './pages/Landing/LandingPage';
import SignInPage from './pages/Auth/SignInPage';
import SignUpPage from './pages/Auth/SignUpPage';
import PlansPage from './pages/Plans/PlansPage';
import ModuleGate from './components/common/ModuleGate';
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
      <Route path="/signin" element={<SignInPage />} />
      <Route path="/signup" element={<SignUpPage />} />
      <Route path="/plans" element={<PlansPage />} />
      <Route path="/dashboard" element={<AppLayout />}>
        <Route index element={<ModuleGate module="dashboard"><DashboardPage /></ModuleGate>} />
        <Route path="receivables" element={<ModuleGate module="receivables"><ReceivablesPage /></ModuleGate>} />
        <Route path="invoices" element={<ModuleGate module="invoices"><InvoicesPage /></ModuleGate>} />
        <Route path="forecast" element={<ModuleGate module="forecast"><ForecastPage /></ModuleGate>} />
        <Route path="funding-chain" element={<ModuleGate module="funding-chain"><FundingChainPage /></ModuleGate>} />
        <Route path="gap-closer" element={<ModuleGate module="gap-closer"><GapCloserPage /></ModuleGate>} />
        <Route path="bills" element={<ModuleGate module="bills"><BillsPage /></ModuleGate>} />
        <Route path="payment-plans" element={<ModuleGate module="payment-plans"><PaymentPlansPage /></ModuleGate>} />
        <Route path="reminders" element={<ModuleGate module="reminders"><RemindersPage /></ModuleGate>} />
        <Route path="alerts" element={<ModuleGate module="alerts"><AlertsPage /></ModuleGate>} />
        <Route path="reports" element={<ModuleGate module="reports"><ReportsPage /></ModuleGate>} />
        <Route path="settings" element={<ModuleGate module="settings"><SettingsPage /></ModuleGate>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
