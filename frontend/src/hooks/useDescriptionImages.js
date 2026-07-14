import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useUploadTicketDescriptionImages } from '@/queries/tickets';

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

const validateClientFiles = (files) => {
  for (const f of files) {
    if (!ALLOWED_IMAGE_TYPES.has(f.type)) {
      toast.error('Only JPG, PNG, and WEBP are allowed.');
      return false;
    }
    if (f.size > MAX_IMAGE_SIZE_BYTES) {
      toast.error('Each image must be 5MB or smaller.');
      return false;
    }
  }
  return true;
};

export const useDescriptionImages = (ticketId, setDescription) => {
  const [previewImageUrl, setPreviewImageUrl] = useState(null);
  const [descriptionHoverZoom, setDescriptionHoverZoom] = useState(null);

  const descriptionInputRef = useRef(null);
  const descriptionSectionRef = useRef(null);
  const uploadDescriptionImagesMutation = useUploadTicketDescriptionImages(ticketId);

  const handleDescriptionImagePick = (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    if (!validateClientFiles(files)) return;

    uploadDescriptionImagesMutation.mutate(files, {
      onSuccess: (response) => {
        const uploaded = response?.data || [];
        const imageUrls = uploaded.map((img) => img?.image_url).filter(Boolean);

        if (imageUrls.length > 0) {
          const imagesHtml = imageUrls
            .map((url) => `<p><img src="${url}" alt="Description image" /></p>`)
            .join('');
          setDescription((prev) => `${prev || ''}${imagesHtml}`);
        }

        toast.success('Description image(s) uploaded.');
      },
      onError: (err) =>
        toast.error(err?.response?.data?.message || 'Failed to upload description image(s).'),
    });
  };

  const handleDescriptionImagePaste = async (file) => {
    if (!file) return null;

    if (!validateClientFiles([file])) {
      throw new Error('Invalid pasted image.');
    }

    const response = await uploadDescriptionImagesMutation.mutateAsync([file]);
    const imageUrl = response?.data?.[0]?.image_url || null;

    if (!imageUrl) {
      throw new Error('Pasted image uploaded but URL is missing.');
    }

    return imageUrl;
  };

  const handleDescriptionImageHover = (e) => {
    if (previewImageUrl) return;

    const sectionEl = descriptionSectionRef.current;
    if (!sectionEl) return;

    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.closest('[data-description-image-zoom]')) return;

    const imageEl = target.closest('img');
    if (!imageEl || !sectionEl.contains(imageEl)) {
      setDescriptionHoverZoom(null);
      return;
    }

    const src = imageEl.getAttribute('src');
    if (!src) {
      setDescriptionHoverZoom(null);
      return;
    }

    const imageRect = imageEl.getBoundingClientRect();
    const top = Math.max(8, imageRect.top + 8);
    const left = Math.max(8, imageRect.right - 40);

    setDescriptionHoverZoom({ src, top, left });
  };

  const clearDescriptionImageHover = () => {
    setDescriptionHoverZoom(null);
  };

  useEffect(() => {
    const handleAnyScroll = () => setDescriptionHoverZoom(null);

    window.addEventListener('scroll', handleAnyScroll, true);
    return () => window.removeEventListener('scroll', handleAnyScroll, true);
  }, []);

  return {
    descriptionInputRef,
    descriptionSectionRef,
    uploadDescriptionImagesMutation,
    previewImageUrl,
    setPreviewImageUrl,
    descriptionHoverZoom,
    handleDescriptionImagePick,
    handleDescriptionImagePaste,
    handleDescriptionImageHover,
    clearDescriptionImageHover,
  };
};
