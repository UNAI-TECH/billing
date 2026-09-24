import { openDB } from 'idb';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const DB_NAME = 'SaaSInvoiceDB';
const DB_VERSION = 4;

// --- IN-MEMORY CACHE FOR EGRESS OPTIMIZATION ---
interface CacheEntry {
  data: any;
  timestamp: number;
  dbVersion: string;
}

const queryCache: {
  companies?: CacheEntry;
  documents: { [companyId: string]: CacheEntry };
  expenses: { [companyId: string]: CacheEntry };
  reminders: { [companyId: string]: CacheEntry };
  activeCompanyId?: CacheEntry;
} = {
  documents: {},
  expenses: {},
  reminders: {}
};

const CACHE_TTL_MS = 30000; // 30 seconds TTL

function getDbVersion(): string {
  try {
    return localStorage.getItem('saas_billing_db_version') || '0';
  } catch (e) {
    return '0';
  }
}

function incrementDbVersion() {
  try {
    const current = parseInt(localStorage.getItem('saas_billing_db_version') || '0', 10);
    localStorage.setItem('saas_billing_db_version', (current + 1).toString());
  } catch (e) {}
}

function isCacheValid(entry: CacheEntry | undefined): boolean {
  if (!entry) return false;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) return false;
  if (entry.dbVersion !== getDbVersion()) return false;
  return true;
}

function cloneData<T>(data: T): T {
  return JSON.parse(JSON.stringify(data));
}

let dbInstance: any = null;
let dbFailed = false;

let mockDataCleaned = false;

async function checkAndCleanMockData(db: any) {
  // Disabled mock data cleanup to prevent active company session deletion on page refresh
  return;
}

async function getDB() {
  if (dbInstance) {
    if (!mockDataCleaned) {
      checkAndCleanMockData(dbInstance).catch(console.error);
    }
    return dbInstance;
  }
  if (dbFailed) return null;

  try {
    dbInstance = await openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('companies')) {
          const companyStore = db.createObjectStore('companies', { keyPath: 'id' });
          companyStore.createIndex('updatedAt', 'updatedAt');
        }
        if (!db.objectStoreNames.contains('documents')) {
          const docStore = db.createObjectStore('documents', { keyPath: 'id' });
          docStore.createIndex('companyId', 'companyId');
          docStore.createIndex('documentType', 'documentType');
          docStore.createIndex('createdAt', 'createdAt');
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('expenses')) {
          const expenseStore = db.createObjectStore('expenses', { keyPath: 'id' });
          expenseStore.createIndex('companyId', 'companyId');
          expenseStore.createIndex('projectEvent', 'projectEvent');
        }
        if (!db.objectStoreNames.contains('recurring_reminders')) {
          const reminderStore = db.createObjectStore('recurring_reminders', { keyPath: 'id' });
          reminderStore.createIndex('companyId', 'companyId');
        }
        if (!db.objectStoreNames.contains('recycle_bin')) {
          const recycleStore = db.createObjectStore('recycle_bin', { keyPath: 'id' });
          recycleStore.createIndex('companyId', 'companyId');
          recycleStore.createIndex('deletedAt', 'deletedAt');
        }
      },
    });

    if (dbInstance) {
      await checkAndCleanMockData(dbInstance).catch(console.error);
    }

    return dbInstance;
  } catch (err) {
    console.warn('IndexedDB unavailable, using localStorage fallback.', err);
    dbFailed = true;
    return null;
  }
}

// Fallback LocalStorage Helpers
const LOCAL_STORAGE_KEYS = {
  COMPANIES: 'saas_billing_companies',
  DOCUMENTS: 'saas_billing_documents',
  EXPENSES: 'saas_billing_expenses',
  ACTIVE_COMPANY: 'saas_billing_active_company_id',
  RECYCLE_BIN: 'saas_billing_recycle_bin'
};

function getLocalJSON(key: string, defaultVal: any = []) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : defaultVal;
  } catch (e) {
    console.error('LocalStorage error', e);
    return defaultVal;
  }
}

function setLocalJSON(key: string, val: any) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (e) {
    console.error('LocalStorage write error', e);
  }
}

// Named exports for mapping helper functions
export function companyToRow(c: any): any {
  return {
    id: c.id,
    company_name: c.companyName,
    business_type: c.businessType,
    logo: c.logo,
    watermark_logo: c.watermarkLogo,
    theme_color: c.themeColor,
    gst_number: c.gstNumber,
    pan_number: c.panNumber,
    email: c.email,
    phone: c.phone,
    website: c.website,
    address: c.address,
    city: c.city,
    state: c.state,
    country: c.country,
    pincode: c.pincode,
    cin: c.cin,
    udyam_number: c.udyamNumber,
    bank_details: {
      ...(c.bankDetails || {}),
      _monthlyBudgets: c.monthlyBudgets || {},
      _yearlyBudget: c.yearlyBudget,
      _monthlyBudget: c.monthlyBudget,
      _cfoSignature: c.cfoSignature
    },
    invoice_prefix: c.invoicePrefix,
    invoice_start_number: c.invoiceStartNumber,
    voucher_prefix: c.voucherPrefix,
    voucher_start_number: c.voucherStartNumber,
    receipt_prefix: c.receiptPrefix,
    receipt_start_number: c.receiptStartNumber,
    default_tax: c.defaultTax,
    currency: c.currency,
    payment_terms: c.paymentTerms || c.termsAndConditions || c.terms || '',
    notes: c.notes,
    payment_instructions: c.paymentInstructions,
    selected_template: c.selectedTemplate,
    company_code: c.companyCode,
    company_password: c.companyPassword,
    updated_at: c.updatedAt || new Date().toISOString(),
    created_at: c.createdAt || new Date().toISOString()
  };
}

