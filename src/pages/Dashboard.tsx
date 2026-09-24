import React, { useMemo, useState, useRef, useEffect } from 'react';
import { MainLayout } from '../components/layout/MainLayout';
import { useCompany } from '../contexts/CompanyContext';
import { useDocument } from '../contexts/DocumentContext';
import { useNavigate } from 'react-router-dom';
import { formatCurrency } from '../utils/formatting';
import { downloadDocumentPDF } from '../services/pdfGenerator';
import { TemplateWrapper } from '../templates/TemplateWrapper';
import { calculateTotals } from '../utils/calculations';
import { InvoiceChart } from '../components/dashboard/InvoiceChart';
import { getAllExpenses, getAllRecurringReminders } from '../services/db';
import { 
  FileText, 
  Receipt, 
  CreditCard, 
  Plus, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  ChevronDown,
  UserPlus,
  Megaphone,
  FolderOpen,
  Sparkles,
  X,
  LayoutDashboard,
  BookOpen,
  Wallet,
  Trash2,
  Settings,
  Banknote,
  LogOut,
  Copy
} from 'lucide-react';
import { useToast } from '../components/ui/Toast';
import GradientWaves from '../components/ui/GradientWaves';


// Helper component for count-up animation
const AnimatedCardValue = ({ targetValue, isCurrency, currencySymbol, duration = 1200, triggerKey }) => {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    setCurrent(0); // Reset immediately on trigger
    let startTimestamp = null;
    const startValue = 0;
    const endValue = parseFloat(targetValue) || 0;
    let animationFrameId = null;

    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      // Cubic ease-out
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      
      setCurrent(startValue + easedProgress * (endValue - startValue));

      if (progress < 1) {
        animationFrameId = window.requestAnimationFrame(step);
      }
    };

    animationFrameId = window.requestAnimationFrame(step);

    return () => {
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId);
      }
    };
  }, [targetValue, duration, triggerKey]);

  if (isCurrency) {
    return formatCurrency(current, currencySymbol);
  }
  
  // Format standard integer count-up without decimals
  return Math.round(current).toLocaleString('en-IN');
};

// Helper component for circular progress with count-up animation
const CircularProgress = ({ 
  percent, 
  gradientId, 
  gradientStart, 
  gradientEnd, 
  trackColor, 
  size = 56, 
  strokeWidth = 5, 
  duration = 1200,
  triggerKey
}) => {
  const [currentPercent, setCurrentPercent] = useState(0);
  
  useEffect(() => {
    setCurrentPercent(0); // Reset immediately on trigger
    let startTimestamp = null;
    const startVal = 0;
    const endVal = Math.max(parseFloat(percent) || 0, 0);
    let animationFrameId = null;

    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      
      setCurrentPercent(startVal + easedProgress * (endVal - startVal));

      if (progress < 1) {
        animationFrameId = window.requestAnimationFrame(step);
      }
    };

    animationFrameId = window.requestAnimationFrame(step);

    return () => {
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId);
      }
    };
  }, [percent, duration, triggerKey]);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - Math.min(currentPercent / 100, 1) * circumference;

  return (
    <div className="relative flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={gradientStart} />
            <stop offset="100%" stopColor={gradientEnd} />
          </linearGradient>
        </defs>
        {/* Track circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all ease-out duration-100"
        />
      </svg>
      {/* Percentage Text centered */}
      <span className="absolute text-[11px] font-extrabold text-slate-800 tracking-tight">
        {Math.round(currentPercent)}%
      </span>
    </div>
  );
};

