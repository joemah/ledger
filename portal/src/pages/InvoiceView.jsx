import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '@/api/client';
import { Printer, ArrowLeft, Pencil, Download, Mail, Send, CheckCircle, Copy, Bell } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/format';
import PaymentPanel from '@/components/PaymentPanel';
import PaymentLinkPanel from '@/components/PaymentLinkPanel';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export default function InvoiceView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [client, setClient] = useState(null);
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [emailing, setEmailing] = useState(false);
  const [emailMsg, setEmailMsg] = useState('');
  const invoiceRef = useRef(null);

  const generatePDF = async () => {
    const canvas = await html2canvas(invoiceRef.current, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
    });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pdfWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    // Always fit on exactly one page — scale down if content exceeds A4
    const scale = Math.min(1, pdfHeight / imgHeight);
    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth * scale, imgHeight * scale);
    return pdf;
  };

  const handleDownloadPDF = async () => {
    if (!invoiceRef.current) return;
    setDownloading(true);
    try {
      const pdf = await generatePDF();
      pdf.save(`${invoice.invoice_number}.pdf`);
    } catch (e) {
      console.error(e);
    }
    setDownloading(false);
  };

  const handleEmail = async () => {
    if (!client?.email) return;
    setEmailing(true);
    setEmailMsg('');
    try {
      const pdf = await generatePDF();
      const base64 = pdf.output('datauristring').split(',')[1];
      await api.integrations.Core.SendEmail({
        to: client.email,
        subject: `Invoice ${invoice.invoice_number} from ${company?.name || ''}`,
        body: `Dear ${client.name},\n\nPlease find attached invoice ${invoice.invoice_number} for ${formatCurrency(invoice.total, currency)}.\n\nDue date: ${formatDate(invoice.due_date)}\n\nThank you for your business.\n\n${company?.name || ''}`,
        attachments: [{ filename: `${invoice.invoice_number}.pdf`, content: base64 }],
      });
      setEmailMsg(`Invoice emailed to ${client.email}`);
    } catch (e) {
      setEmailMsg('Failed to send. Emailing non-app users requires a paid plan and a custom domain.');
    }
    setEmailing(false);
    setTimeout(() => setEmailMsg(''), 6000);
  };

  useEffect(() => {
    (async () => {
      try {
        const inv = await api.entities.Invoice.get(id);
        setInvoice(inv);
        const [clientRes, companyRes] = await Promise.all([
          inv.client_id ? api.entities.Client.get(inv.client_id) : Promise.resolve(null),
          api.entities.Company.filter({}, { limit: 1 }),
        ]);
        setClient(clientRes);
        setCompany(companyRes.items[0] || null);
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    })();
  }, [id]);

  const reloadInvoice = async () => {
    try {
      const inv = await api.entities.Invoice.get(id);
      setInvoice(inv);
    } catch (e) {
      console.error(e);
    }
  };

  const updateStatus = async (status) => {
    try {
      await api.entities.Invoice.update(invoice.id, { ...invoice, status });
      const inv = await api.entities.Invoice.get(id);
      setInvoice(inv);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDuplicate = async () => {
    try {
      const newInv = await api.entities.Invoice.duplicate(invoice.id);
      navigate(`/invoices/${newInv.id}/edit`);
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) return <div className="p-10 text-sm text-neutral-400">Loading...</div>;
  if (!invoice) return <div className="p-10 text-sm text-neutral-400">Invoice not found</div>;

  const currency = invoice.currency;

  const socials = [
    { key: 'social_linkedin', label: 'LinkedIn' },
    { key: 'social_twitter', label: 'Twitter' },
    { key: 'social_instagram', label: 'Instagram' },
    { key: 'social_facebook', label: 'Facebook' },
  ].filter((s) => company?.[s.key]);

  return (
    <div className="min-h-screen bg-neutral-100">
      {/* Action bar */}
      <div className="no-print bg-white border-b border-neutral-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between">
          <button onClick={() => navigate('/')} className="flex items-center gap-2 text-sm text-neutral-600 hover:text-neutral-900 transition">
            <ArrowLeft size={16} /> Back to dashboard
          </button>
          <div className="flex gap-2">
            {invoice.status === 'draft' && (
              <button onClick={() => updateStatus('sent')} className="flex items-center gap-2 px-4 py-2 text-sm border border-neutral-300 rounded-lg hover:bg-neutral-50 transition">
                <Send size={16} /> Mark as Sent
              </button>
            )}
            {invoice.status !== 'paid' && invoice.status !== 'draft' && (
              <button onClick={() => updateStatus('paid')} className="flex items-center gap-2 px-4 py-2 text-sm border border-emerald-300 text-emerald-700 rounded-lg hover:bg-emerald-50 transition">
                <CheckCircle size={16} /> Mark as Paid
              </button>
            )}
            <button onClick={handleDuplicate} className="flex items-center gap-2 px-4 py-2 text-sm border border-neutral-300 rounded-lg hover:bg-neutral-50 transition">
              <Copy size={16} /> Duplicate
            </button>
            <Link to={`/invoices/${id}/edit`} className="flex items-center gap-2 px-4 py-2 text-sm border border-neutral-300 rounded-lg hover:bg-neutral-50 transition">
              <Pencil size={16} /> Edit
            </Link>
            <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 text-sm border border-neutral-300 rounded-lg hover:bg-neutral-50 transition">
              <Printer size={16} /> Print
            </button>
            <button onClick={handleDownloadPDF} disabled={downloading} className="flex items-center gap-2 px-4 py-2 text-sm bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 disabled:opacity-50 transition">
              <Download size={16} /> {downloading ? 'Generating...' : 'Download PDF'}
            </button>
            {client?.email && (
              <button onClick={handleEmail} disabled={emailing} className="flex items-center gap-2 px-4 py-2 text-sm border border-neutral-300 rounded-lg hover:bg-neutral-50 transition disabled:opacity-50">
                <Mail size={16} /> {emailing ? 'Sending...' : 'Email to Client'}
              </button>
            )}
          </div>
        </div>
        {emailMsg && (
          <div className="max-w-4xl mx-auto px-6 pb-2 text-sm text-neutral-600">{emailMsg}</div>
        )}
        {invoice.reminder_count > 0 && (
          <div className="max-w-4xl mx-auto px-6 pb-3">
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-sm text-amber-700 flex items-center gap-2">
              <Bell size={14} />
              {invoice.reminder_count} reminder{invoice.reminder_count !== 1 ? 's' : ''} sent
              {invoice.last_reminder_date && ` · Last: ${formatDate(invoice.last_reminder_date)}`}
            </div>
          </div>
        )}
      </div>

      {/* Invoice document */}
      <div ref={invoiceRef} className="max-w-4xl mx-auto my-8 bg-white shadow-xl print:shadow-none print:my-0 print:max-w-none flex flex-col" style={{ aspectRatio: '210 / 297' }}>
        {/* Black header */}
        <div className="bg-neutral-900 text-white px-10 py-7 flex items-start justify-between">
          <div>
            {company?.logo ? (
              <img src={company.logo} alt="logo" className="h-14 mb-3 object-contain" />
            ) : (
              <div className="h-14 mb-3 flex items-center text-2xl font-bold text-white/90">
                {company?.name || ''}
              </div>
            )}
            <div className="text-lg font-semibold">{company?.name}</div>
            {company?.tagline && <div className="text-white/50 text-sm mt-0.5">{company.tagline}</div>}
          </div>
          <div className="text-right">
            <div className="text-3xl font-light tracking-[0.2em] uppercase">Invoice</div>
            <div className="text-white/50 text-sm mt-2">{invoice.invoice_number}</div>
          </div>
        </div>

        {/* White body */}
        <div className="px-10 py-7 text-neutral-900 flex-1 flex flex-col min-h-0">
          {/* From / Bill To */}
          <div className="grid grid-cols-2 gap-12 mb-6">
            <div>
              <div className="text-xs uppercase tracking-wider text-neutral-400 mb-2 font-medium">From</div>
              <div className="font-semibold">{company?.name}</div>
              <div className="text-sm text-neutral-600 mt-1.5 space-y-0.5">
                {company?.address && <div>{company.address}</div>}
                {(company?.postal_code || company?.city) && (
                  <div>{[company.postal_code, company.city].filter(Boolean).join(' ')}</div>
                )}
                {company?.country && <div>{company.country}</div>}
                {company?.location_label && <div>{company.location_label}</div>}
                {company?.email && <div>{company.email}</div>}
                {company?.phone && <div>{company.phone}</div>}
                {company?.vat_number && <div className="pt-1">VAT: {company.vat_number}</div>}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-neutral-400 mb-2 font-medium">Bill To</div>
              <div className="font-semibold">{client?.name || invoice.client_name}</div>
              <div className="text-sm text-neutral-600 mt-1.5 space-y-0.5">
                {client?.contact_person && <div>{client.contact_person}</div>}
                {client?.address && <div>{client.address}</div>}
                {(client?.postal_code || client?.city) && (
                  <div>{[client.postal_code, client.city].filter(Boolean).join(' ')}</div>
                )}
                {client?.country && <div>{client.country}</div>}
                {client?.email && <div>{client.email}</div>}
                {client?.phone && <div>{client.phone}</div>}
                {client?.vat_number && <div className="pt-1">VAT: {client.vat_number}</div>}
              </div>
            </div>
          </div>

          {/* Meta row */}
          <div className="grid grid-cols-4 gap-6 mb-6 pb-4 border-b border-neutral-200">
            <div>
              <div className="text-xs uppercase tracking-wider text-neutral-400 font-medium">Issue Date</div>
              <div className="text-sm font-medium mt-1.5">{formatDate(invoice.issue_date)}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-neutral-400 font-medium">Due Date</div>
              <div className="text-sm font-medium mt-1.5">{formatDate(invoice.due_date)}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-neutral-400 font-medium">Currency</div>
              <div className="text-sm font-medium mt-1.5">{invoice.currency}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-neutral-400 font-medium">Status</div>
              <div className="text-sm font-medium mt-1.5 capitalize">{invoice.status}</div>
            </div>
          </div>

          {/* Items table */}
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-neutral-900">
                <th className="text-left text-xs uppercase tracking-wider py-2 font-semibold">Description</th>
                <th className="text-right text-xs uppercase tracking-wider py-2 font-semibold w-24">Qty</th>
                <th className="text-right text-xs uppercase tracking-wider py-2 font-semibold w-32">Unit Price</th>
                <th className="text-right text-xs uppercase tracking-wider py-2 font-semibold w-32">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items?.map((item, i) => (
                <tr key={i} className="border-b border-neutral-100">
                  <td className="py-2 text-sm align-top">{item.description}</td>
                  <td className="py-2 text-sm text-right align-top">{item.quantity}</td>
                  <td className="py-2 text-sm text-right align-top">{formatCurrency(item.unit_price, currency)}</td>
                  <td className="py-2 text-sm text-right font-medium align-top">{formatCurrency(item.total, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals + Notes pushed to bottom */}
          <div className="mt-auto">
            <div className="flex justify-end pt-4">
              <div className="w-72 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-500">Subtotal</span>
                  <span className="font-medium">{formatCurrency(invoice.subtotal, currency)}</span>
                </div>
                {Number(invoice.discount_amount) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-500">
                      Discount{invoice.discount_type === 'percent' ? ` (${invoice.discount_value}%)` : ''}
                    </span>
                    <span className="font-medium text-emerald-600">−{formatCurrency(invoice.discount_amount, currency)}</span>
                  </div>
                )}
                {Number(invoice.tax_rate) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-500">Tax ({invoice.tax_rate}%)</span>
                    <span className="font-medium">{formatCurrency(invoice.tax_amount, currency)}</span>
                  </div>
                )}
                {Number(invoice.late_fee_amount) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-500">Late Fee</span>
                    <span className="font-medium text-red-600">+{formatCurrency(invoice.late_fee_amount, currency)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t-2 border-neutral-900 pt-2 text-lg font-semibold">
                  <span>Total Due</span>
                  <span>{formatCurrency(invoice.total, currency)}</span>
                </div>
                {Number(invoice.amount_paid) > 0 && (
                  <>
                    <div className="flex justify-between text-sm pt-2">
                      <span className="text-neutral-500">Amount Paid</span>
                      <span className="font-medium text-emerald-600">−{formatCurrency(invoice.amount_paid, currency)}</span>
                    </div>
                    <div className="flex justify-between border-t border-neutral-300 pt-2 font-semibold">
                      <span>Balance Due</span>
                      <span>{formatCurrency(Math.max(0, (invoice.total || 0) + (invoice.late_fee_amount || 0) - (invoice.amount_paid || 0)), currency)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {(invoice.notes || invoice.payment_terms) && (
              <div className="border-t border-neutral-200 pt-4 mt-4 space-y-3">
                {invoice.payment_terms && (
                  <div>
                    <div className="text-xs uppercase tracking-wider text-neutral-400 mb-1 font-medium">Payment Terms</div>
                    <div className="text-sm text-neutral-600">{invoice.payment_terms}</div>
                  </div>
                )}
                {invoice.notes && (
                  <div>
                    <div className="text-xs uppercase tracking-wider text-neutral-400 mb-1 font-medium">Notes</div>
                    <div className="text-sm text-neutral-600 whitespace-pre-wrap">{invoice.notes}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Black footer */}
        <div className="bg-neutral-900 text-white px-10 py-5 text-sm">
          <div className="flex justify-between items-start gap-8">
            <div className="space-y-0.5 text-white/50">
              {(company?.bank_name || company?.iban || company?.bic) && (
                <>
                  {company?.bank_name && <div>{company.bank_name}</div>}
                  {company?.iban && <div>IBAN: {company.iban}</div>}
                  {company?.bic && <div>BIC: {company.bic}</div>}
                </>
              )}
            </div>
            <div className="text-right space-y-0.5 text-white/50">
              {company?.website && <div>{company.website}</div>}
              {company?.email && <div>{company.email}</div>}
              {socials.length > 0 && (
                <div className="flex justify-end gap-3 pt-1">
                  {socials.map((s) => (
                    <span key={s.key} className="text-white/40">{s.label}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <PaymentPanel invoice={invoice} onPaymentChange={reloadInvoice} />
      <PaymentLinkPanel invoice={invoice} onLinkGenerated={reloadInvoice} />

    </div>
  );
}