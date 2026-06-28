import {
  bootstrap as bootstrapApi,
  saveProfileApi,
  saveCustomerApi,
  deleteCustomerApi,
  saveSaleApi,
  deleteSaleApi,
  markSalePaidApi,
  savePriceApi,
  deletePriceApi,
  saveInventoryApi,
  saveBillingApi,
  saveBrandingApi,
  logAuditApi,
  importDataApi,
  type BootstrapPayload,
} from './dataApi';
import { BillingConfig, normalizeBillingConfig } from './billingConfig';
import type { AuditLogEntry } from './auditLog';
import type {
  PermissionSet,
  UserProfile,
  PermissionCatalog,
  DataAccessScope,
  PermissionAction,
  UserSubscription,
} from './pages';
import type { SubscriptionStatus } from './subscription';

export interface Customer {
  id: string;
  name: string;
  phone: string;
  qrPreference: string;
  address?: string;
  notes?: string;
  ownerUserId?: string;
  ownerName?: string;
  ownerEmail?: string;
  updatedAt: number;
}

export interface Sale {
  id: string;
  customerId: string;
  customerName: string;
  milkType: string;
  liters: number;
  ratePerLiter: number;
  totalAmount: number;
  paymentStatus: string;
  paymentType: string;
  location: string;
  ownerUserId?: string;
  ownerName?: string;
  ownerEmail?: string;
  createdAt: number;
  updatedAt: number;
}

export interface PriceConfig {
  milkType: string;
  currentPrice: number;
  ownerUserId?: string;
  ownerName?: string;
  ownerEmail?: string;
  updatedAt: number;
}

export interface PriceLog {
  id: string;
  milkType: string;
  oldPrice: number;
  newPrice: number;
  ownerUserId?: string;
  ownerName?: string;
  ownerEmail?: string;
  timestamp: number;
}

export interface MilkInventory {
  dateStr: string;
  cowLiters: number;
  buffaloLiters: number;
  a2Liters: number;
  customStocksRaw: string;
  ownerUserId?: string;
  ownerName?: string;
  ownerEmail?: string;
  updatedAt: number;
}

export interface Profile {
  businessName: string;
  ownerName: string;
  mobileNumber: string;
  emailAddress: string;
  signupTimestamp: number;
  isLightTheme: boolean;
  language: string;
}

export interface TokenConfig {
  sessionExpirySeconds: number;
  loginExpirySeconds: number;
  subscriptionExpirySeconds: number;
  updatedAt: number;
}

export interface UserModel {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  subscription?: UserSubscription | null;
  permissions: PermissionSet;
  profile?: UserProfile;
  createdAt: number;
  updatedAt: number;
}

export interface BrandingConfig {
  bankName: string;
  systemName: string;
  logo: string;
  address: string;
  ownerUserId?: string;
  updatedAt: number;
}

export type { PermissionSet, UserProfile, PermissionCatalog, DataAccessScope, PermissionAction };

interface DataCache {
  profile: Profile | null;
  customers: Customer[];
  sales: Sale[];
  priceConfigs: PriceConfig[];
  priceLogs: PriceLog[];
  inventory: MilkInventory[];
  users: UserModel[];
  billingConfig: BillingConfig | null;
  brandingConfig: BrandingConfig | null;
  auditLogs: AuditLogEntry[];
  currentUser: UserModel | null;
  permissionCatalog: PermissionCatalog | null;
  isSuperAdmin: boolean;
  subscriptionStatus: SubscriptionStatus | null;
}

function emptyCache(): DataCache {
  return {
    profile: null,
    customers: [],
    sales: [],
    priceConfigs: [],
    priceLogs: [],
    inventory: [],
    users: [],
    billingConfig: null,
    brandingConfig: null,
    auditLogs: [],
    currentUser: null,
    permissionCatalog: null,
    isSuperAdmin: false,
    subscriptionStatus: null,
  };
}

class Repository {
  private static cache: DataCache = emptyCache();
  private static _initialized = false;
  private static _initPromise: Promise<void> | null = null;
  private static _sessionSuperAdmin = false;
  private static selectedUserId: string | null = null;
  private static originalSessionUser: UserModel | null = null;

