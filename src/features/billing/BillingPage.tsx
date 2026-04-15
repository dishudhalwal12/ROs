import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { BadgeIndianRupee, CircleDollarSign, Plus, ReceiptText, TriangleAlert } from 'lucide-react';
import { z } from 'zod';

import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { SectionCard } from '@/components/ui/SectionCard';
import { useAuth } from '@/hooks/use-auth';
import { useWorkspace } from '@/hooks/use-workspace';
import { calculateMonthlyRevenue, getEffectiveInvoiceStatus } from '@/lib/domain';
import { formatCurrency, formatShortDate } from '@/lib/format';
import { invoiceSchema } from '@/lib/validation';
import { INVOICE_STATUS_LABELS } from '@/lib/constants';

export function BillingPage() {
  type InvoiceFormInput = z.input<typeof invoiceSchema>;
  type InvoiceFormValues = z.output<typeof invoiceSchema>;
  const { member } = useAuth();
  const { clients, projects, invoices, createInvoice, updateInvoiceStatus } = useWorkspace();
  const [modalOpen, setModalOpen] = useState(false);

  const form = useForm<InvoiceFormInput, undefined, InvoiceFormValues>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      clientId: clients[0]?.id ?? '',
      projectId: '',
      title: '',
      amount: 0,
      issuedDate: '',
      dueDate: '',
      status: 'draft',
    },
  });

  if (member?.role === 'member') {
    return (
      <SectionCard title="Billing access" subtitle="Founder and managers only">
        <EmptyState
          icon={ReceiptText}
          title="Restricted module"
          description="Team members can stay focused on delivery while revenue controls stay limited to leadership."
        />
      </SectionCard>
    );
  }

  const monthlyRevenue = calculateMonthlyRevenue(invoices);
  const overdueInvoices = invoices.filter(
    (invoice) => getEffectiveInvoiceStatus(invoice) === 'overdue',
  );

  async function submitInvoice(values: InvoiceFormValues) {
    await createInvoice({
      ...values,
      projectId: values.projectId || undefined,
    });
    form.reset({
      clientId: clients[0]?.id ?? '',
      projectId: '',
      title: '',
      amount: 0,
      issuedDate: '',
      dueDate: '',
      status: 'draft',
    });
    setModalOpen(false);
  }

  return (
    <div className="page-stack">
      <section className="page-header page-header--split">
        <div>
          <span className="eyebrow">Billing</span>
          <h1>Invoices, payment status, and founder visibility</h1>
          <p>Track sent, pending, paid, and overdue invoices without leaving the workspace.</p>
        </div>
        <div className="page-header__actions">
          <button type="button" className="pill-button" onClick={() => setModalOpen(true)}>
            <Plus size={16} />
            New invoice
          </button>
        </div>
      </section>

      <section className="stats-grid stats-grid--four">
        <article className="stat-card stat-card--peach">
          <div className="stat-card__icon">
            <BadgeIndianRupee size={18} />
          </div>
          <div className="stat-card__meta">
            <span>Monthly value</span>
            <strong>{formatCurrency(monthlyRevenue)}</strong>
            <small>Current month</small>
          </div>
        </article>
        <article className="stat-card stat-card--blue">
          <div className="stat-card__icon">
            <CircleDollarSign size={18} />
          </div>
          <div className="stat-card__meta">
            <span>Pending invoices</span>
            <strong>{invoices.filter((invoice) => invoice.status === 'pending').length}</strong>
            <small>Awaiting payment</small>
          </div>
        </article>
        <article className="stat-card stat-card--gold">
          <div className="stat-card__icon">
            <TriangleAlert size={18} />
          </div>
          <div className="stat-card__meta">
            <span>Overdue</span>
            <strong>{overdueInvoices.length}</strong>
            <small>Need attention</small>
          </div>
        </article>
        <article className="stat-card stat-card--mint">
          <div className="stat-card__icon">
            <ReceiptText size={18} />
          </div>
          <div className="stat-card__meta">
            <span>Total invoices</span>
            <strong>{invoices.length}</strong>
            <small>Across active clients</small>
          </div>
        </article>
      </section>

      <SectionCard title="Invoice tracker" subtitle="Founder-level control in one table">
        {invoices.length === 0 ? (
          <EmptyState
            icon={ReceiptText}
            title="No invoices yet"
            description="Create your first invoice to start tracking revenue and overdue follow-ups."
          />
        ) : (
          <div className="table-shell">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Client</th>
                  <th>Amount</th>
                  <th>Due</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => {
                  const client = clients.find((client) => client.id === invoice.clientId);
                  const status = getEffectiveInvoiceStatus(invoice);
                  return (
                    <tr key={invoice.id}>
                      <td>
                        <strong>{invoice.title}</strong>
                      </td>
                      <td>{client?.company ?? 'Unknown'}</td>
                      <td>{formatCurrency(invoice.amount)}</td>
                      <td>{formatShortDate(invoice.dueDate)}</td>
                      <td>
                        <div className="table-status">
                          <Badge tone={status === 'paid' ? 'success' : status === 'overdue' ? 'danger' : 'warning'}>
                            {INVOICE_STATUS_LABELS[status]}
                          </Badge>
                          <select
                            value={invoice.status}
                            onChange={(event) =>
                              void updateInvoiceStatus(
                                invoice.id,
                                event.target.value as typeof invoice.status,
                              )
                            }
                          >
                            <option value="draft">Draft</option>
                            <option value="sent">Sent</option>
                            <option value="pending">Pending</option>
                            <option value="paid">Paid</option>
                            <option value="overdue">Overdue</option>
                          </select>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <Modal title="Create invoice" open={modalOpen} onClose={() => setModalOpen(false)} width="lg">
        <form className="form-grid" onSubmit={form.handleSubmit((values) => void submitInvoice(values))}>
          <label>
            <span>Client</span>
            <select {...form.register('clientId')}>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.company}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Project</span>
            <select {...form.register('projectId')}>
              <option value="">Optional</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <label className="form-grid__wide">
            <span>Title</span>
            <input type="text" {...form.register('title')} />
          </label>
          <label>
            <span>Amount</span>
            <input type="number" min="0" {...form.register('amount')} />
          </label>
          <label>
            <span>Status</span>
            <select {...form.register('status')}>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
            </select>
          </label>
          <label>
            <span>Issued date</span>
            <input type="date" {...form.register('issuedDate')} />
          </label>
          <label>
            <span>Due date</span>
            <input type="date" {...form.register('dueDate')} />
          </label>
          <div className="modal-actions form-grid__wide">
            <button type="button" className="secondary-button" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="primary-button">
              <Plus size={16} />
              Create invoice
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
