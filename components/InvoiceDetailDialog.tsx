// d:/Gitfiles/dairy/dairy-web/components/InvoiceDetailDialog.tsx
'use client';

import React from 'react';
import { useLanguage } from '@/app/providers';
import Repository, { Sale } from '@/lib/repository';
import { hasPermission } from '@/lib/permissions';
import { 
  Printer, 
  FileSpreadsheet, 
  Share2, 
  X, 
  DollarSign, 
  Smartphone,
  MapPin,
  Building,
  MessageCircle
} from 'lucide-react';

interface InvoiceDetailDialogProps {
  sale: Sale;
  onClose: () => void;
  onPaymentSettled: () => void;
}

export default function InvoiceDetailDialog({ 
  sale, 
  onClose, 
  onPaymentSettled 
}: InvoiceDetailDialogProps) {
  const { t, language } = useLanguage();

  const handleSettle = async (type: 'CASH' | 'UPI' | 'BANK') => {
    if (!hasPermission('canUpdate')) return alert('Permission denied');
    await Repository.markSaleAsPaid(sale.id, type);
    onClose();
    onPaymentSettled();
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = ['Sale ID', 'Customer Name', 'Milk Type', 'Liters', 'Rate per Liter', 'Total Amount', 'Payment Status', 'Payment Type', 'Created At'];
    const row = [
      sale.id,
      sale.customerName,
      sale.milkType,
      sale.liters,
      sale.ratePerLiter,
      sale.totalAmount,
      sale.paymentStatus,
      sale.paymentType,
      new Date(sale.createdAt).toISOString()
    ];
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), row.join(',')].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Invoice_${sale.customerName.replace(/\s+/g, '_')}_${sale.id}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print Receipt
  const handlePrint = () => {
    window.print();
  };

  const buildReceiptText = () => `
*${t('Invoice Details')}*
-------------------------
${t('Invoice for %s', sale.customerName)}
ID: ${sale.id}
${t('Date Issued:')} ${new Date(sale.createdAt).toLocaleDateString()}
${t('Milk Details:')}
 - ${t(sale.milkType)}: ${sale.liters} L @ ₹${sale.ratePerLiter}/L
-------------------------
*${t('Total Amount')}: ₹${sale.totalAmount.toFixed(2)}*
${t('Status:')} ${t(sale.paymentStatus)}
-------------------------
Powered by abielan Tech.
`;

  // Share receipt details
  const handleShare = () => {
    const text = buildReceiptText();
    
    if (navigator.share) {
      navigator.share({
        title: `Invoice - ${sale.customerName}`,
        text: text,
      }).catch(err => console.log('Share failed:', err));
    } else {
      navigator.clipboard.writeText(text);
      alert('Invoice details copied to clipboard!');
    }
  };

  const handleWhatsApp = () => {
    const text = encodeURIComponent(buildReceiptText());
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
          <h3 style={{ fontSize: '1.25rem', margin: 0 }}>{t('Invoice Details')}</h3>
          <button className="tab-btn" onClick={onClose} style={{ padding: '4px' }}>
            <X size={20} />
          </button>
        </div>

        {/* Invoice Receipt Body */}
        <div className="receipt-print-area" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--input-bg)' }}>
          <div style={{ textAlign: 'center', marginBottom: '10px' }}>
            <h4 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--primary-milk)', marginBottom: '4px' }}>
              {t('Dairy ERP')}
            </h4>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Offical Collection Terminal Receipt</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>{t('Date Issued:')}</span>
            <span style={{ fontWeight: 600 }}>
              {new Date(sale.createdAt).toLocaleDateString(language === 'ta' ? 'ta-IN' : 'en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Invoice For:</span>
            <span style={{ fontWeight: 700 }}>{sale.customerName}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Invoice Identifier:</span>
            <span style={{ fontFamily: 'monospace' }}>#{sale.id}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Milking Breed:</span>
            <span style={{ fontWeight: 600 }}>{t(sale.milkType)}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Volume Logged:</span>
            <span style={{ fontWeight: 600 }}>{sale.liters} L</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Bulk Cost Ratio:</span>
            <span style={{ fontWeight: 600 }}>₹{sale.ratePerLiter}/L</span>
          </div>

          {sale.location && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Captured GPS Location:</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '2px' }}>
                <MapPin size={12} /> {sale.location}
              </span>
            </div>
          )}

          {sale.paymentStatus === 'PAID' && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Invoice Settle Method:</span>
              <span style={{ fontWeight: 700 }}>{t(sale.paymentType)}</span>
            </div>
          )}

          <hr style={{ border: 'none', borderTop: '1px dashed var(--border-color)', margin: '4px 0' }} />

          {/* Item details */}
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>
              {t('Milk Details:')}
            </span>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '0.95rem' }}>
              <span>{t(sale.milkType)} ({sale.liters} L × ₹{sale.ratePerLiter})</span>
              <span style={{ fontWeight: 700 }}>₹{sale.totalAmount.toFixed(2)}</span>
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px dashed var(--border-color)', margin: '4px 0' }} />

          {/* Totals */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '1rem', fontWeight: 700 }}>NET TOTAL DUE</span>
            <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--primary-milk)' }}>
              ₹{sale.totalAmount.toFixed(2)}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>{t('Status:')}</span>
            <span className={`badge ${sale.paymentStatus === 'PAID' ? 'badge-paid' : 'badge-pending'}`}>
              {t(sale.paymentStatus)}
            </span>
          </div>

          {sale.paymentStatus === 'PAID' && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>{t('Collected via')}</span>
              <span style={{ fontWeight: 700 }}>{t(sale.paymentType)}</span>
            </div>
          )}
        </div>

        {/* Settle Action Buttons (if pending) */}
        {sale.paymentStatus === 'PENDING' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
              Settlement Mode
            </span>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button className="btn btn-secondary" onClick={() => handleSettle('CASH')} style={{ flex: 1, fontSize: '0.85rem', minWidth: '100px' }}>
                <DollarSign size={16} />
                CASH
              </button>
              <button className="btn btn-success" onClick={() => handleSettle('UPI')} style={{ flex: 1, fontSize: '0.85rem', minWidth: '100px' }}>
                <Smartphone size={16} />
                UPI
              </button>
              <button className="btn btn-outline" onClick={() => handleSettle('BANK')} style={{ flex: 1, fontSize: '0.85rem', minWidth: '100px' }}>
                <Building size={16} />
                BANK
              </button>
            </div>
          </div>
        )}

        {/* Toolbar Footer Actions */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '28px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
          <button className="btn btn-outline" onClick={handleExportCSV} style={{ flex: 1 }}>
            <FileSpreadsheet size={16} />
            {t('Export CSV')}
          </button>
          <button className="btn btn-outline" onClick={handlePrint} style={{ flex: 1 }}>
            <Printer size={16} />
            {t('Print Receipt')}
          </button>
          <button className="btn btn-outline" onClick={handleWhatsApp} style={{ flex: 1 }}>
            <MessageCircle size={16} />
            WhatsApp
          </button>
          <button className="btn btn-outline" onClick={handleShare} style={{ flex: 1 }}>
            <Share2 size={16} />
            Share
          </button>
        </div>

        {/* Inline CSS for hiding dialog wrapper during browser print */}
        <style jsx global>{`
          @media print {
            body * {
              visibility: hidden;
            }
            .dialog-content, .receipt-print-area, .receipt-print-area * {
              visibility: visible;
            }
            .dialog-content {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              border: none;
              box-shadow: none;
              padding: 0;
            }
            .dialog-overlay {
              background-color: transparent;
              backdrop-filter: none;
              position: static;
            }
            .tab-btn, .btn, hr + div + div {
              display: none !important;
            }
          }
        `}</style>
      </div>
    </div>
  );
}
