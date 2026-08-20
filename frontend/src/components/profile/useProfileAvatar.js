import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { useDeleteMyAvatar, useUploadMyAvatar } from '@/queries/auth';

/**
 * The behaviour behind your own profile picture, in one place.
 *
 * It is a hook rather than a component because the control is in two pieces that
 * sit in different corners of the identity card — the camera badge on the avatar
 * and the overflow menu out by the badges — and they have to share one file input,
 * one in-flight state and one preview. Two components each owning half of that
 * would let them disagree about whether an upload is running.
 *
 * These limits are a courtesy, not the rule: `middleware/upload.js` and
 * `services/userAvatarService.js` are authoritative. Checking here only saves the
 * user from posting 8MB to be told no.
 */
const MAX_BYTES = 2 * 1024 * 1024;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];

export function useProfileAvatar(user) {
  const inputRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  const uploadMutation = useUploadMyAvatar();
  const deleteMutation = useDeleteMyAvatar();

  const isUploading = uploadMutation.isPending;
  const isBusy = isUploading || deleteMutation.isPending;
  const hasPicture = Boolean(user?.avatarUrl);

  // Object URLs are not garbage collected on their own, and this outlives several
  // of them across a change-your-mind sequence.
  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  const openPicker = () => inputRef.current?.click();

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    // Reset immediately, so picking the same file twice in a row still fires a
    // change event the second time.
    event.target.value = '';
    if (!file) return;

    if (!ACCEPTED.includes(file.type)) {
      toast.error('Profile picture must be a JPG, PNG, or WEBP image.');
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error('Profile picture must be 2MB or smaller.');
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);

    try {
      await uploadMutation.mutateAsync(file);
      toast.success('Profile picture updated.');
    } catch (error) {
      // The optimistic preview must not survive a failure, or the user believes
      // they have a picture that does not exist until the next reload.
      toast.error(
        error?.response?.data?.message || 'Could not update your profile picture. Please try again.'
      );
    } finally {
      setPreview(null);
      URL.revokeObjectURL(objectUrl);
    }
  };

  const removePicture = async () => {
    try {
      await deleteMutation.mutateAsync();
      toast.success('Profile picture removed.');
      setConfirmingRemove(false);
    } catch (error) {
      toast.error(
        error?.response?.data?.message || 'Could not remove your profile picture. Please try again.'
      );
    }
  };

  return {
    // The preview stands in for the stored URL while the request is in flight, so
    // the circle shows the new picture from the click rather than from the
    // round trip, and never blinks back to initials in between.
    displayUser: preview ? { ...user, avatarUrl: preview } : user,
    hasPicture,
    isBusy,
    isUploading,
    isRemoving: deleteMutation.isPending,
    openPicker,
    removePicture,
    confirmingRemove,
    setConfirmingRemove,
    inputRef,
    onFileChange: handleFile,
    accept: ACCEPTED.join(','),
  };
}
