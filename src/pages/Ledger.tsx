import React, { useState, useMemo, useRef, useEffect } from 'react';
import { MainLayout } from '../components/layout/MainLayout';
import { useCompany } from '../contexts/CompanyContext';
import { useDocument } from '../contexts/DocumentContext';
import { formatCurrency, formatDate } from '../utils/formatting';
import { downloadDocumentPDF } from '../services/pdfGenerator';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Badge } from '../components/ui/Badge';
import { TemplateWrapper } from '../templates/TemplateWrapper';
import { calculateTotals } from '../utils/calculations';
import { ResponsiveDocumentWrapper } from '../components/ui/ResponsiveDocumentWrapper';
import { 
  BookOpen, 
  Download, 
  Calendar, 
  Users, 
  TrendingUp, 
  TrendingDown, 
  Scale, 
  ExternalLink,
  Eye,
  Printer,
  Plus,
  X,
  Search,
  Filter
} from 'lucide-react';
import { useToast } from '../components/ui/Toast';
import { getAllExpenses } from '../services/db';

export const Ledger = () => {
  const { activeCompany } = useCompany();
  const { documents } = useDocument();
  const { showToast } = useToast();
  
  const employeeJson = localStorage.getItem('activeEmployee');
  const activeEmployee = employeeJson ? (() => {
    try { return JSON.parse(employeeJson); } catch (e) { return null; }
  })() : null;

  const printRef = useRef(null);
  const pdfRef = useRef(null);
  const advancePrintRef = useRef(null);

  const [expenses, setExpenses] = useState([]);

  // Filters state
  const [selectedParty, setSelectedParty] = useState('all');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [activeFilterCategory, setActiveFilterCategory] = useState<'party' | 'start' | 'end' | null>(null);

  // Modal and PDF export state
  const [previewDoc, setPreviewDoc] = useState(null);
  const [pdfRenderDoc, setPdfRenderDoc] = useState(null);
  const [showLedgerPreviewModal, setShowLedgerPreviewModal] = useState(false);
  const [ledgerReportType, setLedgerReportType] = useState<any>(null);
  const [showMobileControls, setShowMobileControls] = useState(false);

  // Scroll direction state for hiding/showing sticky header
  const [scrollDirection, setScrollDirection] = useState('up');
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY && currentScrollY > 150) {
        setScrollDirection('down');
      } else {
        setScrollDirection('up');
      }
      setLastScrollY(currentScrollY);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

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

  useEffect(() => {
    const loadExpensesData = async () => {
      if (!activeCompany?.id) return;
      try {
        let data = await getAllExpenses(activeCompany.id);
        if (activeEmployee && !activeEmployee.isAdmin) {
          data = data.filter(e => e.createdBy === activeEmployee.name);
        }
        setExpenses(data);
      } catch (err) {
        console.error('Failed to load expenses for ledger:', err);
      }
    };
    loadExpensesData();
  }, [activeCompany?.id, activeEmployee]);

  // Extract unique customer/party names from all documents and expenses
  const parties = useMemo(() => {
    const names = new Set<string>();
    documents.forEach(d => {
      const companySpecific = !d.companyId || !activeCompany?.id || d.companyId === activeCompany.id;
      if (companySpecific) {
        if (activeEmployee && !activeEmployee.isAdmin && d.createdBy !== activeEmployee.name) return;
        const name = d.customer?.customerName || d.paidTo || d.receivedFrom;
        if (name && name.trim()) {
          names.add(name.trim());
        }
      }
    });
    expenses.forEach(e => {
      const companySpecific = !e.companyId || !activeCompany?.id || e.companyId === activeCompany.id;
      if (companySpecific) {
        if (activeEmployee && !activeEmployee.isAdmin && e.createdBy !== activeEmployee.name) return;
        if (e.projectEvent && e.projectEvent.trim()) {
          names.add(e.projectEvent.trim());
        }
      }
    });
    return Array.from(names).sort();
  }, [documents, expenses, activeCompany, activeEmployee]);

  // Compute ledger entries
  const ledgerData = useMemo(() => {
    // 1. Filter documents by company, date, and party
    const activeDocs = documents.filter(d => {
      const companySpecific = !d.companyId || !activeCompany?.id || d.companyId === activeCompany.id;
      if (!companySpecific) return false;

      if (activeEmployee && !activeEmployee.isAdmin && d.createdBy !== activeEmployee.name) return false;

      // Filter out all voucher documents
      if (d.documentType === 'voucher') return false;

      // Date check
      const docDate = d.documentDate || d.createdAt?.slice(0, 10);
      if (docDate < startDate || docDate > endDate) return false;

      // Party check
      if (selectedParty !== 'all') {
        const name = d.customer?.customerName || d.paidTo || d.receivedFrom;
        if (name?.trim() !== selectedParty) return false;
      }

      return true;
    }).map(d => ({
      id: d.id,
      date: d.documentDate || d.createdAt?.slice(0, 10),
      rawDate: d.documentDate || d.createdAt,
      type: d.documentType || 'invoice',
      number: d.documentNumber,
      particulars: `${(d.documentType || 'invoice').toUpperCase()} - ${d.customer?.customerName || d.paidTo || d.receivedFrom || 'N/A'} ${d.description ? `(${d.description})` : ''}`,
      amount: d.totals?.grandTotal || parseFloat(d.amount) || 0,
      voucherType: d.voucherType,
      previewUrl: `${window.location.origin}/preview/${d.id}`,
      isExpense: false,
      partyOrProject: d.customer?.customerName || d.paidTo || d.receivedFrom || 'N/A',
      status: d.status,
      createdBy: d.createdBy
    }));

    // 2. Filter expenses
    const activeExpenses = expenses.filter(e => {
      const companySpecific = !e.companyId || !activeCompany?.id || e.companyId === activeCompany.id;
      if (!companySpecific) return false;

      if (activeEmployee && !activeEmployee.isAdmin && e.createdBy !== activeEmployee.name) return false;

      // Date check
      const expDate = e.date || e.createdAt?.slice(0, 10);
      if (expDate < startDate || expDate > endDate) return false;

      // Party check
      if (selectedParty !== 'all') {
        const matchesParty = e.projectEvent?.trim() === selectedParty || 
                             e.particulars?.toLowerCase().includes(selectedParty.toLowerCase()) ||
                             e.category?.toLowerCase().includes(selectedParty.toLowerCase());
        if (!matchesParty) return false;
      }

      return true;
    }).map(e => ({
      id: e.id,
      documentId: e.documentId,
      date: e.date || e.createdAt?.slice(0, 10),
      rawDate: e.date || e.createdAt,
      type: 'expense',
      number: 'EXP-' + e.id.slice(-6).toUpperCase(),
      particulars: `EXPENSE - ${e.particulars} [${e.category}] ${e.projectEvent ? `(Project: ${e.projectEvent})` : ''}`,
      amount: parseFloat(e.amount) || 0,
      previewUrl: `${window.location.origin}/expenses`,
      isExpense: true,
      partyOrProject: e.projectEvent || e.category || 'N/A',
      createdBy: e.createdBy
    }));

    // Combine and sort by date ascending
    const combined = [...activeDocs, ...activeExpenses];
    combined.sort((a, b) => {
      return a.rawDate.localeCompare(b.rawDate);
    });

    // Compute running balance
    let runningBalance = 0;
    const entries = combined.map(item => {
      let debit = 0;
      let credit = 0;

      if (item.isExpense) {
        debit = item.amount;
      } else {
        if (item.type === 'invoice') {
          if (item.status === 'Paid') {
            credit = item.amount;
          } else {
            debit = item.amount;
          }
        } else if (item.type === 'voucher') {
          if (item.voucherType === 'Payment Voucher' || item.voucherType === 'Expense Voucher') {
            debit = item.amount;
          } else {
            credit = item.amount;
          }
        } else if (item.type === 'receipt') {
          credit = item.amount;
        }
      }

      runningBalance += (debit - credit);

      return {
        id: item.id,
        documentId: (item as any).documentId,
        date: item.date,
        number: item.number,
        type: item.type,
        particulars: item.particulars,
        debit,
        credit,
        balance: runningBalance,
        previewUrl: item.previewUrl,
        isExpense: item.isExpense,
        partyOrProject: item.partyOrProject,
        createdBy: (item as any).createdBy
      };
    });

    // Totals calculations
    const totalDebit = entries.reduce((sum, e) => sum + e.debit, 0);
    const totalCredit = entries.reduce((sum, e) => sum + e.credit, 0);

    return {
      entries,
      totalDebit,
      totalCredit,
      finalBalance: runningBalance
    };
  }, [documents, expenses, activeCompany, selectedParty, startDate, endDate, activeEmployee]);

  const advanceAnalytics = useMemo(() => {
    const entries = ledgerData.entries;
    const invoiceVolume = entries.filter(e => e.type === 'invoice').reduce((sum, e) => sum + e.debit, 0);
    const voucherVolume = entries.filter(e => e.type === 'voucher').reduce((sum, e) => sum + e.debit + e.credit, 0);
    const receiptVolume = entries.filter(e => e.type === 'receipt').reduce((sum, e) => sum + e.credit, 0);
    const expenseVolume = entries.filter(e => e.type === 'expense').reduce((sum, e) => sum + e.debit, 0);
    const totalVolume = invoiceVolume + voucherVolume + receiptVolume + expenseVolume;

    const invoiceCount = entries.filter(e => e.type === 'invoice').length;
    const voucherCount = entries.filter(e => e.type === 'voucher').length;
    const receiptCount = entries.filter(e => e.type === 'receipt').length;
    const expenseCount = entries.filter(e => e.type === 'expense').length;

    const maxDebit = entries.reduce((max, e) => Math.max(max, e.debit), 0);
    const maxCredit = entries.reduce((max, e) => Math.max(max, e.credit), 0);
    const avgTransaction = entries.length > 0
      ? entries.reduce((sum, e) => sum + e.debit + e.credit, 0) / entries.length
      : 0;

    let barData = [];
    if (entries.length > 0) {
      const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
      if (sorted.length <= 6) {
        barData = sorted.map(e => ({
          label: formatDate(e.date).slice(0, 6),
          debit: e.debit,
          credit: e.credit
        }));
      } else {
        const startMs = new Date(startDate).getTime();
        const endMs = new Date(endDate).getTime();
        const step = (endMs - startMs) / 5;
        const intervals = Array.from({ length: 5 }, (_, i) => {
          const from = startMs + i * step;
          const to = from + step;
          const dateObj = new Date(from);
          const label = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          return {
            from,
            to,
            label,
            debit: 0,
            credit: 0
          };
        });
        sorted.forEach(e => {
          const time = new Date(e.date).getTime();
          const interval = intervals.find(inv => time >= inv.from && time <= inv.to) || intervals[intervals.length - 1];
          interval.debit += e.debit;
          interval.credit += e.credit;
        });
        barData = intervals;
      }
    }

    return {
      invoiceVolume,
      voucherVolume,
      receiptVolume,
      expenseVolume,
      totalVolume,
      invoiceCount,
      voucherCount,
      receiptCount,
      expenseCount,
      maxDebit,
      maxCredit,
      avgTransaction,
      barData
    };
  }, [ledgerData, startDate, endDate]);

  const currencySymbol = activeCompany?.currency ? activeCompany.currency.split(' ')[1] || '₹' : '₹';

  // Export to Excel (CSV)
  const handleExportCSV = () => {
    if (ledgerData.entries.length === 0) {
      showToast('No ledger data available to export.', 'warning');
      return;
    }

    try {
      const headers = ['Date', 'Document Type', 'Document Number', 'Particulars', `Debit (${currencySymbol})`, `Credit (${currencySymbol})`, `Balance (${currencySymbol})`, 'Bill Preview Link'];
      
      const csvRows = [headers.join(',')];
      
      ledgerData.entries.forEach(e => {
        const row = [
          e.date,
          e.type.toUpperCase(),
          e.number,
          `"${e.particulars.replace(/"/g, '""')}"`,
          e.debit.toFixed(2),
          e.credit.toFixed(2),
          e.balance.toFixed(2),
          `"=HYPERLINK(""${e.previewUrl}"",""Preview Bill"")"`
        ];
        csvRows.push(row.join(','));
      });

      // Add totals row
      const summaryRow = [
        'TOTALS',
        '',
        '',
        '',
        ledgerData.totalDebit.toFixed(2),
        ledgerData.totalCredit.toFixed(2),
        ledgerData.finalBalance.toFixed(2),
        ''
      ];
      csvRows.push(summaryRow.join(','));

      const csvContent = csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      const partyStr = selectedParty === 'all' ? 'All_Parties' : selectedParty.replace(/\s+/g, '_');
      link.setAttribute('download', `Ledger_${partyStr}_${startDate}_to_${endDate}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('Excel CSV exported successfully!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to export Excel CSV.', 'error');
    }
  };

  // Export to PDF
  const handleExportPDF = async () => {
    if (ledgerData.entries.length === 0) {
      showToast('No ledger data available to export.', 'warning');
      return;
    }

    showToast('Generating Ledger PDF report...', 'info');
    setTimeout(async () => {
      try {
        if (printRef.current) {
          const partyStr = selectedParty === 'all' ? 'All_Parties' : selectedParty.replace(/\s+/g, '_');
          await downloadDocumentPDF(printRef.current, `Ledger_${partyStr}_${startDate}_to_${endDate}`, 'portrait');
          showToast('Ledger PDF downloaded successfully!', 'success');
        }
      } catch (err) {
        console.error(err);
        showToast('Failed to export PDF.', 'error');
      }
    }, 300);
  };

  const handleExportAdvancePDF = async () => {
    if (ledgerData.entries.length === 0) {
      showToast('No ledger data available to export.', 'warning');
      return;
    }

    showToast('Generating Advance Financial Report...', 'info');
    setTimeout(async () => {
      try {
        if (advancePrintRef.current) {
          const partyStr = selectedParty === 'all' ? 'All_Parties' : selectedParty.replace(/\s+/g, '_');
          await downloadDocumentPDF(advancePrintRef.current, `Advance_Ledger_${partyStr}_${startDate}_to_${endDate}`, 'portrait');
          showToast('Advance Report PDF downloaded successfully!', 'success');
        }
      } catch (err) {
        console.error(err);
        showToast('Failed to export Advance PDF.', 'error');
      }
    }, 300);
  };



  const handleDownload = async (doc) => {
    setPdfRenderDoc(doc);
    showToast('Generating PDF document...', 'info');
    setTimeout(async () => {
      try {
        if (pdfRef.current) {
          const prefix = doc.documentNumber || 'Doc';
          const name = doc.customer?.customerName || doc.paidTo || doc.receivedFrom || 'Client';
          const orientation = doc.documentType === 'invoice' || !doc.documentType ? 'portrait' : 'landscape';
          await downloadDocumentPDF(pdfRef.current, `${prefix}-${name.replace(/\s+/g, '_')}`, orientation);
          showToast('PDF downloaded successfully!', 'success');
        }
      } catch (err) {
        console.error(err);
        showToast('Failed to download PDF.', 'error');
      } finally {
        setPdfRenderDoc(null);
      }
    }, 300);
  };

  const watermarkImage = activeCompany?.watermarkLogo;

  const renderStandardLedgerContent = () => {
    return (
      <>
        {/* BACKGROUND WATERMARK */}
        {watermarkImage && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 overflow-hidden">
            <img
              src={watermarkImage}
              alt="Company Watermark"
              className="w-96 h-96 object-contain opacity-[0.08] grayscale contrast-200"
            />
          </div>
        )}

        {/* Report Header */}
        <div className="flex justify-between items-start border-b border-slate-200 pb-4 relative z-10">
          <div className="flex items-center gap-3">
            {activeCompany?.logo ? (
              <img src={activeCompany.logo} alt="Logo" className="w-10 h-10 rounded-lg object-contain border p-1" />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-base">
                {activeCompany?.companyName ? activeCompany.companyName.charAt(0).toUpperCase() : 'C'}
              </div>
            )}
            <div>
              <h1 className="text-sm font-extrabold text-slate-900 uppercase tracking-tight">{activeCompany?.companyName || 'General Ledger'}</h1>
              <p className="text-[9px] text-slate-500">{activeCompany?.address}</p>
              <p className="text-[9px] text-slate-500">Phone: {activeCompany?.phone} | Email: {activeCompany?.email}</p>
              {activeCompany?.gstNumber && <p className="text-[9px] text-slate-500 font-mono">GSTIN: {activeCompany.gstNumber}</p>}
            </div>
          </div>
          <div className="text-right">
            <h2 className="text-base font-black text-blue-600 uppercase tracking-wider">Statement of Account</h2>
            <p className="text-[9px] text-slate-500 font-bold mt-0.5">Report Type: Standard Statement</p>
            <p className="text-[9px] text-slate-500 font-bold">Period: {formatDate(startDate)} to {formatDate(endDate)}</p>
            <p className="text-[8px] text-slate-400">Statement for: {selectedParty === 'all' ? 'All Customers & Vendors' : selectedParty}</p>
          </div>
        </div>

        {/* Account Metrics Overview */}
        <div className="grid grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100 relative z-10">
          <div>
            <p className="text-[9px] font-bold text-slate-400 uppercase">Total Debits</p>
            <p className="text-xs font-black text-blue-600 mt-0.5">{formatCurrency(ledgerData.totalDebit, currencySymbol)}</p>
          </div>
          <div>
            <p className="text-[9px] font-bold text-slate-400 uppercase">Total Credits</p>
            <p className="text-xs font-black text-emerald-600 mt-0.5">{formatCurrency(ledgerData.totalCredit, currencySymbol)}</p>
          </div>
          <div>
            <p className="text-[9px] font-bold text-slate-400 uppercase">Closing Balance</p>
            <p className="text-xs font-black text-slate-900 mt-0.5">{formatCurrency(ledgerData.finalBalance, currencySymbol)}</p>
          </div>
        </div>

        {/* Print Table */}
        <table className="w-full text-left border-collapse text-[10px] relative z-10">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 font-bold uppercase text-[8px]">
              <th className="py-2 px-3">Date</th>
              <th className="py-2 px-3">Particulars</th>
              <th className="py-2 px-3">Doc #</th>
              <th className="py-2 px-3 text-right">Debit (+)</th>
              <th className="py-2 px-3 text-right">Credit (-)</th>
              <th className="py-2 px-3 text-right">Balance</th>
              <th className="py-2 px-3 text-center">Bill Link</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 font-medium">
            {ledgerData.entries.map((row, idx) => (
              <tr key={idx}>
                <td className="py-2 px-3 text-slate-500">{formatDate(row.date)}</td>
                <td className="py-2 px-3 max-w-[180px]">
                  <div className="truncate text-slate-800" title={row.particulars}>{row.particulars}</div>
                  {(row as any).createdBy && (
                    <div className="text-[8px] text-slate-400 font-semibold mt-0.5">by {(row as any).createdBy}</div>
                  )}
                </td>
                <td className="py-2 px-3 font-mono text-slate-600 uppercase">{row.number}</td>
                <td className={`py-2 px-3 text-right font-semibold ${
                  row.type === 'invoice' ? 'text-rose-600' : 'text-blue-600'
                }`}>{row.debit > 0 ? formatCurrency(row.debit, currencySymbol) : '-'}</td>
                <td className="py-2 px-3 text-right text-emerald-600 font-semibold">{row.credit > 0 ? formatCurrency(row.credit, currencySymbol) : '-'}</td>
                <td className="py-2 px-3 text-right text-slate-900 font-black">{formatCurrency(row.balance, currencySymbol)}</td>
                <td className="py-2 px-3 text-center">
                  <a 
                    href={row.isExpense ? `${window.location.origin}/preview/${row.documentId || row.id}` : row.previewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[9px] font-bold text-blue-600 underline"
                  >
                    Preview Bill
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Footer Signatures */}
        <div className="pt-12 flex justify-between relative z-10">
          <div>
            <p className="text-[8px] text-slate-400">Report generated dynamically on: {new Date().toLocaleDateString()}</p>
          </div>
          <div className="text-right pr-6 flex flex-col items-end">
            {activeCompany?.cfoSignature ? (
              <img src={activeCompany.cfoSignature} alt="CFO Signature" className="h-10 w-auto mb-1 object-contain" />
            ) : (
              <div className="h-10"></div>
            )}
            <div className="border-t border-slate-300 pt-1 w-36">
              <p className="font-extrabold text-slate-900">{activeCompany?.companyName}</p>
              <p className="text-[9px] text-slate-400 mt-0.5">Authorized Signatory</p>
            </div>
          </div>
        </div>
      </>
    );
  };

  const renderAdvanceLedgerContent = () => {
    return (
      <>
        {/* PAGE 1: EXECUTIVE ANALYTICAL SUMMARY */}
        <div className="p-8 min-h-[295mm] flex flex-col justify-between relative overflow-hidden bg-white text-xs" style={{ pageBreakAfter: 'always' }}>
          {/* BACKGROUND WATERMARK */}
          {watermarkImage && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 overflow-hidden">
              <img
                src={watermarkImage}
                alt="Company Watermark"
                className="w-96 h-96 object-contain opacity-[0.08] grayscale contrast-200"
              />
            </div>
          )}
          <div className="space-y-6 relative z-10 text-left">
            
            {/* Bank Statement Style Header */}
            <div className="flex justify-between items-start border-b border-slate-200 pb-4">
              <div className="flex items-center gap-3">
                {activeCompany?.logo ? (
                  <img src={activeCompany.logo} alt="Logo" className="w-10 h-10 rounded-lg object-contain border p-1" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-base">
                    {activeCompany?.companyName ? activeCompany.companyName.charAt(0).toUpperCase() : 'C'}
                  </div>
                )}
                <div>
                  <h1 className="text-sm font-extrabold text-slate-900 uppercase tracking-tight">{activeCompany?.companyName || 'General Ledger'}</h1>
                  <p className="text-[9px] text-slate-500">{activeCompany?.address}</p>
                  <p className="text-[9px] text-slate-500">Phone: {activeCompany?.phone} | Email: {activeCompany?.email}</p>
                  {activeCompany?.gstNumber && <p className="text-[9px] text-slate-500 font-mono">GSTIN: {activeCompany.gstNumber}</p>}
                </div>
              </div>
              <div className="text-right">
                <h2 className="text-base font-black text-blue-600 uppercase tracking-wider">Statement of Account</h2>
                <p className="text-[9px] text-slate-500 font-bold mt-0.5">Report Type: Advanced Analytical Report</p>
                <p className="text-[9px] text-slate-500">Date Generated: {new Date().toLocaleDateString()}</p>
              </div>
            </div>

            {/* Account Details & Summary Table */}
            <div className="grid grid-cols-2 gap-4">
              <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/50 space-y-2">
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Account Information</h3>
                <div className="space-y-1 text-[9px] text-slate-600 font-medium">
                  <p><span className="text-slate-400">Statement For:</span> <span className="font-bold text-slate-800">{selectedParty === 'all' ? 'All Customers & Vendors' : selectedParty}</span></p>
                  <p><span className="text-slate-400">Statement Period:</span> <span className="font-bold text-slate-800">{formatDate(startDate)} to {formatDate(endDate)}</span></p>
                  <p><span className="text-slate-400">Currency:</span> <span className="font-bold text-slate-800">{activeCompany?.currency || 'INR (₹)'}</span></p>
                </div>
              </div>
              <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/50 space-y-2">
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Account Summary</h3>
                <div className="grid grid-cols-2 gap-2 text-[9px] font-semibold text-slate-600">
                  <div>
                    <p className="text-slate-400">Opening Balance</p>
                    <p className="text-slate-800 font-bold">{formatCurrency(0, currencySymbol)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Closing Balance</p>
                    <p className="text-slate-800 font-bold">{formatCurrency(ledgerData.finalBalance, currencySymbol)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Total Outflow (Debits)</p>
                    <p className="text-blue-600 font-bold">{formatCurrency(ledgerData.totalDebit, currencySymbol)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Total Inflow (Credits)</p>
                    <p className="text-emerald-600 font-bold">{formatCurrency(ledgerData.totalCredit, currencySymbol)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Analytical Charts Block */}
            <div className="grid grid-cols-2 gap-4">
              {/* Pie Chart (Share of Document Types) */}
              <div className="border border-slate-100 rounded-2xl p-4 bg-white space-y-3">
                <div>
                  <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-wider">Transaction Composition</h4>
                  <p className="text-[8px] text-slate-400">Relative share of total volumes by document category.</p>
                </div>
                
                <div className="flex items-center justify-around mt-1">
                  <svg width="120" height="120" viewBox="0 0 120 120" className="-rotate-90">
                    {advanceAnalytics.totalVolume > 0 ? (
                      <>
                        {/* Invoices */}
                        {advanceAnalytics.invoiceVolume > 0 && (
                          <circle 
                            cx="60" 
                            cy="60" 
                            r="40" 
                            fill="transparent" 
                            stroke="#2563eb" 
                            strokeWidth="12" 
                            strokeDasharray={`${((advanceAnalytics.invoiceVolume / advanceAnalytics.totalVolume) * 251.3).toFixed(1)} 251.3`} 
                          />
                        )}
                        {/* Vouchers */}
                        {advanceAnalytics.voucherVolume > 0 && (
                          <circle 
                            cx="60" 
                            cy="60" 
                            r="40" 
                            fill="transparent" 
                            stroke="#f59e0b" 
                            strokeWidth="12" 
                            strokeDasharray={`${((advanceAnalytics.voucherVolume / advanceAnalytics.totalVolume) * 251.3).toFixed(1)} 251.3`} 
                            strokeDashoffset={-((advanceAnalytics.invoiceVolume / advanceAnalytics.totalVolume) * 251.3)} 
                          />
                        )}
                        {/* Receipts */}
                        {advanceAnalytics.receiptVolume > 0 && (
                          <circle 
                            cx="60" 
                            cy="60" 
                            r="40" 
                            fill="transparent" 
                            stroke="#10b981" 
                            strokeWidth="12" 
                            strokeDasharray={`${((advanceAnalytics.receiptVolume / advanceAnalytics.totalVolume) * 251.3).toFixed(1)} 251.3`} 
                            strokeDashoffset={-(((advanceAnalytics.invoiceVolume + advanceAnalytics.voucherVolume) / advanceAnalytics.totalVolume) * 251.3)} 
                          />
                        )}
                        {/* Expenses */}
                        {advanceAnalytics.expenseVolume > 0 && (
                          <circle 
                            cx="60" 
                            cy="60" 
                            r="40" 
                            fill="transparent" 
                            stroke="#f43f5e" 
                            strokeWidth="12" 
                            strokeDasharray={`${((advanceAnalytics.expenseVolume / advanceAnalytics.totalVolume) * 251.3).toFixed(1)} 251.3`} 
                            strokeDashoffset={-(((advanceAnalytics.invoiceVolume + advanceAnalytics.voucherVolume + advanceAnalytics.receiptVolume) / advanceAnalytics.totalVolume) * 251.3)} 
                          />
                        )}
                      </>
                    ) : (
                      <circle cx="60" cy="60" r="40" fill="transparent" stroke="#cbd5e1" strokeWidth="12" />
                    )}
                    <g transform="translate(60,65)" textAnchor="middle">
                      <text fontSize="7" fontWeight="bold" fill="#94a3b8" y="-12">TOTAL VOL</text>
                      <text fontSize="8" fontWeight="black" fill="#1e293b" y="-2">
                        {advanceAnalytics.totalVolume > 100000 
                          ? `${currencySymbol}${(advanceAnalytics.totalVolume/100000).toFixed(1)}L` 
                          : `${currencySymbol}${(advanceAnalytics.totalVolume/1000).toFixed(0)}K`}
                      </text>
                    </g>
                  </svg>
                  
                  <div className="space-y-1 text-[8px] font-semibold text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded bg-blue-600 inline-block" />
                      <span>Invoices: {advanceAnalytics.invoiceCount} ({advanceAnalytics.totalVolume > 0 ? ((advanceAnalytics.invoiceVolume / advanceAnalytics.totalVolume) * 100).toFixed(0) : 0}%)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded bg-amber-500 inline-block" />
                      <span>Vouchers: {advanceAnalytics.voucherCount} ({advanceAnalytics.totalVolume > 0 ? ((advanceAnalytics.voucherVolume / advanceAnalytics.totalVolume) * 100).toFixed(0) : 0}%)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded bg-emerald-500 inline-block" />
                      <span>Receipts: {advanceAnalytics.receiptCount} ({advanceAnalytics.totalVolume > 0 ? ((advanceAnalytics.receiptVolume / advanceAnalytics.totalVolume) * 100).toFixed(0) : 0}%)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded bg-rose-500 inline-block" />
                      <span>Expenses: {advanceAnalytics.expenseCount} ({advanceAnalytics.totalVolume > 0 ? ((advanceAnalytics.expenseVolume / advanceAnalytics.totalVolume) * 100).toFixed(0) : 0}%)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bar Chart (Outflow vs Inflow) */}
              <div className="border border-slate-100 rounded-2xl p-4 bg-white space-y-3">
                <div>
                  <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-wider">Debit vs Credit Flow</h4>
                  <p className="text-[8px] text-slate-400">Periodic distribution of debits (blue) and credits (green).</p>
                </div>
                
                <div className="w-full flex justify-center mt-1">
                  <svg width="220" height="95" viewBox="0 0 240 120" className="overflow-visible">
                    <g stroke="#f1f5f9" strokeWidth="1" strokeDasharray="2 2">
                      <line x1="25" y1="20" x2="235" y2="20" />
                      <line x1="25" y1="60" x2="235" y2="60" />
                      <line x1="25" y1="100" x2="235" y2="100" />
                    </g>

                    <g fill="#94a3b8" fontSize="7" fontWeight="bold" textAnchor="end">
                      <text x="20" y="23">HIGH</text>
                      <text x="20" y="63">MID</text>
                      <text x="20" y="103">0</text>
                    </g>

                    <line x1="25" y1="100" x2="235" y2="100" stroke="#cbd5e1" strokeWidth="1" />

                    {advanceAnalytics.barData.map((d, idx) => {
                      const spacing = 200 / (advanceAnalytics.barData.length || 1);
                      const xCenter = 25 + idx * spacing + spacing / 2;
                      
                      const maxVal = Math.max(...advanceAnalytics.barData.map(item => Math.max(item.debit, item.credit)), 1000);
                      const hDebit = (d.debit / maxVal) * 75;
                      const hCredit = (d.credit / maxVal) * 75;

                      return (
                        <g key={idx}>
                          {hDebit > 0 && (
                            <rect x={xCenter - 7} y={100 - hDebit} width="6" height={hDebit} fill="#2563eb" rx="1.5" />
                          )}
                          {hCredit > 0 && (
                            <rect x={xCenter + 1} y={100 - hCredit} width="6" height={hCredit} fill="#10b981" rx="1.5" />
                          )}
                          <text x={xCenter} y="114" fill="#64748b" fontSize="7" fontWeight="bold" textAnchor="middle">
                            {d.label}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>
            </div>

            {/* Entry Analysis Report Details */}
            <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/30 space-y-3">
              <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">Entry Analysis & Metrics Report</h4>
              <div className="grid grid-cols-3 gap-4 text-[9px] font-medium text-slate-600 text-left">
                <div className="space-y-1 border-r border-slate-100 pr-2">
                  <p className="text-slate-400 font-bold uppercase text-[7px] tracking-wide">Average Ticket Size</p>
                  <p className="text-slate-800 font-black text-xs">{formatCurrency(advanceAnalytics.avgTransaction, currencySymbol)}</p>
                  <p className="text-[8px] text-slate-400">Mean value of all ledger posts combined.</p>
                </div>
                <div className="space-y-1 border-r border-slate-100 pr-2">
                  <p className="text-slate-400 font-bold uppercase text-[7px] tracking-wide">Max Outflow (Debit)</p>
                  <p className="text-blue-600 font-black text-xs">{formatCurrency(advanceAnalytics.maxDebit, currencySymbol)}</p>
                  <p className="text-[8px] text-slate-400">Highest individual debit entry recorded.</p>
                </div>
                <div className="space-y-1">
                  <p className="text-slate-400 font-bold uppercase text-[7px] tracking-wide">Max Inflow (Credit)</p>
                  <p className="text-emerald-600 font-black text-xs">{formatCurrency(advanceAnalytics.maxCredit, currencySymbol)}</p>
                  <p className="text-[8px] text-slate-400">Highest individual credit collection recorded.</p>
                </div>
              </div>
            </div>

            {/* Financial Health Assessment */}
            <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/30 space-y-1.5 text-[9px] text-slate-600 font-medium text-left">
              <h4 className="font-black text-slate-800 uppercase tracking-wider text-[10px]">Executive Auditor Summary</h4>
              <p>
                This general ledger statement reports a total of <span className="font-bold text-slate-800">{ledgerData.entries.length} transactions</span> for the selected period from <span className="font-bold text-slate-800">{formatDate(startDate)}</span> to <span className="font-bold text-slate-800">{formatDate(endDate)}</span>. 
                The account closed with a net balance of <span className="font-bold text-slate-800">{formatCurrency(ledgerData.finalBalance, currencySymbol)}</span>. 
                {ledgerData.finalBalance > 0 ? (
                  <span> Inward billing outperforms outward collections, suggesting positive receivables accumulation.</span>
                ) : ledgerData.finalBalance < 0 ? (
                  <span> Outflow collection beats inward billing, indicating collections exceeded billing entries during this period.</span>
                ) : (
                  <span> Balance is perfectly squared.</span>
                )}
              </p>
            </div>

          </div>

          {/* Signatures at bottom of page 1 */}
          <div className="flex justify-between items-end border-t border-slate-100 pt-6">
            <div>
              <p className="text-[8px] text-slate-400 uppercase tracking-wider">Report Authorization</p>
              <p className="text-[8px] text-slate-400 mt-1">Report Generated Automatically | Non-Repudiable</p>
            </div>
            <div className="text-right flex flex-col items-end">
              {activeCompany?.cfoSignature && (
                <img src={activeCompany.cfoSignature} alt="CFO Signature" className="h-8 w-auto mb-0.5 object-contain" />
              )}
              <div className="border-t border-slate-200 pt-0.5 min-w-[100px]">
                <p className="font-extrabold text-[10px] text-slate-900">{activeCompany?.companyName}</p>
                <p className="text-[8px] text-slate-400 mt-0.5">Authorised Signature</p>
              </div>
            </div>
          </div>
        </div>

        {/* PAGE 2: DETAILED TRANSACTION statement LOG */}
        <div className="p-8 min-h-[295mm] flex flex-col justify-between relative overflow-hidden bg-white text-xs">
          {/* BACKGROUND WATERMARK */}
          {watermarkImage && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 overflow-hidden">
              <img
                src={watermarkImage}
                alt="Company Watermark"
                className="w-96 h-96 object-contain opacity-[0.08] grayscale contrast-200"
              />
            </div>
          )}
          <div className="space-y-6 relative z-10 text-left">
            
            {/* Mini Header */}
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <div>
                <h2 className="text-[11px] font-black text-slate-800 uppercase tracking-wide">Statement Transaction Log (Cont.)</h2>
                <p className="text-[8px] text-slate-400">Statement period: {formatDate(startDate)} to {formatDate(endDate)} | Account: {selectedParty === 'all' ? 'All Parties' : selectedParty}</p>
              </div>
              <div className="text-right">
                <p className="text-[9px] text-slate-500 font-bold">Page 2 of 2</p>
              </div>
            </div>

            {/* Ledger entries table */}
            <table className="w-full text-left border-collapse text-[9px] font-sans">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase text-[7px]">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Transaction Particulars</th>
                  <th className="py-2.5 px-3">Doc Ref</th>
                  <th className="py-2.5 px-3 text-right">Debit (+)</th>
                  <th className="py-2.5 px-3 text-right">Credit (-)</th>
                  <th className="py-2.5 px-3 text-right">Balance</th>
                  <th className="py-2.5 px-3 text-center">Bill Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {ledgerData.entries.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-3 text-slate-500">{formatDate(row.date)}</td>
                    <td className="py-2.5 px-3 max-w-[180px]">
                      <div className="truncate text-slate-800" title={row.particulars}>{row.particulars}</div>
                      {(row as any).createdBy && (
                        <div className="text-[7px] text-slate-400 font-semibold mt-0.5">by {(row as any).createdBy}</div>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="font-mono text-slate-600 font-bold uppercase text-[8px]">{row.number}</span>
                      <span className="ml-1 text-[7px] text-slate-400 capitalize">({row.type})</span>
                    </td>
                    <td className={`py-2.5 px-3 text-right font-bold ${
                      row.type === 'invoice' ? 'text-rose-600' : 'text-blue-600'
                    }`}>
                      {row.debit > 0 ? formatCurrency(row.debit, currencySymbol) : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-right text-emerald-600 font-bold">
                      {row.credit > 0 ? formatCurrency(row.credit, currencySymbol) : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-900 font-black">
                      {formatCurrency(row.balance, currencySymbol)}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <a 
                        href={row.isExpense ? `${window.location.origin}/preview/${row.documentId || row.id}` : row.previewUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[8px] font-bold text-blue-600 underline"
                      >
                        Preview Bill
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

          </div>

          {/* Page 2 signatures */}
          <div className="flex justify-between items-end border-t border-slate-100 pt-6">
            <div>
              <p className="text-[8px] text-slate-400 uppercase tracking-wider">End of Statement of Account</p>
              <p className="text-[8px] text-slate-400 mt-1">Thank you for your business.</p>
            </div>
            <div className="text-right flex flex-col items-end">
              {activeCompany?.cfoSignature && (
                <img src={activeCompany.cfoSignature} alt="CFO Signature" className="h-8 w-auto mb-0.5 object-contain" />
              )}
              <div className="border-t border-slate-200 pt-0.5 min-w-[100px]">
                <p className="font-extrabold text-[10px] text-slate-900">{activeCompany?.companyName}</p>
                <p className="text-[8px] text-slate-400 mt-0.5">Authorised Signature</p>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  };

  return (
    <MainLayout title="General Ledger">
      <div className="space-y-6">
        
        {/* Page Header and Controls */}
        <div className={`sticky top-16 md:top-4 z-20 hidden md:flex flex-row md:items-center justify-between gap-4 bg-white/95 backdrop-blur-md p-5 rounded-3xl border border-[#f1f3f9] shadow-sm transition-all duration-300 ${
          scrollDirection === 'down' ? '-translate-y-40 opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'
        }`}>
          <div>
            <h1 className="font-extrabold text-slate-900 text-lg tracking-tight">General Ledger</h1>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">Track account statements, transaction flows, and running balances.</p>
          </div>

          <div className="flex flex-row items-center gap-2 self-start sm:self-auto">
            <Button variant="outline" icon={Download} onClick={() => {
              if (ledgerData.entries.length === 0) {
                showToast('No ledger data available to export.', 'warning');
                return;
              }
              setLedgerReportType('excel');
              setShowLedgerPreviewModal(true);
            }}>
              <span className="hidden sm:inline">Export </span>Excel
            </Button>
            <Button variant="outline" icon={Download} onClick={() => {
              if (ledgerData.entries.length === 0) {
                showToast('No ledger data available to export.', 'warning');
                return;
              }
              setLedgerReportType('pdf');
              setShowLedgerPreviewModal(true);
            }}>
              <span className="hidden sm:inline">Download </span>PDF
            </Button>
            <Button icon={BookOpen} onClick={() => {
              if (ledgerData.entries.length === 0) {
                showToast('No ledger data available to export.', 'warning');
                return;
              }
              setLedgerReportType('advance');
              setShowLedgerPreviewModal(true);
            }}>
              Advance<span className="hidden sm:inline"> Report</span>
            </Button>
          </div>
        </div>

        {/* Stats Grid (Bento Layout) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Card 1: Net Balance (Spans 2 columns on all screens) */}
          <div className="bg-white border border-slate-200/60 rounded-3xl p-5 shadow-xs relative overflow-hidden flex flex-col justify-between min-h-[120px] col-span-2">
            <div className="absolute -right-4 -top-4 w-36 h-36 bg-gradient-to-br from-indigo-500/10 to-purple-500/5 rounded-full filter blur-2xl pointer-events-none"></div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Net Balance</span>
              <div className="w-9 h-9 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100/30">
                <Scale className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4">
              <h3 className="text-2xl md:text-3xl font-black text-slate-900 leading-none">
                {formatCurrency(ledgerData.finalBalance, currencySymbol)}
              </h3>
              <p className="text-[10px] text-slate-400 font-semibold mt-1.5">Overall account standing</p>
            </div>
          </div>

          {/* Card 2: Total Debits (Spans 1 column) */}
          <div className="bg-white border border-slate-200/60 rounded-3xl p-5 shadow-xs relative overflow-hidden flex flex-col justify-between min-h-[120px] col-span-1">
            <div className="absolute -right-4 -top-4 w-28 h-28 bg-blue-500/10 rounded-full filter blur-xl pointer-events-none"></div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Debits</span>
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100/30">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-4">
              <h3 className="text-lg md:text-xl font-extrabold text-blue-650 leading-none">
                {formatCurrency(ledgerData.totalDebit, currencySymbol)}
              </h3>
              <p className="text-[9px] text-slate-400 font-semibold mt-1">Outflows recorded (+)</p>
            </div>
          </div>

          {/* Card 3: Total Credits (Spans 1 column) */}
          <div className="bg-white border border-slate-200/60 rounded-3xl p-5 shadow-xs relative overflow-hidden flex flex-col justify-between min-h-[120px] col-span-1">
            <div className="absolute -right-4 -top-4 w-28 h-28 bg-emerald-500/10 rounded-full filter blur-xl pointer-events-none"></div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Credits</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100/30">
                <TrendingDown className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-4">
              <h3 className="text-lg md:text-xl font-extrabold text-emerald-650 leading-none">
                {formatCurrency(ledgerData.totalCredit, currencySymbol)}
              </h3>
              <p className="text-[9px] text-slate-400 font-semibold mt-1">Inflows recorded (-)</p>
            </div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="bg-white p-5 rounded-3xl border border-[#f1f3f9] shadow-xs space-y-3">
          <div className="relative w-full filter-popover-container">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Filter by party..."
                value={selectedParty === 'all' ? '' : selectedParty}
                onChange={(e) => setSelectedParty(e.target.value || 'all')}
                className="w-full text-xs rounded-xl border border-slate-200/85 bg-slate-50 py-2.5 pl-9 pr-10 transition-all focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/10 focus:border-blue-600 text-slate-800 font-semibold"
              />
              <button
                type="button"
                onClick={() => setShowMobileFilters(!showMobileFilters)}
                className={`absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-all cursor-pointer ${
                  showMobileFilters 
                    ? 'bg-blue-50 text-blue-600 border border-blue-100' 
                    : 'text-slate-400 hover:text-slate-655 hover:bg-slate-100'
                }`}
                title="Toggle Filters"
              >
                <Filter className="w-4 h-4" />
              </button>
            </div>

            {/* Floating Popover for Filters - Speed Dial Inspired */}
            {showMobileFilters && (
              <div className="absolute top-full right-0 mt-2 z-30 bg-white border border-[#f1f3f9] rounded-3xl shadow-xl p-3 w-72 flex flex-col gap-2.5 animate-in slide-in-from-top-5 duration-200">
                {/* Party Selector Category */}
                <div className="w-full">
                  <button
                    type="button"
                    onClick={() => setActiveFilterCategory(activeFilterCategory === 'party' ? null : 'party')}
                    className={`flex items-center justify-between w-full px-4 py-2.5 bg-white border rounded-2xl shadow-sm text-xs font-bold transition-all cursor-pointer ${
                      activeFilterCategory === 'party' 
                        ? 'border-indigo-305 text-indigo-700 bg-indigo-50/10' 
                        : 'border-slate-200/85 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                      <span>Party / Customer</span>
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {activeFilterCategory === 'party' ? '▲' : '▼'}
                    </span>
                  </button>
                  {activeFilterCategory === 'party' && (
                    <div className="mt-2 pl-4 flex flex-col gap-1.5 animate-in slide-in-from-top-2 duration-150">
                      <Select
                        value={selectedParty}
                        onChange={(e) => setSelectedParty(e.target.value)}
                      >
                        <option value="all">All Parties & Customers</option>
                        {parties.map(p => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </Select>
                    </div>
                  )}
                </div>

                {/* Start Date Category */}
                <div className="w-full">
                  <button
                    type="button"
                    onClick={() => setActiveFilterCategory(activeFilterCategory === 'start' ? null : 'start')}
                    className={`flex items-center justify-between w-full px-4 py-2.5 bg-white border rounded-2xl shadow-sm text-xs font-bold transition-all cursor-pointer ${
                      activeFilterCategory === 'start' 
                        ? 'border-indigo-305 text-indigo-700 bg-indigo-50/10' 
                        : 'border-slate-200/85 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span>Start Date</span>
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {activeFilterCategory === 'start' ? '▲' : '▼'}
                    </span>
                  </button>
                  {activeFilterCategory === 'start' && (
                    <div className="mt-2 pl-4 flex flex-col gap-1.5 animate-in slide-in-from-top-2 duration-150">
                      <Input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                      />
                    </div>
                  )}
                </div>

                {/* End Date Category */}
                <div className="w-full">
                  <button
                    type="button"
                    onClick={() => setActiveFilterCategory(activeFilterCategory === 'end' ? null : 'end')}
                    className={`flex items-center justify-between w-full px-4 py-2.5 bg-white border rounded-2xl shadow-sm text-xs font-bold transition-all cursor-pointer ${
                      activeFilterCategory === 'end' 
                        ? 'border-indigo-305 text-indigo-700 bg-indigo-50/10' 
                        : 'border-slate-200/85 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                      <span>End Date</span>
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {activeFilterCategory === 'end' ? '▲' : '▼'}
                    </span>
                  </button>
                  {activeFilterCategory === 'end' && (
                    <div className="mt-2 pl-4 flex flex-col gap-1.5 animate-in slide-in-from-top-2 duration-150">
                      <Input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Ledger Grid View */}
        <div className="bg-white border border-[#f1f3f9] rounded-3xl shadow-xs overflow-hidden">
          {ledgerData.entries.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
                <BookOpen className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-slate-800 text-sm">No transaction entries found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">Try adjusting the filter date ranges or party name.</p>
            </div>
          ) : (
            <>
              {/* Desktop View (Table Layout) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Particulars</th>
                      <th className="py-3 px-4">Doc Type / No.</th>
                      <th className="py-3 px-4 text-right">Debit (+)</th>
                      <th className="py-3 px-4 text-right">Credit (-)</th>
                      <th className="py-3 px-4 text-right">Balance</th>
                      <th className="py-3 px-4 text-center">Bill Preview</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {ledgerData.entries.map((row: any, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-4 text-slate-500 whitespace-nowrap">{formatDate(row.date)}</td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="text-slate-800 font-semibold flex items-center gap-1.5">
                            <span className="truncate max-w-[250px]" title={row.particulars}>
                              {row.particulars}
                            </span>
                            {row.createdBy && (
                              <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">
                                (by {row.createdBy})
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            {row.isExpense ? (
                              <span className="font-mono font-semibold uppercase text-slate-600">{row.number}</span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  const doc = documents.find(d => d.id === row.id);
                                  if (doc) {
                                    setPreviewDoc(doc);
                                  }
                                }}
                                className="hover:text-blue-600 font-mono font-semibold transition-colors cursor-pointer text-left"
                                title="Preview Document"
                              >
                                <span className="uppercase">{row.number}</span>
                              </button>
                            )}
                            <Badge variant={row.type === 'invoice' ? 'invoice' : row.type === 'voucher' ? 'voucher' : row.type === 'receipt' ? 'receipt' : 'expense'} className="py-0 px-1 text-[8px]">
                              {row.type}
                            </Badge>
                          </div>
                        </td>
                        <td className={`py-3 px-4 text-right font-semibold whitespace-nowrap ${
                          row.type === 'invoice' ? 'text-rose-600' : 'text-blue-600'
                        }`}>
                          {row.debit > 0 ? formatCurrency(row.debit, currencySymbol) : '-'}
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-emerald-600 whitespace-nowrap">
                          {row.credit > 0 ? formatCurrency(row.credit, currencySymbol) : '-'}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-slate-900 whitespace-nowrap">
                          {formatCurrency(row.balance, currencySymbol)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              const targetId = row.isExpense ? row.documentId : row.id;
                              const doc = documents.find(d => d.id === targetId);
                              if (doc) {
                                setPreviewDoc(doc);
                              } else if (row.isExpense) {
                                // Fallback for expenses without documentId
                                const fallbackDoc = {
                                  id: row.id,
                                  documentNumber: row.number,
                                  documentType: 'voucher',
                                  voucherType: 'Expense Bill',
                                  documentDate: row.date,
                                  status: 'Paid',
                                  paidTo: row.partyOrProject || 'Office Expenses',
                                  paymentMethod: 'N/A',
                                  amount: row.debit || row.amount || 0,
                                  totals: { grandTotal: row.debit || row.amount || 0 },
                                  description: row.particulars,
                                  items: [
                                    {
                                      id: 'item_1',
                                      description: row.particulars,
                                      quantity: 1,
                                      rate: row.debit || row.amount || 0,
                                      amount: row.debit || row.amount || 0
                                    }
                                  ],
                                  template: activeCompany.selectedTemplate || 'UNAI Billing'
                                };
                                setPreviewDoc(fallbackDoc as any);
                              }
                            }}
                            className="inline-flex items-center text-[10px] font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                          >
                            View Bill
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile View (Recent Documents Card Inspo) */}
              <div className="md:hidden space-y-4 p-4.5 bg-slate-50/50">
                {ledgerData.entries.map((row: any, idx) => {
                  const hasDebit = row.debit > 0;
                  const flowText = hasDebit ? 'Debit (+)' : 'Credit (-)';
                  const flowColor = hasDebit ? 'text-rose-600' : 'text-emerald-600';
                  const amount = hasDebit ? row.debit : row.credit;

                  return (
                    <div
                      key={idx}
                      className="p-5 bg-white border border-[#f1f3f9] rounded-3xl flex flex-col gap-4 shadow-xs hover:shadow-md transition-all duration-300 group"
                    >
                      {/* Top Row: Ref & Type Badge + Date */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {row.isExpense ? (
                            <span className="font-mono font-extrabold text-[13px] text-slate-900 truncate">
                              {row.number}
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                const doc = documents.find(d => d.id === row.id);
                                if (doc) {
                                  setPreviewDoc(doc);
                                }
                              }}
                              className="hover:text-blue-600 font-mono font-extrabold text-[13px] text-slate-900 truncate text-left transition-colors cursor-pointer"
                              title="Preview Document"
                            >
                              <span className="uppercase">{row.number}</span>
                            </button>
                          )}
                          <Badge variant={row.type === 'invoice' ? 'invoice' : row.type === 'voucher' ? 'voucher' : row.type === 'receipt' ? 'receipt' : 'expense'} className="py-0 px-1 text-[8px]">
                            {row.type}
                          </Badge>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[10px] text-slate-400 font-semibold">
                            {formatDate(row.date)}
                          </p>
                        </div>
                      </div>

                      {/* Middle: Particulars */}
                      <div className="flex flex-col gap-1 min-w-0">
                        <div className="font-extrabold text-[13px] text-slate-800 break-words">
                          {row.particulars}
                        </div>
                        {row.createdBy && (
                          <div className="text-[10px] text-slate-400 font-semibold">
                            Created by: {row.createdBy}
                          </div>
                        )}
                      </div>

                      {/* Transaction Flow and Running Balance */}
                      <div className="grid grid-cols-2 gap-3 bg-slate-50/60 p-3 rounded-2xl border border-slate-100">
                        <div>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{flowText}</p>
                          <p className={`font-extrabold text-xs mt-0.5 ${flowColor}`}>
                            {formatCurrency(amount, currencySymbol)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Running Balance</p>
                          <p className="font-extrabold text-xs mt-0.5 text-slate-900">
                            {formatCurrency(row.balance, currencySymbol)}
                          </p>
                        </div>
                      </div>

                      {/* Bottom Row: View Bill Action */}
                      <div className="flex items-center justify-end pt-3 border-t border-slate-100/80">
                        <button
                          type="button"
                          onClick={() => {
                            const targetId = row.isExpense ? row.documentId : row.id;
                            const doc = documents.find(d => d.id === targetId);
                            if (doc) {
                              setPreviewDoc(doc);
                            } else if (row.isExpense) {
                              const fallbackDoc = {
                                id: row.id,
                                documentNumber: row.number,
                                documentType: 'voucher',
                                voucherType: 'Expense Bill',
                                documentDate: row.date,
                                status: 'Paid',
                                paidTo: row.partyOrProject || 'Office Expenses',
                                paymentMethod: 'N/A',
                                amount: row.debit || row.amount || 0,
                                totals: { grandTotal: row.debit || row.amount || 0 },
                                description: row.particulars,
                                items: [
                                  {
                                    id: 'item_1',
                                    description: row.particulars,
                                    quantity: 1,
                                    rate: row.debit || row.amount || 0,
                                    amount: row.debit || row.amount || 0
                                  }
                                ],
                                template: activeCompany.selectedTemplate || 'UNAI Billing'
                              };
                              setPreviewDoc(fallbackDoc as any);
                            }
                          }}
                          className="inline-flex items-center px-4.5 py-2 bg-indigo-50 border border-indigo-100/40 text-[11px] font-extrabold text-indigo-650 hover:bg-indigo-100/50 hover:text-indigo-700 active:scale-95 transition-all rounded-xl cursor-pointer"
                        >
                          <span>View Bill</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Dynamic Modal for Document Preview */}
        {previewDoc && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full h-[90vh] flex flex-col overflow-hidden">
              {/* Modal Header */}
              <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 bg-slate-50">
                <div className="flex items-center gap-2">
                  <Eye className="w-5 h-5 text-blue-600" />
                  <h3 className="font-bold text-slate-800 text-sm">
                    Document Preview - {previewDoc.documentNumber}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={() => setPreviewDoc(null)}>
                    Close Preview
                  </Button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="flex-1 bg-slate-200/80 p-6 overflow-auto flex justify-center items-start">
                <ResponsiveDocumentWrapper isInvoice={previewDoc.documentType === 'invoice' || !previewDoc.documentType}>
                  <TemplateWrapper
                    templateName={previewDoc.template || activeCompany?.selectedTemplate}
                    company={activeCompany}
                    customer={previewDoc.customer}
                    items={previewDoc.items || []}
                    totals={previewDoc.totals || calculateTotals(previewDoc.items || [], previewDoc.discount)}
                    document={previewDoc}
                  />
                </ResponsiveDocumentWrapper>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-3 bg-white border-t border-slate-200 flex justify-end gap-2">
                <Button variant="outline" icon={Printer} onClick={() => handleDownload(previewDoc)}>
                  Print
                </Button>
                <Button icon={Download} onClick={() => handleDownload(previewDoc)}>
                  Download PDF
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Hidden PDF Printable Wrapper */}
        <div style={{ position: 'fixed', left: 0, top: 0, width: '210mm', opacity: 1, visibility: 'visible', pointerEvents: 'none', zIndex: -99999, overflow: 'hidden' }}>
          <div ref={printRef} className="p-8 w-[210mm] min-h-[295mm] bg-white font-sans text-xs text-slate-800 space-y-6 relative overflow-hidden">
            {renderStandardLedgerContent()}
          </div>
        </div>

        {/* Hidden Advance PDF Printable Wrapper */}
        <div style={{ position: 'fixed', left: 0, top: 0, width: '210mm', opacity: 1, visibility: 'visible', pointerEvents: 'none', zIndex: -99999, overflow: 'hidden' }}>
          <div ref={advancePrintRef} id="printable-document" className="w-[210mm] bg-white font-sans text-slate-800">
            {renderAdvanceLedgerContent()}
          </div>
        </div>

        {/* Ledger Report Preview Modal */}
        {showLedgerPreviewModal && ledgerReportType && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200 text-left">
            <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full h-[90vh] flex flex-col overflow-hidden">
              {/* Modal Header */}
              <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 bg-slate-50">
                <div className="flex items-center gap-2">
                  <Eye className="w-5 h-5 text-blue-600" />
                  <h3 className="font-bold text-slate-800 text-sm">
                    {ledgerReportType === 'pdf' && 'Ledger Statement Preview'}
                    {ledgerReportType === 'advance' && 'Advance Analytical Report Preview'}
                    {ledgerReportType === 'excel' && 'Excel Report Preview'}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={() => {
                    setShowLedgerPreviewModal(false);
                    setLedgerReportType(null);
                  }}>
                    Close Preview
                  </Button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="flex-1 bg-slate-200/80 p-4 sm:p-6 overflow-auto flex justify-center items-start">
                {ledgerReportType === 'pdf' && (
                  <ResponsiveDocumentWrapper isInvoice={true}>
                    <div className="bg-white shadow-md rounded-xl p-8 w-[794px] min-h-[1123px] font-sans text-xs text-slate-800 space-y-6 relative overflow-hidden text-left">
                      {renderStandardLedgerContent()}
                    </div>
                  </ResponsiveDocumentWrapper>
                )}
                {ledgerReportType === 'advance' && (
                  <ResponsiveDocumentWrapper isInvoice={true}>
                    <div className="bg-white shadow-md rounded-xl w-[794px] font-sans text-slate-800 text-left">
                      {renderAdvanceLedgerContent()}
                    </div>
                  </ResponsiveDocumentWrapper>
                )}
                {ledgerReportType === 'excel' && (
                  <div className="bg-white shadow-md rounded-xl p-6 w-full max-w-4xl overflow-x-auto">
                    <h4 className="font-bold text-slate-800 text-sm mb-4">Export Preview (CSV Data Rows)</h4>
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px] tracking-wider">
                          <th className="py-2 px-3">Date</th>
                          <th className="py-2 px-3">Type</th>
                          <th className="py-2 px-3">Doc Number</th>
                          <th className="py-2 px-3">Particulars</th>
                          <th className="py-2 px-3 text-right">Debit ({currencySymbol})</th>
                          <th className="py-2 px-3 text-right">Credit ({currencySymbol})</th>
                          <th className="py-2 px-3 text-right">Balance ({currencySymbol})</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {ledgerData.entries.map((e, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="py-2 px-3 text-slate-500">{formatDate(e.date)}</td>
                            <td className="py-2 px-3 text-slate-600 uppercase">{e.type}</td>
                            <td className="py-2 px-3 font-mono font-semibold text-slate-800 uppercase">{e.number}</td>
                            <td className="py-2 px-3">
                              <span className="text-slate-700">{e.particulars}</span>
                              {(e as any).createdBy && (
                                <span className="text-[10px] text-slate-400 ml-1 font-semibold">by {(e as any).createdBy}</span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-right text-blue-600">{e.debit > 0 ? formatCurrency(e.debit, currencySymbol) : '-'}</td>
                            <td className="py-2 px-3 text-right text-emerald-600">{e.credit > 0 ? formatCurrency(e.credit, currencySymbol) : '-'}</td>
                            <td className="py-2 px-3 text-right text-slate-900 font-black">{formatCurrency(e.balance, currencySymbol)}</td>
                          </tr>
                        ))}
                        <tr className="bg-slate-50/80 font-bold border-t border-slate-200 text-slate-900">
                          <td className="py-3 px-3 uppercase" colSpan={4}>TOTALS</td>
                          <td className="py-3 px-3 text-right text-blue-600">{formatCurrency(ledgerData.totalDebit, currencySymbol)}</td>
                          <td className="py-3 px-3 text-right text-emerald-600">{formatCurrency(ledgerData.totalCredit, currencySymbol)}</td>
                          <td className="py-3 px-3 text-right font-black">{formatCurrency(ledgerData.finalBalance, currencySymbol)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-3 bg-white border-t border-slate-200 flex justify-end gap-2">
                {ledgerReportType !== 'excel' && (
                  <Button variant="outline" icon={Printer} onClick={() => {
                    if (ledgerReportType === 'pdf') handleExportPDF();
                    else if (ledgerReportType === 'advance') handleExportAdvancePDF();
                  }}>
                    Print
                  </Button>
                )}
                <Button icon={Download} onClick={() => {
                  if (ledgerReportType === 'pdf') handleExportPDF();
                  else if (ledgerReportType === 'advance') handleExportAdvancePDF();
                  else if (ledgerReportType === 'excel') handleExportCSV();
                }}>
                  {ledgerReportType === 'excel' ? 'Download Excel (CSV)' : 'Download PDF'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Hidden Render Container for PDF Download */}
        {pdfRenderDoc && (
          <div style={{
            position: 'fixed',
            left: 0,
            top: 0,
            width: (pdfRenderDoc.documentType && pdfRenderDoc.documentType !== 'invoice') ? '297mm' : '210mm',
            opacity: 1,
            visibility: 'visible',
            pointerEvents: 'none',
            zIndex: -99999,
            overflow: 'hidden'
          }}>
            <div ref={pdfRef}>
              <TemplateWrapper
                templateName={pdfRenderDoc.template || activeCompany?.selectedTemplate}
                company={activeCompany}
                customer={pdfRenderDoc.customer}
                items={pdfRenderDoc.items || []}
                totals={pdfRenderDoc.totals || calculateTotals(pdfRenderDoc.items || [], pdfRenderDoc.discount)}
                document={pdfRenderDoc}
              />
            </div>
          </div>
        )}

      </div>

      {/* Mobile Floating Action Button (FAB) with Speed Dial for Export Excel, Download PDF, and Advance Report */}
      <div className="md:hidden fixed bottom-20 right-6 z-40 flex flex-col items-end gap-3 no-print">
        {/* Expanded Speed Dial Options */}
        {showMobileControls && (
          <div className="flex flex-col gap-2.5 items-end animate-in slide-in-from-bottom-5 duration-200">
            
            {/* Export Excel Option */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (ledgerData.entries.length === 0) {
                  showToast('No ledger data available to export.', 'warning');
                  return;
                }
                setLedgerReportType('excel');
                setShowLedgerPreviewModal(true);
                setShowMobileControls(false);
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-2xl shadow-md hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all hover:scale-105 active:scale-95 cursor-pointer pr-5 shrink-0"
            >
              <Download className="w-4 h-4 text-slate-500" />
              <span>Export Excel</span>
            </button>

            {/* Download PDF Option */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (ledgerData.entries.length === 0) {
                  showToast('No ledger data available to export.', 'warning');
                  return;
                }
                setLedgerReportType('pdf');
                setShowLedgerPreviewModal(true);
                setShowMobileControls(false);
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-2xl shadow-md hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all hover:scale-105 active:scale-95 cursor-pointer pr-5 shrink-0"
            >
              <Download className="w-4 h-4 text-slate-500" />
              <span>Download PDF</span>
            </button>

            {/* Advance Report Option */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (ledgerData.entries.length === 0) {
                  showToast('No ledger data available to export.', 'warning');
                  return;
                }
                setLedgerReportType('advance');
                setShowLedgerPreviewModal(true);
                setShowMobileControls(false);
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-2xl shadow-md hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all hover:scale-105 active:scale-95 cursor-pointer pr-5 shrink-0"
            >
              <BookOpen className="w-4 h-4 text-slate-500" />
              <span>Advance Report</span>
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
