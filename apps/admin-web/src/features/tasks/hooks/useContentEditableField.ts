import { useEffect, useRef } from 'react';
import { UseFormReturn, Path, PathValue } from 'react-hook-form';

/**
 * Converts HTML content from contentEditable to plain text with preserved line breaks
 * Uses innerText which automatically converts <br>, <div>, <p> etc. to \n characters
 */
function getTextWithLineBreaks(element: HTMLElement): string {
  // innerText preserves line breaks as \n characters
  // It handles <br>, <div>, <p>, and other block elements correctly
  return element.innerText || '';
}

/**
 * Converts plain text with \n to HTML that contentEditable can display
 * Escapes HTML and converts \n to <br> tags
 */
function setTextWithLineBreaks(element: HTMLElement, text: string): void {
  if (!text) {
    element.innerHTML = '';
    return;
  }

  // Escape HTML entities first, then convert \n to <br>
  // This ensures user input is safe and line breaks are preserved
  const html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
  
  element.innerHTML = html;
}

/**
 * Hook to synchronize contentEditable div with react-hook-form field
 * Preserves line breaks when saving and loading
 */
export function useContentEditableField<T extends Record<string, unknown>>(
  form: UseFormReturn<T>,
  fieldName: Path<T>,
  value?: string | null | undefined
) {
  const ref = useRef<HTMLDivElement>(null);
  const isUpdatingRef = useRef(false);

  // Sync contentEditable with form value (when loading from DB or form reset)
  useEffect(() => {
    if (ref.current && !isUpdatingRef.current) {
      const formValue = form.getValues(fieldName) as string | null | undefined;
      const currentText = getTextWithLineBreaks(ref.current);
      const formText = formValue || '';
      
      // Only update if different to avoid cursor jumping during user typing
      if (currentText !== formText) {
        isUpdatingRef.current = true;
        setTextWithLineBreaks(ref.current, formText);
        // Reset flag after DOM update
        setTimeout(() => {
          isUpdatingRef.current = false;
        }, 0);
      }
    }
  }, [form, fieldName, value]);

  const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    const text = getTextWithLineBreaks(e.currentTarget);
    form.setValue(fieldName, text as PathValue<T, Path<T>>);
  };

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    // Don't update form during our own updates to avoid loops
    if (isUpdatingRef.current) return;
    
    const text = getTextWithLineBreaks(e.currentTarget);
    form.setValue(fieldName, text as PathValue<T, Path<T>>, { shouldValidate: true });
  };

  return {
    ref,
    handleBlur,
    handleInput,
  };
}
