import { Router } from 'express';
import { getTags, getArticlesByTag } from '../controllers/tag.controller';

const router = Router();

router.get('/', getTags);
router.get('/:slug/articles', getArticlesByTag);

export default router;