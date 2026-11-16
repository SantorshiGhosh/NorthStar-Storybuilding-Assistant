import { useEffect } from 'react';

/**
 * Custom hook to dynamically set document page titles.
 * @param {string} title - The title of the current page.
 */
export default function useDocumentTitle(title) {
  useEffect(() => {
    if (title) {
      document.title = `${title} | NorthStar`;
    } else {
      document.title = 'NorthStar — AI Continuity Guardian';
    }
  }, [title]);
}