export const Dashboard = () => {
  const { activeCompany, switchCompany, setAuthenticatedState } = useCompany();
  const { documents } = useDocument();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const handleSignOut = async () => {
    try {
      localStorage.removeItem('activeEmployee');
      setAuthenticatedState(false);
      await switchCompany(null);
      navigate('/');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const employeeJson = localStorage.getItem('activeEmployee');
  const activeEmployee = employeeJson ? (() => {
    try { return JSON.parse(employeeJson); } catch (e) { return null; }
  })() : null;

  const canAddInvoice = !activeEmployee || activeEmployee.isAdmin || activeEmployee.permissions.addInvoice;
  const canAddVoucher = !activeEmployee || activeEmployee.isAdmin || activeEmployee.permissions.addVoucher;
  const canAddReceipt = !activeEmployee || activeEmployee.isAdmin || activeEmployee.permissions.addReceipt;
  const canCreateAnyDoc = canAddInvoice || canAddVoucher || canAddReceipt;

  const [createMenuOpen, setCreateMenuOpen] = useState(false);

  // Close speed dial menu on click outside
  useEffect(() => {
    if (!createMenuOpen) return;
    const handleClose = () => setCreateMenuOpen(false);
    window.addEventListener('click', handleClose);
    return () => window.removeEventListener('click', handleClose);
  }, [createMenuOpen]);

  const [expenses, setExpenses] = useState([]);
  const [recurringReminders, setRecurringReminders] = useState([]);

  const displayDocuments = useMemo(() => {
    if (activeEmployee && !activeEmployee.isAdmin) {
      return documents.filter(doc => doc.createdBy === activeEmployee.name);
    }
    return documents;
  }, [documents, activeEmployee]);

  const displayExpenses = useMemo(() => {
    if (activeEmployee && !activeEmployee.isAdmin) {
      return expenses.filter(exp => exp.createdBy === activeEmployee.name);
    }
    return expenses;
  }, [expenses, activeEmployee]);

  const displayRecurringReminders = useMemo(() => {
    if (activeEmployee && !activeEmployee.isAdmin) {
      return [];
    }
    return recurringReminders;
  }, [recurringReminders, activeEmployee]);

  const [isWelcomeHovered, setIsWelcomeHovered] = useState(false);
  const [showSpotlight, setShowSpotlight] = useState(false);
  const [showWhatsNew, setShowWhatsNew] = useState(false);

  // Newly created workspace banner state
  const [justCreatedData, setJustCreatedData] = useState<any>(() => {
    try {
      const stored = localStorage.getItem('justCreatedCompany');
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      return null;
    }
  });

  const dismissWelcomeBanner = () => {
    localStorage.removeItem('justCreatedCompany');
    setJustCreatedData(null);
  };

  const copyCompanyCode = () => {
    if (!justCreatedData?.code) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(justCreatedData.code);
        showToast('Company ID copied to clipboard!', 'success');
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = justCreatedData.code;
        textArea.style.position = "fixed";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showToast('Company ID copied to clipboard!', 'success');
      }
    } catch (err) {
      showToast('Could not copy automatically.', 'warning');
    }
  };

  // Show salary reminder red dot if current date is between 29th and 2nd inclusive
  const showSalaryReminderDot = useMemo(() => {
    const today = new Date();
    const day = today.getDate();
    return day >= 29 || day <= 2;
  }, []);

  // Animation triggers for hover / touch events
  const [recurringIncomeYearlyTrigger, setRecurringIncomeYearlyTrigger] = useState(0);
  const [invoicedTrigger, setInvoicedTrigger] = useState(0);
  const [overdueTrigger, setOverdueTrigger] = useState(0);
  const [recurringIncomeTrigger, setRecurringIncomeTrigger] = useState(0);
  const [recurringOutcomeTrigger, setRecurringOutcomeTrigger] = useState(0);
  const [expensesTrigger, setExpensesTrigger] = useState(0);

  const currencySymbol = useMemo(() => {
    return activeCompany?.currency ? activeCompany.currency.split(' ')[1] || '₹' : '₹';
  }, [activeCompany]);

  useEffect(() => {
    const loadDashboardData = async () => {
      if (!activeCompany?.id) return;
      try {
        const [expensesData, recurringData] = await Promise.all([
          getAllExpenses(activeCompany.id),
          getAllRecurringReminders(activeCompany.id)
        ]);
        setExpenses(expensesData);
        setRecurringReminders(recurringData);
      } catch (err) {
        console.error('Failed to load data for dashboard:', err);
      }
    };
    loadDashboardData();
  }, [activeCompany?.id, documents]);

  const renderQuickActions = (isMobile = false) => {
    const canSettings = !activeEmployee || activeEmployee.isAdmin;
    const canEmployees = !activeEmployee || activeEmployee.isAdmin;
    const canInvoice = !activeEmployee || activeEmployee.isAdmin || activeEmployee.permissions.addInvoice;
    const canDocs = !activeEmployee || activeEmployee.isAdmin || activeEmployee.permissions.viewDocuments;
    const canLedger = !activeEmployee || activeEmployee.isAdmin || activeEmployee.permissions.viewLedger;
    const canExpenses = !activeEmployee || activeEmployee.isAdmin || activeEmployee.permissions.addExpense;
    const canRecurring = !activeEmployee || activeEmployee.isAdmin || activeEmployee.permissions.accessRecurringPayments;
    const canRecycle = !activeEmployee || activeEmployee.isAdmin || activeEmployee.permissions.accessRecycleBin;
    const canPayroll = !activeEmployee || activeEmployee.isAdmin;

    if (isMobile) {
      const mobileItems = [
        {
          show: canEmployees,
          onClick: () => navigate('/employees'),
          bgClass: 'bg-blue-50 text-blue-600 border border-blue-100/30',
          icon: <UserPlus className="w-5 h-5 stroke-[2.2]" />,
          label: 'Employees'
        },
        {
          show: canPayroll,
          onClick: () => navigate('/payroll'),
          bgClass: 'bg-purple-50 text-purple-600 border border-purple-100/30',
          icon: (
            <>
              <Banknote className="w-5 h-5 stroke-[2.2]" />
              {showSalaryReminderDot && (
                <span className="absolute top-1 right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </span>
              )}
            </>
          ),
          label: 'Payroll'
        },
        {
          show: canDocs,
          onClick: () => navigate('/documents'),
          bgClass: 'bg-blue-50 text-blue-600 border border-blue-100/30',
          icon: <FolderOpen className="w-5 h-5 stroke-[2.2]" />,
          label: 'Files'
        },
        {
          show: canLedger,
          onClick: () => navigate('/ledger'),
          bgClass: 'bg-orange-50 text-orange-600 border border-orange-100/30',
          icon: <BookOpen className="w-5 h-5 stroke-[2.2]" />,
          label: 'Ledger'
        },
        {
          show: canExpenses,
          onClick: () => navigate('/expenses'),
          bgClass: 'bg-rose-50 text-rose-600 border border-rose-100/30',
          icon: <Wallet className="w-5 h-5 stroke-[2.2]" />,
          label: 'Expenses'
        },
        {
          show: canRecurring,
          onClick: () => navigate('/recurring'),
          bgClass: 'bg-purple-50 text-purple-600 border border-purple-100/30',
          icon: <Clock className="w-5 h-5 stroke-[2.2]" />,
          label: 'Recurring'
        },
        {
          show: canRecycle,
          onClick: () => navigate('/recycle-bin'),
          bgClass: 'bg-red-50 text-red-600 border border-red-100/30',
          icon: <Trash2 className="w-5 h-5 stroke-[2.2]" />,
          label: 'Recycle'
        },
        {
          show: !!activeEmployee && !activeEmployee.isAdmin,
          onClick: () => navigate('/payslips'),
          bgClass: 'bg-indigo-50 text-indigo-650 border border-indigo-100/30',
          icon: <Banknote className="w-5 h-5 stroke-[2.2]" />,
          label: 'Pay Slips'
        },
        {
          show: canSettings,
          onClick: () => navigate('/settings'),
          bgClass: 'bg-blue-50 text-blue-600 border border-blue-100/30',
          icon: <Settings className="w-5 h-5 stroke-[2.2]" />,
          label: 'Settings'
        }
      ].filter(item => item.show);

      return (
        <div className="bg-white border border-[#f1f3f9] rounded-3xl p-5 shadow-xs">
          <div className={`grid ${(!activeEmployee || activeEmployee.isAdmin) ? 'grid-cols-4' : 'grid-cols-3'} gap-y-5 justify-items-center w-full`}>
            {mobileItems.map((item, idx) => (
              <div key={idx} className="flex flex-col items-center gap-1.5 w-[64px] text-center shrink-0">
                <button
                  onClick={item.onClick}
                  className={`relative w-12 h-12 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-95 shadow-xs ${item.bgClass}`}
                  title={item.label}
                >
                  {item.icon}
                </button>
                <span className="text-[10px] font-extrabold text-slate-500 tracking-tight leading-none">
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="bg-white border border-[#f1f3f9] rounded-3xl p-6 shadow-xs">
        <h3 className="font-extrabold text-slate-900 text-[15px] tracking-tight pb-3 border-b border-slate-100">
          Quick Actions
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
          {canEmployees && (
            <button
              onClick={() => navigate('/employees')}
              className="flex items-center gap-3.5 p-3 bg-[#fafafa] hover:bg-slate-50 border border-[#f1f3f9] rounded-2xl transition-all cursor-pointer text-left active:scale-[0.98]"
            >
              <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <UserPlus className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-slate-700">Employees</span>
            </button>
          )}

          {canInvoice && (
            <button
              onClick={() => navigate('/documents/new?type=invoice')}
              className="flex items-center gap-3.5 p-3 bg-[#fafafa] hover:bg-slate-50 border border-[#f1f3f9] rounded-2xl transition-all cursor-pointer text-left active:scale-[0.98]"
            >
              <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-slate-700">New Invoice</span>
            </button>
          )}

          {canPayroll && (
            <button
              onClick={() => navigate('/payroll')}
              className="relative flex items-center gap-3.5 p-3 bg-[#fafafa] hover:bg-slate-50 border border-[#f1f3f9] rounded-2xl transition-all cursor-pointer text-left active:scale-[0.98]"
            >
              <div className="relative w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                <Banknote className="w-4 h-4" />
                {showSalaryReminderDot && (
                  <span className="absolute -top-1.5 -right-1.5 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                  </span>
                )}
              </div>
              <span className="text-xs font-bold text-slate-700 flex items-center gap-2">
                Salary Payroll
                {showSalaryReminderDot && (
                  <span className="text-[10px] text-red-650 bg-red-50 px-1.5 py-0.5 rounded-md font-bold animate-pulse">
                    Salary Due
                  </span>
                )}
              </span>
            </button>
          )}

          {canDocs && (
            <button
              onClick={() => navigate('/documents')}
              className="flex items-center gap-3.5 p-3 bg-[#fafafa] hover:bg-slate-50 border border-[#f1f3f9] rounded-2xl transition-all cursor-pointer text-left active:scale-[0.98]"
            >
              <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <FolderOpen className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-slate-700">Manage Files</span>
            </button>
          )}

          {canLedger && (
            <button
              onClick={() => navigate('/ledger')}
              className="flex items-center gap-3.5 p-3 bg-[#fafafa] hover:bg-slate-50 border border-[#f1f3f9] rounded-2xl transition-all cursor-pointer text-left active:scale-[0.98]"
            >
              <div className="w-7 h-7 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
                <BookOpen className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-slate-700">Ledger</span>
            </button>
          )}

          {activeEmployee && !activeEmployee.isAdmin && (
            <button
              onClick={() => navigate('/payslips')}
              className="flex items-center gap-3.5 p-3 bg-[#fafafa] hover:bg-slate-50 border border-[#f1f3f9] rounded-2xl transition-all cursor-pointer text-left active:scale-[0.98]"
            >
              <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-650 flex items-center justify-center shrink-0">
                <Banknote className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-slate-700">Pay Slips</span>
            </button>
          )}
        </div>
      </div>
    );
  };

  // Time based greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Good morning';
    if (hour >= 12 && hour < 17) return 'Good afternoon';
    if (hour >= 17 && hour < 22) return 'Good evening';
    return 'Good night';
  }, []);

  // Format relative time helper
  const getRelativeTime = (item) => {
    const dateStr = typeof item === 'string' 
      ? item 
      : (item?.createdAt || item?.documentDate || item?.date);
    
    if (!dateStr) return 'Just now';
    
    const created = new Date(dateStr);
    const diffMs = Date.now() - created.getTime();
    const diffHours = Math.floor(diffMs / 3600000);
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  // Compute stat card values dynamically
  const stats = useMemo(() => {
    // Total documents count (all types)
    const totalDocsCount = displayDocuments.length;

    // Total Invoiced and Overdue calculation (invoices only)
    let invoiceDocs = displayDocuments.filter(d => d.documentType === 'invoice' || !d.documentType);
    let totalInv = 0;
    let overdueAmt = 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    invoiceDocs.forEach(doc => {
      const amt = doc.totals?.grandTotal || parseFloat(doc.amount) || 0;
      totalInv += amt;

      const isStatusOverdue = doc.status === 'Overdue';
      const isPastDue = doc.dueDate && new Date(doc.dueDate) < today && doc.status !== 'Paid';
      if (isStatusOverdue || isPastDue) {
        overdueAmt += amt;
      }
    });

    // Recurring monthly income and outcome calculations
    let projectedIncome = 0;
    let projectedOutcome = 0;

    const activeReminders = displayRecurringReminders.filter(r => r.status === 'active');
    activeReminders.forEach(r => {
      let multiplier = 1;
      if (r.frequency === 'weekly') multiplier = 4.33;
      else if (r.frequency === 'daily') multiplier = 30;
      else if (r.frequency === 'yearly') multiplier = 1 / 12;

      const monthlyAmt = (parseFloat(r.amount) || 0) * multiplier;
      if (r.type === 'income') {
        projectedIncome += monthlyAmt;
      } else {
        projectedOutcome += monthlyAmt;
      }
    });

    // Expenses stats matched to Expenses page analytics
    const now = new Date();
    const activeMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    // Calculate current month's expenses:
    const thisMonthExp = displayExpenses.reduce((sum, exp) => {
      const d = new Date(exp.date);
      const isCurrentMonth = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      return isCurrentMonth ? sum + (parseFloat(exp.amount) || 0) : sum;
    }, 0);

    const budgetsMap = (activeCompany as any)?.monthlyBudgets || {};
    const monthlyLimit = parseFloat(String(budgetsMap[activeMonthKey] !== undefined ? budgetsMap[activeMonthKey] : ((activeCompany as any)?.monthlyBudget || 50000))) || 50000;
    const expensesPercent = monthlyLimit > 0 ? Math.round((thisMonthExp / monthlyLimit) * 100) : 0;

    // Dynamic targets scaling
    const getDynamicTarget = (val, base) => {
      if (val <= 0) return base;
      let target = base;
      while (val > target) {
        target *= 2;
      }
      return target;
    };

    const projectedIncomeYearly = projectedIncome * 12;
    const targetRecIncomeYearly = getDynamicTarget(projectedIncomeYearly, 3600000);

    const targetInvoiced = getDynamicTarget(totalInv, 500000);
    const targetOverdue = getDynamicTarget(overdueAmt, 50000);
    const targetRecIncome = getDynamicTarget(projectedIncome, 300000);
    const targetRecOutcome = getDynamicTarget(projectedOutcome, 100000);

    return {
      totalInvoicedVal: totalInv,
      overdueVal: overdueAmt,
      recurringIncomeVal: projectedIncome,
      recurringOutcomeVal: projectedOutcome,
      expensesVal: thisMonthExp,
      expensesLimit: monthlyLimit,
      recurringIncomeYearlyVal: projectedIncomeYearly,
      
      totalInvoicedPercent: targetInvoiced > 0 ? Math.round((totalInv / targetInvoiced) * 100) : 0,
      overduePercent: targetOverdue > 0 ? Math.round((overdueAmt / targetOverdue) * 100) : 0,
      recurringIncomePercent: targetRecIncome > 0 ? Math.round((projectedIncome / targetRecIncome) * 100) : 0,
      recurringOutcomePercent: targetRecOutcome > 0 ? Math.round((projectedOutcome / targetRecOutcome) * 100) : 0,
      expensesPercent,
      recurringIncomeYearlyPercent: targetRecIncomeYearly > 0 ? Math.round((projectedIncomeYearly / targetRecIncomeYearly) * 100) : 0,
    };
  }, [displayDocuments, displayExpenses, displayRecurringReminders, activeCompany]);

  const activities = useMemo(() => {
    const docActivities = displayDocuments.map(doc => {
      const isInvoice = doc.documentType === 'invoice';
      const isVoucher = doc.documentType === 'voucher';
      const typeLabel = isInvoice ? 'invoice' : isVoucher ? 'voucher' : 'receipt';
      const party = doc.customer?.customerName || doc.paidTo || doc.receivedFrom || 'N/A';
      
      return {
        id: `act_${doc.id}`,
        targetId: doc.id,
        title: `New ${typeLabel} created`,
        detail: `${doc.documentNumber} for ${party}${doc.createdBy ? ` by ${doc.createdBy}` : ''}`,
        date: doc.createdAt || doc.documentDate,
        type: doc.documentType || 'invoice'
      };
    });

    const expenseActivities = displayExpenses.map(exp => {
      return {
        id: `act_${exp.id}`,
        targetId: exp.id,
        title: `Expense recorded`,
        detail: `${exp.particulars} - ${exp.category}${exp.createdBy ? ` by ${exp.createdBy}` : ''}`,
        date: exp.createdAt || exp.date,
        type: 'expense'
      };
    });

    const combined = [...docActivities, ...expenseActivities];
    combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return combined.slice(0, 4);
  }, [displayDocuments, displayExpenses]);

  const handlePointerMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    let clientX, clientY;
    if (e.touches && e.touches[0]) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    e.currentTarget.style.setProperty('--mouse-x', `${clientX - rect.left}px`);
    e.currentTarget.style.setProperty('--mouse-y', `${clientY - rect.top}px`);
  };

  return (
    <MainLayout title="Dashboard">
      {/* Full-Page Background GradientWaves */}
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
        <GradientWaves
          horizonColor="#f0f7fb"
          waveColor="#e0e7ff"
          crestColor="#eff6ff"
          speed={0.15}
          amplitude={1.8}
          waveScale={0.4}
          waveRatio={0.9}
          swell={25}
          turbulence={15}
          tilt={1.2}
          zoom={1.0}
          height={5.5}
          fogDepth={18}
          detail="medium"
          brightness={1.0}
          opacity={1.0}
          mouseInteraction={true}
          parallaxStrength={0.25}
          grain={false}
        />
      </div>

      <div className="space-y-6 font-sans relative z-10">
        
        {/* Welcome Banner for Newly Created Company */}
        {justCreatedData && (
          <div className="bg-gradient-to-r from-indigo-600 via-blue-600 to-sky-600 rounded-3xl p-5 md:p-6 text-white shadow-lg relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-white/20 text-xs font-bold backdrop-blur-sm">
                🎉 Workspace Ready
              </div>
              <h3 className="text-lg md:text-xl font-black">
                Welcome to {justCreatedData.name || activeCompany?.companyName || 'your workspace'}!
              </h3>
              <p className="text-white/80 text-xs max-w-xl">
                Your workspace is created and active. Share your Company ID with team members to let them join or login.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 bg-black/20 backdrop-blur-md p-2.5 rounded-2xl border border-white/10 shrink-0">
              <div className="px-3 py-1 bg-white/10 rounded-xl">
                <span className="text-[9px] uppercase font-bold text-white/70 block">Company ID</span>
                <span className="font-mono font-black text-sm text-white select-all">{justCreatedData.code}</span>
              </div>
              <button
                type="button"
                onClick={copyCompanyCode}
                className="px-3 py-2 rounded-xl bg-white text-indigo-700 hover:bg-white/90 text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy ID</span>
              </button>
              <button
                type="button"
                onClick={dismissWelcomeBanner}
                className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Welcome Section & Create Dropdown */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-5">
          <div 
            onMouseEnter={(e) => {
              setIsWelcomeHovered(true);
              setShowSpotlight(true);
              handlePointerMove(e);
            }}
            onMouseLeave={() => {
              setIsWelcomeHovered(false);
              setShowSpotlight(false);
            }}
            onMouseMove={handlePointerMove}
            onTouchStart={(e) => {
              setIsWelcomeHovered(true);
              setShowSpotlight(true);
              handlePointerMove(e);
            }}
            onTouchMove={handlePointerMove}
            onTouchEnd={() => {
              setTimeout(() => {
                setIsWelcomeHovered(false);
                setShowSpotlight(false);
              }, 1500);
            }}
            className="flex-1 bg-white border border-[#f1f3f9] p-6 rounded-3xl shadow-xs cursor-pointer select-none transition-all duration-300 hover:shadow-md relative overflow-hidden group"
          >
            {/* Theme-Matched Spotlight Overlay */}
            <div 
              className={`absolute inset-0 pointer-events-none rounded-3xl transition-opacity duration-300 ${
                showSpotlight ? 'opacity-100' : 'opacity-0'
              }`}
              style={{
                background: `radial-gradient(350px circle at var(--mouse-x, 0px) var(--mouse-y, 0px), rgba(59, 42, 224, 0.08), transparent 80%)`,
                zIndex: 1
              }}
            />



            {/* Theme-Matched Rotating Border Beam (Hamour Line) */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none rounded-3xl" style={{ zIndex: 10 }}>
              <defs>
                <linearGradient id="welcome-beam-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#3b2ae0" stopOpacity="0.1" />
                  <stop offset="50%" stopColor="#818cf8" stopOpacity="1" />
                  <stop offset="100%" stopColor="#3b2ae0" stopOpacity="0.1" />
                </linearGradient>
              </defs>
              <rect
                rx="24"
                fill="none"
                stroke="url(#welcome-beam-gradient)"
                strokeWidth="2.5"
                className="animate-border-beam welcome-border-rect"
              />
            </svg>


            {/* Welcome Card Content */}
            <div className="relative z-10 flex items-center justify-between">
              <div>
                <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                  <span>{greeting}, {activeEmployee ? activeEmployee.name : (activeCompany?.companyName ? activeCompany.companyName.split(' ')[0] : 'there')}!</span>
                  <span className={`inline-block transition-transform duration-300 ${isWelcomeHovered ? 'animate-wave-shake' : ''}`}>👋</span>
                </h1>
                <p className="text-xs text-slate-500 font-semibold mt-1">
                  {activeEmployee ? `Logged in as employee (${activeEmployee.designation || 'Staff'}).` : 'Create and manage your business invoices, vouchers, and receipts easily.'}
                </p>
              </div>
              
              {activeEmployee && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    window.dispatchEvent(new Event('open-self-profile'));
                  }}
                  className="hidden sm:flex w-14 h-14 rounded-2xl overflow-hidden border-2 border-slate-100 hover:border-indigo-400 shadow-md hover:scale-105 transition-all cursor-pointer shrink-0 ml-4 active:scale-95 items-center justify-center bg-white"
                  title="View Profile"
                >
                  {activeEmployee.photo ? (
                    <img 
                      src={activeEmployee.photo} 
                      alt={activeEmployee.name} 
                      className="w-full h-full object-cover" 
                    />
                  ) : (
                    <div className="w-full h-full bg-indigo-50 text-indigo-650 flex items-center justify-center font-bold text-lg uppercase">
                      {activeEmployee.name.charAt(0)}
                    </div>
                  )}
                </button>
              )}
            </div>
          </div>

        </div>

        {/* Quick Actions (Mobile-only: appears after the Create Invoice button on mobile) */}
        <div className="block lg:hidden">
          {renderQuickActions(true)}
        </div>
            {/* Stat Cards (6 Cards Grid) */}
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
              {/* Card 1: Total Invoiced */}
              <div 
                onMouseEnter={() => setInvoicedTrigger(prev => prev + 1)}
                onTouchStart={() => setInvoicedTrigger(prev => prev + 1)}
                onClick={() => navigate('/documents?type=invoice')}
                className="bg-white border border-[#f1f3f9] p-4 rounded-3xl shadow-xs flex items-center gap-3 sm:gap-4 transition-all duration-300 hover:shadow-md hover:scale-[1.02] cursor-pointer col-span-2 sm:col-span-1"
              >
                <CircularProgress 
                  percent={stats.totalInvoicedPercent}
                  gradientId="indigoProgress"
                  gradientStart="#818cf8"
                  gradientEnd="#4f46e5"
                  trackColor="#f5f3ff"
                  triggerKey={invoicedTrigger}
                />
                <div className="flex flex-col justify-center min-w-0">
                  <span className="text-[10px] xl:text-[11px] font-bold text-slate-500 truncate">Total Invoiced</span>
                  <p className="text-sm xl:text-base font-extrabold text-slate-900 tracking-tight mt-0.5 whitespace-nowrap">
                    <AnimatedCardValue targetValue={stats.totalInvoicedVal} isCurrency={true} currencySymbol={currencySymbol} triggerKey={invoicedTrigger} />
                  </p>
                  <p className="text-[9px] xl:text-[10px] font-bold text-slate-400 mt-1 flex items-center gap-1 shrink-0 whitespace-nowrap">
                    <span className="font-semibold">Cumulative invoices generated</span>
                  </p>
                </div>
              </div>

              {/* Card 2: Expenses */}
              <div 
                onMouseEnter={() => setExpensesTrigger(prev => prev + 1)}
                onTouchStart={() => setExpensesTrigger(prev => prev + 1)}
                onClick={() => navigate('/expenses')}
                className="bg-white border border-[#f1f3f9] p-4 rounded-3xl shadow-xs flex flex-col items-start gap-2.5 sm:flex-row sm:items-center sm:gap-4 transition-all duration-300 hover:shadow-md hover:scale-[1.02] cursor-pointer col-span-1 sm:col-span-1"
              >
                <CircularProgress 
                  percent={stats.expensesPercent}
                  gradientId="roseProgress"
                  gradientStart="#fb7185"
                  gradientEnd="#e11d48"
                  trackColor="#fff1f2"
                  triggerKey={expensesTrigger}
                />
                <div className="flex flex-col justify-center min-w-0">
                  <span className="text-[10px] xl:text-[11px] font-bold text-slate-500 truncate">Expenses (This Month)</span>
                  <div className="flex items-baseline gap-1 mt-0.5 flex-wrap">
                    <span className="text-sm xl:text-base font-extrabold text-slate-900 tracking-tight">
                      <AnimatedCardValue targetValue={stats.expensesVal} isCurrency={true} currencySymbol={currencySymbol} triggerKey={expensesTrigger} />
                    </span>
                    <span className="text-[10px] text-slate-400 font-semibold truncate">
                      / {formatCurrency(stats.expensesLimit, currencySymbol)}
                    </span>
                  </div>
                  <p className={`text-[9px] xl:text-[10px] font-bold mt-1 flex items-center gap-1 shrink-0 whitespace-nowrap ${
                    stats.expensesVal > stats.expensesLimit ? 'text-rose-600' : 'text-emerald-600'
                  }`}>
                    <span>{stats.expensesVal > stats.expensesLimit ? '⚠' : '✓'}</span>
                    <span className="font-semibold">
                      {stats.expensesVal > stats.expensesLimit ? 'Over monthly budget!' : 'Within monthly budget'}
                    </span>
                  </p>
                </div>
              </div>

              {/* Card 3: Overdue */}
              <div 
                onMouseEnter={() => setOverdueTrigger(prev => prev + 1)}
                onTouchStart={() => setOverdueTrigger(prev => prev + 1)}
                onClick={() => navigate('/documents?status=Overdue')}
                className="bg-white border border-[#f1f3f9] p-4 rounded-3xl shadow-xs flex flex-col items-start gap-2.5 sm:flex-row sm:items-center sm:gap-4 transition-all duration-300 hover:shadow-md hover:scale-[1.02] cursor-pointer col-span-1 sm:col-span-1"
              >
                <CircularProgress 
                  percent={stats.overduePercent}
                  gradientId="redProgress"
                  gradientStart="#ef4444"
                  gradientEnd="#b91c1c"
                  trackColor="#fef2f2"
                  triggerKey={overdueTrigger}
                />
                <div className="flex flex-col justify-center min-w-0">
                  <span className="text-[10px] xl:text-[11px] font-bold text-slate-500 truncate">Overdue</span>
                  <p className="text-sm xl:text-base font-extrabold text-slate-900 tracking-tight mt-0.5 whitespace-nowrap">
                    <AnimatedCardValue targetValue={stats.overdueVal} isCurrency={true} currencySymbol={currencySymbol} triggerKey={overdueTrigger} />
                  </p>
                  <p className="text-[9px] xl:text-[10px] font-bold text-slate-400 mt-1 flex items-center gap-1 shrink-0 whitespace-nowrap">
                    <span className="font-semibold">Awaiting payment</span>
                  </p>
                </div>
              </div>

              {/* Card 4: Recurring Income */}
              <div 
                onMouseEnter={() => setRecurringIncomeTrigger(prev => prev + 1)}
                onTouchStart={() => setRecurringIncomeTrigger(prev => prev + 1)}
                onClick={() => navigate('/recurring')}
                className="bg-white border border-[#f1f3f9] p-4 rounded-3xl shadow-xs flex flex-col items-start gap-2.5 sm:flex-row sm:items-center sm:gap-4 transition-all duration-300 hover:shadow-md hover:scale-[1.02] cursor-pointer col-span-1 sm:col-span-1"
              >
                <CircularProgress 
                  percent={stats.recurringIncomePercent}
                  gradientId="emeraldProgress"
                  gradientStart="#34d399"
                  gradientEnd="#059669"
                  trackColor="#ecfdf5"
                  triggerKey={recurringIncomeTrigger}
                />
                <div className="flex flex-col justify-center min-w-0">
                  <span className="text-[10px] xl:text-[11px] font-bold text-slate-500 truncate">Recurring Income</span>
                  <p className="text-sm xl:text-base font-extrabold text-slate-900 tracking-tight mt-0.5 whitespace-nowrap">
                    <AnimatedCardValue targetValue={stats.recurringIncomeVal} isCurrency={true} currencySymbol={currencySymbol} triggerKey={recurringIncomeTrigger} />
                  </p>
                  <p className="text-[9px] xl:text-[10px] font-bold text-slate-400 mt-1 flex items-center gap-1 shrink-0 whitespace-nowrap">
                    <span className="font-semibold">Projected monthly income</span>
                  </p>
                </div>
              </div>

              {/* Card 5: Recurring Outcome */}
              <div 
                onMouseEnter={() => setRecurringOutcomeTrigger(prev => prev + 1)}
                onTouchStart={() => setRecurringOutcomeTrigger(prev => prev + 1)}
                onClick={() => navigate('/recurring')}
                className="bg-white border border-[#f1f3f9] p-4 rounded-3xl shadow-xs flex flex-col items-start gap-2.5 sm:flex-row sm:items-center sm:gap-4 transition-all duration-300 hover:shadow-md hover:scale-[1.02] cursor-pointer col-span-1 sm:col-span-1"
              >
                <CircularProgress 
                  percent={stats.recurringOutcomePercent}
                  gradientId="amberProgress"
                  gradientStart="#f59e0b"
                  gradientEnd="#d97706"
                  trackColor="#fffbeb"
                  triggerKey={recurringOutcomeTrigger}
                />
                <div className="flex flex-col justify-center min-w-0">
                  <span className="text-[10px] xl:text-[11px] font-bold text-slate-500 truncate">Recurring Outcome</span>
                  <p className="text-sm xl:text-base font-extrabold text-slate-900 tracking-tight mt-0.5 whitespace-nowrap">
                    <AnimatedCardValue targetValue={stats.recurringOutcomeVal} isCurrency={true} currencySymbol={currencySymbol} triggerKey={recurringOutcomeTrigger} />
                  </p>
                  <p className="text-[9px] xl:text-[10px] font-bold text-slate-400 mt-1 flex items-center gap-1 shrink-0 whitespace-nowrap">
                    <span className="font-semibold">Projected monthly outcome</span>
                  </p>
                </div>
              </div>

              {/* Card 6: Recurring Income (Yearly) */}
              <div 
                onMouseEnter={() => setRecurringIncomeYearlyTrigger(prev => prev + 1)}
                onTouchStart={() => setRecurringIncomeYearlyTrigger(prev => prev + 1)}
                onClick={() => navigate('/recurring')}
                className="bg-white border border-[#f1f3f9] p-4 rounded-3xl shadow-xs flex items-center gap-3 sm:gap-4 transition-all duration-300 hover:shadow-md hover:scale-[1.02] cursor-pointer col-span-2 sm:col-span-1"
              >
                <CircularProgress 
                  percent={stats.recurringIncomeYearlyPercent}
                  gradientId="blueProgress"
                  gradientStart="#0ea5e9"
                  gradientEnd="#2563eb"
                  trackColor="#f0f9ff"
                  triggerKey={recurringIncomeYearlyTrigger}
                />
                <div className="flex flex-col justify-center min-w-0">
                  <span className="text-[10px] xl:text-[11px] font-bold text-slate-500 truncate">Recurring Income (Yearly)</span>
                  <p className="text-sm xl:text-base font-extrabold text-slate-900 tracking-tight mt-0.5 whitespace-nowrap">
                    <AnimatedCardValue targetValue={stats.recurringIncomeYearlyVal} isCurrency={true} currencySymbol={currencySymbol} triggerKey={recurringIncomeYearlyTrigger} />
                  </p>
                  <p className="text-[9px] xl:text-[10px] font-bold text-slate-400 mt-1 flex items-center gap-1 shrink-0 whitespace-nowrap">
                    <span className="font-semibold">Projected annual income</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Chart & Recent Documents Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
              <div className="lg:col-span-2">
                <InvoiceChart documents={displayDocuments} currencySymbol={currencySymbol} />
              </div>

              {/* Recent Documents Card */}
              <div className="bg-white border border-[#f1f3f9] rounded-3xl p-6 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <h3 className="font-extrabold text-slate-900 text-[15px] tracking-tight">Recent Documents</h3>
                    <button
                      onClick={() => navigate('/documents')}
                      className="text-[11px] text-blue-600 hover:text-blue-700 font-bold"
                    >
                      View All
                    </button>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {displayDocuments.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-center text-slate-400">
                        <p className="text-xs font-semibold">No recent documents</p>
                        <p className="text-[10px] mt-0.5">Documents you generate will appear here.</p>
                      </div>
                    ) : (
                      displayDocuments.slice(0, 3).map((doc) => {
                        const isInvoice = doc.documentType === 'invoice';
                        const isVoucher = doc.documentType === 'voucher';
                        
                        const label = isInvoice ? 'Invoice' : isVoucher ? 'Voucher' : 'Receipt';
                        const partyName = doc.customer?.customerName || doc.paidTo || doc.receivedFrom || 'N/A';
                        const amount = doc.totals?.grandTotal || doc.amount || 0;
                        const timeAgo = getRelativeTime(doc);
                        
                        const iconBg = isInvoice ? 'bg-blue-50 text-blue-600' : isVoucher ? 'bg-purple-50 text-purple-600' : 'bg-emerald-50 text-emerald-600';
                        const Icon = isInvoice ? FileText : isVoucher ? CreditCard : Receipt;

                        return (
                          <div 
                            key={doc.id} 
                            onClick={() => navigate(`/documents?preview=${doc.id}`)}
                            className="py-3 px-2 -mx-2 flex items-center justify-between gap-3 hover:bg-slate-50 border border-transparent hover:border-slate-100 rounded-2xl transition-all cursor-pointer group active:scale-[0.99]"
                            title="Click to view bill preview"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${iconBg}`}>
                                <Icon className="w-4.5 h-4.5" />
                              </div>
                              <div className="min-w-0">
                                <div className="font-extrabold text-xs text-slate-900 truncate group-hover:text-blue-600 transition-colors">
                                  {doc.documentNumber}
                                </div>
                                <p className="text-[10px] text-slate-500 font-semibold truncate mt-0.5">
                                  {label} • {partyName}{doc.createdBy ? ` (by ${doc.createdBy})` : ''}
                                </p>
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <p className={`font-extrabold text-xs group-hover:text-blue-600 transition-colors ${
                                doc.status === 'Paid' ? 'text-emerald-600' : 'text-rose-600'
                              }`}>
                                {formatCurrency(amount, currencySymbol)}
                              </p>
                              <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                                {timeAgo}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Section: Recent Activities & Quick Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Activities */}
              <div className="bg-white border border-[#f1f3f9] rounded-3xl p-6 shadow-xs">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="font-extrabold text-slate-900 text-[15px] tracking-tight">Recent Activities</h3>
                  <button
                    onClick={() => navigate('/documents')}
                    className="text-[11px] text-blue-600 hover:text-blue-700 font-bold"
                  >
                    View All
                  </button>
                </div>

                <div className="mt-3 space-y-4">
                  {activities.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center text-slate-400">
                      <p className="text-xs font-semibold">No recent activity</p>
                      <p className="text-[10px] mt-0.5">Create your first document to see activities.</p>
                    </div>
                  ) : (
                    activities.map((act) => {
                      const isInvoice = act.type === 'invoice';
                      const isVoucher = act.type === 'voucher';
                      const isReceipt = act.type === 'receipt';
                      
                      const iconBg = isInvoice 
                        ? 'bg-blue-50 text-blue-600' 
                        : isVoucher 
                          ? 'bg-purple-50 text-purple-600' 
                          : isReceipt 
                            ? 'bg-emerald-50 text-emerald-600' 
                            : 'bg-rose-50 text-rose-600';
                      
                      const Icon = isInvoice 
                        ? FileText 
                        : isVoucher 
                          ? CreditCard 
                          : isReceipt 
                            ? Receipt 
                            : TrendingUp;

                      return (
                        <div 
                          key={act.id} 
                          onClick={() => {
                            if (act.type === 'expense') {
                              navigate('/expenses');
                            } else {
                              navigate(`/documents?preview=${act.targetId}`);
                            }
                          }}
                          className="py-2 px-2.5 -mx-2.5 flex items-center justify-between gap-3 hover:bg-slate-50 border border-transparent hover:border-slate-100 rounded-2xl transition-all cursor-pointer group active:scale-[0.99]"
                          title="Click to view details"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${iconBg}`}>
                              <Icon className="w-4.5 h-4.5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-slate-900 truncate group-hover:text-blue-600 transition-colors">{act.title}</p>
                              <p className="text-[10px] text-slate-400 font-semibold truncate mt-0.5">{act.detail}</p>
                            </div>
                          </div>
                          <span className="text-[10px] text-slate-400 font-bold shrink-0">{getRelativeTime(act.date)}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Quick Actions (Desktop/Tablet-only: hidden on mobile) */}
              <div className="hidden lg:block">
                {renderQuickActions()}
              </div>
            </div>


        {/* Footer */}
        <div className="pt-6 border-t border-[#f1f3f9] flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-400 font-bold gap-3">
          <div>
            © 2026 UNAI Billing. All rights reserved.
          </div>
          <div className="flex items-center gap-6">
            <span>Version 1.0.0</span>
            <button
              onClick={() => setShowWhatsNew(true)}
              className="text-blue-600 hover:underline flex items-center gap-1.5 bg-transparent border-none cursor-pointer outline-none font-bold"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              What's New
            </button>
          </div>
        </div>

        {showWhatsNew && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
            <div className="bg-white rounded-3xl p-6 shadow-xl border border-slate-100 max-w-sm w-full relative transform scale-100 transition-all duration-300">
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2 text-blue-600">
                  <Sparkles className="w-5 h-5 text-amber-500 fill-amber-500 animate-pulse" />
                  <h3 className="font-extrabold text-slate-900 text-base tracking-tight">What's New in UNAI Billing</h3>
                </div>
                <button 
                  onClick={() => setShowWhatsNew(false)}
                  className="w-7 h-7 rounded-xl hover:bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer border-none bg-transparent"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Feature list */}
              <div className="my-4 space-y-4 max-h-[300px] overflow-y-auto pr-1">
                <div className="flex gap-3">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold">1</span>
                  </div>
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-900">Month-Wise Budget Limits</h4>
                    <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Customize individual monthly limits for precise expense control directly in Settings.</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold">2</span>
                  </div>
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-900">Smart Status Color-Coding</h4>
                    <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Enforced emerald green for paid receipts/vouchers and rose red for unpaid invoices.</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold">3</span>
                  </div>
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-900">Dynamic Yearly Projections</h4>
                    <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Quickly view projected annual recurring income right on your dashboard metrics card.</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold">4</span>
                  </div>
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-900">Interactive Activity Feeds</h4>
                    <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Click any recent activity row to open its document preview modal or expense logs instantly.</p>
                  </div>
                </div>
              </div>

              {/* Action */}
              <button
                onClick={() => setShowWhatsNew(false)}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-2xl transition-all cursor-pointer shadow-xs active:scale-[0.98] border-none"
              >
                Awesome, Got It!
              </button>
            </div>
          </div>
        )}


        {/* Floating Speed Dial Action Button (FAB) for adding documents - Unique design */}
        {canCreateAnyDoc && (
          <div className="fixed bottom-20 right-6 z-40 flex flex-col items-end gap-3">
            {/* Expanded Speed Dial Menu Options */}
            {createMenuOpen && (
              <div className="flex flex-col gap-2.5 animate-in slide-in-from-bottom-5 duration-200">
                {canAddInvoice && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate('/documents/new?type=invoice');
                      setCreateMenuOpen(false);
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200/85 rounded-2xl shadow-md hover:bg-indigo-50 text-indigo-650 text-xs font-bold transition-all hover:scale-105 active:scale-95 cursor-pointer pr-5 shrink-0"
                  >
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                    New Invoice
                  </button>
                )}
                {canAddVoucher && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate('/documents/new?type=voucher');
                      setCreateMenuOpen(false);
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200/85 rounded-2xl shadow-md hover:bg-indigo-50 text-indigo-650 text-xs font-bold transition-all hover:scale-105 active:scale-95 cursor-pointer pr-5 shrink-0"
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    New Voucher
                  </button>
                )}
                {canAddReceipt && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate('/documents/new?type=receipt');
                      setCreateMenuOpen(false);
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200/85 rounded-2xl shadow-md hover:bg-indigo-50 text-indigo-650 text-xs font-bold transition-all hover:scale-105 active:scale-95 cursor-pointer pr-5 shrink-0"
                  >
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    New Receipt
                  </button>
                )}
              </div>
            )}

            {/* Main FAB Trigger Button */}
            <div className="relative flex items-center justify-center">
              {/* Glow pulsing ring behind the button */}
              {!createMenuOpen && (
                <span className="absolute inline-flex h-14 w-14 rounded-[20px] bg-indigo-400 opacity-25 animate-ping duration-1000 pointer-events-none"></span>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setCreateMenuOpen(!createMenuOpen);
                }}
                className="relative w-14 h-14 bg-gradient-to-tr from-indigo-600 via-indigo-650 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-[20px] flex items-center justify-center shadow-lg shadow-indigo-600/30 hover:shadow-xl hover:scale-105 active:scale-95 transition-all cursor-pointer border border-white/10 group"
                title="Create Document"
              >
                {/* Plus icon inside with rotation animation when open */}
                <Plus className={`w-6 h-6 stroke-[2.8] transition-transform duration-300 ${createMenuOpen ? 'rotate-45' : 'group-hover:rotate-90'}`} />
              </button>
            </div>
          </div>
        )}

      </div>
    </MainLayout>
  );
};
