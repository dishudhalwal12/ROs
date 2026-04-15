import type { Member } from '@/types/models';
import { initials } from '@/lib/utils';

interface AvatarProps {
  member?: Pick<Member, 'name' | 'avatarColor' | 'avatarUrl'> | null;
  label?: string;
  color?: string;
  size?: 'sm' | 'md';
  shape?: 'squircle' | 'circle';
}

export function Avatar({
  member,
  label,
  color,
  size = 'md',
  shape = 'squircle',
}: AvatarProps) {
  const name = member?.name ?? label ?? 'Rovexa';
  const background = member?.avatarColor ?? color ?? '#2f4bde';
  return (
    <span className={`avatar avatar--${size} avatar--${shape}`} style={{ background }}>
      {member?.avatarUrl ? (
        <img src={member.avatarUrl} alt={name} className="avatar__image" />
      ) : (
        initials(name)
      )}
    </span>
  );
}
