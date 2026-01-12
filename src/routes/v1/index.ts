import { Router } from 'express';
import healthRoutes from './health';
import documentRoutes from './documents';
import userRoutes from './users';

const router = Router();

router.use('/health', healthRoutes);
router.use('/documents', documentRoutes);
router.use('/users', userRoutes);

// Future v1 route modules:
// router.use('/folders', folderRoutes);
// router.use('/processing', processingRoutes);

export default router;