export function rowToCompany(r: any): any {
  const terms = r.payment_terms || r.paymentTerms || r.terms_and_conditions || r.terms || '';
  return {
    id: r.id,
    companyName: r.company_name || r.companyName,
    businessType: r.business_type || r.businessType,
    logo: r.logo,
    watermarkLogo: r.watermark_logo || r.watermarkLogo || '',
    themeColor: r.theme_color || r.themeColor,
    gstNumber: r.gst_number || r.gstNumber,
    panNumber: r.pan_number || r.panNumber,
    email: r.email,
    phone: r.phone,
    website: r.website,
    address: r.address,
    city: r.city,
    state: r.state,
    country: r.country,
    pincode: r.pincode,
    cin: r.cin,
    udyamNumber: r.udyam_number || r.udyamNumber,
    bankDetails: (() => {
      const bd = r.bank_details || r.bankDetails || {};
      const { _monthlyBudgets, _yearlyBudget, _monthlyBudget, _cfoSignature, ...cleanBd } = bd;
      return cleanBd;
    })(),
    monthlyBudgets: (r.bank_details || r.bankDetails)?._monthlyBudgets || r.monthlyBudgets || {},
    yearlyBudget: (r.bank_details || r.bankDetails)?._yearlyBudget ?? r.yearlyBudget,
    monthlyBudget: (r.bank_details || r.bankDetails)?._monthlyBudget ?? r.monthlyBudget,
    cfoSignature: (r.bank_details || r.bankDetails)?._cfoSignature || r.cfoSignature || '',
    invoicePrefix: r.invoice_prefix || r.invoicePrefix,
    invoiceStartNumber: r.invoice_start_number || r.invoiceStartNumber,
    voucherPrefix: r.voucher_prefix || r.voucherPrefix,
    voucherStartNumber: r.voucher_start_number || r.voucherStartNumber,
    receiptPrefix: r.receipt_prefix || r.receiptPrefix,
    receiptStartNumber: r.receipt_start_number || r.receiptStartNumber,
    defaultTax: r.default_tax || r.defaultTax,
    currency: r.currency,
    paymentTerms: terms,
    termsAndConditions: terms,
    notes: r.notes,
    paymentInstructions: r.payment_instructions || r.paymentInstructions,
    selectedTemplate: r.selected_template || r.selectedTemplate,
    companyCode: r.company_code || r.companyCode,
    companyPassword: r.company_password || r.companyPassword,
    createdAt: r.created_at || r.createdAt,
    updatedAt: r.updated_at || r.updatedAt
  };
}

export function docToRow(d: any): any {
  // Store extra fields in the JSONB customer object so they sync to Supabase without requiring schema migration
  const customerWithMeta = {
    ...(d.customer || {}),
    _voucherType: d.voucherType,
    _paymentMethod: d.paymentMethod,
    _description: d.description,
    _createdBy: d.createdBy,
    _paymentTerms: d.paymentTerms || d.terms
  };

  return {
    id: d.id,
    company_id: d.companyId,
    document_number: d.documentNumber,
    document_type: d.documentType,
    document_date: d.documentDate,
    due_date: d.dueDate,
    status: d.status,
    customer: customerWithMeta,
    items: d.items || [],
    totals: d.totals || {},
    paid_to: d.paidTo,
    received_from: d.receivedFrom,
    amount: d.amount || 0,
    template: d.template,
    notes: d.notes,
    terms: d.terms || d.paymentTerms || '',
    discount: typeof d.discount === 'object' && d.discount !== null ? parseFloat(d.discount.value) || 0 : parseFloat(d.discount) || 0,
    updated_at: d.updatedAt || new Date().toISOString(),
    created_at: d.createdAt || new Date().toISOString()
  };
}

export function rowToDoc(r: any): any {
  const customerObj = r.customer || {};
  const { _voucherType, _paymentMethod, _description, _createdBy, _paymentTerms, ...cleanCustomer } = customerObj;
  const resolvedTerms = r.terms || _paymentTerms || r.payment_terms || r.paymentTerms || '';

  return {
    id: r.id,
    companyId: r.company_id || r.companyId,
    documentNumber: r.document_number || r.documentNumber,
    documentType: r.document_type || r.documentType,
    documentDate: r.document_date || r.documentDate,
    dueDate: r.due_date || r.dueDate,
    status: r.status,
    customer: cleanCustomer,
    items: r.items || [],
    totals: r.totals || {},
    paidTo: r.paid_to || r.paidTo,
    receivedFrom: r.received_from || r.receivedFrom,
    amount: r.amount,
    template: r.template,
    notes: r.notes,
    terms: resolvedTerms,
    paymentTerms: resolvedTerms,
    discount: typeof r.discount === 'number' ? { type: 'fixed', value: r.discount } : (r.discount || { type: 'percentage', value: 0 }),
    createdAt: r.created_at || r.createdAt,
    updatedAt: r.updated_at || r.updatedAt,
    voucherType: _voucherType || r.voucher_type || r.voucherType,
    paymentMethod: _paymentMethod || r.payment_method || r.paymentMethod,
    description: _description || r.description,
    createdBy: _createdBy || r.created_by || r.createdBy || 'Admin'
  };
}

export function rowToExpense(r: any): any {
  return {
    id: r.id,
    companyId: r.company_id || r.companyId,
    particulars: r.particulars,
    amount: parseFloat(r.amount) || 0,
    category: r.category,
    date: r.date,
    projectEvent: r.project_event || r.projectEvent || '',
    paidVia: r.paid_via || r.paidVia || 'Cash',
    createdAt: r.created_at || r.createdAt,
    updatedAt: r.updated_at || r.updatedAt
  };
}

export function rowToReminder(r: any): any {
  return {
    id: r.id,
    companyId: r.company_id || r.companyId,
    type: r.type,
    title: r.title,
    amount: parseFloat(r.amount) || 0,
    frequency: r.frequency,
    nextDate: r.next_date || r.nextDate,
    reminderDaysBefore: parseInt(r.reminder_days_before || r.reminderDaysBefore) || 1,
    emails: r.emails || [],
    status: r.status || 'active',
    createdAt: r.created_at || r.createdAt,
    updatedAt: r.updated_at || r.updatedAt
  };
}

// ==========================================
// Service APIs (Supabase + Local Fallback)
// ==========================================

