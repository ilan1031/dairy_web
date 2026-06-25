// d:/Gitfiles/dairy/dairy-web/lib/repository.ts
import { db, isFirebaseConfigured } from './firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  query, 
  orderBy, 
  limit, 
  startAfter, 
  deleteDoc, 
  writeBatch,
  getDoc,
  where
} from 'firebase/firestore';
import LoadBalancer from './loadbalancer';

export interface Customer {
  id: string;
  name: string;
  phone: string;
  qrPreference: string; // "UPI", "CASH"
  address?: string;
  notes?: string;
  updatedAt: number;
}

export interface Sale {
  id: string;
  customerId: string;
  customerName: string;
  milkType: string; // "Cow Milk", "Buffalo Milk", "A2 Milk"
  liters: number;
  ratePerLiter: number;
  totalAmount: number;
  paymentStatus: string; // "PAID", "PENDING"
  paymentType: string; // "CASH", "UPI", "NONE"
  location: string;
  createdAt: number;
  updatedAt: number;
}

export interface PriceConfig {
  milkType: string;
  currentPrice: number;
  updatedAt: number;
}

export interface PriceLog {
  id: string;
  milkType: string;
  oldPrice: number;
  newPrice: number;
  timestamp: number;
}

export interface MilkInventory {
  dateStr: string; // "yyyy-MM-dd"
  cowLiters: number;
  buffaloLiters: number;
  a2Liters: number;
  customStocksRaw: string;
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

// In-Memory & LocalStorage Cache keys
const KEYS = {
  CUSTOMERS: 'dairy_customers',
  SALES: 'dairy_sales',
  PRICES: 'dairy_prices',
  PRICELOGS: 'dairy_price_logs',
  INVENTORY: 'dairy_inventory',
  PROFILE: 'dairy_profile',
  USERS: 'dairy_users',
  CURRENT_USER: 'dairy_current_user'
};

export interface PermissionSet {
  canCreate: boolean;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  allowedPages: string[]; // page identifiers
  canUseSubscription?: boolean;
  canViewOthers?: boolean;
}

export interface UserModel {
  id: string;
  name: string;
  email: string;
  role: string; // e.g., 'user' | 'admin' | 'superadmin'
  subscription?: {
    plan: string;
    expiresAt?: number;
  } | null;
  permissions: PermissionSet;
  createdAt: number;
  updatedAt: number;
}

class Repository {
  // Helper to load from LocalStorage
  private static getLocal<T>(key: string, defaultVal: T): T {
    if (typeof window === 'undefined') return defaultVal;
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultVal;
  }

  // Helper to save to LocalStorage
  private static saveLocal<T>(key: string, data: T): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(key, JSON.stringify(data));
  }

  // --- PROFILE METHODS ---
  static getProfile(): Profile {
    const defaultProfile: Profile = {
      businessName: 'Ganga Premium Dairy',
      ownerName: 'Arun Kumar',
      mobileNumber: '9876543210',
      emailAddress: 'arun@gangadairy.com',
      signupTimestamp: Date.now(),
      isLightTheme: true,
      language: 'en'
    };
    return this.getLocal<Profile>(KEYS.PROFILE, defaultProfile);
  }

  static saveProfile(profile: Partial<Profile>): void {
    const current = this.getProfile();
    const updated = { ...current, ...profile };
    this.saveLocal(KEYS.PROFILE, updated);

    // Sync to Firebase in background if configured
    if (isFirebaseConfigured && db) {
      LoadBalancer.execute(async (node) => {
        const userRef = doc(db!, 'profiles', updated.emailAddress);
        await setDoc(userRef, updated, { merge: true });
        console.log(`[Repo] Profile synced via ${node}`);
      }).catch(err => console.error('[Repo] Firebase Profile sync failed:', err));
    }
  }

