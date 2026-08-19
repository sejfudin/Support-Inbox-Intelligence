import { Loader2, Pencil, Trash2, Upload } from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AVATAR_BADGE_CLASS } from '@/components/profile/avatarBadge';
import { cn } from '@/lib/utils';

/**
 * What to do with a picture you already have: change it, or take it down.
 *
 * It is the corner badge on the avatar — the same circle, in the same place, that
 * holds the camera before there is a picture. Keeping it there is the point: every
 * action on the picture is *on* the picture, so there is nothing to hunt for
 * elsewhere on the card, and the control neither moves nor resizes when the first
 * upload lands.
 *
 * A pencil rather than three dots, despite this being a menu. At 22px on a saturated
 * fill, three 2px marks read as texture rather than as a control, and an overflow
 * menu is a card convention — top-right, unfilled, 16px and up. An avatar's corner is
 * scanned for the glyph every other product puts there, which is a camera or a
 * pencil; the pencil is honest enough, since both items behind it modify the picture.
 *
 * Only rendered once there *is* a picture, and then it is the **only** way to act on
 * one: the camera is dropped at that point, so the two never say the same thing
 * twice and nothing covers the face. Before the first upload it is the other way
 * round — no menu, just the camera. An overflow menu whose every item is about a
 * photo that does not exist is a menu you open to find nothing you can do.
 *
 * "Change photo" rather than "Upload another": *another* suggests adding a second one
 * to a collection, and there is exactly one picture per account — picking a file
 * replaces what is there.
 */
export function ProfileAvatarMenu({ avatar }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={avatar.isBusy}
          className={cn(AVATAR_BADGE_CLASS)}
          aria-label="Change or remove your profile picture"
          data-test="profile-avatar-menu-button"
        >
          {avatar.isBusy ? (
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          ) : (
            <Pencil className="h-3 w-3" aria-hidden="true" />
          )}
        </button>
      </DropdownMenuTrigger>

      {/* Anchored to the badge, which sits at the avatar's bottom-right, so the menu
          opens down and to the right of it rather than over the name beside it. */}
      <DropdownMenuContent align="start" side="bottom" className="w-48">
        <DropdownMenuItem onSelect={avatar.openPicker} data-test="profile-avatar-replace-item">
          <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
          Change photo
        </DropdownMenuItem>

        <DropdownMenuItem
          onSelect={() => avatar.setConfirmingRemove(true)}
          className="text-[hsl(var(--tone-danger-fg))] focus:text-[hsl(var(--tone-danger-fg))]"
          data-test="profile-avatar-remove-item"
        >
          <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
          Remove photo
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