export async function getAllCompanies(companyIds: string[] | null = null) {
  // Check if cache is valid first
  if (isCacheValid(queryCache.companies)) {
    const cachedList = cloneData(queryCache.companies!.data);
    if (companyIds) {
      const idsSet = new Set(companyIds);
      return cachedList.filter((c: any) => idsSet.has(c.id));
    }
    return cachedList;
  }

  let list: any[] = [];
  if (isSupabaseConfigured()) {
    try {
      if (companyIds && companyIds.length === 0) {
        list = [];
      } else {
        let query = supabase.from('companies').select('*');
        if (companyIds) {
          query = query.in('id', companyIds);
        }
        const { data, error } = await query.order('created_at', { ascending: false });
        if (!error && data) {
          list = data.map(rowToCompany);
        } else if (error) {
          console.warn('Supabase getAllCompanies error:', error.message, 'Code:', error.code, error);
        }
      }
    } catch (e) {
      console.error('Supabase fetch error:', e);
    }
  }

  if (!list || list.length === 0) {
    const db = await getDB();
    if (db) {
      try {
        list = await db.getAll('companies');
      } catch (e) {
        console.error(e);
      }
    }
  }

  if (!list || list.length === 0) {
    list = getLocalJSON(LOCAL_STORAGE_KEYS.COMPANIES, []);
  }

  // Deduplicate by ID
  const seenIds = new Set();
  const uniqueCompanies = [];

  for (const c of list) {
    if (!c || !c.companyName) continue;
    if (!seenIds.has(c.id)) {
      seenIds.add(c.id);
      uniqueCompanies.push(c);
    }
  }

  // Populate cache with the full list
  queryCache.companies = {
    data: uniqueCompanies,
    timestamp: Date.now(),
    dbVersion: getDbVersion()
  };

  if (companyIds) {
    const idsSet = new Set(companyIds);
    return uniqueCompanies.filter(c => idsSet.has(c.id));
  }

  return uniqueCompanies;
}

export async function getCompanyById(id: string) {
  // Check companies cache
  if (isCacheValid(queryCache.companies)) {
    const found = queryCache.companies!.data.find((c: any) => c.id === id);
    if (found) return cloneData(found);
  }

  if (isSupabaseConfigured()) {
    try {
      const { data } = await supabase.from('companies').select('*').eq('id', id).single();
      if (data) return rowToCompany(data);
    } catch (e) {
      console.error('getCompanyById Supabase error:', e);
    }
  }

  const db = await getDB();
  if (db) {
    try {
      const company = await db.get('companies', id);
      if (company) return company;
    } catch (e) {
      console.error(e);
    }
  }
  const list = getLocalJSON(LOCAL_STORAGE_KEYS.COMPANIES, []);
  return list.find(c => c.id === id) || null;
}

export async function getLocalCompanyIds(): Promise<string[]> {
  const ids = new Set<string>();
  const db = await getDB();
  if (db) {
    try {
      const locals = await db.getAll('companies');
      if (locals) {
        locals.forEach(c => { if (c && c.id) ids.add(c.id); });
      }
    } catch (e) {
      console.error(e);
    }
  }
  const lsLocals = getLocalJSON(LOCAL_STORAGE_KEYS.COMPANIES, []);
  if (lsLocals) {
    lsLocals.forEach(c => { if (c && c.id) ids.add(c.id); });
  }
  return Array.from(ids);
}

export async function saveCompany(company: any, localOnly = false) {
  incrementDbVersion();
  const now = new Date().toISOString();
  const companyData = {
    ...company,
    updatedAt: now,
    createdAt: company.createdAt || now
  };

  if (isSupabaseConfigured() && !localOnly) {
    try {
      const row = companyToRow(companyData);
      const { error } = await supabase.from('companies').upsert(row);
      if (error) console.error('Supabase saveCompany error:', error);
    } catch (e) {
      console.error('Supabase saveCompany catch:', e);
    }
  }

  const db = await getDB();
  if (db) {
    try {
      await db.put('companies', companyData);
    } catch (e) {
      console.error('IDB saveCompany error', e);
    }
  }

  // Backup to localStorage
  const list = getLocalJSON(LOCAL_STORAGE_KEYS.COMPANIES, []);
  const idx = list.findIndex(c => c.id === companyData.id);
  if (idx >= 0) {
    list[idx] = companyData;
  } else {
    list.push(companyData);
  }
  setLocalJSON(LOCAL_STORAGE_KEYS.COMPANIES, list);

  return companyData;
}

export async function deleteCompany(id: string, localOnly = false) {
  incrementDbVersion();
  if (isSupabaseConfigured() && !localOnly) {
    try {
      await supabase.from('companies').delete().eq('id', id);
    } catch (e) {
      console.error('Supabase deleteCompany error:', e);
    }
  }

  const db = await getDB();
  if (db) {
    try {
      await db.delete('companies', id);
    } catch (e) {
      console.error('IDB deleteCompany error', e);
    }
  }
  const list = getLocalJSON(LOCAL_STORAGE_KEYS.COMPANIES, []);
  const filtered = list.filter(c => c.id !== id);
  setLocalJSON(LOCAL_STORAGE_KEYS.COMPANIES, filtered);
}

export async function getActiveCompanyId() {
  if (isCacheValid(queryCache.activeCompanyId)) {
    return queryCache.activeCompanyId!.data;
  }

  let value: string | null = null;
  if (isSupabaseConfigured()) {
    try {
      const { data } = await supabase.from('settings').select('value').eq('key', 'activeCompanyId').single();
      if (data?.value) value = data.value;
    } catch (e) {
      console.error(e);
    }
  }

  if (!value) {
    const db = await getDB();
    if (db) {
      try {
        const setting = await db.get('settings', 'activeCompanyId');
        if (setting) value = setting.value;
      } catch (e) {
        console.error(e);
      }
    }
  }

  if (!value) {
    value = localStorage.getItem(LOCAL_STORAGE_KEYS.ACTIVE_COMPANY) || null;
  }

  queryCache.activeCompanyId = {
    data: value,
    timestamp: Date.now(),
    dbVersion: getDbVersion()
  };

  return value;
}

