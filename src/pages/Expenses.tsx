import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { MainLayout } from '../components/layout/MainLayout';
import { useCompany } from '../contexts/CompanyContext';
import { useToast } from '../components/ui/Toast';
import { useDocument } from '../contexts/DocumentContext';
import { downloadDocumentPDF } from '../services/pdfGenerator';
import { 
  getAllExpenses, 
  saveExpense, 
  deleteExpense,
  rowToExpense
} from '../services/db';
import { 
  Plus, 
  Search, 
  Trash2, 
  FolderKanban, 
  Calendar, 
  Tag, 
  X, 
  Briefcase, 
  Home, 
  Zap, 
  Users, 
  Megaphone, 
  Plane, 
  Coffee, 
  Coins, 
  Filter,
  Download,
  FileText,
  ChevronDown,
  TrendingUp,
  Settings,
  Eye,
  Printer,
  CheckSquare
} from 'lucide-react';
import { formatCurrency, formatDate } from '../utils/formatting';
import { ConfirmModal } from '../components/ui/ConfirmModal';

const CATEGORIES = [
  { value: 'Office Supplies', label: 'Office Supplies', color: 'blue', icon: Briefcase },
  { value: 'Rent', label: 'Rent', color: 'purple', icon: Home },
  { value: 'Utilities', label: 'Utilities & Power', color: 'amber', icon: Zap },
  { value: 'Salaries', label: 'Salaries & Wages', color: 'emerald', icon: Users },
  { value: 'Marketing', label: 'Marketing & Ads', color: 'rose', icon: Megaphone },
  { value: 'Travel', label: 'Travel & Commute', color: 'indigo', icon: Plane },
  { value: 'Food & Refreshment', label: 'Food & Pantry', color: 'orange', icon: Coffee },
  { value: 'Others', label: 'Other Expenses', color: 'slate', icon: Coins }
];

const PAYMENT_METHODS = ['Cash', 'Bank Transfer', 'Card', 'UPI'];

