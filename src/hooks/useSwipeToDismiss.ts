"use client";

import { useRef, useCallback } from 'react';

export interface UseSwipeToDismissOptions {
  onClose: () => void;
  threshold?: number; // Minimum pixels to trigger close on release (default: 80)
  velocityThreshold?: number; // Minimum velocity px/ms to trigger close (default: 0.3)
  disabled?: boolean;
}

export function useSwipeToDismiss<T extends HTMLElement = HTMLElement>({
  onClose,
  threshold = 80,
  velocityThreshold = 0.3,
  disabled = false,
}: UseSwipeToDismissOptions) {
  const cleanupRef = useRef<(() => void) | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const callbackRef = useCallback(
    (el: T | null) => {
      // 1. Clean up any previous element listeners
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }

      if (!el || disabled) return;

      const parentEl = el.parentElement;

      let touchStartX = 0;
      let touchStartY = 0;
      let touchStartTime = 0;
      let isDetermined = false;
      let isSwiping = false;
      let isScrolling = false;
      let currentTranslateX = 0;
      let isDismissed = false;

      // Reset styles on attach
      el.style.transform = '';
      el.style.transition = '';
      el.style.opacity = '';
      if (parentEl) {
        parentEl.style.opacity = '';
        parentEl.style.transition = '';
      }

      // ── Touch Handlers ──────────────────────────────────────────────
      const handleTouchStart = (e: TouchEvent) => {
        if (isDismissed || e.touches.length !== 1) return;

        const target = e.target as HTMLElement | null;
        if (
          target &&
          target.closest('input, textarea, select, [contenteditable="true"], .no-swipe')
        ) {
          return;
        }

        const touch = e.touches[0];
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        touchStartTime = performance.now();
        isDetermined = false;
        isSwiping = false;
        isScrolling = false;
        currentTranslateX = 0;

        el.style.transition = 'none';
        if (parentEl) parentEl.style.transition = 'none';
      };

      const handleTouchMove = (e: TouchEvent) => {
        if (isDismissed || e.touches.length !== 1) return;

        const touch = e.touches[0];
        const diffX = touch.clientX - touchStartX;
        const diffY = touch.clientY - touchStartY;

        if (!isDetermined) {
          const totalDistance = Math.hypot(diffX, diffY);
          if (totalDistance >= 8) {
            isDetermined = true;
            // Only engage horizontal swipe if moving to the right and horizontally dominant
            if (diffX > 0 && diffX > Math.abs(diffY) * 1.15) {
              isSwiping = true;
              isScrolling = false;
              el.style.animation = 'none';
            } else {
              isSwiping = false;
              isScrolling = true;
            }
          }
        }

        if (isSwiping) {
          if (e.cancelable) {
            e.preventDefault();
          }

          currentTranslateX = Math.max(0, diffX);
          const width = el.offsetWidth || 380;
          const progress = Math.min(1, currentTranslateX / width);
          const opacity = Math.max(0.3, 1 - progress * 0.5);

          el.style.transform = `translateX(${currentTranslateX}px)`;
          el.style.opacity = `${opacity}`;
          if (parentEl) {
            parentEl.style.opacity = `${Math.max(0.2, 1 - progress * 0.7)}`;
          }
        }
      };

      const handleTouchEnd = (e: TouchEvent) => {
        if (isDismissed) return;

        if (!isSwiping) {
          isDetermined = false;
          return;
        }

        const touchEndTime = performance.now();
        const elapsed = Math.max(1, touchEndTime - touchStartTime);
        const velocity = currentTranslateX / elapsed;
        const width = el.offsetWidth || 380;

        const shouldClose =
          currentTranslateX > Math.min(threshold, width * 0.28) ||
          (currentTranslateX > 30 && velocity > velocityThreshold);

        if (shouldClose) {
          isDismissed = true;
          el.style.transition = 'transform 0.22s cubic-bezier(0.2, 0.9, 0.3, 1), opacity 0.2s ease-out';
          el.style.transform = 'translateX(100vw)';
          el.style.opacity = '0';

          if (parentEl) {
            parentEl.style.transition = 'opacity 0.22s ease-out';
            parentEl.style.opacity = '0';
          }

          setTimeout(() => {
            onCloseRef.current();
          }, 210);
        } else {
          // Spring back smoothly
          el.style.transition = 'transform 0.24s cubic-bezier(0.2, 0.9, 0.3, 1), opacity 0.24s ease-out';
          el.style.transform = 'translateX(0px)';
          el.style.opacity = '1';

          if (parentEl) {
            parentEl.style.transition = 'opacity 0.24s ease-out';
            parentEl.style.opacity = '1';
          }

          setTimeout(() => {
            if (el && !isDismissed) {
              el.style.transition = '';
              el.style.transform = '';
              el.style.opacity = '';
            }
            if (parentEl && !isDismissed) {
              parentEl.style.transition = '';
              parentEl.style.opacity = '';
            }
          }, 250);
        }

        isSwiping = false;
        isDetermined = false;
      };

      // ── Mouse Drag Support ──────────────────────────────────────────
      let mouseStartX = 0;
      let isMouseDown = false;
      let isMouseDragging = false;
      let mouseStartTime = 0;
      let mouseTranslateX = 0;

      const handleMouseDown = (e: MouseEvent) => {
        if (isDismissed || e.button !== 0) return;

        const target = e.target as HTMLElement | null;
        if (
          target &&
          target.closest('button, input, textarea, select, a, [role="button"], [contenteditable="true"], .no-swipe')
        ) {
          return;
        }

        mouseStartX = e.clientX;
        mouseStartTime = performance.now();
        isMouseDown = true;
        isMouseDragging = false;
        mouseTranslateX = 0;
      };

      const handleMouseMove = (e: MouseEvent) => {
        if (!isMouseDown || isDismissed) return;

        const diffX = e.clientX - mouseStartX;
        if (!isMouseDragging && diffX > 8) {
          isMouseDragging = true;
          el.style.animation = 'none';
          el.style.transition = 'none';
          el.style.cursor = 'grabbing';
          if (parentEl) parentEl.style.transition = 'none';
        }

        if (isMouseDragging) {
          mouseTranslateX = Math.max(0, diffX);
          const width = el.offsetWidth || 380;
          const progress = Math.min(1, mouseTranslateX / width);
          const opacity = Math.max(0.3, 1 - progress * 0.5);

          el.style.transform = `translateX(${mouseTranslateX}px)`;
          el.style.opacity = `${opacity}`;
          if (parentEl) {
            parentEl.style.opacity = `${Math.max(0.2, 1 - progress * 0.7)}`;
          }
        }
      };

      const handleMouseUp = (e: MouseEvent) => {
        if (!isMouseDown || isDismissed) return;
        isMouseDown = false;

        if (!isMouseDragging) return;
        isMouseDragging = false;
        el.style.cursor = '';

        const mouseEndTime = performance.now();
        const elapsed = Math.max(1, mouseEndTime - mouseStartTime);
        const velocity = mouseTranslateX / elapsed;
        const width = el.offsetWidth || 380;

        const shouldClose =
          mouseTranslateX > Math.min(threshold, width * 0.28) ||
          (mouseTranslateX > 30 && velocity > velocityThreshold);

        if (shouldClose) {
          isDismissed = true;
          el.style.transition = 'transform 0.22s cubic-bezier(0.2, 0.9, 0.3, 1), opacity 0.2s ease-out';
          el.style.transform = 'translateX(100vw)';
          el.style.opacity = '0';

          if (parentEl) {
            parentEl.style.transition = 'opacity 0.22s ease-out';
            parentEl.style.opacity = '0';
          }

          setTimeout(() => {
            onCloseRef.current();
          }, 210);
        } else {
          el.style.transition = 'transform 0.24s cubic-bezier(0.2, 0.9, 0.3, 1), opacity 0.24s ease-out';
          el.style.transform = 'translateX(0px)';
          el.style.opacity = '1';

          if (parentEl) {
            parentEl.style.transition = 'opacity 0.24s ease-out';
            parentEl.style.opacity = '1';
          }

          setTimeout(() => {
            if (el && !isDismissed) {
              el.style.transition = '';
              el.style.transform = '';
              el.style.opacity = '';
            }
            if (parentEl && !isDismissed) {
              parentEl.style.transition = '';
              parentEl.style.opacity = '';
            }
          }, 250);
        }
      };

      // Add event listeners
      el.addEventListener('touchstart', handleTouchStart, { passive: true });
      el.addEventListener('touchmove', handleTouchMove, { passive: false });
      el.addEventListener('touchend', handleTouchEnd, { passive: true });
      el.addEventListener('touchcancel', handleTouchEnd, { passive: true });

      el.addEventListener('mousedown', handleMouseDown);
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);

      cleanupRef.current = () => {
        el.removeEventListener('touchstart', handleTouchStart);
        el.removeEventListener('touchmove', handleTouchMove);
        el.removeEventListener('touchend', handleTouchEnd);
        el.removeEventListener('touchcancel', handleTouchEnd);

        el.removeEventListener('mousedown', handleMouseDown);
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    },
    [disabled, threshold, velocityThreshold]
  );

  return callbackRef;
}
