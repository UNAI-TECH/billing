import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { ChevronRight, X, Lock, Key, Phone, Mail, Shield, Users, AlertCircle, Banknote, Download, BadgeCheck, Printer } from 'lucide-react';
import { useCompany } from '../../contexts/CompanyContext';
import { useDocument } from '../../contexts/DocumentContext';
import { getAllExpenses } from '../../services/db';
import { formatCurrency } from '../../utils/formatting';
import { Button } from '../ui/Button';
import { useToast } from '../ui/Toast';

export const MainLayout = ({ children, title }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);

  const { activeCompany } = useCompany();
  const { documents } = useDocument();
  const { showToast } = useToast();

  const [showSelfProfile, setShowSelfProfile] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'invoices' | 'documents' | 'expenses'>('info');
  const [expenses, setExpenses] = useState<any[]>([]);

  // Get active employee from localStorage
  const activeEmployee = useMemo(() => {
    const employeeJson = localStorage.getItem('activeEmployee');
    if (!employeeJson) return null;
    try {
      return JSON.parse(employeeJson);
    } catch (e) {
      return null;
    }
  }, [showSelfProfile]); // Refresh when modal toggles

  // Load expenses when modal opens
  useEffect(() => {
    if (showSelfProfile && activeCompany?.id) {
      getAllExpenses(activeCompany.id)
        .then(setExpenses)
        .catch(err => console.error('Failed to load expenses for self profile:', err));
    }
  }, [showSelfProfile, activeCompany?.id]);

  // Listen for global open profile events
  useEffect(() => {
    const handleOpen = (e: Event) => {
      const customEvent = e as CustomEvent;
      const tab = customEvent.detail?.tab || 'info';
      setActiveTab(tab);
      setShowSelfProfile(true);
    };
    window.addEventListener('open-self-profile', handleOpen);
    return () => window.removeEventListener('open-self-profile', handleOpen);
  }, []);

  // Aggregated activity for the logged-in employee
  const employeeDocsList = useMemo(() => {
    if (!activeEmployee) return [];
    return documents.filter(doc => doc.createdBy === activeEmployee.name);
  }, [documents, activeEmployee]);

  const employeeExpensesList = useMemo(() => {
    if (!activeEmployee) return [];
    return expenses.filter(exp => exp.createdBy === activeEmployee.name);
  }, [expenses, activeEmployee]);

  const currencySymbol = useMemo(() => {
    return activeCompany?.currency ? activeCompany.currency.split(' ')[1] || '₹' : '₹';
  }, [activeCompany]);

  return (
    <div className="min-h-screen bg-[#f0f7fb] flex flex-col md:flex-row font-sans relative">
      {/* Reopen Sidebar Button (Desktop only) */}
      {!desktopSidebarOpen && (
        <button
          onClick={() => setDesktopSidebarOpen(true)}
          className="hidden md:flex fixed left-0 top-6 z-40 bg-white border border-[#e2e8f0] hover:border-slate-300 shadow-md text-blue-600 hover:text-blue-700 rounded-r-xl p-2.5 transition-all cursor-pointer items-center justify-center active:scale-95 animate-in slide-in-from-left duration-200"
          title="Show Sidebar"
        >
          <ChevronRight className="w-5 h-5 stroke-[2.5]" />
        </button>
      )}

      {/* Desktop Sidebar */}
      {desktopSidebarOpen && (
        <Sidebar 
          className="hidden md:flex animate-in slide-in-from-left duration-200" 
          onCollapse={() => setDesktopSidebarOpen(false)}
        />
      )}

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-64 bg-white h-full z-10 flex flex-col animate-in slide-in-from-left duration-200">
            <Sidebar 
              className="flex border-r-0 h-full" 
              onCollapse={() => setMobileMenuOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Main Content Body */}
      <div className="flex-1 flex flex-col min-w-0 relative">


        <div className="md:hidden sticky top-0 z-30">
          <Header 
            onMenuToggle={() => setMobileMenuOpen(true)} 
            isSidebarOpen={false}
            title={title} 
            onProfileClick={() => {
              setActiveTab('info');
              setShowSelfProfile(true);
            }}
          />
        </div>

        <main className="flex-1 p-4 md:p-8 w-full max-w-(--breakpoint-2xl) mx-auto">
          {children}
        </main>

        {/* Detailed Profile View Modal ("Big Card" for Self) */}
        {showSelfProfile && activeEmployee && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
            <div 
              className="absolute inset-0 cursor-pointer" 
              onClick={() => setShowSelfProfile(false)}
            />
            <div className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-200">
              
              {/* Header */}
              <div className="flex items-center justify-between p-6 pb-4 border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-3.5">
                  <div className="relative">
                    {activeEmployee.photo ? (
                      <img 
                        src={activeEmployee.photo} 
                        alt={activeEmployee.name} 
                        className="w-16 h-16 rounded-2xl object-cover border border-slate-200/80 shadow-xs" 
                      />
                    ) : (
                      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center font-extrabold text-lg uppercase shadow-xs bg-indigo-50 border border-indigo-100 text-indigo-600`}>
                        {activeEmployee.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-extrabold text-slate-900 text-lg leading-tight">{activeEmployee.name}</h3>
                      {activeEmployee.isAdmin && (
                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded bg-amber-50 border border-amber-100 text-amber-700 text-[10px] font-bold">
                          <Shield className="w-3 h-3 text-amber-500" />
                          Admin
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 font-semibold mt-1">
                      {activeEmployee.designation || 'Staff'} • Joined {new Date(activeEmployee.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <Button
                  variant="outline"
                  className="rounded-xl px-4 py-2 text-xs font-bold cursor-pointer border border-slate-250/70 text-slate-700 bg-white hover:bg-slate-50"
                  onClick={() => setShowSelfProfile(false)}
                >
                  Close Profile
                </Button>
              </div>

              {/* Navigation Tabs */}
              <div className="flex border-b border-slate-100 bg-slate-50/50 px-6 shrink-0">
                <button
                  onClick={() => setActiveTab('info')}
                  className={`py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                    activeTab === 'info' 
                      ? 'border-indigo-600 text-indigo-600' 
                      : 'border-transparent text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Overview & Access
                </button>
                <button
                  onClick={() => setActiveTab('invoices')}
                  className={`py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'invoices' 
                      ? 'border-indigo-600 text-indigo-600' 
                      : 'border-transparent text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <span>Invoices</span>
                  <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">
                    {employeeDocsList.filter(d => d.documentType === 'invoice').length}
                  </span>
                </button>
                <button
                  onClick={() => setActiveTab('documents')}
                  className={`py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'documents' 
                      ? 'border-indigo-600 text-indigo-600' 
                      : 'border-transparent text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <span>Vouchers & Receipts</span>
                  <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">
                    {employeeDocsList.filter(d => d.documentType !== 'invoice').length}
                  </span>
                </button>
                <button
                  onClick={() => setActiveTab('expenses')}
                  className={`py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'expenses' 
                      ? 'border-indigo-600 text-indigo-600' 
                      : 'border-transparent text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <span>Expenses</span>
                  <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">
                    {employeeExpensesList.length}
                  </span>
                </button>
              </div>

              {/* Modal Body Content */}
              <div className="flex-1 overflow-y-auto p-6">
                
                {/* 1. Overview Tab */}
                {activeTab === 'info' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      
                      {/* Personal Contact Details */}
                      <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 space-y-4">
                        <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Contact Details</h4>
                        
                        <div className="space-y-3">
                          <div className="flex items-center gap-3 text-xs">
                            <Lock className="w-4 h-4 text-slate-400" />
                            <div>
                              <p className="text-[10px] text-slate-400 font-semibold">Employee ID</p>
                              <p className="font-mono font-bold text-slate-800">{activeEmployee.loginId}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 text-xs">
                            <Key className="w-4 h-4 text-slate-400" />
                            <div>
                              <p className="text-[10px] text-slate-400 font-semibold">Password</p>
                              <p className="font-mono font-bold text-slate-800">{activeEmployee.password}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 text-xs">
                            <Phone className="w-4 h-4 text-slate-400" />
                            <div>
                              <p className="text-[10px] text-slate-400 font-semibold">Phone Number</p>
                              <p className="font-semibold text-slate-800">{activeEmployee.phone || 'Not provided'}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 text-xs">
                            <Mail className="w-4 h-4 text-slate-400" />
                            <div>
                              <p className="text-[10px] text-slate-400 font-semibold">Email Address</p>
                              <p className="font-semibold text-slate-800 truncate max-w-[200px]" title={activeEmployee.email}>
                                {activeEmployee.email || 'Not provided'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 text-xs">
                            <Banknote className="w-4 h-4 text-slate-400" />
                            <div>
                              <p className="text-[10px] text-slate-400 font-semibold">Salary</p>
                              <p className="font-bold text-emerald-700">
                                {activeEmployee.salary !== undefined && activeEmployee.salary !== ''
                                  ? formatCurrency(Number(activeEmployee.salary), currencySymbol)
                                  : 'Not provided'}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Summary Metrics */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-blue-50/50 border border-blue-100/60 rounded-2xl p-4 flex flex-col justify-between">
                          <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Total Invoices</span>
                          <div className="mt-4">
                            <p className="text-2xl font-black text-blue-900 leading-none">
                              {employeeDocsList.filter(d => d.documentType === 'invoice').length}
                            </p>
                            <p className="text-[9px] text-blue-500 font-semibold mt-1">Generated by you</p>
                          </div>
                        </div>

                        <div className="bg-purple-50/50 border border-purple-100/60 rounded-2xl p-4 flex flex-col justify-between">
                          <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider">Other Docs</span>
                          <div className="mt-4">
                            <p className="text-2xl font-black text-purple-900 leading-none">
                              {employeeDocsList.filter(d => d.documentType !== 'invoice').length}
                            </p>
                            <p className="text-[9px] text-purple-500 font-semibold mt-1">Vouchers & Receipts</p>
                          </div>
                        </div>

                        <div className="bg-rose-50/50 border border-rose-100/60 rounded-2xl p-4 flex flex-col justify-between col-span-2">
                          <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">Total Expenses Logs</span>
                          <div className="mt-4 flex justify-between items-end">
                            <div>
                              <p className="text-2xl font-black text-rose-900 leading-none">
                                {employeeExpensesList.length}
                              </p>
                              <p className="text-[9px] text-rose-500 font-semibold mt-1">Total transactions logged</p>
                            </div>
                            <span className="text-xs font-bold text-rose-750 bg-rose-100/60 px-2 py-0.5 rounded-lg">
                              Sum: {formatCurrency(employeeExpensesList.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0), currencySymbol)}
                            </span>
                          </div>
                        </div>
                      </div>

                    </div>

                    {/* Permissions list */}
                    <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 space-y-3">
                      <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Your Features & Privileges</h4>
                      
                      {activeEmployee.isAdmin ? (
                        <div className="flex gap-2.5 items-start p-3 bg-amber-50 border border-amber-100/60 rounded-xl">
                          <Shield className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-xs font-bold text-slate-900">Administrator Access Enabled</p>
                            <p className="text-[10px] text-slate-500 mt-0.5 leading-normal">
                              You are designated as an Admin and have full system-wide read and write permissions.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          {Object.entries(activeEmployee.permissions || {}).map(([permKey, val]) => {
                            const labels: Record<string, string> = {
                              viewDocuments: 'View Documents & Lists',
                              addInvoice: 'Create Customer Invoices',
                              addVoucher: 'Create Voucher Logs',
                              addReceipt: 'Create Payment Receipts',
                              addExpense: 'Add Expense Particulars',
                              viewLedger: 'View Company Ledger',
                              accessRecycleBin: 'Access Recycle Bin',
                              accessRecurringPayments: 'Access Cash Flow'
                            };
                            return (
                              <div key={permKey} className="flex items-center gap-2 p-2 bg-white border border-slate-100 rounded-xl">
                                <span className={`w-2 h-2 rounded-full ${val ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                                <span className={`font-semibold ${val ? 'text-slate-700' : 'text-slate-400 line-through'}`}>
                                  {labels[permKey] || permKey}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 2. Invoices Tab */}
                {activeTab === 'invoices' && (
                  <div className="space-y-4">
                    {employeeDocsList.filter(d => d.documentType === 'invoice').length === 0 ? (
                      <div className="text-center py-12 bg-slate-50 border border-slate-100 rounded-2xl text-slate-400">
                        <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-xs font-bold">No Invoices Saved</p>
                        <p className="text-[10px] mt-0.5">You haven't created any invoices yet.</p>
                      </div>
                    ) : (
                      <div className="border border-slate-100 rounded-2xl overflow-hidden divide-y divide-slate-100 bg-white">
                        {employeeDocsList.filter(d => d.documentType === 'invoice').map(doc => (
                          <div key={doc.id} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-all text-xs">
                            <div className="space-y-1">
                              <span className="font-mono font-bold text-slate-900">{doc.documentNumber}</span>
                              <p className="text-[10px] text-slate-400 font-semibold">
                                To: {doc.customer?.customerName || 'N/A'} • {new Date(doc.documentDate || doc.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                doc.status === 'Paid' ? 'bg-emerald-50 border border-emerald-100 text-emerald-700' : 'bg-rose-50 border border-rose-100 text-rose-700'
                              }`}>
                                {doc.status}
                              </span>
                              <span className="font-bold text-slate-800">
                                {formatCurrency(doc.totals?.grandTotal || parseFloat(doc.amount) || 0, currencySymbol)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 3. Vouchers & Receipts Tab */}
                {activeTab === 'documents' && (
                  <div className="space-y-4">
                    {employeeDocsList.filter(d => d.documentType !== 'invoice').length === 0 ? (
                      <div className="text-center py-12 bg-slate-50 border border-slate-100 rounded-2xl text-slate-400">
                        <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-xs font-bold">No Vouchers or Receipts</p>
                        <p className="text-[10px] mt-0.5">You haven't created any vouchers or receipts yet.</p>
                      </div>
                    ) : (
                      <div className="border border-slate-100 rounded-2xl overflow-hidden divide-y divide-slate-100 bg-white">
                        {employeeDocsList.filter(d => d.documentType !== 'invoice').map(doc => (
                          <div key={doc.id} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-all text-xs">
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono font-bold text-slate-900">{doc.documentNumber}</span>
                                <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[9px] font-bold uppercase">{doc.documentType}</span>
                              </div>
                              <p className="text-[10px] text-slate-400 font-semibold">
                                {doc.voucherType || (doc.documentType === 'receipt' ? 'Receipt' : 'Other')} • {new Date(doc.documentDate || doc.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-slate-500 max-w-[150px] truncate" title={doc.paidTo || doc.receivedFrom}>
                                {doc.paidTo || doc.receivedFrom}
                              </span>
                              <span className="font-bold text-slate-800">
                                {formatCurrency(doc.totals?.grandTotal || parseFloat(doc.amount) || 0, currencySymbol)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 4. Expenses Tab */}
                {activeTab === 'expenses' && (
                  <div className="space-y-4">
                    {employeeExpensesList.length === 0 ? (
                      <div className="text-center py-12 bg-slate-50 border border-slate-100 rounded-2xl text-slate-400">
                        <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-xs font-bold">No Expenses Logged</p>
                        <p className="text-[10px] mt-0.5">You haven't logged any expenses yet.</p>
                      </div>
                    ) : (
                      <div className="border border-slate-100 rounded-2xl overflow-hidden divide-y divide-slate-100 bg-white">
                        {employeeExpensesList.map(exp => (
                          <div key={exp.id} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-all text-xs">
                            <div className="space-y-1">
                              <span className="font-bold text-slate-900">{exp.particulars}</span>
                              <p className="text-[10px] text-slate-400 font-semibold">
                                {exp.category} • {new Date(exp.date || exp.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-slate-500 font-medium">{exp.paidVia || 'Cash'}</span>
                              <span className="font-bold text-rose-600">
                                {formatCurrency(parseFloat(exp.amount) || 0, currencySymbol)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  );
};