  // --- CUSTOMER METHODS ---
  static async getCustomers(batchSize = 20, lastVisibleId?: string): Promise<{ data: Customer[]; hasMore: boolean }> {
    return LoadBalancer.execute(async (node) => {
      // 1. Get from local storage first (immediate speed)
      let localCustomers = this.getLocal<Customer[]>(KEYS.CUSTOMERS, []);

      // If Firebase is configured, try fetching and merging changes
      if (isFirebaseConfigured && db) {
        try {
          const colRef = collection(db, 'customers');
          let q = query(colRef, orderBy('name'), limit(batchSize));
          
          if (lastVisibleId) {
            const lastDocRef = doc(db, 'customers', lastVisibleId);
            const lastDocSnap = await getDoc(lastDocRef);
            if (lastDocSnap.exists()) {
              q = query(colRef, orderBy('name'), startAfter(lastDocSnap), limit(batchSize));
            }
          }

          const snap = await getDocs(q);
          const fbCustomers: Customer[] = [];
          snap.forEach(docSnap => {
            fbCustomers.push(docSnap.data() as Customer);
          });

          // Merge into local store to update offline cache
          if (fbCustomers.length > 0) {
            const customerMap = new Map(localCustomers.map(c => [c.id, c]));
            fbCustomers.forEach(c => customerMap.set(c.id, c));
            localCustomers = Array.from(customerMap.values()).sort((a, b) => a.name.localeCompare(b.name));
            this.saveLocal(KEYS.CUSTOMERS, localCustomers);
          }
        } catch (err) {
          console.warn('[Repo] Failed Firestore customers read, using offline cache:', err);
        }
      }

      // Perform local pagination
      let startIndex = 0;
      if (lastVisibleId) {
        const index = localCustomers.findIndex(c => c.id === lastVisibleId);
        if (index !== -1) {
          startIndex = index + 1;
        }
      }

      const paginated = localCustomers.slice(startIndex, startIndex + batchSize);
      const hasMore = startIndex + batchSize < localCustomers.length;

      return { data: paginated, hasMore };
    });
  }

  static async getAllCustomers(): Promise<Customer[]> {
    return this.getLocal<Customer[]>(KEYS.CUSTOMERS, []);
  }

  static async saveCustomer(customer: Customer): Promise<void> {
    // Save locally
    const local = this.getLocal<Customer[]>(KEYS.CUSTOMERS, []);
    const idx = local.findIndex(c => c.id === customer.id);
    if (idx !== -1) {
      local[idx] = customer;
    } else {
      local.push(customer);
    }
    this.saveLocal(KEYS.CUSTOMERS, local);

    // Sync in background
    if (isFirebaseConfigured && db) {
      LoadBalancer.execute(async () => {
        await setDoc(doc(db!, 'customers', customer.id), customer);
      }).catch(err => console.error('[Repo] Save customer Firestore failed:', err));
    }
  }

  static async deleteCustomer(id: string): Promise<void> {
    // Delete locally
    let local = this.getLocal<Customer[]>(KEYS.CUSTOMERS, []);
    local = local.filter(c => c.id !== id);
    this.saveLocal(KEYS.CUSTOMERS, local);

    // Delete in background
    if (isFirebaseConfigured && db) {
      LoadBalancer.execute(async () => {
        await deleteDoc(doc(db!, 'customers', id));
      }).catch(err => console.error('[Repo] Delete customer Firestore failed:', err));
    }
  }

