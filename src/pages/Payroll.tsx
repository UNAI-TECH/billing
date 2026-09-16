import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { MainLayout } from '../components/layout/MainLayout';
import { useCompany } from '../contexts/CompanyContext';
import { useToast } from '../components/ui/Toast';
import { Button } from '../components/ui/Button';
import { getCompanyEmployees, getCompanyPayroll, saveCompanyPayroll } from '../services/db';
import { formatCurrency, formatDate } from '../utils/formatting';
import { downloadDocumentPDF } from '../services/pdfGenerator';
import { PayslipTemplate } from '../templates/PayslipTemplate';
import { 
  Users, 
  Search, 
  Check, 
  AlertCircle, 
  Banknote, 
  Calendar, 
  Download, 
  Printer, 
  Wallet, 
  X,
  Plus,
  BadgeCheck,
  Pause,
  Coins,
  Filter
} from 'lucide-react';

interface Employee {
  id: string;
  name: string;
  loginId: string;
  phone?: string;
  email?: string;
  designation?: string;
  salary?: number | string;
  isAdmin?: boolean;
  photo?: string;
}

interface PayrollRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  salary: number;
  month: string; // "YYYY-MM" format
  status: 'Paid' | 'Hold';
  paymentDate?: string;
  paymentMethod?: string;
  notes?: string;
  updatedAt: string;
}

