import React, { useState } from 'react';
import { useCompany, defaultCompanyState } from '../contexts/CompanyContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Button } from '../components/ui/Button';
import { LogoUploader } from '../components/company/LogoUploader';

import { validateEmail, validateGST, validatePAN, validatePhone, validatePassword } from '../utils/formatting';
import { joinCompanyByCode, loginAsEmployee } from '../services/db';
import { 
  Check, ArrowRight, ArrowLeft, Building2, Landmark, Sliders, 
  UserPlus, KeyRound, Copy, Lock, Hash, Shield, 
  FileText, Receipt, CreditCard, BookOpen, Eye, EyeOff, User, AlertCircle 
} from 'lucide-react';
import { useToast } from '../components/ui/Toast';

// Premium brand logo component
const BrandLogo = ({ className = "w-6 h-6" }) => (
  <svg className={className} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="brand-grad" x1="0" y1="0" x2="80" y2="80" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#6366f1" />
        <stop offset="50%" stopColor="#4f46e5" />
        <stop offset="100%" stopColor="#3b82f6" />
      </linearGradient>
    </defs>
    <path d="M16 20v24c0 8.8 7.2 16 16 16s16-7.2 16-16V36c0-4.4 3.6-8 8-8s8 3.6 8 8v16c0 2.2 1.8 4 4 4s4-1.8 4-4V36c0-8.8-7.2-16-16-16s-16 7.2-16 16v8c0 4.4-3.6 8-8 8s-8-3.6-8-8V20c0-2.2-1.8-4-4-4s-4 1.8-4 4z" fill="url(#brand-grad)" />
  </svg>
);

