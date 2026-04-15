import { render, screen } from '@testing-library/react';

import { Avatar } from '@/components/ui/Avatar';

describe('Avatar', () => {
  it('renders the uploaded image when avatarUrl is present', () => {
    render(
      <Avatar
        member={{
          name: 'Dishu Founder',
          avatarColor: '#2f4bde',
          avatarUrl: 'https://example.com/dishu.png',
        }}
        shape="circle"
      />,
    );

    expect(screen.getByRole('img', { name: 'Dishu Founder' })).toHaveAttribute(
      'src',
      'https://example.com/dishu.png',
    );
  });

  it('falls back to initials when no avatarUrl is present', () => {
    render(<Avatar member={{ name: 'Dishu Founder', avatarColor: '#2f4bde' }} />);

    expect(screen.getByText('DF')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
