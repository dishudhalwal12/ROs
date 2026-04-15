import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Trash2, Upload } from 'lucide-react';

import { Avatar } from '@/components/ui/Avatar';
import { Modal } from '@/components/ui/Modal';
import { useAuth } from '@/hooks/use-auth';
import { useWorkspace } from '@/hooks/use-workspace';

interface ProfileEditorModalProps {
  open: boolean;
  onClose: () => void;
}

export function ProfileEditorModal({ open, onClose }: ProfileEditorModalProps) {
  const { member } = useAuth();
  const { updateMyProfile, uploadProfileAvatar } = useWorkspace();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [name, setName] = useState(member?.name ?? '');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(member?.name ?? '');
    setSelectedFile(null);
    setRemoveAvatar(false);
    setError(null);
  }, [member?.avatarUrl, member?.name, open]);

  const previewUrl = useMemo(() => {
    if (!selectedFile) return null;
    return URL.createObjectURL(selectedFile);
  }, [selectedFile]);

  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const previewMember = {
    name: name.trim() || member?.name || 'Rovexa',
    avatarColor: member?.avatarColor ?? '#2f4bde',
    avatarUrl: removeAvatar ? undefined : previewUrl ?? member?.avatarUrl,
  };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      let avatarUrl: string | null | undefined;

      if (selectedFile) {
        avatarUrl = await uploadProfileAvatar(selectedFile);
      } else if (removeAvatar) {
        avatarUrl = null;
      }

      await updateMyProfile({
        name,
        ...(avatarUrl !== undefined ? { avatarUrl } : {}),
      });
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to save profile.');
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal title="Edit your profile" open={open} onClose={onClose} width="sm">
      <form className="profile-editor" onSubmit={handleSubmit}>
        <div className="profile-editor__hero">
          <div className="profile-editor__preview">
            <Avatar member={previewMember} size="md" shape="circle" />
          </div>
          <div className="profile-editor__actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={16} />
              {member?.avatarUrl || selectedFile ? 'Change DP' : 'Upload DP'}
            </button>
            <button
              type="button"
              className="text-button"
              disabled={!member?.avatarUrl && !selectedFile}
              onClick={() => {
                setSelectedFile(null);
                setRemoveAvatar(true);
              }}
            >
              <Trash2 size={16} />
              Remove photo
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(event) => {
                const nextFile = event.target.files?.[0] ?? null;
                setSelectedFile(nextFile);
                setRemoveAvatar(false);
              }}
            />
          </div>
        </div>

        <label className="form-grid__wide">
          <span>Display name</span>
          <input
            type="text"
            value={name}
            maxLength={48}
            onChange={(event) => setName(event.target.value)}
            placeholder="How your teammates see you"
          />
        </label>

        <div className="profile-editor__hint">
          <Camera size={16} />
          <span>Square images work best. We’ll crop them into a circle automatically.</span>
        </div>

        {error ? <div className="form-error">{error}</div> : null}

        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose} disabled={pending}>
            Cancel
          </button>
          <button type="submit" className="primary-button" disabled={pending}>
            {pending ? 'Saving...' : 'Save profile'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