export const Onboarding = () => {
  const { saveCompanyProfile, activeCompany, switchCompany, setAuthenticatedState, isAuthenticated } = useCompany();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const location = useLocation();

  // If already authenticated and active company exists, do NOT show onboarding form (don't fall back)
  React.useEffect(() => {
    if (isAuthenticated && activeCompany) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, activeCompany, navigate]);

  // Mode derived from URL pathname: '/' -> choose, '/onboarding' -> new, '/join' -> join
  const getModeFromPath = (path) => {
    if (path === '/onboarding') return 'new';
    if (path === '/join') return 'join';
    return 'choose';
  };

  const mode = getModeFromPath(location.pathname);

  // ==================
  // NEW COMPANY STATE
  // ==================
  const [step, setStep] = useState(1); // 1 = Details, 2 = Bank, 3 = Defaults, 4 = Password
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState(defaultCompanyState);
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [companyPassword, setCompanyPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [createdCode, setCreatedCode] = useState('');
  const [showCompanyPassword, setShowCompanyPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showJoinPassword, setShowJoinPassword] = useState(false);
  // ==================
  // JOIN COMPANY STATE
  // ==================
  const [joinCode, setJoinCode] = useState('');
  const [joinPassword, setJoinPassword] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState('');

  // ==================
  // EMPLOYEE LOGIN STATE
  // ==================
  const [empCompanyCode, setEmpCompanyCode] = useState('');
  const [empLoginId, setEmpLoginId] = useState('');
  const [empPassword, setEmpPassword] = useState('');
  const [showEmpPassword, setShowEmpPassword] = useState(false);
  const [empLoading, setEmpLoading] = useState(false);
  const [empError, setEmpError] = useState('');

  // ==================
  // FORM HELPERS
  // ==================
  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: null }));
  };

  const updateBankField = (field, value) => {
    setFormData(prev => ({
      ...prev,
      bankDetails: { ...prev.bankDetails, [field]: value }
    }));
  };

  const generateCompanyCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  };

  const validateStep1 = () => {
    const errs: Record<string, string | null> = {};
    if (!formData.companyName.trim()) errs.companyName = 'Company Name is required.';
    if (formData.email && !validateEmail(formData.email)) errs.email = 'Invalid email address.';
    if (formData.gstNumber && !validateGST(formData.gstNumber)) errs.gstNumber = 'Invalid GSTIN format.';
    if (formData.panNumber && !validatePAN(formData.panNumber)) errs.panNumber = 'Invalid PAN format.';
    if (formData.phone && !validatePhone(formData.phone)) errs.phone = 'Phone number must be exactly 10 digits.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateStep4 = () => {
    const errs: Record<string, string | null> = {};
    
    if (!companyPassword) {
      errs.password = 'Password is required.';
    } else if (!validatePassword(companyPassword)) {
      errs.password = 'Password must be at least 8 characters, containing uppercase, lowercase, and a symbol.';
    }
    
    if (companyPassword !== confirmPassword) {
      errs.confirmPassword = 'Passwords do not match.';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ==================
  // HANDLERS
  // ==================
  const handleFinishNewCompany = async () => {
    if (!validateStep4()) return;

    setIsSubmitting(true);
    try {
      const code = generateCompanyCode();
      const dataWithAuth = {
        ...formData,
        companyCode: code,
        companyPassword: companyPassword,
      };
      localStorage.removeItem('activeEmployee');
      setAuthenticatedState(true);
      const saved = await saveCompanyProfile(dataWithAuth);
      await switchCompany(saved.id);
      
      try {
        localStorage.setItem('justCreatedCompany', JSON.stringify({
          id: saved.id,
          name: saved.companyName || formData.companyName,
          code: code,
          password: companyPassword,
          timestamp: Date.now()
        }));
      } catch (e) {
        console.error('Failed to store justCreatedCompany', e);
      }

      showToast(`Workspace "${saved.companyName || formData.companyName}" created successfully!`, 'success');
      
      // Straight go to that particular company dashboard without intermediate screens
      navigate('/dashboard', { replace: true });
    } catch (err) {
      console.error(err);
      showToast('Failed to create company profile.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoinCompany = async () => {
    setJoinError('');
    if (!joinCode.trim()) { setJoinError('Company ID is required.'); return; }
    if (!joinPassword.trim()) { setJoinError('Password is required.'); return; }

    setJoinLoading(true);
    try {
      const company = await joinCompanyByCode(joinCode, joinPassword);
      localStorage.removeItem('activeEmployee');
      await saveCompanyProfile(company);
      setAuthenticatedState(true);
      showToast(`Joined "${company.companyName}" successfully!`, 'success');
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      setJoinError(err.message || 'Failed to join company.');
    } finally {
      setJoinLoading(false);
    }
  };
  const handleEmpLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmpError('');

    if (!empLoginId.trim()) { setEmpError('Employee ID is required.'); return; }
    if (!empPassword.trim()) { setEmpError('Password is required.'); return; }

    setEmpLoading(true);
    try {
      const { company, employee } = await loginAsEmployee(
        '',
        empLoginId.trim(),
        empPassword.trim()
      );
      
      if (employee.mustChangePassword) {
        await saveCompanyProfile(company);
        localStorage.setItem('activeEmployee', JSON.stringify(employee));
        showToast('First time login. Redirecting to set your new password.', 'info');
        navigate('/login');
        return;
      }
      
      await saveCompanyProfile(company);
      localStorage.setItem('activeEmployee', JSON.stringify(employee));
      setAuthenticatedState(true);
      showToast(`Welcome back, ${employee.name}!`, 'success');
      navigate('/dashboard');
    } catch (err: any) {
      setEmpError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setEmpLoading(false);
    }
  };
  const copyCode = () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(createdCode);
        showToast('Company ID copied to clipboard!', 'success');
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = createdCode;
        textArea.style.position = "fixed";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showToast('Company ID copied to clipboard!', 'success');
      }
    } catch (err) {
      console.error(err);
      showToast('Could not copy automatically. Please select and copy manually.', 'warning');
    }
  };

  const copyPasswordToClipboard = () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(companyPassword);
        showToast('Password copied to clipboard!', 'success');
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = companyPassword;
        textArea.style.position = "fixed";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showToast('Password copied to clipboard!', 'success');
      }
    } catch (err) {
      console.error(err);
      showToast('Could not copy automatically. Please select and copy manually.', 'warning');
    }
  };

  if (mode === 'new') {
    return (
      <div className="min-h-screen bg-[#fafbfe] flex flex-col items-center justify-between p-4 md:p-8 font-sans overflow-y-auto">
        
        {step < 5 && (
          <>
            {/* Top Header */}
            <div className="w-full max-w-3xl mb-6 md:mb-8 flex items-center justify-between border-b border-slate-200/80 pb-4 mt-2 md:mt-4">
              <button
                type="button"
                onClick={() => {
                  if (step > 1) {
                    setStep(step - 1);
                  } else {
                    navigate('/login');
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer border border-slate-200 active:scale-95 shrink-0"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-slate-600" />
                <span>Back</span>
              </button>

              <div className="text-xs text-slate-400 font-bold shrink-0">
                Step {step} of 4
              </div>
            </div>

            {/* Stepper */}
            <div className="w-full max-w-3xl mb-8">
              <div className="flex items-center justify-between relative">
                {/* Connecting Line */}
                <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-200 -translate-y-1/2 z-0"></div>
                {/* Highlighted active line */}
                <div 
                  className="absolute top-1/2 left-0 h-0.5 bg-indigo-600 -translate-y-1/2 z-0 transition-all duration-300"
                  style={{ width: `${((step - 1) / 3) * 100}%` }}
                ></div>
                
                {/* Steps */}
                {[
                  { num: 1, label: 'Details' },
                  { num: 2, label: 'Bank Coordinates' },
                  { num: 3, label: 'Invoice Defaults' },
                  { num: 4, label: 'Workspace Security' }
                ].map((s) => {
                  const isActive = step === s.num;
                  const isCompleted = step > s.num;
                  return (
                    <div key={s.num} className="flex flex-col items-center relative z-10">
                      <div 
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 border-2 ${
                          isActive 
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100 scale-110' 
                            : isCompleted 
                              ? 'bg-indigo-600 border-indigo-600 text-white' 
                              : 'bg-white border-slate-200 text-slate-400'
                        }`}
                      >
                        {isCompleted ? <Check className="w-4 h-4 stroke-[3px]" /> : s.num}
                      </div>
                      <span 
                        className={`text-[10px] font-bold mt-2 transition-colors duration-300 ${
                          isActive ? 'text-indigo-600' : 'text-slate-400'
                        }`}
                      >
                        {s.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Main Form Card */}
            <div className="w-full max-w-3xl bg-white border border-indigo-100/80 rounded-3xl shadow-xs p-6 md:p-10 space-y-6">
              
              {/* Form Header */}
              <div className="space-y-1 pb-4 border-b border-slate-100">
                <h2 className="text-xl font-bold text-slate-800 tracking-tight">
                  {step === 1 && "Business Profile Details"}
                  {step === 2 && "Bank Coordinates"}
                  {step === 3 && "Invoice Defaults"}
                  {step === 4 && "Workspace Security"}
                </h2>
                <p className="text-xs text-slate-500">
                  {step === 1 && "Enter the essential details for your invoice headers and profile."}
                  {step === 2 && "Coordinate accounts so payments can be routed directly to you."}
                  {step === 3 && "Configure billing styles, prefixes, and starting invoice numbers."}
                  {step === 4 && "Setup a secure workspace password to prevent unauthorized access."}
                </p>
              </div>

              {/* Form Content */}
              <div className="space-y-5">
                {step === 1 && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Input label="Company Name" required placeholder="e.g. Acma Solutions Pvt Ltd" value={formData.companyName} onChange={(e) => updateField('companyName', e.target.value)} error={errors.companyName} />
                      <Select label="Business Type" value={formData.businessType} onChange={(e) => updateField('businessType', e.target.value)}>
                        <option value="Private Limited">Private Limited</option>
                        <option value="Proprietorship">Proprietorship</option>
                        <option value="Partnership">Partnership</option>
                        <option value="LLP">Limited Liability Partnership (LLP)</option>
                        <option value="Freelancer">Freelancer / Independent</option>
                        <option value="NGO">NGO / Non-Profit</option>
                        <option value="Other">Other</option>
                      </Select>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <LogoUploader label="Company Header Logo" value={formData.logo} onChange={(val) => updateField('logo', val)} />
                      <LogoUploader label="Document Watermark Image" value={formData.watermarkLogo} onChange={(val) => updateField('watermarkLogo', val)} />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Input label="GST Number (GSTIN)" placeholder="e.g. 27AAAAA0000A1Z5" value={formData.gstNumber} onChange={(e) => updateField('gstNumber', e.target.value.toUpperCase())} error={errors.gstNumber} />
                      <Input label="PAN Number" placeholder="e.g. ABCDE1234F" value={formData.panNumber} onChange={(e) => updateField('panNumber', e.target.value.toUpperCase())} error={errors.panNumber} />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <Input label="Email Address" type="email" placeholder="billing@company.com" value={formData.email} onChange={(e) => updateField('email', e.target.value)} error={errors.email} />
                      <Input label="Phone Number" placeholder="+91 98765 43210" value={formData.phone} onChange={(e) => updateField('phone', e.target.value)} error={errors.phone} />
                      <Input label="Website" placeholder="https://company.com" value={formData.website} onChange={(e) => updateField('website', e.target.value)} />
                    </div>
                    <Input label="Address" placeholder="Street address, Suite, Floor" value={formData.address} onChange={(e) => updateField('address', e.target.value)} />
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <Input label="City" placeholder="Mumbai" value={formData.city} onChange={(e) => updateField('city', e.target.value)} />
                      <Input label="State" placeholder="Maharashtra" value={formData.state} onChange={(e) => updateField('state', e.target.value)} />
                      <Input label="Country" value={formData.country} onChange={(e) => updateField('country', e.target.value)} />
                      <Input label="Pincode" placeholder="400001" value={formData.pincode} onChange={(e) => updateField('pincode', e.target.value)} />
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-4">
                    <p className="text-[11px] text-slate-500 leading-relaxed bg-blue-50/50 border border-blue-100 rounded-xl p-3">
                      Enter bank coordinates below so client payments can be routed directly to your account.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Input label="Bank Name" placeholder="HDFC Bank" value={formData.bankDetails?.bankName || ''} onChange={(e) => updateBankField('bankName', e.target.value)} />
                      <Input label="Account Holder" placeholder="Acma Solutions Pvt Ltd" value={formData.bankDetails?.accountHolder || ''} onChange={(e) => updateBankField('accountHolder', e.target.value)} />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <Input label="Account Number" placeholder="50200012345678" value={formData.bankDetails?.accountNumber || ''} onChange={(e) => updateBankField('accountNumber', e.target.value)} />
                      <Input label="IFSC Code" placeholder="HDFC0001234" value={formData.bankDetails?.ifsc || ''} onChange={(e) => updateBankField('ifsc', e.target.value.toUpperCase())} />
                      <Input label="Branch" placeholder="Nariman Point, Mumbai" value={formData.bankDetails?.branch || ''} onChange={(e) => updateBankField('branch', e.target.value)} />
                    </div>
                    <Input label="UPI ID (VPA)" placeholder="company@hdfcbank" value={formData.bankDetails?.upiId || ''} onChange={(e) => updateBankField('upiId', e.target.value)} />
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <Input label="Invoice Prefix" value={formData.invoicePrefix} onChange={(e) => updateField('invoicePrefix', e.target.value)} />
                      <Input label="Starting Invoice #" type="number" value={formData.invoiceStartNumber} onChange={(e) => updateField('invoiceStartNumber', parseInt(e.target.value, 10) || 1001)} />
                      <Select label="Currency" value={formData.currency} onChange={(e) => updateField('currency', e.target.value)}>
                        <option value="INR ₹">INR ₹ (Indian Rupee)</option>
                        <option value="USD $">USD $ (US Dollar)</option>
                        <option value="EUR €">EUR € (Euro)</option>
                        <option value="GBP £">GBP £ (British Pound)</option>
                      </Select>
                    </div>

                  </div>
                )}

                {step === 4 && (
                  <div className="space-y-5 max-w-sm mx-auto py-2">
                    <div className="text-center space-y-2">
                      <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 mb-1">
                        <KeyRound className="w-5 h-5 text-amber-600" />
                      </div>
                      <h4 className="font-bold text-slate-900 text-base">Secure Your Workspace</h4>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        Set a strong shared password for your team to join and collaborate in this company workspace.
                      </p>
                      
                      <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-3 text-left max-w-xs mx-auto space-y-1 text-[10px] text-slate-500">
                        <p className="font-bold text-slate-605 mb-1">Password requirements:</p>
                        <div className="flex items-center gap-1.5">
                          <div className={`w-1.5 h-1.5 rounded-full transition-colors ${companyPassword.length >= 8 ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                          <span>At least 8 characters</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className={`w-1.5 h-1.5 rounded-full transition-colors ${/[A-Z]/.test(companyPassword) ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                          <span>At least one uppercase letter (Cap)</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className={`w-1.5 h-1.5 rounded-full transition-colors ${/[a-z]/.test(companyPassword) ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                          <span>At least one lowercase letter</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className={`w-1.5 h-1.5 rounded-full transition-colors ${/\d/.test(companyPassword) ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                          <span>At least one number</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className={`w-1.5 h-1.5 rounded-full transition-colors ${/[^A-Za-z0-9]/.test(companyPassword) ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                          <span>At least one symbol (special character)</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-3.5">
                      <div>
                        <label htmlFor="companyPassword" className="block text-xs font-semibold text-slate-800 mb-1.5">Workspace Password</label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                            id="companyPassword"
                            name="companyPassword"
                            type={showCompanyPassword ? "text" : "password"}
                            value={companyPassword}
                            onChange={(e) => setCompanyPassword(e.target.value)}
                            onPaste={(e) => {
                              e.preventDefault();
                              const pastedText = e.clipboardData.getData('text');
                              setCompanyPassword(pastedText);
                            }}
                            placeholder="Min. 8 characters"
                            className="w-full pl-9 pr-10 py-2.5 text-sm border border-slate-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                            autoComplete="new-password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowCompanyPassword(!showCompanyPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                          >
                            {showCompanyPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        {errors.password && <p className="text-xs text-rose-600 mt-1">{errors.password}</p>}
                      </div>

                      <div>
                        <label htmlFor="confirmPassword" className="block text-xs font-semibold text-slate-800 mb-1.5">Confirm Password</label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                            id="confirmPassword"
                            name="confirmPassword"
                            type={showConfirmPassword ? "text" : "password"}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            onPaste={(e) => {
                              e.preventDefault();
                              const pastedText = e.clipboardData.getData('text');
                              setConfirmPassword(pastedText);
                            }}
                            placeholder="Re-enter password"
                            className="w-full pl-9 pr-10 py-2.5 text-sm border border-slate-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                            autoComplete="new-password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                          >
                            {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        {errors.confirmPassword && <p className="text-xs text-rose-600 mt-1">{errors.confirmPassword}</p>}
                      </div>
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* Footer Buttons */}
            <div className="w-full max-w-3xl mt-6 flex items-center justify-between pb-8">
              {step > 1 ? (
                <Button 
                  variant="outline" 
                  icon={ArrowLeft} 
                  onClick={() => setStep(step - 1)}
                >
                  Back
                </Button>
              ) : (
                <Button 
                  variant="outline" 
                  icon={ArrowLeft} 
                  onClick={() => navigate('/')}
                >
                  Exit Setup
                </Button>
              )}

              <span className="text-xs text-slate-400 font-bold tracking-wider">
                {step} / 4
              </span>

              {step < 4 ? (
                <Button 
                  icon={ArrowRight} 
                  onClick={() => { if (step === 1 && !validateStep1()) return; setStep(step + 1); }}
                >
                  Continue
                </Button>
              ) : (
                <Button 
                  icon={Check} 
                  onClick={handleFinishNewCompany}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Creating Workspace...' : 'Create Workspace'}
                </Button>
              )}
            </div>
          </>
        )}

        {/* Step 5: Success screen centered */}
        {step === 5 && (
          <div className="my-auto w-full max-w-md bg-white border border-indigo-100 rounded-3xl shadow-xs p-8 text-center space-y-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-50 border-4 border-white shadow-lg text-emerald-600">
              <Check className="w-8 h-8" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-slate-900">Workspace Ready!</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Your profile is created. Share the Company ID and password with your team members so they can log in.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 max-w-xs mx-auto space-y-4">
              <div className="space-y-1">
                <label className="block text-[9px] uppercase font-extrabold text-slate-400 tracking-wider">Company ID</label>
                <div className="flex items-center gap-2 justify-center bg-white border border-slate-200 rounded-xl p-2">
                  <span className="text-lg font-black tracking-widest text-indigo-600 font-mono select-all pl-1">{createdCode}</span>
                  <button onClick={copyCode} className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors" title="Copy Company ID">
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="space-y-1 border-t border-slate-200 pt-3">
                <label className="block text-[9px] uppercase font-extrabold text-slate-400 tracking-wider">Workspace Password</label>
                <div className="flex items-center gap-2 justify-center bg-white border border-slate-200 rounded-xl p-2">
                  <span className="text-sm font-bold text-slate-800 font-mono select-all pl-1">{companyPassword}</span>
                  <button onClick={copyPasswordToClipboard} className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors" title="Copy Password">
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <Button 
                className="w-full" 
                icon={ArrowRight} 
                onClick={() => navigate('/dashboard')}
              >
                Enter Workspace
              </Button>
            </div>
          </div>
        )}

        {/* Footer Credit */}
        <div className="text-center text-[10px] text-slate-400 font-medium pb-4">
          © 2026 UNAI Billing. All rights reserved.
        </div>

      </div>
    );
  }

  return (
    <div className="min-h-screen md:h-screen md:max-h-screen flex flex-col md:flex-row bg-[#fafbfe] md:bg-[#080d27] font-sans overflow-y-auto md:overflow-hidden">
      
      {/* ==================================================== */}
      {/* LEFT COLUMN: BRANDING & 3D NEON VISUALS (HIDDEN ON MOBILE) */}
      {/* ==================================================== */}
      <div className="hidden md:flex md:w-[38%] h-full relative overflow-hidden bg-gradient-to-br from-[#060a22] via-[#091540] to-[#040817] flex-col justify-between p-6 md:p-8 text-white shrink-0">
        
        {/* Decorative Wave Divider on Desktop */}
        <div className="absolute top-0 bottom-0 right-0 w-20 hidden md:block z-10 pointer-events-none">
          <svg className="h-full w-full" viewBox="0 0 100 1000" preserveAspectRatio="none" fill="none">
            <path d="M100,0 L0,0 C40,150 80,350 80,500 C80,650 40,850 0,1000 L100,1000 Z" fill="#f8fafc" />
          </svg>
        </div>

        {/* Brand Header */}
        <div className="flex items-center relative z-20">
          <img src="/logo.png" alt="UNAI Logo" className="h-10 sm:h-11 w-auto object-contain" />
        </div>

        {/* Center 3D Pedestal and floating badges */}
        <div className="my-auto py-2 relative z-20 flex flex-col items-center">
          
          {/* Main Headline */}
          <div className="text-center md:text-left md:w-full max-w-sm mb-6 space-y-2">
            <h2 className="text-xl md:text-2xl font-extrabold tracking-tight leading-tight">
              Billing <span className="text-white/80">made simple.</span><br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-sky-400 to-cyan-400">Business</span> made stronger.
            </h2>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Create invoices, vouchers, receipts and ledgers with ease. Manage your finance, your way.
            </p>
          </div>

          {/* 3D Pedestal Representation */}
          <div className="relative w-56 h-40 flex items-center justify-center">
            
            {/* Glowing neon aura */}
            <div className="absolute w-44 h-44 bg-blue-500/10 rounded-full filter blur-2xl animate-pulse-slow"></div>

            {/* Authentic 3D Pedestal and Logo Image from un.png */}
            <div className="absolute inset-0 animate-float-slow flex items-center justify-center">
              <img src="/un.png" alt="UNAI 3D" className="w-full h-full object-contain filter drop-shadow-[0_8px_16px_rgba(99,102,241,0.3)]" />
            </div>

            {/* FLOATING MICRO CARDS */}
            {/* 1. Invoice Card (Top Right) */}
            <div className="absolute top-2 -right-6 animate-float-medium bg-white/95 text-slate-800 px-2 py-1 rounded-lg shadow-md border border-slate-100 flex items-center gap-1.5">
              <div className="w-5 h-5 rounded bg-blue-50 flex items-center justify-center">
                <FileText className="w-3 h-3 text-blue-600" />
              </div>
              <div className="text-left">
                <p className="text-[9px] font-bold leading-tight">Invoice</p>
                <p className="text-[7px] text-slate-400 font-semibold">Generate A4</p>
              </div>
            </div>

            {/* 2. Receipt Card (Mid Left) */}
            <div className="absolute top-12 -left-10 animate-float-slow bg-white/95 text-slate-800 px-2 py-1 rounded-lg shadow-md border border-slate-100 flex items-center gap-1.5">
              <div className="w-5 h-5 rounded bg-emerald-50 flex items-center justify-center">
                <Receipt className="w-3 h-3 text-emerald-600" />
              </div>
              <div className="text-left">
                <p className="text-[9px] font-bold leading-tight">Receipt</p>
                <p className="text-[7px] text-slate-400 font-semibold">Slip</p>
              </div>
            </div>

            {/* 3. Voucher Card (Bottom Left) */}
            <div className="absolute bottom-2 -left-6 animate-float-fast bg-white/95 text-slate-800 px-2 py-1 rounded-lg shadow-md border border-slate-100 flex items-center gap-1.5">
              <div className="w-5 h-5 rounded bg-amber-50 flex items-center justify-center">
                <CreditCard className="w-3 h-3 text-amber-600" />
              </div>
              <div className="text-left">
                <p className="text-[9px] font-bold leading-tight">Voucher</p>
                <p className="text-[7px] text-slate-400 font-semibold">Credit</p>
              </div>
            </div>

            {/* 4. Ledger Card (Bottom Right) */}
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

        {/* Bottom Secure Pill */}
        <div className="relative z-20 flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-[10px] text-slate-300 w-fit mx-auto md:mx-0">
          <Shield className="w-3.5 h-3.5 text-blue-400" />
          <span>Secure. Reliable. <span className="text-white font-semibold">Trusted by Businesses.</span></span>
        </div>

      </div>

      {/* ==================================================== */}
      {/* RIGHT COLUMN: DYNAMIC WORKSPACES & CONTROLS */}
      {/* ==================================================== */}
      <div className="flex-1 min-h-screen md:min-h-0 md:h-full bg-[#f8fafc] flex flex-col justify-between p-4 md:p-6 relative overflow-y-auto md:overflow-hidden">
        
        {/* Mobile Header with Back Button (Left) & Logo (Right) */}
        <div className="flex md:hidden items-center justify-between w-full mb-3 pt-2">
          <button
            onClick={() => navigate('/login')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer border border-slate-200 active:scale-95"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-slate-600" />
            <span>Back</span>
          </button>

          <div className="flex items-center gap-2">
            <div className="flex items-center">
              <img src="/logo.png" alt="UNAI Logo" className="h-9 w-auto object-contain" />
            </div>
          </div>
        </div>

        {/* Top-Right Action Links on Desktop */}
        <div className="hidden md:flex absolute top-6 right-6 z-50 items-center gap-2">
          <button
            onClick={() => { navigate('/onboarding'); setStep(1); }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-slate-900 text-xs font-extrabold shadow-sm transition-all cursor-pointer active:scale-95 border border-indigo-200"
          >
            <Building2 className="w-4 h-4 text-indigo-600" />
            <span className="text-slate-900 font-bold">New Company</span>
            <ArrowRight className="w-3.5 h-3.5 text-indigo-600" />
          </button>
          
          <button
            onClick={() => navigate('/join')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-slate-900 text-xs font-extrabold shadow-sm transition-all cursor-pointer active:scale-95 border border-emerald-200"
          >
            <UserPlus className="w-4 h-4 text-emerald-600" />
            <span className="text-slate-900 font-bold">Join Company</span>
            <ArrowRight className="w-3.5 h-3.5 text-emerald-600" />
          </button>
        </div>

        {/* Center Dynamic Interface */}
        <div className="my-auto flex items-center justify-center w-full max-w-xl mx-auto py-2">
          
          {/* Card Wrapper with Mockup Shadow styling */}
          <div className="w-full bg-white border border-slate-200/80 rounded-2xl shadow-lg p-5 md:p-8 relative overflow-hidden transition-all duration-300">
            
            {/* ========== CHOOSE MODE: EMPLOYEE LOGIN IN CENTER ========== */}
            {mode === 'choose' && (
              <form onSubmit={handleEmpLoginSubmit} className="space-y-6" autoComplete="off">
                <div className="text-center space-y-2">
                  <h3 className="font-bold text-slate-900 text-lg">Employee Login</h3>
                  <p className="text-xs text-slate-500 font-medium">Enter your credentials to log in.</p>
                </div>

                <div className="space-y-4 max-w-sm mx-auto">

                  {/* Employee ID */}
                  <div>
                    <label htmlFor="empLoginId" className="block text-xs font-semibold text-slate-800 mb-1.5">Employee ID</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        id="empLoginId"
                        name="empLoginId"
                        type="text"
                        value={empLoginId}
                        onChange={(e) => setEmpLoginId(e.target.value)}
                        placeholder="e.g. company001"
                        className="w-full pl-9 pr-3 py-2.5 text-xs border border-slate-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none text-slate-800"
                        required
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div>
                    <label htmlFor="empPassword" className="block text-xs font-semibold text-slate-800 mb-1.5">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        id="empPassword"
                        name="empPassword"
                        type={showEmpPassword ? "text" : "password"}
                        value={empPassword}
                        onChange={(e) => setEmpPassword(e.target.value)}
                        placeholder="Enter password"
                        className="w-full pl-9 pr-10 py-2.5 text-xs border border-slate-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none text-slate-800"
                        autoComplete="current-password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowEmpPassword(!showEmpPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none bg-transparent border-none cursor-pointer p-0"
                      >
                        {showEmpPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {empError && (
                    <div className="bg-rose-50 border border-rose-100 text-rose-700 text-xs px-3.5 py-2.5 rounded-xl font-semibold flex items-center gap-1.5 animate-shake">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>{empError}</span>
                    </div>
                  )}

                  <div className="pt-2">
                    <Button
                      type="submit"
                      className="w-full bg-indigo-650 hover:bg-indigo-700 text-white py-2.5"
                      icon={ArrowRight}
                      disabled={empLoading}
                    >
                      {empLoading ? 'Logging in...' : 'Login'}
                    </Button>
                  </div>
                </div>
              </form>
            )}

            {/* ========== JOIN COMPANY SCREEN ========== */}
            {mode === 'join' && (
              <div className="space-y-6">
                <div className="text-center space-y-2">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-50 border border-emerald-100 mb-2">
                    <UserPlus className="w-6 h-6 text-emerald-600" />
                  </div>
                  <h3 className="font-bold text-slate-900 text-lg">Join Existing Company</h3>
                  <p className="text-xs text-slate-500 font-medium">Enter details to access the company workspace.</p>
                </div>

                <div className="space-y-4 max-w-sm mx-auto">
                  <div>
                    <label htmlFor="joinCode" className="block text-xs font-semibold text-slate-800 mb-1.5">Company ID</label>
                    <div className="relative">
                      <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        id="joinCode"
                        name="joinCode"
                        type="text"
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                        onPaste={(e) => {
                          e.preventDefault();
                          const pastedText = e.clipboardData.getData('text');
                          setJoinCode(pastedText.trim().toUpperCase());
                        }}
                        placeholder="e.g. AB3K9X"
                        className="w-full pl-9 pr-3 py-2.5 text-sm font-mono tracking-widest border border-slate-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none uppercase"
                        maxLength={10}
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="joinPassword" className="block text-xs font-semibold text-slate-800 mb-1.5">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        id="joinPassword"
                        name="joinPassword"
                        type={showJoinPassword ? "text" : "password"}
                        value={joinPassword}
                        onChange={(e) => setJoinPassword(e.target.value)}
                        onPaste={(e) => {
                          e.preventDefault();
                          const pastedText = e.clipboardData.getData('text');
                          setJoinPassword(pastedText);
                        }}
                        placeholder="Enter company password"
                        className="w-full pl-9 pr-10 py-2.5 text-sm border border-slate-350 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowJoinPassword(!showJoinPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                      >
                        {showJoinPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {joinError && (
                    <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs px-3 py-2 rounded-xl font-medium">
                      {joinError}
                    </div>
                  )}

                  <div className="pt-2 flex items-center gap-3">
                    <Button
                      variant="outline"
                      className="w-1/3"
                      icon={ArrowLeft}
                      onClick={() => navigate('/')}
                    >
                      Back
                    </Button>
                    <Button
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                      icon={ArrowRight}
                      onClick={handleJoinCompany}
                      disabled={joinLoading}
                    >
                      {joinLoading ? 'Joining...' : 'Join Company'}
                    </Button>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Footer Credit */}
        <div className="text-center text-[10px] text-slate-400 font-medium mt-8 md:mt-0 relative z-20">
          © 2026 UNAI Billing. All rights reserved.
        </div>

      </div>

    </div>
  );
};
