import { Router } from 'express';
import healthRoutes from './health.js';

const router = Router();

router.use('/health', healthRoutes);

// Future v1 route modules:
// router.use('/documents', documentRoutes);
// router.use('/folders', folderRoutes);
// router.use('/processing', processingRoutes);

export default router;