  // --- SALES METHODS ---
  static async getSales(batchSize = 20, lastVisibleId?: string, filterCustomer?: string, filterDateRange?: string): Promise<{ data: Sale[]; hasMore: boolean }> {
    return LoadBalancer.execute(async (node) => {
      let localSales = this.getLocal<Sale[]>(KEYS.SALES, []);

      // Sort local sales by date descending
      localSales.sort((a, b) => b.createdAt - a.createdAt);

      if (isFirebaseConfigured && db) {
        try {
          const colRef = collection(db, 'sales');
          let q = query(colRef, orderBy('createdAt', 'desc'), limit(batchSize));

          if (lastVisibleId) {
            const lastDocRef = doc(db, 'sales', lastVisibleId);
            const lastDocSnap = await getDoc(lastDocRef);
            if (lastDocSnap.exists()) {
              q = query(colRef, orderBy('createdAt', 'desc'), startAfter(lastDocSnap), limit(batchSize));
            }
          }

          const snap = await getDocs(q);
          const fbSales: Sale[] = [];
          snap.forEach(docSnap => {
            fbSales.push(docSnap.data() as Sale);
          });

          // Sync local storage cache
          if (fbSales.length > 0) {
            const salesMap = new Map(localSales.map(s => [s.id, s]));
            fbSales.forEach(s => salesMap.set(s.id, s));
            localSales = Array.from(salesMap.values()).sort((a, b) => b.createdAt - a.createdAt);
            this.saveLocal(KEYS.SALES, localSales);
          }
        } catch (err) {
          console.warn('[Repo] Firestore sales read failed, using offline cache:', err);
        }
      }

      // Client-side filtering on local cache
      let filtered = [...localSales];
      if (filterCustomer) {
        filtered = filtered.filter(s => s.customerName.toLowerCase().includes(filterCustomer.toLowerCase()));
      }
      
      if (filterDateRange) {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const todayMs = now.getTime();

        if (filterDateRange === 'Today') {
          filtered = filtered.filter(s => s.createdAt >= todayMs);
        } else if (filterDateRange === 'Week') {
          const weekAgo = todayMs - 7 * 24 * 60 * 60 * 1000;
          filtered = filtered.filter(s => s.createdAt >= weekAgo);
        } else if (filterDateRange === 'Month') {
          const monthAgo = todayMs - 30 * 24 * 60 * 60 * 1000;
          filtered = filtered.filter(s => s.createdAt >= monthAgo);
        } else if (filterDateRange === 'Year') {
          const yearAgo = todayMs - 365 * 24 * 60 * 60 * 1000;
          filtered = filtered.filter(s => s.createdAt >= yearAgo);
        }
      }

      // Paginate
      let startIndex = 0;
      if (lastVisibleId) {
        const index = filtered.findIndex(s => s.id === lastVisibleId);
        if (index !== -1) {
          startIndex = index + 1;
        }
      }

      const paginated = filtered.slice(startIndex, startIndex + batchSize);
      const hasMore = startIndex + batchSize < filtered.length;

      return { data: paginated, hasMore };
    });
  }

  static async getAllSales(): Promise<Sale[]> {
    const sales = this.getLocal<Sale[]>(KEYS.SALES, []);
    return sales.sort((a, b) => b.createdAt - a.createdAt);
  }

  static async saveSale(sale: Sale): Promise<void> {
    // Save locally
    const local = this.getLocal<Sale[]>(KEYS.SALES, []);
    local.push(sale);
    this.saveLocal(KEYS.SALES, local);

    // Sync in background
    if (isFirebaseConfigured && db) {
      LoadBalancer.execute(async () => {
        await setDoc(doc(db!, 'sales', sale.id), sale);
      }).catch(err => console.error('[Repo] Save sale Firestore failed:', err));
    }
  }

  static async deleteSale(id: string): Promise<void> {
    // Delete locally
    let local = this.getLocal<Sale[]>(KEYS.SALES, []);
    local = local.filter(s => s.id !== id);
    this.saveLocal(KEYS.SALES, local);

    // Delete in background
    if (isFirebaseConfigured && db) {
      LoadBalancer.execute(async () => {
        await deleteDoc(doc(db!, 'sales', id));
      }).catch(err => console.error('[Repo] Delete sale Firestore failed:', err));
    }
  }

  static async markSaleAsPaid(id: string, paymentType: string): Promise<void> {
    const local = this.getLocal<Sale[]>(KEYS.SALES, []);
    const idx = local.findIndex(s => s.id === id);
    if (idx !== -1) {
      local[idx].paymentStatus = 'PAID';
      local[idx].paymentType = paymentType;
      local[idx].updatedAt = Date.now();
      this.saveLocal(KEYS.SALES, local);

      // Sync in background
      if (isFirebaseConfigured && db) {
        LoadBalancer.execute(async () => {
          await setDoc(doc(db!, 'sales', id), {
            paymentStatus: 'PAID',
            paymentType: paymentType,
            updatedAt: Date.now()
          }, { merge: true });
        }).catch(err => console.error('[Repo] Mark as paid Firestore failed:', err));
      }
    }
  }

