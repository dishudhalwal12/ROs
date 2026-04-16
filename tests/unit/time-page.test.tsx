import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TimePage } from '@/features/time/TimePage';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('recharts', () => {
  const passthrough = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return {
    ResponsiveContainer: passthrough,
    BarChart: passthrough,
    Bar: passthrough,
    CartesianGrid: passthrough,
    Cell: passthrough,
    Legend: passthrough,
    Pie: passthrough,
    PieChart: passthrough,
    Tooltip: passthrough,
    XAxis: passthrough,
    YAxis: passthrough,
  };
});

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    member: {
      uid: 'member-1',
    },
  }),
}));

vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: () => ({
    tasks: [],
    projects: [],
    clients: [],
    timeEntries: [],
    members: [],
    presence: {},
    liveStatuses: {},
    createTimeEntry: vi.fn(),
  }),
}));

describe('TimePage', () => {
  beforeEach(() => {
    navigateMock.mockReset();
  });

  it('launches the immersive Timepass route from the hero card', () => {
    render(<TimePage />);

    fireEvent.click(screen.getByRole('button', { name: /enter timepass/i }));

    expect(navigateMock).toHaveBeenCalledWith('/time/timepass');
  });
});
