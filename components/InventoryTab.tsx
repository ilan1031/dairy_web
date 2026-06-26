// d:/Gitfiles/dairy/dairy-web/components/InventoryTab.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/app/providers';
import Repository, { PriceConfig, PriceLog, MilkInventory } from '@/lib/repository';
import { hasPageAction } from '@/lib/permissions';
import { ArrowLeft, Save, PlusCircle, Calendar, LineChart, X } from 'lucide-react';

interface InventoryTabProps {
  onBack: () => void;
}

export default function InventoryTab({ onBack }: InventoryTabProps) {
  const { t } = useLanguage();

  const [prices, setPrices] = useState<PriceConfig[]>([]);
  const [priceLogs, setPriceLogs] = useState<PriceLog[]>([]);
  const [showOnlyCategoriesManager, setShowOnlyCategoriesManager] = useState(false);

  // Daily stock log state
  const [dateStr, setDateStr] = useState(new Date().toISOString().slice(0, 10));
  const [stockInputs, setStockInputs] = useState<Record<string, string>>({});
  const [rateInputs, setRateInputs] = useState<Record<string, string>>({});

  // Category rates manager
  const [selectedEditType, setSelectedEditType] = useState('Cow Milk');
  const [editNameInput, setEditNameInput] = useState('Cow Milk');
  const [editPriceInput, setEditPriceInput] = useState('50');

  // Add category dialog
  const [showAddCategoryDialog, setShowAddCategoryDialog] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatPrice, setNewCatPrice] = useState('');

  const loadData = () => {
    const prs = Repository.getPriceConfigs();
    const logs = Repository.getPriceLogs();
    setPrices(prs);
    setPriceLogs([...logs].sort((a, b) => b.timestamp - a.timestamp));

    if (prs.length > 0 && !prs.find(p => p.milkType === selectedEditType)) {
      setSelectedEditType(prs[0].milkType);
      setEditNameInput(prs[0].milkType);
    }

    const found = prs.find(p => p.milkType === selectedEditType);
    setEditPriceInput(found ? found.currentPrice.toString() : '50');
    if (found && editNameInput !== found.milkType) {
      setEditNameInput(found.milkType);
    }

    // Populate stock inputs from inventory for selected date
    const inventories = Repository.getMilkInventories();
    const matched = inventories.find(i => i.dateStr === dateStr);
    const stocks: Record<string, string> = {};
    const rates: Record<string, string> = {};

    prs.forEach(p => {
      rates[p.milkType] = p.currentPrice.toFixed(1);
    });

    if (matched) {
      if (matched.cowLiters > 0) stocks['Cow Milk'] = matched.cowLiters.toString();
      if (matched.buffaloLiters > 0) stocks['Buffalo Milk'] = matched.buffaloLiters.toString();
      if (matched.a2Liters > 0) stocks['A2 Milk'] = matched.a2Liters.toString();
      if (matched.customStocksRaw) {
        matched.customStocksRaw.split(',').forEach(pair => {
          const [type, vol] = pair.split(':');
          if (type && vol) stocks[type] = vol;
        });
      }
    }

    setStockInputs(stocks);
    setRateInputs(rates);
  };

  useEffect(() => {
    loadData();
  }, [dateStr, selectedEditType]);

  if (!hasPageAction('Inventory', 'view')) {
    return (
      <div className="card">
        <h3 style={{ margin: 0 }}>Access Denied</h3>
        <p style={{ color: 'var(--text-secondary)', marginTop: 8 }}>You do not have permission to view inventory.</p>
      </div>
    );
  }

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasPageAction('Inventory', 'create')) return alert('Permission denied');
    if (!newCatName || !newCatPrice) return;
    await Repository.savePriceConfig(newCatName, parseFloat(newCatPrice));
    setNewCatName('');
    setNewCatPrice('');
    setShowAddCategoryDialog(false);
    loadData();
  };

  const handleUpdateBaseRate = async () => {
    if (!hasPageAction('Inventory', 'edit')) return alert('Permission denied');
    const price = parseFloat(editPriceInput);
    if (isNaN(price)) return alert('Invalid price input');
    if (!editNameInput.trim()) return alert('Category name required');

    await Repository.savePriceConfig(editNameInput.trim(), price, selectedEditType);
    setSelectedEditType(editNameInput.trim());
    loadData();
    alert('Category updated successfully!');
  };

  const handleDeleteCategory = async () => {
    if (!hasPageAction('Inventory', 'delete')) return alert('Permission denied');
    if (!confirm(`Delete category "${selectedEditType}"?`)) return;

    await Repository.deletePriceConfig(selectedEditType);

    const prs = Repository.getPriceConfigs().filter(p => p.milkType !== selectedEditType);
    if (prs.length > 0) {
      setSelectedEditType(prs[0].milkType);
      setEditNameInput(prs[0].milkType);
      setEditPriceInput(prs[0].currentPrice.toString());
    } else {
      setSelectedEditType('');
      setEditNameInput('');
      setEditPriceInput('');
    }
    loadData();
    alert('Category deleted successfully!');
  };

  const handleSaveInventory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasPageAction('Inventory', 'create')) return alert('Permission denied');

    let cowL = 0, bufL = 0, a2L = 0;
    const customPairs: string[] = [];

    Object.entries(stockInputs).forEach(([type, val]) => {
      const vol = parseFloat(val || '0');
      if (type === 'Cow Milk') cowL = vol;
      else if (type === 'Buffalo Milk') bufL = vol;
      else if (type === 'A2 Milk') a2L = vol;
      else if (vol > 0) customPairs.push(`${type}:${vol}`);
    });

    const inv: MilkInventory = {
      dateStr,
      cowLiters: cowL,
      buffaloLiters: bufL,
      a2Liters: a2L,
      customStocksRaw: customPairs.join(','),
      updatedAt: Date.now()
    };

    await Repository.saveMilkInventory(inv);
    alert(t('Milk inventory logged successfully!'));
    loadData();
  };

  const categoryList = prices.length > 0 ? prices : [
    { milkType: 'Cow Milk', currentPrice: 50, updatedAt: Date.now() },
    { milkType: 'Buffalo Milk', currentPrice: 60, updatedAt: Date.now() },
    { milkType: 'A2 Milk', currentPrice: 70, updatedAt: Date.now() },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <button className="btn btn-outline" onClick={onBack} style={{ padding: '10px', borderRadius: '50%', width: '42px', height: '42px' }}>
          <ArrowLeft size={18} />
        </button>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 900, margin: 0 }}>Stock &amp; Catalog Register</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
            Set milk volume limits and configure pricing lists.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddCategoryDialog(true)} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <PlusCircle size={16} /> Category
        </button>
      </div>

      {/* Mode Toggle (mobile alignment) */}
      <div style={{
        display: 'flex', borderRadius: '12px', backgroundColor: 'var(--input-bg)',
        border: '1px solid var(--border-color)', padding: '4px', gap: '4px'
      }}>
        {[
          { label: 'Daily Stock Logs', mode: false },
          { label: 'Category Rates', mode: true },
        ].map(({ label, mode }) => (
          <button
            key={label}
            onClick={() => setShowOnlyCategoriesManager(mode)}
            style={{
              flex: 1, padding: '10px', borderRadius: '10px', border: 'none', cursor: 'pointer',
              fontWeight: 700, fontSize: '0.9rem', fontFamily: 'inherit',
              backgroundColor: showOnlyCategoriesManager === mode ? 'var(--primary-milk)' : 'transparent',
              color: showOnlyCategoriesManager === mode ? '#FFFFFF' : 'var(--text-secondary)',
            }}
          >{label}</button>
        ))}
      </div>

      {!showOnlyCategoriesManager ? (
        /* Daily Stock Logs Mode */
        <div className="card">
          <h3 style={{ fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Calendar size={18} style={{ color: 'var(--primary-milk)' }} />
            {t('Daily Procurement Stock Log')}
          </h3>

          <form onSubmit={handleSaveInventory}>
            <div className="form-group">
              <label className="form-label">Log Date (YYYY-MM-DD)</label>
              <input type="date" className="form-input" value={dateStr} onChange={(e) => setDateStr(e.target.value)} required />
            </div>

            {categoryList.map(cat => (
              <div key={cat.milkType} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">{t(cat.milkType)} — Stock (L)</label>
                  <input
                    type="number" step="0.01" className="form-input"
                    value={stockInputs[cat.milkType] || ''}
                    onChange={(e) => setStockInputs(prev => ({ ...prev, [cat.milkType]: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">{t(cat.milkType)} — Price (₹/L)</label>
                  <input
                    type="number" step="0.1" className="form-input"
                    value={rateInputs[cat.milkType] || cat.currentPrice.toString()}
                    onChange={(e) => setRateInputs(prev => ({ ...prev, [cat.milkType]: e.target.value }))}
                    placeholder="0.0"
                  />
                </div>
              </div>
            ))}

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '12px' }}>
              <Save size={16} />
              Lock &amp; Log Today&apos;s Registers
            </button>
          </form>
        </div>
      ) : (
        /* Category Rates Mode */
        <div className="card">
          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--primary-milk)', marginBottom: '4px' }}>
            Base Category Rates Manager
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            Edit pricing baseline configurations for all registered grades.
          </p>

          <div className="form-group">
            <label className="form-label">Select Milk Grade</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {categoryList.map(cat => (
                <button key={cat.milkType} type="button" onClick={() => {
                  setSelectedEditType(cat.milkType);
                  setEditNameInput(cat.milkType);
                  setEditPriceInput(cat.currentPrice.toString());
                }}
                  style={{
                    padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700,
                    fontSize: '0.82rem', fontFamily: 'inherit',
                    border: `1.5px solid ${selectedEditType === cat.milkType ? 'var(--primary-milk)' : 'var(--border-color)'}`,
                    backgroundColor: selectedEditType === cat.milkType ? 'rgba(30,136,229,0.1)' : 'transparent',
                    color: selectedEditType === cat.milkType ? 'var(--primary-milk)' : 'var(--text-secondary)',
                  }}
                >{t(cat.milkType)}</button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Category Name</label>
            <input type="text" className="form-input" value={editNameInput}
              onChange={(e) => setEditNameInput(e.target.value)} />
          </div>

          <div className="form-group">
            <label className="form-label">Base Price (₹/L)</label>
            <input type="number" step="0.1" className="form-input" value={editPriceInput}
              onChange={(e) => setEditPriceInput(e.target.value)} />
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
            <button className="btn btn-primary" onClick={handleUpdateBaseRate} style={{ flex: 2 }}>
              Update Category
            </button>
            {categoryList.length > 0 && selectedEditType && (
              <button className="btn btn-danger" type="button" onClick={handleDeleteCategory} style={{ flex: 1 }}>
                Delete
              </button>
            )}
          </div>
        </div>
      )}

      {/* Price History */}
      <div className="card" style={{ maxHeight: '240px', overflowY: 'auto' }}>
        <h3 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <LineChart size={16} style={{ color: 'var(--primary-gold)' }} />
          {t('Price Alerts & History')}
        </h3>
        {priceLogs.length === 0 ? (
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'center', display: 'block', padding: '16px' }}>
            No price modifications logged yet.
          </span>
        ) : (
          priceLogs.map(log => (
            <div key={log.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px', marginBottom: '6px' }}>
              <div>
                <span style={{ fontWeight: 600 }}>{t(log.milkType)}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: '8px' }}>
                  {new Date(log.timestamp).toLocaleDateString()}
                </span>
              </div>
              <div>
                <span style={{ textDecoration: 'line-through', color: 'var(--text-secondary)', marginRight: '6px' }}>₹{log.oldPrice}</span>
                <span style={{ color: 'var(--organic-green)', fontWeight: 700 }}>₹{log.newPrice}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Category Dialog */}
      {showAddCategoryDialog && (
        <div className="dialog-overlay" onClick={() => setShowAddCategoryDialog(false)}>
          <div className="dialog-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontWeight: 800 }}>{t('Add Milk Category')}</h3>
              <button className="tab-btn" onClick={() => setShowAddCategoryDialog(false)} style={{ padding: '4px' }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddCategory}>
              <div className="form-group">
                <label className="form-label">Category Name (e.g. Goat Milk)</label>
                <input type="text" className="form-input" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Baseline Rate per Liter (₹)</label>
                <input type="number" step="0.1" className="form-input" value={newCatPrice} onChange={(e) => setNewCatPrice(e.target.value)} required />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Add Category</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