  // --- PRICE CONFIGURATION ---
  static getPriceConfigs(): PriceConfig[] {
    const defaultPrices: PriceConfig[] = [
      { milkType: 'Cow Milk', currentPrice: 42.0, updatedAt: Date.now() },
      { milkType: 'Buffalo Milk', currentPrice: 58.0, updatedAt: Date.now() },
      { milkType: 'A2 Milk', currentPrice: 75.0, updatedAt: Date.now() }
    ];
    return this.getLocal<PriceConfig[]>(KEYS.PRICES, defaultPrices);
  }

  static async savePriceConfig(milkType: string, newPrice: number): Promise<void> {
    const local = this.getPriceConfigs();
    const idx = local.findIndex(p => p.milkType === milkType);
    const oldPrice = idx !== -1 ? local[idx].currentPrice : 40.0;
    
    const updatedPrice = { milkType, currentPrice: newPrice, updatedAt: Date.now() };
    if (idx !== -1) {
      local[idx] = updatedPrice;
    } else {
      local.push(updatedPrice);
    }
    this.saveLocal(KEYS.PRICES, local);

    // Save Price Log
    const logs = this.getLocal<PriceLog[]>(KEYS.PRICELOGS, []);
    const newLog: PriceLog = {
      id: Math.random().toString(36).substr(2, 9),
      milkType,
      oldPrice,
      newPrice,
      timestamp: Date.now()
    };
    logs.push(newLog);
    this.saveLocal(KEYS.PRICELOGS, logs);

    // Sync configs to Firestore
    if (isFirebaseConfigured && db) {
      LoadBalancer.execute(async () => {
        await setDoc(doc(db!, 'price_configs', milkType), updatedPrice);
        await setDoc(doc(db!, 'price_logs', newLog.id), newLog);
      }).catch(err => console.error('[Repo] Sync prices to Firestore failed:', err));
    }
  }

  static getPriceLogs(): PriceLog[] {
    return this.getLocal<PriceLog[]>(KEYS.PRICELOGS, []);
  }