export async function setActiveCompanyId(id: string | null) {
  incrementDbVersion();
  queryCache.activeCompanyId = {
    data: id,
    timestamp: Date.now(),
    dbVersion: getDbVersion()
  };

  if (isSupabaseConfigured()) {
    try {
      await supabase.from('settings').upsert({ key: 'activeCompanyId', value: id, updated_at: new Date().toISOString() });
    } catch (e) {
      console.error('Supabase setActiveCompanyId error:', e);
    }
  }

  const db = await getDB();
  if (db) {
    try {
      await db.put('settings', { key: 'activeCompanyId', value: id });
    } catch (e) {
      console.error(e);
    }
  }
  if (id) {
    localStorage.setItem(LOCAL_STORAGE_KEYS.ACTIVE_COMPANY, id);
  } else {
    localStorage.removeItem(LOCAL_STORAGE_KEYS.ACTIVE_COMPANY);
  }
}

export async function getAllDocuments(companyId: string | null = null) {
  const cacheKey = companyId || 'all';
  if (isCacheValid(queryCache.documents[cacheKey])) {
    return cloneData(queryCache.documents[cacheKey].data);
  }

  let docs: any[] = [];
  if (isSupabaseConfigured()) {
    try {
      let query = supabase.from('documents').select('*');
      if (companyId) {
        query = query.eq('company_id', companyId);
      }
      const { data, error } = await query;
      if (!error && data) {
        docs = data.map(rowToDoc);
      } else if (error) {
        console.warn('Supabase getAllDocuments error:', error);
      }
    } catch (e) {
      console.error('Supabase fetch documents catch:', e);
    }
  }

  if (!docs || docs.length === 0) {
    const db = await getDB();
    if (db) {
      try {
        if (companyId) {
          docs = await db.getAllFromIndex('documents', 'companyId', companyId);
        } else {
          docs = await db.getAll('documents');
        }
      } catch (e) {
        console.error('IDB getAllDocuments error', e);
      }
    }
  }
  if (!docs || docs.length === 0) {
    docs = getLocalJSON(LOCAL_STORAGE_KEYS.DOCUMENTS, []);
    if (companyId) {
      docs = docs.filter(d => d.companyId === companyId);
    }
  }

  queryCache.documents[cacheKey] = {
    data: docs,
    timestamp: Date.now(),
    dbVersion: getDbVersion()
  };

  return docs;
}

export async function saveDocument(document: any, localOnly = false) {
  incrementDbVersion();
  const now = new Date().toISOString();
  const docData = {
    ...document,
    updatedAt: now,
    createdAt: document.createdAt || now
  };

  if (isSupabaseConfigured() && !localOnly) {
    try {
      const row = docToRow(docData);
      const { error } = await supabase.from('documents').upsert(row);
      if (error) console.error('Supabase saveDocument error:', error);
    } catch (e) {
      console.error('Supabase saveDocument catch:', e);
    }
  }

  const db = await getDB();
  if (db) {
    try {
      await db.put('documents', docData);
    } catch (e) {
      console.error('IDB saveDocument error', e);
    }
  }

  // Backup to localStorage
  const list = getLocalJSON(LOCAL_STORAGE_KEYS.DOCUMENTS, []);
  const idx = list.findIndex(d => d.id === docData.id);
  if (idx >= 0) {
    list[idx] = docData;
  } else {
    list.push(docData);
  }
  setLocalJSON(LOCAL_STORAGE_KEYS.DOCUMENTS, list);

  return docData;
}

export async function updateCompanyDocumentsTerms(companyId: string, newTerms: string) {
  if (!companyId) return;
  incrementDbVersion();
  const now = new Date().toISOString();

  // 1. Update in local storage
  const lsDocs = getLocalJSON(LOCAL_STORAGE_KEYS.DOCUMENTS, []);
  let updatedLs = false;
  lsDocs.forEach((d: any) => {
    if (d && d.companyId === companyId) {
      d.terms = newTerms;
      d.paymentTerms = newTerms;
      d.updatedAt = now;
      updatedLs = true;
    }
  });
  if (updatedLs) {
    setLocalJSON(LOCAL_STORAGE_KEYS.DOCUMENTS, lsDocs);
  }

  // 2. Update in IndexedDB
  const db = await getDB();
  if (db) {
    try {
      const allDocs = await db.getAllFromIndex('documents', 'companyId', companyId);
      for (const d of allDocs) {
        d.terms = newTerms;
        d.paymentTerms = newTerms;
        d.updatedAt = now;
        await db.put('documents', d);
      }
    } catch (e) {
      console.error('IDB updateCompanyDocumentsTerms error', e);
    }
  }

  // 3. Update in Supabase if configured
  if (isSupabaseConfigured()) {
    try {
      await supabase
        .from('documents')
        .update({ terms: newTerms, updated_at: now })
        .eq('company_id', companyId);
    } catch (e) {
      console.error('Supabase updateCompanyDocumentsTerms error:', e);
    }
  }

  // Invalidate query cache
  delete queryCache.documents[companyId];
  delete queryCache.documents['all'];
}

export async function getDocumentById(id: string) {
  // Check documents cache
  for (const cacheKey of Object.keys(queryCache.documents)) {
    if (isCacheValid(queryCache.documents[cacheKey])) {
      const found = queryCache.documents[cacheKey].data.find((d: any) => d.id === id);
      if (found) return cloneData(found);
    }
  }

  if (isSupabaseConfigured()) {
    try {
      const { data } = await supabase.from('documents').select('*').eq('id', id).single();
      if (data) return rowToDoc(data);
    } catch (e) {
      console.error(e);
    }
  }

  const db = await getDB();
  if (db) {
    try {
      const doc = await db.get('documents', id);
      if (doc) return doc;
    } catch (e) {
      console.error(e);
    }
  }
  const list = getLocalJSON(LOCAL_STORAGE_KEYS.DOCUMENTS, []);
  return list.find(d => d.id === id) || null;
}

