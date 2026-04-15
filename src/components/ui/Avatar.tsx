import type { Member } from '@/types/models';
import { initials } from '@/lib/utils';

interface AvatarProps {
  member?: Pick<Member, 'name' | 'avatarColor'> | null;
  label?: string;
  color?: string;
  size?: 'sm' | 'md';
}

export function Avatar({ member, label, color, size = 'md' }: AvatarProps) {
  const name = member?.name ?? label ?? 'Rovexa';
  const background = member?.avatarColor ?? color ?? '#2f4bde';
  return (
    <span className={`avatar avatar--${size}`} style={{ background }}>
      {initials(name)}
    </span>
  );
}