export const Payroll = () => {
  const { activeCompany } = useCompany();
  const { showToast } = useToast();

  // Guard: if employee is logged in, redirect or block access
  const employeeJson = localStorage.getItem('activeEmployee');
  const activeEmployee = employeeJson ? JSON.parse(employeeJson) : null;

  // State
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${d.getFullYear()}-${mm}`;
  });
  const [statusFilter, setStatusFilter] = useState<'All' | 'Pending' | 'Paid' | 'Hold'>('All');
  const [showMobileControls, setShowMobileControls] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // PDF download state
  const [pdfRenderSlip, setPdfRenderSlip] = useState<{ employee: Employee; record: PayrollRecord } | null>(null);
  const pdfRef = useRef<HTMLDivElement>(null);
  const [previewSlip, setPreviewSlip] = useState<{ employee: Employee; record: PayrollRecord } | null>(null);

  // Modal State for recording payment details
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [paymentMethod, setPaymentMethod] = useState<string>('Bank Transfer');
  const [paymentNotes, setPaymentNotes] = useState<string>('');

  // Load employees and payroll history
  const loadData = useCallback(async () => {
    if (!activeCompany?.id) return;
    setLoading(true);
    try {
      const emps = await getCompanyEmployees(activeCompany.id);
      const payroll = await getCompanyPayroll(activeCompany.id);
      setEmployees(emps);
      setPayrollRecords(payroll);
    } catch (err) {
      console.error('Error loading payroll data:', err);
      showToast('Failed to load payroll data.', 'error');
    } finally {
      setLoading(false);
    }
  }, [activeCompany?.id, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.filter-popover-container')) {
        setShowMobileFilters(false);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  // Deny access to non-admin employees
  if (activeEmployee && !activeEmployee.isAdmin) {
    return (
      <MainLayout title="Access Control">
        <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6 bg-white border border-slate-100 rounded-2xl">
          <div className="w-16 h-16 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 mb-4 border border-rose-100/30">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">Access Denied</h3>
          <p className="text-slate-500 text-sm max-w-sm mt-1 leading-relaxed">
            Only the Workspace Owner or Administrator can access the Salary Payroll section.
          </p>
        </div>
      </MainLayout>
    );
  }

  // Get current month's payroll mappings
  const mappedPayroll = useMemo(() => {
    return employees.map(emp => {
      const record = payrollRecords.find(
        r => r.employeeId === emp.id && r.month === selectedMonth
      );
      
      const salaryVal = emp.salary !== undefined && emp.salary !== '' && !isNaN(Number(emp.salary))
        ? Number(emp.salary)
        : 0;

      return {
        employee: emp,
        record: record || null,
        status: record ? record.status : ('Pending' as const),
        salary: record ? record.salary : salaryVal,
        paymentDate: record?.paymentDate,
        paymentMethod: record?.paymentMethod,
        notes: record?.notes
      };
    });
  }, [employees, payrollRecords, selectedMonth]);

  // Filtered list based on Search & Status filters
  const filteredPayroll = useMemo(() => {
    return mappedPayroll.filter(item => {
      const matchesSearch = 
        item.employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.employee.designation && item.employee.designation.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesStatus = 
        statusFilter === 'All' || 
        item.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [mappedPayroll, searchTerm, statusFilter]);

  // Calculations for stats widgets
  const stats = useMemo(() => {
    let totalBudget = 0;
    let totalPaid = 0;
    let totalHold = 0;
    let paidCount = 0;
    let holdCount = 0;
    let pendingCount = 0;

    mappedPayroll.forEach(item => {
      const sal = item.salary;
      totalBudget += sal;
      if (item.status === 'Paid') {
        totalPaid += sal;
        paidCount++;
      } else if (item.status === 'Hold') {
        totalHold += sal;
        holdCount++;
      } else {
        pendingCount++;
      }
    });

    const progressPercent = mappedPayroll.length > 0 
      ? Math.round((paidCount / mappedPayroll.length) * 100) 
      : 0;

    return {
      totalBudget,
      totalPaid,
      totalHold,
      paidCount,
      holdCount,
      pendingCount,
      totalCount: mappedPayroll.length,
      progressPercent
    };
  }, [mappedPayroll]);

  // Format month label for presentation (e.g. "2026-08" -> "August 2026")
  const formattedMonthLabel = useMemo(() => {
    if (!selectedMonth) return '';
    const [year, month] = selectedMonth.split('-');
    const date = new Date(Number(year), Number(month) - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, [selectedMonth]);

  // Quick mark as Hold action
  const handleMarkAsHold = async (emp: Employee) => {
    if (!activeCompany?.id) return;
    
    const isAlreadyHold = payrollRecords.some(
      r => r.employeeId === emp.id && r.month === selectedMonth && r.status === 'Hold'
    );

    try {
      let updatedRecords;
      if (isAlreadyHold) {
        // Toggle back to Pending (remove the record)
        updatedRecords = payrollRecords.filter(
          r => !(r.employeeId === emp.id && r.month === selectedMonth)
        );
        await saveCompanyPayroll(activeCompany.id, updatedRecords);
        setPayrollRecords(updatedRecords);
        showToast(`Salary for "${emp.name}" is reset to Pending.`, 'info');
      } else {
        // Find and remove any existing record, then insert a hold record
        updatedRecords = payrollRecords.filter(
          r => !(r.employeeId === emp.id && r.month === selectedMonth)
        );

        const holdRecord: PayrollRecord = {
          id: `pay_${Date.now()}_${emp.id}`,
          employeeId: emp.id,
          employeeName: emp.name,
          salary: emp.salary !== undefined && emp.salary !== '' && !isNaN(Number(emp.salary)) ? Number(emp.salary) : 0,
          month: selectedMonth,
          status: 'Hold',
          updatedAt: new Date().toISOString()
        };
        
        updatedRecords.push(holdRecord);

        await saveCompanyPayroll(activeCompany.id, updatedRecords);
        setPayrollRecords(updatedRecords);
        showToast(`Salary for "${emp.name}" set to Hold.`, 'info');
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to update payroll status.', 'error');
    }
  };

  const handleDownloadPayslip = (employee: Employee, record: PayrollRecord) => {
    setPdfRenderSlip({ employee, record });
    showToast('Generating Payslip PDF...', 'info');
    setTimeout(async () => {
      try {
        if (pdfRef.current) {
          const filename = `Payslip_${employee.name.replace(/\s+/g, '_')}_${record.month}`;
          await downloadDocumentPDF(pdfRef.current, filename, 'portrait');
          showToast('Payslip downloaded successfully!', 'success');
        }
      } catch (err) {
        console.error(err);
        showToast('Failed to download payslip.', 'error');
      } finally {
        setPdfRenderSlip(null);
      }
    }, 300);
  };

  // Open modal to record payment details
  const handleOpenPaymentModal = (emp: Employee) => {
    setSelectedEmployee(emp);
    const defaultSalary = emp.salary !== undefined && emp.salary !== '' && !isNaN(Number(emp.salary))
      ? String(emp.salary)
      : '0';
    
    // Check if there is an existing record to prefill
    const existing = payrollRecords.find(
      r => r.employeeId === emp.id && r.month === selectedMonth
    );

    setPaymentAmount(existing ? String(existing.salary) : defaultSalary);
    setPaymentDate(existing?.paymentDate || new Date().toISOString().split('T')[0]);
    setPaymentMethod(existing?.paymentMethod || 'Bank Transfer');
    setPaymentNotes(existing?.notes || '');
    setPaymentModalOpen(true);
  };

  // Submit payment modal
  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCompany?.id || !selectedEmployee) return;

    const amountNum = parseFloat(paymentAmount);
    if (isNaN(amountNum) || amountNum < 0) {
      showToast('Please enter a valid payment amount.', 'error');
      return;
    }

    try {
      // Remove any existing record for this employee and month
      let updatedRecords = payrollRecords.filter(
        r => !(r.employeeId === selectedEmployee.id && r.month === selectedMonth)
      );

      // Add new Paid record
      const paidRecord: PayrollRecord = {
        id: `pay_${Date.now()}_${selectedEmployee.id}`,
        employeeId: selectedEmployee.id,
        employeeName: selectedEmployee.name,
        salary: amountNum,
        month: selectedMonth,
        status: 'Paid',
        paymentDate: paymentDate,
        paymentMethod: paymentMethod,
        notes: paymentNotes.trim() || undefined,
        updatedAt: new Date().toISOString()
      };

      updatedRecords.push(paidRecord);

      await saveCompanyPayroll(activeCompany.id, updatedRecords);
      setPayrollRecords(updatedRecords);
      setPaymentModalOpen(false);
      setSelectedEmployee(null);
      showToast(`Salary of ${formatCurrency(amountNum, activeCompany.currency?.split(' ')[1] || '₹')} paid to "${selectedEmployee.name}".`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to save payment details.', 'error');
    }
  };

  // Export payroll list as CSV
  const handleExportCSV = () => {
    if (filteredPayroll.length === 0) {
      showToast('No payroll data to export.', 'error');
      return;
    }

    const headers = ['Employee ID', 'Employee Name', 'Designation', 'Base Salary', 'Status', 'Paid Amount', 'Payment Date', 'Payment Method', 'Notes'];
    const rows = filteredPayroll.map(item => [
      item.employee.loginId,
      item.employee.name,
      item.employee.designation || 'N/A',
      item.employee.salary || 0,
      item.status,
      item.status === 'Paid' ? item.salary : 0,
      item.paymentDate || 'N/A',
      item.paymentMethod || 'N/A',
      item.notes || 'N/A'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `payroll_${selectedMonth}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Payroll records exported successfully.', 'success');
  };

  // Trigger browser print dialog for the current page
  const handlePrint = () => {
    window.print();
  };

  const currencySymbol = activeCompany?.currency ? activeCompany.currency.split(' ')[1] || '₹' : '₹';

  return (
    <MainLayout title="Salary Payroll">
      <div className="space-y-6 font-sans no-print">
        
        {/* Desktop Header & Month Selector */}
        <div className="hidden md:flex md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 leading-tight">
              Payroll Processing
            </h2>
            <p className="text-slate-400 text-xs font-semibold mt-1">
              Salary records and payment status for <span className="text-indigo-600 font-bold">{formattedMonthLabel}</span>
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
            {/* Month Input Styled */}
            <div className="relative flex-1 min-w-0 max-w-[150px] sm:max-w-none">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="month"
                id="payroll-month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="pl-9 pr-2 py-2 w-full bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-2xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none text-xs font-bold text-slate-700 transition-all cursor-pointer min-w-0"
              />
            </div>

            <Button
              variant="outline"
              icon={Printer}
              onClick={handlePrint}
              className="border-slate-200 text-slate-700 hover:bg-slate-50 rounded-2xl px-3 py-2 text-xs font-bold cursor-pointer shrink-0"
              id="btn-print-payroll"
            >
              <span className="hidden sm:inline">Print</span>
            </Button>

            <Button
              variant="outline"
              icon={Download}
              onClick={handleExportCSV}
              className="border-slate-200 text-slate-700 hover:bg-slate-50 rounded-2xl px-3 py-2 text-xs font-bold cursor-pointer shrink-0"
              id="btn-export-payroll"
            >
              <span className="hidden sm:inline">Export</span>
            </Button>
          </div>
        </div>



        {/* Stats Grid (Bento Layout) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Card 1: Total Budget (Spans 2 columns on all screens) */}
          <div className="bg-white border border-slate-200/60 rounded-3xl p-5 shadow-xs relative overflow-hidden flex flex-col justify-between min-h-[120px] col-span-2">
            <div className="absolute -right-4 -top-4 w-36 h-36 bg-gradient-to-br from-indigo-500/10 to-purple-500/5 rounded-full filter blur-2xl pointer-events-none"></div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Payroll Budget</span>
              <div className="w-9 h-9 rounded-2xl bg-indigo-50 text-indigo-650 flex items-center justify-center border border-indigo-100/30">
                <Banknote className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4">
              <h3 className="text-2xl md:text-3xl font-black text-slate-900 leading-none">
                {formatCurrency(stats.totalBudget, currencySymbol)}
              </h3>
              <p className="text-[10px] text-slate-400 font-semibold mt-1.5">Based on active employee profiles</p>
            </div>
          </div>

          {/* Card 2: Total Paid (Spans 1 column) */}
          <div className="bg-white border border-slate-200/60 rounded-3xl p-5 shadow-xs relative overflow-hidden flex flex-col justify-between min-h-[120px] col-span-1">
            <div className="absolute -right-4 -top-4 w-28 h-28 bg-emerald-500/10 rounded-full filter blur-xl pointer-events-none"></div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Paid</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100/30">
                <Coins className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-4">
              <h3 className="text-lg md:text-xl font-extrabold text-emerald-650 leading-none">
                {formatCurrency(stats.totalPaid, currencySymbol)}
              </h3>
              <p className="text-[9px] text-slate-400 font-semibold mt-1">Settled successfully</p>
            </div>
          </div>

          {/* Card 3: Total Hold (Spans 1 column) */}
          <div className="bg-white border border-slate-200/60 rounded-3xl p-5 shadow-xs relative overflow-hidden flex flex-col justify-between min-h-[120px] col-span-1">
            <div className="absolute -right-4 -top-4 w-28 h-28 bg-amber-500/10 rounded-full filter blur-xl pointer-events-none"></div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Withheld</span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100/30">
                <Wallet className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-4">
              <h3 className="text-lg md:text-xl font-extrabold text-amber-650 leading-none">
                {formatCurrency(stats.totalHold, currencySymbol)}
              </h3>
              <p className="text-[9px] text-slate-400 font-semibold mt-1">Marked on hold</p>
            </div>
          </div>
        </div>

        {/* Filter Controls & Search */}
        <div className="flex flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/65 shadow-xs">
          {/* Search bar & Filter Toggle */}
          <div className="relative w-full filter-popover-container">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by employee name or role..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200/80 rounded-2xl focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none text-xs transition-all font-semibold text-slate-800"
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setShowMobileFilters(!showMobileFilters)}
                className={`absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-xl transition-all cursor-pointer ${
                  showMobileFilters 
                    ? 'bg-indigo-55 text-indigo-600 border border-indigo-100' 
                    : 'text-slate-400 hover:text-slate-655 hover:bg-slate-100'
                }`}
                title="Toggle Filters"
              >
                <Filter className="w-4 h-4" />
              </button>
            </div>

            {/* Floating Popover for Filters - Speed Dial Inspired */}
            {showMobileFilters && (
              <div className="absolute top-full right-0 mt-2 z-30 flex flex-col items-end gap-2.5 animate-in slide-in-from-top-5 duration-200">
                <button
                  onClick={() => {
                    setStatusFilter('All');
                    setShowMobileFilters(false);
                  }}
                  className={`flex items-center gap-2 px-4 py-2.5 bg-white border rounded-2xl shadow-md text-xs font-bold transition-all hover:scale-105 active:scale-95 cursor-pointer pr-5 shrink-0 ${
                    statusFilter === 'All'
                      ? 'border-indigo-300 text-indigo-650 ring-2 ring-indigo-550/10'
                      : 'border-slate-200/85 text-slate-655 hover:bg-indigo-50/40 hover:text-indigo-650'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                  All ({stats.totalCount})
                </button>
                <button
                  onClick={() => {
                    setStatusFilter('Pending');
                    setShowMobileFilters(false);
                  }}
                  className={`flex items-center gap-2 px-4 py-2.5 bg-white border rounded-2xl shadow-md text-xs font-bold transition-all hover:scale-105 active:scale-95 cursor-pointer pr-5 shrink-0 ${
                    statusFilter === 'Pending'
                      ? 'border-indigo-300 text-indigo-650 ring-2 ring-indigo-550/10'
                      : 'border-slate-200/85 text-slate-655 hover:bg-indigo-50/40 hover:text-indigo-650'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  Pending ({stats.pendingCount})
                </button>
                <button
                  onClick={() => {
                    setStatusFilter('Paid');
                    setShowMobileFilters(false);
                  }}
                  className={`flex items-center gap-2 px-4 py-2.5 bg-white border rounded-2xl shadow-md text-xs font-bold transition-all hover:scale-105 active:scale-95 cursor-pointer pr-5 shrink-0 ${
                    statusFilter === 'Paid'
                      ? 'border-indigo-300 text-indigo-650 ring-2 ring-indigo-550/10'
                      : 'border-slate-200/85 text-slate-655 hover:bg-indigo-50/40 hover:text-indigo-650'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  Paid ({stats.paidCount})
                </button>
                <button
                  onClick={() => {
                    setStatusFilter('Hold');
                    setShowMobileFilters(false);
                  }}
                  className={`flex items-center gap-2 px-4 py-2.5 bg-white border rounded-2xl shadow-md text-xs font-bold transition-all hover:scale-105 active:scale-95 cursor-pointer pr-5 shrink-0 ${
                    statusFilter === 'Hold'
                      ? 'border-indigo-300 text-indigo-650 ring-2 ring-indigo-550/10'
                      : 'border-slate-200/85 text-slate-655 hover:bg-indigo-50/40 hover:text-indigo-650'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                  Hold ({stats.holdCount})
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Main Payroll List */}
        {loading ? (
          <div className="bg-white border border-slate-200/60 rounded-3xl p-8 space-y-4 animate-pulse">
            {[1, 2, 3].map(n => (
              <div key={n} className="flex items-center justify-between py-2 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-100 rounded-2xl" />
                  <div className="space-y-1">
                    <div className="h-3.5 bg-slate-100 rounded w-24" />
                    <div className="h-2.5 bg-slate-100 rounded w-16" />
                  </div>
                </div>
                <div className="h-8 bg-slate-100 rounded w-28" />
              </div>
            ))}
          </div>
        ) : filteredPayroll.length === 0 ? (
          <div className="bg-white border border-slate-200/60 rounded-3xl p-16 text-center shadow-xs">
            <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 mx-auto mb-4 border border-slate-100">
              <Users className="w-8 h-8" />
            </div>
            <h4 className="text-slate-900 font-bold text-sm">No Payroll Records Found</h4>
            <p className="text-slate-400 text-xs mt-1 max-w-xs mx-auto leading-relaxed">
              No employees matched the current filters. Ensure employees are created and have salaries configured.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop View (Table Layout) */}
            <div className="hidden md:block bg-white border border-slate-200/60 rounded-3xl overflow-hidden shadow-xs border-collapse">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      <th className="py-4.5 px-6">Employee Info</th>
                      <th className="py-4.5 px-6">Designation</th>
                      <th className="py-4.5 px-6">Salary</th>
                      <th className="py-4.5 px-6">Status</th>
                      <th className="py-4.5 px-6">Payment Details</th>
                      <th className="py-4.5 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredPayroll.map(({ employee, status, salary, paymentDate, paymentMethod, notes }) => {
                      const hasSalary = employee.salary !== undefined && employee.salary !== '' && Number(employee.salary) > 0;

                      return (
                        <tr key={employee.id} className="hover:bg-slate-50/50 transition-colors group">
                          {/* Employee Info */}
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              {employee.photo ? (
                                <img 
                                  src={employee.photo} 
                                  alt={employee.name} 
                                  className="w-10 h-10 rounded-2xl object-cover shrink-0 border border-slate-200 transition-transform group-hover:scale-105" 
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100/30 flex items-center justify-center shrink-0 font-extrabold text-xs text-indigo-650 uppercase transition-transform group-hover:scale-105">
                                  {employee.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                                </div>
                              )}
                              <div>
                                <h4 className="font-extrabold text-slate-900 text-sm leading-tight transition-colors group-hover:text-indigo-650">{employee.name}</h4>
                                <p className="text-[10px] text-slate-400 font-semibold mt-0.5">ID: {employee.loginId}</p>
                              </div>
                            </div>
                          </td>

                          {/* Designation */}
                          <td className="py-4 px-6 text-xs text-slate-600 font-medium">
                            {employee.designation || <span className="text-slate-400 italic">Not Specified</span>}
                          </td>

                          {/* Base Salary */}
                          <td className="py-4 px-6 text-xs font-bold text-slate-800">
                            {hasSalary ? (
                              formatCurrency(Number(employee.salary), currencySymbol)
                            ) : (
                              <span className="inline-flex items-center gap-1 text-rose-500 font-semibold">
                                <AlertCircle className="w-3.5 h-3.5" />
                                Salary Not Set
                              </span>
                            )}
                          </td>

                          {/* Payment Status Badges */}
                          <td className="py-4 px-6">
                            {status === 'Paid' ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 text-[10px] font-bold">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Paid
                              </span>
                            ) : status === 'Hold' ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-100 text-amber-700 text-[10px] font-bold">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                Hold
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200/60 text-slate-500 text-[10px] font-bold">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                                Pending
                              </span>
                            )}
                          </td>

                          {/* Payment Details */}
                          <td className="py-4 px-6">
                            {status === 'Paid' ? (
                              <span className="text-[11px] font-extrabold text-slate-700 whitespace-nowrap">
                                Settled: {formatCurrency(salary, currencySymbol)}
                              </span>
                            ) : status === 'Hold' ? (
                              <span className="text-[10px] text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100">Withheld</span>
                            ) : (
                              <span className="text-[10px] text-slate-400 font-medium italic">Pending release</span>
                            )}
                          </td>

                          {/* Actions (Paid & Hold options toggle) */}
                          <td className="py-4 px-6 text-right">
                            <div className="inline-flex items-center gap-1 bg-slate-50 border border-slate-200/50 p-1 rounded-2xl w-fit">
                              {/* Download Slip Option */}
                              {status === 'Paid' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const rec = payrollRecords.find(r => r.employeeId === employee.id && r.month === selectedMonth);
                                    if (rec) setPreviewSlip({ employee, record: rec });
                                  }}
                                  className="px-3.5 py-2 rounded-xl text-[11px] font-extrabold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 bg-white hover:bg-indigo-50/55 text-indigo-650 border border-slate-200/40 hover:border-indigo-150 shadow-2xs"
                                  title={`Preview Payslip for ${employee.name}`}
                                  id={`btn-payslip-${employee.id}`}
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  Slip
                                </button>
                              )}

                              {/* Paid Option */}
                              <button
                                type="button"
                                onClick={() => handleOpenPaymentModal(employee)}
                                className={`px-3.5 py-2 rounded-xl text-[11px] font-extrabold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                                  status === 'Paid'
                                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-100'
                                    : 'text-slate-500 hover:text-slate-800 hover:bg-white/70'
                                }`}
                                title={`Record Payment for ${employee.name}`}
                                id={`btn-paid-${employee.id}`}
                              >
                                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                Paid
                              </button>

                              {/* Hold Option */}
                              <button
                                type="button"
                                onClick={() => handleMarkAsHold(employee)}
                                className={`px-3.5 py-2 rounded-xl text-[11px] font-extrabold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                                  status === 'Hold'
                                    ? 'bg-amber-500 text-white shadow-md shadow-amber-100'
                                    : 'text-slate-500 hover:text-slate-800 hover:bg-white/70'
                                }`}
                                title={`Hold Payment for ${employee.name}`}
                                id={`btn-hold-${employee.id}`}
                              >
                                <Pause className="w-3.5 h-3.5 stroke-[2.5]" />
                                Hold
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile/Tablet View (Recent Documents Card Inspo) */}
            <div className="md:hidden space-y-4">
              {filteredPayroll.map(({ employee, status, salary, paymentDate, paymentMethod, notes }) => {
                const hasSalary = employee.salary !== undefined && employee.salary !== '' && Number(employee.salary) > 0;
                
                return (
                  <div 
                    key={employee.id}
                    className="p-5 bg-white border border-[#f1f3f9] rounded-3xl flex flex-col gap-4 shadow-xs hover:shadow-md transition-all duration-300 group"
                  >
                    {/* Top Row: Info and Salary (mimicking Recent Documents layout) */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3.5 min-w-0">
                        {employee.photo ? (
                          <div className="w-10 h-10 rounded-2xl overflow-hidden shrink-0 border border-slate-200 transition-transform group-hover:scale-105">
                            <img 
                              src={employee.photo} 
                              alt={employee.name} 
                              className="w-full h-full object-cover" 
                            />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100/30 flex items-center justify-center shrink-0 font-extrabold text-xs text-indigo-650 uppercase transition-transform group-hover:scale-105">
                            {employee.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="font-extrabold text-[13px] text-slate-900 truncate transition-colors group-hover:text-indigo-650">
                            {employee.name}
                          </div>
                          <p className="text-[10px] text-slate-500 font-semibold truncate mt-0.5">
                            {employee.designation || 'Staff'} • ID: {employee.loginId}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <p className={`font-extrabold text-xs transition-colors ${
                          status === 'Paid' ? 'text-emerald-600' : 'text-slate-900'
                        }`}>
                          {hasSalary ? (
                            formatCurrency(Number(employee.salary), currencySymbol)
                          ) : (
                            <span className="text-rose-500 font-bold">Not Set</span>
                          )}
                        </p>
                        <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                          {status === 'Paid' ? `Paid (${paymentMethod})` : status === 'Hold' ? 'Hold' : 'Pending'}
                        </p>
                      </div>
                    </div>

                    {/* Bottom Row: Status Badge and Action Buttons */}
                    <div className="flex items-center justify-between pt-3 border-t border-slate-100/80">
                      <div>
                        {status === 'Paid' ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 text-[10px] font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Paid
                          </span>
                        ) : status === 'Hold' ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-100 text-amber-700 text-[10px] font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            Hold
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200/60 text-slate-500 text-[10px] font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                            Pending
                          </span>
                        )}
                      </div>

                      <div className="inline-flex items-center gap-1 bg-slate-50 border border-slate-200/50 p-1 rounded-2xl">
                        {status === 'Paid' && (
                          <button
                            type="button"
                            onClick={() => {
                              const rec = payrollRecords.find(r => r.employeeId === employee.id && r.month === selectedMonth);
                              if (rec) setPreviewSlip({ employee, record: rec });
                            }}
                            className="px-3 py-2 rounded-xl text-[10px] font-extrabold transition-all flex items-center gap-1 active:scale-95 bg-white hover:bg-indigo-50/55 text-indigo-650 border border-slate-200/40 hover:border-indigo-150 shadow-2xs cursor-pointer"
                            title={`Preview Payslip for ${employee.name}`}
                          >
                            <Download className="w-3.5 h-3.5" />
                            Slip
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleOpenPaymentModal(employee)}
                          className={`px-3 py-2 rounded-xl text-[10px] font-extrabold transition-all flex items-center gap-1 active:scale-95 cursor-pointer ${
                            status === 'Paid'
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'text-slate-500 hover:text-slate-800 hover:bg-white/70'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                          Paid
                        </button>

                        <button
                          type="button"
                          onClick={() => handleMarkAsHold(employee)}
                          className={`px-3 py-2 rounded-xl text-[10px] font-extrabold transition-all flex items-center gap-1 active:scale-95 cursor-pointer ${
                            status === 'Hold'
                              ? 'bg-amber-500 text-white shadow-xs'
                              : 'text-slate-500 hover:text-slate-800 hover:bg-white/70'
                          }`}
                        >
                          <Pause className="w-3.5 h-3.5 stroke-[2.5]" />
                          Hold
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Payslip Preview Modal */}
      {previewSlip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2">
                <BadgeCheck className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-800 text-sm">
                  Payslip Preview - {previewSlip.employee.name} ({previewSlip.record.month})
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setPreviewSlip(null)}
                  className="rounded-xl px-4 py-2 text-xs font-bold border border-slate-250/70 text-slate-700 bg-white hover:bg-slate-50 cursor-pointer"
                >
                  Close Preview
                </Button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 bg-slate-200/80 p-6 overflow-auto flex justify-center items-start">
              <div className="bg-white p-4 shadow-lg rounded border border-slate-200/60 w-full max-w-[210mm]">
                <PayslipTemplate
                  company={activeCompany}
                  employee={previewSlip.employee}
                  record={previewSlip.record}
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 bg-white border-t border-slate-200 flex justify-end gap-2">
              <Button 
                variant="outline" 
                icon={Printer} 
                onClick={() => {
                  handleDownloadPayslip(previewSlip.employee, previewSlip.record);
                }}
                className="cursor-pointer"
              >
                Print / PDF Dialog
              </Button>
              <Button 
                icon={Download} 
                onClick={() => {
                  handleDownloadPayslip(previewSlip.employee, previewSlip.record);
                }}
                className="cursor-pointer bg-indigo-650 hover:bg-indigo-700 text-white"
              >
                Download PDF
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Release Payment Dialog Modal */}
      {paymentModalOpen && selectedEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto font-sans">
          <div 
            className="absolute inset-0 cursor-pointer" 
            onClick={() => setPaymentModalOpen(false)}
          />
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 pb-4 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                  <BadgeCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base leading-none">Record Payment</h3>
                  <p className="text-[10px] text-slate-400 font-semibold mt-1">Release monthly salary to employee</p>
                </div>
              </div>
              <button 
                onClick={() => setPaymentModalOpen(false)}
                className="w-7 h-7 rounded-lg border border-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSavePayment} className="p-5 space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Employee</label>
                <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 p-3 rounded-2xl">
                  {selectedEmployee.photo ? (
                    <img src={selectedEmployee.photo} alt={selectedEmployee.name} className="w-10 h-10 rounded-2xl object-cover border border-slate-200" />
                  ) : (
                    <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100/30 flex items-center justify-center shrink-0 font-extrabold text-xs text-indigo-650 uppercase">
                      {selectedEmployee.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                    </div>
                  )}
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm leading-none">{selectedEmployee.name}</h4>
                    <p className="text-[10px] text-slate-400 font-bold mt-1">ID: {selectedEmployee.loginId} {selectedEmployee.designation ? `• ${selectedEmployee.designation}` : ''}</p>
                  </div>
                </div>
              </div>

              {/* Amount to pay */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Paid Amount ({currencySymbol})</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none text-sm font-bold text-slate-800 transition-all"
                />
              </div>

              {/* Date of payment */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Payment Date</label>
                <input
                  type="date"
                  required
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none text-xs font-bold text-slate-700 transition-all cursor-pointer"
                />
              </div>

              {/* Method of payment */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none text-xs font-bold text-slate-700 transition-all cursor-pointer"
                >
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="Cheque">Cheque</option>
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Notes (Optional)</label>
                <textarea
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="e.g. Transaction ID, Bonus details, adjustments..."
                  rows={2}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none text-xs font-semibold text-slate-700 transition-all resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between gap-1.5 pt-3 border-t border-slate-150">
                {selectedEmployee && payrollRecords.some(r => r.employeeId === selectedEmployee.id && r.month === selectedMonth && r.status === 'Paid') ? (
                  <Button
                    variant="danger"
                    onClick={async () => {
                      if (!activeCompany?.id || !selectedEmployee) return;
                      try {
                        const updatedRecords = payrollRecords.filter(
                          r => !(r.employeeId === selectedEmployee.id && r.month === selectedMonth)
                        );
                        await saveCompanyPayroll(activeCompany.id, updatedRecords);
                        setPayrollRecords(updatedRecords);
                        setPaymentModalOpen(false);
                        setSelectedEmployee(null);
                        showToast(`Salary payment for "${selectedEmployee.name}" reset to Pending.`, 'info');
                      } catch (err) {
                        console.error(err);
                        showToast('Failed to reset payment.', 'error');
                      }
                    }}
                    className="rounded-2xl px-2.5 py-2 text-[10px] sm:text-xs font-bold cursor-pointer whitespace-nowrap text-center shrink min-w-0"
                  >
                    Reset to Pending
                  </Button>
                ) : (
                  <div className="shrink" />
                )}
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    variant="outline"
                    onClick={() => setPaymentModalOpen(false)}
                    className="border-slate-200 text-slate-600 hover:bg-slate-50 rounded-2xl px-2.5 py-2 text-[10px] sm:text-xs font-bold cursor-pointer whitespace-nowrap text-center"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl px-3 py-2 text-[10px] sm:text-xs font-bold shadow-md shadow-emerald-100 cursor-pointer whitespace-nowrap text-center"
                    id="btn-confirm-payment"
                  >
                    Confirm Payment
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Print-Only Layout */}
      <div className="hidden print-only font-sans p-6 text-slate-900 bg-white min-h-screen">
        <div className="flex justify-between items-start border-b border-slate-300 pb-4 mb-6">
          <div>
            <h1 className="text-xl font-extrabold text-slate-900">{activeCompany?.companyName || 'Company'}</h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1">Salary Payroll Summary Report</p>
            <p className="text-[11px] text-slate-700 font-medium mt-1">Month: <span className="font-bold">{formattedMonthLabel}</span></p>
          </div>
          <div className="text-right text-[10px] text-slate-500 font-semibold">
            <p>Generated: {new Date().toLocaleString()}</p>
            <p className="mt-1">Currency: {activeCompany?.currency || 'INR ₹'}</p>
          </div>
        </div>

        {/* Stats Printout */}
        <div className="grid grid-cols-3 gap-4 border border-slate-200 rounded-xl p-4 mb-6">
          <div>
            <p className="text-[9px] uppercase font-bold text-slate-400">Total Payroll Budget</p>
            <p className="text-base font-extrabold text-slate-950 mt-0.5">{formatCurrency(stats.totalBudget, currencySymbol)}</p>
          </div>
          <div>
            <p className="text-[9px] uppercase font-bold text-slate-400">Total Release Amount</p>
            <p className="text-base font-extrabold text-emerald-800 mt-0.5">{formatCurrency(stats.totalPaid, currencySymbol)}</p>
          </div>
          <div>
            <p className="text-[9px] uppercase font-bold text-slate-400">Withheld / Pending</p>
            <p className="text-base font-extrabold text-amber-800 mt-0.5">{formatCurrency(stats.totalHold, currencySymbol)}</p>
          </div>
        </div>

        {/* Print Table */}
        <table className="w-full text-left border-collapse border border-slate-200">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-600">
              <th className="py-2.5 px-3 border border-slate-200">Employee ID</th>
              <th className="py-2.5 px-3 border border-slate-200">Employee Name</th>
              <th className="py-2.5 px-3 border border-slate-200">Designation</th>
              <th className="py-2.5 px-3 border border-slate-200">Base Salary</th>
              <th className="py-2.5 px-3 border border-slate-200">Status</th>
              <th className="py-2.5 px-3 border border-slate-200">Paid Amount</th>
              <th className="py-2.5 px-3 border border-slate-200">Payment Date / Via</th>
              <th className="py-2.5 px-3 border border-slate-200">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-[11px]">
            {mappedPayroll.map(({ employee, status, salary, paymentDate, paymentMethod, notes }) => (
              <tr key={employee.id}>
                <td className="py-2 px-3 border border-slate-200 font-bold">{employee.loginId}</td>
                <td className="py-2 px-3 border border-slate-200 font-extrabold">{employee.name}</td>
                <td className="py-2 px-3 border border-slate-200">{employee.designation || '-'}</td>
                <td className="py-2 px-3 border border-slate-200 font-bold">{formatCurrency(Number(employee.salary || 0), currencySymbol)}</td>
                <td className="py-2 px-3 border border-slate-200 font-bold">{status}</td>
                <td className="py-2 px-3 border border-slate-200 font-bold">
                  {status === 'Paid' ? formatCurrency(salary, currencySymbol) : '-'}
                </td>
                <td className="py-2 px-3 border border-slate-200">
                  {status === 'Paid' ? `${paymentDate ? formatDate(paymentDate) : ''} (${paymentMethod})` : '-'}
                </td>
                <td className="py-2 px-3 border border-slate-200 text-slate-500 italic">{notes || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Footer Signature line for prints */}
        <div className="mt-16 flex justify-between text-[11px] font-semibold text-slate-500">
          <div>
            <div className="w-40 border-b border-slate-400 mb-1"></div>
            <p>Prepared By</p>
          </div>
          <div className="text-right">
            <div className="w-40 border-b border-slate-400 mb-1"></div>
            <p>Authorized Signature</p>
          </div>
        </div>
      </div>

      {/* Hidden Payslip Printable Wrapper */}
      {pdfRenderSlip && (
        <div className="hidden">
          <div ref={pdfRef}>
            <PayslipTemplate
              company={activeCompany}
              employee={pdfRenderSlip.employee}
              record={pdfRenderSlip.record}
            />
          </div>
        </div>
      )}

      {/* Mobile Floating Action Button (FAB) with Speed Dial for Print, Export, and Month Search */}
      <div className="md:hidden fixed bottom-20 right-6 z-40 flex flex-col items-end gap-3 no-print">
        {/* Expanded Speed Dial Options */}
        {showMobileControls && (
          <div className="flex flex-col gap-2.5 items-end animate-in slide-in-from-bottom-5 duration-200">
            
            {/* Month Selector Option */}
            <div className="flex items-center gap-2 px-3.5 py-2.5 bg-white border border-slate-200 rounded-2xl shadow-md pr-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Month:</span>
              <div className="relative w-32">
                <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="pl-7 pr-1 py-1 w-full bg-slate-50 border border-slate-200 rounded-lg outline-none text-[11px] font-bold text-slate-700 cursor-pointer"
                />
              </div>
            </div>

            {/* Print Payroll Option */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handlePrint();
                setShowMobileControls(false);
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-2xl shadow-md hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all hover:scale-105 active:scale-95 cursor-pointer pr-5 shrink-0"
            >
              <Printer className="w-4.5 h-4.5 text-slate-500" />
              <span>Print Payroll</span>
            </button>

            {/* Export CSV Option */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleExportCSV();
                setShowMobileControls(false);
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-2xl shadow-md hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all hover:scale-105 active:scale-95 cursor-pointer pr-5 shrink-0"
            >
              <Download className="w-4.5 h-4.5 text-slate-500" />
              <span>Export CSV</span>
            </button>
          </div>
        )}

        {/* Main FAB Trigger */}
        <div className="relative">
          {/* Glow pulsing ring behind the button */}
          {!showMobileControls && (
            <span className="absolute -inset-1 rounded-[20px] bg-indigo-400 opacity-25 animate-ping duration-1000 pointer-events-none"></span>
          )}
          <button
            onClick={() => setShowMobileControls(!showMobileControls)}
            className="relative w-14 h-14 bg-gradient-to-tr from-blue-600 via-indigo-650 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white rounded-[20px] flex items-center justify-center shadow-lg shadow-indigo-600/30 hover:shadow-xl hover:scale-105 active:scale-95 transition-all cursor-pointer border border-white/10 group"
            title="Toggle Actions"
          >
            {showMobileControls ? (
              <X className="w-6 h-6 stroke-[2.8]" />
            ) : (
              <Plus className="w-6 h-6 stroke-[2.8] transition-transform duration-300 group-hover:rotate-90" />
            )}
          </button>
        </div>
      </div>
    </MainLayout>
  );
};

export default Payroll;
