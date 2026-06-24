// d:/Gitfiles/dairy/dairy-web/components/SalesTab.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/app/providers';
import Repository, { Customer, PriceConfig, Sale } from '@/lib/repository';
import { BillingConfig, PaymentIconKey } from '@/lib/billingConfig';
import { hasPageAction, canAccessField } from '@/lib/permissions';
import { maskCurrency } from '@/lib/fieldMask';
import { 
  UserPlus, 
  Save, 
  CheckCircle, 
  Smartphone,
  Search,
  ChevronDown,
  ChevronUp,
  X,
  Plus,
  Minus,
  MapPin,
  Droplet,
  FileEdit,
  DollarSign,
  Receipt,
  User,
  CreditCard,
  Building,
  Clock,
  Wallet,
  QrCode,
  Check,
} from 'lucide-react';

interface SalesTabProps {
  onSuccessToast: (message?: string, type?: 'success' | 'error' | 'info') => void;
  onSaleCreated?: (sale: Sale) => void;
}

export default function SalesTab({ onSuccessToast, onSaleCreated }: SalesTabProps) {
  const { t } = useLanguage();

  // Procurement database states
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [prices, setPrices] = useState<PriceConfig[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  
  // Selected Customer state
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [inputQuery, setInputQuery] = useState('');
  const [isDropdownExpanded, setIsDropdownExpanded] = useState(false);

  // Sale entry states
  const [selectedMilkType, setSelectedMilkType] = useState('Cow Milk');
  const [customPriceInput, setCustomPriceInput] = useState('50');
  const [liters, setLiters] = useState(1.0);
  const [rawLitersInput, setRawLitersInput] = useState('1.0');
  const [paymentTypeChoice, setPaymentTypeChoice] = useState('CASH');
  const [location, setLocation] = useState('Simulated Location (GPS Locked)');
  const [billingConfig, setBillingConfig] = useState<BillingConfig | null>(null);

  const renderPaymentIcon = (icon: PaymentIconKey, size = 16) => {
    switch (icon) {
      case 'credit-card': return <CreditCard size={size} />;
      case 'building': return <Building size={size} />;
      case 'clock': return <Clock size={size} />;
      case 'wallet': return <Wallet size={size} />;
      case 'qr': return <QrCode size={size} />;
      default: return <DollarSign size={size} />;
    }
  };

  const colorToRgb = (color: string, code: string) => {
    if (color.startsWith('var(--')) {
      const map: Record<string, string> = {
        CASH: '46,125,50',
        UPI: '255,160,0',
        BANK: '30,136,229',
        PENDING: '211,47,47',
      };
      return map[code] || '30,136,229';
    }
    return '30,136,229';
  };

  // Quick Inline Customer Register
  const [showDirectRegisterPanel, setShowDirectRegisterPanel] = useState(false);
  const [directRegName, setDirectRegName] = useState('');
  const [directRegPhone, setDirectRegPhone] = useState('');
  const [directRegQr, setDirectRegQr] = useState('UPI'); // UPI or CASH

  // Confirmation Modals State
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [showAddCustomerConfirm, setShowAddCustomerConfirm] = useState(false);

  const loadData = async () => {
    const custs = await Repository.getAllCustomers();
    const prs = Repository.getPriceConfigs();
    const allSales = await Repository.getAllSales();
    const billing = Repository.getBillingConfig();
    setCustomers(custs);
    setPrices(prs);
    setSales(allSales);
    setBillingConfig(billing);
    setLocation(billing.defaultLocation);
    const enabled = billing.paymentMethods.filter(m => m.enabled);
    if (enabled.length > 0 && !enabled.find(m => m.code === paymentTypeChoice)) {
      setPaymentTypeChoice(enabled[0].code);
    }
    if (enabled.length > 0 && billing.volumePresets.length > 0) {
      setLiters(billing.volumePresets[Math.min(2, billing.volumePresets.length - 1)] || 1);
      setRawLitersInput(String(billing.volumePresets[Math.min(2, billing.volumePresets.length - 1)] || 1));
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Compute stock levels left for today (Android alignment)
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayTimestamp = todayStart.getTime();

  const todaySalesMap = React.useMemo(() => {
    const map: { [key: string]: number } = {};
    sales.filter(s => s.createdAt >= todayTimestamp).forEach(s => {
      map[s.milkType] = (map[s.milkType] || 0) + s.liters;
    });
    return map;
  }, [sales, todayTimestamp]);

  const todayStockMap = React.useMemo(() => {
    const map: { [key: string]: number } = {};
    // Fallback default stock to 100L if no inventory logged
    prices.forEach(p => {
      map[p.milkType] = 100.0;
    });

    const inventories = Repository.getMilkInventories();
    const matchedInv = inventories.find(i => {
      const todayDateStr = new Date().toISOString().slice(0, 10);
      return i.dateStr === todayDateStr;
    });

    if (matchedInv) {
      prices.forEach(p => { map[p.milkType] = 0.0; });
      map['Cow Milk'] = matchedInv.cowLiters;
      map['Buffalo Milk'] = matchedInv.buffaloLiters;
      map['A2 Milk'] = matchedInv.a2Liters;

      if (matchedInv.customStocksRaw) {
        matchedInv.customStocksRaw.split(',').forEach(pair => {
          const parts = pair.split(':');
          if (parts.length === 2) {
            map[parts[0]] = parseFloat(parts[1]) || 0.0;
          }
        });
      }
    }
    return map;
  }, [prices]);

  // Outstanding dues of selected customer
  const customerOutstandingDues = React.useMemo(() => {
    if (!selectedCustomer) return 0;
    return sales
      .filter(s => s.customerId === selectedCustomer.id && s.paymentStatus === 'PENDING')
      .reduce((sum, s) => sum + s.totalAmount, 0);
  }, [selectedCustomer, sales]);

  // Auto customer numbering name
  const nextAutoCustomerName = React.useMemo(() => {
    const todayCount = sales.filter(s => s.createdAt >= todayTimestamp).length;
    return `Customer ${todayCount + 1}`;
  }, [sales, todayTimestamp]);

  const rateResolved = React.useMemo(() => {
    if (selectedMilkType === 'Custom') {
      return parseFloat(customPriceInput) || 0.0;
    }
    return prices.find(p => p.milkType === selectedMilkType)?.currentPrice || 50.0;
  }, [selectedMilkType, prices, customPriceInput]);

  const finalCostCalculated = liters * rateResolved;

  // Handle save sale (initiator)
  const handleSaveSale = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!hasPageAction('Sales', 'create')) {
      onSuccessToast(t('Permission denied'), 'error');
      return;
    }
    if (!selectedCustomer || liters <= 0 || rateResolved <= 0) return;

    if (billingConfig?.requireLocation && !location.trim()) {
      onSuccessToast(t('Location is required'), 'error');
      return;
    }

    setShowSaveConfirm(true);
  };

  // Perform actual save logic after confirmation
  const executeSaveSale = async () => {
    if (!selectedCustomer) return;
    const selectedMethod = billingConfig?.paymentMethods.find(m => m.code === paymentTypeChoice);
    const paymentStatus = selectedMethod?.marksPending ? 'PENDING' : 'PAID';
    const resolvedPaymentType = selectedMethod?.marksPending ? 'NONE' : paymentTypeChoice;

    const newSale: Sale = {
      id: Math.random().toString(36).substr(2, 9),
      customerId: selectedCustomer.id,
      customerName: selectedCustomer.name,
      milkType: selectedMilkType,
      liters: liters,
      ratePerLiter: rateResolved,
      totalAmount: finalCostCalculated,
      paymentStatus: paymentStatus,
      paymentType: resolvedPaymentType,
      location: location, // Location input field
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await Repository.saveSale(newSale);
    
    // Clear selected parameters for quick next entry
    setSelectedCustomer(null);
    setInputQuery('');
    setSelectedMilkType('Cow Milk');
    setLiters(billingConfig?.volumePresets[2] || billingConfig?.volumePresets[0] || 1.0);
    setRawLitersInput(String(billingConfig?.volumePresets[2] || billingConfig?.volumePresets[0] || 1.0));
    const defaultPay = billingConfig?.paymentMethods.find(m => m.enabled);
    setPaymentTypeChoice(defaultPay?.code || 'CASH');
    setLocation(billingConfig?.defaultLocation || 'Simulated Location (GPS Locked)');

    onSuccessToast(t('Milk sale saved and synced!'), 'success');
    loadData();
    if (onSaleCreated) {
      onSaleCreated(newSale);
    }
  };

  // Immediate Quick Add Customer (initiator)
  const handleQuickAdd = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!hasPageAction('Sales', 'create')) {
      onSuccessToast(t('Permission denied'), 'error');
      return;
    }
    if (!directRegName) return;

    setShowAddCustomerConfirm(true);
  };

  // Perform actual quick add logic after confirmation
  const executeQuickAdd = async () => {
    const newId = Math.random().toString(36).substr(2, 9);
    const newCust: Customer = {
      id: newId,
      name: directRegName,
      phone: directRegPhone,
      qrPreference: directRegQr,
      updatedAt: Date.now()
    };

    await Repository.saveCustomer(newCust);
    
    setDirectRegName('');
    setDirectRegPhone('');
    setDirectRegQr('UPI');
    setShowDirectRegisterPanel(false);
    
    // Auto select
    setSelectedCustomer(newCust);
    setInputQuery(newCust.name);
    setIsDropdownExpanded(false);
    onSuccessToast(t('Customer registered successfully!'), 'success');
    loadData();
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(inputQuery.toLowerCase()) ||
    (c.phone && c.phone.includes(inputQuery))
  );

  const enabledPaymentMethods = billingConfig?.paymentMethods.filter(m => m.enabled) || [];
  const volumePresets = billingConfig?.volumePresets || [0.25, 0.5, 1.0, 2.0, 5.0, 10.0];
  const allowCustomRate = billingConfig?.allowCustomRate !== false;
  const showStockWarnings = billingConfig?.showStockWarnings !== false;
  const maxVolume = billingConfig?.maxVolume || 200;
  const volumeStep = billingConfig?.volumeStep || 0.25;
  const requireLocation = billingConfig?.requireLocation !== false;

  return (
    <div className="grid-cols-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
      
      {/* Dynamic Billing Entry Inputs Card */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--primary-milk)', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', margin: 0 }}>
          <Receipt size={22} />
          {t('New Billing Entry')}
        </h3>

        {/* STEP 1: CLIENT LINKING */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: 'var(--primary-milk)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center', fontSize: '0.78rem', fontWeight: 800 }}>1</div>
            <strong style={{ fontSize: '0.95rem', fontWeight: 800 }}>{t('Client Account Linking')}</strong>
          </div>

          {selectedCustomer ? (
            <div className="card" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: '4px solid var(--primary-milk)', backgroundColor: 'var(--input-bg)' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'rgba(30,136,229,0.1)', color: 'var(--primary-milk)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '1.05rem' }}>
                  {selectedCustomer.name.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>{selectedCustomer.name}</h4>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    📞 {selectedCustomer.phone || t('No phone registered')}
                  </span>
                  {customerOutstandingDues > 0 && (
                    <div style={{ fontSize: '0.78rem', color: 'var(--alert-red)', fontWeight: 700, marginTop: '2px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <span>⚠️</span> {t('Outstanding Debt')}: ₹{customerOutstandingDues.toFixed(0)}
                    </div>
                  )}
                </div>
              </div>
              <button 
                className="btn btn-outline" 
                onClick={() => { setSelectedCustomer(null); setInputQuery(''); }}
                style={{ padding: '6px 12px', fontSize: '0.8rem', color: 'var(--alert-red)', borderColor: 'rgba(211,47,47,0.2)' }}
              >
                <X size={14} /> {t('Clear')}
              </button>
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              {/* Search Field */}
              <div style={{ position: 'relative' }}>
                <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--primary-milk)' }} />
                <input 
                  type="text"
                  className="form-input"
                  placeholder={t('Search client name or scan logbook...')}
                  value={inputQuery}
                  onChange={(e) => { setInputQuery(e.target.value); setIsDropdownExpanded(true); }}
                  onFocus={() => setIsDropdownExpanded(true)}
                  style={{ width: '100%', paddingLeft: '48px', paddingRight: '48px' }}
                />
                <button
                  type="button"
                  onClick={() => setIsDropdownExpanded(!isDropdownExpanded)}
                  style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary-milk)' }}
                >
                  {isDropdownExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>
              </div>

              {/* Suggestions Dropdown */}
              {isDropdownExpanded && filteredCustomers.length > 0 && (
                <div style={{ position: 'absolute', left: 0, right: 0, top: '48px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', boxShadow: 'var(--shadow-lg)', maxHeight: '200px', overflowY: 'auto', zIndex: 100 }}>
                  {filteredCustomers.map(c => (
                    <div 
                      key={c.id}
                      onClick={() => { setSelectedCustomer(c); setInputQuery(c.name); setIsDropdownExpanded(false); setShowDirectRegisterPanel(false); }}
                      style={{ padding: '10px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--input-bg)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <strong style={{ fontSize: '0.9rem' }}>{c.name}</strong>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{c.phone}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Quick Pick Chips */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{t('Quick Pick:')}</span>
                
                {/* Auto Customer Chip */}
                <button 
                  className="btn btn-outline"
                  onClick={() => {
                    const existing = customers.find(c => c.name.toLowerCase() === nextAutoCustomerName.toLowerCase());
                    if (existing) {
                      setSelectedCustomer(existing);
                    } else {
                      const newId = Math.random().toString(36).substr(2, 9);
                      const newC: Customer = { id: newId, name: nextAutoCustomerName, phone: '', qrPreference: 'UPI', updatedAt: Date.now() };
                      Repository.saveCustomer(newC);
                      setSelectedCustomer(newC);
                      loadData();
                    }
                  }}
                  style={{ padding: '4px 10px', fontSize: '0.78rem', borderRadius: '16px', color: 'var(--primary-gold)', borderColor: 'rgba(255,160,0,0.3)', backgroundColor: 'rgba(255,160,0,0.05)' }}
                >
                  👤 {nextAutoCustomerName}
                </button>

                {/* New Client Toggle */}
                <button 
                  className="btn btn-outline"
                  onClick={() => setShowDirectRegisterPanel(!showDirectRegisterPanel)}
                  style={{ padding: '4px 10px', fontSize: '0.78rem', borderRadius: '16px', color: 'var(--primary-milk)', borderColor: 'rgba(30,136,229,0.3)', backgroundColor: 'rgba(30,136,229,0.05)' }}
                >
                  ➕ {t('New Client')}
                </button>
              </div>

              {/* Inline customer setup fields */}
              {showDirectRegisterPanel && (
                <div className="card" style={{ padding: '16px', border: '1px dashed var(--border-color)', backgroundColor: 'var(--input-bg)', marginTop: '12px' }}>
                  <form onSubmit={handleQuickAdd} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800 }}>Immediate Client Sign-Up</h4>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Business or Customer Name"
                      value={directRegName}
                      onChange={(e) => setDirectRegName(e.target.value)}
                      required 
                    />
                    <input 
                      type="tel" 
                      className="form-input" 
                      placeholder="Logistics Phone (Optional)"
                      value={directRegPhone}
                      onChange={(e) => setDirectRegPhone(e.target.value)}
                    />
                    {/* Payment Preference */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label className="form-label">Standard Payment Preference</label>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {['UPI', 'CASH'].map(pref => (
                          <button
                            key={pref}
                            type="button"
                            onClick={() => setDirectRegQr(pref)}
                            style={{
                              flex: 1,
                              padding: '8px',
                              borderRadius: '8px',
                              border: `1.5px solid ${directRegQr === pref ? 'var(--primary-milk)' : 'var(--border-color)'}`,
                              backgroundColor: directRegQr === pref ? 'rgba(30,136,229,0.08)' : 'transparent',
                              color: directRegQr === pref ? 'var(--primary-milk)' : 'var(--text-secondary)',
                              fontWeight: 700,
                              fontSize: '0.85rem',
                              cursor: 'pointer',
                              transition: 'all 0.15s'
                            }}
                          >
                            {pref}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                      <button type="button" className="btn btn-outline" onClick={() => setShowDirectRegisterPanel(false)} style={{ padding: '6px 12px', fontSize: '0.8rem' }}>{t('Cancel')}</button>
                      <button type="submit" className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>{t('Register & Use')}</button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>

        {/* STEP 2: CATEGORY CHOICE GRID */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: 'var(--primary-milk)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.78rem', fontWeight: 800 }}>2</div>
            <strong style={{ fontSize: '0.95rem', fontWeight: 800 }}>{t('Product Category Select')}</strong>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {prices.map(p => {
              const isChosen = selectedMilkType === p.milkType;
              const stock = todayStockMap[p.milkType] || 0.0;
              const sold = todaySalesMap[p.milkType] || 0.0;
              const remaining = Math.max(0, stock - sold);

              return (
                <div 
                  key={p.milkType}
                  onClick={() => setSelectedMilkType(p.milkType)}
                  style={{
                    padding: '12px',
                    borderRadius: '12px',
                    border: isChosen ? '2.5px solid var(--primary-milk)' : '1px solid var(--border-color)',
                    backgroundColor: isChosen ? 'rgba(30,136,229,0.08)' : 'var(--bg-card)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: '92px',
                    transition: 'all var(--transition-fast)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                    <Droplet size={18} style={{ color: isChosen ? 'var(--primary-milk)' : 'var(--text-secondary)', fill: isChosen ? 'currentColor' : 'none' }} />
                    {isChosen && <Check size={14} style={{ color: 'var(--primary-milk)' }} />}
                  </div>
                  <div style={{ marginTop: '8px' }}>
                    <div style={{ fontSize: '0.88rem', fontWeight: 800, color: isChosen ? 'var(--primary-milk)' : 'var(--text-primary)' }}>{t(p.milkType)}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px', fontWeight: 600 }}>
                      <span>₹{p.currentPrice}/L</span>
                      <span style={{ color: remaining <= 5.0 ? 'var(--alert-red)' : 'var(--organic-green)', fontWeight: 800 }}>{remaining.toFixed(0)}L Left</span>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Custom Mode */}
            {allowCustomRate && (
            <div 
              onClick={() => setSelectedMilkType('Custom')}
              style={{
                padding: '12px',
                borderRadius: '12px',
                border: selectedMilkType === 'Custom' ? '2.5px solid var(--primary-milk)' : '1px solid var(--border-color)',
                backgroundColor: selectedMilkType === 'Custom' ? 'rgba(30,136,229,0.08)' : 'var(--bg-card)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: '92px',
                transition: 'all var(--transition-fast)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                <FileEdit size={18} style={{ color: selectedMilkType === 'Custom' ? 'var(--primary-milk)' : 'var(--text-secondary)' }} />
                {selectedMilkType === 'Custom' && <Check size={14} style={{ color: 'var(--primary-milk)' }} />}
              </div>
              <div style={{ marginTop: '8px' }}>
                <div style={{ fontSize: '0.88rem', fontWeight: 800, color: selectedMilkType === 'Custom' ? 'var(--primary-milk)' : 'var(--text-primary)' }}>{t('Custom')}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px', fontWeight: 600 }}>
                  <span>Variable</span>
                  <span style={{ color: 'var(--primary-gold)', fontWeight: 800 }}>Dynamic</span>
                </div>
              </div>
            </div>
            )}
          </div>

          {/* Inline custom rate field if Custom selected */}
          {selectedMilkType === 'Custom' && (
            <div style={{ marginTop: '4px' }}>
              <label className="form-label">{canAccessField('Sales', 'ratePerLiter') ? t('Apply Custom Rate (₹ per Liter)') : t('Rate per Liter')}</label>
              <input 
                type="number"
                className="form-input"
                value={customPriceInput}
                onChange={(e) => setCustomPriceInput(e.target.value)}
                style={{ width: '100%' }}
                placeholder="e.g. 50"
              />
            </div>
          )}

          {/* Stock Balance warning notice */}
          {showStockWarnings && selectedMilkType !== 'Custom' && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 12px',
              borderRadius: '8px',
              fontSize: '0.8rem',
              fontWeight: 700,
              marginTop: '4px',
              backgroundColor: ((todayStockMap[selectedMilkType] || 0) - (todaySalesMap[selectedMilkType] || 0)) <= 0 ? 'rgba(211,47,47,0.08)' : (liters > ((todayStockMap[selectedMilkType] || 0) - (todaySalesMap[selectedMilkType] || 0)) ? 'rgba(255,160,0,0.08)' : 'rgba(46,125,50,0.08)'),
              color: ((todayStockMap[selectedMilkType] || 0) - (todaySalesMap[selectedMilkType] || 0)) <= 0 ? 'var(--alert-red)' : (liters > ((todayStockMap[selectedMilkType] || 0) - (todaySalesMap[selectedMilkType] || 0)) ? 'var(--primary-gold)' : 'var(--organic-green)')
            }}>
              <span>✓</span>
              <span>
                {((todayStockMap[selectedMilkType] || 0) - (todaySalesMap[selectedMilkType] || 0)) <= 0 
                  ? t('Out of stock! Ensure you allocate starting inventory in settings.') 
                  : (liters > ((todayStockMap[selectedMilkType] || 0) - (todaySalesMap[selectedMilkType] || 0)) 
                    ? t("Warning: Order exceeds today's remaining stock of %sL!", ((todayStockMap[selectedMilkType] || 0) - (todaySalesMap[selectedMilkType] || 0)).toFixed(0))
                    : t('Stock balance is secure. %s Liters available to fulfill.', ((todayStockMap[selectedMilkType] || 0) - (todaySalesMap[selectedMilkType] || 0)).toFixed(1))
                  )
                }
              </span>
            </div>
          )}
        </div>

        {/* STEP 3: CONFIGURE MILK VOLUME */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: 'var(--primary-milk)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.78rem', fontWeight: 800 }}>3</div>
            <strong style={{ fontSize: '0.95rem', fontWeight: 800 }}>{t('Configure Milk Volume')}</strong>
          </div>

          {/* Preset capsule chips */}
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '2px' }}>
            {volumePresets.map(val => (
              <button 
                key={val}
                type="button"
                className="btn"
                onClick={() => { setLiters(val); setRawLitersInput(val.toString()); }}
                style={{
                  padding: '6px 12px',
                  borderRadius: '12px',
                  fontSize: '0.8rem',
                  fontWeight: 900,
                  backgroundColor: liters === val ? 'var(--primary-milk)' : 'var(--bg-card)',
                  color: liters === val ? '#FFFFFF' : 'var(--text-primary)',
                  border: liters === val ? 'none' : '1px solid var(--border-color)',
                  boxShadow: 'var(--shadow-sm)'
                }}
              >
                {val} L
              </button>
            ))}
          </div>

          {/* Stepper buttons row */}
          <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border-color)', borderRadius: '16px', backgroundColor: 'var(--bg-card)', padding: '4px', height: '56px' }}>
            <button 
              type="button" 
              onClick={() => { if (liters > volumeStep) { const nextVal = Math.max(volumeStep, liters - volumeStep); setLiters(nextVal); setRawLitersInput(nextVal.toString()); } }}
              style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'var(--input-bg)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-milk)', cursor: 'pointer' }}
            >
              <Minus size={18} />
            </button>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <input 
                type="text" 
                value={rawLitersInput}
                onChange={(e) => { setRawLitersInput(e.target.value); const num = parseFloat(e.target.value); if (!isNaN(num)) setLiters(num); }}
                style={{ border: 'none', background: 'none', outline: 'none', fontSize: '1.4rem', fontWeight: 900, color: 'var(--primary-milk)', width: '100px', textAlign: 'center', fontFamily: 'inherit' }}
              />
            </div>
            <button 
              type="button" 
              onClick={() => { const nextVal = Math.min(maxVolume, liters + volumeStep); setLiters(nextVal); setRawLitersInput(nextVal.toString()); }}
              style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'var(--primary-milk)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF', cursor: 'pointer' }}
            >
              <Plus size={18} />
            </button>
          </div>
        </div>

        {/* STEP 4: PAYMENT RESOLUTION MODE */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: 'var(--primary-milk)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.78rem', fontWeight: 800 }}>4</div>
            <strong style={{ fontSize: '0.95rem', fontWeight: 800 }}>{t('Payment Resolution Mode')}</strong>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {enabledPaymentMethods.map(m => {
              const isSelected = paymentTypeChoice === m.code;
              const rgb = colorToRgb(m.color, m.code);
              return (
                <div 
                  key={m.code}
                  onClick={() => setPaymentTypeChoice(m.code)}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '12px',
                    border: isSelected ? `2px solid ${m.color}` : '1px solid var(--border-color)',
                    backgroundColor: isSelected ? `rgba(${rgb}, 0.08)` : 'var(--bg-card)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    transition: 'all var(--transition-fast)',
                    height: '56px'
                  }}
                >
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isSelected ? m.color : `rgba(${rgb}, 0.12)`,
                    color: isSelected ? '#FFFFFF' : m.color
                  }}>
                    {renderPaymentIcon(m.icon)}
                  </div>
                  <strong style={{ fontSize: '0.88rem', color: isSelected ? m.color : 'var(--text-secondary)' }}>{t(m.label)}</strong>
                </div>
              );
            })}
          </div>
        </div>

        {/* STEP 5: CAPTURED LOCATION (THE MISSING INPUT FIELD!) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <MapPin size={16} style={{ color: 'var(--primary-milk)' }} />
            <span>{t('Captured Location stamp')}</span>
          </label>
          <input 
            type="text" 
            className="form-input" 
            value={location} 
            onChange={(e) => setLocation(e.target.value)}
            style={{ width: '100%' }}
            placeholder={t('Enter society, route, or village name...')}
            required={requireLocation}
          />
        </div>

      </div>

      {/* Live Physical-Style Invoice Voucher Preview */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: 'var(--shadow-md)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--primary-milk)' }}>
              <Receipt size={18} />
              <strong style={{ fontSize: '1rem', fontWeight: 800 }}>{t('Live Invoice Voucher')}</strong>
            </div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 700 }}>
              {new Date().toISOString().slice(0, 10)}
            </span>
          </div>

          {/* Receipt Info Body */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{t('Customer')}</span>
              <strong style={{ fontSize: '0.9rem' }}>{selectedCustomer ? selectedCustomer.name : t('Guest / Unassigned')}</strong>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{t('Product Delivery')}</span>
              <strong style={{ fontSize: '0.9rem' }}>{t(selectedMilkType)}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{t('Voucher Breakdowns')}</span>
              <strong style={{ fontSize: '0.9rem' }}>{liters.toFixed(2)} L × ₹{rateResolved.toFixed(2)}</strong>
            </div>

            {customerOutstandingDues > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--alert-red)' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{t('Previous Dues')}</span>
                <strong style={{ fontSize: '0.9rem' }}>+ ₹{customerOutstandingDues.toFixed(0)}</strong>
              </div>
            )}

            {/* Dashed physical divider line */}
            <div style={{ borderTop: '2px dashed var(--border-color)', margin: '8px 0' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 800 }}>RECEIVABLE TOTAL</span>
                <div style={{
                  padding: '3px 8px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  marginTop: '4px',
                  width: 'fit-content',
                  backgroundColor: paymentTypeChoice === 'PENDING' ? 'rgba(211,47,47,0.12)' : (paymentTypeChoice === 'CASH' ? 'rgba(46,125,50,0.12)' : (paymentTypeChoice === 'UPI' ? 'rgba(255,160,0,0.12)' : 'rgba(30,136,229,0.12)')),
                  color: paymentTypeChoice === 'PENDING' ? 'var(--alert-red)' : (paymentTypeChoice === 'CASH' ? 'var(--organic-green)' : (paymentTypeChoice === 'UPI' ? 'var(--primary-gold)' : 'var(--primary-milk)'))
                }}>
                  Pay Mode: {paymentTypeChoice}
                </div>
              </div>

              <h2 style={{ fontSize: '2.2rem', fontWeight: 950, color: 'var(--primary-milk)', margin: 0, letterSpacing: '-0.04em' }}>
                {maskCurrency('Sales', 'totalAmount', finalCostCalculated)}
              </h2>
            </div>
          </div>
        </div>

        {/* SAVE BILLING RECORD CHECKOUT BUTTON */}
        <button 
          onClick={handleSaveSale}
          disabled={!selectedCustomer || !hasPageAction('Sales', 'create')}
          className="btn btn-primary"
          style={{ width: '100%', height: '56px', borderRadius: '16px', fontSize: '1.1rem', fontWeight: 800 }}
        >
          <Save size={20} />
          {t('Save Milk Sale')}
        </button>

        {/* Synced Mode card indicators */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="card card-premium" style={{ borderLeftColor: 'var(--primary-gold)', padding: '16px' }}>
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800 }}>{t('Dairy Sync Module')}</h4>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              Each milk sale registers instantly. Unsynced transactions automatically queue up locally and retry when connection is restored.
            </p>
          </div>
          <div className="card card-premium" style={{ borderLeftColor: 'var(--organic-green)', padding: '16px' }}>
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800 }}>{t('Offline Ledger Mode')}</h4>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              Fully featured database operational without internet. Designed for fields and rural collection routes.
            </p>
          </div>
        </div>
      {/* Save Confirmation Modal */}
      {showSaveConfirm && (
        <div className="dialog-overlay" style={{ zIndex: 1100 }}>
          <div className="dialog-content" style={{ maxWidth: '400px', textAlign: 'center', padding: '24px' }}>
            <h3 style={{ color: 'var(--primary-milk)', marginBottom: '16px', fontSize: '1.25rem' }}>
              {t('Confirm Sale')}
            </h3>
            <p style={{ marginBottom: '24px', fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
              {t('Are you sure you want to save this milk sale?')}
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button 
                className="btn btn-outline" 
                onClick={() => setShowSaveConfirm(false)}
                style={{ flex: 1 }}
              >
                {t('No')}
              </button>
              <button 
                className="btn btn-primary" 
                onClick={async () => {
                  setShowSaveConfirm(false);
                  await executeSaveSale();
                }}
                style={{ flex: 1 }}
              >
                {t('Yes')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Customer Confirmation Modal */}
      {showAddCustomerConfirm && (
        <div className="dialog-overlay" style={{ zIndex: 1100 }}>
          <div className="dialog-content" style={{ maxWidth: '400px', textAlign: 'center', padding: '24px' }}>
            <h3 style={{ color: 'var(--primary-milk)', marginBottom: '16px', fontSize: '1.25rem' }}>
              {t('Confirm Customer')}
            </h3>
            <p style={{ marginBottom: '24px', fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
              {t('Are you sure you want to add this customer?')}
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button 
                className="btn btn-outline" 
                onClick={() => setShowAddCustomerConfirm(false)}
                style={{ flex: 1 }}
              >
                {t('No')}
              </button>
              <button 
                className="btn btn-primary" 
                onClick={async () => {
                  setShowAddCustomerConfirm(false);
                  await executeQuickAdd();
                }}
                style={{ flex: 1 }}
              >
                {t('Yes')}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  </div>
  );
}