export async function deleteDocument(id: string, localOnly = false) {
  incrementDbVersion();
  const doc = await getDocumentById(id);
  if (doc) {
    await moveToRecycleBin(id, 'document', doc, doc.companyId);
  }

  if (isSupabaseConfigured() && !localOnly) {
    try {
      await supabase.from('documents').delete().eq('id', id);
    } catch (e) {
      console.error('Supabase deleteDocument error:', e);
    }
  }

  const db = await getDB();
  if (db) {
    try {
      await db.delete('documents', id);
    } catch (e) {
      console.error('IDB deleteDocument error', e);
    }
  }
  const list = getLocalJSON(LOCAL_STORAGE_KEYS.DOCUMENTS, []);
  const filtered = list.filter(d => d.id !== id);
  setLocalJSON(LOCAL_STORAGE_KEYS.DOCUMENTS, filtered);
}

export async function clearAllData() {
  incrementDbVersion();
  queryCache.companies = undefined;
  queryCache.documents = {};
  queryCache.expenses = {};
  queryCache.reminders = {};
  queryCache.activeCompanyId = undefined;

  if (isSupabaseConfigured()) {
    try {
      await supabase.from('documents').delete().neq('id', '');
      await supabase.from('companies').delete().neq('id', '');
      await supabase.from('settings').delete().neq('key', '');
      await supabase.from('expenses').delete().neq('id', '');
      await supabase.from('recurring_reminders').delete().neq('id', '');
    } catch (e) {
      console.error('Supabase clearAllData error:', e);
    }
  }

  const db = await getDB();
  if (db) {
    try {
      await db.clear('companies');
      await db.clear('documents');
      await db.clear('settings');
      await db.clear('expenses');
      await db.clear('recurring_reminders');
    } catch (e) {
      console.error(e);
    }
  }
  localStorage.removeItem(LOCAL_STORAGE_KEYS.COMPANIES);
  localStorage.removeItem(LOCAL_STORAGE_KEYS.DOCUMENTS);
  localStorage.removeItem(LOCAL_STORAGE_KEYS.ACTIVE_COMPANY);
  localStorage.removeItem(LOCAL_STORAGE_KEYS.EXPENSES);
  localStorage.removeItem('saas_billing_recurring_reminders');
  
  // Clear all sync flags
  Object.keys(localStorage).forEach(key => {
    if (key.startsWith('supabase_synced_')) {
      localStorage.removeItem(key);
    }
  });

  // Clean all simulated email logs
  Object.keys(localStorage).forEach(key => {
    if (key.startsWith('simulated_email_logs_')) {
      localStorage.removeItem(key);
    }
  });
}

/**
 * Looks up a company by its unique join code and verifies the password.
 * Returns the company object on success, or throws on failure.
 */
export async function joinCompanyByCode(code: string, password: string) {
  incrementDbVersion();
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured. Join Company requires a cloud connection.');
  }

  const sanitizedCode = code.replace(/^#\s*/, '').trim().toUpperCase();

  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .eq('company_code', sanitizedCode)
    .single();

  if (error || !data) {
    throw new Error('Company not found. Please check the Company ID and try again.');
  }

  if (data.company_password !== password) {
    throw new Error('Incorrect password. Please try again.');
  }

  const company = rowToCompany(data);

  // Save locally so the user has it cached
  const db = await getDB();
  if (db) {
    try { await db.put('companies', company); } catch (e) { console.error(e); }
  }
  const list = getLocalJSON(LOCAL_STORAGE_KEYS.COMPANIES, []);
  if (!list.find(c => c.id === company.id)) {
    list.push(company);
    setLocalJSON(LOCAL_STORAGE_KEYS.COMPANIES, list);
  }

  return company;
}

// ==========================================
// Expenses APIs (Supabase + Local Fallback)
// ==========================================

export async function getAllExpenses(companyId: string | null = null) {
  const cacheKey = companyId || 'all';
  if (isCacheValid(queryCache.expenses[cacheKey])) {
    return cloneData(queryCache.expenses[cacheKey].data);
  }

  let expenses: any[] = [];
  if (isSupabaseConfigured()) {
    try {
      let query = supabase.from('expenses').select('*').order('date', { ascending: false });
      if (companyId) {
        query = query.eq('company_id', companyId);
      }
      const { data, error } = await query;
      if (!error && data) {
        expenses = data.map(rowToExpense);
      } else if (error) {
        console.warn('Supabase getAllExpenses error (could be missing table):', error);
      }
    } catch (e) {
      console.error('Supabase fetch expenses catch:', e);
    }
  }

  if (!expenses || expenses.length === 0) {
    const db = await getDB();
    if (db) {
      try {
        if (companyId) {
          expenses = await db.getAllFromIndex('expenses', 'companyId', companyId);
        } else {
          expenses = await db.getAll('expenses');
        }
      } catch (e) {
        console.error('IDB getAllExpenses error', e);
      }
    }
  }
  if (!expenses || expenses.length === 0) {
    expenses = getLocalJSON(LOCAL_STORAGE_KEYS.EXPENSES, []);
    if (companyId) {
      expenses = expenses.filter(e => e.companyId === companyId);
    }
  }
  
  // Sort by date descending and createdAt/id descending to show new expenses first
  expenses.sort((a, b) => {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    if (dateB !== dateA) {
      return dateB - dateA;
    }
    
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (timeB !== timeA) {
      return timeB - timeA;
    }
    
    return String(b.id).localeCompare(String(a.id));
  });

  queryCache.expenses[cacheKey] = {
    data: expenses,
    timestamp: Date.now(),
    dbVersion: getDbVersion()
  };

  return expenses;
}

