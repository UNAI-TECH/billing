import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { CompanyProvider, useCompany } from './contexts/CompanyContext';
import { DocumentProvider } from './contexts/DocumentContext';
import { ToastProvider } from './components/ui/Toast';

import { Onboarding } from './pages/Onboarding';
import { Dashboard } from './pages/Dashboard';
import { Documents } from './pages/Documents';
import { CreateDocument } from './pages/CreateDocument';
import { CompanyEdit } from './pages/CompanyEdit';
import { Settings } from './pages/Settings';
import { Ledger } from './pages/Ledger';
import { PublicPreview } from './pages/PublicPreview';
import { Expenses } from './pages/Expenses';
import { Recurring } from './pages/Recurring';
import { RecycleBin } from './pages/RecycleBin';
import { Employees } from './pages/Employees';
import { Payroll } from './pages/Payroll';
import { EmployeeLogin } from './pages/EmployeeLogin';
import { Payslips } from './pages/Payslips';
import { WorkspaceLogin } from './pages/WorkspaceLogin';
import { getCompanyEmployees } from './services/db';

import { 
  Shield, FileText, Receipt, CreditCard, BookOpen 
} from 'lucide-react';

// Route Guard to redirect first-time users to Onboarding
const AppRoutes = () => {
  const { activeCompany, loading, isAuthenticated } = useCompany();
  const isPreviewRoute = window.location.pathname.startsWith('/preview/');

  React.useEffect(() => {
    if (!activeCompany?.id) return;
    const employeeJson = localStorage.getItem('activeEmployee');
    if (!employeeJson) return;
    
    let isMounted = true;
    const syncEmployeeSession = async () => {
      try {
        const emp = JSON.parse(employeeJson);
        // Only sync if this employee belongs to the current activeCompany
        if (emp.companyId && emp.companyId !== activeCompany.id) {
          return;
        }
        const employees = await getCompanyEmployees(activeCompany.id);
        const latestEmp = employees.find(e => e.id === emp.id || (e.loginId && e.loginId === emp.loginId));
        if (isMounted) {
          if (!latestEmp) {
            localStorage.removeItem('activeEmployee');
          } else {
            const currentStr = JSON.stringify(emp);
            const latestStr = JSON.stringify(latestEmp);
            if (currentStr !== latestStr) {
              localStorage.setItem('activeEmployee', latestStr);
            }
          }
        }
      } catch (err) {
        console.error('Error syncing employee session:', err);
      }
    };

    // Run initially
    syncEmployeeSession();

    // Run on tab focus
    const handleFocus = () => {
      syncEmployeeSession();
    };
    window.addEventListener('focus', handleFocus);

    // Run periodically every 4 seconds
    const intervalId = setInterval(syncEmployeeSession, 4000);

    return () => {
      isMounted = false;
      window.removeEventListener('focus', handleFocus);
      clearInterval(intervalId);
    };
  }, [activeCompany?.id]);

  if (loading && !isPreviewRoute) {
    // If user is already authenticated, show a skeleton loader that
    // mirrors the actual sidebar + dashboard layout for seamless UX
    if (isAuthenticated) {
      return (
        <div className="h-screen w-full flex bg-[#f8fafc] font-sans overflow-hidden">
          {/* Skeleton Sidebar */}
          <div className="hidden md:flex w-[260px] bg-white border-r border-[#f1f3f9] flex-col shrink-0 pt-5">
            {/* Brand */}
            <div className="px-6 pb-6 flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-full bg-slate-200 animate-pulse shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 bg-slate-200 rounded-lg w-28 animate-pulse" />
                <div className="h-2.5 bg-slate-100 rounded-lg w-20 animate-pulse" />
              </div>
            </div>
            {/* Menu Label */}
            <div className="px-7 pb-3">
              <div className="h-2 bg-slate-100 rounded w-16 animate-pulse" />
            </div>
            {/* Nav Items */}
            <div className="px-4 space-y-2">
              {[1,2,3,4,5,6,7,8].map(i => (
                <div key={i} className="flex items-center gap-3.5 px-4 py-3 rounded-2xl">
                  <div className="w-5 h-5 rounded-md bg-slate-100 animate-pulse shrink-0" />
                  <div className={`h-3 bg-slate-100 rounded-lg animate-pulse`} style={{ width: `${60 + (i * 7) % 40}px` }} />
                </div>
              ))}
            </div>
          </div>

          {/* Skeleton Main Content */}
          <div className="flex-1 overflow-hidden p-4 md:p-8">
            {/* Welcome Card Skeleton */}
            <div className="bg-white border border-[#f1f3f9] p-6 rounded-3xl mb-6">
              <div className="flex items-center justify-between">
                <div className="space-y-3">
                  <div className="h-6 bg-slate-200 rounded-xl w-64 animate-pulse" />
                  <div className="h-3 bg-slate-100 rounded-lg w-96 animate-pulse" />
                </div>
              </div>
            </div>

            {/* Stat Cards Skeleton */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {[1,2,3].map(i => (
                <div key={i} className="bg-white border border-[#f1f3f9] rounded-2xl p-5 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-slate-100 animate-pulse shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-2.5 bg-slate-100 rounded-lg w-24 animate-pulse" />
                    <div className="h-5 bg-slate-200 rounded-lg w-32 animate-pulse" />
                    <div className="h-2 bg-slate-50 rounded-lg w-36 animate-pulse" />
                  </div>
                </div>
              ))}
            </div>

            {/* Second Row Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {[1,2,3].map(i => (
                <div key={i} className="bg-white border border-[#f1f3f9] rounded-2xl p-5 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-slate-100 animate-pulse shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-2.5 bg-slate-100 rounded-lg w-28 animate-pulse" />
                    <div className="h-5 bg-slate-200 rounded-lg w-24 animate-pulse" />
                    <div className="h-2 bg-slate-50 rounded-lg w-40 animate-pulse" />
                  </div>
                </div>
              ))}
            </div>

            {/* Chart + Recent Docs Skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              <div className="lg:col-span-3 bg-white border border-[#f1f3f9] rounded-2xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="h-4 bg-slate-200 rounded-lg w-36 animate-pulse" />
                  <div className="h-8 bg-slate-100 rounded-lg w-32 animate-pulse" />
                </div>
                <div className="h-48 bg-slate-50 rounded-xl animate-pulse" />
              </div>
              <div className="lg:col-span-2 bg-white border border-[#f1f3f9] rounded-2xl p-6">
                <div className="flex items-center justify-between mb-5">
                  <div className="h-4 bg-slate-200 rounded-lg w-32 animate-pulse" />
                  <div className="h-3 bg-slate-100 rounded-lg w-14 animate-pulse" />
                </div>
                <div className="space-y-4">
                  {[1,2,3,4].map(i => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-100 animate-pulse shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3 bg-slate-100 rounded-lg w-24 animate-pulse" />
                        <div className="h-2 bg-slate-50 rounded-lg w-36 animate-pulse" />
                      </div>
                      <div className="h-3.5 bg-slate-100 rounded-lg w-16 animate-pulse" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // First-time / unauthenticated users see the branded loading screen
    return (
      <div className="h-screen max-h-screen flex flex-col md:flex-row bg-[#080d27] font-sans overflow-hidden">
        
        {/* LEFT COLUMN: BRANDING & 3D NEON VISUALS */}
        <div className="w-full md:w-[38%] h-full relative overflow-hidden bg-gradient-to-br from-[#060a22] via-[#091540] to-[#040817] flex flex-col justify-between p-6 md:p-8 text-white shrink-0">
          <div className="absolute top-0 bottom-0 right-0 w-20 hidden md:block z-10 pointer-events-none">
            <svg className="h-full w-full" viewBox="0 0 100 1000" preserveAspectRatio="none" fill="none">
              <path d="M100,0 L0,0 C40,150 80,350 80,500 C80,650 40,850 0,1000 L100,1000 Z" fill="#f8fafc" />
            </svg>
          </div>

          <div className="flex items-center relative z-20">
            <img src="/logo.png" alt="UNAI Logo" className="h-10 sm:h-11 w-auto object-contain" />
          </div>

          <div className="my-auto py-2 relative z-20 flex flex-col items-center">
            <div className="text-center md:text-left md:w-full max-w-sm mb-6 space-y-2">
              <h2 className="text-xl md:text-2xl font-extrabold tracking-tight leading-tight">
                Billing <span className="text-white/80">made simple.</span><br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-sky-400 to-cyan-400">Business</span> made stronger.
              </h2>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Create invoices, vouchers, receipts and ledgers with ease. Manage your finance, your way.
              </p>
            </div>

            <div className="relative w-56 h-40 flex items-center justify-center">
              <div className="absolute w-44 h-44 bg-blue-500/10 rounded-full filter blur-2xl animate-pulse-slow"></div>
              <div className="absolute inset-0 animate-float-slow flex items-center justify-center">
                <img src="/un.png" alt="UNAI 3D" className="w-full h-full object-contain filter drop-shadow-[0_8px_16px_rgba(99,102,241,0.3)]" />
              </div>

              <div className="absolute top-2 -right-6 animate-float-medium bg-white/95 text-slate-800 px-2 py-1 rounded-lg shadow-md border border-slate-100 flex items-center gap-1.5">
                <div className="w-5 h-5 rounded bg-blue-50 flex items-center justify-center">
                  <FileText className="w-3 h-3 text-blue-600" />
                </div>
                <div className="text-left">
                  <p className="text-[9px] font-bold leading-tight">Invoice</p>
                  <p className="text-[7px] text-slate-400 font-semibold">Generate A4</p>
                </div>
              </div>

              <div className="absolute top-12 -left-10 animate-float-slow bg-white/95 text-slate-800 px-2 py-1 rounded-lg shadow-md border border-slate-100 flex items-center gap-1.5">
                <div className="w-5 h-5 rounded bg-emerald-50 flex items-center justify-center">
                  <Receipt className="w-3 h-3 text-emerald-600" />
                </div>
                <div className="text-left">
                  <p className="text-[9px] font-bold leading-tight">Receipt</p>
                  <p className="text-[7px] text-slate-400 font-semibold">Slip</p>
                </div>
              </div>

              <div className="absolute bottom-2 -left-6 animate-float-fast bg-white/95 text-slate-800 px-2 py-1 rounded-lg shadow-md border border-slate-100 flex items-center gap-1.5">
                <div className="w-5 h-5 rounded bg-amber-50 flex items-center justify-center">
                  <CreditCard className="w-3 h-3 text-amber-600" />
                </div>
                <div className="text-left">
                  <p className="text-[9px] font-bold leading-tight">Voucher</p>
                  <p className="text-[7px] text-slate-400 font-semibold">Credit</p>
                </div>
              </div>

              <div className="absolute bottom-2 -right-6 animate-float-slow bg-white/95 text-slate-800 px-2 py-1 rounded-lg shadow-md border border-slate-100 flex items-center gap-1.5">
                <div className="w-5 h-5 rounded bg-purple-50 flex items-center justify-center">
                  <BookOpen className="w-3 h-3 text-purple-600" />
                </div>
                <div className="text-left">
                  <p className="text-[9px] font-bold leading-tight">Ledger</p>
                  <p className="text-[7px] text-slate-400 font-semibold">Book</p>
                </div>
              </div>
            </div>
          </div>

          <div className="relative z-20 flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-[10px] text-slate-300 w-fit mx-auto md:mx-0">
            <Shield className="w-3.5 h-3.5 text-blue-400" />
            <span>Secure. Reliable. <span className="text-white font-semibold">Trusted by Businesses.</span></span>
          </div>
        </div>

        {/* RIGHT COLUMN: LOADING */}
        <div className="flex-1 h-full bg-[#f8fafc] flex flex-col justify-between p-4 md:p-6 relative overflow-hidden">
          <div className="my-auto flex items-center justify-center w-full max-w-xl mx-auto py-2">
            <div className="w-full bg-white border border-slate-200/80 rounded-2xl shadow-lg p-6 md:p-10 flex flex-col items-center justify-center min-h-[300px] space-y-4">
              <div className="relative flex items-center justify-center">
                <div className="absolute w-20 h-20 bg-indigo-100/50 rounded-full animate-ping" />
                <div className="relative w-16 h-16 rounded-full bg-white border border-slate-100 shadow-md flex items-center justify-center">
                  <img src="/logo.png" alt="Loading" className="w-8 h-8 object-contain animate-spin" style={{ animationDuration: '3s' }} />
                </div>
              </div>
              <div className="text-center space-y-1">
                <h4 className="font-bold text-slate-900 text-sm">Initializing Workspace</h4>
                <p className="text-slate-400 text-[10px] font-medium">Please wait while we load your secure session...</p>
              </div>
            </div>
          </div>
          <div className="text-center text-[10px] text-slate-400 font-medium mt-8 md:mt-0 relative z-20">
            © 2026 UNAI Billing. All rights reserved.
          </div>
        </div>
      </div>
    );
  }

  const hasCompany = !!activeCompany;

  return (
    <Routes>
      <Route path="/" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <WorkspaceLogin />} />
      <Route path="/join" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Onboarding />} />
      <Route path="/onboarding" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Onboarding />} />
      <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <WorkspaceLogin />} />
      <Route path="/dashboard" element={isAuthenticated ? <Dashboard /> : <Navigate to="/" replace />} />
      <Route path="/documents" element={isAuthenticated ? <Documents /> : <Navigate to="/" replace />} />
      <Route path="/documents/new" element={isAuthenticated ? <CreateDocument /> : <Navigate to="/" replace />} />
      <Route path="/documents/:id" element={isAuthenticated ? <CreateDocument /> : <Navigate to="/" replace />} />
      <Route path="/companies/:id" element={isAuthenticated ? <CompanyEdit /> : <Navigate to="/" replace />} />
      <Route path="/ledger" element={isAuthenticated ? <Ledger /> : <Navigate to="/" replace />} />
      <Route path="/expenses" element={isAuthenticated ? <Expenses /> : <Navigate to="/" replace />} />
      <Route path="/recurring" element={isAuthenticated ? <Recurring /> : <Navigate to="/" replace />} />
      <Route path="/recycle-bin" element={isAuthenticated ? <RecycleBin /> : <Navigate to="/" replace />} />
      <Route path="/employees" element={isAuthenticated ? <Employees /> : <Navigate to="/" replace />} />
      <Route path="/payroll" element={isAuthenticated ? <Payroll /> : <Navigate to="/" replace />} />
      <Route path="/payslips" element={isAuthenticated ? <Payslips /> : <Navigate to="/" replace />} />
      <Route path="/settings" element={isAuthenticated ? <Settings /> : <Navigate to="/" replace />} />
      <Route path="/employeelogin" element={<Navigate to="/login" replace />} />
      <Route path="/preview/:id" element={<PublicPreview />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

const AuthGatedApp = () => {
  return <AppRoutes />;
};

export function App() {
  return (
    <Router>
      <ToastProvider>
        <CompanyProvider>
          <DocumentProvider>
            <AuthGatedApp />
          </DocumentProvider>
        </CompanyProvider>
      </ToastProvider>
    </Router>
  );
}

export default App;
