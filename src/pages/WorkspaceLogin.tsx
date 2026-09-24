import React, { useState } from 'react';
import { useCompany } from '../contexts/CompanyContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { loginAsEmployee, getCompanyEmployees, saveCompanyEmployees } from '../services/db';
import { 
  Shield, Lock, User, Eye, EyeOff, AlertCircle, 
  ArrowRight, Building2, KeyRound, UserPlus,
  FileText, Receipt, CreditCard, BookOpen, X, ArrowLeft, CheckCircle2, Check
} from 'lucide-react';
import { useToast } from '../components/ui/Toast';
import { validatePassword } from '../utils/formatting';

export const WorkspaceLogin = () => {
  const { activeCompany, companies, switchCompany, saveCompanyProfile, setAuthenticatedState } = useCompany();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [selectedCompanyId] = useState<string>('');

  const currentCompany = React.useMemo(() => {
    if (selectedCompanyId) {
      const found = companies.find(c => c.id === selectedCompanyId);
      if (found) return found;
    }
    return activeCompany || companies[0] || null;
  }, [selectedCompanyId, companies, activeCompany]);

  // Mobile login modal state
  const [showMobileEmployeeCard, setShowMobileEmployeeCard] = useState(false);
  
  // Employee credentials
  const [employeeLoginId, setEmployeeLoginId] = useState('');
  const [employeePassword, setEmployeePassword] = useState('');
  const [showEmployeePassword, setShowEmployeePassword] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Password reset states for employee force reset
  const [mustChangeScreen, setMustChangeScreen] = useState(false);
  const [tempEmployee, setTempEmployee] = useState<any>(null);
  const [tempCompany, setTempCompany] = useState<any>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [changePasswordLoading, setChangePasswordLoading] = useState(false);

  const handleEmployeeLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanLoginId = employeeLoginId.trim();
    const cleanPassword = employeePassword.trim();

    if (!cleanLoginId) {
      setErrorMsg('Employee ID is required.');
      return;
    }
    if (!cleanPassword) {
      setErrorMsg('Password is required.');
      return;
    }

    setLoading(true);
    try {
      // 1. Check if entered credentials match company workspace / admin credentials
      const matchingCompany = companies.find(c => 
        (c.companyCode && c.companyCode.toUpperCase() === cleanLoginId.toUpperCase() && c.companyPassword === cleanPassword) ||
        (currentCompany && currentCompany.id === c.id && c.companyPassword === cleanPassword)
      ) || (currentCompany && currentCompany.companyPassword === cleanPassword ? currentCompany : null);

      if (matchingCompany) {
        await switchCompany(matchingCompany.id);
        localStorage.removeItem('activeEmployee'); // admin is active
        setAuthenticatedState(true);
        showToast(`Welcome back to ${matchingCompany.companyName}!`, 'success');
        navigate('/dashboard', { replace: true });
        return;
      }

      // 2. Otherwise authenticate as employee
      const companyCodeToUse = currentCompany?.companyCode || cleanLoginId.toUpperCase();
      const { company, employee } = await loginAsEmployee(
        companyCodeToUse,
        cleanLoginId,
        cleanPassword
      );

      setTempCompany(company);
      setTempEmployee(employee);
      
      if (employee.mustChangePassword) {
        setMustChangeScreen(true);
        setNewPassword('');
        setConfirmPassword('');
        showToast('Temporary password verified. Please create your permanent password.', 'info');
        return;
      }
      
      // Save company profile in context & switch to this company
      await saveCompanyProfile(company);
      await switchCompany(company.id);
      // Set active employee session
      localStorage.setItem('activeEmployee', JSON.stringify(employee));
      setAuthenticatedState(true);
      
      showToast(`Welcome back, ${employee.name}!`, 'success');
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      setErrorMsg(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanNewPass = newPassword.trim();
    const cleanConfirmPass = confirmPassword.trim();

    if (!cleanNewPass) {
      setErrorMsg('New password is required.');
      return;
    }
    if (!validatePassword(cleanNewPass)) {
      setErrorMsg('Password must be at least 8 characters, containing uppercase, lowercase, and a symbol.');
      return;
    }
    if (cleanNewPass !== cleanConfirmPass) {
      setErrorMsg('Passwords do not match.');
      return;
    }
    if (tempEmployee && tempEmployee.password === cleanNewPass) {
      setErrorMsg('New password cannot be the same as your temporary password.');
      return;
    }

    const targetCompany = tempCompany || activeCompany;
    if (!targetCompany || !tempEmployee) {
      setErrorMsg('Session expired. Please try logging in again.');
      return;
    }

    setChangePasswordLoading(true);
    try {
      const employees = await getCompanyEmployees(targetCompany.id);
      let updatedEmployee: any = null;
      const updatedList = employees.map(e => {
        if (e.id === tempEmployee.id || (e.loginId && e.loginId.toLowerCase() === tempEmployee.loginId.toLowerCase())) {
          updatedEmployee = {
            ...e,
            password: cleanNewPass,
            mustChangePassword: false,
            passwordSetByEmployee: true,
            passwordUpdatedAt: new Date().toISOString()
          };
          return updatedEmployee;
        }
        return e;
      });

      if (!updatedEmployee) {
        updatedEmployee = {
          ...tempEmployee,
          password: cleanNewPass,
          mustChangePassword: false,
          passwordSetByEmployee: true,
          passwordUpdatedAt: new Date().toISOString()
        };
        updatedList.push(updatedEmployee);
      }

      await saveCompanyEmployees(targetCompany.id, updatedList);

      // Directly log employee into their workspace
      await saveCompanyProfile(targetCompany);
      await switchCompany(targetCompany.id);
      localStorage.setItem('activeEmployee', JSON.stringify(updatedEmployee));
      setAuthenticatedState(true);

      showToast(`Password updated successfully! Welcome to your workspace, ${updatedEmployee.name || tempEmployee.name}!`, 'success');
      navigate('/dashboard');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update password.');
    } finally {
      setChangePasswordLoading(false);
    }
  };

  const renderCardContent = () => (
    <>
      {mustChangeScreen ? (
        <div className="space-y-5">
          <div className="text-center space-y-1.5 mb-1">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-indigo-50 border border-indigo-100 mb-1 shadow-xs">
              <KeyRound className="w-6 h-6 text-indigo-600" />
            </div>
            <h3 className="font-bold text-slate-900 text-lg">Create Your Password</h3>
            <p className="text-xs text-slate-500 font-medium">First-time login: Set your permanent password to access your workspace.</p>
          </div>

          <form onSubmit={handleChangePasswordSubmit} className="space-y-4">
            {/* Readonly Employee ID field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-800">Employee ID</label>
                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-200/60 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-indigo-600" />
                  Permanent ID
                </span>
              </div>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-600" />
                <input
                  type="text"
                  value={tempEmployee?.loginId || employeeLoginId}
                  disabled
                  readOnly
                  className="w-full pl-10 pr-4 py-2.5 bg-indigo-50/50 border border-indigo-200/70 rounded-xl text-xs font-bold text-indigo-950 select-none cursor-not-allowed font-mono tracking-wide shadow-xs"
                />
              </div>
              <p className="text-[10px] text-slate-400 font-medium mt-1">
                Your Employee ID remains unchanged for all future logins.
              </p>
            </div>

            {/* New Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1.5">New Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => { setNewPassword(e.target.value); setErrorMsg(''); }}
                  placeholder="Enter new strong password"
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-600 text-slate-800 placeholder-slate-400 transition-all font-mono"
                  required
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 bg-transparent border-none cursor-pointer p-0"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm New Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1.5">Confirm New Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setErrorMsg(''); }}
                  placeholder="Confirm your new password"
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-600 text-slate-800 placeholder-slate-400 transition-all font-mono"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 bg-transparent border-none cursor-pointer p-0"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Password Requirements Checklist */}
            <div className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1.5 text-[11px]">
              <span className="font-bold text-slate-700 block text-[10px] uppercase tracking-wider">Password Requirements:</span>
              <div className="grid grid-cols-1 gap-1 text-slate-600">
                <div className={`flex items-center gap-1.5 ${newPassword.length >= 8 ? 'text-emerald-600 font-bold' : 'text-slate-500'}`}>
                  <Check className={`w-3 h-3 ${newPassword.length >= 8 ? 'text-emerald-600 stroke-[3]' : 'text-slate-300'}`} />
                  <span>At least 8 characters</span>
                </div>
                <div className={`flex items-center gap-1.5 ${/[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword) ? 'text-emerald-600 font-bold' : 'text-slate-500'}`}>
                  <Check className={`w-3 h-3 ${/[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword) ? 'text-emerald-600 stroke-[3]' : 'text-slate-300'}`} />
                  <span>Uppercase & lowercase letters</span>
                </div>
                <div className={`flex items-center gap-1.5 ${/[0-9]/.test(newPassword) && /[^A-Za-z0-9]/.test(newPassword) ? 'text-emerald-600 font-bold' : 'text-slate-500'}`}>
                  <Check className={`w-3 h-3 ${/[0-9]/.test(newPassword) && /[^A-Za-z0-9]/.test(newPassword) ? 'text-emerald-600 stroke-[3]' : 'text-slate-300'}`} />
                  <span>At least one number & symbol</span>
                </div>
              </div>
            </div>

            {errorMsg && (
              <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-100 text-rose-600 px-3.5 py-2.5 rounded-xl text-[11px] font-bold text-left animate-shake">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setMustChangeScreen(false);
                  setNewPassword('');
                  setConfirmPassword('');
                  setErrorMsg('');
                }}
                className="px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold text-xs transition-all cursor-pointer"
                disabled={changePasswordLoading}
              >
                Cancel
              </button>
              <Button
                type="submit"
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md active:scale-95"
                disabled={changePasswordLoading}
              >
                {changePasswordLoading ? 'Saving...' : 'Set Password & Enter Workspace'}
              </Button>
            </div>
          </form>
        </div>
      ) : (
        <div className="space-y-4">
          <form onSubmit={handleEmployeeLogin} className="space-y-4">
            <div className="text-center space-y-1">
              <h3 className="font-bold text-slate-900 text-lg">Employee Login</h3>
              <p className="text-xs text-slate-500 font-medium">Enter your credentials to access your workspace.</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">Employee ID</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={employeeLoginId}
                  onChange={(e) => { setEmployeeLoginId(e.target.value); setErrorMsg(''); }}
                  placeholder="e.g. company001"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-600 text-slate-800 placeholder-slate-400 transition-all"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type={showEmployeePassword ? "text" : "password"}
                  value={employeePassword}
                  onChange={(e) => { setEmployeePassword(e.target.value); setErrorMsg(''); }}
                  placeholder="Enter password"
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-600 text-slate-800 placeholder-slate-400 transition-all font-mono"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowEmployeePassword(!showEmployeePassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 bg-transparent border-none cursor-pointer p-0"
                >
                  {showEmployeePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {errorMsg && (
              <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-100 text-rose-600 px-3.5 py-2.5 rounded-xl text-[11px] font-bold text-left animate-shake">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{errorMsg}</span>
              </div>
            )}

            <Button
              type="submit"
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md active:scale-95"
              disabled={loading}
            >
              {loading ? 'Authenticating...' : 'Authenticate'}
            </Button>
          </form>
        </div>
      )}
    </>
  );

  return (
    <div className="min-h-screen md:h-screen md:max-h-screen flex flex-col md:flex-row bg-[#f8fafc] md:bg-[#080d27] font-sans overflow-y-auto md:overflow-hidden md:bg-gradient-to-br md:from-[#060a22] md:via-[#091540] md:to-[#040817] text-slate-900 md:text-white">
      
      {/* MOBILE FULL-SCREEN OVERLAY FOR EMPLOYEE LOGIN CARD */}
      {showMobileEmployeeCard && (
        <div className="fixed inset-0 z-50 bg-[#f8fafc] p-4 sm:p-6 flex flex-col justify-between md:hidden animate-fadeIn">
          {/* Header: Back button on LEFT, Logo block on RIGHT */}
          <div className="flex items-center justify-between z-20 w-full mb-3 pt-2">
            <button
              type="button"
              onClick={() => setShowMobileEmployeeCard(false)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer border border-slate-200 active:scale-95"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-slate-600" />
              <span>Back</span>
            </button>

            <div className="flex items-center">
              <img src="/logo.png" alt="UNAI Logo" className="h-9 w-auto object-contain" />
            </div>
          </div>

          <div className="my-auto flex items-center justify-center w-full max-w-md mx-auto py-2">
            <div className="w-full bg-white border border-slate-200/80 rounded-2xl shadow-xl p-5 sm:p-6 relative overflow-hidden">
              {renderCardContent()}
            </div>
          </div>

          <div className="text-center text-[10px] text-slate-400 font-medium py-2">
            © 2026 UNAI Billing. All rights reserved.
          </div>
        </div>
      )}

      {/* LEFT COLUMN / MOBILE HERO: BRANDING & VISUALS */}
      <div className="w-full md:w-[38%] h-screen md:h-full relative overflow-hidden bg-[#f8fafc] md:bg-gradient-to-br md:from-[#060a22] md:via-[#091540] md:to-[#040817] flex flex-col justify-between p-4 sm:p-6 md:p-8 text-slate-900 md:text-white shrink-0">
        
        {/* Wave Divider on Desktop */}
        <div className="absolute top-0 bottom-0 right-0 w-20 hidden md:block z-10 pointer-events-none">
          <svg className="h-full w-full" viewBox="0 0 100 1000" preserveAspectRatio="none" fill="none">
            <path d="M100,0 L0,0 C40,150 80,350 80,500 C80,650 40,850 0,1000 L100,1000 Z" fill="#f8fafc" />
          </svg>
        </div>

        {/* Brand Header (Left) & Mobile Navigation Header */}
        <div className="flex flex-col gap-2 relative z-20 w-full mb-3 md:mb-0">
          <div className="flex items-center justify-between w-full">
            {/* Logo */}
            <div className="flex items-center">
              <img src="/logo.png" alt="UNAI Logo" className="h-10 sm:h-11 w-auto object-contain" />
            </div>

            {/* Prominent Blue Employee Login Button with Arrow on Mobile */}
            <div className="md:hidden">
              <button
                type="button"
                onClick={() => setShowMobileEmployeeCard(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md transition-all cursor-pointer active:scale-95 border border-blue-400/40"
              >
                <span>Employee Login</span>
                <ArrowRight className="w-3.5 h-3.5 text-white" />
              </button>
            </div>
          </div>

          {/* Under Employee Login: New Company & Join Company buttons stacked vertically (Join Company under New Company) */}
          <div className="flex flex-col items-end gap-1.5 md:hidden pt-1">
            <button
              type="button"
              onClick={() => navigate('/onboarding')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-slate-900 text-xs font-bold transition-all cursor-pointer border border-indigo-200 active:scale-95 shadow-xs"
            >
              <Building2 className="w-3.5 h-3.5 text-indigo-600" />
              <span>New Company</span>
              <ArrowRight className="w-3 h-3 text-indigo-600" />
            </button>
            
            <button
              type="button"
              onClick={() => navigate('/join')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-slate-900 text-xs font-bold transition-all cursor-pointer border border-emerald-200 active:scale-95 shadow-xs"
            >
              <UserPlus className="w-3.5 h-3.5 text-emerald-600" />
              <span>Join Company</span>
              <ArrowRight className="w-3 h-3 text-emerald-600" />
            </button>
          </div>
        </div>

        {/* Center 3D visual & Headline */}
        <div className="my-auto py-2 md:py-4 relative z-20 flex flex-col items-center">
          <div className="text-center md:text-left w-full max-w-sm mb-4 md:mb-6 space-y-1.5 md:space-y-2">
            <h2 className="text-xl md:text-2xl font-extrabold tracking-tight leading-tight text-slate-900 md:text-white">
              Billing <span className="text-slate-600 md:text-white/80">made simple.</span><br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-sky-600 to-indigo-600 md:from-blue-400 md:via-sky-400 md:to-cyan-400">Business</span> made stronger.
            </h2>
            <p className="text-slate-600 md:text-slate-400 text-[11px] leading-relaxed">
              Create invoices, vouchers, receipts and ledgers with ease. Manage your finance, your way.
            </p>
          </div>

          <div className="relative w-56 h-36 sm:h-40 flex items-center justify-center my-2">
            <div className="absolute w-44 h-44 bg-blue-500/10 rounded-full filter blur-2xl animate-pulse-slow"></div>
            <div className="absolute inset-0 animate-float-slow flex items-center justify-center">
              <img src="/un.png" alt="UNAI 3D" className="w-full h-full object-contain filter drop-shadow-[0_8px_16px_rgba(99,102,241,0.3)]" />
            </div>

            <div className="absolute top-2 -right-2 sm:-right-6 animate-float-medium bg-white/95 text-slate-800 px-2 py-1 rounded-lg shadow-md border border-slate-100 flex items-center gap-1.5">
              <div className="w-4 h-4 sm:w-5 sm:h-5 rounded bg-blue-50 flex items-center justify-center shrink-0">
                <FileText className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-blue-600" />
              </div>
              <div className="text-left">
                <p className="text-[8px] sm:text-[9px] font-bold leading-tight">Invoice</p>
                <p className="text-[6px] sm:text-[7px] text-slate-400 font-semibold">Generate A4</p>
              </div>
            </div>

            <div className="absolute top-10 -left-2 sm:-left-10 animate-float-slow bg-white/95 text-slate-800 px-2 py-1 rounded-lg shadow-md border border-slate-100 flex items-center gap-1.5">
              <div className="w-4 h-4 sm:w-5 sm:h-5 rounded bg-emerald-50 flex items-center justify-center shrink-0">
                <Receipt className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-emerald-600" />
              </div>
              <div className="text-left">
                <p className="text-[8px] sm:text-[9px] font-bold leading-tight">Receipt</p>
                <p className="text-[6px] sm:text-[7px] text-slate-400 font-semibold">Slip</p>
              </div>
            </div>

            <div className="absolute bottom-1 -left-2 sm:-left-6 animate-float-fast bg-white/95 text-slate-800 px-2 py-1 rounded-lg shadow-md border border-slate-100 flex items-center gap-1.5">
              <div className="w-4 h-4 sm:w-5 sm:h-5 rounded bg-amber-50 flex items-center justify-center shrink-0">
                <CreditCard className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-600" />
              </div>
              <div className="text-left">
                <p className="text-[8px] sm:text-[9px] font-bold leading-tight">Voucher</p>
                <p className="text-[6px] sm:text-[7px] text-slate-400 font-semibold">Credit</p>
              </div>
            </div>

            <div className="absolute bottom-1 -right-2 sm:-right-6 animate-float-slow bg-white/95 text-slate-800 px-2 py-1 rounded-lg shadow-md border border-slate-100 flex items-center gap-1.5">
              <div className="w-4 h-4 sm:w-5 sm:h-5 rounded bg-purple-50 flex items-center justify-center shrink-0">
                <BookOpen className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-purple-600" />
              </div>
              <div className="text-left">
                <p className="text-[8px] sm:text-[9px] font-bold leading-tight">Ledger</p>
                <p className="text-[6px] sm:text-[7px] text-slate-400 font-semibold">Book</p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-20 flex items-center gap-1.5 bg-slate-100 md:bg-white/5 border border-slate-200 md:border-white/10 rounded-lg px-3 py-1.5 text-[10px] text-slate-600 md:text-slate-300 w-fit mx-auto md:mx-0 my-2 md:my-0">
          <Shield className="w-3.5 h-3.5 text-blue-600 md:text-blue-400 shrink-0" />
          <span>Secure. Reliable. <span className="text-slate-900 md:text-white font-semibold">Trusted by Businesses.</span></span>
        </div>

        <div className="md:hidden text-center text-[10px] text-slate-400 font-medium py-3 relative z-20">
          © 2026 UNAI Billing. All rights reserved.
        </div>
      </div>

      {/* RIGHT COLUMN: LOGIN FORM CONTAINER (HIDDEN ON MOBILE, DISPLAYED ON DESKTOP) */}
      <div className="hidden md:flex flex-1 h-auto md:h-full bg-transparent md:bg-[#f8fafc] flex-col justify-between p-4 sm:p-6 relative overflow-y-auto md:overflow-hidden">
        
        <div className="hidden md:flex absolute top-6 right-6 z-50 items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/onboarding')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-slate-900 text-xs font-extrabold shadow-sm transition-all cursor-pointer active:scale-95 border border-indigo-200"
          >
            <Building2 className="w-4 h-4 text-indigo-600" />
            <span className="text-slate-900 font-bold">New Company</span>
            <ArrowRight className="w-3.5 h-3.5 text-indigo-600" />
          </button>
          
          <button
            type="button"
            onClick={() => navigate('/join')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-slate-900 text-xs font-extrabold shadow-sm transition-all cursor-pointer active:scale-95 border border-emerald-200"
          >
            <UserPlus className="w-4 h-4 text-emerald-600" />
            <span className="text-slate-900 font-bold">Join Company</span>
            <ArrowRight className="w-3.5 h-3.5 text-emerald-600" />
          </button>
        </div>

        <div className="my-auto flex items-center justify-center w-full max-w-md mx-auto py-2">
          <div id="employee-login-card" className="w-full bg-[#0d153a]/80 md:bg-white border border-blue-500/20 md:border-slate-200/80 rounded-2xl shadow-2xl md:shadow-lg p-5 sm:p-6 md:p-8 relative overflow-hidden backdrop-blur-xl md:backdrop-blur-none">
            {renderCardContent()}
          </div>
        </div>

        <div className="text-center text-[10px] text-slate-400 md:text-slate-400 font-medium py-3 relative z-20">
          © 2026 UNAI Billing. All rights reserved.
        </div>
      </div>

    </div>
  );
};
