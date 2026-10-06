import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '../components/layout/MainLayout';
import { useCompany } from '../contexts/CompanyContext';
import { useToast } from '../components/ui/Toast';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { 
  getCompanyCustomers, 
  upsertCompanyCustomer, 
  deleteCompanyCustomer, 
  Customer 
} from '../services/db';
import { 
  Contact, 
  UserPlus, 
  Search, 
  Building2, 
  Mail, 
  Phone, 
  MapPin, 
  FileText, 
  Edit2, 
  Trash2, 
  Plus, 
  X, 
  Check, 
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  User,
  Hash
} from 'lucide-react';

export const Customers = () => {
  const { activeCompany } = useCompany();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);

  // Form Fields
  const [customerName, setCustomerName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [sameAsBilling, setSameAsBilling] = useState(true);
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');
  const [formError, setFormError] = useState('');

  // Delete State
  const [deleteCustomerId, setDeleteCustomerId] = useState<string | null>(null);

  // Load Customers
  const loadCustomers = async () => {
    if (!activeCompany?.id) return;
    try {
      setLoading(true);
      const list = await getCompanyCustomers(activeCompany.id);
      setCustomers(list);
    } catch (e) {
      console.error(e);
      showToast('Failed to load customers.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, [activeCompany?.id]);

  const handleOpenAddModal = () => {
    setModalMode('add');
    setEditingCustomerId(null);
    setCustomerName('');
    setCompanyName('');
    setGstNumber('');
    setEmail('');
    setPhone('');
    setBillingAddress('');
    setShippingAddress('');
    setSameAsBilling(true);
    setState('');
    setPincode('');
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (c: Customer) => {
    setModalMode('edit');
    setEditingCustomerId(c.id);
    setCustomerName(c.customerName || '');
    setCompanyName(c.companyName || '');
    setGstNumber(c.gstNumber || '');
    setEmail(c.email || '');
    setPhone(c.phone || '');
    setBillingAddress(c.billingAddress || '');
    setShippingAddress(c.shippingAddress || '');
    setSameAsBilling(c.sameAsBilling ?? true);
    setState(c.state || '');
    setPincode(c.pincode || '');
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      setFormError('Customer Name is required.');
      return;
    }

    if (!activeCompany?.id) return;

    try {
      const payload: Partial<Customer> = {
        id: modalMode === 'edit' && editingCustomerId ? editingCustomerId : undefined,
        customerName: customerName.trim(),
        companyName: companyName.trim(),
        gstNumber: gstNumber.trim().toUpperCase(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        billingAddress: billingAddress.trim(),
        shippingAddress: sameAsBilling ? billingAddress.trim() : shippingAddress.trim(),
        sameAsBilling,
        state: state.trim(),
        pincode: pincode.trim()
      };

      const updated = await upsertCompanyCustomer(activeCompany.id, payload);
      setCustomers(updated);
      setIsModalOpen(false);
      showToast(
        modalMode === 'add' 
          ? `Customer "${payload.customerName}" added successfully!` 
          : `Customer "${payload.customerName}" updated successfully!`,
        'success'
      );
    } catch (err) {
      console.error(err);
      showToast('Failed to save customer.', 'error');
    }
  };

  const handleDeleteCustomer = async () => {
    if (!activeCompany?.id || !deleteCustomerId) return;
    try {
      const updated = await deleteCompanyCustomer(activeCompany.id, deleteCustomerId);
      setCustomers(updated);
      setDeleteCustomerId(null);
      showToast('Customer deleted successfully.', 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to delete customer.', 'error');
    }
  };

  // Filtered List
  const filteredCustomers = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return customers;
    return customers.filter(c => 
      c.customerName?.toLowerCase().includes(q) ||
      c.companyName?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.phone?.includes(q) ||
      c.gstNumber?.toLowerCase().includes(q) ||
      c.state?.toLowerCase().includes(q) ||
      c.billingAddress?.toLowerCase().includes(q)
    );
  }, [customers, searchTerm]);

  // Metrics
  const stats = useMemo(() => {
    const total = customers.length;
    const withCompany = customers.filter(c => c.companyName?.trim()).length;
    const withGst = customers.filter(c => c.gstNumber?.trim()).length;
    const withEmail = customers.filter(c => c.email?.trim()).length;
    return { total, withCompany, withGst, withEmail };
  }, [customers]);

  return (
    <MainLayout title="Customers">
      <div className="space-y-6 font-sans">
        
        {/* Top Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-4.5 border border-slate-100 shadow-xs flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-100/50 flex items-center justify-center text-indigo-600 shrink-0">
              <Contact className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Customers</p>
              <h3 className="text-xl font-black text-slate-900 mt-0.5">{stats.total}</h3>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4.5 border border-slate-100 shadow-xs flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100/50 flex items-center justify-center text-blue-600 shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Corporate Clients</p>
              <h3 className="text-xl font-black text-slate-900 mt-0.5">{stats.withCompany}</h3>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4.5 border border-slate-100 shadow-xs flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-100/50 flex items-center justify-center text-emerald-600 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">GST Registered</p>
              <h3 className="text-xl font-black text-slate-900 mt-0.5">{stats.withGst}</h3>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4.5 border border-slate-100 shadow-xs flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-purple-50 border border-purple-100/50 flex items-center justify-center text-purple-600 shrink-0">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">With Email</p>
              <h3 className="text-xl font-black text-slate-900 mt-0.5">{stats.withEmail}</h3>
            </div>
          </div>
        </div>

        {/* Top Controls Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search customers by name, company, email, phone, GSTIN..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200/80 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-xs"
            />
          </div>

          <Button 
            onClick={handleOpenAddModal}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl px-5 py-2.5 text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer shrink-0"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Customer</span>
          </Button>
        </div>

        {/* Loading / Empty / Grid Views */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-100">
            <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mb-3" />
            <p className="text-xs font-bold text-slate-400">Loading customer directory...</p>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-100 text-center p-6">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center mb-4">
              <Contact className="w-8 h-8" />
            </div>
            <h3 className="font-extrabold text-slate-800 text-sm">No Customers Found</h3>
            <p className="text-xs text-slate-400 max-w-sm mt-1">
              {searchTerm 
                ? 'No customer matched your search criteria.' 
                : 'Add client profiles here to automatically auto-fill their billing & tax info during invoice creation.'}
            </p>
            {!searchTerm && (
              <Button 
                onClick={handleOpenAddModal}
                className="mt-5 flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-4 py-2 text-xs font-bold transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Add Your First Customer</span>
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredCustomers.map((c) => {
              return (
                <div 
                  key={c.id}
                  className="bg-white rounded-2xl border border-slate-200/60 p-5 hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-50/50 transition-all flex flex-col justify-between space-y-4 group"
                >
                  {/* Card Header */}
                  <div>
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-150 flex items-center justify-center text-indigo-600 font-extrabold text-sm shrink-0">
                          {c.customerName ? c.customerName.charAt(0).toUpperCase() : 'C'}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-extrabold text-slate-900 text-sm truncate group-hover:text-indigo-650 transition-colors" title={c.customerName}>
                            {c.customerName}
                          </h4>
                          {c.companyName ? (
                            <p className="text-[11px] text-slate-500 font-semibold truncate flex items-center gap-1 mt-0.5">
                              <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                              <span>{c.companyName}</span>
                            </p>
                          ) : (
                            <p className="text-[10px] text-slate-400 font-medium">Individual Customer</p>
                          )}
                        </div>
                      </div>

                      {c.gstNumber && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 text-[9px] font-bold shrink-0">
                          GSTIN
                        </span>
                      )}
                    </div>

                    {/* Details list */}
                    <div className="mt-4 pt-3.5 border-t border-slate-100 space-y-2 text-xs">
                      {c.email && (
                        <div className="flex items-center gap-2 text-slate-600 truncate" title={c.email}>
                          <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{c.email}</span>
                        </div>
                      )}

                      {c.phone && (
                        <div className="flex items-center gap-2 text-slate-600">
                          <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{c.phone}</span>
                        </div>
                      )}

                      {c.gstNumber && (
                        <div className="flex items-center gap-2 text-slate-600 font-mono text-[11px]">
                          <Hash className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{c.gstNumber}</span>
                        </div>
                      )}

                      {(c.billingAddress || c.state || c.pincode) && (
                        <div className="flex items-start gap-2 text-slate-500 text-[11px]">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                          <span className="line-clamp-2">
                            {[c.billingAddress, c.state, c.pincode].filter(Boolean).join(', ')}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      onClick={() => navigate(`/documents/new?type=invoice&customerId=${c.id}`)}
                      className="inline-flex items-center gap-1.5 text-indigo-600 hover:text-indigo-700 font-bold text-xs bg-indigo-50/70 hover:bg-indigo-100/70 px-3 py-1.5 rounded-xl transition-all cursor-pointer shadow-2xs"
                      title="Create a new invoice for this customer"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Create Invoice</span>
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEditModal(c)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                        title="Edit Customer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteCustomerId(c.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Delete Customer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Add/Edit Customer Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
            <div 
              className="absolute inset-0 cursor-pointer" 
              onClick={() => setIsModalOpen(false)}
            />
            <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200 font-sans">
              
              {/* Header */}
              <div className="flex items-center justify-between p-5 pb-4 border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                    <Contact className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-base leading-none">
                      {modalMode === 'add' ? 'Add New Customer' : 'Edit Customer'}
                    </h3>
                    <p className="text-[10px] text-slate-400 font-semibold mt-1">
                      Customer details will automatically auto-fill in invoice creation
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="w-7 h-7 rounded-lg border border-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Scrollable Form Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                <form onSubmit={handleSaveCustomer} className="space-y-4">
                  {formError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-600 text-xs font-semibold">
                      {formError}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Customer Name */}
                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1.5">
                        Customer Name <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          required
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          placeholder="e.g. John Doe / TechCorp"
                          className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none text-sm transition-all"
                        />
                      </div>
                    </div>

                    {/* Company Name */}
                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1.5">Company Name</label>
                      <div className="relative">
                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                          placeholder="e.g. TechCorp Solutions"
                          className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none text-sm transition-all"
                        />
                      </div>
                    </div>

                    {/* GSTIN */}
                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1.5">GSTIN / Tax ID</label>
                      <div className="relative">
                        <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          value={gstNumber}
                          onChange={(e) => setGstNumber(e.target.value.toUpperCase())}
                          placeholder="e.g. 27ABCDE1234F1Z5"
                          className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none text-sm font-mono uppercase transition-all"
                        />
                      </div>
                    </div>

                    {/* Email */}
                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1.5">Email Address</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="e.g. client@techcorp.com"
                          className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none text-sm transition-all"
                        />
                      </div>
                    </div>

                    {/* Phone */}
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-800 mb-1.5">Phone Number</label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="e.g. +91 98765 43210"
                          className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none text-sm transition-all"
                        />
                      </div>
                    </div>

                    {/* Billing Address */}
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-800 mb-1.5">Billing Address</label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                        <textarea
                          rows={2}
                          value={billingAddress}
                          onChange={(e) => setBillingAddress(e.target.value)}
                          placeholder="Street address, Suite, Office number..."
                          className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none text-sm transition-all resize-none"
                        />
                      </div>
                    </div>

                    {/* State */}
                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1.5">State</label>
                      <input
                        type="text"
                        value={state}
                        onChange={(e) => setState(e.target.value)}
                        placeholder="e.g. Maharashtra"
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none text-sm transition-all"
                      />
                    </div>

                    {/* Pincode */}
                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1.5">Pincode</label>
                      <input
                        type="text"
                        value={pincode}
                        onChange={(e) => setPincode(e.target.value)}
                        placeholder="e.g. 400001"
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none text-sm transition-all"
                      />
                    </div>

                    {/* Same as billing checkbox */}
                    <div className="sm:col-span-2 flex items-center gap-2 pt-1">
                      <input
                        type="checkbox"
                        id="modalSameAsBilling"
                        checked={sameAsBilling}
                        onChange={(e) => setSameAsBilling(e.target.checked)}
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
                      />
                      <label htmlFor="modalSameAsBilling" className="text-xs text-slate-700 font-medium cursor-pointer">
                        Shipping address same as billing
                      </label>
                    </div>

                    {/* Shipping Address (if different) */}
                    {!sameAsBilling && (
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-bold text-slate-800 mb-1.5">Shipping Address</label>
                        <textarea
                          rows={2}
                          value={shippingAddress}
                          onChange={(e) => setShippingAddress(e.target.value)}
                          placeholder="Separate shipping destination address..."
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none text-sm transition-all resize-none"
                        />
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsModalOpen(false)}
                      className="rounded-xl px-4 py-2 text-xs font-bold cursor-pointer"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-5 py-2 text-xs font-bold cursor-pointer"
                    >
                      {modalMode === 'add' ? 'Save Customer' : 'Update Customer'}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        <ConfirmModal
          isOpen={!!deleteCustomerId}
          onClose={() => setDeleteCustomerId(null)}
          onConfirm={handleDeleteCustomer}
          title="Delete Customer"
          message="Are you sure you want to remove this customer from your directory? This will not alter any previously generated invoices."
          confirmText="Delete Customer"
          confirmVariant="danger"
        />

      </div>
    </MainLayout>
  );
};
