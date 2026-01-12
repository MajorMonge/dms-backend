import { Router } from 'express';
import healthRoutes from './health';
import documentRoutes from './documents';
import userRoutes from './users';
import folderRoutes from './folders';

const router = Router();

router.use('/health', healthRoutes);
router.use('/documents', documentRoutes);
router.use('/users', userRoutes);
router.use('/folders', folderRoutes);

// Future v1 route modules:
// router.use('/processing', processingRoutes);

export default router;