  // --- USER & PERMISSIONS ---
  static getUsers(): UserModel[] {
    const defaultAdmin: UserModel = {
      id: 'builtin-admin',
      name: 'Built-in Admin',
      email: this.getProfile().emailAddress,
      role: 'superadmin',
      subscription: { plan: 'lifetime' },
      permissions: { canCreate: true, canRead: true, canUpdate: true, canDelete: true, allowedPages: ['*'], canUseSubscription: true, canViewOthers: true },
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const existing = this.getLocal<UserModel[]>(KEYS.USERS, [defaultAdmin]);
    // Ensure built-in admin exists
    if (!existing.find(u => u.id === 'builtin-admin')) {
      existing.unshift(defaultAdmin);
      this.saveLocal(KEYS.USERS, existing);
    }
    return existing;
  }

  static saveUser(user: Partial<UserModel> & { id?: string; email: string; name: string; permissions?: Partial<PermissionSet> }): UserModel {
    const users = this.getUsers();
    const id = user.id || Math.random().toString(36).substr(2, 9);
    const now = Date.now();
    const base: UserModel = {
      id,
      name: user.name,
      email: user.email,
      role: (user as any).role || 'user',
      subscription: (user as any).subscription || null,
      permissions: {
        canCreate: user.permissions?.canCreate ?? false,
        canRead: user.permissions?.canRead ?? true,
        canUpdate: user.permissions?.canUpdate ?? false,
        canDelete: user.permissions?.canDelete ?? false,
        allowedPages: user.permissions?.allowedPages ?? [],
        canUseSubscription: user.permissions?.canUseSubscription ?? false,
        canViewOthers: user.permissions?.canViewOthers ?? false
      },
      createdAt: now,
      updatedAt: now
    };

    const idx = users.findIndex(u => u.id === id || u.email === user.email);
    if (idx !== -1) {
      users[idx] = { ...users[idx], ...base, updatedAt: now };
    } else {
      users.push(base);
    }
    this.saveLocal(KEYS.USERS, users);

    // Sync to Firestore
    if (isFirebaseConfigured && db) {
      LoadBalancer.execute(async () => {
        await setDoc(doc(db!, 'users', id), base);
      }).catch(err => console.error('[Repo] Sync user to Firestore failed:', err));
    }

    return base;
  }

  static deleteUser(id: string): void {
    let users = this.getUsers();
    users = users.filter(u => u.id !== id && u.email !== this.getProfile().emailAddress);
    this.saveLocal(KEYS.USERS, users);

    if (isFirebaseConfigured && db) {
      LoadBalancer.execute(async () => {
        await deleteDoc(doc(db!, 'users', id));
      }).catch(err => console.error('[Repo] Delete user Firestore failed:', err));
    }
  }

  static setCurrentUser(userIdOrEmail: string | null): void {
    if (!userIdOrEmail) {
      localStorage.removeItem(KEYS.CURRENT_USER);
      return;
    }
    const users = this.getUsers();
    const u = users.find(x => x.id === userIdOrEmail || x.email === userIdOrEmail);
    if (u) {
      this.saveLocal(KEYS.CURRENT_USER, u);
    }
  }

  static getCurrentUser(): UserModel | null {
    return this.getLocal<UserModel | null>(KEYS.CURRENT_USER, null);
  }

  static getUserById(idOrEmail: string): UserModel | undefined {
    const users = this.getUsers();
    return users.find(u => u.id === idOrEmail || u.email === idOrEmail);
  }

  static updateUserPermissions(idOrEmail: string, perms: Partial<PermissionSet>): void {
    const users = this.getUsers();
    const idx = users.findIndex(u => u.id === idOrEmail || u.email === idOrEmail);
    if (idx === -1) return;
    users[idx].permissions = { ...users[idx].permissions, ...perms };
    users[idx].updatedAt = Date.now();
    this.saveLocal(KEYS.USERS, users);

    if (isFirebaseConfigured && db) {
      LoadBalancer.execute(async () => {
        await setDoc(doc(db!, 'users', users[idx].id), users[idx], { merge: true });
      }).catch(err => console.error('[Repo] Update user perms Firestore failed:', err));
    }
  }

  // --- MILK STOCK INVENTORY ---
  static getMilkInventories(): MilkInventory[] {
    return this.getLocal<MilkInventory[]>(KEYS.INVENTORY, []);
  }

  static async saveMilkInventory(inventory: MilkInventory): Promise<void> {
    const local = this.getMilkInventories();
    const idx = local.findIndex(i => i.dateStr === inventory.dateStr);
    if (idx !== -1) {
      local[idx] = inventory;
    } else {
      local.push(inventory);
    }
    this.saveLocal(KEYS.INVENTORY, local);

    // Sync in background
    if (isFirebaseConfigured && db) {
      LoadBalancer.execute(async () => {
        await setDoc(doc(db!, 'milk_inventory', inventory.dateStr), inventory);
      }).catch(err => console.error('[Repo] Save inventory to Firestore failed:', err));
    }
  }

  // --- BATCH SYNC METHOD ---
  // Syncs all local storage records to Firebase if offline records exist
  static async triggerBatchSync(): Promise<void> {
    if (!isFirebaseConfigured || !db) return;
    
    return LoadBalancer.execute(async () => {
      const batch = writeBatch(db!);

      // Sync Customers
      const localCust = this.getLocal<Customer[]>(KEYS.CUSTOMERS, []);
      localCust.forEach(c => {
        const ref = doc(db!, 'customers', c.id);
        batch.set(ref, c, { merge: true });
      });

      // Sync Sales
      const localSales = this.getLocal<Sale[]>(KEYS.SALES, []);
      localSales.forEach(s => {
        const ref = doc(db!, 'sales', s.id);
        batch.set(ref, s, { merge: true });
      });

      // Sync Inventories
      const localInv = this.getLocal<MilkInventory[]>(KEYS.INVENTORY, []);
      localInv.forEach(i => {
        const ref = doc(db!, 'milk_inventory', i.dateStr);
        batch.set(ref, i, { merge: true });
      });

      await batch.commit();
      console.log('[Repo] Batch synchronization executed successfully across all collections.');
    });
  }
}

export default Repository;
