import React, { useState, useMemo, useRef, useEffect } from 'react';
import { MainLayout } from '../components/layout/MainLayout';
import { useCompany } from '../contexts/CompanyContext';
import { useDocument } from '../contexts/DocumentContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { formatCurrency, formatDate } from '../utils/formatting';
import { downloadDocumentPDF, printDocument } from '../services/pdfGenerator';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Badge } from '../components/ui/Badge';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { TemplateWrapper } from '../templates/TemplateWrapper';
import { calculateTotals } from '../utils/calculations';
import { ResponsiveDocumentWrapper } from '../components/ui/ResponsiveDocumentWrapper';
import { 
  FileText, 
  Search, 
  SlidersHorizontal,
  PlusCircle, 
  Plus,
  Copy, 
  Download, 
  Trash2, 
  Share2, 
  Filter,
  ArrowUpDown,
  X,
  Eye,
  CreditCard,
  Receipt,
  Printer,
  MoreVertical,
  Send,
  Mail,
  MessageSquare
} from 'lucide-react';
import { useToast } from '../components/ui/Toast';

export const Documents = () => {
  const { activeCompany } = useCompany();
  const { documents, removeDoc, duplicateDoc } = useDocument();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const employeeJson = localStorage.getItem('activeEmployee');
  const activeEmployee = employeeJson ? JSON.parse(employeeJson) : null;
  const canCreate = !activeEmployee || activeEmployee.isAdmin || (
    activeEmployee.permissions.addInvoice || 
    activeEmployee.permissions.addVoucher || 
    activeEmployee.permissions.addReceipt
  );

  const { search } = useLocation();
  const [previewDoc, setPreviewDoc] = useState(null);
  const [shareDoc, setShareDoc] = useState<any>(null);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);

  const canAddInvoice = !activeEmployee || activeEmployee.isAdmin || activeEmployee.permissions.addInvoice;
  const canAddVoucher = !activeEmployee || activeEmployee.isAdmin || activeEmployee.permissions.addVoucher;
  const canAddReceipt = !activeEmployee || activeEmployee.isAdmin || activeEmployee.permissions.addReceipt;

  // Close speed dial menu on click outside
  useEffect(() => {
    if (!createMenuOpen) return;
    const handleClose = () => setCreateMenuOpen(false);
    window.addEventListener('click', handleClose);
    return () => window.removeEventListener('click', handleClose);
  }, [createMenuOpen]);

  useEffect(() => {
    const queryParams = new URLSearchParams(search);
    const previewId = queryParams.get('preview');
    if (previewId && documents.length > 0) {
      const doc = documents.find(d => d.id === previewId);
      if (doc) {
        setPreviewDoc(doc);
      }
    } else {
      setPreviewDoc(null);
    }
  }, [search, documents]);

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

  const queryParams = useMemo(() => new URLSearchParams(search), [search]);

  const [typeFilter, setTypeFilter] = useState(queryParams.get('type') || 'all'); // all | invoice | voucher | receipt
  const [statusFilter, setStatusFilter] = useState(queryParams.get('status') || 'all'); // all | Paid | Pending | Overdue | Draft
  const [searchQuery, setSearchQuery] = useState('');
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [activeFilterCategory, setActiveFilterCategory] = useState<'type' | 'status' | 'sort' | null>(null);
  const [sortBy, setSortBy] = useState('newest'); // newest | oldest | highest | lowest

  // Sync filters when search query params change
  useEffect(() => {
    setTypeFilter(queryParams.get('type') || 'all');
    setStatusFilter(queryParams.get('status') || 'all');
  }, [queryParams]);

  const [pdfRenderDoc, setPdfRenderDoc] = useState(null);
  const pdfRef = useRef(null);
  const [activeMenuId, setActiveMenuId] = useState(null);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest('.dropdown-container')) {
        setActiveMenuId(null);
      }
      if (!e.target.closest('.filter-popover-container')) {
        setShowMobileFilters(false);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  const filteredDocs = useMemo(() => {
    let result = [...documents];

    if (activeEmployee && !activeEmployee.isAdmin) {
      result = result.filter(d => d.createdBy === activeEmployee.name);
    }

    // Filter by type
    if (typeFilter !== 'all') {
      result = result.filter(d => d.documentType === typeFilter);
    }

    // Filter by status
    if (statusFilter !== 'all') {
      result = result.filter(d => d.status === statusFilter);
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(d => {
        const docNum = (d.documentNumber || '').toLowerCase();
        const partyName = (d.customer?.customerName || d.paidTo || d.receivedFrom || '').toLowerCase();
        const statusStr = (d.status || '').toLowerCase();
        return docNum.includes(q) || partyName.includes(q) || statusStr.includes(q);
      });
    }

    // Sort
    result.sort((a, b) => {
      const amtA = a.totals?.grandTotal || parseFloat(a.amount) || 0;
      const amtB = b.totals?.grandTotal || parseFloat(b.amount) || 0;
      const dateA = new Date(a.documentDate || a.createdAt).getTime();
      const dateB = new Date(b.documentDate || b.createdAt).getTime();

      if (sortBy === 'newest') return dateB - dateA;
      if (sortBy === 'oldest') return dateA - dateB;
      if (sortBy === 'highest') return amtB - amtA;
      if (sortBy === 'lowest') return amtA - amtB;
      return 0;
    });

    return result;
  }, [documents, typeFilter, statusFilter, searchQuery, sortBy]);

  const handleDownload = async (doc: any) => {
    setPdfRenderDoc(doc);
    showToast('Downloading PDF automatically...', 'info');

    // Dynamically wait until pdfRef mounts in the DOM
    let attempts = 0;
    while (!pdfRef.current && attempts < 25) {
      await new Promise(r => setTimeout(r, 40));
      attempts++;
    }

    // Small delay to allow template layout to calculate
    await new Promise(r => setTimeout(r, 150));

    try {
      if (!pdfRef.current) {
        throw new Error('PDF render target could not be prepared.');
      }
      const prefix = doc.documentNumber || 'Doc';
      const name = doc.customer?.customerName || doc.paidTo || doc.receivedFrom || 'Client';
      const orientation = doc.documentType === 'invoice' || !doc.documentType ? 'portrait' : 'landscape';
      await downloadDocumentPDF(pdfRef.current, `${prefix}-${name.replace(/\s+/g, '_')}`, orientation);
      showToast('PDF downloaded successfully!', 'success');
    } catch (err: any) {
      console.error('PDF download error:', err);
      showToast(`Failed to download PDF: ${err?.message || err}`, 'error');
    } finally {
      setPdfRenderDoc(null);
    }
  };

  const handlePrint = async (doc: any) => {
    setPdfRenderDoc(doc);

    let attempts = 0;
    while (!pdfRef.current && attempts < 25) {
      await new Promise(r => setTimeout(r, 40));
      attempts++;
    }
    await new Promise(r => setTimeout(r, 150));

    try {
      if (pdfRef.current) {
        const prefix = doc.documentNumber || 'Doc';
        const name = doc.customer?.customerName || doc.paidTo || doc.receivedFrom || 'Client';
        const orientation = doc.documentType === 'invoice' || !doc.documentType ? 'portrait' : 'landscape';
        await printDocument(pdfRef.current, `${prefix}-${name.replace(/\s+/g, '_')}`, orientation);
      }
    } catch (err: any) {
      console.error(err);
      showToast('Failed to open print dialog.', 'error');
    } finally {
      setPdfRenderDoc(null);
    }
  };

  const [deleteDocId, setDeleteDocId] = useState(null);

  const handleDuplicate = async (id) => {
    try {
      const dup = await duplicateDoc(id);
      if (dup) {
        showToast(`Duplicated as ${dup.documentNumber}`, 'success');
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to duplicate document.', 'error');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteDocId) return;
    try {
      await removeDoc(deleteDocId);
      showToast('Document deleted.', 'info');
    } catch (err) {
      showToast('Failed to delete document.', 'error');
    } finally {
      setDeleteDocId(null);
    }
  };

  return (
    <MainLayout title="Documents">
      <div className="space-y-6">
        {/* Header & New Document Button */}
        <div className={`sticky top-16 md:top-4 z-20 hidden md:flex flex-row md:items-center justify-between gap-4 bg-white/95 backdrop-blur-md p-5 rounded-3xl border border-[#f1f3f9] shadow-sm transition-all duration-300 ${
          scrollDirection === 'down' ? '-translate-y-40 opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'
        }`}>
          <div>
            <h1 className="font-extrabold text-slate-900 text-lg tracking-tight">Document History</h1>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">Manage, filter, duplicate, and export all invoices, vouchers, and receipts.</p>
          </div>

        </div>

        {/* Filter and Search Bar */}
        <div className="bg-white p-5 rounded-3xl border border-[#f1f3f9] shadow-xs space-y-3">
          <div className="relative w-full filter-popover-container">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search doc #, customer, status..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
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
                {/* Document Type Category */}
                <div className="w-full">
                  <button
                    type="button"
                    onClick={() => setActiveFilterCategory(activeFilterCategory === 'type' ? null : 'type')}
                    className={`flex items-center justify-between w-full px-4 py-2.5 bg-white border rounded-2xl shadow-sm text-xs font-bold transition-all cursor-pointer ${
                      activeFilterCategory === 'type' 
                        ? 'border-indigo-305 text-indigo-700 bg-indigo-50/10' 
                        : 'border-slate-200/85 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                      <span>Document Type</span>
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {activeFilterCategory === 'type' ? '▲' : '▼'}
                    </span>
                  </button>
                  {activeFilterCategory === 'type' && (
                    <div className="mt-2 pl-4 flex flex-col gap-1.5 animate-in slide-in-from-top-2 duration-150">
                      {[
                        { val: 'all', label: 'All', color: 'bg-slate-400' },
                        { val: 'invoice', label: 'Invoices', color: 'bg-blue-500' },
                        { val: 'voucher', label: 'Vouchers', color: 'bg-emerald-500' },
                        { val: 'receipt', label: 'Receipts', color: 'bg-amber-500' }
                      ].map(item => (
                        <button
                          key={item.val}
                          type="button"
                          onClick={() => {
                            setTypeFilter(item.val);
                          }}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            typeFilter === item.val
                              ? 'bg-indigo-50 text-indigo-705'
                              : 'text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${item.color}`} />
                          {item.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Status Category */}
                <div className="w-full">
                  <button
                    type="button"
                    onClick={() => setActiveFilterCategory(activeFilterCategory === 'status' ? null : 'status')}
                    className={`flex items-center justify-between w-full px-4 py-2.5 bg-white border rounded-2xl shadow-sm text-xs font-bold transition-all cursor-pointer ${
                      activeFilterCategory === 'status' 
                        ? 'border-indigo-305 text-indigo-700 bg-indigo-50/10' 
                        : 'border-slate-200/85 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span>Status</span>
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {activeFilterCategory === 'status' ? '▲' : '▼'}
                    </span>
                  </button>
                  {activeFilterCategory === 'status' && (
                    <div className="mt-2 pl-4 flex flex-col gap-1.5 animate-in slide-in-from-top-2 duration-150">
                      {[
                        { val: 'all', label: 'All Statuses', color: 'bg-slate-400' },
                        { val: 'Pending', label: 'Pending', color: 'bg-amber-500' },
                        { val: 'Paid', label: 'Paid', color: 'bg-emerald-500' },
                        { val: 'Overdue', label: 'Overdue', color: 'bg-rose-500' },
                        { val: 'Draft', label: 'Draft', color: 'bg-slate-550' }
                      ].map(item => (
                        <button
                          key={item.val}
                          type="button"
                          onClick={() => {
                            setStatusFilter(item.val);
                          }}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            statusFilter === item.val
                              ? 'bg-indigo-50 text-indigo-705'
                              : 'text-slate-665 hover:bg-slate-50'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${item.color}`} />
                          {item.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Sort By Category */}
                <div className="w-full">
                  <button
                    type="button"
                    onClick={() => setActiveFilterCategory(activeFilterCategory === 'sort' ? null : 'sort')}
                    className={`flex items-center justify-between w-full px-4 py-2.5 bg-white border rounded-2xl shadow-sm text-xs font-bold transition-all cursor-pointer ${
                      activeFilterCategory === 'sort' 
                        ? 'border-indigo-305 text-indigo-700 bg-indigo-50/10' 
                        : 'border-slate-200/85 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                      <span>Sort By</span>
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {activeFilterCategory === 'sort' ? '▲' : '▼'}
                    </span>
                  </button>
                  {activeFilterCategory === 'sort' && (
                    <div className="mt-2 pl-4 flex flex-col gap-1.5 animate-in slide-in-from-top-2 duration-150">
                      {[
                        { val: 'newest', label: 'Newest First' },
                        { val: 'oldest', label: 'Oldest First' },
                        { val: 'highest', label: 'Highest Amount' },
                        { val: 'lowest', label: 'Lowest Amount' }
                      ].map(item => (
                        <button
                          key={item.val}
                          type="button"
                          onClick={() => {
                            setSortBy(item.val);
                          }}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            sortBy === item.val
                              ? 'bg-indigo-50 text-indigo-705'
                              : 'text-slate-665 hover:bg-slate-50'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Documents Table */}
        <div className="bg-white border border-[#f1f3f9] rounded-3xl shadow-xs overflow-hidden">
          {filteredDocs.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-slate-800 text-sm">No documents found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {documents.length === 0
                  ? 'Create your first invoice, voucher or receipt to build your document history.'
                  : 'No documents match your selected filters. Try clearing your search.'}
              </p>
              {documents.length === 0 && canCreate && (
                <Button icon={PlusCircle} onClick={() => navigate('/documents/new')}>
                  Create First Document
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Desktop View (Table Layout) */}
              <div className="hidden md:block overflow-x-auto min-h-[280px]">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                      <th className="py-3 px-4">Doc</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Customer / Client</th>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4 text-right">Amount</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredDocs.map((doc) => {
                      const partyName = doc.customer?.customerName || doc.paidTo || doc.receivedFrom || 'N/A';
                      const amount = doc.totals?.grandTotal || parseFloat(doc.amount) || 0;
                      const isInvoice = doc.documentType === 'invoice';
                      const isVoucher = doc.documentType === 'voucher';

                      return (
                        <tr key={doc.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3 px-4 font-mono font-semibold text-slate-900 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => setPreviewDoc(doc)}
                              className="hover:text-blue-600 font-mono font-semibold transition-colors cursor-pointer text-left"
                              title="Preview Document"
                            >
                              <span>{doc.documentNumber}</span>
                            </button>
                          </td>
                          <td className="py-3 px-4">
                            <button
                              type="button"
                              onClick={() => setPreviewDoc(doc)}
                              className="hover:scale-105 active:scale-95 transition-transform"
                              title="Preview Document"
                            >
                              <Badge variant={isInvoice ? 'invoice' : isVoucher ? 'voucher' : 'receipt'}>
                                {doc.documentType ? doc.documentType.toUpperCase() : 'INVOICE'}
                              </Badge>
                            </button>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="font-medium text-slate-800 flex items-center gap-1.5">
                              <span>{partyName}</span>
                              {doc.createdBy && (
                                <span className="text-[10px] text-slate-400 font-medium">
                                  (by {doc.createdBy})
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-slate-500 whitespace-nowrap">{formatDate(doc.documentDate)}</td>
                          <td className={`py-3 px-4 text-right font-semibold whitespace-nowrap ${
                            doc.status === 'Paid' ? 'text-emerald-600' : 'text-rose-600'
                          }`}>
                            {formatCurrency(amount, activeCompany?.currency?.split(' ')[1] || '₹')}
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant={doc.status === 'Paid' ? 'success' : doc.status === 'Draft' ? 'default' : 'warning'}>
                              {doc.status || 'Pending'}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => setPreviewDoc(doc)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                                title="Preview Document"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDownload(doc)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition-colors cursor-pointer"
                                title="Download PDF"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>
                              
                              {/* Action Dropdown Menu */}
                              <div className="relative dropdown-container">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveMenuId(activeMenuId === doc.id ? null : doc.id);
                                  }}
                                  className={`p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer ${
                                    activeMenuId === doc.id ? 'bg-slate-100 text-slate-800' : ''
                                  }`}
                                  title="More Actions"
                                >
                                  <MoreVertical className="w-3.5 h-3.5" />
                                </button>
                                
                                {activeMenuId === doc.id && (
                                  <div className="absolute right-0 mt-1 w-32 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-30 animate-in fade-in slide-in-from-top-1 duration-100">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveMenuId(null);
                                        setShareDoc(doc);
                                      }}
                                      className="w-full px-3 py-1.5 text-left text-slate-700 hover:bg-slate-50 hover:text-blue-600 flex items-center gap-2 cursor-pointer transition-colors"
                                    >
                                      <Share2 className="w-3 h-3" />
                                      <span>Share</span>
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveMenuId(null);
                                        handleDuplicate(doc.id);
                                      }}
                                      className="w-full px-3 py-1.5 text-left text-slate-700 hover:bg-slate-50 hover:text-purple-600 flex items-center gap-2 cursor-pointer transition-colors"
                                    >
                                      <Copy className="w-3 h-3" />
                                      <span>Duplicate</span>
                                    </button>
                                    <hr className="my-1 border-slate-100" />
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveMenuId(null);
                                        setDeleteDocId(doc.id);
                                      }}
                                      className="w-full px-3 py-1.5 text-left text-rose-600 hover:bg-rose-50 flex items-center gap-2 cursor-pointer transition-colors"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                      <span>Delete</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile View (Recent Documents Card Inspo) */}
              <div className="md:hidden space-y-4 p-4.5 bg-slate-50/50">
                {filteredDocs.map((doc) => {
                  const partyName = doc.customer?.customerName || doc.paidTo || doc.receivedFrom || 'N/A';
                  const amount = doc.totals?.grandTotal || parseFloat(doc.amount) || 0;
                  const isInvoice = doc.documentType === 'invoice';
                  const isVoucher = doc.documentType === 'voucher';

                  return (
                    <div 
                      key={doc.id}
                      className="p-5 bg-white border border-[#f1f3f9] rounded-3xl flex flex-col gap-4 shadow-xs hover:shadow-md transition-all duration-300 group"
                    >
                      {/* Top Row: Doc ID, Type Badge, and Grand Total */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <button
                            type="button"
                            onClick={() => setPreviewDoc(doc)}
                            className="hover:text-indigo-650 font-mono font-extrabold text-[13px] text-slate-900 truncate text-left transition-colors cursor-pointer"
                          >
                            {doc.documentNumber}
                          </button>
                          <Badge variant={isInvoice ? 'invoice' : isVoucher ? 'voucher' : 'receipt'}>
                            {doc.documentType ? doc.documentType.toUpperCase() : 'INVOICE'}
                          </Badge>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`font-extrabold text-xs transition-colors ${
                            doc.status === 'Paid' ? 'text-emerald-600' : 'text-rose-600'
                          }`}>
                            {formatCurrency(amount, activeCompany?.currency?.split(' ')[1] || '₹')}
                          </p>
                          <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                            {formatDate(doc.documentDate)}
                          </p>
                        </div>
                      </div>

                      {/* Middle: Party Name and Creator */}
                      <div className="flex flex-col gap-1 min-w-0">
                        <div className="font-extrabold text-[13px] text-slate-800 truncate">
                          {partyName}
                        </div>
                        {doc.createdBy && (
                          <div className="text-[10px] text-slate-400 font-semibold">
                            Created by: {doc.createdBy}
                          </div>
                        )}
                      </div>

                      {/* Bottom Row: Status Badge and Action Buttons */}
                      <div className="flex items-center justify-between pt-3 border-t border-slate-100/80">
                        <div>
                          <Badge variant={doc.status === 'Paid' ? 'success' : doc.status === 'Draft' ? 'default' : 'warning'}>
                            {doc.status || 'Pending'}
                          </Badge>
                        </div>

                        <div className="inline-flex items-center gap-1 bg-slate-50 border border-slate-200/50 p-1 rounded-2xl">
                          <button
                            onClick={() => setPreviewDoc(doc)}
                            className="p-2 rounded-xl text-slate-500 hover:text-indigo-650 hover:bg-white active:scale-95 transition-all cursor-pointer"
                            title="Preview Document"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDownload(doc)}
                            className="p-2 rounded-xl text-slate-500 hover:text-emerald-600 hover:bg-white active:scale-95 transition-all cursor-pointer"
                            title="Download PDF"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          
                          {/* More menu on mobile */}
                          <div className="relative dropdown-container">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuId(activeMenuId === doc.id ? null : doc.id);
                              }}
                              className={`p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-white active:scale-95 transition-all cursor-pointer ${
                                activeMenuId === doc.id ? 'bg-white shadow-2xs text-slate-800' : ''
                              }`}
                              title="More Actions"
                            >
                              <MoreVertical className="w-3.5 h-3.5" />
                            </button>
                            
                            {activeMenuId === doc.id && (
                              <div className="absolute right-0 bottom-full mb-2 w-32 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-30 animate-in fade-in slide-in-from-bottom-1 duration-100">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveMenuId(null);
                                    setShareDoc(doc);
                                  }}
                                  className="w-full px-3 py-1.5 text-left text-slate-700 hover:bg-slate-50 hover:text-blue-600 flex items-center gap-2 cursor-pointer transition-colors text-[11px] font-bold"
                                >
                                  <Share2 className="w-3.5 h-3.5" />
                                  <span>Share</span>
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveMenuId(null);
                                    handleDuplicate(doc.id);
                                  }}
                                  className="w-full px-3 py-1.5 text-left text-slate-700 hover:bg-slate-50 hover:text-purple-600 flex items-center gap-2 cursor-pointer transition-colors text-[11px] font-bold"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                  <span>Duplicate</span>
                                </button>
                                <hr className="my-1 border-slate-100" />
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveMenuId(null);
                                    setDeleteDocId(doc.id);
                                  }}
                                  className="w-full px-3 py-1.5 text-left text-rose-600 hover:bg-rose-50 flex items-center gap-2 cursor-pointer transition-colors text-[11px] font-bold"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Delete</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

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
                documents={documents}
              />
            </div>
          </div>
        )}

        {/* Custom Confirmation Popup Modal */}
        <ConfirmModal
          isOpen={!!deleteDocId}
          onClose={() => setDeleteDocId(null)}
          onConfirm={handleConfirmDelete}
          title="Delete Document"
          message="Are you sure you want to delete this document permanently? This action cannot be undone."
          confirmText="Delete Document"
          confirmVariant="danger"
        />

        {/* URL Parameter Preview Modal */}
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
                  <Button variant="outline" onClick={() => {
                    setPreviewDoc(null);
                    navigate('/documents');
                  }}>
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
                <Button variant="outline" icon={Printer} onClick={() => handlePrint(previewDoc)}>
                  Print
                </Button>
                <Button icon={Download} onClick={() => handleDownload(previewDoc)}>
                  Download PDF
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Social Media Share Modal */}
        {shareDoc && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in duration-200">
              <div className="flex justify-between items-center mb-4.5">
                <h3 className="font-bold text-slate-900 text-base">Share Document</h3>
                <button
                  onClick={() => setShareDoc(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

              <p className="text-xs text-slate-500 mb-5 leading-relaxed">
                Choose a platform to share document <span className="font-semibold text-slate-800">#{shareDoc.documentNumber}</span>:
              </p>

              {/* Grid of Social Media icons */}
              <div className="grid grid-cols-4 gap-3 mb-5">
                <button
                  onClick={() => {
                    const shareUrl = `${window.location.origin}/documents?preview=${shareDoc.id}`;
                    const text = `Here is the document #${shareDoc.documentNumber}: ${shareUrl}`;
                    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
                  }}
                  className="flex flex-col items-center gap-1.5 group cursor-pointer"
                >
                  <div className="w-11 h-11 rounded-full bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100 flex items-center justify-center transition-colors shadow-xs border border-emerald-100/30">
                    <MessageSquare className="w-4.5 h-4.5" />
                  </div>
                  <span className="text-[10px] font-semibold text-slate-500">WhatsApp</span>
                </button>

                <button
                  onClick={() => {
                    const shareUrl = `${window.location.origin}/documents?preview=${shareDoc.id}`;
                    const text = `Document #${shareDoc.documentNumber}`;
                    window.open(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(text)}`, '_blank');
                  }}
                  className="flex flex-col items-center gap-1.5 group cursor-pointer"
                >
                  <div className="w-11 h-11 rounded-full bg-sky-50 text-sky-600 group-hover:bg-sky-100 flex items-center justify-center transition-colors shadow-xs border border-sky-100/30">
                    <Send className="w-4.5 h-4.5" />
                  </div>
                  <span className="text-[10px] font-semibold text-slate-500">Telegram</span>
                </button>

                <button
                  onClick={() => {
                    const shareUrl = `${window.location.origin}/documents?preview=${shareDoc.id}`;
                    const subject = `Document #${shareDoc.documentNumber}`;
                    const body = `Hi,\n\nPlease find the document #${shareDoc.documentNumber} here:\n${shareUrl}`;
                    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
                  }}
                  className="flex flex-col items-center gap-1.5 group cursor-pointer"
                >
                  <div className="w-11 h-11 rounded-full bg-rose-50 text-rose-600 group-hover:bg-rose-100 flex items-center justify-center transition-colors shadow-xs border border-rose-100/30">
                    <Mail className="w-4.5 h-4.5" />
                  </div>
                  <span className="text-[10px] font-semibold text-slate-500">Email</span>
                </button>

                <button
                  onClick={() => {
                    const shareUrl = `${window.location.origin}/documents?preview=${shareDoc.id}`;
                    const text = `Document #${shareDoc.documentNumber}`;
                    window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(text)}`, '_blank');
                  }}
                  className="flex flex-col items-center gap-1.5 group cursor-pointer"
                >
                  <div className="w-11 h-11 rounded-full bg-slate-900 text-white group-hover:bg-black flex items-center justify-center transition-colors shadow-xs">
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                  </div>
                  <span className="text-[10px] font-semibold text-slate-500">Twitter / X</span>
                </button>
              </div>

              {/* Direct link copy section */}
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-2.5 flex items-center justify-between gap-3">
                <span className="text-[10px] text-slate-500 font-medium truncate select-all flex-1 pl-1">
                  {`${window.location.origin}/documents?preview=${shareDoc.id}`}
                </span>
                <button
                  onClick={() => {
                    const shareUrl = `${window.location.origin}/documents?preview=${shareDoc.id}`;
                    navigator.clipboard.writeText(shareUrl);
                    showToast('Share link copied to clipboard!', 'success');
                  }}
                  className="bg-indigo-600 text-white hover:bg-indigo-700 px-3 py-1.5 rounded-xl text-[10px] font-bold cursor-pointer active:scale-95 transition-all shrink-0 shadow-xs"
                >
                  Copy Link
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Floating Speed Dial Action Button (FAB) for adding documents - Unique design */}
        {canCreate && (
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
