import { useEffect } from 'react';

/**
 * Hook to dynamically update the document title and favicon
 * @param {string} title 
 * @param {string} faviconUrl 
 */
export function useDynamicBranding(title, faviconUrl) {
  useEffect(() => {
    if (title) {
      document.title = title;
    }

    if (faviconUrl) {
      let link = document.querySelector("link[rel~='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.getElementsByTagName('head')[0].appendChild(link);
      }
      link.href = faviconUrl;
    }
  }, [title, faviconUrl]);
}