export async function saveExpense(expense: any, localOnly = false) {
  incrementDbVersion();
  const now = new Date().toISOString();
  const expenseData = {
    ...expense,
    amount: parseFloat(expense.amount) || 0,
    updatedAt: now,
    createdAt: expense.createdAt || now
  };

  if (isSupabaseConfigured() && !localOnly) {
    try {
      const row = {
        id: expenseData.id,
        company_id: expenseData.companyId,
        particulars: expenseData.particulars,
        amount: expenseData.amount,
        category: expenseData.category,
        date: expenseData.date,
        project_event: expenseData.projectEvent || '',
        paid_via: expenseData.paidVia || 'Cash',
        created_at: expenseData.createdAt,
        updated_at: expenseData.updatedAt
      };
      const { error } = await supabase.from('expenses').upsert(row);
      if (error) console.error('Supabase saveExpense error (could be missing table):', error);
    } catch (e) {
      console.error('Supabase saveExpense catch:', e);
    }
  }

  const db = await getDB();
  if (db) {
    try {
      await db.put('expenses', expenseData);
    } catch (e) {
      console.error('IDB saveExpense error', e);
    }
  }

  // Backup to localStorage
  const list = getLocalJSON(LOCAL_STORAGE_KEYS.EXPENSES, []);
  const idx = list.findIndex(e => e.id === expenseData.id);
  if (idx >= 0) {
    list[idx] = expenseData;
  } else {
    list.push(expenseData);
  }
  setLocalJSON(LOCAL_STORAGE_KEYS.EXPENSES, list);

  return expenseData;
}

export async function deleteExpense(id: string, localOnly = false) {
  incrementDbVersion();
  
  let expense: any = null;
  const db = await getDB();
  if (db) {
    try {
      expense = await db.get('expenses', id);
    } catch (e) {
      console.error('IDB get expense error', e);
    }
  }
  if (!expense) {
    const list = getLocalJSON(LOCAL_STORAGE_KEYS.EXPENSES, []);
    expense = list.find((e: any) => e.id === id) || null;
  }
  if (expense) {
    await moveToRecycleBin(id, 'expense', expense, expense.companyId);
  }

  if (isSupabaseConfigured() && !localOnly) {
    try {
      await supabase.from('expenses').delete().eq('id', id);
    } catch (e) {
      console.error('Supabase deleteExpense error (could be missing table):', e);
    }
  }

  if (db) {
    try {
      await db.delete('expenses', id);
    } catch (e) {
      console.error('IDB deleteExpense error', e);
    }
  }
  const list = getLocalJSON(LOCAL_STORAGE_KEYS.EXPENSES, []);
  const filtered = list.filter(e => e.id !== id);
  setLocalJSON(LOCAL_STORAGE_KEYS.EXPENSES, filtered);
}

export async function getAllRecurringReminders(companyId: string | null = null) {
  const cacheKey = companyId || 'all';
  if (isCacheValid(queryCache.reminders[cacheKey])) {
    return cloneData(queryCache.reminders[cacheKey].data);
  }

  let list: any[] = [];
  if (isSupabaseConfigured()) {
    try {
      let query = supabase.from('recurring_reminders').select('*').order('created_at', { ascending: false });
      if (companyId) {
        query = query.eq('company_id', companyId);
      }
      const { data, error } = await query;
      if (!error && data) {
        list = data.map(rowToReminder);
      }
    } catch (e) {
      console.warn('Supabase recurring reminders fetch error:', e);
    }
  }

  if (!list || list.length === 0) {
    const db = await getDB();
    if (db) {
      try {
        if (companyId) {
          list = await db.getAllFromIndex('recurring_reminders', 'companyId', companyId);
        } else {
          list = await db.getAll('recurring_reminders');
        }
      } catch (e) {
        console.error('IDB getAllRecurringReminders error', e);
      }
    }
  }

  if (!list || list.length === 0) {
    list = getLocalJSON('saas_billing_recurring_reminders', []);
    if (companyId) {
      list = list.filter(r => r.companyId === companyId);
    }
  }

  queryCache.reminders[cacheKey] = {
    data: list,
    timestamp: Date.now(),
    dbVersion: getDbVersion()
  };

  return list;
}

export async function saveRecurringReminder(reminder: any, localOnly = false) {
  incrementDbVersion();
  const now = new Date().toISOString();
  const data = {
    ...reminder,
    amount: parseFloat(reminder.amount) || 0,
    updatedAt: now,
    createdAt: reminder.createdAt || now
  };

  if (isSupabaseConfigured() && !localOnly) {
    try {
      const row = {
        id: data.id,
        company_id: data.companyId,
        type: data.type,
        title: data.title,
        amount: data.amount,
        frequency: data.frequency,
        next_date: data.nextDate,
        reminder_days_before: data.reminderDaysBefore,
        emails: data.emails,
        status: data.status,
        created_at: data.createdAt,
        updated_at: data.updatedAt
      };
      await supabase.from('recurring_reminders').upsert(row);
    } catch (e) {
      console.warn('Supabase saveRecurringReminder error:', e);
    }
  }

  const db = await getDB();
  if (db) {
    try {
      await db.put('recurring_reminders', data);
    } catch (e) {
      console.error('IDB saveRecurringReminder error', e);
    }
  }

  const list = getLocalJSON('saas_billing_recurring_reminders', []);
  const idx = list.findIndex(r => r.id === data.id);
  if (idx >= 0) {
    list[idx] = data;
  } else {
    list.push(data);
  }
  setLocalJSON('saas_billing_recurring_reminders', list);

  return data;
}

export async function deleteRecurringReminder(id: string, localOnly = false) {
  incrementDbVersion();
  if (isSupabaseConfigured() && !localOnly) {
    try {
      await supabase.from('recurring_reminders').delete().eq('id', id);
    } catch (e) {
      console.warn('Supabase deleteRecurringReminder error:', e);
    }
  }

  const db = await getDB();
  if (db) {
    try {
      await db.delete('recurring_reminders', id);
    } catch (e) {
      console.error('IDB deleteRecurringReminder error', e);
    }
  }

  const list = getLocalJSON('saas_billing_recurring_reminders', []);
  const filtered = list.filter(r => r.id !== id);
  setLocalJSON('saas_billing_recurring_reminders', filtered);
}

// ==========================================
// Recycle Bin APIs
// ==========================================

export interface RecycleBinItem {
  id: string;
  type: 'document' | 'expense';
  companyId: string;
  deletedAt: string;
  originalData: any;
}

