import { Router } from 'express';
import healthRoutes from './health';
import documentRoutes from './documents';
import userRoutes from './users';
import folderRoutes from './folders';
import pdfRoutes from './pdf';

const router = Router();

router.use('/health', healthRoutes);
router.use('/documents', documentRoutes);
router.use('/users', userRoutes);
router.use('/folders', folderRoutes);
router.use('/pdf', pdfRoutes);

export default router;
