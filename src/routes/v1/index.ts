import { Router } from 'express';
import healthRoutes from './health.js';
import documentRoutes from './documents';

const router = Router();

router.use('/health', healthRoutes);
router.use('/documents', documentRoutes);

// Future v1 route modules:
// router.use('/folders', folderRoutes);
// router.use('/processing', processingRoutes);

export default router;
