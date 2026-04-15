import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Building2, FilePlus2, FileText, FolderUp, HandCoins, Plus, WandSparkles } from 'lucide-react';
import { z } from 'zod';

import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { SectionCard } from '@/components/ui/SectionCard';
import { useWorkspace } from '@/hooks/use-workspace';
import { clientSchema, noteSchema } from '@/lib/validation';
import { DEAL_STAGE_LABELS } from '@/lib/constants';
import { formatCurrency, formatLongDateTime, formatRelativeTime, formatShortDate } from '@/lib/format';
import type { NoteCategory } from '@/types/models';

const stages = ['lead', 'qualified', 'proposal_sent', 'negotiation', 'won', 'lost'] as const;
const clientTabs = ['overview', 'notes', 'proposals', 'documents', 'invoices', 'projects'] as const;

export function CrmPage() {
  type ClientFormInput = z.input<typeof clientSchema>;
  type ClientFormValues = z.output<typeof clientSchema>;
  type NoteFormInput = z.input<typeof noteSchema>;
  type NoteFormValues = z.output<typeof noteSchema>;
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    clients,
    notes,
    invoices,
    projects,
    members,
    createClient,
    createNote,
    updateClientStage,
    convertClientToProject,
    uploadAttachment,
  } = useWorkspace();
  const [createModalOpen, setCreateModalOpen] = useState(searchParams.get('compose') === 'client');
  const [recordModalCategory, setRecordModalCategory] = useState<NoteCategory | null>(null);
  const [activeTab, setActiveTab] = useState<(typeof clientTabs)[number]>('overview');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [recordError, setRecordError] = useState<string | null>(null);

  useEffect(() => {
    setCreateModalOpen(searchParams.get('compose') === 'client');
  }, [searchParams]);

  const selectedClientId = searchParams.get('client') ?? clients[0]?.id ?? null;
  const selectedClient = clients.find((client) => client.id === selectedClientId) ?? null;

  const relatedNotes = useMemo(
    () => notes.filter((note) => note.entityType === 'client' && note.entityId === selectedClientId),
    [notes, selectedClientId],
  );
  const relatedInvoices = invoices.filter((invoice) => invoice.clientId === selectedClientId);
  const relatedProjects = projects.filter((project) => project.clientId === selectedClientId);

  const clientForm = useForm<ClientFormInput, undefined, ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      name: '',
      company: '',
      contactName: '',
      email: '',
      phone: '',
      stage: 'lead',
      value: 0,
      nextFollowUpAt: '',
      tags: '',
      summary: '',
    },
  });

  const recordForm = useForm<NoteFormInput, undefined, NoteFormValues>({
    resolver: zodResolver(noteSchema),
    defaultValues: {
      entityType: 'client',
      entityId: selectedClientId ?? '',
      title: '',
      content: '',
      visibility: 'team',
      category: 'note',
    },
  });

  useEffect(() => {
    if (selectedClientId) {
      recordForm.setValue('entityId', selectedClientId);
    }
  }, [recordForm, selectedClientId]);

  async function submitClient(values: ClientFormValues) {
    const client = await createClient({
      ...values,
      tags: values.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
    });
    clientForm.reset();
    setCreateModalOpen(false);
    setSearchParams(new URLSearchParams({ client: client.id }));
  }

  async function submitRecord(values: NoteFormValues) {
    setRecordError(null);
    try {
      const attachments =
        values.category === 'document' && pendingFile
          ? [
              await uploadAttachment({
                entityType: 'client',
                entityId: values.entityId,
                category: values.category,
                file: pendingFile,
              }),
            ]
          : [];

      await createNote({
        ...values,
        attachments,
      });
      recordForm.reset({
        entityType: 'client',
        entityId: selectedClientId ?? '',
        title: '',
        content: '',
        visibility: 'team',
        category: 'note',
      });
      setPendingFile(null);
      setRecordModalCategory(null);
    } catch (error) {
      setRecordError(
        error instanceof Error ? error.message : 'Unable to save this record right now.',
      );
    }
  }

  return (
    <div className="page-stack">
      <section className="page-header page-header--split">
        <div>
          <span className="eyebrow">CRM</span>
          <h1>Leads, proposals, and client memory</h1>
          <p>Move opportunities from first contact to active delivery without losing context.</p>
        </div>
        <div className="page-header__actions">
          <button type="button" className="pill-button" onClick={() => setCreateModalOpen(true)}>
            <Plus size={16} />
            New client
          </button>
        </div>
      </section>

      <SectionCard title="Pipeline" subtitle="Drag-worthy clarity without leaving the page">
        {clients.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="Start the pipeline"
            description="Create your first lead to bring CRM, tasks, notes, and billing together."
          />
        ) : (
          <div className="crm-stage-grid">
            {stages.map((stage) => (
              <div key={stage} className="crm-stage-column">
                <header>
                  <strong>{DEAL_STAGE_LABELS[stage]}</strong>
                  <span>{clients.filter((client) => client.stage === stage).length}</span>
                </header>
                <div className="crm-stage-column__body">
                  {clients
                    .filter((client) => client.stage === stage)
                    .map((client) => (
                      <button
                        key={client.id}
                        type="button"
                        className={
                          client.id === selectedClientId
                            ? 'crm-client-card crm-client-card--active'
                            : 'crm-client-card'
                        }
                        onClick={() => setSearchParams(new URLSearchParams({ client: client.id }))}
                      >
                        <strong>{client.company}</strong>
                        <p>{client.contactName}</p>
                        <small>{formatCurrency(client.value)}</small>
                      </button>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {selectedClient ? (
        <SectionCard
          title={selectedClient.company}
          subtitle={`${selectedClient.contactName} · ${selectedClient.email}`}
          action={
            <div className="toggle-group">
              <select
                value={selectedClient.stage}
                onChange={(event) =>
                  void updateClientStage(selectedClient.id, event.target.value as typeof selectedClient.stage)
                }
              >
                {stages.map((stage) => (
                  <option key={stage} value={stage}>
                    {DEAL_STAGE_LABELS[stage]}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="secondary-button"
                onClick={() => void convertClientToProject(selectedClient.id)}
              >
                <WandSparkles size={16} />
                Convert to project
              </button>
            </div>
          }
        >
          <div className="tab-row">
            {clientTabs.map((tab) => (
              <button
                key={tab}
                type="button"
                className={activeTab === tab ? 'tab-button tab-button--active' : 'tab-button'}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>

          {activeTab === 'overview' ? (
            <div className="detail-grid">
              <div>
                <span>Value</span>
                <strong>{formatCurrency(selectedClient.value)}</strong>
              </div>
              <div>
                <span>Next follow-up</span>
                <strong>
                  {selectedClient.nextFollowUpAt
                    ? formatShortDate(selectedClient.nextFollowUpAt)
                    : 'Not scheduled'}
                </strong>
              </div>
              <div>
                <span>Owner</span>
                <strong>
                  {members.find((member) => member.uid === selectedClient.ownerId)?.name ?? 'Unassigned'}
                </strong>
              </div>
              <div>
                <span>Phone</span>
                <strong>{selectedClient.phone}</strong>
              </div>
              <div className="detail-grid__wide">
                <span>Summary</span>
                <p>{selectedClient.summary}</p>
              </div>
            </div>
          ) : null}

          {activeTab === 'notes' ? (
            <RecordList
              records={relatedNotes.filter((note) => note.category === 'note')}
              emptyTitle="No notes yet"
              emptyDescription="Client notes and decisions will land here."
              onAdd={() => {
                recordForm.setValue('category', 'note');
                setRecordModalCategory('note');
              }}
              actionLabel="Add note"
            />
          ) : null}

          {activeTab === 'proposals' ? (
            <RecordList
              records={relatedNotes.filter((note) => note.category === 'proposal')}
              emptyTitle="No proposals tracked"
              emptyDescription="Store proposal revisions and summaries here."
              onAdd={() => {
                recordForm.setValue('category', 'proposal');
                setRecordModalCategory('proposal');
              }}
              actionLabel="Add proposal"
            />
          ) : null}

          {activeTab === 'documents' ? (
            <RecordList
              records={relatedNotes.filter((note) => note.category === 'document')}
              emptyTitle="No documents uploaded"
              emptyDescription="Store decks, briefs, and contracts against the client."
              onAdd={() => {
                recordForm.setValue('category', 'document');
                setRecordModalCategory('document');
              }}
              actionLabel="Upload document"
            />
          ) : null}

          {activeTab === 'invoices' ? (
            <div className="list-stack">
              {relatedInvoices.length === 0 ? (
                <EmptyState
                  icon={HandCoins}
                  title="No invoices yet"
                  description="Billing linked to this client will show here."
                />
              ) : (
                relatedInvoices.map((invoice) => (
                  <article key={invoice.id} className="list-row">
                    <div>
                      <strong>{invoice.title}</strong>
                      <p>{formatLongDateTime(invoice.issuedDate)}</p>
                    </div>
                    <div className="list-row__meta">
                      <Badge tone="warning">{invoice.status}</Badge>
                      <span>{formatCurrency(invoice.amount)}</span>
                    </div>
                  </article>
                ))
              )}
            </div>
          ) : null}

          {activeTab === 'projects' ? (
            <div className="list-stack">
              {relatedProjects.length === 0 ? (
                <EmptyState
                  icon={FileText}
                  title="No project linked"
                  description="Convert the client to a project when the deal closes."
                />
              ) : (
                relatedProjects.map((project) => (
                  <article key={project.id} className="list-row">
                    <div>
                      <strong>{project.name}</strong>
                      <p>{project.summary}</p>
                    </div>
                    <div className="list-row__meta">
                      <Badge tone="success">{project.status}</Badge>
                      <small>{project.vertical}</small>
                    </div>
                  </article>
                ))
              )}
            </div>
          ) : null}
        </SectionCard>
      ) : null}

      <Modal title="Add client" open={createModalOpen} onClose={() => setCreateModalOpen(false)} width="lg">
        <form className="form-grid" onSubmit={clientForm.handleSubmit((values) => void submitClient(values))}>
          <label>
            <span>Internal label</span>
            <input type="text" {...clientForm.register('name')} />
          </label>
          <label>
            <span>Company</span>
            <input type="text" {...clientForm.register('company')} />
          </label>
          <label>
            <span>Primary contact</span>
            <input type="text" {...clientForm.register('contactName')} />
          </label>
          <label>
            <span>Email</span>
            <input type="email" {...clientForm.register('email')} />
          </label>
          <label>
            <span>Phone</span>
            <input type="text" {...clientForm.register('phone')} />
          </label>
          <label>
            <span>Stage</span>
            <select {...clientForm.register('stage')}>
              {stages.map((stage) => (
                <option key={stage} value={stage}>
                  {DEAL_STAGE_LABELS[stage]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Value</span>
            <input type="number" min="0" {...clientForm.register('value')} />
          </label>
          <label>
            <span>Next follow-up</span>
            <input type="datetime-local" {...clientForm.register('nextFollowUpAt')} />
          </label>
          <label className="form-grid__wide">
            <span>Tags</span>
            <input type="text" placeholder="Web Experience, Retainer" {...clientForm.register('tags')} />
          </label>
          <label className="form-grid__wide">
            <span>Summary</span>
            <textarea rows={4} {...clientForm.register('summary')} />
          </label>
          <div className="modal-actions form-grid__wide">
            <button type="button" className="secondary-button" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="primary-button">
              <Plus size={16} />
              Create client
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        title={
          recordModalCategory === 'document'
            ? 'Upload document'
            : recordModalCategory === 'proposal'
              ? 'Add proposal record'
              : 'Add note'
        }
        open={Boolean(recordModalCategory)}
        onClose={() => setRecordModalCategory(null)}
      >
        <form className="form-grid" onSubmit={recordForm.handleSubmit((values) => void submitRecord(values))}>
          {recordError ? <div className="form-error form-grid__wide">{recordError}</div> : null}
          <label>
            <span>Title</span>
            <input type="text" {...recordForm.register('title')} />
          </label>
          <label>
            <span>Visibility</span>
            <select {...recordForm.register('visibility')}>
              <option value="team">Team</option>
              <option value="leadership">Leadership</option>
              <option value="private">Private</option>
            </select>
          </label>
          <label className="form-grid__wide">
            <span>Content</span>
            <textarea rows={5} {...recordForm.register('content')} />
          </label>
          {recordModalCategory === 'document' ? (
            <label className="form-grid__wide">
              <span>Attachment</span>
              <input type="file" onChange={(event) => setPendingFile(event.target.files?.[0] ?? null)} />
            </label>
          ) : null}
          <div className="modal-actions form-grid__wide">
            <button type="button" className="secondary-button" onClick={() => setRecordModalCategory(null)}>
              Cancel
            </button>
            <button type="submit" className="primary-button">
              {recordModalCategory === 'document' ? <FolderUp size={16} /> : <FilePlus2 size={16} />}
              Save record
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function RecordList({
  records,
  emptyTitle,
  emptyDescription,
  onAdd,
  actionLabel,
}: {
  records: Array<{
    id: string;
    title: string;
    content: string;
    createdAt: string;
    attachments?: Array<{ url: string; name: string }>;
  }>;
  emptyTitle: string;
  emptyDescription: string;
  onAdd: () => void;
  actionLabel: string;
}) {
  return (
    <div className="list-stack">
      <div className="section-inline-actions">
        <button type="button" className="secondary-button" onClick={onAdd}>
          <Plus size={16} />
          {actionLabel}
        </button>
      </div>
      {records.length === 0 ? (
        <EmptyState icon={FileText} title={emptyTitle} description={emptyDescription} />
      ) : (
        records.map((record) => (
          <article key={record.id} className="record-card">
            <div className="record-card__header">
              <strong>{record.title}</strong>
              <small>{formatRelativeTime(record.createdAt)}</small>
            </div>
            <p>{record.content}</p>
            {record.attachments?.length ? (
              <div className="record-card__attachments">
                {record.attachments.map((attachment) => (
                  <a key={attachment.url} href={attachment.url} target="_blank" rel="noreferrer">
                    {attachment.name}
                  </a>
                ))}
              </div>
            ) : null}
          </article>
        ))
      )}
    </div>
  );
}
