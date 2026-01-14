import { Router } from 'express';
import healthRoutes from './health.js';
import authRoutes from './auth.js';
import documentRoutes from './documents.js';
import userRoutes from './users.js';
import folderRoutes from './folders.js';
import pdfRoutes from './pdf.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/documents', documentRoutes);
router.use('/users', userRoutes);
router.use('/folders', folderRoutes);
router.use('/pdf', pdfRoutes);

export default router;
