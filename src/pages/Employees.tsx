import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { MainLayout } from '../components/layout/MainLayout';
import { useCompany } from '../contexts/CompanyContext';
import { useToast } from '../components/ui/Toast';
import { Button } from '../components/ui/Button';
import { getCompanyEmployees, saveCompanyEmployees, getAllExpenses } from '../services/db';
import { useDocument } from '../contexts/DocumentContext';
import { formatCurrency, validateEmail, validatePhone, validatePassword, generateStrongPassword } from '../utils/formatting';
import { 
  Users, 
  UserPlus, 
  Shield, 
  Key, 
  Eye, 
  EyeOff, 
  Edit2, 
  Trash2, 
  Lock, 
  User, 
  Plus, 
  Search, 
  X, 
  Check,
  AlertCircle,
  Phone,
  Mail,
  Briefcase,
  Banknote,
  ChevronDown,
  RefreshCw,
  Copy,
  RotateCcw,
  CheckCircle2,
  KeyRound
} from 'lucide-react';
import { ConfirmModal } from '../components/ui/ConfirmModal';

interface EmployeePermissions {
  viewDocuments: boolean;
  addInvoice: boolean;
  addVoucher: boolean;
  addReceipt: boolean;
  addExpense: boolean;
  viewLedger: boolean;
  accessRecycleBin: boolean;
  accessRecurringPayments: boolean;
}

interface Employee {
  id: string;
  name: string;
  loginId: string;
  password: string;
  phone?: string;
  email?: string;
  designation?: string;
  salary?: number | string;
  permissions: EmployeePermissions;
  isAdmin?: boolean;
  createdAt: string;
  photo?: string;
  mustChangePassword?: boolean;
  passwordSetByEmployee?: boolean;
  passwordUpdatedAt?: string;
}

const defaultPermissions: EmployeePermissions = {
  viewDocuments: true,
  addInvoice: true,
  addVoucher: true,
  addReceipt: true,
  addExpense: true,
  viewLedger: true,
  accessRecycleBin: true,
  accessRecurringPayments: true
};

