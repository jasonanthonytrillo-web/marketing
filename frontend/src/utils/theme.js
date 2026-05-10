import { hexToRgb } from './helpers';

/**
 * Applies the tenant's primary color to the entire application by overriding CSS variables.
 * @param {string} primaryColor - Hex color code (e.g., #f97316)
 */
export function applyTheme(primaryColor) {
  if (!primaryColor) return;
  
  const rgb = hexToRgb(primaryColor);
  if (!rgb) return;

  // 1. Create or update a style tag for absolute priority override
  let styleTag = document.getElementById('dynamic-branding-style');
  if (!styleTag) {
    styleTag = document.createElement('style');
    styleTag.id = 'dynamic-branding-style';
    document.head.appendChild(styleTag);
  }

  // Inject CSS variables into :root with !important to prevent any "glimpses" of defaults
  styleTag.innerHTML = `
    :root {
      --primary-50: ${rgb} !important;
      --primary-100: ${rgb} !important;
      --primary-200: ${rgb} !important;
      --primary-300: ${rgb} !important;
      --primary-400: ${rgb} !important;
      --primary-500: ${rgb} !important;
      --primary-600: ${rgb} !important;
      --primary-700: ${rgb} !important;
      --primary-800: ${rgb} !important;
      --primary-900: ${rgb} !important;
    }
  `;
  
  // 2. Also set properties directly on the document element for React components using inline styles
  const shades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];
  shades.forEach(shade => {
    document.documentElement.style.setProperty(`--primary-${shade}`, rgb);
  });
}

/**
 * Removes all dynamic branding styles and returns the application to default colors.
 */
export function clearTheme() {
  // Remove the high-priority style tag
  const styleTag = document.getElementById('dynamic-branding-style');
  if (styleTag) {
    styleTag.remove();
  }
  
  // Clear the inline properties from document element
  const shades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];
  shades.forEach(shade => {
    document.documentElement.style.removeProperty(`--primary-${shade}`);
  });
}
