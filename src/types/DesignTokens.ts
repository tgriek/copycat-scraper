export interface DesignTokens {
  colors: {
    primary: string[];
    secondary: string[];
    text: { color: string; usage: string }[];
    background: { color: string; usage: string }[];
    border: { color: string; usage: string }[];
    accent: string[];
    all: { color: string; frequency: number; contexts: string[] }[];
  };

  typography: {
    fontFamilies: {
      family: string;
      weights: number[];
      source: string; // "google-fonts" | "local" | "cdn"
      localFiles: string[];
    }[];
    typeScale: {
      element: string;
      fontSize: string;
      fontWeight: string;
      lineHeight: string;
      fontFamily: string;
      letterSpacing?: string;
    }[];
  };

  spacing: {
    values: string[];
    containerMaxWidth?: string;
    contentMaxWidth?: string;
  };

  borders: {
    radii: string[];
    widths: string[];
    styles: string[];
  };

  shadows: {
    values: string[];
  };

  breakpoints: {
    values: { name: string; value: string }[];
  };

  transitions: {
    durations: string[];
    easings: string[];
  };
}
