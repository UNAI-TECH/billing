import React from 'react';
import { formatCurrency, formatDate } from '../utils/formatting';
import { numberToWords } from '../utils/numberToWords';

export const ModernTemplate = ({ company = {}, customer = {}, items = [], totals = {}, document = {} }: any) => {
  const currencySymbol = company.currency ? company.currency.split(' ')[1] || '₹' : '₹';
  const isInvoice = document.documentType === 'invoice' || !document.documentType;
  const isVoucher = document.documentType === 'voucher';
  const isReceipt = document.documentType === 'receipt';

  // Watermark image (Only custom watermark image)
  const watermarkImage = company.watermarkLogo;

  return (
    <div className="bg-white text-slate-800 p-8 text-xs font-sans border border-slate-200 shadow-lg max-w-[210mm] mx-auto min-h-[297mm] flex flex-col justify-between relative overflow-hidden select-none" id="printable-document">
      {/* Top Accent Stripe */}
      <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-blue-600 via-blue-500 to-sky-500 z-10"></div>

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

      <div className="relative z-10">
        {/* Header */}
        <div className="flex justify-between items-start pt-2 mb-8">
          <div className="flex items-center gap-4">
            {company.logo && (
              <div className="p-2 bg-slate-50 border border-slate-100 rounded-xl shadow-xs">
                <img src={company.logo} alt="Company Logo" className="h-12 w-auto max-w-[140px] object-contain" />
              </div>
            )}
            <div>
              <h1 className="text-xl font-bold text-slate-900">{company.companyName || 'Business Name'}</h1>
              <p className="text-blue-600 font-medium text-xs">{company.businessType}</p>
              {company.gstNumber && <p className="text-slate-400 text-[11px] mt-0.5">GSTIN: {company.gstNumber}</p>}
            </div>
          </div>

          <div className="text-right bg-blue-50/60 border border-blue-100 p-3.5 rounded-xl">
            <span className="px-2.5 py-1 bg-blue-600 text-white font-semibold text-[10px] uppercase rounded-md tracking-wider">
              {isVoucher ? (document.voucherType || 'VOUCHER') : isReceipt ? 'RECEIPT' : 'INVOICE'}
            </span>
            <p className="font-bold text-slate-900 text-sm mt-2">{document.documentNumber || 'INV-1001'}</p>
            <p className="text-slate-500 text-[11px] mt-1">Date: <span className="font-semibold text-slate-700">{formatDate(document.documentDate)}</span></p>
            {isInvoice && document.dueDate && (
              <p className="text-slate-500 text-[11px]">Due: <span className="font-semibold text-slate-700">{formatDate(document.dueDate)}</span></p>
            )}
          </div>
        </div>

        {/* Dual Card Billing Info */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-2">Issuer Details</p>
            <p className="font-bold text-slate-900">{company.companyName}</p>
            <p className="text-slate-600 leading-snug">{company.address}</p>
            <p className="text-slate-600">{[company.city, company.state, company.pincode].filter(Boolean).join(', ')}</p>
            {company.email && <p className="text-slate-500 mt-2">✉ {company.email}</p>}
            {company.phone && <p className="text-slate-500">☎ {company.phone}</p>}
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-2">
              {isInvoice ? 'Customer Details' : isVoucher ? 'Paid To' : 'Received From'}
            </p>
            {isInvoice ? (
              <>
                <p className="font-bold text-slate-900">{customer.customerName || 'Customer Name'}</p>
                {customer.companyName && <p className="text-slate-700 font-medium">{customer.companyName}</p>}
                <p className="text-slate-600 leading-snug">{customer.billingAddress}</p>
                <p className="text-slate-600">{[customer.state, customer.pincode].filter(Boolean).join(', ')}</p>
                {customer.gstNumber && <p className="text-slate-500 mt-2">GSTIN: {customer.gstNumber}</p>}
              </>
            ) : (
              <>
                <p className="font-bold text-slate-900">{document.paidTo || document.receivedFrom || customer.customerName || 'N/A'}</p>
                {document.paymentMethod && <p className="text-slate-600 mt-2">Payment Method: <span className="font-medium text-slate-800">{document.paymentMethod}</span></p>}
                {document.referenceNumber && <p className="text-slate-600">Reference: <span className="font-mono text-slate-800">{document.referenceNumber}</span></p>}
              </>
            )}
          </div>
        </div>

        {/* Invoice Item Table */}
        {isInvoice && (
          <div className="mb-8 rounded-xl border border-slate-100 overflow-hidden shadow-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100/80 text-slate-700 text-[10px] uppercase font-bold tracking-wider">
                  <th className="py-3 px-3">#</th>
                  <th className="py-3 px-3">Item Description</th>
                  <th className="py-3 px-3 text-right">Qty</th>
                  <th className="py-3 px-3 text-right">Rate ({currencySymbol})</th>
                  <th className="py-3 px-3 text-right">Tax (%)</th>
                  <th className="py-3 px-3 text-right">Amount ({currencySymbol})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-400">No items</td>
                  </tr>
                ) : (
                  items.map((item, idx) => (
                    <tr key={item.id || idx} className="hover:bg-slate-50/50">
                      <td className="py-3 px-3 text-slate-400 font-mono">{idx + 1}</td>
                      <td className="py-3 px-3">
                        <p className="font-semibold text-slate-900">{item.name}</p>
                        {item.description && <p className="text-slate-500 text-[11px] mt-0.5">{item.description}</p>}
                      </td>
                      <td className="py-3 px-3 text-right font-medium text-slate-800">{item.quantity}</td>
                      <td className="py-3 px-3 text-right text-slate-700">{formatCurrency(item.rate, '').trim()}</td>
                      <td className="py-3 px-3 text-right text-slate-700">{item.taxRate || company.defaultTax || 0}%</td>
                      <td className="py-3 px-3 text-right font-bold text-slate-900">
                        {formatCurrency(item.quantity * item.rate, '').trim()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Voucher / Receipt Details */}
        {(isVoucher || isReceipt) && (
          <div className="bg-slate-50/80 p-5 rounded-xl border border-slate-100 mb-8">
            <h4 className="font-bold text-blue-600 text-xs uppercase tracking-wider mb-2">Particulars / Description</h4>
            <p className="text-slate-800 leading-relaxed text-xs">{document.description || document.notes || 'No notes added.'}</p>
          </div>
        )}

        {/* Totals Summary for Invoice */}
        {isInvoice && (
          <div className="flex justify-end mb-8">
            <div className="w-72 bg-slate-50/60 p-4 rounded-xl border border-slate-100 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal:</span>
                <span className="font-semibold">{formatCurrency(totals.subtotal, currencySymbol)}</span>
              </div>
              {totals.discountAmount > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Discount:</span>
                  <span className="font-semibold text-emerald-600">-{formatCurrency(totals.discountAmount, currencySymbol)}</span>
                </div>
              )}
              {totals.cgst > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>CGST:</span>
                  <span>{formatCurrency(totals.cgst, currencySymbol)}</span>
                </div>
              )}
              {totals.sgst > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>SGST:</span>
                  <span>{formatCurrency(totals.sgst, currencySymbol)}</span>
                </div>
              )}
              {totals.igst > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>IGST:</span>
                  <span>{formatCurrency(totals.igst, currencySymbol)}</span>
                </div>
              )}
              {totals.roundOff !== 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Round Off:</span>
                  <span>{formatCurrency(totals.roundOff, currencySymbol)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-slate-900 bg-blue-600 text-white p-2.5 rounded-lg mt-3">
                <span>Total Amount:</span>
                <span>{formatCurrency(totals.grandTotal, currencySymbol)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Amount in Words */}
        <div className="bg-indigo-50/70 border border-indigo-100 p-3.5 rounded-xl text-[11px] mb-8">
          <span className="font-bold text-indigo-900">Total in Words: </span>
          <span className="font-semibold text-indigo-800">{numberToWords(totals.grandTotal || document.amount || 0, currencySymbol)}</span>
        </div>

        {/* Bank & UPI info */}
        {company.bankDetails?.accountNumber && (
          <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl mb-8 grid grid-cols-2 gap-4 text-[11px]">
            <div>
              <p className="font-bold text-slate-900 mb-1">Direct Bank Wire</p>
              <p className="text-slate-600">Bank: <span className="font-medium text-slate-800">{company.bankDetails.bankName}</span></p>
              <p className="text-slate-600">Holder: <span className="font-medium text-slate-800">{company.bankDetails.accountHolder}</span></p>
              <p className="text-slate-600">Account: <span className="font-mono text-slate-800">{company.bankDetails.accountNumber}</span></p>
              <p className="text-slate-600">IFSC: <span className="font-mono text-slate-800">{company.bankDetails.ifsc}</span></p>
            </div>
            {company.bankDetails.upiId && (
              <div>
                <p className="font-bold text-slate-900 mb-1">Instant UPI Transfer</p>
                <p className="text-slate-600">VPA: <span className="font-mono font-semibold text-blue-600">{company.bankDetails.upiId}</span></p>
              </div>
            )}
          </div>
        )}

        {/* Terms and Conditions */}
        {(document.terms || document.paymentTerms || company.termsAndConditions || company.paymentTerms || document.notes) && (
          <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-xl mb-6 text-[11px]">
            <p className="font-bold text-slate-800 uppercase tracking-wider text-[10px] mb-1">Terms & Conditions</p>
            <p className="whitespace-pre-line text-slate-600 leading-relaxed">{document.terms || document.paymentTerms || company.termsAndConditions || company.paymentTerms || document.notes}</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="relative z-10 pt-6 border-t border-slate-100 flex justify-between items-end mt-auto">
        <div className="text-[10px] text-slate-400">
          <p className="font-semibold text-slate-700">{company.companyName}</p>
          <p>{company.website}</p>
        </div>

        <div className="text-right">
          {document.signature ? (
            <img src={document.signature} alt="Signature" className="h-10 w-auto ml-auto mb-1 object-contain" />
          ) : company.cfoSignature ? (
            <img src={company.cfoSignature} alt="CFO Signature" className="h-10 w-auto ml-auto mb-1 object-contain" />
          ) : (
            <div className="h-10"></div>
          )}
          <p className="font-bold text-slate-900 text-xs">Authorized Signatory</p>
        </div>
      </div>
    </div>
  );
};
