/**
 * PDF Processing Types
 */

export interface PageRange {
    start?: number;
    end?: number;
    pages?: number[];
}

/**
 * Split mode options
 */
export type SplitMode = 
    | 'all'           // Each page as separate PDF
    | 'ranges'        // Split by page ranges
    | 'chunks'        // Split into N-page chunks
    | 'extract';      // Extract specific pages into one PDF

/**
 * DTO for splitting a PDF
 */
export interface SplitPdfDTO {
    /** Split mode */
    mode: SplitMode;
    
    /** Page ranges (for 'ranges' mode) */
    ranges?: PageRange[];
    
    /** Pages per chunk (for 'chunks' mode) */
    chunkSize?: number;
    
    /** Specific pages to extract (for 'extract' mode) */
    pages?: number[];
    
    /** Optional folder to save split documents */
    folderId?: string | null;
    
    /** Prefix for output file names */
    namePrefix?: string;
    
    /** Optional tags for all output documents */
    tags?: string[];
}

/**
 * Result of a single split operation
 */
export interface SplitResultItem {
    documentId: string;
    name: string;
    pageCount: number;
    size: number;
    pages: number[];
}

/**
 * Response from PDF split operation
 */
export interface SplitPdfResponse {
    originalDocumentId: string;
    originalPageCount: number;
    outputDocuments: SplitResultItem[];
    totalOutputSize: number;
}

/**
 * PDF metadata/info
 */
export interface PdfInfo {
    pageCount: number;
    title?: string;
    author?: string;
    subject?: string;
    creator?: string;
    producer?: string;
    creationDate?: Date;
    modificationDate?: Date;
    isEncrypted: boolean;
}