export const Employees = () => {
  const { activeCompany } = useCompany();
  const { showToast } = useToast();

  // Guard: if employee is logged in, redirect or block access
  const employeeJson = localStorage.getItem('activeEmployee');
  const activeEmployee = employeeJson ? JSON.parse(employeeJson) : null;

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [designation, setDesignation] = useState('');
  const [designationType, setDesignationType] = useState('Accountant');
  const [salary, setSalary] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [permissions, setPermissions] = useState<EmployeePermissions>({ ...defaultPermissions });
  const [isAdmin, setIsAdmin] = useState(false);
  const [photo, setPhoto] = useState('');
  const [formError, setFormError] = useState('');

  // Delete confirmation state
  const [deleteEmployeeId, setDeleteEmployeeId] = useState<string | null>(null);

  // Verify password modal state for promoting to admin
  const [verifyAdminEmp, setVerifyAdminEmp] = useState<Employee | null>(null);
  const [verifyPasswordInput, setVerifyPasswordInput] = useState('');
  const [verifyError, setVerifyError] = useState('');
  const [showVerifyPassword, setShowVerifyPassword] = useState(false);

  // Detailed profile state
  const [activeEmployeeDetail, setActiveEmployeeDetail] = useState<Employee | null>(null);
  const [activeTab, setActiveTab] = useState<'info' | 'invoices' | 'documents' | 'expenses'>('info');
  const [expenses, setExpenses] = useState<any[]>([]);
  const { documents } = useDocument();

  // Password visibility states
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});
  const [showDetailPassword, setShowDetailPassword] = useState(false);

  // Reset password modal state (Admin-only)
  const [resetModalEmp, setResetModalEmp] = useState<Employee | null>(null);
  const [resetTempPassword, setResetTempPassword] = useState('');
  const [showResetTempPassword, setShowResetTempPassword] = useState(true);
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false);
  const [resetSuccessModal, setResetSuccessModal] = useState<{ empName: string; loginId: string; tempPass: string } | null>(null);

  const toggleRevealPassword = (empId: string) => {
    setRevealedPasswords(prev => ({
      ...prev,
      [empId]: !prev[empId]
    }));
  };

  const copyToClipboard = (text: string, label: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text);
        showToast(`${label} copied to clipboard!`, 'success');
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showToast(`${label} copied to clipboard!`, 'success');
      }
    } catch (err) {
      console.error(err);
      showToast(`Could not copy ${label}.`, 'warning');
    }
  };

  const handleOpenResetPassword = (emp: Employee) => {
    const newTemp = generateStrongPassword(10);
    setResetModalEmp(emp);
    setResetTempPassword(newTemp);
    setShowResetTempPassword(true);
  };

  const handleConfirmResetPassword = async () => {
    if (!resetModalEmp || !activeCompany) return;
    const cleanPass = resetTempPassword.trim();
    if (!cleanPass) {
      showToast('Temporary password is required.', 'error');
      return;
    }
    if (!validatePassword(cleanPass)) {
      showToast('Password must be at least 8 characters, containing uppercase, lowercase, and a symbol.', 'error');
      return;
    }

    setResetPasswordLoading(true);
    try {
      let updatedEmpObj: Employee | null = null;
      const updatedList = employees.map(e => {
        if (e.id === resetModalEmp.id) {
          updatedEmpObj = {
            ...e,
            password: cleanPass,
            mustChangePassword: true,
            passwordSetByEmployee: false,
            passwordUpdatedAt: new Date().toISOString()
          };
          return updatedEmpObj;
        }
        return e;
      });

      await saveCompanyEmployees(activeCompany.id, updatedList);
      setEmployees(updatedList);

      if (activeEmployeeDetail && activeEmployeeDetail.id === resetModalEmp.id && updatedEmpObj) {
        setActiveEmployeeDetail(updatedEmpObj);
      }

      const activeEmpJson = localStorage.getItem('activeEmployee');
      if (activeEmpJson) {
        const activeEmpObj = JSON.parse(activeEmpJson);
        if (activeEmpObj.id === resetModalEmp.id && updatedEmpObj) {
          localStorage.setItem('activeEmployee', JSON.stringify(updatedEmpObj));
        }
      }

      setResetSuccessModal({
        empName: resetModalEmp.name,
        loginId: resetModalEmp.loginId,
        tempPass: cleanPass
      });
      setResetModalEmp(null);
      showToast(`Temporary password set for ${resetModalEmp.name}!`, 'success');
    } catch (err: any) {
      console.error('Failed to reset password:', err);
      showToast(err.message || 'Failed to reset password.', 'error');
    } finally {
      setResetPasswordLoading(false);
    }
  };

  useEffect(() => {
    const loadExpenses = async () => {
      if (!activeCompany?.id) return;
      try {
        const data = await getAllExpenses(activeCompany.id);
        setExpenses(data);
      } catch (err) {
        console.error('Error loading expenses:', err);
      }
    };
    loadExpenses();
  }, [activeCompany?.id]);

  const employeeDocsList = useMemo(() => {
    if (!activeEmployeeDetail) return [];
    return documents.filter(d => 
      (!d.companyId || !activeCompany?.id || d.companyId === activeCompany.id) &&
      d.createdBy === activeEmployeeDetail.name
    );
  }, [documents, activeEmployeeDetail, activeCompany?.id]);

  const employeeExpensesList = useMemo(() => {
    if (!activeEmployeeDetail) return [];
    return expenses.filter(e => 
      (!e.companyId || !activeCompany?.id || e.companyId === activeCompany.id) &&
      e.createdBy === activeEmployeeDetail.name
    );
  }, [expenses, activeEmployeeDetail, activeCompany?.id]);

  const loadEmployees = useCallback(async () => {
    if (!activeCompany) return;
    setLoading(true);
    try {
      const data = await getCompanyEmployees(activeCompany.id);
      setEmployees(data);
    } catch (e) {
      console.error('Error loading employees:', e);
      showToast('Failed to load employee list.', 'error');
    } finally {
      setLoading(false);
    }
  }, [activeCompany, showToast]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  const handleDesignationTypeChange = (type: string) => {
    setDesignationType(type);
    if (type === 'Accountant') {
      setDesignation('Accountant');
      setPermissions({
        viewDocuments: true,
        addInvoice: true,
        addVoucher: true,
        addReceipt: true,
        addExpense: true,
        viewLedger: true,
        accessRecycleBin: true,
        accessRecurringPayments: true
      });
    } else if (type === 'Auditor') {
      setDesignation('Auditor');
      setPermissions({
        viewDocuments: true,
        addInvoice: false,
        addVoucher: false,
        addReceipt: false,
        addExpense: false,
        viewLedger: true,
        accessRecycleBin: false,
        accessRecurringPayments: false
      });
    } else {
      setDesignation('');
    }
  };

  const handleOpenAddModal = () => {
    setModalMode('add');
    setEditingEmployeeId(null);
    setName('');

    // Generate sequential Login ID based on company name
    const companyClean = (activeCompany?.companyName || 'company')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
    
    let nextNum = 1;
    const regex = new RegExp(`^${companyClean}(\\d+)$`);
    employees.forEach(emp => {
      const match = emp.loginId.toLowerCase().trim().match(regex);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num >= nextNum) {
          nextNum = num + 1;
        }
      }
    });
    const paddedNum = String(nextNum).padStart(3, '0');
    const generatedLoginId = `${companyClean}${paddedNum}`;
    setLoginId(generatedLoginId);

    // Generate temporary strong password satisfying all criteria (uppercase, lowercase, number, symbol)
    const generatedPass = generateStrongPassword(10);
    setPassword(generatedPass);

    setPhone('');
    setEmail('');
    setDesignation('');
    setDesignationType('');
    setSalary('');
    setPermissions({ ...defaultPermissions });
    setIsAdmin(false);
    setPhoto('');
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (emp: Employee) => {
    setModalMode('edit');
    setEditingEmployeeId(emp.id);
    setName(emp.name);
    setLoginId(emp.loginId);
    setPassword(emp.password);
    setPhone(emp.phone || '');
    setEmail(emp.email || '');
    
    const currentDesignation = emp.designation || '';
    setDesignation(currentDesignation);
    if (currentDesignation === 'Accountant') {
      setDesignationType('Accountant');
    } else if (currentDesignation === 'Auditor') {
      setDesignationType('Auditor');
    } else {
      setDesignationType(currentDesignation ? 'Custom' : '');
    }

    setSalary(emp.salary !== undefined && emp.salary !== null ? String(emp.salary) : '');
    setPermissions(emp.permissions || { ...defaultPermissions });
    setIsAdmin(!!emp.isAdmin);
    setPhoto(emp.photo || '');
    setFormError('');
    setIsModalOpen(true);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, targetEmpId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Check file size (e.g. limit to 2MB)
    if (file.size > 2 * 1024 * 1024) {
      showToast('Image size should be less than 2MB.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const base64String = evt.target?.result as string;
      if (!base64String) return;

      try {
        const updatedList = employees.map(emp => {
          if (emp.id === targetEmpId) {
            const updated = { ...emp, photo: base64String };
            // If editing the active detailed view, update that state too
            if (activeEmployeeDetail && activeEmployeeDetail.id === targetEmpId) {
              setActiveEmployeeDetail(updated);
            }
            // Sync current logged-in employee session if updated
            const activeEmpJson = localStorage.getItem('activeEmployee');
            if (activeEmpJson) {
              const activeEmpObj = JSON.parse(activeEmpJson);
              if (activeEmpObj.id === emp.id) {
                localStorage.setItem('activeEmployee', JSON.stringify(updated));
              }
            }
            return updated;
          }
          return emp;
        });

        if (activeCompany) {
          await saveCompanyEmployees(activeCompany.id, updatedList);
          setEmployees(updatedList);
          showToast('Employee photo updated successfully.', 'success');
        }
      } catch (err) {
        console.error('Error saving photo:', err);
        showToast('Failed to save photo.', 'error');
      }
    };
    reader.readAsDataURL(file);
  };

  const validateForm = () => {
    if (!name.trim()) return 'Name is required.';
    if (!designationType) return 'Please select a Designation / Role.';
    if (designationType === 'Custom' && !designation.trim()) return 'Custom designation name is required.';
    if (!loginId.trim()) return 'Employee ID is required.';
    if (loginId.trim().includes(' ')) return 'Employee ID cannot contain spaces.';
    if (!password.trim()) return 'Password is required.';
    if (!validatePassword(password.trim())) {
      return 'Password must be at least 8 characters, and contain at least one uppercase letter, one lowercase letter, and one symbol.';
    }
    if (email.trim() && !validateEmail(email.trim())) {
      return 'Invalid email address.';
    }
    if (phone.trim() && !validatePhone(phone.trim())) {
      return 'Phone number must be exactly 10 digits.';
    }
    
    // Check if login ID is already taken
    const exists = employees.some(
      emp => emp.loginId.toLowerCase() === loginId.trim().toLowerCase() && emp.id !== editingEmployeeId
    );
    if (exists) return 'This Employee ID is already in use.';

    return '';
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const errorMsg = validateForm();
    if (errorMsg) {
      setFormError(errorMsg);
      return;
    }

    if (!activeCompany) return;

    try {
      let updatedList = [...employees];
      if (modalMode === 'add') {
        const newEmployee: Employee = {
          id: `emp_${Date.now()}`,
          name: name.trim(),
          loginId: loginId.trim().toLowerCase(),
          password: password,
          phone: phone.trim(),
          email: email.trim().toLowerCase(),
          designation: designation.trim(),
          salary: salary.trim() ? (isNaN(Number(salary.trim())) ? salary.trim() : Number(salary.trim())) : '',
          permissions,
          isAdmin,
          createdAt: new Date().toISOString(),
          photo: photo,
          mustChangePassword: true,
          passwordSetByEmployee: false
        };
        updatedList.push(newEmployee);
        showToast(`Employee "${newEmployee.name}" created successfully!`, 'success');
      } else if (modalMode === 'edit' && editingEmployeeId) {
        updatedList = updatedList.map(emp => {
          if (emp.id === editingEmployeeId) {
            const passwordChanged = emp.password !== password;
            const updated = {
              ...emp,
              name: name.trim(),
              loginId: loginId.trim().toLowerCase(),
              password: password,
              phone: phone.trim(),
              email: email.trim().toLowerCase(),
              designation: designation.trim(),
              salary: salary.trim() ? (isNaN(Number(salary.trim())) ? salary.trim() : Number(salary.trim())) : '',
              permissions,
              isAdmin,
              photo: photo,
              mustChangePassword: passwordChanged ? true : emp.mustChangePassword,
              passwordSetByEmployee: passwordChanged ? false : emp.passwordSetByEmployee
            };
            // Sync current logged-in employee session if updated
            const activeEmpJson = localStorage.getItem('activeEmployee');
            if (activeEmpJson) {
              const activeEmpObj = JSON.parse(activeEmpJson);
              if (activeEmpObj.id === emp.id) {
                localStorage.setItem('activeEmployee', JSON.stringify(updated));
              }
            }
            return updated;
          }
          return emp;
        });
        showToast('Employee settings updated successfully.', 'success');
      }

      await saveCompanyEmployees(activeCompany.id, updatedList);
      setEmployees(updatedList);
      setIsModalOpen(false);
    } catch (e) {
      console.error('Error saving employee:', e);
      showToast('Failed to save employee details.', 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteEmployeeId || !activeCompany) return;
    try {
      const updatedList = employees.filter(emp => emp.id !== deleteEmployeeId);
      await saveCompanyEmployees(activeCompany.id, updatedList);
      setEmployees(updatedList);
      showToast('Employee removed successfully.', 'success');
      setDeleteEmployeeId(null);
    } catch (e) {
      console.error('Error deleting employee:', e);
      showToast('Failed to delete employee.', 'error');
    }
  };

  const handleToggleAdmin = async (emp: Employee) => {
    if (!activeCompany) return;
    
    // If making admin (promoting), require password verification
    if (!emp.isAdmin) {
      setVerifyAdminEmp(emp);
      setVerifyPasswordInput('');
      setVerifyError('');
      setShowVerifyPassword(false);
      return;
    }

    // If revoking admin, do it immediately
    try {
      const updatedList = employees.map(e => {
        if (e.id === emp.id) {
          return {
            ...e,
            isAdmin: false
          };
        }
        return e;
      });
      await saveCompanyEmployees(activeCompany.id, updatedList);
      setEmployees(updatedList);
      
      const updatedEmp = updatedList.find(e => e.id === emp.id);
      showToast(`Admin privileges revoked for "${emp.name}".`, 'info');

      // Sync current logged-in employee session if updated
      const activeEmpJson = localStorage.getItem('activeEmployee');
      if (activeEmpJson) {
        const activeEmpObj = JSON.parse(activeEmpJson);
        if (activeEmpObj.id === emp.id && updatedEmp) {
          localStorage.setItem('activeEmployee', JSON.stringify(updatedEmp));
        }
      }
    } catch (e) {
      console.error('Error toggling admin status:', e);
      showToast('Failed to update admin status.', 'error');
    }
  };

  const handleConfirmAdmin = async () => {
    if (!verifyAdminEmp || !activeCompany) return;

    // Cross-verify with the current admin password (either active admin employee or company owner)
    const currentAdminPassword = activeEmployee ? activeEmployee.password : activeCompany.companyPassword;

    if (verifyPasswordInput !== currentAdminPassword) {
      setVerifyError('Incorrect admin password. Please try again.');
      return;
    }

    try {
      const updatedList = employees.map(e => {
        if (e.id === verifyAdminEmp.id) {
          return {
            ...e,
            isAdmin: true
          };
        }
        return e;
      });
      await saveCompanyEmployees(activeCompany.id, updatedList);
      setEmployees(updatedList);
      
      const updatedEmp = updatedList.find(e => e.id === verifyAdminEmp.id);
      showToast(`Employee "${verifyAdminEmp.name}" is now an Admin with full access.`, 'success');

      // Sync current logged-in employee session if updated
      const activeEmpJson = localStorage.getItem('activeEmployee');
      if (activeEmpJson) {
        const activeEmpObj = JSON.parse(activeEmpJson);
        if (activeEmpObj.id === verifyAdminEmp.id && updatedEmp) {
          localStorage.setItem('activeEmployee', JSON.stringify(updatedEmp));
        }
      }

      setVerifyAdminEmp(null);
    } catch (e) {
      console.error('Error promoting to admin:', e);
      showToast('Failed to update admin status.', 'error');
    }
  };

  const handleTogglePermission = (key: keyof EmployeePermissions) => {
    setPermissions(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  if (activeEmployee && !activeEmployee.isAdmin) {
    return (
      <MainLayout title="Access Control">
        <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6 bg-white border border-slate-100 rounded-2xl">
          <div className="w-16 h-16 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 mb-4 border border-rose-100/30">
            <Shield className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">Access Denied</h3>
          <p className="text-slate-500 text-sm max-w-sm mt-1 leading-relaxed">
            Only the Workspace Owner or Administrator can access the Employee Management section.
          </p>
        </div>
      </MainLayout>
    );
  }

  const filteredEmployees = employees.filter(emp => 
    emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.loginId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (emp.designation && emp.designation.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (emp.salary !== undefined && emp.salary !== null && String(emp.salary).includes(searchTerm))
  );

  return (
    <MainLayout title="Employees">
      <div className="space-y-6 font-sans">
        
        {/* Top Controls Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search employees by name, designation..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none text-sm transition-all shadow-xs"
              autoComplete="off"
            />
          </div>


        </div>

        {/* Employee Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(n => (
              <div key={n} className="bg-white border border-slate-200/60 rounded-2xl p-6 space-y-4 animate-pulse">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 bg-slate-100 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <div className="h-4 bg-slate-100 rounded w-2/3" />
                    <div className="h-3 bg-slate-100 rounded w-1/2" />
                  </div>
                </div>
                <div className="h-8 bg-slate-50 rounded-xl" />
                <div className="h-8 bg-slate-50 rounded-xl" />
              </div>
            ))}
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="bg-white border border-slate-200/60 rounded-2xl p-16 text-center shadow-xs">
            <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 mx-auto mb-4 border border-slate-100">
              <Users className="w-8 h-8" />
            </div>
            <h4 className="text-slate-900 font-bold text-sm">No Employees Registered</h4>
            <p className="text-slate-400 text-xs mt-1 max-w-xs mx-auto leading-relaxed">
              Create employee logins with granular access permissions to onboard your staff.
            </p>
            <button
              onClick={handleOpenAddModal}
              className="mt-4 inline-flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100/80 text-indigo-600 font-bold text-xs px-4 py-2.5 rounded-xl transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add First Employee
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEmployees.map((emp) => {
              const activeCount = Object.values(emp.permissions || {}).filter(Boolean).length;
              const totalCount = Object.keys(defaultPermissions).length;
              const hasFullAccess = activeCount === totalCount;
              const hasNoAccess = activeCount === 0;

              return (
                <div 
                  key={emp.id} 
                  onClick={() => {
                    setActiveEmployeeDetail(emp);
                    setActiveTab('info');
                  }}
                  className="bg-white border border-slate-200/60 rounded-2xl p-5 hover:border-indigo-100 hover:shadow-lg hover:shadow-slate-100/50 transition-all flex flex-col justify-between group cursor-pointer"
                >
                  <div className="space-y-4">
                    {/* Header Info */}
                    <div className="flex items-center gap-3.5">
                      {emp.photo ? (
                        <img 
                          src={emp.photo} 
                          alt={emp.name} 
                          className="w-11 h-11 rounded-full object-cover shrink-0 border border-slate-200" 
                        />
                      ) : (
                        <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 font-extrabold text-sm uppercase ${
                          emp.isAdmin 
                            ? 'bg-amber-50 border border-amber-100/60 text-amber-600' 
                            : 'bg-indigo-50 border border-indigo-100/40 text-indigo-600'
                        }`}>
                          {emp.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <h4 className="font-bold text-slate-900 text-sm truncate leading-tight group-hover:text-indigo-600 transition-colors">{emp.name}</h4>
                          {emp.isAdmin && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-50 border border-amber-100 text-amber-700 text-[9px] font-bold shrink-0">
                              <Shield className="w-2.5 h-2.5 text-amber-500" />
                              Admin
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-1 mt-0.5">
                          <p className="text-[10px] text-slate-400 font-semibold truncate">
                            {emp.designation ? `${emp.designation} • ` : ''}Joined {new Date(emp.createdAt).toLocaleDateString()}
                          </p>
                          {emp.salary !== undefined && emp.salary !== '' && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-100 text-emerald-700 text-[10px] font-bold shrink-0">
                              <Banknote className="w-3 h-3 text-emerald-600" />
                              {formatCurrency(Number(emp.salary), activeCompany?.currency ? activeCompany.currency.split(' ')[1] || '₹' : '₹')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>



                    {/* Permissions Badges */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Feature Permissions</span>
                        <span className="text-[10px] font-bold text-indigo-600">
                          {emp.isAdmin ? 'Admin (Bypassed)' : hasFullAccess ? 'Full Access' : hasNoAccess ? 'No Access' : `${activeCount}/${totalCount} Active`}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-1.5 min-h-[60px] content-start">
                        {emp.isAdmin ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-100 text-amber-700 text-[10px] font-bold">
                            <Shield className="w-3 h-3 text-amber-600" />
                            Full Admin Control Granted
                          </span>
                        ) : hasFullAccess ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-700 text-[10px] font-bold">
                            <Shield className="w-3 h-3" />
                            All Permissions Granted
                          </span>
                        ) : hasNoAccess ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-100 text-rose-700 text-[10px] font-bold">
                            <AlertCircle className="w-3 h-3" />
                            No Permissions Enabled
                          </span>
                        ) : (
                          <>
                            {emp.permissions?.viewDocuments && (
                              <span className="px-2 py-0.5 rounded-lg bg-blue-50 border border-blue-100/30 text-blue-600 text-[9px] font-bold">Documents</span>
                            )}
                            {emp.permissions?.addInvoice && (
                              <span className="px-2 py-0.5 rounded-lg bg-blue-50 border border-blue-100/30 text-blue-600 text-[9px] font-bold">Add Invoices</span>
                            )}
                            {emp.permissions?.addVoucher && (
                              <span className="px-2 py-0.5 rounded-lg bg-blue-50 border border-blue-100/30 text-blue-600 text-[9px] font-bold">Add Vouchers</span>
                            )}
                            {emp.permissions?.addReceipt && (
                              <span className="px-2 py-0.5 rounded-lg bg-blue-50 border border-blue-100/30 text-blue-600 text-[9px] font-bold">Add Receipts</span>
                            )}
                            {emp.permissions?.addExpense && (
                              <span className="px-2 py-0.5 rounded-lg bg-blue-50 border border-blue-100/30 text-blue-600 text-[9px] font-bold">Add Expenses</span>
                            )}
                            {emp.permissions?.viewLedger && (
                              <span className="px-2 py-0.5 rounded-lg bg-blue-50 border border-blue-100/30 text-blue-600 text-[9px] font-bold">Ledger</span>
                            )}
                            {emp.permissions?.accessRecycleBin && (
                              <span className="px-2 py-0.5 rounded-lg bg-blue-50 border border-blue-100/30 text-blue-600 text-[9px] font-bold">Recycle Bin</span>
                            )}
                            {emp.permissions?.accessRecurringPayments && (
                              <span className="px-2 py-0.5 rounded-lg bg-blue-50 border border-blue-100/30 text-blue-600 text-[9px] font-bold">Recurring Payments</span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleToggleAdmin(emp); }}
                      className={`inline-flex items-center gap-1.5 font-bold text-xs transition-colors cursor-pointer mr-auto ${
                        emp.isAdmin 
                          ? 'text-amber-600 hover:text-amber-700' 
                          : 'text-slate-400 hover:text-amber-600'
                      }`}
                      title={emp.isAdmin ? "Revoke Admin Access" : "Make Admin"}
                    >
                      <Shield className="w-3.5 h-3.5" />
                      <span>{emp.isAdmin ? 'Revoke Admin' : 'Make Admin'}</span>
                    </button>

                    <button
                      onClick={(e) => { e.stopPropagation(); handleOpenEditModal(emp); }}
                      className="inline-flex items-center gap-1.5 text-slate-500 hover:text-indigo-600 font-bold text-xs transition-colors cursor-pointer"
                      title="Edit Employee"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteEmployeeId(emp.id); }}
                      className="inline-flex items-center gap-1.5 text-slate-400 hover:text-rose-600 font-bold text-xs transition-colors cursor-pointer"
                      title="Delete Employee"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Add/Edit Modal Card Centered */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
            <div 
              className="absolute inset-0 cursor-pointer" 
              onClick={() => setIsModalOpen(false)}
            />
            <div className="relative w-full max-w-xl bg-white/95 rounded-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200 font-sans">
              
              {/* Header */}
              <div className="flex items-center justify-between p-5 pb-4 border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                    <UserPlus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-base leading-none">
                      {modalMode === 'add' ? 'Add Employee' : 'Edit Employee'}
                    </h3>
                    <p className="text-[10px] text-slate-400 font-semibold mt-1">Configure staff access and login credentials</p>
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
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                <form onSubmit={handleSave} className="space-y-5" autoComplete="off">
                  {/* Dummy inputs to intercept browser autofill */}
                  <input type="text" name="dummy-username" style={{ display: 'none' }} autoComplete="username" />
                  <input type="password" name="dummy-password" style={{ display: 'none' }} autoComplete="current-password" />
                  
                  {/* Profile Photo Upload Section */}
                  <div className="flex flex-col items-center gap-3 bg-slate-50 border border-slate-100 p-4 rounded-2xl">
                    <label className="block text-xs font-bold text-slate-800 self-start">Profile Photo</label>
                    <div className="relative group">
                      {photo ? (
                        <img 
                          src={photo} 
                          alt="Preview" 
                          className="w-20 h-20 rounded-2xl object-cover border border-slate-200" 
                        />
                      ) : (
                        <div className="w-20 h-20 rounded-2xl bg-indigo-50 border border-indigo-150 flex items-center justify-center text-indigo-600">
                          <User className="w-10 h-10" />
                        </div>
                      )}
                      {photo && (
                        <button
                          type="button"
                          onClick={() => setPhoto('')}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center hover:bg-rose-600 transition-colors shadow-sm"
                          title="Remove Photo"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    
                    <label htmlFor="modalPhotoUpload" className="inline-flex items-center gap-1.5 text-xs text-indigo-600 bg-white border border-slate-200 hover:bg-slate-50 px-3.5 py-2 rounded-xl cursor-pointer transition-all shadow-xs">
                      <Plus className="w-3.5 h-3.5" />
                      <span>{photo ? 'Change Photo' : 'Upload Photo'}</span>
                      <input
                        type="file"
                        id="modalPhotoUpload"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (file.size > 2 * 1024 * 1024) {
                            showToast('Image size should be less than 2MB.', 'error');
                            return;
                          }
                          const reader = new FileReader();
                          reader.onload = (evt) => {
                            if (typeof evt.target?.result === 'string') {
                              setPhoto(evt.target.result);
                            }
                          };
                          reader.readAsDataURL(file);
                        }}
                      />
                    </label>
                  </div>

                  {/* Basic Details Section */}
                  <div className="space-y-4">
                    <h4 className="text-[11px] uppercase font-bold text-slate-400 tracking-wider">Basic Details</h4>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Name */}
                      <div>
                        <label className="block text-xs font-bold text-slate-800 mb-1.5">Full Name</label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. John Doe"
                            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none text-sm transition-all"
                            required
                            autoComplete="new-name"
                            name="employee-full-name"
                          />
                        </div>
                      </div>

                      {/* Designation */}
                      <div>
                        <label className="block text-xs font-bold text-slate-800 mb-1.5">Designation / Role</label>
                        <div className="relative">
                          <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <select
                            value={designationType}
                            onChange={(e) => handleDesignationTypeChange(e.target.value)}
                            className={`w-full pl-9 pr-8 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none text-sm transition-all appearance-none bg-white font-medium ${
                              !designationType ? 'text-slate-400' : 'text-slate-800'
                            }`}
                            required
                          >
                            <option value="" disabled>Select a Role</option>
                            <option value="Accountant">Accountant</option>
                            <option value="Auditor">Auditor</option>
                            <option value="Custom">Custom...</option>
                          </select>
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                            <ChevronDown className="w-4 h-4" />
                          </div>
                        </div>
                      </div>

                      {/* Custom Designation Name */}
                      {designationType === 'Custom' && (
                        <div>
                          <label className="block text-xs font-bold text-slate-800 mb-1.5">Custom Designation Name</label>
                          <div className="relative">
                            <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                              type="text"
                              value={designation}
                              onChange={(e) => setDesignation(e.target.value)}
                              placeholder="e.g. Sales Manager"
                              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none text-sm transition-all font-medium"
                              autoComplete="new-designation"
                              name="employee-designation"
                              required
                            />
                          </div>
                        </div>
                      )}

                      {/* Phone */}
                      <div>
                        <label className="block text-xs font-bold text-slate-800 mb-1.5">Phone Number</label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="e.g. +1 555 0199"
                            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none text-sm transition-all"
                            autoComplete="new-phone"
                            name="employee-phone"
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
                            placeholder="e.g. john@example.com"
                            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none text-sm transition-all"
                            autoComplete="new-email"
                            name="employee-email"
                          />
                        </div>
                      </div>

                      {/* Salary */}
                      <div>
                        <label className="block text-xs font-bold text-slate-800 mb-1.5">Salary</label>
                        <div className="relative">
                          <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                            type="number"
                            value={salary}
                            onChange={(e) => setSalary(e.target.value)}
                            placeholder="e.g. 50000"
                            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none text-sm transition-all"
                            autoComplete="new-salary"
                            name="employee-salary"
                          />
                        </div>
                      </div>

                      {/* Admin Access Toggle inside Modal */}
                      <div className="sm:col-span-2 flex items-center justify-between p-3.5 bg-amber-50/40 border border-amber-100/60 rounded-2xl mt-1">
                        <div className="flex gap-2.5 items-start">
                          <Shield className="w-5 h-5 text-amber-600 mt-0.5" />
                          <div className="space-y-0.5">
                            <span className="text-xs font-bold text-slate-800">Admin Privileges</span>
                            <p className="text-[10px] text-slate-500 leading-normal">Grant full system access and allow viewing all company documents/financial data.</p>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={isAdmin}
                          onChange={(e) => setIsAdmin(e.target.checked)}
                          className="w-4 h-4 rounded text-amber-650 focus:ring-amber-500/20 border-slate-350 cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>

                  <hr className="border-slate-100" />

                  {/* Credentials Section */}
                  <div className="space-y-4">
                    <h4 className="text-[11px] uppercase font-bold text-slate-400 tracking-wider">Login Credentials</h4>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Login ID */}
                      <div>
                        <label className="block text-xs font-bold text-slate-800 mb-1.5">Employee Login ID</label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                            type="text"
                            value={loginId}
                            onChange={(e) => setLoginId(e.target.value.toLowerCase())}
                            placeholder="e.g. john.doe (no spaces)"
                            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none text-sm transition-all font-mono"
                            required
                            disabled={modalMode === 'edit'}
                            autoComplete="new-username"
                            name="employee-login-id"
                          />
                        </div>
                      </div>

                      {/* Password */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block text-xs font-bold text-slate-800">Password</label>
                          <button
                            type="button"
                            onClick={() => {
                              const newPass = generateStrongPassword(10);
                              setPassword(newPass);
                              setShowPassword(true);
                              setFormError('');
                              showToast('Generated strong compliant password!', 'info');
                            }}
                            className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 hover:underline cursor-pointer"
                            title="Generate strong compliant password"
                          >
                            <RefreshCw className="w-3 h-3" />
                            <span>Auto-generate</span>
                          </button>
                        </div>
                        <div className="relative">
                          <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => {
                              setPassword(e.target.value);
                              if (formError) setFormError('');
                            }}
                            placeholder="Min 8 chars (uppercase, lowercase, number, symbol)"
                            className="w-full pl-9 pr-10 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none text-sm transition-all font-mono"
                            required
                            autoComplete="new-password"
                            name="employee-password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <hr className="border-slate-100" />

                  {/* Permissions Checklist Section */}
                  <div className="space-y-3">
                    <label className="block text-[11px] uppercase font-bold text-slate-400 tracking-wider">Access Permissions</label>
                    
                    <div className="border border-slate-100 rounded-2xl divide-y divide-slate-100 overflow-hidden bg-slate-50/30 grid grid-cols-1 sm:grid-cols-2 divide-x-0 sm:divide-x border-collapse">
                      
                      {/* Document Viewer */}
                      <label className="flex items-center justify-between p-3 hover:bg-slate-50/50 transition-colors cursor-pointer border-b border-slate-100">
                        <div className="space-y-0.5">
                          <p className="text-xs font-bold text-slate-800">View Documents</p>
                          <p className="text-[10px] text-slate-400 font-medium">Access document lists and previews</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={permissions.viewDocuments}
                          onChange={() => handleTogglePermission('viewDocuments')}
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500/20 border-slate-350 mr-1"
                        />
                      </label>

                      {/* Add Invoice */}
                      <label className="flex items-center justify-between p-3 hover:bg-slate-50/50 transition-colors cursor-pointer border-b border-slate-100">
                        <div className="space-y-0.5">
                          <p className="text-xs font-bold text-slate-800">Add Invoices</p>
                          <p className="text-[10px] text-slate-400 font-medium">Create invoices for customers</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={permissions.addInvoice}
                          onChange={() => handleTogglePermission('addInvoice')}
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500/20 border-slate-350 mr-1"
                        />
                      </label>

                      {/* Add Voucher */}
                      <label className="flex items-center justify-between p-3 hover:bg-slate-50/50 transition-colors cursor-pointer border-b border-slate-100">
                        <div className="space-y-0.5">
                          <p className="text-xs font-bold text-slate-800">Add Vouchers</p>
                          <p className="text-[10px] text-slate-400 font-medium">Generate credit/debit vouchers</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={permissions.addVoucher}
                          onChange={() => handleTogglePermission('addVoucher')}
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500/20 border-slate-350 mr-1"
                        />
                      </label>

                      {/* Add Receipt */}
                      <label className="flex items-center justify-between p-3 hover:bg-slate-50/50 transition-colors cursor-pointer border-b border-slate-100">
                        <div className="space-y-0.5">
                          <p className="text-xs font-bold text-slate-800">Add Receipts</p>
                          <p className="text-[10px] text-slate-400 font-medium">Record and issue payment receipts</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={permissions.addReceipt}
                          onChange={() => handleTogglePermission('addReceipt')}
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500/20 border-slate-350 mr-1"
                        />
                      </label>

                      {/* Add Expense */}
                      <label className="flex items-center justify-between p-3 hover:bg-slate-50/50 transition-colors cursor-pointer border-b border-slate-100 sm:border-b-0">
                        <div className="space-y-0.5">
                          <p className="text-xs font-bold text-slate-800">Add Expenses</p>
                          <p className="text-[10px] text-slate-400 font-medium">Create expense entries & vouchers</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={permissions.addExpense}
                          onChange={() => handleTogglePermission('addExpense')}
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500/20 border-slate-350 mr-1"
                        />
                      </label>

                      {/* View Ledger */}
                      <label className="flex items-center justify-between p-3 hover:bg-slate-50/50 transition-colors cursor-pointer border-b border-slate-100 sm:border-b-0">
                        <div className="space-y-0.5">
                          <p className="text-xs font-bold text-slate-800">View Ledger</p>
                          <p className="text-[10px] text-slate-400 font-medium">Inspect books and particulars</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={permissions.viewLedger}
                          onChange={() => handleTogglePermission('viewLedger')}
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500/20 border-slate-350 mr-1"
                        />
                      </label>

                      {/* Access Recycle Bin */}
                      <label className="flex items-center justify-between p-3 hover:bg-slate-50/50 transition-colors cursor-pointer">
                        <div className="space-y-0.5">
                          <p className="text-xs font-bold text-slate-800">Access Recycle Bin</p>
                          <p className="text-[10px] text-slate-400 font-medium">Restore deleted records</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={permissions.accessRecycleBin}
                          onChange={() => handleTogglePermission('accessRecycleBin')}
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500/20 border-slate-350 mr-1"
                        />
                      </label>

                      {/* Access Recurring Payments */}
                      <label className="flex items-center justify-between p-3 hover:bg-slate-50/50 transition-colors cursor-pointer">
                        <div className="space-y-0.5">
                          <p className="text-xs font-bold text-slate-800">Access Recurring Payments</p>
                          <p className="text-[10px] text-slate-400 font-medium">Manage recurring subscription reminders</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={permissions.accessRecurringPayments}
                          onChange={() => handleTogglePermission('accessRecurringPayments')}
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500/20 border-slate-350 mr-1"
                        />
                      </label>

                    </div>
                  </div>

                  {formError && (
                    <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs px-3 py-2.5 rounded-xl font-semibold flex items-center gap-1.5 mt-2">
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                      <span>{formError}</span>
                    </div>
                  )}

                </form>
              </div>

              {/* Actions Footer */}
              <div className="flex items-center gap-3 p-5 border-t border-slate-100 shrink-0 bg-slate-50/50">
                <Button
                  variant="outline"
                  className="flex-1 rounded-xl py-2.5 text-sm font-semibold"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-2.5 text-sm font-bold shadow-md shadow-indigo-50 cursor-pointer"
                  onClick={handleSave}
                >
                  {modalMode === 'add' ? 'Create Login' : 'Save Changes'}
                </Button>
              </div>

            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteEmployeeId && (
          <ConfirmModal
            isOpen={true}
            title="Remove Employee Login"
            message="Are you sure you want to delete this employee? They will lose access immediately and all their manual credentials will be removed."
            onConfirm={handleDelete}
            onClose={() => setDeleteEmployeeId(null)}
            confirmText="Delete"
            confirmVariant="danger"
          />
        )}

        {/* Verify Admin Password Modal */}
        {verifyAdminEmp && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
            <div className="bg-white border border-[#f1f3f9] rounded-3xl w-full max-w-md p-6 md:p-8 shadow-2xl relative animate-in zoom-in-95 duration-200">
              {/* Close Button */}
              <button 
                onClick={() => setVerifyAdminEmp(null)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors bg-slate-50 hover:bg-slate-100 p-1.5 rounded-full cursor-pointer border-none outline-none"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="text-center space-y-4">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-50 text-amber-600 border border-amber-100">
                  <Shield className="w-6 h-6 stroke-[2px]" />
                </div>

                <div className="space-y-1.5">
                  <h3 className="text-base font-extrabold text-slate-900">Make Employee Admin</h3>
                  <p className="text-xs text-slate-500 font-semibold max-w-[280px] mx-auto leading-relaxed">
                    To make <span className="text-indigo-600 font-bold">{verifyAdminEmp.name}</span> an Admin, please enter your admin password for verification.
                  </p>
                </div>

                <div className="space-y-4 pt-2">
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                      <Lock className="w-4 h-4" />
                    </span>
                    <input
                      type={showVerifyPassword ? "text" : "password"}
                      value={verifyPasswordInput}
                      onChange={(e) => {
                        setVerifyPasswordInput(e.target.value);
                        setVerifyError('');
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleConfirmAdmin();
                      }}
                      placeholder="Enter admin password..."
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-600 focus:bg-white transition-all text-slate-800"
                      autoComplete="new-password"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowVerifyPassword(!showVerifyPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 bg-transparent border-none cursor-pointer p-0"
                    >
                      {showVerifyPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {verifyError && (
                    <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-100/50 text-rose-600 px-3.5 py-2.5 rounded-xl text-[11px] font-bold text-left animate-shake">
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                      <span>{verifyError}</span>
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => setVerifyAdminEmp(null)}
                      className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer bg-white"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleConfirmAdmin}
                      className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-100 transition-all cursor-pointer border-none"
                    >
                      Verify & Promote
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Detailed Profile View Modal ("Big Card") */}
        {activeEmployeeDetail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
            <div 
              className="absolute inset-0 cursor-pointer" 
              onClick={() => setActiveEmployeeDetail(null)}
            />
            <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200 font-sans">
              
              {/* Header */}
              <div className="flex items-center justify-between p-6 pb-4 border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-3.5">
                  <div className="relative group/avatar">
                    {activeEmployeeDetail.photo ? (
                      <img 
                        src={activeEmployeeDetail.photo} 
                        alt={activeEmployeeDetail.name} 
                        className="w-16 h-16 rounded-2xl object-cover border border-slate-200/80 shadow-xs" 
                      />
                    ) : (
                      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center font-extrabold text-lg uppercase shadow-xs ${
                        activeEmployeeDetail.isAdmin 
                          ? 'bg-amber-50 border border-amber-100 text-amber-600' 
                          : 'bg-indigo-50 border border-indigo-100 text-indigo-600'
                      }`}>
                        {activeEmployeeDetail.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                      </div>
                    )}
                    
                    <label htmlFor="photoUploadDetail" className="absolute -bottom-1 -right-1 w-6 h-6 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center cursor-pointer shadow-md transition-all">
                      <Plus className="w-3.5 h-3.5" />
                      <input 
                        type="file" 
                        id="photoUploadDetail" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={(e) => handlePhotoUpload(e, activeEmployeeDetail.id)} 
                      />
                    </label>
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-extrabold text-slate-900 text-lg leading-tight">{activeEmployeeDetail.name}</h3>
                      {activeEmployeeDetail.isAdmin && (
                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded bg-amber-50 border border-amber-100 text-amber-700 text-[10px] font-bold">
                          <Shield className="w-3 h-3 text-amber-500" />
                          Admin
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 font-semibold mt-1">
                      {activeEmployeeDetail.designation || 'Staff'} • Joined {new Date(activeEmployeeDetail.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <button 
                  onClick={() => setActiveEmployeeDetail(null)}
                  className="w-8 h-8 rounded-xl border border-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Navigation Tabs */}
              <div className="flex border-b border-slate-100 bg-slate-50/50 px-6 shrink-0">
                <button
                  onClick={() => setActiveTab('info')}
                  className={`py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                    activeTab === 'info' 
                      ? 'border-indigo-600 text-indigo-600' 
                      : 'border-transparent text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Overview & Access
                </button>
                <button
                  onClick={() => setActiveTab('invoices')}
                  className={`py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'invoices' 
                      ? 'border-indigo-600 text-indigo-600' 
                      : 'border-transparent text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <span>Invoices</span>
                  <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">
                    {employeeDocsList.filter(d => d.documentType === 'invoice').length}
                  </span>
                </button>
                <button
                  onClick={() => setActiveTab('documents')}
                  className={`py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'documents' 
                      ? 'border-indigo-600 text-indigo-600' 
                      : 'border-transparent text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <span>Vouchers & Receipts</span>
                  <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">
                    {employeeDocsList.filter(d => d.documentType !== 'invoice').length}
                  </span>
                </button>
                <button
                  onClick={() => setActiveTab('expenses')}
                  className={`py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'expenses' 
                      ? 'border-indigo-600 text-indigo-600' 
                      : 'border-transparent text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <span>Expenses</span>
                  <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">
                    {employeeExpensesList.length}
                  </span>
                </button>
              </div>

              {/* Modal Body Content */}
              <div className="flex-1 overflow-y-auto p-6">
                
                {/* 1. Overview Tab */}
                {activeTab === 'info' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      
                      {/* Personal Contact Details */}
                      <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 space-y-4">
                        <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Contact Details</h4>
                        
                        <div className="space-y-3">
                          <div className="flex items-center justify-between text-xs bg-white p-2.5 rounded-xl border border-slate-200/60">
                            <div className="flex items-center gap-2.5">
                              <Lock className="w-4 h-4 text-slate-400" />
                              <div>
                                <p className="text-[10px] text-slate-400 font-semibold">Employee Login ID</p>
                                <p className="font-mono font-bold text-slate-800">{activeEmployeeDetail.loginId}</p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(activeEmployeeDetail.loginId, 'Employee ID')}
                              className="text-slate-400 hover:text-indigo-600 transition-colors p-1 rounded-lg hover:bg-slate-50 cursor-pointer"
                              title="Copy Employee ID"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="flex items-center justify-between text-xs bg-white p-2.5 rounded-xl border border-slate-200/60">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <Key className="w-4 h-4 text-slate-400 shrink-0" />
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 leading-none">
                                  <span className="text-[10px] text-slate-400 font-semibold">Password</span>
                                  {activeEmployeeDetail.mustChangePassword ? (
                                    <span className="text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200/80 px-1.5 py-0.5 rounded-md leading-none">
                                      Temporary
                                    </span>
                                  ) : (
                                    <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-1.5 py-0.5 rounded-md leading-none">
                                      Active
                                    </span>
                                  )}
                                </div>
                                <p className="font-mono font-bold text-slate-800 text-xs mt-1 truncate tracking-wider">
                                  {showDetailPassword ? activeEmployeeDetail.password : '••••••••••••'}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0 ml-2">
                              <button
                                type="button"
                                onClick={() => setShowDetailPassword(!showDetailPassword)}
                                className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors rounded-lg hover:bg-slate-50 cursor-pointer"
                                title={showDetailPassword ? "Hide password" : "Show password"}
                              >
                                {showDetailPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(activeEmployeeDetail.password, 'Password')}
                                className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors rounded-lg hover:bg-slate-50 cursor-pointer"
                                title="Copy Password"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                              {!activeEmployeeDetail.mustChangePassword ? (
                                <button
                                  type="button"
                                  onClick={() => handleOpenResetPassword(activeEmployeeDetail)}
                                  className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 px-2 py-1 rounded-lg transition-all cursor-pointer whitespace-nowrap ml-1 shadow-2xs active:scale-95"
                                  title="Reset employee password to a temporary password"
                                >
                                  <RotateCcw className="w-3 h-3 text-amber-600" />
                                  <span>Reset</span>
                                </button>
                              ) : (
                                <span 
                                  className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400 bg-slate-100 border border-slate-200/60 px-2 py-1 rounded-lg cursor-not-allowed whitespace-nowrap ml-1"
                                  title="Reset will be available once employee sets permanent password on login"
                                >
                                  <RotateCcw className="w-3 h-3 text-slate-300" />
                                  <span>Pending</span>
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-3 text-xs">
                            <Phone className="w-4 h-4 text-slate-400" />
                            <div>
                              <p className="text-[10px] text-slate-400 font-semibold">Phone Number</p>
                              <p className="font-semibold text-slate-800">{activeEmployeeDetail.phone || 'Not provided'}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 text-xs">
                            <Mail className="w-4 h-4 text-slate-400" />
                            <div>
                              <p className="text-[10px] text-slate-400 font-semibold">Email Address</p>
                              <p className="font-semibold text-slate-800 truncate max-w-[200px]" title={activeEmployeeDetail.email}>
                                {activeEmployeeDetail.email || 'Not provided'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 text-xs">
                            <Banknote className="w-4 h-4 text-slate-400" />
                            <div>
                              <p className="text-[10px] text-slate-400 font-semibold">Salary</p>
                              <p className="font-bold text-emerald-700">
                                {activeEmployeeDetail.salary !== undefined && activeEmployeeDetail.salary !== ''
                                  ? formatCurrency(Number(activeEmployeeDetail.salary), activeCompany?.currency ? activeCompany.currency.split(' ')[1] || '₹' : '₹')
                                  : 'Not provided'}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Summary Metrics */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-blue-50/50 border border-blue-100/60 rounded-2xl p-4 flex flex-col justify-between">
                          <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Total Invoices</span>
                          <div className="mt-4">
                            <p className="text-2xl font-black text-blue-900 leading-none">
                              {employeeDocsList.filter(d => d.documentType === 'invoice').length}
                            </p>
                            <p className="text-[9px] text-blue-500 font-semibold mt-1">Generated by employee</p>
                          </div>
                        </div>

                        <div className="bg-purple-50/50 border border-purple-100/60 rounded-2xl p-4 flex flex-col justify-between">
                          <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider">Other Docs</span>
                          <div className="mt-4">
                            <p className="text-2xl font-black text-purple-900 leading-none">
                              {employeeDocsList.filter(d => d.documentType !== 'invoice').length}
                            </p>
                            <p className="text-[9px] text-purple-500 font-semibold mt-1">Vouchers & Receipts</p>
                          </div>
                        </div>

                        <div className="bg-rose-50/50 border border-rose-100/60 rounded-2xl p-4 flex flex-col justify-between col-span-2">
                          <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">Total Expenses Logs</span>
                          <div className="mt-4 flex justify-between items-end">
                            <div>
                              <p className="text-2xl font-black text-rose-900 leading-none">
                                {employeeExpensesList.length}
                              </p>
                              <p className="text-[9px] text-rose-500 font-semibold mt-1">Total transactions logged</p>
                            </div>
                            <span className="text-xs font-bold text-rose-700 bg-rose-100/60 px-2 py-0.5 rounded-lg">
                              Sum: {formatCurrency(employeeExpensesList.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0), activeCompany?.currency ? activeCompany.currency.split(' ')[1] || '₹' : '₹')}
                            </span>
                          </div>
                        </div>
                      </div>

                    </div>

                    {/* Permissions list */}
                    <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 space-y-3">
                      <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Assigned Features & Privileges</h4>
                      
                      {activeEmployeeDetail.isAdmin ? (
                        <div className="flex gap-2.5 items-start p-3 bg-amber-50 border border-amber-100/60 rounded-xl">
                          <Shield className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-xs font-bold text-slate-900">Administrator Access Enabled</p>
                            <p className="text-[10px] text-slate-500 mt-0.5 leading-normal">
                              This employee is designated as an Admin and has full system-wide read and write permissions, bypassing normal checks.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          {Object.entries(activeEmployeeDetail.permissions || {}).map(([permKey, val]) => {
                            const labels: Record<string, string> = {
                              viewDocuments: 'View Documents & Lists',
                              addInvoice: 'Create Customer Invoices',
                              addVoucher: 'Create Voucher Logs',
                              addReceipt: 'Create Payment Receipts',
                              addExpense: 'Add Expense Particulars',
                              viewLedger: 'View Company Ledger',
                              accessRecycleBin: 'Access Recycle Bin',
                              accessRecurringPayments: 'Access Recurring Reminders'
                            };
                            return (
                              <div key={permKey} className="flex items-center gap-2 p-2 bg-white border border-slate-100 rounded-xl">
                                <span className={`w-2 h-2 rounded-full ${val ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                                <span className={`font-semibold ${val ? 'text-slate-700' : 'text-slate-400 line-through'}`}>
                                  {labels[permKey] || permKey}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 2. Invoices Tab */}
                {activeTab === 'invoices' && (
                  <div className="space-y-4">
                    {employeeDocsList.filter(d => d.documentType === 'invoice').length === 0 ? (
                      <div className="text-center py-12 bg-slate-50 border border-slate-100 rounded-2xl text-slate-400">
                        <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-xs font-bold">No Invoices Saved</p>
                        <p className="text-[10px] mt-0.5">This employee hasn't created any invoices yet.</p>
                      </div>
                    ) : (
                      <div className="border border-slate-100 rounded-2xl overflow-hidden divide-y divide-slate-100 bg-white">
                        {employeeDocsList.filter(d => d.documentType === 'invoice').map(doc => (
                          <div key={doc.id} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-all text-xs">
                            <div className="space-y-1">
                              <span className="font-mono font-bold text-slate-900">{doc.documentNumber}</span>
                              <p className="text-[10px] text-slate-400 font-semibold">
                                To: {doc.customer?.customerName || 'N/A'} • {new Date(doc.documentDate || doc.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                doc.status === 'Paid' ? 'bg-emerald-50 border border-emerald-100 text-emerald-700' : 'bg-rose-50 border border-rose-100 text-rose-700'
                              }`}>
                                {doc.status}
                              </span>
                              <span className="font-bold text-slate-800">
                                {formatCurrency(doc.totals?.grandTotal || parseFloat(doc.amount) || 0, activeCompany?.currency ? activeCompany.currency.split(' ')[1] || '₹' : '₹')}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 3. Vouchers & Receipts Tab */}
                {activeTab === 'documents' && (
                  <div className="space-y-4">
                    {employeeDocsList.filter(d => d.documentType !== 'invoice').length === 0 ? (
                      <div className="text-center py-12 bg-slate-50 border border-slate-100 rounded-2xl text-slate-400">
                        <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-xs font-bold">No Vouchers or Receipts</p>
                        <p className="text-[10px] mt-0.5">This employee hasn't created any vouchers or receipts yet.</p>
                      </div>
                    ) : (
                      <div className="border border-slate-100 rounded-2xl overflow-hidden divide-y divide-slate-100 bg-white">
                        {employeeDocsList.filter(d => d.documentType !== 'invoice').map(doc => (
                          <div key={doc.id} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-all text-xs">
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono font-bold text-slate-900">{doc.documentNumber}</span>
                                <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[9px] font-bold uppercase">{doc.documentType}</span>
                              </div>
                              <p className="text-[10px] text-slate-400 font-semibold">
                                {doc.voucherType || (doc.documentType === 'receipt' ? 'Receipt' : 'Other')} • {new Date(doc.documentDate || doc.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-slate-500 max-w-[150px] truncate" title={doc.paidTo || doc.receivedFrom}>
                                {doc.paidTo || doc.receivedFrom}
                              </span>
                              <span className="font-bold text-slate-800">
                                {formatCurrency(doc.totals?.grandTotal || parseFloat(doc.amount) || 0, activeCompany?.currency ? activeCompany.currency.split(' ')[1] || '₹' : '₹')}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 4. Expenses Tab */}
                {activeTab === 'expenses' && (
                  <div className="space-y-4">
                    {employeeExpensesList.length === 0 ? (
                      <div className="text-center py-12 bg-slate-50 border border-slate-100 rounded-2xl text-slate-400">
                        <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-xs font-bold">No Expenses Logged</p>
                        <p className="text-[10px] mt-0.5">This employee hasn't logged any expenses yet.</p>
                      </div>
                    ) : (
                      <div className="border border-slate-100 rounded-2xl overflow-hidden divide-y divide-slate-100 bg-white">
                        {employeeExpensesList.map(exp => (
                          <div key={exp.id} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-all text-xs">
                            <div className="space-y-1">
                              <span className="font-bold text-slate-900">{exp.particulars}</span>
                              <p className="text-[10px] text-slate-400 font-semibold">
                                {exp.category} • {new Date(exp.date || exp.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-slate-500 font-medium">{exp.paidVia || 'Cash'}</span>
                              <span className="font-bold text-rose-600">
                                {formatCurrency(parseFloat(exp.amount) || 0, activeCompany?.currency ? activeCompany.currency.split(' ')[1] || '₹' : '₹')}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

              </div>

              {/* Footer */}
              <div className="p-5 border-t border-slate-100 bg-slate-50/50 shrink-0 flex justify-end gap-3">
                <label htmlFor="photoUploadDetailBtn" className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all cursor-pointer shadow-md shadow-indigo-50">
                  <UserPlus className="w-4 h-4" />
                  <span>Upload Photo</span>
                  <input 
                    type="file" 
                    id="photoUploadDetailBtn" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={(e) => handlePhotoUpload(e, activeEmployeeDetail.id)} 
                  />
                </label>
              </div>

            </div>
          </div>
        )}

        {/* Reset Employee Password Modal (Admin Only) */}
        {resetModalEmp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
            <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 space-y-5 animate-in zoom-in-95 duration-200 font-sans">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shadow-2xs">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-base leading-tight">Reset Password</h3>
                    <p className="text-[11px] text-slate-400 font-medium">Generate temporary login credentials</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setResetModalEmp(null)}
                  className="w-7 h-7 rounded-xl border border-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Target Employee Info */}
              <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-3.5 flex items-center gap-3">
                {resetModalEmp.photo ? (
                  <img
                    src={resetModalEmp.photo}
                    alt={resetModalEmp.name}
                    className="w-10 h-10 rounded-xl object-cover border border-slate-200"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs uppercase shrink-0">
                    {resetModalEmp.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h4 className="font-bold text-slate-900 text-xs truncate">{resetModalEmp.name}</h4>
                  <p className="text-[10px] text-slate-400 font-mono">ID: {resetModalEmp.loginId}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                    <CheckCircle2 className="w-2.5 h-2.5" />
                    Active Pass
                  </span>
                </div>
              </div>

              {/* Current Password Preview */}
              <div className="bg-slate-50/70 border border-slate-200/60 rounded-xl px-3.5 py-2.5 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium text-[11px]">Current Active Password:</span>
                <span className="font-mono font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200/60 text-[11px]">
                  {resetModalEmp.password}
                </span>
              </div>

              {/* Notice / Explanation */}
              <div className="p-3 bg-amber-50/70 border border-amber-200/60 rounded-xl text-[11px] text-amber-900 leading-relaxed space-y-1">
                <p className="font-semibold text-amber-950">How this works:</p>
                <p>
                  Setting this temporary password will require <span className="font-bold">{resetModalEmp.name}</span> to enter a <strong>New Password</strong> and <strong>Confirm Password</strong> upon their next login.
                </p>
                <p className="text-amber-800">
                  Once they complete setup, their new password will automatically update and be displayed here in your Admin dashboard.
                </p>
              </div>

              {/* Temporary Password Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800">New Temporary Password</label>
                  <button
                    type="button"
                    onClick={() => setResetTempPassword(generateStrongPassword(10))}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 hover:underline cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Auto-generate</span>
                  </button>
                </div>

                <div className="relative">
                  <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type={showResetTempPassword ? "text" : "password"}
                    value={resetTempPassword}
                    onChange={(e) => setResetTempPassword(e.target.value)}
                    className="w-full pl-10 pr-20 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-indigo-600 focus:bg-white transition-all"
                    required
                  />
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setShowResetTempPassword(!showResetTempPassword)}
                      className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                      title={showResetTempPassword ? "Hide password" : "Show password"}
                    >
                      {showResetTempPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(resetTempPassword, 'Temporary Password')}
                      className="p-1 text-slate-400 hover:text-indigo-600 cursor-pointer"
                      title="Copy Password"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setResetModalEmp(null)}
                  className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                  disabled={resetPasswordLoading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmResetPassword}
                  disabled={resetPasswordLoading}
                  className="flex-1 py-2.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-bold text-xs rounded-xl shadow-md shadow-amber-600/20 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{resetPasswordLoading ? 'Resetting...' : 'Confirm Reset'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reset Success Modal with Quick Copy */}
        {resetSuccessModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
            <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 text-center space-y-4 animate-in zoom-in-95 duration-200 font-sans">
              <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 mx-auto shadow-2xs">
                <CheckCircle2 className="w-6 h-6 stroke-[2.5]" />
              </div>

              <div className="space-y-1">
                <h3 className="font-extrabold text-slate-900 text-base">Password Reset Completed</h3>
                <p className="text-xs text-slate-500">
                  Share these temporary credentials with <span className="font-bold text-slate-800">{resetSuccessModal.empName}</span>.
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200/70 rounded-2xl p-3.5 text-left space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-semibold">Employee ID:</span>
                  <span className="font-mono font-bold text-slate-800">{resetSuccessModal.loginId}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-semibold">Temporary Password:</span>
                  <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100">
                    {resetSuccessModal.tempPass}
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-slate-400">
                On next login, the employee will be prompted to create and confirm their permanent password.
              </p>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    copyToClipboard(`Employee ID: ${resetSuccessModal.loginId}\nTemporary Password: ${resetSuccessModal.tempPass}`, 'Credentials');
                  }}
                  className="flex-1 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl border border-indigo-200/70 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Details</span>
                </button>
                <button
                  type="button"
                  onClick={() => setResetSuccessModal(null)}
                  className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Floating Action Button (FAB) for adding employee - Unique design */}
        <div className="fixed bottom-20 right-6 z-40 flex items-center justify-center">
          {/* Glow pulsing ring behind the button */}
          <span className="absolute inline-flex h-14 w-14 rounded-[20px] bg-indigo-400 opacity-25 animate-ping duration-1000 pointer-events-none"></span>
          <button
            onClick={handleOpenAddModal}
            className="relative w-14 h-14 bg-gradient-to-tr from-indigo-600 via-indigo-650 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-[20px] flex items-center justify-center shadow-lg shadow-indigo-600/30 hover:shadow-xl hover:scale-105 active:scale-95 transition-all cursor-pointer border border-white/10 group"
            title="Add Employee"
          >
            {/* Plus icon inside with rotation animation on hover */}
            <Plus className="w-6 h-6 stroke-[2.8] transition-transform duration-300 group-hover:rotate-90" />
          </button>
        </div>

      </div>
    </MainLayout>
  );
};
