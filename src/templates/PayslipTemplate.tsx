import React from 'react';
import { formatCurrency, formatDate } from '../utils/formatting';
import { numberToWords } from '../utils/numberToWords';

interface PayslipTemplateProps {
  company: any;
  employee: any;
  record: any;
}

export const PayslipTemplate = ({ company = {}, employee = {}, record = {} }: PayslipTemplateProps) => {
  const currencySymbol = company.currency ? company.currency.split(' ')[1] || '₹' : '₹';

  // Extract month and year labels
  const formattedMonthLabel = (() => {
    if (!record.month) return '';
    const [year, month] = record.month.split('-');
    const date = new Date(Number(year), Number(month) - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  })();

  const rawBaseSalary = Number(employee.salary || 0);
  const baseSalary = (employee.salaryType === 'yearly' || employee.salaryType === 'ctc') && rawBaseSalary > 0
    ? Math.round(rawBaseSalary / 12)
    : rawBaseSalary;
  const paidSalary = Number(record.salary || 0);
  const deduction = baseSalary > paidSalary ? baseSalary - paidSalary : 0;

  return (
    <div className="bg-white text-slate-800 p-8 text-xs font-sans max-w-[210mm] mx-auto min-h-[297mm] flex flex-col justify-between relative overflow-hidden select-none border border-slate-200" id="printable-document">
      {/* Watermark Logo */}
      {company.watermarkLogo && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 overflow-hidden">
          <img
            src={company.watermarkLogo}
            alt="Company Watermark"
            className="w-96 h-96 object-contain opacity-[0.05] grayscale contrast-200"
          />
        </div>
      )}

      <div className="relative z-10 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start border-b border-slate-200 pb-4">
          <div className="flex items-center gap-3">
            {company.logo ? (
              <img src={company.logo} alt="Company Logo" className="h-12 w-auto object-contain border rounded p-1 bg-white" />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-indigo-650 text-white flex items-center justify-center font-bold text-lg">
                {company.companyName ? company.companyName.charAt(0).toUpperCase() : 'C'}
              </div>
            )}
            <div>
              <h1 className="text-base font-extrabold uppercase text-slate-900 tracking-tight">{company.companyName || 'Company Name'}</h1>
              <p className="text-[10px] text-slate-500 whitespace-pre-line">{company.address}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">
                {[company.phone && `Phone: ${company.phone}`, company.email && `Email: ${company.email}`].filter(Boolean).join(' | ')}
              </p>
              {company.gstNumber && <p className="text-[10px] text-slate-500 font-mono">GSTIN: {company.gstNumber}</p>}
            </div>
          </div>
          <div className="text-right">
            <h2 className="text-lg font-black text-indigo-650 uppercase tracking-widest">Payslip</h2>
            <p className="text-[10px] text-slate-500 font-bold mt-1">Month: {formattedMonthLabel}</p>
            <p className="text-[9px] text-slate-400 font-medium">Slip ID: {record.id || 'N/A'}</p>
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/50">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Employee Information</h3>
            <div className="space-y-1 text-slate-700 font-semibold">
              <p className="text-slate-900 font-bold text-sm">{employee.name || 'Employee Name'}</p>
              <p><span className="text-slate-400 font-medium">Employee ID:</span> {employee.loginId || 'N/A'}</p>
              <p><span className="text-slate-400 font-medium">Designation:</span> {employee.designation || 'N/A'}</p>
              <p><span className="text-slate-400 font-medium">Email:</span> {employee.email || 'N/A'}</p>
            </div>
          </div>

          <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/50">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Payment Details</h3>
            <div className="space-y-1 text-slate-700 font-semibold">
              <p><span className="text-slate-400 font-medium">Payment Date:</span> {record.paymentDate ? formatDate(record.paymentDate) : 'N/A'}</p>
              <p><span className="text-slate-400 font-medium">Payment Method:</span> {record.paymentMethod || 'N/A'}</p>
              <p><span className="text-slate-400 font-medium">Payment Status:</span> <span className="text-emerald-600 font-extrabold uppercase">{record.status || 'Paid'}</span></p>
              {record.notes && <p className="truncate max-w-[200px]"><span className="text-slate-400 font-medium">Notes:</span> <span className="italic">"{record.notes}"</span></p>}
            </div>
          </div>
        </div>

        {/* Salary Ledger Breakdown Table */}
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-100 border-y border-slate-200 text-[9px] uppercase font-bold text-slate-650 tracking-wider">
              <th className="py-2.5 px-4">Earnings & Description</th>
              <th className="py-2.5 px-4 text-right w-36">Amount ({currencySymbol})</th>
              <th className="py-2.5 px-4 text-right w-36">Deductions ({currencySymbol})</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-150 font-medium text-slate-700">
            <tr>
              <td className="py-3 px-4">
                <p className="font-bold text-slate-900">Basic Salary</p>
                <p className="text-[10px] text-slate-400">
                  {employee.salaryType === 'yearly'
                    ? `Annual contracted salary (${formatCurrency(rawBaseSalary, currencySymbol)}/yr prorated monthly)`
                    : employee.salaryType === 'ctc'
                    ? `Cost to Company CTC (${formatCurrency(rawBaseSalary, currencySymbol)} prorated monthly)`
                    : 'Regular monthly contracted base salary'}
                </p>
              </td>
              <td className="py-3 px-4 text-right font-bold text-slate-900">{formatCurrency(baseSalary, '')}</td>
              <td className="py-3 px-4 text-right text-slate-400">-</td>
            </tr>
            {deduction > 0 && (
              <tr>
                <td className="py-3 px-4">
                  <p className="font-bold text-rose-600">Salary Adjustments / Unpaid Leaves</p>
                  <p className="text-[10px] text-slate-400">Withheld amount or deductions for the cycle</p>
                </td>
                <td className="py-3 px-4 text-right text-slate-400">-</td>
                <td className="py-3 px-4 text-right font-bold text-rose-600">({formatCurrency(deduction, '')})</td>
              </tr>
            )}
            <tr className="bg-slate-50/50 font-bold text-slate-900 border-t border-slate-200">
              <td className="py-2.5 px-4 uppercase text-[10px] tracking-wider text-slate-550">Total Computations</td>
              <td className="py-2.5 px-4 text-right">{formatCurrency(baseSalary, '')}</td>
              <td className="py-2.5 px-4 text-right text-rose-600">{deduction > 0 ? `(${formatCurrency(deduction, '')})` : '-'}</td>
            </tr>
          </tbody>
        </table>

        {/* Net Salary Highlight Box */}
        <div className="flex justify-between items-center bg-indigo-50/40 border border-indigo-100/50 p-5 rounded-2xl">
          <div>
            <p className="text-[9px] uppercase font-bold text-indigo-500 tracking-wider">Net Salary Settled</p>
            <p className="text-xs text-slate-400 font-semibold mt-1">Amount in Words:</p>
            <p className="text-[10px] text-indigo-900 font-bold italic mt-0.5">{numberToWords(paidSalary, currencySymbol)}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-black text-indigo-950">{formatCurrency(paidSalary, currencySymbol)}</p>
          </div>
        </div>

        {/* Compliance message */}
        <p className="text-[10px] text-slate-400 leading-relaxed italic text-center pt-2">
          This is a computer-generated document and does not require a physical signature. In case of discrepancies, please contact the accounts department.
        </p>
      </div>

      {/* Signatures */}
      <div className="pt-6 border-t border-slate-200 flex justify-between items-end mt-auto">
        <div className="text-[9px] text-slate-400">
          <p className="font-bold text-slate-700">{company.companyName}</p>
          <p>Confidential Corporate Document</p>
        </div>

        <div className="text-right flex flex-col items-end">
          {company.cfoSignature && (
            <img src={company.cfoSignature} alt="CFO Signature" className="h-10 w-auto mb-1 object-contain" />
          )}
          <div className="border-t border-slate-350 pt-1 px-6 min-w-[120px]">
            <p className="font-extrabold text-slate-800">{company.companyName}</p>
            <p className="text-[9px] text-slate-400 mt-0.5">Authorised Signatory</p>
          </div>
        </div>
      </div>
    </div>
  );
};
