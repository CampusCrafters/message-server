import "dotenv/config";
import { Router } from 'express';
import bodyParser from 'body-parser';

const router = Router();
router.use(bodyParser.json());

router.get('/', async (req, res) => {
    const confessions = 
    res.send('Hello from api/v1/confessions route')
});

router.post('/', async (req, res) => {
    const { confession } = req.body;
    res.send('Hello from api/v1/confessions route')
})

export default router;



