import { parentPort } from 'worker_threads';
import { PDFDocument } from 'pdf-lib';
import type {
    PdfWorkerMessage,
    PdfWorkerResponse,
    PdfSplitWorkerResult,
    PdfSplitWorkerOptions,
} from '../types/pdfWorker';
import type { PageRange } from '../types/pdf';

if (!parentPort) {
    throw new Error('This module must be run as a worker thread');
}

/**
 * Calculate page groups based on split mode
 */
function calculatePageGroups(options: PdfSplitWorkerOptions, pageCount: number): number[][] {
    switch (options.mode) {
        case 'all':
            return Array.from({ length: pageCount }, (_, i) => [i + 1]);

        case 'ranges':
            return parseRanges(options.ranges || [], pageCount);

        case 'chunks':
            return splitIntoChunks(pageCount, options.chunkSize || 1);

        case 'extract':
            const validPages = (options.pages || [])
                .filter(p => p >= 1 && p <= pageCount)
                .sort((a, b) => a - b);
            
            if (validPages.length === 0) {
                throw new Error('No valid pages specified for extraction');
            }
            
            return [validPages];

        default:
            throw new Error(`Unknown split mode: ${options.mode}`);
    }
}

/**
 * Parse page ranges into arrays of page numbers
 */
function parseRanges(ranges: PageRange[], pageCount: number): number[][] {
    return ranges.map(range => {
        if (range.pages) {
            return range.pages.filter(p => p >= 1 && p <= pageCount);
        }

        const start = Math.max(1, range.start || 1);
        const end = Math.min(pageCount, range.end || pageCount);

        if (start > end || start > pageCount) {
            throw new Error(`Invalid page range: ${start}-${end}`);
        }

        const pages: number[] = [];
        for (let i = start; i <= end; i++) {
            pages.push(i);
        }
        return pages;
    }).filter(pages => pages.length > 0);
}

/**
 * Split page count into chunks of N pages
 */
function splitIntoChunks(pageCount: number, chunkSize: number): number[][] {
    const chunks: number[][] = [];
    
    for (let i = 1; i <= pageCount; i += chunkSize) {
        const chunk: number[] = [];
        for (let j = i; j < i + chunkSize && j <= pageCount; j++) {
            chunk.push(j);
        }
        chunks.push(chunk);
    }

    return chunks;
}

/**
 * Extract specific pages from a PDF into a new PDF
 */
async function extractPages(sourcePdf: PDFDocument, pageNumbers: number[]): Promise<PDFDocument> {
    const newPdf = await PDFDocument.create();
    
    // pdf-lib uses 0-based indexing, our API uses 1-based
    const indices = pageNumbers.map(p => p - 1);
    const copiedPages = await newPdf.copyPages(sourcePdf, indices);
    
    for (const page of copiedPages) {
        newPdf.addPage(page);
    }

    return newPdf;
}

/**
 * Handle split operation
 */
async function handleSplit(
    pdfBuffer: ArrayBuffer,
    options: PdfSplitWorkerOptions
): Promise<{ pageCount: number; splits: PdfSplitWorkerResult[] }> {
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pageCount = pdfDoc.getPageCount();
    
    const pageGroups = calculatePageGroups(options, pageCount);
    const splits: PdfSplitWorkerResult[] = [];

    for (const pages of pageGroups) {
        const newPdf = await extractPages(pdfDoc, pages);
        const pdfBytes = await newPdf.save();
        
        splits.push({
            pages,
            pdfBytes: new Uint8Array(pdfBytes),
        });
    }

    return { pageCount, splits };
}

/**
 * Handle getInfo operation
 */
async function handleGetInfo(pdfBuffer: ArrayBuffer): Promise<{
    pageCount: number;
    info: {
        title?: string;
        author?: string;
        subject?: string;
        creator?: string;
        producer?: string;
        creationDate?: string;
        modificationDate?: string;
    };
}> {
    const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
    
    return {
        pageCount: pdfDoc.getPageCount(),
        info: {
            title: pdfDoc.getTitle(),
            author: pdfDoc.getAuthor(),
            subject: pdfDoc.getSubject(),
            creator: pdfDoc.getCreator(),
            producer: pdfDoc.getProducer(),
            creationDate: pdfDoc.getCreationDate()?.toISOString(),
            modificationDate: pdfDoc.getModificationDate()?.toISOString(),
        },
    };
}

/**
 * Message handler
 */
parentPort.on('message', async (message: PdfWorkerMessage) => {
    const { type, taskId, pdfBuffer, options } = message;
    
    try {
        let response: PdfWorkerResponse;

        switch (type) {
            case 'split':
                if (!options) {
                    throw new Error('Split options are required');
                }
                const splitResult = await handleSplit(pdfBuffer, options);
                response = {
                    type: 'success',
                    taskId,
                    result: {
                        pageCount: splitResult.pageCount,
                        splits: splitResult.splits,
                    },
                };
                break;

            case 'getInfo':
                const infoResult = await handleGetInfo(pdfBuffer);
                response = {
                    type: 'success',
                    taskId,
                    result: {
                        pageCount: infoResult.pageCount,
                        info: infoResult.info,
                    },
                };
                break;

            default:
                throw new Error(`Unknown operation type: ${type}`);
        }

        parentPort!.postMessage(response);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        const response: PdfWorkerResponse = {
            type: 'error',
            taskId,
            error: errorMessage,
        };
        
        parentPort!.postMessage(response);
    }
});

// Signal that worker is ready
parentPort.postMessage({ type: 'ready' });