export async function moveToRecycleBin(id: string, type: 'document' | 'expense', originalData: any, companyId: string) {
  const item: RecycleBinItem = {
    id,
    type,
    companyId,
    deletedAt: new Date().toISOString(),
    originalData
  };

  const db = await getDB();
  if (db) {
    try {
      await db.put('recycle_bin', item);
    } catch (e) {
      console.error('IDB moveToRecycleBin error', e);
    }
  }

  const list = getLocalJSON(LOCAL_STORAGE_KEYS.RECYCLE_BIN, []);
  const idx = list.findIndex((i: any) => i.id === id);
  if (idx >= 0) {
    list[idx] = item;
  } else {
    list.push(item);
  }
  setLocalJSON(LOCAL_STORAGE_KEYS.RECYCLE_BIN, list);

  return item;
}

export async function getRecycleBinItems(companyId: string) {
  // First auto-clean old items
  await autoCleanRecycleBin();

  let items: RecycleBinItem[] = [];
  const db = await getDB();
  if (db) {
    try {
      items = await db.getAllFromIndex('recycle_bin', 'companyId', companyId);
    } catch (e) {
      console.error('IDB getRecycleBinItems error', e);
    }
  }

  if (!items || items.length === 0) {
    items = getLocalJSON(LOCAL_STORAGE_KEYS.RECYCLE_BIN, []);
    items = items.filter((i: any) => i.companyId === companyId);
  }

  // Sort by deletedAt descending
  return items.sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());
}

export async function restoreFromRecycleBin(id: string) {
  // Find the item
  let item: RecycleBinItem | null = null;
  const db = await getDB();
  if (db) {
    try {
      item = await db.get('recycle_bin', id);
    } catch (e) {
      console.error('IDB get from recycle_bin error', e);
    }
  }

  if (!item) {
    const list = getLocalJSON(LOCAL_STORAGE_KEYS.RECYCLE_BIN, []);
    item = list.find((i: any) => i.id === id) || null;
  }

  if (!item) {
    throw new Error('Item not found in Recycle Bin');
  }

  // Save back to original store
  if (item.type === 'document') {
    await saveDocument(item.originalData);
  } else if (item.type === 'expense') {
    await saveExpense(item.originalData);
  }

  // Delete from recycle bin
  await deletePermanently(id);
}

export async function deletePermanently(id: string) {
  const db = await getDB();
  if (db) {
    try {
      await db.delete('recycle_bin', id);
    } catch (e) {
      console.error('IDB delete from recycle_bin error', e);
    }
  }

  const list = getLocalJSON(LOCAL_STORAGE_KEYS.RECYCLE_BIN, []);
  const filtered = list.filter((i: any) => i.id !== id);
  setLocalJSON(LOCAL_STORAGE_KEYS.RECYCLE_BIN, filtered);
}

export async function autoCleanRecycleBin() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const cutoffTime = thirtyDaysAgo.getTime();

  const db = await getDB();
  if (db) {
    try {
      const tx = db.transaction('recycle_bin', 'readwrite');
      const store = tx.objectStore('recycle_bin');
      const allItems = await store.getAll();
      for (const item of allItems) {
        if (new Date(item.deletedAt).getTime() < cutoffTime) {
          await store.delete(item.id);
        }
      }
      await tx.done;
    } catch (e) {
      console.error('IDB autoCleanRecycleBin error', e);
    }
  }

  // Fallback / sync localStorage
  const list = getLocalJSON(LOCAL_STORAGE_KEYS.RECYCLE_BIN, []);
  const filtered = list.filter((item: any) => new Date(item.deletedAt).getTime() >= cutoffTime);
  setLocalJSON(LOCAL_STORAGE_KEYS.RECYCLE_BIN, filtered);
}

function employeeToRow(emp: any, companyId: string) {
  return {
    company_id: companyId,
    employee_id: emp.loginId,
    name: emp.name,
    password: emp.password,
    designation: emp.designation || null,
    phone: emp.phone || null,
    email: emp.email || null,
    is_admin: !!emp.isAdmin,
    permissions: {
      ...emp.permissions,
      frontendId: emp.id,
      photo: emp.photo || '',
      salary: emp.salary || '',
      mustChangePassword: emp.mustChangePassword ?? false,
      passwordSetByEmployee: emp.passwordSetByEmployee ?? false,
      passwordUpdatedAt: emp.passwordUpdatedAt || null
    }
  };
}

function rowToEmployee(row: any): any {
  const perms = row.permissions || {};
  return {
    id: perms.frontendId || `emp_${row.employee_id}`,
    name: row.name,
    loginId: row.employee_id,
    password: row.password,
    phone: row.phone || '',
    email: row.email || '',
    designation: row.designation || '',
    salary: perms.salary || '',
    permissions: {
      viewDocuments: perms.viewDocuments ?? true,
      addInvoice: perms.addInvoice ?? true,
      addVoucher: perms.addVoucher ?? true,
      addReceipt: perms.addReceipt ?? true,
      addExpense: perms.addExpense ?? true,
      viewLedger: perms.viewLedger ?? true,
      accessRecycleBin: perms.accessRecycleBin ?? false,
      accessRecurringPayments: perms.accessRecurringPayments ?? false
    },
    isAdmin: !!row.is_admin,
    createdAt: row.created_at || new Date().toISOString(),
    photo: perms.photo || '',
    mustChangePassword: perms.mustChangePassword ?? false,
    passwordSetByEmployee: perms.passwordSetByEmployee ?? false,
    passwordUpdatedAt: perms.passwordUpdatedAt || null
  };
}

/**
 * Gets all employees for a specific company from dedicated employees table or settings fallback.
 */
export async function getCompanyEmployees(companyId: string): Promise<any[]> {
  incrementDbVersion();
  const key = `employees_${companyId}`;
  
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('company_id', companyId);
      if (error) throw error;
      if (data) {
        return data.map(row => rowToEmployee(row));
      }
    } catch (e) {
      console.error('Supabase getCompanyEmployees error, attempting settings fallback:', e);
      // Fallback to settings table if employees table has issues
      try {
        const { data, error } = await supabase
          .from('settings')
          .select('value')
          .eq('key', key);
        if (data && data.length > 0 && data[0].value) {
          return JSON.parse(data[0].value);
        }
      } catch (fallbackErr) {
        console.error('Settings fallback failed:', fallbackErr);
      }
    }
  }

  const db = await getDB();
  if (db) {
    try {
      const setting = await db.get('settings', key);
      if (setting && setting.value) {
        return JSON.parse(setting.value);
      }
    } catch (e) {
      console.error('IDB getCompanyEmployees error:', e);
    }
  }

  // Backup to localStorage
  try {
    const val = localStorage.getItem(key);
    if (val) return JSON.parse(val);
  } catch (e) {}

  return [];
}

