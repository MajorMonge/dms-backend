import morgan from 'morgan';
import { config } from '../config/index.js';
import { httpLogStream } from '../config/logger.js';

morgan.token('response-time-ms', (_req, res) => {
  const responseTime = res.getHeader('X-Response-Time');
  return responseTime ? String(responseTime) : '-';
});

const devFormat = ':method :url :status :response-time ms - :res[content-length]';

const prodFormat = JSON.stringify({
  method: ':method',
  url: ':url',
  status: ':status',
  responseTime: ':response-time',
  contentLength: ':res[content-length]',
  remoteAddr: ':remote-addr',
  userAgent: ':user-agent',
});

export const httpLogger = morgan(
  config.isProduction ? prodFormat : devFormat,
  {
    stream: httpLogStream,
    skip: (req) => {
      if (config.isProduction && req.url === '/health') {
        return true;
      }
      return false;
    },
  }
);
