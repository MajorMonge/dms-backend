import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

/**
 * Cache control options
 */
export interface CacheOptions {
    maxAge?: number; // In seconds
    public?: boolean; // Public or private cache
    sMaxAge?: number; // Shared cache (CDN) max age in seconds
    noCache?: boolean; // Revalidate before using
    noStore?: boolean; // Don't cache at all
    mustRevalidate?: boolean; // Must revalidate when stale
}

/**
 * Generate ETag from response body
 */
const generateETag = (body: string): string => {
    return `"${crypto.createHash('md5').update(body).digest('hex')}"`;
};

/**
 * Cache control middleware for GET requests
 * Sets appropriate Cache-Control headers based on endpoint and options
 */
export const cacheControl = (options: CacheOptions = {}) => {
    return (req: Request, res: Response, next: NextFunction) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            return next();
        }

        const cacheDirectives: string[] = [];

        if (options.noStore) {
            cacheDirectives.push('no-store');
        } else if (options.noCache) {
            cacheDirectives.push('no-cache');
        } else {
            cacheDirectives.push(options.public !== false ? 'public' : 'private');

            if (options.maxAge) {
                cacheDirectives.push(`max-age=${options.maxAge}`);
            }

            if (options.sMaxAge) {
                cacheDirectives.push(`s-maxage=${options.sMaxAge}`);
            }

            if (options.mustRevalidate) {
                cacheDirectives.push('must-revalidate');
            }
        }

        res.setHeader('Cache-Control', cacheDirectives.join(', '));

        const originalJson = res.json.bind(res);

        res.json = function (body: any) {
            const bodyString = typeof body === 'string' ? body : JSON.stringify(body);
            const etag = generateETag(bodyString);
            res.setHeader('ETag', etag);

            const clientETag = req.get('If-None-Match');
            if (clientETag && clientETag === etag) {
                return res.status(304).end();
            }

            res.setHeader('Vary', 'Accept-Encoding');

            return originalJson(body);
        };

        next();
    };
};

/**
 * Specific cache configurations for different endpoints
 */
export const cacheConfigs = {
    document_list: {
        maxAge: 300, // 5 minutes
        public: true,
        mustRevalidate: true,
    },

    document_search: {
        maxAge: 120, // 2 minutes
        public: true,
        mustRevalidate: true,
    },

    document_detail: {
        maxAge: 600, // 10 minutes
        public: true,
        mustRevalidate: true,
    },

    presigned_url: {
        noCache: true,
        private: true,
    },

    folder_list: {
        maxAge: 300, // 5 minutes
        public: true,
        mustRevalidate: true,
    },

    health: {
        maxAge: 30, // 30 seconds
        public: true,
    },

    no_cache: {
        noStore: true,
    },
};

/**
 * Middleware to set Last-Modified header from document timestamp
 */
export const setLastModified = (req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json.bind(res);

    res.json = function (body: any) {
        if (body && typeof body === 'object') {
            let lastModified: Date | null = null;

            if (body.data) {
                if (body.data.updatedAt) {
                    lastModified = new Date(body.data.updatedAt);
                } else if (Array.isArray(body.data) && body.data.length > 0 && body.data[0].updatedAt) {
                    lastModified = new Date(
                        Math.max(...body.data.map((item: any) => new Date(item.updatedAt).getTime()))
                    );
                }
            }

            if (lastModified) {
                res.setHeader('Last-Modified', lastModified.toUTCString());
            }
        }

        return originalJson(body);
    };

    next();
};

/**
 * Check If-Modified-Since header and return 304 if not modified
 */
export const checkModified = (req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json.bind(res);

    res.json = function (body: any) {
        const ifModifiedSince = req.get('If-Modified-Since');

        if (ifModifiedSince && body && typeof body === 'object' && body.data) {
            let resourceModified: Date | null = null;

            if (body.data.updatedAt) {
                resourceModified = new Date(body.data.updatedAt);
            }

            if (resourceModified) {
                const clientDate = new Date(ifModifiedSince);
                if (resourceModified <= clientDate) {
                    return res.status(304).end();
                }
            }
        }

        return originalJson(body);
    };

    next();
};