export const Expenses = () => {
  const { activeCompany, updateActiveCompany } = useCompany();
  const { showToast } = useToast();
  const { saveDoc, removeDoc } = useDocument();

  const employeeJson = localStorage.getItem('activeEmployee');
  const activeEmployee = employeeJson ? JSON.parse(employeeJson) : null;
  const canAddExpense = !activeEmployee || activeEmployee.isAdmin || activeEmployee.permissions.addExpense;

  const printRef = useRef(null);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteExpenseId, setDeleteExpenseId] = useState<string | null>(null);
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<string[]>([]);
  const [showDeleteMultipleModal, setShowDeleteMultipleModal] = useState(false);
  const [isDeletingMultiple, setIsDeletingMultiple] = useState(false);
  const [showExpensePreviewModal, setShowExpensePreviewModal] = useState(false);
  const [expenseReportType, setExpenseReportType] = useState<'pdf' | 'excel' | null>(null);
  const [showMobileControls, setShowMobileControls] = useState(false);

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedProject, setSelectedProject] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [activeFilterCategory, setActiveFilterCategory] = useState<'category' | 'project' | 'month' | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastUsedProject, setLastUsedProject] = useState('');
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const projectDropdownRef = useRef<HTMLDivElement>(null);
  const [customCategory, setCustomCategory] = useState('');
  const [newExpense, setNewExpense] = useState({
    particulars: '',
    amount: '',
    category: 'Office Supplies',
    date: new Date().toISOString().split('T')[0],
    projectEvent: '',
    paidVia: 'Cash'
  });

  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [configMonth, setConfigMonth] = useState('');
  const [budgetMonthly, setBudgetMonthly] = useState('');
  const [budgetYearly, setBudgetYearly] = useState('');
  const [isSavingBudget, setIsSavingBudget] = useState(false);

  const monthOptions = useMemo(() => {
    const options = [];
    const now = new Date();
    // Past 12 months, current month, next 6 months
    for (let i = -12; i <= 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      options.push({ val, label });
    }
    return options;
  }, []);

  const currencySymbol = activeCompany?.currency ? activeCompany.currency.split(' ')[1] || '₹' : '₹';

  // Load expenses
  const loadExpenses = useCallback(async () => {
    if (!activeCompany) return;
    setLoading(true);
    try {
      let data = await getAllExpenses(activeCompany.id);
      if (activeEmployee && !activeEmployee.isAdmin) {
        data = data.filter(e => e.createdBy === activeEmployee.name);
      }
      setExpenses(data);
    } catch (err) {
      console.error(err);
      showToast('Failed to load expenses', 'error');
    } finally {
      setLoading(false);
    }
  }, [activeCompany, showToast, activeEmployee]);

  useEffect(() => {
    loadExpenses();
  }, [activeCompany?.id, loadExpenses]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (projectDropdownRef.current && !projectDropdownRef.current.contains(event.target as Node)) {
        setShowProjectDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

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

  // List of unique projects for filter panel
  const uniqueProjects = useMemo(() => {
    const projects = expenses
      .map(e => e.projectEvent?.trim())
      .filter(p => !!p);
    return Array.from(new Set(projects));
  }, [expenses]);

  // List of unique categories for filter panel
  const uniqueCategories = useMemo(() => {
    const cats = expenses
      .map(e => e.category?.trim())
      .filter(c => !!c);
    const knownCats = CATEGORIES.map(c => c.value);
    const customCats = cats.filter(c => !knownCats.includes(c));
    return Array.from(new Set(customCats));
  }, [expenses]);

  // Filtered suggestions for Project/Event dropdown
  const filteredProjectSuggestions = useMemo(() => {
    const query = (newExpense.projectEvent || '').toLowerCase().trim();
    if (!query) return uniqueProjects;
    return uniqueProjects.filter(proj => proj.toLowerCase().includes(query));
  }, [uniqueProjects, newExpense.projectEvent]);

  // Handle open modal
  const handleOpenModal = () => {
    const initialProject = (selectedProject !== 'all' && selectedProject !== 'none') ? selectedProject : lastUsedProject;
    setNewExpense({
      particulars: '',
      amount: '',
      category: 'Office Supplies',
      date: new Date().toISOString().split('T')[0],
      projectEvent: initialProject,
      paidVia: 'Cash'
    });
    
    setCustomCategory('');
    setShowProjectDropdown(false);
    setIsModalOpen(true);
  };

  // Computed Stats
  const stats = useMemo(() => {
    let total = 0;
    let thisMonth = 0;
    let thisYear = 0;
    
    const now = new Date();
    const activeMonthKey = selectedMonth === 'all'
      ? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      : selectedMonth;
      
    const [targetYear, targetMonth] = activeMonthKey.split('-').map(Number);
    const currentYear = now.getFullYear();

    expenses.forEach(e => {
      total += e.amount;
      const d = new Date(e.date);
      if (d.getFullYear() === currentYear) {
        thisYear += e.amount;
      }
      if (d.getFullYear() === targetYear && (d.getMonth() + 1) === targetMonth) {
        thisMonth += e.amount;
      }
    });

    const budgetsMap = (activeCompany as any)?.monthlyBudgets || {};
    const monthlyLimit = parseFloat(String(budgetsMap[activeMonthKey] !== undefined ? budgetsMap[activeMonthKey] : ((activeCompany as any)?.monthlyBudget || 50000))) || 50000;
    const yearlyLimit = parseFloat(String(activeCompany?.yearlyBudget || '')) || 600000;
    const monthlyPercent = monthlyLimit > 0 ? (thisMonth / monthlyLimit) * 100 : 0;
    const yearlyPercent = yearlyLimit > 0 ? (thisYear / yearlyLimit) * 100 : 0;

    const activeMonthLabel = new Date(targetYear, targetMonth - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    return {
      total,
      thisMonth,
      thisYear,
      monthlyLimit,
      yearlyLimit,
      monthlyPercent,
      yearlyPercent,
      projectCount: uniqueProjects.length,
      activeMonthLabel
    };
  }, [expenses, uniqueProjects, activeCompany?.monthlyBudget, activeCompany?.yearlyBudget, (activeCompany as any)?.monthlyBudgets, selectedMonth]);

  const handleOpenBudgetModal = () => {
    const now = new Date();
    const activeMonthKey = selectedMonth === 'all'
      ? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      : selectedMonth;

    setConfigMonth(activeMonthKey);
    const budgetsMap = (activeCompany as any)?.monthlyBudgets || {};
    const limit = budgetsMap[activeMonthKey] !== undefined ? budgetsMap[activeMonthKey] : ((activeCompany as any)?.monthlyBudget || 50000);
    
    setBudgetMonthly(limit.toString());
    setBudgetYearly((activeCompany?.yearlyBudget || 600000).toString());
    setIsBudgetModalOpen(true);
  };

  const handleConfigMonthChange = (newMonth) => {
    setConfigMonth(newMonth);
    const budgetsMap = (activeCompany as any)?.monthlyBudgets || {};
    const limit = budgetsMap[newMonth] !== undefined ? budgetsMap[newMonth] : ((activeCompany as any)?.monthlyBudget || 50000);
    setBudgetMonthly(limit.toString());
  };

  const handleSaveBudget = async (e) => {
    e.preventDefault();
    if (!activeCompany) return;
    setIsSavingBudget(true);
    try {
      const currentBudgets = (activeCompany as any).monthlyBudgets || {};
      const updatedBudgets = {
        ...currentBudgets,
        [configMonth]: parseFloat(budgetMonthly) || 0
      };
      await updateActiveCompany({
        monthlyBudgets: updatedBudgets,
        yearlyBudget: parseFloat(budgetYearly) || 0
      });
      showToast('Budget limits updated successfully!', 'success');
      setIsBudgetModalOpen(false);
    } catch (err) {
      console.error(err);
      showToast('Failed to update budget limits.', 'error');
    } finally {
      setIsSavingBudget(false);
    }
  };

  // Filtered Expenses
  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      const matchesSearch = e.particulars.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (e.projectEvent && e.projectEvent.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesCategory = selectedCategory === 'all' || e.category === selectedCategory;
      const matchesProject = 
        selectedProject === 'all' 
          ? true 
          : selectedProject === 'none' 
            ? !e.projectEvent 
            : e.projectEvent === selectedProject;
            
      let matchesMonth = true;
      if (selectedMonth !== 'all') {
        const d = new Date(e.date);
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        matchesMonth = monthKey === selectedMonth;
      }
      
      return matchesSearch && matchesCategory && matchesProject && matchesMonth;
    });
  }, [expenses, searchTerm, selectedCategory, selectedProject, selectedMonth]);

  // Add Expense
  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (isSaving) return;
    if (!newExpense.particulars.trim() || !newExpense.amount) {
      showToast('Please fill in particulars and amount', 'warning');
      return;
    }

    // Close the modal immediately so it disappears from the UI
    setIsModalOpen(false);
    setIsSaving(true);

    try {
      const expId = `exp_${Date.now()}`;
      const amountVal = parseFloat(newExpense.amount);

      const employeeJson = localStorage.getItem('activeEmployee');
      const activeEmployee = employeeJson ? JSON.parse(employeeJson) : null;
      const creator = activeEmployee ? activeEmployee.name : 'Admin';

      // Save as document representation first (without pre-set ID, letting saveDoc assign a new one + number + counter update)
      const docPayload = {
        companyId: activeCompany.id,
        documentType: 'voucher',
        voucherType: 'Expense Bill',
        documentDate: newExpense.date,
        status: 'Paid',
        paidTo: newExpense.projectEvent || newExpense.category || 'Office Expenses',
        paymentMethod: newExpense.paidVia || 'Cash',
        amount: amountVal,
        totals: { grandTotal: amountVal },
        description: `${newExpense.particulars} (Category: ${newExpense.category})`,
        template: activeCompany.selectedTemplate || 'UNAI Billing',
        createdBy: creator
      };
      
      const savedDoc = await saveDoc(docPayload);

      // Now save the expense payload, referencing the document's id!
      const payload = {
        ...newExpense,
        id: expId,
        companyId: activeCompany.id,
        amount: amountVal,
        documentId: savedDoc.id,
        createdBy: creator
      };

      await saveExpense(payload);
      showToast('Expense created and saved as document successfully!', 'success');
      
      // Store as last used project
      setLastUsedProject(newExpense.projectEvent);
      
      // Reset form (keeping project values ready for next time handleOpenModal is called)
      setNewExpense({
        particulars: '',
        amount: '',
        category: 'Office Supplies',
        date: new Date().toISOString().split('T')[0],
        projectEvent: newExpense.projectEvent,
        paidVia: 'Cash'
      });
      setCustomCategory('');
      loadExpenses();
    } catch (err) {
      console.error(err);
      showToast('Failed to save expense', 'error');
      // Re-open modal so user doesn't lose their data
      setIsModalOpen(true);
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Expense
  const handleDeleteExpense = (id) => {
    setDeleteExpenseId(id);
  };

  const handleConfirmDeleteExpense = async () => {
    if (!deleteExpenseId) return;
    try {
      const expenseToDelete = expenses.find(e => e.id === deleteExpenseId);
      await deleteExpense(deleteExpenseId);

      // Attempt to delete corresponding document representation if it exists
      if (expenseToDelete && expenseToDelete.documentId) {
        try {
          await removeDoc(expenseToDelete.documentId);
        } catch (err) {
          console.warn('Corresponding document could not be deleted:', err);
        }
      } else {
        // Fallback to check if a legacy doc exists with id `doc_${deleteExpenseId}`
        try {
          await removeDoc(`doc_${deleteExpenseId}`);
        } catch (e) {}
      }

      showToast('Expense deleted successfully', 'success');
      setSelectedExpenseIds(prev => prev.filter(item => item !== deleteExpenseId));
      loadExpenses();
    } catch (err) {
      console.error(err);
      showToast('Failed to delete expense', 'error');
    } finally {
      setDeleteExpenseId(null);
    }
  };

  // Multiple Selection & Bulk Delete Handlers
  const handleToggleSelect = (id: string) => {
    setSelectedExpenseIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedExpenseIds.length === filteredExpenses.length && filteredExpenses.length > 0) {
      setSelectedExpenseIds([]);
    } else {
      setSelectedExpenseIds(filteredExpenses.map(e => e.id));
    }
  };

  const handleConfirmDeleteMultiple = async () => {
    if (selectedExpenseIds.length === 0) return;
    setIsDeletingMultiple(true);
    try {
      const count = selectedExpenseIds.length;
      for (const id of selectedExpenseIds) {
        const expenseToDelete = expenses.find(e => e.id === id);
        await deleteExpense(id);
        if (expenseToDelete && expenseToDelete.documentId) {
          try {
            await removeDoc(expenseToDelete.documentId);
          } catch (err) {
            console.warn('Corresponding document could not be deleted:', err);
          }
        } else {
          try {
            await removeDoc(`doc_${id}`);
          } catch (e) {}
        }
      }
      showToast(`${count} expense${count > 1 ? 's' : ''} deleted successfully`, 'success');
      setSelectedExpenseIds([]);
      loadExpenses();
    } catch (err) {
      console.error(err);
      showToast('Failed to delete selected expenses', 'error');
    } finally {
      setIsDeletingMultiple(false);
      setShowDeleteMultipleModal(false);
    }
  };

  const handleExportCSV = () => {
    if (filteredExpenses.length === 0) {
      showToast('No expenses found for the current filters to export.', 'warning');
      return;
    }

    try {
      const headers = ['Date', 'Category', 'Particulars/Description', 'Project/Event', 'Payment Method', `Amount (${currencySymbol})`];
      const csvRows = [headers.join(',')];

      filteredExpenses.forEach(e => {
        const row = [
          e.date,
          `"${(e.category || '').replace(/"/g, '""')}"`,
          `"${e.particulars.replace(/"/g, '""')}"`,
          `"${(e.projectEvent || 'General Office').replace(/"/g, '""')}"`,
          e.paidVia || 'Cash',
          e.amount.toFixed(2)
        ];
        csvRows.push(row.join(','));
      });

      // Add total row
      const totalAmount = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
      const summaryRow = ['TOTAL', '', '', '', '', totalAmount.toFixed(2)];
      csvRows.push(summaryRow.join(','));

      const csvContent = csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      const projStr = selectedProject === 'all' ? 'All_Projects' : selectedProject.replace(/\s+/g, '_');
      link.setAttribute('download', `Expenses_${projStr}_Report.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('Expenses Excel CSV exported successfully!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to export Excel CSV.', 'error');
    }
  };

  const handleExportPDF = async () => {
    if (filteredExpenses.length === 0) {
      showToast('No expenses found for the current filters to export.', 'warning');
      return;
    }

    showToast('Generating Expense PDF Report...', 'info');
    setTimeout(async () => {
      try {
        if (printRef.current) {
          const projStr = selectedProject === 'all' ? 'All_Projects' : selectedProject.replace(/\s+/g, '_');
          await downloadDocumentPDF(printRef.current, `Expenses_${projStr}_Report`, 'portrait');
          showToast('Expense PDF downloaded successfully!', 'success');
        }
      } catch (err) {
        console.error(err);
        showToast('Failed to export PDF.', 'error');
      }
    }, 300);
  };

  const getCategoryColorClasses = (catName) => {
    const cat = CATEGORIES.find(c => c.value === catName);
    if (!cat) return { bg: 'bg-slate-50', text: 'text-slate-700', iconBg: 'bg-slate-100 text-slate-500' };
    switch (cat.color) {
      case 'blue': return { bg: 'bg-blue-50/70', text: 'text-blue-700', iconBg: 'bg-blue-50 text-blue-600' };
      case 'purple': return { bg: 'bg-purple-50/70', text: 'text-purple-700', iconBg: 'bg-purple-50 text-purple-600' };
      case 'amber': return { bg: 'bg-amber-50/70', text: 'text-amber-700', iconBg: 'bg-amber-50 text-amber-600' };
      case 'emerald': return { bg: 'bg-emerald-50/70', text: 'text-emerald-700', iconBg: 'bg-emerald-50 text-emerald-600' };
      case 'rose': return { bg: 'bg-rose-50/70', text: 'text-rose-700', iconBg: 'bg-rose-50 text-rose-600' };
      case 'indigo': return { bg: 'bg-indigo-50/70', text: 'text-indigo-700', iconBg: 'bg-indigo-50 text-indigo-600' };
      case 'orange': return { bg: 'bg-orange-50/70', text: 'text-orange-700', iconBg: 'bg-orange-50 text-orange-600' };
      default: return { bg: 'bg-slate-50/70', text: 'text-slate-700', iconBg: 'bg-slate-50 text-slate-500' };
    }
  };

  const getCategoryIcon = (catName) => {
    const cat = CATEGORIES.find(c => c.value === catName);
    return cat ? cat.icon : Coins;
  };

  const renderExpenseReportContent = () => {
    return (
      <div className="space-y-6 text-left relative z-10">
        {/* Watermark logo */}
        {activeCompany?.watermarkLogo && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 overflow-hidden">
            <img
              src={activeCompany.watermarkLogo}
              alt="Watermark"
              className="w-96 h-96 object-contain opacity-[0.08] grayscale contrast-200"
            />
          </div>
        )}

        {/* Report Header */}
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
              <h1 className="text-sm font-extrabold text-slate-900 uppercase tracking-tight">{activeCompany?.companyName || 'Expenses Report'}</h1>
              <p className="text-[9px] text-slate-500">{activeCompany?.address}</p>
              <p className="text-[9px] text-slate-500">Phone: {activeCompany?.phone} | Email: {activeCompany?.email}</p>
              {activeCompany?.gstNumber && <p className="text-[9px] text-slate-500 font-mono">GSTIN: {activeCompany.gstNumber}</p>}
            </div>
          </div>
          <div className="text-right">
            <h2 className="text-base font-black text-rose-600 uppercase tracking-wider">Expense Report</h2>
            <p className="text-[9px] text-slate-500 font-bold mt-0.5">Project/Event: {selectedProject === 'all' ? 'All Projects & Events' : selectedProject}</p>
            <p className="text-[9px] text-slate-500 font-bold">Category: {selectedCategory === 'all' ? 'All Categories' : selectedCategory}</p>
            <p className="text-[8px] text-slate-400">Generated: {new Date().toLocaleDateString()}</p>
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
          <div>
            <p className="text-[9px] font-bold text-slate-400 uppercase font-mono">Total Expenses Amount</p>
            <p className="text-xs font-black text-rose-600 mt-0.5">
              {formatCurrency(filteredExpenses.reduce((sum, e) => sum + e.amount, 0), currencySymbol)}
            </p>
          </div>
          <div>
            <p className="text-[9px] font-bold text-slate-400 uppercase font-mono">Total Item Count</p>
            <p className="text-xs font-black text-slate-900 mt-0.5">{filteredExpenses.length} transactions</p>
          </div>
          <div>
            <p className="text-[9px] font-bold text-slate-400 uppercase font-mono">Average Transaction Size</p>
            <p className="text-xs font-black text-blue-600 mt-0.5">
              {formatCurrency(
                filteredExpenses.length > 0 
                  ? filteredExpenses.reduce((sum, e) => sum + e.amount, 0) / filteredExpenses.length 
                  : 0,
                currencySymbol
              )}
            </p>
          </div>
        </div>

        {/* Table */}
        <table className="w-full text-left border-collapse text-[10px]">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 font-bold uppercase text-[8px]">
              <th className="py-2 px-3">Date</th>
              <th className="py-2 px-3">Category</th>
              <th className="py-2 px-3">Particulars / Description</th>
              <th className="py-2 px-3">Project / Event</th>
              <th className="py-2 px-3">Method</th>
              <th className="py-2 px-3 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 font-medium">
            {filteredExpenses.map((row, idx) => (
              <tr key={idx}>
                <td className="py-2 px-3 text-slate-500">{formatDate(row.date)}</td>
                <td className="py-2 px-3 text-slate-700 font-semibold">{row.category}</td>
                <td className="py-2 px-3 text-slate-800">{row.particulars}</td>
                <td className="py-2 px-3 text-slate-600 font-mono text-[9px]">{row.projectEvent || 'General Office'}</td>
                <td className="py-2 px-3 text-slate-500 uppercase text-[9px]">{row.paidVia || 'Cash'}</td>
                <td className="py-2 px-3 text-right text-rose-600 font-extrabold">{formatCurrency(row.amount, currencySymbol)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Signatures */}
        <div className="pt-12 flex justify-between">
          <div>
            <p className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">Report Authorization</p>
            <p className="text-[8px] text-slate-400 mt-1">Generated automatically | Verified ledger representation</p>
          </div>
          <div className="text-right pr-6 flex flex-col items-end">
            {activeCompany?.cfoSignature ? (
              <img src={activeCompany.cfoSignature} alt="CFO Signature" className="h-10 w-auto mb-1 object-contain" />
            ) : (
              <div className="h-10"></div>
            )}
            <div className="border-t border-slate-300 pt-1 w-36">
              <p className="font-extrabold text-slate-900">{activeCompany?.companyName}</p>
              <p className="text-[9px] text-slate-400 mt-0.5">Authorised Signatory</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <MainLayout title="Expenses">
      <div className="space-y-6">
        
        {/* Page Header and Controls */}
        <div className="hidden md:flex flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-[#f1f3f9] shadow-xs">
          <div>
            <h1 className="font-extrabold text-slate-900 text-lg tracking-tight">Company Expenses</h1>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">Track, categorize, and assign expenses to projects or events.</p>
          </div>
          <div className="flex flex-row items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => {
                if (filteredExpenses.length === 0) {
                  showToast('No expenses found for the current filters to export.', 'warning');
                  return;
                }
                setExpenseReportType('excel');
                setShowExpensePreviewModal(true);
              }}
              className="flex items-center justify-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-extrabold text-xs px-3.5 py-2.5 rounded-2xl shadow-xs transition-all cursor-pointer"
              title="Export Current Expenses to Excel CSV"
            >
              <Download className="w-4 h-4 text-slate-500" />
              <span>Export Excel</span>
            </button>
            <button
              onClick={() => {
                if (filteredExpenses.length === 0) {
                  showToast('No expenses found for the current filters to export.', 'warning');
                  return;
                }
                setExpenseReportType('pdf');
                setShowExpensePreviewModal(true);
              }}
              className="flex items-center justify-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-extrabold text-xs px-3.5 py-2.5 rounded-2xl shadow-xs transition-all cursor-pointer"
              title="Download Current Expenses PDF Statement"
            >
              <FileText className="w-4 h-4 text-slate-500" />
              <span>Download PDF</span>
            </button>
          </div>
        </div>

        {/* Analytics Summary */}
        {(!activeEmployee || activeEmployee.isAdmin) && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Card 1: Total Expenses (Spans 1 column) */}
            <div className="bg-white border border-slate-200/60 rounded-3xl p-5 shadow-xs relative overflow-hidden flex flex-col justify-between min-h-[140px] col-span-1">
              <div className="absolute -right-4 -top-4 w-36 h-36 bg-gradient-to-br from-rose-500/10 to-indigo-500/5 rounded-full filter blur-2xl pointer-events-none"></div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Spent</span>
                <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100/30 shrink-0">
                  <Coins className="w-4.5 h-4.5" />
                </div>
              </div>
              <div className="mt-auto pt-2">
                <h3 className="text-sm sm:text-base md:text-lg font-black text-slate-900 leading-none">
                  {formatCurrency(stats.total, currencySymbol)}
                </h3>
                <p className="text-[9px] text-slate-400 font-semibold mt-1">All time records</p>
              </div>
            </div>

            {/* Card 2: Monthly Budget Progress (Spans 1 column) */}
            <div className="bg-white border border-slate-200/60 rounded-3xl p-5 shadow-xs relative overflow-hidden flex flex-col justify-between min-h-[140px] col-span-1">
              <div className="absolute -right-4 -top-4 w-28 h-28 bg-amber-500/10 rounded-full filter blur-xl pointer-events-none"></div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Monthly Budget</span>
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100/30 shrink-0">
                  <Calendar className="w-4.5 h-4.5" />
                </div>
              </div>
              <div className="mt-auto pt-2 w-full">
                <h3 className="text-sm sm:text-base md:text-lg font-black text-slate-900 leading-none">
                  {formatCurrency(stats.thisMonth, currencySymbol)}
                </h3>
                <p className="text-[9px] text-slate-400 font-semibold mt-1 truncate">Limit: {formatCurrency(stats.monthlyLimit, currencySymbol)}</p>
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-1.5">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${
                      stats.monthlyPercent >= 100 ? 'bg-red-500' : stats.monthlyPercent >= 80 ? 'bg-amber-500' : 'bg-blue-600'
                    }`}
                    style={{ width: `${Math.min(100, stats.monthlyPercent)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[9px] text-slate-400 mt-1 font-semibold">
                  <span>Spent {Math.round(stats.monthlyPercent)}%</span>
                  <button 
                    onClick={handleOpenBudgetModal}
                    className="text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-0.5 cursor-pointer font-bold bg-transparent border-0 p-0"
                  >
                    <Settings className="w-3 h-3 inline" /> Edit
                  </button>
                </div>
              </div>
            </div>

            {/* Card 3: Yearly Budget Progress (Spans 1 column) */}
            <div className="bg-white border border-slate-200/60 rounded-3xl p-5 shadow-xs relative overflow-hidden flex flex-col justify-between min-h-[140px] col-span-1">
              <div className="absolute -right-4 -top-4 w-28 h-28 bg-emerald-500/10 rounded-full filter blur-xl pointer-events-none"></div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Yearly Budget</span>
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100/30 shrink-0">
                  <TrendingUp className="w-4.5 h-4.5" />
                </div>
              </div>
              <div className="mt-auto pt-2 w-full">
                <h3 className="text-sm sm:text-base md:text-lg font-black text-slate-900 leading-none">
                  {formatCurrency(stats.thisYear, currencySymbol)}
                </h3>
                <p className="text-[9px] text-slate-400 font-semibold mt-1 truncate">Limit: {formatCurrency(stats.yearlyLimit, currencySymbol)}</p>
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-1.5">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${
                      stats.yearlyPercent >= 100 ? 'bg-red-500' : stats.yearlyPercent >= 80 ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(100, stats.yearlyPercent)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[9px] text-slate-400 mt-1 font-semibold">
                  <span>Spent {Math.round(stats.yearlyPercent)}%</span>
                  <button 
                    onClick={handleOpenBudgetModal}
                    className="text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-0.5 cursor-pointer font-bold bg-transparent border-0 p-0"
                  >
                    <Settings className="w-3 h-3 inline" /> Edit
                  </button>
                </div>
              </div>
            </div>

            {/* Card 4: Active Projects (Spans 1 column) */}
            <div className="bg-white border border-slate-200/60 rounded-3xl p-5 shadow-xs relative overflow-hidden flex flex-col justify-between min-h-[140px] col-span-1">
              <div className="absolute -right-8 -top-8 w-40 h-40 bg-indigo-50/15 rounded-full filter blur-2xl pointer-events-none"></div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Projects</span>
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-650 flex items-center justify-center border border-indigo-100/30 shrink-0">
                  <FolderKanban className="w-4.5 h-4.5" />
                </div>
              </div>
              <div className="mt-auto pt-2">
                <h3 className="text-sm sm:text-base md:text-lg font-black text-slate-900 leading-none">
                  {stats.projectCount}
                </h3>
                <p className="text-[9px] text-slate-400 font-semibold mt-1">Campaigns active</p>
              </div>
            </div>
          </div>
        )}

        {/* Filter Panel */}
        <div className="bg-white p-5 rounded-3xl border border-[#f1f3f9] shadow-xs space-y-3">
          <div className="relative w-full filter-popover-container">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search description, project..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
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
                {/* Category Selection */}
                <div className="w-full">
                  <button
                    type="button"
                    onClick={() => setActiveFilterCategory(activeFilterCategory === 'category' ? null : 'category')}
                    className={`flex items-center justify-between w-full px-4 py-2.5 bg-white border rounded-2xl shadow-sm text-xs font-bold transition-all cursor-pointer ${
                      activeFilterCategory === 'category' 
                        ? 'border-indigo-305 text-indigo-700 bg-indigo-50/10' 
                        : 'border-slate-200/85 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                      <span>Category</span>
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {activeFilterCategory === 'category' ? '▲' : '▼'}
                    </span>
                  </button>
                  {activeFilterCategory === 'category' && (
                    <div className="mt-2 pl-4 flex flex-col gap-1.5 animate-in slide-in-from-top-2 duration-150">
                      <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:border-blue-600 bg-white"
                      >
                        <option value="all">All Categories</option>
                        {CATEGORIES.map(cat => (
                          <option key={cat.value} value={cat.value}>{cat.label}</option>
                        ))}
                        {uniqueCategories.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Project / Event Selection */}
                <div className="w-full">
                  <button
                    type="button"
                    onClick={() => setActiveFilterCategory(activeFilterCategory === 'project' ? null : 'project')}
                    className={`flex items-center justify-between w-full px-4 py-2.5 bg-white border rounded-2xl shadow-sm text-xs font-bold transition-all cursor-pointer ${
                      activeFilterCategory === 'project' 
                        ? 'border-indigo-305 text-indigo-700 bg-indigo-50/10' 
                        : 'border-slate-200/85 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span>Project & Event</span>
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {activeFilterCategory === 'project' ? '▲' : '▼'}
                    </span>
                  </button>
                  {activeFilterCategory === 'project' && (
                    <div className="mt-2 pl-4 flex flex-col gap-1.5 animate-in slide-in-from-top-2 duration-150">
                      <select
                        value={selectedProject}
                        onChange={(e) => setSelectedProject(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:border-blue-600 bg-white"
                      >
                        <option value="all">All Projects & Events</option>
                        <option value="none">Without Project / Event</option>
                        {uniqueProjects.map(proj => (
                          <option key={proj} value={proj}>{proj}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Month Selection */}
                <div className="w-full">
                  <button
                    type="button"
                    onClick={() => setActiveFilterCategory(activeFilterCategory === 'month' ? null : 'month')}
                    className={`flex items-center justify-between w-full px-4 py-2.5 bg-white border rounded-2xl shadow-sm text-xs font-bold transition-all cursor-pointer ${
                      activeFilterCategory === 'month' 
                        ? 'border-indigo-305 text-indigo-700 bg-indigo-50/10' 
                        : 'border-slate-200/85 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                      <span>Month</span>
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {activeFilterCategory === 'month' ? '▲' : '▼'}
                    </span>
                  </button>
                  {activeFilterCategory === 'month' && (
                    <div className="mt-2 pl-4 flex flex-col gap-1.5 animate-in slide-in-from-top-2 duration-150">
                      <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:border-blue-600 bg-white"
                      >
                        <option value="all">All Months</option>
                        {monthOptions.map(opt => (
                          <option key={opt.val} value={opt.val}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Clear Filters Reset Button inside popover */}
                {(searchTerm || selectedCategory !== 'all' || selectedProject !== 'all' || selectedMonth !== 'all') && (
                  <button
                    onClick={() => {
                      setSearchTerm('');
                      setSelectedCategory('all');
                      setSelectedProject('all');
                      setSelectedMonth('all');
                      setShowMobileFilters(false);
                    }}
                    className="w-full mt-1.5 flex items-center justify-center gap-1.5 text-[10px] font-extrabold text-blue-600 hover:text-blue-700 bg-blue-50/50 hover:bg-blue-50 py-2.5 rounded-xl transition-all cursor-pointer shadow-xs border border-blue-100"
                  >
                    <X className="w-3 h-3 stroke-[2.5]" />
                    Reset All Filters
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Expenses List Table */}
        <div className="bg-white rounded-3xl border border-[#f1f3f9] shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h3 className="font-extrabold text-slate-800 text-sm">Transaction Logs</h3>
              <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2.5 py-1 rounded-lg">
                Showing {filteredExpenses.length} of {expenses.length} Entries
              </span>
            </div>

            {selectedExpenseIds.length > 0 && (
              <div className="flex items-center gap-2.5 animate-in fade-in slide-in-from-right-2 duration-200">
                <span className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200/60 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                  <CheckSquare className="w-3.5 h-3.5" />
                  {selectedExpenseIds.length} selected
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedExpenseIds([])}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                >
                  Clear Selection
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteMultipleModal(true)}
                  className="px-3.5 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 rounded-xl shadow-xs hover:shadow-md active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Selected ({selectedExpenseIds.length})</span>
                </button>
              </div>
            )}
          </div>

          {/* Desktop View (Table Layout) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-sans">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold uppercase text-[9px] tracking-wider">
                  <th className="py-4 pl-6 pr-2 w-12 text-center">
                    <input
                      type="checkbox"
                      checked={filteredExpenses.length > 0 && selectedExpenseIds.length === filteredExpenses.length}
                      onChange={handleSelectAll}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600 transition-all"
                      title={selectedExpenseIds.length === filteredExpenses.length ? "Deselect all" : "Select all"}
                    />
                  </th>
                  <th className="py-4 px-4">Date</th>
                  <th className="py-4 px-6">Details</th>
                  <th className="py-4 px-6">Category</th>
                  <th className="py-4 px-6">Project / Event</th>
                  <th className="py-4 px-6">Paid Via</th>
                  <th className="py-4 px-6 text-right">Amount</th>
                  <th className="py-4 px-6 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <div className="flex justify-center items-center gap-2">
                        <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        <span>Loading expenses...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center text-slate-400 font-medium">
                      <div className="max-w-xs mx-auto space-y-3">
                        <p className="text-slate-400 text-xs">No expense records found.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredExpenses.map((row) => {
                    const isSelected = selectedExpenseIds.includes(row.id);
                    const colors = getCategoryColorClasses(row.category);
                    const Icon = getCategoryIcon(row.category);
                    
                    return (
                      <tr key={row.id} className={`transition-colors ${isSelected ? 'bg-blue-50/50 hover:bg-blue-50/70' : 'hover:bg-slate-50/40'}`}>
                        {/* Checkbox */}
                        <td className="py-4.5 pl-6 pr-2 w-12 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelect(row.id)}
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600 transition-all"
                          />
                        </td>

                        {/* Date */}
                        <td className="py-4.5 px-4 text-slate-500 text-[11px] whitespace-nowrap">
                          {formatDate(row.date)}
                        </td>

                        {/* Particulars */}
                        <td className="py-4.5 px-6 font-semibold text-slate-800">
                          <div>{row.particulars}</div>
                          {row.createdBy && (
                            <div className="text-[10px] text-slate-400 font-medium mt-0.5 flex items-center gap-1">
                              <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                              <span>by {row.createdBy}</span>
                            </div>
                          )}
                        </td>

                        {/* Category */}
                        <td className="py-4.5 px-6">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-bold ${colors.bg} ${colors.text}`}>
                            <Icon className="w-3.5 h-3.5" />
                            {row.category}
                          </span>
                        </td>

                        {/* Project / Event */}
                        <td className="py-4.5 px-6">
                          {row.projectEvent ? (
                            <button
                              onClick={() => setSelectedProject(row.projectEvent)}
                              className="inline-flex items-center gap-1 bg-blue-50/40 hover:bg-blue-50 text-blue-600 px-2 py-1 rounded-lg border border-blue-100/30 text-[9px] font-bold transition-all cursor-pointer"
                              title="Click to filter by this project"
                            >
                              <Tag className="w-2.5 h-2.5" />
                              {row.projectEvent}
                            </button>
                          ) : (
                            <span className="text-slate-400 text-[10px] italic">General Office</span>
                          )}
                        </td>

                        {/* Paid Via */}
                        <td className="py-4.5 px-6 text-slate-500 font-semibold text-[11px]">
                          {row.paidVia}
                        </td>

                        {/* Amount */}
                        <td className="py-4.5 px-6 text-right text-slate-900 font-black text-xs">
                          {formatCurrency(row.amount, currencySymbol)}
                        </td>

                        {/* Actions */}
                        <td className="py-4.5 px-6 text-center">
                          <button
                            onClick={() => handleDeleteExpense(row.id)}
                            className="p-2 text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer active:scale-95"
                            title="Delete Expense Entry"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile View (Recent Documents Card Inspo) */}
          <div className="md:hidden space-y-4 p-4.5 bg-slate-50/50">
            {loading ? (
              <div className="py-12 text-center text-slate-400">
                <div className="flex justify-center items-center gap-2">
                  <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  <span>Loading expenses...</span>
                </div>
              </div>
            ) : filteredExpenses.length === 0 ? (
              <div className="py-16 text-center text-slate-400 font-medium">
                <p className="text-slate-400 text-xs">No expense records found.</p>
              </div>
            ) : (
              filteredExpenses.map((row) => {
                const isSelected = selectedExpenseIds.includes(row.id);
                const colors = getCategoryColorClasses(row.category);
                const Icon = getCategoryIcon(row.category);

                return (
                  <div
                    key={row.id}
                    className={`p-5 bg-white border rounded-3xl flex flex-col gap-4 shadow-xs hover:shadow-md transition-all duration-300 group ${
                      isSelected ? 'border-blue-300 bg-blue-50/15 ring-2 ring-blue-500/10' : 'border-[#f1f3f9]'
                    }`}
                  >
                    {/* Top Row: Checkbox + Category Badge + Date */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(row.id)}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600 shrink-0"
                        />
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-bold ${colors.bg} ${colors.text}`}>
                          <Icon className="w-3.5 h-3.5" />
                          {row.category}
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[10px] text-slate-400 font-semibold">
                          {formatDate(row.date)}
                        </p>
                      </div>
                    </div>

                    {/* Middle: Details */}
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

                    {/* Project / Event Tag & Payment Method + Amount */}
                    <div className="grid grid-cols-2 gap-3 bg-slate-50/60 p-3 rounded-2xl border border-slate-100">
                      <div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Project / Event</p>
                        <div className="mt-0.5 min-w-0 truncate">
                          {row.projectEvent ? (
                            <button
                              onClick={() => setSelectedProject(row.projectEvent)}
                              className="inline-flex items-center gap-1 bg-blue-50/40 hover:bg-blue-50 text-blue-600 px-2 py-0.5 rounded-lg border border-blue-100/30 text-[9px] font-bold transition-all cursor-pointer truncate max-w-full"
                              title="Click to filter by this project"
                            >
                              <Tag className="w-2.5 h-2.5" />
                              {row.projectEvent}
                            </button>
                          ) : (
                            <span className="text-slate-400 text-[10px] italic">General Office</span>
                          )}
                        </div>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Paid Via</p>
                        <p className="font-extrabold text-xs mt-0.5 text-slate-800 truncate">
                          {row.paidVia}
                        </p>
                      </div>
                    </div>

                    {/* Bottom Row: Amount & Actions */}
                    <div className="flex items-center justify-between pt-3 border-t border-slate-100/80">
                      <div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Amount</p>
                        <p className="font-black text-sm text-slate-900 mt-0.5">
                          {formatCurrency(row.amount, currencySymbol)}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 bg-slate-50 border border-slate-200/50 p-1 rounded-2xl">
                        <button
                          onClick={() => handleDeleteExpense(row.id)}
                          className="p-2 text-rose-500 hover:text-rose-600 hover:bg-white rounded-xl active:scale-95 transition-all cursor-pointer"
                          title="Delete Expense Entry"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Add Expense Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-white rounded-3xl shadow-xl border border-slate-100 max-w-md w-full overflow-hidden">
              <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-extrabold text-slate-900 text-sm">Add New Expense</h3>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 rounded-xl hover:bg-slate-50 text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleAddExpense} className="p-6 space-y-4">
                {/* Project / Event Name */}
                <div className="space-y-1 relative" ref={projectDropdownRef}>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Project / Event Name (Optional)</label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Select or type a Project/Event"
                      value={newExpense.projectEvent}
                      onChange={(e) => {
                        setNewExpense(prev => ({ ...prev, projectEvent: e.target.value }));
                        setShowProjectDropdown(true);
                      }}
                      onFocus={() => setShowProjectDropdown(true)}
                      className="w-full px-4 py-3 pr-10 rounded-2xl border border-slate-200 text-xs font-semibold focus:outline-none focus:border-blue-600 bg-slate-50/20"
                    />
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 pointer-events-none" />
                  </div>

                  {showProjectDropdown && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-2xl shadow-lg max-h-48 overflow-y-auto py-1">
                      {filteredProjectSuggestions.length > 0 ? (
                        filteredProjectSuggestions.map(proj => (
                          <button
                            key={proj}
                            type="button"
                            onClick={() => {
                              setNewExpense(prev => ({ ...prev, projectEvent: proj }));
                              setShowProjectDropdown(false);
                            }}
                            className="w-full text-left px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-colors"
                          >
                            {proj}
                          </button>
                        ))
                      ) : (
                        <div className="px-4 py-2 text-xs text-slate-400 font-semibold">No matching projects found</div>
                      )}

                      {/* Add new option */}
                      {newExpense.projectEvent.trim() !== '' && !uniqueProjects.some(p => p.toLowerCase() === newExpense.projectEvent.trim().toLowerCase()) && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowProjectDropdown(false);
                          }}
                          className="w-full text-left px-4 py-2 text-xs font-bold text-blue-600 border-t border-slate-100 hover:bg-blue-50 transition-colors flex items-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add &quot;{newExpense.projectEvent.trim()}&quot; as new Project/Event</span>
                        </button>
                      )}

                      {newExpense.projectEvent !== '' && (
                        <button
                          type="button"
                          onClick={() => {
                            setNewExpense(prev => ({ ...prev, projectEvent: '' }));
                            setShowProjectDropdown(false);
                          }}
                          className="w-full text-left px-4 py-2 text-xs font-semibold text-rose-600 border-t border-slate-100 hover:bg-rose-50 transition-colors"
                        >
                          Clear (Without Project/Event)
                        </button>
                      )}
                    </div>
                  )}
                  <p className="text-[9px] text-slate-400">
                    Search or type a new/existing project or event.
                  </p>
                </div>

                {/* Particulars / Description */}
                <div className="space-y-1">
                  <label htmlFor="expenseParticulars" className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Particulars / Description</label>
                  <input
                    id="expenseParticulars"
                    name="expenseParticulars"
                    type="text"
                    required
                    placeholder="e.g. Office catering, Server hosting, Travel allowance"
                    value={newExpense.particulars}
                    onChange={(e) => setNewExpense(prev => ({ ...prev, particulars: e.target.value }))}
                    className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-xs font-semibold focus:outline-none focus:border-blue-600 bg-slate-50/20"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Amount */}
                  <div className="space-y-1">
                    <label htmlFor="expenseAmount" className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Amount ({currencySymbol})</label>
                    <input
                      id="expenseAmount"
                      name="expenseAmount"
                      type="number"
                      required
                      min="0.01"
                      step="0.01"
                      placeholder="0.00"
                      value={newExpense.amount}
                      onChange={(e) => setNewExpense(prev => ({ ...prev, amount: e.target.value }))}
                      className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-xs font-semibold focus:outline-none focus:border-blue-600 bg-slate-50/20"
                    />
                  </div>

                  {/* Date */}
                  <div className="space-y-1">
                    <label htmlFor="expenseDate" className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Date</label>
                    <input
                      id="expenseDate"
                      name="expenseDate"
                      type="date"
                      required
                      value={newExpense.date}
                      onChange={(e) => setNewExpense(prev => ({ ...prev, date: e.target.value }))}
                      className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-xs font-semibold focus:outline-none focus:border-blue-600 bg-slate-50/20"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Category */}
                  <div className="space-y-1">
                    <label htmlFor="expenseCategory" className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Category</label>
                    <select
                      id="expenseCategory"
                      name="expenseCategory"
                      value={CATEGORIES.map(c => c.value).includes(newExpense.category) ? newExpense.category : 'Others'}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === 'Others') {
                          setNewExpense(prev => ({ ...prev, category: 'Others' }));
                          setCustomCategory('');
                        } else {
                          setNewExpense(prev => ({ ...prev, category: val }));
                          setCustomCategory('');
                        }
                      }}
                      className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-xs font-semibold focus:outline-none focus:border-blue-600 bg-slate-50/20"
                    >
                      {CATEGORIES.map(cat => (
                        <option key={cat.value} value={cat.value}>{cat.label}</option>
                      ))}
                    </select>
                    
                    {(newExpense.category === 'Others' || !CATEGORIES.map(c => c.value).includes(newExpense.category)) && (
                      <input
                        id="customCategory"
                        name="customCategory"
                        type="text"
                        required
                        placeholder="Enter custom category name (e.g. Software, Licensing)"
                        value={customCategory || (CATEGORIES.map(c => c.value).includes(newExpense.category) ? '' : newExpense.category)}
                        onChange={(e) => {
                          setCustomCategory(e.target.value);
                          setNewExpense(prev => ({ ...prev, category: e.target.value }));
                        }}
                        className="w-full px-4 py-3 mt-2 rounded-2xl border border-slate-200 text-xs font-semibold focus:outline-none focus:border-blue-600 bg-slate-50/20 animate-fade-in"
                      />
                    )}
                  </div>

                  {/* Payment Method */}
                  <div className="space-y-1">
                    <label htmlFor="expensePaidVia" className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Payment Method</label>
                    <select
                      id="expensePaidVia"
                      name="expensePaidVia"
                      value={newExpense.paidVia}
                      onChange={(e) => setNewExpense(prev => ({ ...prev, paidVia: e.target.value }))}
                      className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-xs font-semibold focus:outline-none focus:border-blue-600 bg-slate-50/20"
                    >
                      {PAYMENT_METHODS.map(method => (
                        <option key={method} value={method}>{method}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    disabled={isSaving}
                    className="flex-1 px-4 py-3 border border-slate-200 rounded-2xl text-xs font-bold text-slate-500 hover:bg-slate-50 transition-all cursor-pointer text-center disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-bold transition-all cursor-pointer text-center disabled:bg-blue-400 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                  >
                    {isSaving ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <span>Save Expense</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Custom Confirmation Popup Modal */}
        <ConfirmModal
          isOpen={!!deleteExpenseId}
          onClose={() => setDeleteExpenseId(null)}
          onConfirm={handleConfirmDeleteExpense}
          title="Delete Expense"
          message="Are you sure you want to delete this expense? This action cannot be undone."
          confirmText="Delete"
          confirmVariant="danger"
        />

        {/* Multiple Delete Confirmation Modal */}
        <ConfirmModal
          isOpen={showDeleteMultipleModal}
          onClose={() => !isDeletingMultiple && setShowDeleteMultipleModal(false)}
          onConfirm={handleConfirmDeleteMultiple}
          title="Delete Selected Expenses"
          message={`Are you sure you want to delete ${selectedExpenseIds.length} selected expense entry${selectedExpenseIds.length > 1 ? 'ies' : ''}? This action cannot be undone and records will be moved to the Recycle Bin.`}
          confirmText={isDeletingMultiple ? "Deleting..." : `Delete ${selectedExpenseIds.length} Expenses`}
          confirmVariant="danger"
          isLoading={isDeletingMultiple}
        />

        {/* Budget Customize Modal */}
        {isBudgetModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-white rounded-3xl shadow-xl border border-slate-100 max-w-sm w-full overflow-hidden">
              <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-extrabold text-slate-900 text-sm">Customize Budget Limits</h3>
                <button 
                  onClick={() => setIsBudgetModalOpen(false)}
                  className="p-1.5 rounded-xl hover:bg-slate-50 text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveBudget} className="p-6 space-y-4">
                <div className="space-y-1">
                  <label htmlFor="configMonth" className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Select Month to Configure</label>
                  <select
                    id="configMonth"
                    name="configMonth"
                    value={configMonth}
                    onChange={(e) => handleConfigMonthChange(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-xs font-semibold focus:outline-none focus:border-blue-600 bg-slate-50/20"
                  >
                    {monthOptions.map(opt => (
                      <option key={opt.val} value={opt.val}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label htmlFor="budgetMonthly" className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                    Budget for {configMonth ? new Date(configMonth + '-02').toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : ''} ({currencySymbol})
                  </label>
                  <input
                    id="budgetMonthly"
                    name="budgetMonthly"
                    type="number"
                    min="0"
                    placeholder="e.g. 50000"
                    value={budgetMonthly}
                    onChange={(e) => setBudgetMonthly(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-xs font-semibold focus:outline-none focus:border-blue-600 bg-slate-50/20"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="budgetYearly" className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Yearly Budget Limit ({currencySymbol})</label>
                  <input
                    id="budgetYearly"
                    name="budgetYearly"
                    type="number"
                    min="0"
                    placeholder="e.g. 600000"
                    value={budgetYearly}
                    onChange={(e) => setBudgetYearly(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-xs font-semibold focus:outline-none focus:border-blue-600 bg-slate-50/20"
                    required
                  />
                </div>

                <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsBudgetModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-500 font-extrabold text-xs transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingBudget}
                    className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs shadow-xs hover:shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                  >
                    {isSavingBudget ? 'Saving...' : 'Save Settings'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Hidden PDF Printable Wrapper */}
        <div style={{ position: 'fixed', left: 0, top: 0, width: '210mm', opacity: 1, visibility: 'visible', pointerEvents: 'none', zIndex: -99999, overflow: 'hidden' }}>
          <div ref={printRef} className="p-8 w-[210mm] min-h-[295mm] bg-white font-sans text-xs text-slate-800 space-y-6 relative overflow-hidden">
            {renderExpenseReportContent()}
          </div>
        </div>

        {/* Expense Report Preview Modal */}
        {showExpensePreviewModal && expenseReportType && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200 text-left">
            <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full h-[90vh] flex flex-col overflow-hidden">
              {/* Modal Header */}
              <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 bg-slate-50">
                <div className="flex items-center gap-2">
                  <Eye className="w-5 h-5 text-blue-600" />
                  <h3 className="font-bold text-slate-800 text-sm">
                    {expenseReportType === 'pdf' && 'Expense Statement Preview'}
                    {expenseReportType === 'excel' && 'Excel Report Preview'}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setShowExpensePreviewModal(false);
                      setExpenseReportType(null);
                    }}
                    className="flex items-center justify-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-extrabold text-xs px-4 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer"
                  >
                    Close Preview
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="flex-1 bg-slate-200/80 p-6 overflow-auto flex justify-center items-start">
                {expenseReportType === 'pdf' && (
                  <div className="bg-white shadow-md rounded-xl p-2 max-w-[210mm] w-full text-xs">
                    <div className="p-8 w-[210mm] min-h-[295mm] bg-white font-sans text-xs text-slate-800 space-y-6 relative overflow-hidden">
                      {renderExpenseReportContent()}
                    </div>
                  </div>
                )}
                {expenseReportType === 'excel' && (
                  <div className="bg-white shadow-md rounded-xl p-6 w-full max-w-4xl overflow-x-auto">
                    <h4 className="font-bold text-slate-800 text-sm mb-4">Export Preview (CSV Data Rows)</h4>
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px] tracking-wider">
                          <th className="py-2 px-3">Date</th>
                          <th className="py-2 px-3">Category</th>
                          <th className="py-2 px-3">Particulars / Description</th>
                          <th className="py-2 px-3">Project / Event</th>
                          <th className="py-2 px-3">Paid Via</th>
                          <th className="py-2 px-3 text-right">Amount ({currencySymbol})</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {filteredExpenses.map((e, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="py-2 px-3 text-slate-500">{formatDate(e.date)}</td>
                            <td className="py-2 px-3 text-slate-700 font-semibold">{e.category}</td>
                            <td className="py-2 px-3 text-slate-800">{e.particulars}</td>
                            <td className="py-2 px-3 text-slate-600 font-mono text-[9px]">{e.projectEvent || 'General Office'}</td>
                            <td className="py-2 px-3 text-slate-500 uppercase text-[9px]">{e.paidVia || 'Cash'}</td>
                            <td className="py-2 px-3 text-right text-rose-600 font-extrabold">{formatCurrency(e.amount, currencySymbol)}</td>
                          </tr>
                        ))}
                        <tr className="bg-slate-50/80 font-bold border-t border-slate-200 text-slate-900">
                          <td className="py-3 px-3 uppercase" colSpan={5}>TOTAL EXPENSES</td>
                          <td className="py-3 px-3 text-right text-rose-600 font-black">
                            {formatCurrency(filteredExpenses.reduce((sum, e) => sum + e.amount, 0), currencySymbol)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-3 bg-white border-t border-slate-200 flex justify-end gap-2">
                {expenseReportType !== 'excel' && (
                  <button
                    onClick={() => {
                      handleExportPDF();
                    }}
                    className="flex items-center justify-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-extrabold text-xs px-4 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer"
                  >
                    <Printer className="w-4 h-4 text-slate-500" />
                    Print
                  </button>
                )}
                <button
                  onClick={() => {
                    if (expenseReportType === 'pdf') handleExportPDF();
                    else if (expenseReportType === 'excel') handleExportCSV();
                  }}
                  className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs px-5 py-2.5 rounded-xl shadow-sm hover:shadow-md transition-all active:scale-95 cursor-pointer shrink-0"
                >
                  <Download className="w-4 h-4" />
                  {expenseReportType === 'excel' ? 'Download Excel (CSV)' : 'Download PDF'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Floating Add Expense Action Button (FAB) - Unique design with Speed Dial */}
        {canAddExpense && (
          <div className="fixed bottom-20 right-6 z-40 flex flex-col items-end gap-3 no-print">
            {/* Expanded Speed Dial Options */}
            {showMobileControls && (
              <div className="flex flex-col gap-2.5 items-end animate-in slide-in-from-bottom-5 duration-200">
                
                {/* Export Excel Option */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (filteredExpenses.length === 0) {
                      showToast('No expenses found for the current filters to export.', 'warning');
                      return;
                    }
                    setExpenseReportType('excel');
                    setShowExpensePreviewModal(true);
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
                    if (filteredExpenses.length === 0) {
                      showToast('No expenses found for the current filters to export.', 'warning');
                      return;
                    }
                    setExpenseReportType('pdf');
                    setShowExpensePreviewModal(true);
                    setShowMobileControls(false);
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-2xl shadow-md hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all hover:scale-105 active:scale-95 cursor-pointer pr-5 shrink-0"
                >
                  <FileText className="w-4 h-4 text-slate-500" />
                  <span>Download PDF</span>
                </button>

                {/* Add Expense Option */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenModal();
                    setShowMobileControls(false);
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl shadow-md transition-all hover:scale-105 active:scale-95 cursor-pointer pr-5 shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Expense</span>
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
        )}

        {/* Mobile Floating Action Banner for Multiple Delete */}
        {selectedExpenseIds.length > 0 && (
          <div className="md:hidden fixed bottom-24 left-4 right-4 z-40 bg-slate-900/95 backdrop-blur-md text-white p-3.5 rounded-2xl shadow-2xl flex items-center justify-between border border-slate-700/60 animate-in slide-in-from-bottom-5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold bg-blue-600 text-white px-2.5 py-1 rounded-lg">
                {selectedExpenseIds.length}
              </span>
              <span className="text-xs font-semibold text-slate-200">Selected</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedExpenseIds([])}
                className="px-2.5 py-1 text-xs text-slate-300 hover:text-white font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteMultipleModal(true)}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-3.5 py-1.5 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            </div>
          </div>
        )}

      </div>
    </MainLayout>
  );
};

export default Expenses;
