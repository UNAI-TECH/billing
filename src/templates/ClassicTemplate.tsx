import React from 'react';
import { formatCurrency, formatDate } from '../utils/formatting';
import { numberToWords } from '../utils/numberToWords';

export const ClassicTemplate = ({ company = {}, customer = {}, items = [], totals = {}, document = {} }: any) => {
  const currencySymbol = company.currency ? company.currency.split(' ')[1] || '₹' : '₹';
  const isInvoice = document.documentType === 'invoice' || !document.documentType;
  const isVoucher = document.documentType === 'voucher';
  const isReceipt = document.documentType === 'receipt';

  // Watermark image (Only custom watermark image)
  const watermarkImage = company.watermarkLogo;

  return (
    <div className="bg-white text-black p-8 text-xs font-serif border-2 border-black max-w-[210mm] mx-auto min-h-[297mm] flex flex-col justify-between relative overflow-hidden select-none" id="printable-document">
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
        <div className="text-center pb-4 border-b-2 border-black mb-6">
          {company.logo && (
            <img src={company.logo} alt="Company Logo" className="h-12 w-auto mx-auto mb-2 object-contain" />
          )}
          <h1 className="text-2xl font-bold uppercase tracking-wider">{company.companyName || 'COMPANY NAME'}</h1>
          <p className="text-xs font-sans text-slate-700">{company.address}</p>
          <p className="text-xs font-sans text-slate-700">
            {[company.city, company.state, company.pincode, company.country].filter(Boolean).join(', ')}
          </p>
          <p className="text-xs font-sans text-slate-700">
            {[company.phone && `Phone: ${company.phone}`, company.email && `Email: ${company.email}`, company.gstNumber && `GSTIN: ${company.gstNumber}`].filter(Boolean).join(' | ')}
          </p>
        </div>

        {/* Title banner */}
        <div className="text-center my-4 py-1.5 border-y border-black uppercase font-bold text-sm tracking-widest font-sans">
          {isVoucher ? (document.voucherType || 'VOUCHER') : isReceipt ? 'RECEIPT' : 'TAX INVOICE'}
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-2 gap-6 mb-6 font-sans text-xs">
          <div className="border border-black p-3">
            <h3 className="font-bold border-b border-black pb-1 mb-2 uppercase text-[10px] text-slate-700">
              {isInvoice ? 'Billed To (Customer Details)' : isVoucher ? 'Paid To' : 'Received From'}
            </h3>
            {isInvoice ? (
              <>
                <p className="font-bold text-sm">{customer.customerName || 'Customer Name'}</p>
                {customer.companyName && <p className="font-medium">{customer.companyName}</p>}
                <p className="whitespace-pre-line">{customer.billingAddress}</p>
                <p>{[customer.state, customer.pincode].filter(Boolean).join(', ')}</p>
                {customer.gstNumber && <p className="mt-1 font-semibold">GSTIN: {customer.gstNumber}</p>}
              </>
            ) : (
              <>
                <p className="font-bold text-sm">{document.paidTo || document.receivedFrom || customer.customerName || 'N/A'}</p>
                {document.paymentMethod && <p className="mt-1">Method: {document.paymentMethod}</p>}
                {document.referenceNumber && <p>Reference: {document.referenceNumber}</p>}
              </>
            )}
          </div>

          <div className="border border-black p-3 space-y-1">
            <div className="flex justify-between border-b border-slate-300 pb-1">
              <span className="font-semibold">{isVoucher ? 'Voucher No:' : isReceipt ? 'Receipt No:' : 'Invoice No:'}</span>
              <span className="font-bold">{document.documentNumber || 'INV-1001'}</span>
            </div>
            <div className="flex justify-between border-b border-slate-300 pb-1">
              <span className="font-semibold">Date:</span>
              <span>{formatDate(document.documentDate)}</span>
            </div>
            {isInvoice && document.dueDate && (
              <div className="flex justify-between border-b border-slate-300 pb-1">
                <span className="font-semibold">Due Date:</span>
                <span>{formatDate(document.dueDate)}</span>
              </div>
            )}
            {company.panNumber && (
              <div className="flex justify-between">
                <span className="font-semibold">PAN:</span>
                <span>{company.panNumber}</span>
              </div>
            )}
          </div>
        </div>

        {/* Item Table */}
        {isInvoice && (
          <table className="w-full text-left border-collapse border border-black font-sans text-xs mb-6">
            <thead>
              <tr className="bg-slate-100 border-b border-black text-[11px] uppercase font-bold">
                <th className="p-2 border-r border-black w-10 text-center">S.N.</th>
                <th className="p-2 border-r border-black">Particulars / Description</th>
                <th className="p-2 border-r border-black text-right w-16">Qty</th>
                <th className="p-2 border-r border-black text-right w-24">Rate ({currencySymbol})</th>
                <th className="p-2 border-r border-black text-right w-16">Tax %</th>
                <th className="p-2 text-right w-28">Amount ({currencySymbol})</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-slate-500">No items</td>
                </tr>
              ) : (
                items.map((item, idx) => (
                  <tr key={item.id || idx}>
                    <td className="p-2 border-r border-black text-center">{idx + 1}</td>
                    <td className="p-2 border-r border-black">
                      <p className="font-semibold">{item.name}</p>
                      {item.description && <p className="text-[11px] text-slate-600">{item.description}</p>}
                    </td>
                    <td className="p-2 border-r border-black text-right">{item.quantity}</td>
                    <td className="p-2 border-r border-black text-right">{formatCurrency(item.rate, '').trim()}</td>
                    <td className="p-2 border-r border-black text-right">{item.taxRate || company.defaultTax || 0}%</td>
                    <td className="p-2 text-right font-semibold">{formatCurrency(item.quantity * item.rate, '').trim()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}

        {/* Voucher/Receipt particulars */}
        {(isVoucher || isReceipt) && (
          <div className="border border-black p-4 mb-6 font-sans">
            <h4 className="font-bold border-b border-black pb-1 mb-2 uppercase text-xs">Particulars</h4>
            <p className="text-xs leading-relaxed">{document.description || document.notes || 'N/A'}</p>
          </div>
        )}

        {/* Invoice Summary */}
        {isInvoice && (
          <div className="flex justify-end mb-6 font-sans">
            <div className="w-64 border border-black p-3 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>{formatCurrency(totals.subtotal, currencySymbol)}</span>
              </div>
              {totals.discountAmount > 0 && (
                <div className="flex justify-between">
                  <span>Discount:</span>
                  <span>-{formatCurrency(totals.discountAmount, currencySymbol)}</span>
                </div>
              )}
              {totals.cgst > 0 && (
                <div className="flex justify-between">
                  <span>CGST:</span>
                  <span>{formatCurrency(totals.cgst, currencySymbol)}</span>
                </div>
              )}
              {totals.sgst > 0 && (
                <div className="flex justify-between">
                  <span>SGST:</span>
                  <span>{formatCurrency(totals.sgst, currencySymbol)}</span>
                </div>
              )}
              {totals.igst > 0 && (
                <div className="flex justify-between">
                  <span>IGST:</span>
                  <span>{formatCurrency(totals.igst, currencySymbol)}</span>
                </div>
              )}
              {totals.roundOff !== 0 && (
                <div className="flex justify-between">
                  <span>Round Off:</span>
                  <span>{formatCurrency(totals.roundOff, currencySymbol)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-sm border-t border-black pt-1.5 mt-1">
                <span>Grand Total:</span>
                <span>{formatCurrency(totals.grandTotal, currencySymbol)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Amount in words */}
        <div className="border border-black p-2.5 font-sans text-xs mb-6">
          <span className="font-bold">Amount in Words: </span>
          <span>{numberToWords(totals.grandTotal || document.amount || 0, currencySymbol)}</span>
        </div>

        {/* Bank details */}
        {company.bankDetails?.accountNumber && (
          <div className="border border-black p-3 font-sans text-xs mb-6 grid grid-cols-2 gap-4">
            <div>
              <p className="font-bold border-b border-slate-300 pb-0.5 mb-1">Bank Particulars</p>
              <p>Bank: {company.bankDetails.bankName}</p>
              <p>A/c Name: {company.bankDetails.accountHolder}</p>
              <p>A/c No: {company.bankDetails.accountNumber}</p>
              <p>IFSC: {company.bankDetails.ifsc}</p>
            </div>
            {company.bankDetails.upiId && (
              <div>
                <p className="font-bold border-b border-slate-300 pb-0.5 mb-1">UPI Details</p>
                <p>UPI ID: {company.bankDetails.upiId}</p>
              </div>
            )}
          </div>
        )}

        {/* Terms and Conditions */}
        {(document.terms || document.paymentTerms || company.termsAndConditions || company.paymentTerms || document.notes) && (
          <div className="border border-black p-2.5 font-sans text-[11px] mb-6">
            <p className="font-bold border-b border-black pb-0.5 mb-1 uppercase text-[10px]">Terms & Conditions</p>
            <p className="whitespace-pre-line text-slate-700">{document.terms || document.paymentTerms || company.termsAndConditions || company.paymentTerms || document.notes}</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="relative z-10 pt-4 border-t-2 border-black flex justify-between items-end mt-auto font-sans">
        <div className="text-[10px] text-slate-600">
          <p className="font-bold">{company.companyName}</p>
          <p>E. & O.E.</p>
        </div>

        <div className="text-right">
          {document.signature ? (
            <img src={document.signature} alt="Signature" className="h-10 w-auto ml-auto mb-1 object-contain" />
          ) : company.cfoSignature ? (
            <img src={company.cfoSignature} alt="CFO Signature" className="h-10 w-auto ml-auto mb-1 object-contain" />
          ) : (
            <div className="h-10"></div>
          )}
          <div className="border-t border-black pt-1 px-4 inline-block">
            <p className="font-bold text-xs">For {company.companyName}</p>
            <p className="text-[10px] text-slate-600">Authorised Signatory</p>
          </div>
        </div>
      </div>
    </div>
  );
};
