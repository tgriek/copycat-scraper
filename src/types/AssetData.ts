export interface AssetRecord {
  originalUrl: string;
  localPath: string;
  mimeType: string;
  fileSize: number;
  hash: string;
  referencedBy: string[];
}

export interface InterceptedAsset {
  url: string;
  resourceType: string;
  pageUrl: string;
  mimeType?: string;
}

export type AssetCategory =
  | 'images'
  | 'fonts'
  | 'stylesheets'
  | 'scripts'
  | 'documents'
  | 'videos'
  | 'other';

export interface FontInfo {
  family: string;
  weight?: string;
  style?: string;
  src: string;
  format?: string;
  source: 'font-face' | 'google-fonts' | 'cdn' | 'network';
}
