import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { 
  getAllCompanies, 
  saveCompany as dbSaveCompany, 
  deleteCompany as dbDeleteCompany, 
  getActiveCompanyId, 
  setActiveCompanyId as dbSetActiveCompanyId,
  getLocalCompanyIds,
  rowToCompany
} from '../services/db';


const CompanyContext = createContext(null);

export const defaultCompanyState = {
  companyName: '',
  businessType: 'Private Limited',
  logo: '',
  watermarkLogo: '',
  cfoSignature: '',
  themeColor: '#f97316',
  gstNumber: '',
  panNumber: '',
  email: '',
  phone: '',
  website: '',
  address: '',
  city: '',
  state: '',
  country: 'India',
  pincode: '',
  cin: '',
  udyamNumber: '',
  bankDetails: {
    bankName: '',
    accountHolder: '',
    accountNumber: '',
    ifsc: '',
    branch: '',
    upiId: '',
    accountType: 'Saving',
    dailyLimit: 100000
  },
  invoicePrefix: 'INV-',
  invoiceStartNumber: 1001,
  voucherPrefix: 'VCH-',
  voucherStartNumber: 1001,
  receiptPrefix: 'REC-',
  receiptStartNumber: 1001,
  defaultTax: 18,
  currency: 'INR ₹',
  paymentTerms: 'Payment due within 15 days of invoice date.',
  termsAndConditions: 'Payment due within 15 days of invoice date.',
  notes: 'Thank you for your business!',
  paymentInstructions: 'Please include invoice number on your payment reference.',
  selectedTemplate: 'UNAI Billing',
  companyCode: '',
  companyPassword: ''
};

export const CompanyProvider = ({ children }) => {
  const [companies, setCompanies] = useState([]);
  const [activeCompany, setActiveCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const suppressRealtimeRef = useRef(false);
  const realtimeDebounceRef = useRef(null);

  const [isAuthenticated, setIsAuthenticated] = useState(() => localStorage.getItem('isSessionAuthenticated') === 'true');

  const setAuthenticatedState = (val) => {
    if (val) {
      localStorage.setItem('isSessionAuthenticated', 'true');
    } else {
      localStorage.removeItem('isSessionAuthenticated');
    }
    setIsAuthenticated(val);
  };


  const loadData = useCallback(async () => {
    console.log('[CompanyContext] loadData started, setting loading = true');
    setLoading(true);
    try {
      console.log('[CompanyContext] Awaiting getLocalCompanyIds...');
      let localIdsArray = await getLocalCompanyIds();
      console.log('[CompanyContext] getLocalCompanyIds returned:', localIdsArray);
      let mergedIdsArray = [...localIdsArray];

      console.log('[CompanyContext] Awaiting getAllCompanies...');
      const list = await getAllCompanies(mergedIdsArray);
      console.log('[CompanyContext] getAllCompanies returned:', list);
      const mergedIdsSetObj = new Set(mergedIdsArray);
      
      // Sync cloud companies locally so they exist in IndexedDB/LocalStorage
      const localIdsSet = new Set(localIdsArray);
      for (const comp of list) {
        if (comp && comp.id && mergedIdsSetObj.has(comp.id) && !localIdsSet.has(comp.id)) {
          await dbSaveCompany(comp).catch(console.error);
        }
      }

      // Filter out duplicate profiles by ID or company name, and only keep locally joined/created ones
      const uniqueList = [];
      const seenIds = new Set();
      const seenNames = new Set();

      for (let comp of list) {
        if (!comp || !comp.companyName) continue;
        if (!mergedIdsSetObj.has(comp.id)) continue;
        const normName = comp.companyName.trim().toLowerCase();
        if (!seenIds.has(comp.id) && !seenNames.has(normName)) {
          seenIds.add(comp.id);
          seenNames.add(normName);

          uniqueList.push(comp);
        }
      }

      console.log('[CompanyContext] Setting companies uniqueList:', uniqueList);
      setCompanies(uniqueList);

      console.log('[CompanyContext] Awaiting getActiveCompanyId...');
      const activeId = await getActiveCompanyId();
      console.log('[CompanyContext] getActiveCompanyId returned:', activeId);
      let active = null;
      if (activeId) {
        active = uniqueList.find(c => c.id === activeId) || null;
      }
      if (!active && uniqueList.length > 0) {
        active = uniqueList[0];
        console.log('[CompanyContext] Setting active company to uniqueList[0]:', active);
        await dbSetActiveCompanyId(active.id);
      }
      console.log('[CompanyContext] Setting activeCompany:', active);
      setActiveCompany(active);
    } catch (err) {
      console.error('[CompanyContext] Failed to load company data error:', err);
    } finally {
      console.log('[CompanyContext] loadData finally block, setting loading = false');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const switchCompany = async (companyId) => {
    if (!companyId) {
      setActiveCompany(null);
      await dbSetActiveCompanyId(null);
      localStorage.removeItem('activeEmployee');
      return;
    }
    let found = companies.find(c => c.id === companyId);
    if (!found) {
      const list = await getAllCompanies();
      found = list.find(c => c.id === companyId);
    }
    if (found) {
      setActiveCompany(found);
      await dbSetActiveCompanyId(found.id);
    }
  };

  const saveCompanyProfile = async (companyData) => {
    const id = companyData.id || `cmp_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const terms = companyData.paymentTerms || companyData.termsAndConditions || defaultCompanyState.paymentTerms;
    const fullData = { 
      ...defaultCompanyState, 
      ...companyData, 
      id,
      paymentTerms: terms,
      termsAndConditions: terms
    };
    
    const saved = await dbSaveCompany(fullData);
    
    await loadData();
    await switchCompany(saved.id);
    return saved;
  };

  const updateActiveCompany = async (updates) => {
    if (!activeCompany) return null;
    const terms = updates.paymentTerms || updates.termsAndConditions || activeCompany.paymentTerms;
    const updated = { 
      ...activeCompany, 
      ...updates,
      ...(updates.paymentTerms || updates.termsAndConditions ? { paymentTerms: terms, termsAndConditions: terms } : {})
    };
    const saved = await dbSaveCompany(updated);
    
    setCompanies(prev => prev.map(c => c.id === saved.id ? saved : c));
    setActiveCompany(saved);
    return saved;
  };

  const removeCompany = async (companyId) => {
    await dbDeleteCompany(companyId);
    const updatedList = companies.filter(c => c.id !== companyId);
    setCompanies(updatedList);
    
    if (activeCompany?.id === companyId) {
      const nextActive = updatedList[0] || null;
      setActiveCompany(nextActive);
      await dbSetActiveCompanyId(nextActive ? nextActive.id : null);
    }
  };

  const value = {
    companies,
    activeCompany,
    loading,
    switchCompany,
    saveCompanyProfile,
    updateActiveCompany,
    removeCompany,
    reloadCompanies: loadData,
    isAuthenticated,
    setAuthenticatedState
  };

  return (
    <CompanyContext.Provider value={value}>
      {children}
    </CompanyContext.Provider>
  );
};

export const useCompany = () => {
  const context = useContext(CompanyContext);
  if (!context) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }
  return context;
};
