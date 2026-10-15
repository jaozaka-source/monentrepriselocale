import { useCallback, useRef, useState } from 'react';

/**
 * Manages per-field validation errors for a client-space form.
 *
 * Usage:
 *   const { errors, clearError, showErrors, setErrorRef, hasErrors } = useFormErrors<'email' | 'name'>();
 *   <input ref={setErrorRef('email')} aria-invalid={!!errors.email} ... onChange={() => clearError('email')} />
 *   showErrors({ email: 'Ce champ est obligatoire' });
 */
export function useFormErrors<Field extends string>() {
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const refs = useRef<Partial<Record<Field, HTMLElement | null>>>({});

  /** Returns a ref callback that registers the field's DOM element for scroll targeting. */
  const setErrorRef = useCallback(
    (field: Field) => (el: HTMLElement | null) => {
      refs.current[field] = el;
    },
    [],
  );

  /** Removes the error for a single field — call on every field change. */
  const clearError = useCallback((field: Field) => {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  /** Sets the error map and scrolls to the first field in error. */
  const showErrors = useCallback((errs: Partial<Record<Field, string>>) => {
    setErrors(errs);
    const fields = Object.keys(errs) as Field[];
    if (fields.length === 0) return;
    // Defer so the DOM has the error borders painted before scrolling.
    requestAnimationFrame(() => {
      for (const field of fields) {
        if (errs[field]) {
          const el = refs.current[field];
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            (el as HTMLElement).focus?.();
            break;
          }
        }
      }
    });
  }, []);

  const clearAll = useCallback(() => setErrors({}), []);

  return {
    errors,
    clearError,
    showErrors,
    clearAll,
    setErrorRef,
    hasErrors: Object.keys(errors).length > 0,
  };
}