  static isSessionSuperAdmin(): boolean {
    return this._sessionSuperAdmin;
  }

  static setSessionSuperAdmin(val: boolean): void {
    this._sessionSuperAdmin = val;
  }

  static isInitialized(): boolean {
    return this._initialized;
  }

  static ensureReady(): Promise<void> {
    return this.initialize();
  }

  static initialize(selectedUserId?: string | null): Promise<void> {
    if (selectedUserId !== undefined) {
      this._initialized = false;
      this._initPromise = this._doInitialize(selectedUserId);
      return this._initPromise;
    }
    if (this._initialized) return Promise.resolve();
    if (this._initPromise) return this._initPromise;
    this._initPromise = this._doInitialize();
    return this._initPromise;
  }

  private static applyBootstrap(data: BootstrapPayload): void {
    this.cache.profile = data.profile ? (data.profile as unknown as Profile) : null;
    this.cache.customers = (data.customers || []) as unknown as Customer[];
    this.cache.sales = (data.sales || []) as unknown as Sale[];
    this.cache.priceConfigs = (data.priceConfigs || []) as unknown as PriceConfig[];
    this.cache.priceLogs = (data.priceLogs || []) as unknown as PriceLog[];
    this.cache.inventory = (data.inventory || []) as unknown as MilkInventory[];
    this.cache.users = (data.users || []) as unknown as UserModel[];
    this.cache.billingConfig = data.billingConfig ? (data.billingConfig as unknown as BillingConfig) : null;
    this.cache.brandingConfig = data.brandingConfig ? (data.brandingConfig as unknown as BrandingConfig) : null;
    this.cache.auditLogs = (data.auditLogs || []) as unknown as AuditLogEntry[];
    this.cache.permissionCatalog = data.permissionCatalog || null;
    this.cache.isSuperAdmin = Boolean(data.isSuperAdmin);
    if (data.subscriptionStatus) {
      this.cache.subscriptionStatus = data.subscriptionStatus as SubscriptionStatus;
    }
    if (data.sessionUser) {
      this.cache.currentUser = data.sessionUser as unknown as UserModel;
      if (!this.originalSessionUser) {
        this.originalSessionUser = data.sessionUser as unknown as UserModel;
      }
    }
  }

  static isSuperAdmin(): boolean {
    return this.cache.isSuperAdmin || this.cache.currentUser?.role === 'superadmin';
  }

  static getPermissionCatalog(): PermissionCatalog | null {
    return this.cache.permissionCatalog;
  }

  static setPermissionCatalog(catalog: PermissionCatalog): void {
    this.cache.permissionCatalog = catalog;
  }

  static setSubscriptionStatus(status: SubscriptionStatus): void {
    this.cache.subscriptionStatus = status;
  }

  static getSubscriptionStatus(): SubscriptionStatus | null {
    return this.cache.subscriptionStatus;
  }

  static setSessionUser(user: UserModel | null, isSuperAdmin = false): void {
    this.cache.currentUser = user;
    this.cache.isSuperAdmin = isSuperAdmin;
    if (isSuperAdmin || user?.role === 'superadmin') {
      this._sessionSuperAdmin = true;
    }
    if (user && !this.originalSessionUser) {
      this.originalSessionUser = user;
    }
  }

  private static async _doInitialize(selectedUserId?: string | null): Promise<void> {
    try {
      const data = await bootstrapApi(selectedUserId);
      this.applyBootstrap(data);
    } catch (err) {
      console.error('[Repo] Bootstrap from API failed:', err);
      throw err;
    }
    this._initialized = true;
  }

  static async changeActiveUser(selectedUserId: string | null): Promise<void> {
    this.clearSession(true);
    this.selectedUserId = selectedUserId;
    await this.initialize(selectedUserId);
  }

  static async refreshFromServer(): Promise<void> {
    this._initialized = false;
    this._initPromise = null;
    await this.initialize();
  }

  static clearSession(isChangingUser = false): void {
    this.cache = emptyCache();
    this._initialized = false;
    this._initPromise = null;
    if (!isChangingUser) {
      this.selectedUserId = null;
      this.originalSessionUser = null;
    }
  }

