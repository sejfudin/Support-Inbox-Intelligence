import { useMemo, useState } from 'react';
import {
  buildMentionCandidates,
  getMentionContext,
  replaceMentionToken,
} from '@/helpers/commentMentions';

export const useCommentMentions = ({ users = [], value, setValue, textareaRef }) => {
  const mentionCandidates = useMemo(() => buildMentionCandidates(users), [users]);

  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionContext, setMentionContext] = useState(null);
  const [mentionActiveIndex, setMentionActiveIndex] = useState(0);

  const mentionItems = useMemo(() => {
    if (!mentionContext) return [];
    const q = mentionContext.query?.trim().toLowerCase() || '';

    if (!q) return mentionCandidates.slice(0, 8);

    return mentionCandidates
      .filter((item) => {
        const handle = item.handle.toLowerCase();
        const fullname = (item.fullname || '').toLowerCase();
        const email = (item.email || '').toLowerCase();
        return handle.includes(q) || fullname.includes(q) || email.includes(q);
      })
      .slice(0, 8);
  }, [mentionCandidates, mentionContext]);

  const closeMention = () => {
    setMentionOpen(false);
    setMentionContext(null);
    setMentionActiveIndex(0);
  };

  const applyMention = (item) => {
    if (!item || !mentionContext) return;

    const nextValue = replaceMentionToken(
      value,
      mentionContext.start,
      mentionContext.end,
      item.handle
    );

    setValue(nextValue);
    closeMention();

    requestAnimationFrame(() => {
      if (!textareaRef.current) return;
      const nextCaret = mentionContext.start + item.handle.length + 2;
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(nextCaret, nextCaret);
    });
  };

  const handleMentionChange = (e) => {
    const next = e.target.value;
    setValue(next);

    const ctx = getMentionContext(next, e.target.selectionStart);
    if (!ctx) {
      closeMention();
      return;
    }

    setMentionContext(ctx);
    setMentionOpen(true);
    setMentionActiveIndex(0);
  };

  const handleMentionKeyDown = (e) => {
    if (!mentionOpen) return false;

    if (e.key === 'Escape') {
      e.preventDefault();
      closeMention();
      return true;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (mentionItems.length > 0) {
        setMentionActiveIndex((prev) => (prev + 1) % mentionItems.length);
      }
      return true;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (mentionItems.length > 0) {
        setMentionActiveIndex((prev) => (prev - 1 + mentionItems.length) % mentionItems.length);
      }
      return true;
    }

    if ((e.key === 'Enter' || e.key === 'Tab') && mentionItems.length > 0) {
      e.preventDefault();
      applyMention(mentionItems[mentionActiveIndex] || mentionItems[0]);
      return true;
    }

    return false;
  };

  return {
    mentionOpen,
    mentionItems,
    mentionActiveIndex,
    applyMention,
    handleMentionChange,
    handleMentionKeyDown,
  };
};
