import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MainLayout } from '../components/layout/MainLayout';
import { useCompany, defaultCompanyState } from '../contexts/CompanyContext';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Button } from '../components/ui/Button';
import { LogoUploader } from '../components/company/LogoUploader';
import { validateEmail, validateGST, validatePAN, validatePhone } from '../utils/formatting';
import { Save, ArrowLeft, Building2, Landmark, Sliders, Palette } from 'lucide-react';
import { useToast } from '../components/ui/Toast';
import { updateCompanyDocumentsTerms } from '../services/db';

export const CompanyEdit = () => {
  const { companies, saveCompanyProfile } = useCompany();
  const navigate = useNavigate();
  const { id } = useParams();
  const { showToast } = useToast();

  const [formData, setFormData] = useState(defaultCompanyState);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [syncToExistingInvoices, setSyncToExistingInvoices] = useState(true);

  useEffect(() => {
    if (id && id !== 'new') {
      const existing = companies.find(c => c.id === id);
      if (existing) {
        setFormData(existing);
      }
    }
  }, [id, companies]);

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const updateBankField = (field, value) => {
    setFormData(prev => ({
      ...prev,
      bankDetails: {
        ...prev.bankDetails,
        [field]: value
      }
    }));
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!formData.companyName.trim()) errs.companyName = 'Company Name is required.';
    if (formData.email && !validateEmail(formData.email)) errs.email = 'Invalid email address.';
    if (formData.gstNumber && !validateGST(formData.gstNumber)) errs.gstNumber = 'Invalid GSTIN format.';
    if (formData.panNumber && !validatePAN(formData.panNumber)) errs.panNumber = 'Invalid PAN format.';
    if (formData.phone && !validatePhone(formData.phone)) errs.phone = 'Phone number must be exactly 10 digits.';

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) {
      showToast('Please fix form errors.', 'error');
      return;
    }

    try {
      const saved = await saveCompanyProfile(formData);
      if (syncToExistingInvoices && saved?.id) {
        const terms = formData.paymentTerms || (formData as any).termsAndConditions || '';
        await updateCompanyDocumentsTerms(saved.id, terms);
      }
      showToast('Company profile saved and invoices updated!', 'success');
      navigate('/settings');
    } catch (err) {
      console.error(err);
      showToast('Failed to save company profile.', 'error');
    }
  };

  return (
    <MainLayout title={id === 'new' ? 'New Company Profile' : 'Edit Company Profile'}>
      <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between bg-white p-6 rounded-3xl border border-[#f1f3f9] shadow-xs">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/settings')}
              className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="font-extrabold text-slate-900 text-sm md:text-base tracking-tight">
                {id === 'new' ? 'Create Business Profile' : `Edit ${formData.companyName}`}
              </h1>
              <p className="text-[11px] font-semibold text-slate-500 mt-0.5">Configure company details, logo, watermark, brand theme color, and document defaults.</p>
            </div>
          </div>

          <Button type="submit" icon={Save}>
            Save Changes
          </Button>
        </div>

        {/* Business Details Section */}
        <div className="bg-white p-6 rounded-3xl border border-[#f1f3f9] shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Building2 className="w-4 h-4 text-blue-600" />
            <h2 className="font-bold text-slate-900 text-sm">Business Details</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Company Name"
              required
              value={formData.companyName}
              onChange={(e) => updateField('companyName', e.target.value)}
              error={errors.companyName}
            />

            <Select
              label="Business Type"
              value={formData.businessType}
              onChange={(e) => updateField('businessType', e.target.value)}
            >
              <option value="Private Limited">Private Limited</option>
              <option value="Proprietorship">Proprietorship</option>
              <option value="Partnership">Partnership</option>
              <option value="LLP">Limited Liability Partnership (LLP)</option>
              <option value="Freelancer">Freelancer / Independent</option>
              <option value="NGO">NGO / Non-Profit</option>
              <option value="Other">Other</option>
            </Select>
          </div>

          {/* Logo, Watermark & Signature Uploaders */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <LogoUploader
              label="Company Header Logo"
              value={formData.logo}
              onChange={(val) => updateField('logo', val)}
            />

            <LogoUploader
              label="Document Watermark Image (Optional)"
              value={formData.watermarkLogo}
              onChange={(val) => updateField('watermarkLogo', val)}
            />

            <LogoUploader
              label="CFO Authorized Signature (Optional)"
              value={(formData as any).cfoSignature || ''}
              onChange={(val) => updateField('cfoSignature', val)}
            />
          </div>
          <p className="text-[11px] text-slate-500 italic">
            * If no custom watermark image is uploaded, your main Company Header Logo will automatically be used as the background watermark on all invoices, vouchers, and receipts. CFO signature will automatically be stamped on all bills, invoices, receipts, vouchers, ledger statements, and payslips.
          </p>

          {/* Theme Color Picker */}
          <div className="pt-2 border-t border-slate-100 space-y-2">
            <label className="block text-xs font-semibold text-slate-800 flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-orange-500" />
              <span>Company Brand Theme Color</span>
            </label>
            <div className="flex items-center gap-3">
              <input
                id="themeColor"
                name="themeColor"
                type="color"
                value={formData.themeColor || '#f97316'}
                onChange={(e) => updateField('themeColor', e.target.value)}
                className="w-9 h-9 p-0 border border-slate-300 rounded-lg cursor-pointer shadow-2xs"
              />
              <span className="font-mono text-xs text-slate-700 bg-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-200">
                {formData.themeColor || '#f97316'}
              </span>
              <p className="text-[11px] text-slate-500">Accent color used for PDF elements, badges, and template highlights.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="GST Number (GSTIN)"
              value={formData.gstNumber}
              onChange={(e) => updateField('gstNumber', e.target.value.toUpperCase())}
              error={errors.gstNumber}
            />
            <Input
              label="PAN Number"
              value={formData.panNumber}
              onChange={(e) => updateField('panNumber', e.target.value.toUpperCase())}
              error={errors.panNumber}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="Email"
              type="email"
              value={formData.email}
              onChange={(e) => updateField('email', e.target.value)}
              error={errors.email}
            />
            <Input
              label="Phone"
              value={formData.phone}
              onChange={(e) => updateField('phone', e.target.value)}
              error={errors.phone}
            />
            <Input
              label="Website"
              value={formData.website}
              onChange={(e) => updateField('website', e.target.value)}
            />
          </div>

          <Input
            label="Address"
            value={formData.address}
            onChange={(e) => updateField('address', e.target.value)}
          />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Input
              label="City"
              value={formData.city}
              onChange={(e) => updateField('city', e.target.value)}
            />
            <Input
              label="State"
              value={formData.state}
              onChange={(e) => updateField('state', e.target.value)}
            />
            <Input
              label="Country"
              value={formData.country}
              onChange={(e) => updateField('country', e.target.value)}
            />
            <Input
              label="Pincode"
              value={formData.pincode}
              onChange={(e) => updateField('pincode', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
            <Input
              label="CIN"
              value={formData.cin}
              onChange={(e) => updateField('cin', e.target.value)}
            />
            <Input
              label="UDYAM Number"
              value={formData.udyamNumber}
              onChange={(e) => updateField('udyamNumber', e.target.value)}
            />
          </div>
        </div>

        {/* Bank Details Section */}
        <div className="bg-white p-6 rounded-3xl border border-[#f1f3f9] shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Landmark className="w-4 h-4 text-blue-600" />
            <h2 className="font-bold text-slate-900 text-sm">Bank & Payment Account</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Bank Name"
              value={formData.bankDetails?.bankName || ''}
              onChange={(e) => updateBankField('bankName', e.target.value)}
            />
            <Input
              label="Account Holder Name"
              value={formData.bankDetails?.accountHolder || ''}
              onChange={(e) => updateBankField('accountHolder', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="Account Number"
              value={formData.bankDetails?.accountNumber || ''}
              onChange={(e) => updateBankField('accountNumber', e.target.value)}
            />
            <Input
              label="IFSC Code"
              value={formData.bankDetails?.ifsc || ''}
              onChange={(e) => updateBankField('ifsc', e.target.value.toUpperCase())}
            />
            <Input
              label="Branch Name"
              value={formData.bankDetails?.branch || ''}
              onChange={(e) => updateBankField('branch', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="UPI ID"
              value={formData.bankDetails?.upiId || ''}
              onChange={(e) => updateBankField('upiId', e.target.value)}
            />
            <Select
              label="Account Type"
              value={formData.bankDetails?.accountType || 'Saving'}
              onChange={(e) => {
                const type = e.target.value;
                const limit = type === 'Current' ? 200000 : 100000;
                setFormData(prev => ({
                  ...prev,
                  bankDetails: {
                    ...prev.bankDetails,
                    accountType: type,
                    dailyLimit: limit
                  }
                }));
              }}
            >
              <option value="Saving">Saving Account</option>
              <option value="Current">Current Account</option>
            </Select>
            <Input
              label="Daily Transaction Limit (₹)"
              type="number"
              value={formData.bankDetails?.dailyLimit || 100000}
              onChange={(e) => updateBankField('dailyLimit', parseFloat(e.target.value) || 0)}
            />
          </div>
        </div>

        {/* Defaults & Template Section */}
        <div className="bg-white p-6 rounded-3xl border border-[#f1f3f9] shadow-xs space-y-6">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Sliders className="w-4 h-4 text-blue-600" />
            <h2 className="font-bold text-slate-900 text-sm">Document Defaults & Preferences</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="Invoice Prefix"
              value={formData.invoicePrefix}
              onChange={(e) => updateField('invoicePrefix', e.target.value)}
            />
            <Input
              label="Invoice Counter"
              type="number"
              value={formData.invoiceStartNumber}
              onChange={(e) => updateField('invoiceStartNumber', parseInt(e.target.value, 10) || 1001)}
            />
            <Select
              label="Currency"
              value={formData.currency}
              onChange={(e) => updateField('currency', e.target.value)}
            >
              <option value="INR ₹">INR ₹ (Indian Rupee)</option>
              <option value="USD $">USD $ (US Dollar)</option>
              <option value="EUR €">EUR € (Euro)</option>
              <option value="GBP £">GBP £ (British Pound)</option>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Default Tax Rate (%)"
              value={formData.defaultTax || 18}
              onChange={(e) => updateField('defaultTax', parseFloat(e.target.value) || 0)}
            >
              <option value="5">5%</option>
              <option value="12">12%</option>
              <option value="18">18%</option>
              <option value="28">28%</option>
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-3 pt-1">
            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1">
                Terms & Conditions (Printed on Invoices & Bills)
              </label>
              <textarea
                rows={4}
                value={formData.paymentTerms || (formData as any).termsAndConditions || ''}
                onChange={(e) => {
                  updateField('paymentTerms', e.target.value);
                  updateField('termsAndConditions', e.target.value);
                }}
                placeholder="1. Payment due within 15 days of invoice date.&#10;2. Goods once sold will not be taken back.&#10;3. Subject to local jurisdiction."
                className="w-full px-3.5 py-2.5 text-xs text-slate-800 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white leading-relaxed resize-y font-sans shadow-2xs"
              />
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-2">
                <p className="text-[11px] text-slate-500">
                  This text appears under <span className="font-semibold text-slate-700">"Terms & Condition"</span> on all company invoices.
                </p>
                <label className="flex items-center gap-2 cursor-pointer select-none text-[11px] text-slate-700 font-medium">
                  <input
                    type="checkbox"
                    checked={syncToExistingInvoices}
                    onChange={(e) => setSyncToExistingInvoices(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <span>Apply to existing invoices also</span>
                </label>
              </div>
            </div>
          </div>


        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={() => navigate('/settings')}>
            Cancel
          </Button>
          <Button type="submit" icon={Save}>
            Save Business Profile
          </Button>
        </div>
      </form>
    </MainLayout>
  );
};
