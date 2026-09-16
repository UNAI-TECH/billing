import React from 'react';
import { formatCurrency, formatDate } from '../utils/formatting';
import { numberToWords } from '../utils/numberToWords';

export const MinimalTemplate = ({ company = {}, customer = {}, items = [], totals = {}, document = {} }: any) => {
  const currencySymbol = company.currency ? company.currency.split(' ')[1] || '₹' : '₹';
  const isInvoice = document.documentType === 'invoice' || !document.documentType;
  const isVoucher = document.documentType === 'voucher';
  const isReceipt = document.documentType === 'receipt';

  // Watermark image (Only custom watermark image)
  const watermarkImage = company.watermarkLogo;

  return (
    <div className="bg-white text-slate-800 p-8 text-xs font-sans border border-slate-200 shadow-sm max-w-[210mm] mx-auto min-h-[297mm] flex flex-col justify-between relative overflow-hidden select-none" id="printable-document">
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
        {/* Top Bar / Header */}
        <div className="flex justify-between items-start border-b border-slate-200 pb-6 mb-6">
          <div className="flex items-center gap-4">
            {company.logo && (
              <img src={company.logo} alt="Company Logo" className="h-12 w-auto max-w-[150px] object-contain" />
            )}
            <div>
              <h1 className="text-base font-semibold text-slate-900">{company.companyName || 'Your Business Name'}</h1>
              <p className="text-slate-500">{company.businessType}</p>
              {company.gstNumber && <p className="text-slate-500 mt-0.5">GSTIN: {company.gstNumber}</p>}
            </div>
          </div>
          <div className="text-right">
            <span className="inline-block px-3 py-1 bg-slate-100 font-semibold text-slate-800 tracking-wider text-xs uppercase rounded">
              {isVoucher ? (document.voucherType || 'VOUCHER') : isReceipt ? 'RECEIPT' : 'INVOICE'}
            </span>
            <p className="text-slate-900 font-semibold text-sm mt-2">{document.documentNumber || 'INV-1001'}</p>
            <p className="text-slate-500 text-[11px] mt-0.5">Date: {formatDate(document.documentDate)}</p>
            {isInvoice && document.dueDate && (
              <p className="text-slate-500 text-[11px]">Due Date: {formatDate(document.dueDate)}</p>
            )}
          </div>
        </div>

        {/* Company & Customer Details Grid */}
        <div className="grid grid-cols-2 gap-8 mb-8 pb-6 border-b border-slate-100">
          <div>
            <p className="text-[10px] uppercase font-semibold tracking-wider text-slate-400 mb-1">From</p>
            <p className="font-semibold text-slate-900">{company.companyName}</p>
            <p className="text-slate-600 whitespace-pre-line">{company.address}</p>
            <p className="text-slate-600">{[company.city, company.state, company.pincode, company.country].filter(Boolean).join(', ')}</p>
            {company.email && <p className="text-slate-500 mt-1">Email: {company.email}</p>}
            {company.phone && <p className="text-slate-500">Phone: {company.phone}</p>}
          </div>

          <div>
            {isInvoice && (
              <>
                <p className="text-[10px] uppercase font-semibold tracking-wider text-slate-400 mb-1">Billed To</p>
                <p className="font-semibold text-slate-900">{customer.customerName || 'Customer Name'}</p>
                {customer.companyName && <p className="text-slate-600">{customer.companyName}</p>}
                <p className="text-slate-600 whitespace-pre-line">{customer.billingAddress}</p>
                <p className="text-slate-600">{[customer.state, customer.pincode].filter(Boolean).join(', ')}</p>
                {customer.gstNumber && <p className="text-slate-500 mt-1">GSTIN: {customer.gstNumber}</p>}
                {customer.email && <p className="text-slate-500">Email: {customer.email}</p>}
              </>
            )}

            {(isVoucher || isReceipt) && (
              <>
                <p className="text-[10px] uppercase font-semibold tracking-wider text-slate-400 mb-1">
                  {isVoucher ? 'Party / Paid To' : 'Received From'}
                </p>
                <p className="font-semibold text-slate-900">{document.paidTo || document.receivedFrom || customer.customerName || 'N/A'}</p>
                {document.paymentMethod && <p className="text-slate-600 mt-1">Payment Method: {document.paymentMethod}</p>}
                {document.referenceNumber && <p className="text-slate-600">Ref #: {document.referenceNumber}</p>}
              </>
            )}
          </div>
        </div>

        {/* Invoice Item Table */}
        {isInvoice && (
          <table className="w-full text-left mb-6 border-collapse">
            <thead>
              <tr className="border-b border-slate-300 text-slate-500 text-[10px] uppercase font-semibold tracking-wider">
                <th className="py-2.5 px-2">#</th>
                <th className="py-2.5 px-2">Item Description</th>
                <th className="py-2.5 px-2 text-right">Qty</th>
                <th className="py-2.5 px-2 text-right">Rate ({currencySymbol})</th>
                <th className="py-2.5 px-2 text-right">Tax (%)</th>
                <th className="py-2.5 px-2 text-right">Amount ({currencySymbol})</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-slate-400">No items added</td>
                </tr>
              ) : (
                items.map((item, idx) => (
                  <tr key={item.id || idx}>
                    <td className="py-2.5 px-2 text-slate-400">{idx + 1}</td>
                    <td className="py-2.5 px-2">
                      <p className="font-medium text-slate-900">{item.name}</p>
                      {item.description && <p className="text-slate-500 text-[11px]">{item.description}</p>}
                    </td>
                    <td className="py-2.5 px-2 text-right text-slate-700">{item.quantity}</td>
                    <td className="py-2.5 px-2 text-right text-slate-700">{formatCurrency(item.rate, '').trim()}</td>
                    <td className="py-2.5 px-2 text-right text-slate-700">{item.taxRate || company.defaultTax || 0}%</td>
                    <td className="py-2.5 px-2 text-right font-medium text-slate-900">
                      {formatCurrency(item.quantity * item.rate, '').trim()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}

        {/* Voucher / Receipt Main Block */}
        {(isVoucher || isReceipt) && (
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-6">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Description / Purpose</p>
            <p className="text-slate-800 leading-relaxed text-xs">{document.description || document.notes || 'No description provided.'}</p>
            <div className="mt-4 pt-3 border-t border-slate-200 flex justify-between items-center">
              <span className="font-semibold text-slate-700">Total Amount:</span>
              <span className="text-base font-bold text-slate-900">{formatCurrency(totals.grandTotal || document.amount || 0, currencySymbol)}</span>
            </div>
          </div>
        )}

        {/* Totals Summary for Invoice */}
        {isInvoice && (
          <div className="flex justify-end mb-6">
            <div className="w-64 space-y-1.5 text-right text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal:</span>
                <span>{formatCurrency(totals.subtotal, currencySymbol)}</span>
              </div>

              {totals.discountAmount > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Discount:</span>
                  <span>-{formatCurrency(totals.discountAmount, currencySymbol)}</span>
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

              <div className="flex justify-between font-bold text-sm text-slate-900 border-t border-slate-300 pt-2 mt-2">
                <span>Grand Total:</span>
                <span>{formatCurrency(totals.grandTotal, currencySymbol)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Amount in Words */}
        <div className="bg-slate-50 p-3 rounded text-[11px] mb-6 border border-slate-100">
          <span className="font-semibold text-slate-500">Amount in Words: </span>
          <span className="font-medium text-slate-800">{numberToWords(totals.grandTotal || document.amount || 0, currencySymbol)}</span>
        </div>

        {/* Payment & Bank Details */}
        {company.bankDetails?.accountNumber && (
          <div className="mb-6 grid grid-cols-2 gap-4 text-[11px] bg-slate-50/50 p-3 rounded border border-slate-100">
            <div>
              <p className="font-semibold text-slate-700 mb-1">Bank Payment Details</p>
              <p className="text-slate-600">Bank: {company.bankDetails.bankName}</p>
              <p className="text-slate-600">A/c Holder: {company.bankDetails.accountHolder}</p>
              <p className="text-slate-600">A/c No: {company.bankDetails.accountNumber}</p>
              <p className="text-slate-600">IFSC: {company.bankDetails.ifsc}</p>
            </div>
            {company.bankDetails.upiId && (
              <div>
                <p className="font-semibold text-slate-700 mb-1">UPI Direct Payment</p>
                <p className="text-slate-600">UPI ID: {company.bankDetails.upiId}</p>
              </div>
            )}
          </div>
        )}

        {/* Terms and Notes */}
        {(document.notes || company.notes || document.terms || document.paymentTerms || company.termsAndConditions || company.paymentTerms) && (
          <div className="text-[11px] text-slate-500 space-y-1 mb-6">
            {document.notes && <p><span className="font-medium text-slate-700">Notes:</span> {document.notes}</p>}
            {(document.terms || document.paymentTerms || company.termsAndConditions || company.paymentTerms) && (
              <p className="whitespace-pre-line"><span className="font-medium text-slate-700">Terms & Conditions:</span> {document.terms || document.paymentTerms || company.termsAndConditions || company.paymentTerms}</p>
            )}
          </div>
        )}
      </div>

      {/* Authorized Signature Bottom */}
      <div className="relative z-10 pt-6 border-t border-slate-200 flex justify-between items-end mt-auto">
        <div className="text-[10px] text-slate-400">
          This is a computer generated document.
        </div>
        <div className="text-right">
          {document.signature ? (
            <img src={document.signature} alt="Signature" className="h-10 w-auto ml-auto mb-1 object-contain" />
          ) : company.cfoSignature ? (
            <img src={company.cfoSignature} alt="CFO Signature" className="h-10 w-auto ml-auto mb-1 object-contain" />
          ) : (
            <div className="h-10"></div>
          )}
          <p className="font-semibold text-slate-800 text-xs border-t border-slate-300 pt-1">Authorized Signatory</p>
          <p className="text-[10px] text-slate-500">{company.companyName}</p>
        </div>
      </div>
    </div>
  );
};
