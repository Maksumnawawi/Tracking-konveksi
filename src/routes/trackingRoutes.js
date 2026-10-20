const express = require('express');
const router = express.Router();
const TrackingController = require('../controllers/trackingController');

router.get('/:code', TrackingController.showPublicTrack);
router.get('/', (req, res) => {
    const code = req.query.code;
    if (code) {
        return res.redirect(`/track/${encodeURIComponent(code.trim())}`);
    }
    res.render('tracking/public-track', {
        title: 'Lacak Status Produksi Konveksi',
        order: null,
        searchCode: '',
        error: null
    });
});

module.exports = router;