  static exportSnapshot(): BootstrapPayload {
    return {
      profile: this.cache.profile as unknown as Record<string, unknown> | null,
      customers: this.cache.customers as unknown as Record<string, unknown>[],
      sales: this.cache.sales as unknown as Record<string, unknown>[],
      priceConfigs: this.cache.priceConfigs as unknown as Record<string, unknown>[],
      priceLogs: this.cache.priceLogs as unknown as Record<string, unknown>[],
      inventory: this.cache.inventory as unknown as Record<string, unknown>[],
      users: this.cache.users as unknown as Record<string, unknown>[],
      billingConfig: this.cache.billingConfig as unknown as Record<string, unknown> | null,
      brandingConfig: this.cache.brandingConfig as unknown as Record<string, unknown> | null,
      auditLogs: this.cache.auditLogs as unknown as Record<string, unknown>[],
    };
  }

  static async importSnapshot(payload: BootstrapPayload): Promise<void> {
    const data = await importDataApi(payload);
    this.applyBootstrap(data);
    this._initialized = true;
  }

  static getOriginalSessionUser(): UserModel | null {
    return this.originalSessionUser || this.cache.currentUser;
  }

  static getAllowedUsers(): UserModel[] {
    const sessionUser = this.getOriginalSessionUser();
    if (!sessionUser) return [];

    const isSuperAdminUser = this.isSuperAdmin() || sessionUser.role === 'superadmin' || sessionUser.permissions?.dataAccessScope?.mode === 'all';

    const scope = sessionUser.permissions?.dataAccessScope || { mode: 'own', sharedUserIds: [] };
    const allowedIds = new Set<string>();
    allowedIds.add(sessionUser.id);

    if (scope.mode === 'shared' && scope.sharedUserIds) {
      scope.sharedUserIds.forEach((id) => allowedIds.add(id));
    }

    // Include builtin-admin for superadmins or system admins
    if (isSuperAdminUser) {
      allowedIds.add('builtin-admin');
    }

    // Collect all ownerUserIds and ownerEmails present in the cache data (sales, customers, price configs, inventory)
    const activeOwnerMap = new Map<string, { id: string; name: string; email: string }>();

    this.cache.sales.forEach((s) => {
      if (s.ownerUserId) {
        activeOwnerMap.set(s.ownerUserId, {
          id: s.ownerUserId,
          name: s.ownerName || s.ownerEmail || s.ownerUserId,
          email: s.ownerEmail || '',
        });
      }
    });
    this.cache.customers.forEach((c) => {
      if (c.ownerUserId) {
        activeOwnerMap.set(c.ownerUserId, {
          id: c.ownerUserId,
          name: c.ownerName || c.ownerEmail || c.ownerUserId,
          email: c.ownerEmail || '',
        });
      }
    });
    this.cache.priceConfigs.forEach((p) => {
      if (p.ownerUserId) {
        activeOwnerMap.set(p.ownerUserId, {
          id: p.ownerUserId,
          name: p.ownerName || p.ownerEmail || p.ownerUserId,
          email: p.ownerEmail || '',
        });
      }
    });
    this.cache.inventory.forEach((i) => {
      if (i.ownerUserId) {
        activeOwnerMap.set(i.ownerUserId, {
          id: i.ownerUserId,
          name: i.ownerName || i.ownerEmail || i.ownerUserId,
          email: i.ownerEmail || '',
        });
      }
    });

    const resultUsers = this.cache.users.filter((u) => {
      return isSuperAdminUser || allowedIds.has(u.id) || activeOwnerMap.has(u.id) || (u.email && [...activeOwnerMap.values()].some(v => v.email === u.email));
    });

    // Add any missing users from activeOwnerMap (skeleton models)
    activeOwnerMap.forEach((val, id) => {
      if (!resultUsers.some((u) => u.id === id)) {
        resultUsers.push({
          id: val.id,
          name: val.name,
          email: val.email,
          role: 'user',
          active: true,
          permissions: {
            canCreate: false,
            canRead: true,
            canUpdate: false,
            canDelete: false,
            allowedPages: [],
            canUseSubscription: false,
            canViewOthers: false,
            pagePermissions: {},
            fieldPermissions: {},
            dataAccessScope: { mode: 'own', sharedUserIds: [] }
          },
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
      }
    });

    return resultUsers;
  }

  static getProfile(): Profile {
    const user = this.getCurrentUser();
    if (user && this.selectedUserId && user.id === this.selectedUserId) {
      return {
        businessName: user.profile?.department || this.cache.profile?.businessName || user.name || '',
        ownerName: user.profile?.displayName || user.name || '',
        mobileNumber: user.profile?.phone || '',
        emailAddress: user.email || '',
        signupTimestamp: user.createdAt,
        isLightTheme: this.cache.profile?.isLightTheme ?? true,
        language: this.cache.profile?.language ?? 'en',
      };
    }
    if (!this.cache.profile) {
      return {
        businessName: '',
        ownerName: '',
        mobileNumber: '',
        emailAddress: '',
        signupTimestamp: 0,
        isLightTheme: true,
        language: 'en',
      };
    }
    return this.cache.profile;
  }

  static saveProfile(profile: Partial<Profile>): void {
    const updated = { ...this.getProfile(), ...profile };
    this.cache.profile = updated;
    if (!this._initialized) return;
    saveProfileApi(updated).catch((err) => console.error('[Repo] Profile save failed:', err));
  }

  private static resolveOwnerMeta(ownerUserId?: string): { ownerName?: string; ownerEmail?: string } {
    const targetUserId = ownerUserId || this.selectedUserId || this.cache.currentUser?.id;
    if (!targetUserId) return {};
    const user = this.cache.users.find((u) => u.id === targetUserId || u.email === targetUserId);
    if (!user) return {};
    return {
      ownerName: user.profile?.displayName || user.name || user.email || undefined,
      ownerEmail: user.email || undefined,
    };
  }

  private static withOwnerMeta<T extends { ownerUserId?: string }>(item: T): T {
    const ownerMeta = this.resolveOwnerMeta(item.ownerUserId);
    return { ...item, ...ownerMeta };
  }

  static async getCustomers(batchSize = 20, lastVisibleId?: string): Promise<{ data: Customer[]; hasMore: boolean }> {
    let all = [...this.cache.customers];
    if (this.selectedUserId) {
      const user = this.getUserById(this.selectedUserId);
      const email = user?.email;
      all = all.filter((c) => c.ownerUserId === this.selectedUserId || (email && c.ownerEmail === email));
    }
    all = all.sort((a, b) => a.name.localeCompare(b.name)).map((customer) => this.withOwnerMeta(customer));
    let startIndex = 0;
    if (lastVisibleId) {
      const index = all.findIndex((c) => c.id === lastVisibleId);
      if (index !== -1) startIndex = index + 1;
    }
    const paginated = all.slice(startIndex, startIndex + batchSize);
    return { data: paginated, hasMore: startIndex + batchSize < all.length };
  }

  static async getAllCustomers(): Promise<Customer[]> {
    let all = [...this.cache.customers];
    if (this.selectedUserId) {
      const user = this.getUserById(this.selectedUserId);
      const email = user?.email;
      all = all.filter((c) => c.ownerUserId === this.selectedUserId || (email && c.ownerEmail === email));
    }
    return all.map((customer) => this.withOwnerMeta(customer));
  }

  static async saveCustomer(customer: Customer): Promise<void> {
    const ownerUserId = customer.ownerUserId || this.selectedUserId || this.cache.currentUser?.id;
    const updatedCustomer = { ...customer, ownerUserId };
    const idx = this.cache.customers.findIndex((c) => c.id === customer.id);
    const isNew = idx === -1;
    if (idx !== -1) this.cache.customers[idx] = updatedCustomer;
    else this.cache.customers.push(updatedCustomer);
    this.logAudit(isNew ? 'CREATE' : 'UPDATE', 'customer', customer.id, { name: customer.name, phone: customer.phone });
    await saveCustomerApi(updatedCustomer).catch((err) => console.error('[Repo] Customer save failed:', err));
  }

  static async deleteCustomer(id: string): Promise<void> {
    this.cache.customers = this.cache.customers.filter((c) => c.id !== id);
    this.logAudit('DELETE', 'customer', id);
    await deleteCustomerApi(id).catch((err) => console.error('[Repo] Customer delete failed:', err));
  }

  static async getSales(batchSize = 20, lastVisibleId?: string, filterCustomer?: string, filterDateRange?: string): Promise<{ data: Sale[]; hasMore: boolean }> {
    let filtered = [...this.cache.sales];
    if (this.selectedUserId) {
      const user = this.getUserById(this.selectedUserId);
      const email = user?.email;
      filtered = filtered.filter((s) => s.ownerUserId === this.selectedUserId || (email && s.ownerEmail === email));
    }
    filtered = filtered.sort((a, b) => b.createdAt - a.createdAt).map((sale) => this.withOwnerMeta(sale));
    if (filterCustomer) {
      filtered = filtered.filter((s) => s.customerName.toLowerCase().includes(filterCustomer.toLowerCase()));
    }
    if (filterDateRange) {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const todayMs = now.getTime();
      if (filterDateRange === 'Today') filtered = filtered.filter((s) => s.createdAt >= todayMs);
      else if (filterDateRange === 'Week') filtered = filtered.filter((s) => s.createdAt >= todayMs - 7 * 86400000);
      else if (filterDateRange === 'Month') filtered = filtered.filter((s) => s.createdAt >= todayMs - 30 * 86400000);
      else if (filterDateRange === 'Year') filtered = filtered.filter((s) => s.createdAt >= todayMs - 365 * 86400000);
    }
    let startIndex = 0;
    if (lastVisibleId) {
      const index = filtered.findIndex((s) => s.id === lastVisibleId);
      if (index !== -1) startIndex = index + 1;
    }
    const paginated = filtered.slice(startIndex, startIndex + batchSize);
    return { data: paginated, hasMore: startIndex + batchSize < filtered.length };
  }

  static async getAllSales(): Promise<Sale[]> {
    let all = [...this.cache.sales];
    if (this.selectedUserId) {
      const user = this.getUserById(this.selectedUserId);
      const email = user?.email;
      all = all.filter((s) => s.ownerUserId === this.selectedUserId || (email && s.ownerEmail === email));
    }
    return all.sort((a, b) => b.createdAt - a.createdAt).map((sale) => this.withOwnerMeta(sale));
  }

  static async saveSale(sale: Sale): Promise<void> {
    const ownerUserId = sale.ownerUserId || this.selectedUserId || this.cache.currentUser?.id;
    const updatedSale = { ...sale, ownerUserId };
    this.cache.sales.push(updatedSale);
    this.logAudit('SALE_CREATE', 'sale', sale.id, {
      customerName: sale.customerName,
      milkType: sale.milkType,
      liters: sale.liters,
      totalAmount: sale.totalAmount,
      paymentType: sale.paymentType,
      paymentStatus: sale.paymentStatus,
    });
    await saveSaleApi(updatedSale).catch((err) => console.error('[Repo] Sale save failed:', err));
  }

  static async deleteSale(id: string): Promise<void> {
    this.cache.sales = this.cache.sales.filter((s) => s.id !== id);
    this.logAudit('SALE_DELETE', 'sale', id);
    await deleteSaleApi(id).catch((err) => console.error('[Repo] Sale delete failed:', err));
  }

  static async markSaleAsPaid(id: string, paymentType: string): Promise<void> {
    const idx = this.cache.sales.findIndex((s) => s.id === id);
    if (idx === -1) return;
    this.cache.sales[idx] = { ...this.cache.sales[idx], paymentStatus: 'PAID', paymentType, updatedAt: Date.now() };
    this.logAudit('SALE_PAY', 'sale', id, { paymentType });
    await markSalePaidApi(id, paymentType).catch((err) => console.error('[Repo] Mark paid failed:', err));
  }

  static getPriceConfigs(): PriceConfig[] {
    let configs = [...this.cache.priceConfigs];
    if (this.selectedUserId) {
      const user = this.getUserById(this.selectedUserId);
      const email = user?.email;
      configs = configs.filter((p) => p.ownerUserId === this.selectedUserId || (email && p.ownerEmail === email));
    }
    return configs.map((config) => this.withOwnerMeta(config));
  }

  static async savePriceConfig(milkType: string, newPrice: number, oldMilkType?: string): Promise<void> {
    if (oldMilkType && oldMilkType !== milkType) {
      this.cache.priceConfigs = this.cache.priceConfigs.filter((p) => p.milkType !== oldMilkType);
    }
    const idx = this.cache.priceConfigs.findIndex((p) => p.milkType === milkType);
    const oldPrice = idx !== -1 ? this.cache.priceConfigs[idx].currentPrice : 40;
    const ownerUserId = this.selectedUserId || this.cache.currentUser?.id;
    const updatedPrice = { milkType, currentPrice: newPrice, updatedAt: Date.now(), ownerUserId };
    if (idx !== -1) this.cache.priceConfigs[idx] = updatedPrice;
    else this.cache.priceConfigs.push(updatedPrice);
    this.logAudit('PRICE_UPDATE', 'price_config', milkType, { oldPrice, newPrice });
    try {
      const result = (await savePriceApi(milkType, newPrice, oldMilkType, ownerUserId)) as { updatedPrice: PriceConfig; log: PriceLog };
      if (result?.updatedPrice) {
        const pIdx = this.cache.priceConfigs.findIndex((p) => p.milkType === milkType);
        if (pIdx !== -1) this.cache.priceConfigs[pIdx] = result.updatedPrice;
      }
      if (result?.log) this.cache.priceLogs.push(result.log);
    } catch (err) {
      console.error('[Repo] Price save failed:', err);
    }
  }

  static async deletePriceConfig(milkType: string): Promise<void> {
    this.cache.priceConfigs = this.cache.priceConfigs.filter((p) => p.milkType !== milkType);
    this.logAudit('PRICE_DELETE', 'price_config', milkType);
    try {
      const ownerUserId = this.selectedUserId || this.cache.currentUser?.id;
      await deletePriceApi(milkType, ownerUserId);
    } catch (err) {
      console.error('[Repo] Price delete failed:', err);
    }
  }

  static getPriceLogs(): PriceLog[] {
    return this.cache.priceLogs.map((log) => this.withOwnerMeta(log));
  }

  static getUsers(): UserModel[] {
    return [...this.cache.users];
  }

  static setUsers(users: UserModel[]): void {
    this.cache.users = users;
  }

  static setCurrentUser(userIdOrEmail: string | null): void {
    if (!userIdOrEmail) {
      this.cache.currentUser = null;
      return;
    }
    this.cache.currentUser = this.cache.users.find((x) => x.id === userIdOrEmail || x.email === userIdOrEmail) || null;
  }

  static getCurrentUser(): UserModel | null {
    if (this.selectedUserId) {
      return this.cache.users.find((u) => u.id === this.selectedUserId) || this.cache.currentUser;
    }
    return this.cache.currentUser;
  }

  static getUserById(idOrEmail: string): UserModel | undefined {
    return this.cache.users.find((u) => u.id === idOrEmail || u.email === idOrEmail);
  }

  static getMilkInventories(): MilkInventory[] {
    let inventory = [...this.cache.inventory];
    if (this.selectedUserId) {
      const user = this.getUserById(this.selectedUserId);
      const email = user?.email;
      inventory = inventory.filter((i) => i.ownerUserId === this.selectedUserId || (email && i.ownerEmail === email));
    }
    return inventory.map((inventory) => this.withOwnerMeta(inventory));
  }

  static async saveMilkInventory(inventory: MilkInventory): Promise<void> {
    const ownerUserId = inventory.ownerUserId || this.selectedUserId || this.cache.currentUser?.id;
    const updatedInventory = { ...inventory, ownerUserId };
    const idx = this.cache.inventory.findIndex((i) => i.dateStr === inventory.dateStr);
    if (idx !== -1) this.cache.inventory[idx] = updatedInventory;
    else this.cache.inventory.push(updatedInventory);
    await saveInventoryApi(updatedInventory).catch((err) => console.error('[Repo] Inventory save failed:', err));
  }

  static getBillingConfig(): BillingConfig {
    return normalizeBillingConfig(this.cache.billingConfig);
  }

  static saveBillingConfig(config: Partial<BillingConfig>, auditDetails?: Record<string, unknown>): BillingConfig {
    const ownerUserId = this.selectedUserId || this.cache.currentUser?.id;
    const updated = normalizeBillingConfig({ ...this.getBillingConfig(), ...config, updatedAt: Date.now() });
    this.cache.billingConfig = updated;
    this.logAudit('CONFIG_UPDATE', 'billing_config', 'global', auditDetails || { section: 'billing' });
    saveBillingApi(updated, ownerUserId).catch((err) => console.error('[Repo] Billing save failed:', err));
    return updated;
  }

  static getBrandingConfig(): BrandingConfig {
    if (!this.cache.brandingConfig) {
      return {
        bankName: 'Ganga Premium Dairy',
        systemName: 'Dairy ERP',
        logo: '/abielan_app_logo.png',
        address: '123 Dairy Farm Lane, Cooperative Hub',
        updatedAt: 0,
      };
    }
    return this.cache.brandingConfig;
  }

  static async saveBrandingConfig(config: Partial<BrandingConfig>, auditDetails?: Record<string, unknown>): Promise<BrandingConfig> {
    const ownerUserId = this.selectedUserId || this.cache.currentUser?.id;
    const updated = { ...this.getBrandingConfig(), ...config, updatedAt: Date.now() };
    this.cache.brandingConfig = updated;
    this.logAudit('CONFIG_UPDATE', 'branding_config', 'global', auditDetails || { section: 'branding' });
    await saveBrandingApi(updated, ownerUserId).catch((err) => console.error('[Repo] Branding save failed:', err));
    return updated;
  }

  static getEnabledPaymentMethods() {
    return this.getBillingConfig().paymentMethods.filter((m) => m.enabled);
  }

  private static resolveActor(): { userId: string; userName: string; userEmail?: string } {
    const user = this.cache.currentUser;
    const profile = this.getProfile();
    if (user) return { userId: user.id, userName: user.name, userEmail: user.email };
    return { userId: 'session', userName: profile.ownerName || 'User', userEmail: profile.emailAddress };
  }

  static logAudit(action: string, resourceType: string, resourceId?: string, details?: Record<string, unknown> | null): AuditLogEntry {
    const actor = this.resolveActor();
    const entry: AuditLogEntry = {
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      userId: actor.userId,
      userName: actor.userName,
      userEmail: actor.userEmail,
      action,
      resourceType,
      resourceId,
      details: details || null,
      createdAt: Date.now(),
    };
    this.cache.auditLogs.unshift(entry);
    this.cache.auditLogs = this.cache.auditLogs.slice(0, 500);
    logAuditApi(entry).catch((err) => console.error('[Repo] Audit log failed:', err));
    return entry;
  }

  static getAuditLogs(options?: { page?: number; limit?: number; search?: string; resourceType?: string }) {
    const page = options?.page || 1;
    const limit = options?.limit || 30;
    let logs = [...this.cache.auditLogs];
    if (options?.resourceType) logs = logs.filter((l) => l.resourceType === options.resourceType);
    if (options?.search?.trim()) {
      const q = options.search.trim().toLowerCase();
      logs = logs.filter(
        (l) =>
          l.action.toLowerCase().includes(q) ||
          l.resourceType.toLowerCase().includes(q) ||
          (l.resourceId || '').toLowerCase().includes(q) ||
          l.userName.toLowerCase().includes(q) ||
          (l.userEmail || '').toLowerCase().includes(q) ||
          JSON.stringify(l.details || {}).toLowerCase().includes(q)
      );
    }
    const total = logs.length;
    const pages = Math.max(1, Math.ceil(total / limit));
    const start = (page - 1) * limit;
    return { logs: logs.slice(start, start + limit), total, page, pages };
  }

  static exportAuditLogs(): string {
    return JSON.stringify(this.cache.auditLogs, null, 2);
  }

  static async triggerBatchSync(): Promise<void> {
    await this.refreshFromServer();
  }
}

export default Repository;
