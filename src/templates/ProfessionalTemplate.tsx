import React from 'react';
import { formatCurrency, formatDate } from '../utils/formatting';
import { numberToWords } from '../utils/numberToWords';

export const ProfessionalTemplate = ({ company = {}, customer = {}, items = [], totals = {}, document = {} }: any) => {
  const currencySymbol = company.currency ? company.currency.split(' ')[1] || '₹' : '₹';
  const isInvoice = document.documentType === 'invoice' || !document.documentType;
  const isVoucher = document.documentType === 'voucher';
  const isReceipt = document.documentType === 'receipt';

  // Watermark image (Only custom watermark image)
  const watermarkImage = company.watermarkLogo;

  return (
    <div className="bg-white text-slate-900 p-8 text-xs font-sans border border-slate-200 shadow-md max-w-[210mm] mx-auto min-h-[297mm] flex flex-col justify-between relative overflow-hidden select-none" id="printable-document">
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
        {/* Top Header Banner */}
        <div className="flex justify-between items-center bg-slate-900 text-white p-6 rounded-t-lg mb-6">
          <div className="flex items-center gap-4">
            {company.logo ? (
              <img src={company.logo} alt="Company Logo" className="h-12 w-auto max-w-[140px] bg-white p-1 rounded object-contain" />
            ) : null}
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white">{company.companyName || 'BUSINESS NAME'}</h1>
              <p className="text-slate-300 text-[11px]">{company.email} | {company.phone}</p>
            </div>
          </div>
          <div className="text-right">
            <h2 className="text-xl font-bold tracking-wider text-blue-400 uppercase">
              {isVoucher ? (document.voucherType || 'VOUCHER') : isReceipt ? 'RECEIPT' : 'INVOICE'}
            </h2>
            <p className="text-slate-200 font-mono mt-1 text-sm">{document.documentNumber || 'INV-1001'}</p>
          </div>
        </div>

        {/* Invoice Info Bar */}
        <div className="grid grid-cols-3 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200 mb-6 text-xs">
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-semibold">Document Date</span>
            <span className="font-semibold text-slate-800">{formatDate(document.documentDate)}</span>
          </div>
          {isInvoice && (
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-semibold">Payment Due Date</span>
              <span className="font-semibold text-slate-800">{formatDate(document.dueDate)}</span>
            </div>
          )}
          {company.gstNumber && (
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-semibold">Company GSTIN</span>
              <span className="font-semibold text-slate-800">{company.gstNumber}</span>
            </div>
          )}
        </div>

        {/* From & To Section */}
        <div className="grid grid-cols-2 gap-8 mb-6">
          <div className="p-4 border border-slate-200 rounded-lg">
            <h3 className="text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-2 pb-1 border-b border-slate-100">Billed From</h3>
            <p className="font-semibold text-slate-800">{company.companyName}</p>
            <p className="text-slate-600 leading-snug">{company.address}</p>
            <p className="text-slate-600">{[company.city, company.state, company.pincode].filter(Boolean).join(', ')}</p>
            {company.panNumber && <p className="text-slate-500 mt-1">PAN: {company.panNumber}</p>}
          </div>

          <div className="p-4 border border-slate-200 rounded-lg">
            <h3 className="text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-2 pb-1 border-b border-slate-100">
              {isInvoice ? 'Billed To' : isVoucher ? 'Paid To' : 'Received From'}
            </h3>
            {isInvoice ? (
              <>
                <p className="font-semibold text-slate-800">{customer.customerName || 'Customer Name'}</p>
                {customer.companyName && <p className="text-slate-600 font-medium">{customer.companyName}</p>}
                <p className="text-slate-600 leading-snug">{customer.billingAddress}</p>
                <p className="text-slate-600">{[customer.state, customer.pincode].filter(Boolean).join(', ')}</p>
                {customer.gstNumber && <p className="text-slate-500 mt-1">GSTIN: {customer.gstNumber}</p>}
              </>
            ) : (
              <>
                <p className="font-semibold text-slate-800">{document.paidTo || document.receivedFrom || customer.customerName || 'N/A'}</p>
                {document.paymentMethod && <p className="text-slate-600 mt-1">Method: {document.paymentMethod}</p>}
                {document.referenceNumber && <p className="text-slate-600">Ref: {document.referenceNumber}</p>}
              </>
            )}
          </div>
        </div>

        {/* Item Table for Invoice */}
        {isInvoice && (
          <div className="mb-6 rounded-lg border border-slate-200 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-800 text-white text-[10px] uppercase font-semibold tracking-wider">
                  <th className="py-3 px-3">#</th>
                  <th className="py-3 px-3">Item & Description</th>
                  <th className="py-3 px-3 text-right">Qty</th>
                  <th className="py-3 px-3 text-right">Rate ({currencySymbol})</th>
                  <th className="py-3 px-3 text-right">Tax (%)</th>
                  <th className="py-3 px-3 text-right">Amount ({currencySymbol})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-400">No items</td>
                  </tr>
                ) : (
                  items.map((item, idx) => (
                    <tr key={item.id || idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                      <td className="py-3 px-3 text-slate-400 font-mono">{idx + 1}</td>
                      <td className="py-3 px-3">
                        <p className="font-semibold text-slate-900">{item.name}</p>
                        {item.description && <p className="text-slate-500 text-[11px] mt-0.5">{item.description}</p>}
                      </td>
                      <td className="py-3 px-3 text-right font-medium">{item.quantity}</td>
                      <td className="py-3 px-3 text-right">{formatCurrency(item.rate, '').trim()}</td>
                      <td className="py-3 px-3 text-right">{item.taxRate || company.defaultTax || 0}%</td>
                      <td className="py-3 px-3 text-right font-semibold text-slate-900">
                        {formatCurrency(item.quantity * item.rate, '').trim()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Voucher/Receipt description */}
        {(isVoucher || isReceipt) && (
          <div className="bg-slate-50 p-5 rounded-lg border border-slate-200 mb-6">
            <h4 className="font-semibold text-slate-700 text-xs uppercase tracking-wider mb-2">Description / Transaction Particulars</h4>
            <p className="text-slate-800 text-xs leading-relaxed">{document.description || document.notes || 'N/A'}</p>
          </div>
        )}

        {/* Invoice Summary Box */}
        {isInvoice && (
          <div className="flex justify-end mb-6">
            <div className="w-72 bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-2 text-xs">
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
              <div className="flex justify-between text-sm font-bold text-slate-900 border-t border-slate-300 pt-2 mt-2">
                <span>Grand Total:</span>
                <span className="text-blue-600">{formatCurrency(totals.grandTotal, currencySymbol)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Amount in Words */}
        <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg text-[11px] mb-6">
          <span className="font-bold text-blue-900">Total in Words: </span>
          <span className="font-medium text-blue-800">{numberToWords(totals.grandTotal || document.amount || 0, currencySymbol)}</span>
        </div>

        {/* Bank Details */}
        {company.bankDetails?.accountNumber && (
          <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg mb-6 grid grid-cols-2 gap-4 text-[11px]">
            <div>
              <h4 className="font-bold text-slate-800 uppercase tracking-wider mb-1">Bank Payment Wire</h4>
              <p className="text-slate-600">Bank: <span className="font-semibold text-slate-800">{company.bankDetails.bankName}</span></p>
              <p className="text-slate-600">A/c Holder: <span className="font-semibold text-slate-800">{company.bankDetails.accountHolder}</span></p>
              <p className="text-slate-600">A/c Number: <span className="font-mono font-semibold text-slate-800">{company.bankDetails.accountNumber}</span></p>
              <p className="text-slate-600">IFSC Code: <span className="font-mono font-semibold text-slate-800">{company.bankDetails.ifsc}</span></p>
            </div>
            {company.bankDetails.upiId && (
              <div>
                <h4 className="font-bold text-slate-800 uppercase tracking-wider mb-1">Instant UPI Payment</h4>
                <p className="text-slate-600">UPI VPA: <span className="font-mono font-semibold text-slate-800">{company.bankDetails.upiId}</span></p>
              </div>
            )}
          </div>
        )}

        {/* Terms and Conditions */}
        {(document.terms || document.paymentTerms || company.termsAndConditions || company.paymentTerms || document.notes) && (
          <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-lg mb-6 text-[11px]">
            <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[10px] mb-1">Terms & Conditions</h4>
            <p className="whitespace-pre-line text-slate-600 leading-relaxed">{document.terms || document.paymentTerms || company.termsAndConditions || company.paymentTerms || document.notes}</p>
          </div>
        )}
      </div>

      {/* Footer & Signature */}
      <div className="relative z-10 pt-6 border-t border-slate-200 flex justify-between items-end mt-auto">
        <div className="text-[10px] text-slate-400 space-y-0.5">
          <p className="font-semibold text-slate-600">{company.companyName}</p>
          <p>{company.website || company.email}</p>
        </div>

        <div className="text-right">
          {document.signature ? (
            <img src={document.signature} alt="Signature" className="h-10 w-auto ml-auto mb-1 object-contain" />
          ) : company.cfoSignature ? (
            <img src={company.cfoSignature} alt="CFO Signature" className="h-10 w-auto ml-auto mb-1 object-contain" />
          ) : (
            <div className="h-10"></div>
          )}
          <div className="border-t border-slate-400 pt-1 min-w-[140px]">
            <p className="font-bold text-slate-900 text-xs">Authorized Signatory</p>
          </div>
        </div>
      </div>
    </div>
  );
};
