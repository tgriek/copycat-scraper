export interface HeadingNode {
  level: number;
  text: string;
  id?: string;
  children: HeadingNode[];
}

export interface PageLink {
  url: string;
  text: string;
  context: string;
}

export interface PageImage {
  src: string;
  alt?: string;
  width?: number;
  height?: number;
  srcset?: string;
  localPath: string;
  contentBlock?: number;
}

export interface PageVideo {
  src: string;
  type?: string;
  localPath: string;
  autoplay?: boolean;
  loop?: boolean;
  muted?: boolean;
}

export interface PageFavicon {
  href: string;
  rel: string;
  type?: string;
  sizes?: string;
  localPath: string;
}

export interface AnimationInfo {
  selector: string;
  tag: string;
  classes: string;
  sectionType: string;
  animationType: 'css-animation' | 'css-transition' | 'slideshow' | 'autoplay-video' | 'scroll-triggered';
  details: Record<string, string | string[] | number | boolean>;
}

export interface TwitterCard {
  card?: string;
  site?: string;
  creator?: string;
  title?: string;
  description?: string;
  image?: string;
}

export interface PageDocument {
  src: string;
  type: string;
  linkText: string;
  localPath: string;
}

export interface PageSection {
  tag: string;
  id: string;
  classes: string;
  role: string;
  sectionType: string;
  html: string;
  textPreview: string;
  order: number;
  rect?: { x: number; y: number; width: number; height: number };
}

export interface PageData {
  url: string;
  path: string;
  slug: string;
  crawledAt: string;

  metadata: {
    title: string;
    description: string;
    ogTitle?: string;
    ogDescription?: string;
    ogImage?: string;
    ogType?: string;
    ogSiteName?: string;
    canonical?: string;
    language?: string;
    author?: string;
    publishDate?: string;
    modifiedDate?: string;
    keywords?: string[];
    robots?: string;
    viewport?: string;
    themeColor?: string;
    twitter?: TwitterCard;
    structuredData?: Record<string, unknown>[];
    favicons?: PageFavicon[];
  };

  content: {
    rawHtml: string;
    fullPageHtml: string;
    markdown: string;
    wordCount: number;
  };

  headings: HeadingNode[];

  sections?: PageSection[];

  classification: {
    templatePattern: string;
    urlDepth: number;
    pathSegments: string[];
    estimatedType: string;
  };

  links: {
    internal: PageLink[];
    external: PageLink[];
    anchors: { id: string; text: string }[];
  };

  media: {
    images: PageImage[];
    videos: PageVideo[];
    documents: PageDocument[];
  };

  screenshots: {
    desktop: string;
    tablet?: string;
    mobile?: string;
  };

  animations?: AnimationInfo[];

  elementStyles?: Array<{
    tag: string;
    classes: string;
    id: string;
    selector: string;
    textPreview: string;
    childCount: number;
    rect: { x: number; y: number; width: number; height: number };
    styles: Record<string, string>;
    parentLayout?: {
      display: string;
      flexDirection: string;
      gridTemplateColumns: string;
      justifyContent: string;
      alignItems: string;
      gap: string;
    };
  }>;
}
