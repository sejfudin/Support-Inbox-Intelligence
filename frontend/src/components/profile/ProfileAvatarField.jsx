import { Camera, Loader2 } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/ui/user-avatar';
import { AVATAR_BADGE_CLASS } from '@/components/profile/avatarBadge';
import { ProfileAvatarMenu } from '@/components/profile/ProfileAvatarMenu';

/**
 * Your picture on the profile page, and everything you can do to it.
 *
 * Every control lives on the circle itself, as one badge pinned to its corner that
 * changes with what is there:
 *
 * - **Not editing** — no badge at all, just the picture. The card is information you
 *   read, and a control that does nothing until you opt into editing is worse than
 *   none, because it still invites the click.
 * - **Editing, no picture yet** — a camera. The whole circle is the hit target and
 *   the badge labels it, which is why the badge is `aria-hidden` here and not a
 *   button of its own: one action, so it does not need a menu, and nesting a button
 *   inside a button would be invalid anyway.
 * - **Editing, picture already set** — the badge becomes the overflow menu
 *   (`ProfileAvatarMenu`) and the circle stops being clickable. The camera meant
 *   "nothing here yet"; once there is a face it only obscures the thing it was
 *   inviting you to add. Same circle, same corner, same size, so nothing jumps when
 *   the first upload lands.
 *
 * The hidden file input is rendered for the whole of edit mode, not just alongside
 * the camera — the menu's *Change photo* opens the same picker, so tying the input's
 * lifetime to the camera would leave that item silently doing nothing.
 *
 * A picture always renders as a circle, centre-cropped by `UserAvatar`'s
 * `object-cover` — a portrait or landscape photo is cropped to the round frame
 * rather than squashed into it. The circle is the same size either way: the photo and
 * the initials are the same `UserAvatar` span, and only the background and the child
 * differ.
 *
 * Both wrappers are `relative inline-flex`, and that is load-bearing rather than
 * stylistic. The badge is positioned against the wrapper, so the wrapper has to be
 * exactly the circle: a `block` or `inline-block` box around an inline-level avatar
 * establishes a line box that reserves descender space *under* the 52px, and the badge
 * would sink into it by a few pixels — differently for the two display modes, so the
 * camera and the pencil would not land in the same place. A flex container has no line
 * box and shrink-wraps the avatar exactly.
 */
export function ProfileAvatarField({ avatar, isEditing = false }) {
  const { displayUser, hasPicture, isBusy, isUploading, openPicker } = avatar;

  const canAdd = isEditing && !hasPicture;

  return (
    // `data-tour` is on the wrapper rather than on either badge: the what's-new step
    // spotlights the picture, and the badges come and go with edit mode and with
    // whether there is a picture at all. A target that only exists in one of those
    // states would leave the step falling back to a centred card for everyone else.
    <div className="shrink-0" data-tour="profile-avatar">
      {canAdd ? (
        <button
          type="button"
          onClick={openPicker}
          disabled={isBusy}
          className="group relative inline-flex rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed"
          aria-label="Add a profile picture"
          data-test="profile-avatar-button"
        >
          <UserAvatar user={displayUser} size="lg" showTitle={false} />
          <span className={AVATAR_BADGE_CLASS} aria-hidden="true">
            {isUploading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Camera className="h-3 w-3" />
            )}
          </span>
        </button>
      ) : (
        <span className="group relative inline-flex">
          <UserAvatar user={displayUser} size="lg" showTitle={false} />
          {isEditing && hasPicture && <ProfileAvatarMenu avatar={avatar} />}
        </span>
      )}

      {isEditing && (
        <input
          ref={avatar.inputRef}
          type="file"
          accept={avatar.accept}
          onChange={avatar.onFileChange}
          className="hidden"
          data-test="profile-avatar-input"
        />
      )}

      <Dialog
        open={avatar.confirmingRemove}
        onOpenChange={(next) => !next && avatar.setConfirmingRemove(false)}
      >
        <DialogContent data-test="profile-avatar-remove-dialog">
          <DialogHeader>
            <DialogTitle>Remove your profile picture?</DialogTitle>
            <DialogDescription>
              You will show as initials again everywhere you appear. This cannot be undone — you
              would need to upload the picture again.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => avatar.setConfirmingRemove(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={avatar.removePicture}
              disabled={avatar.isRemoving}
              data-test="profile-avatar-remove-confirm-button"
            >
              {avatar.isRemoving ? 'Removing…' : 'Remove picture'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
