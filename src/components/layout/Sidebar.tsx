import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, FileText, Settings, BookOpen, ChevronLeft, Wallet, Clock, LogOut, Trash2, Users, Banknote, Contact } from 'lucide-react';
import { useCompany } from '../../contexts/CompanyContext';



interface NavItem {
  label: string;
  path?: string;
  icon: React.ComponentType<any>;
  permission?: string;
  onClick?: () => void;
}

export const Sidebar = ({ className = '', onCollapse }) => {
  const { activeCompany, switchCompany, setAuthenticatedState } = useCompany();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      localStorage.removeItem('activeEmployee');
      setAuthenticatedState(false);
      await switchCompany(null);
      navigate('/');
    } catch (err) {
      console.error('Failed to leave workspace', err);
    }
  };

  const getCleanCompanyName = (name, businessType) => {
    if (!name) return '';
    if (businessType) {
      const typeEscaped = businessType.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regexType = new RegExp(`\\s+${typeEscaped}$`, 'i');
      if (regexType.test(name)) {
        return name.replace(regexType, '').trim();
      }
    }
    const suffixRegex = /\s+(Pvt\.?\s*Ltd\.?|Ltd\.?|Private\s+Limited|LLP|Inc\.?|Corp\.?)$/i;
    return name.replace(suffixRegex, '').trim() || name;
  };

  const employeeJson = localStorage.getItem('activeEmployee');
  const activeEmployee = employeeJson ? JSON.parse(employeeJson) : null;

  const navItems: NavItem[] = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Documents', path: '/documents', icon: FileText, permission: 'viewDocuments' },
    { label: 'Customers', path: '/customers', icon: Contact, permission: 'viewDocuments' },
    { label: 'Employees', path: '/employees', icon: Users, permission: 'adminOnly' },
    { label: 'Salary Payroll', path: '/payroll', icon: Banknote, permission: 'adminOnly' },
    ...(activeEmployee && !activeEmployee.isAdmin ? [
      { 
        label: 'Pay Slips', 
        path: '/payslips', 
        icon: Banknote 
      }
    ] : []),
    { label: 'Ledger', path: '/ledger', icon: BookOpen, permission: 'viewLedger' },
    { label: 'Expenses', path: '/expenses', icon: Wallet, permission: 'addExpense' },
    { label: 'Cash Flow', path: '/recurring', icon: Clock, permission: 'accessRecurringPayments' },
    { label: 'Recycle Bin', path: '/recycle-bin', icon: Trash2, permission: 'accessRecycleBin' },
    { label: 'Settings', path: '/settings', icon: Settings, permission: 'adminOnly' },
  ].filter(item => {
    if (!activeEmployee || activeEmployee.isAdmin) {
      return true; // Admin gets everything
    }
    if (item.permission === 'adminOnly') return false;
    if (item.permission) {
      return !!activeEmployee.permissions[item.permission];
    }
    return true;
  });

  return (
    <aside className={`w-[260px] bg-white border-r border-[#f1f3f9] flex flex-col justify-between shrink-0 h-screen sticky top-0 font-sans z-40 ${className}`}>
      <div className="flex-1 flex flex-col pt-5">
        {/* Brand Header */}
        <div className="px-6 pb-6 flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-3.5 min-w-0 flex-1">
            {activeCompany?.logo ? (
              <img 
                src={activeCompany.logo} 
                alt="Company Logo" 
                className="w-10 h-10 rounded-full object-contain shrink-0 bg-white border border-slate-100 p-0.5" 
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center shrink-0 shadow-sm shadow-indigo-200">
                <span className="text-white font-bold text-sm">{activeCompany?.companyName?.charAt(0)?.toUpperCase() || 'C'}</span>
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="font-extrabold text-slate-900 text-[15px] tracking-tight leading-tight truncate" title={activeCompany?.companyName || 'Company'}>
                {getCleanCompanyName(activeCompany?.companyName || 'Company', activeCompany?.businessType)}
              </h1>
              {activeCompany?.businessType && (
                <p className="text-[11px] text-slate-400 font-semibold mt-0.5 truncate" title={activeCompany.businessType}>
                  {activeCompany.businessType}
                </p>
              )}
            </div>
          </div>
          
          {/* Collapse Sidebar Action */}
          <button
            onClick={onCollapse}
            className="w-7 h-7 rounded-lg border border-[#e2e8f0] hover:border-slate-300 flex items-center justify-center text-blue-600 hover:text-blue-700 hover:bg-slate-50 transition-all shrink-0 active:scale-95 cursor-pointer"
            title="Hide Sidebar"
          >
            <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="px-4 mt-2 space-y-1.5">
          <div className="px-3 pb-2 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            Main Menu
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            if (item.onClick) {
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.onClick}
                  className="w-full flex items-center gap-3.5 px-4.5 py-3.5 rounded-2xl text-[13px] font-bold transition-all duration-200 text-slate-500 hover:bg-slate-50 hover:text-slate-900 cursor-pointer"
                >
                  <Icon className="w-4.5 h-4.5 shrink-0 stroke-[2.2]" />
                  <span>{item.label}</span>
                </button>
              );
            }
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3.5 px-4.5 py-3.5 rounded-2xl text-[13px] font-bold transition-all duration-200 ${
                    isActive
                      ? 'bg-blue-50 text-blue-600 shadow-xs'
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                  }`
                }
              >
                <Icon className="w-4.5 h-4.5 shrink-0 stroke-[2.2]" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      <div className="pb-4"></div>
    </aside>
  );
};
