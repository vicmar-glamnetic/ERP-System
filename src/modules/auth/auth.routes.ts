import { Router } from 'express';
import { authGuard } from '../../middleware/authGuard';
import * as AuthController from './auth.controller';

const router = Router();

router.post('/login', AuthController.login);
router.post('/refresh', AuthController.refresh);
router.post('/logout', authGuard, AuthController.logout);
router.get('/me', authGuard, AuthController.getMe);

export default router;
