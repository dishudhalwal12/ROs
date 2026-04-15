import {
  clientSchema,
  invoiceSchema,
  taskSchema,
  workspaceSchema,
} from '@/lib/validation';

describe('validation schemas', () => {
  it('parses task input with coerced numbers', () => {
    const result = taskSchema.parse({
      title: 'Ship task board',
      description: 'Implement kanban movement',
      status: 'todo',
      priority: 'high',
      assigneeIds: ['u1'],
      vertical: 'Automation Ops',
      estimateHours: '3',
    });

    expect(result.estimateHours).toBe(3);
  });

  it('rejects invalid client email', () => {
    expect(() =>
      clientSchema.parse({
        name: 'Acme lead',
        company: 'Acme',
        contactName: 'Ria',
        email: 'not-an-email',
        phone: '9999999999',
        stage: 'lead',
        value: 50000,
        tags: 'Website',
        summary: 'Inbound lead',
      }),
    ).toThrow();
  });

  it('accepts invoice status and workspace theme', () => {
    const invoice = invoiceSchema.parse({
      clientId: 'c1',
      title: 'Retainer',
      amount: '90000',
      issuedDate: '2026-04-01',
      dueDate: '2026-04-10',
      status: 'pending',
    });
    const workspace = workspaceSchema.parse({
      name: 'Rovexa HQ',
      verticals: 'Automation Ops, Content Studio',
    });

    expect(invoice.amount).toBe(90000);
    expect(workspace.verticals).toContain('Automation Ops');
  });
});