/**
 * Saves all employees for a specific company to dedicated employees table and local settings fallback.
 */
export async function saveCompanyEmployees(companyId: string, employees: any[]): Promise<void> {
  incrementDbVersion();
  const key = `employees_${companyId}`;
  const value = JSON.stringify(employees);

  if (isSupabaseConfigured()) {
    try {
      // 1. Delete all current employee rows for this company
      await supabase
        .from('employees')
        .delete()
        .eq('company_id', companyId);

      // 2. Insert the updated list of employee rows
      if (employees.length > 0) {
        const rows = employees.map(emp => employeeToRow(emp, companyId));
        const { error } = await supabase
          .from('employees')
          .insert(rows);
        if (error) throw error;
      }
    } catch (e) {
      console.error('Supabase saveCompanyEmployees error, trying settings fallback:', e);
      // Fallback to settings table
      try {
        await supabase
          .from('settings')
          .upsert({ key, value, updated_at: new Date().toISOString() });
      } catch (fallbackErr) {
        console.error('Settings fallback save failed:', fallbackErr);
      }
    }
  }

  const db = await getDB();
  if (db) {
    try {
      await db.put('settings', { key, value });
    } catch (e) {
      console.error('IDB saveCompanyEmployees error:', e);
    }
  }

  // Backup to localStorage
  try {
    localStorage.setItem(key, value);
  } catch (e) {}
}

/**
 * Log in as an employee.
 * Looks up company by code, then verifies employee credentials in the company's settings/employees list.
 */
export async function loginAsEmployee(companyCode: string, employeeLoginId: string, employeePassword: string) {
  incrementDbVersion();
  const sanitizedCode = (companyCode || '').replace(/^#\s*/, '').trim().toUpperCase();
  const cleanLoginId = (employeeLoginId || '').trim().toLowerCase();
  const cleanPassword = (employeePassword || '').trim();

  if (!cleanLoginId || !cleanPassword) {
    throw new Error('Employee ID and Password are required.');
  }

  const matchEmp = (emp: any) => {
    if (!emp || !emp.loginId) return false;
    const loginMatches = emp.loginId.trim().toLowerCase() === cleanLoginId;
    const passMatches = emp.password === employeePassword || emp.password === cleanPassword;
    return loginMatches && passMatches;
  };

  // 1. If companyCode is provided, try that company first
  if (sanitizedCode) {
    let companyData: any = null;

    if (isSupabaseConfigured()) {
      try {
        const { data } = await supabase
          .from('companies')
          .select('*')
          .eq('company_code', sanitizedCode)
          .single();
        if (data) {
          companyData = rowToCompany(data);
        }
      } catch (e) {
        console.error('Supabase fetch company in employee login:', e);
      }
    }

    if (!companyData) {
      // Check locally in IndexedDB
      const db = await getDB();
      if (db) {
        const allComp = await db.getAll('companies');
        companyData = allComp.find(c => (c.companyCode || '').replace(/^#\s*/, '').trim().toUpperCase() === sanitizedCode);
      }
    }

    if (!companyData) {
      // Check localStorage
      const list = getLocalJSON(LOCAL_STORAGE_KEYS.COMPANIES, []);
      companyData = list.find(c => (c.companyCode || '').replace(/^#\s*/, '').trim().toUpperCase() === sanitizedCode);
    }

    if (companyData) {
      // Load the employees for this company
      const employees = await getCompanyEmployees(companyData.id);
      const foundEmp = employees.find(matchEmp);
      if (foundEmp) {
        return {
          company: companyData,
          employee: foundEmp
        };
      }
    }
  }

  // 2. If not found in the specified company or no companyCode was provided, search across ALL companies
  const companies = await getAllCompanies();
  for (const company of companies) {
    try {
      const employees = await getCompanyEmployees(company.id);
      const foundEmp = employees.find(matchEmp);
      if (foundEmp) {
        return {
          company,
          employee: foundEmp
        };
      }
    } catch (err) {
      console.error('Error fetching employees for company:', company.id, err);
    }
  }

  throw new Error('Invalid Employee ID or Password.');
}

/**
 * Gets payroll records for a specific company from the settings table.
 */
export async function getCompanyPayroll(companyId: string): Promise<any[]> {
  incrementDbVersion();
  const key = `payroll_${companyId}`;
  
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', key);
      if (data && data.length > 0 && data[0].value) {
        return JSON.parse(data[0].value);
      }
    } catch (e) {
      console.error('Supabase getCompanyPayroll error:', e);
    }
  }

  const db = await getDB();
  if (db) {
    try {
      const setting = await db.get('settings', key);
      if (setting && setting.value) {
        return JSON.parse(setting.value);
      }
    } catch (e) {
      console.error('IDB getCompanyPayroll error:', e);
    }
  }

  // Backup to localStorage
  try {
    const val = localStorage.getItem(key);
    if (val) return JSON.parse(val);
  } catch (e) {}

  return [];
}

/**
 * Saves all payroll records for a specific company to settings table.
 */
export async function saveCompanyPayroll(companyId: string, payroll: any[]): Promise<void> {
  incrementDbVersion();
  const key = `payroll_${companyId}`;
  const value = JSON.stringify(payroll);

  if (isSupabaseConfigured()) {
    try {
      await supabase
        .from('settings')
        .upsert({ key, value, updated_at: new Date().toISOString() });
    } catch (e) {
      console.error('Supabase saveCompanyPayroll error:', e);
    }
  }

  const db = await getDB();
  if (db) {
    try {
      await db.put('settings', { key, value });
    } catch (e) {
      console.error('IDB saveCompanyPayroll error:', e);
    }
  }

  // Backup to localStorage
  try {
    localStorage.setItem(key, value);
  } catch (e) {}
}

