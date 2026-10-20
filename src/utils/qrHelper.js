const QRCode = require('qrcode');

async function generateQRCodeDataUrl(text) {
    try {
        const url = await QRCode.toDataURL(text, {
            width: 200,
            margin: 1,
            color: {
                dark: '#0f172a',
                light: '#ffffff'
            }
        });
        return url;
    } catch (err) {
        console.error('Error generating QR code:', err);
        return '';
    }
}

module.exports = {
    generateQRCodeDataUrl
};

