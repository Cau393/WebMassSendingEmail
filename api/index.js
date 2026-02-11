require('dotenv').config();
const express = require('express');
const multer = require('multer');
const sgMail = require('@sendgrid/mail');
const xlsx = require('xlsx');

const app = express();
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

app.use(express.json());

// --- CONFIGURATION ---
const BATCH_SIZE = 50; 
const BATCH_DELAY = 200; 

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function findColumnIndex(headers, regex) {
    return headers.findIndex(header => regex.test(String(header).trim()));
}

app.post('/api/send', upload.fields([{ name: 'listFile' }, { name: 'attachmentFile' }]), async (req, res) => {
    const { password, messageSubject, messageBody } = req.body;
    const listFile = req.files['listFile'] ? req.files['listFile'][0] : null;
    const attachmentFile = req.files['attachmentFile'] ? req.files['attachmentFile'][0] : null;

    if (password !== process.env.APP_ACCESS_PASSWORD) return res.status(403).json({ error: 'Incorrect Password' });
    if (!listFile) return res.status(400).json({ error: 'No file uploaded.' });

    try {
        console.log(`\n--- STARTING JOB: ${listFile.originalname} ---`);
        
        const workbook = xlsx.read(listFile.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const rawData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });

        if (!rawData || rawData.length < 2) throw new Error("File is empty");

        const headers = rawData[0];
        const emailIndex = findColumnIndex(headers, /e-?mail/i);
        const nameIndex = findColumnIndex(headers, /name|nome/i);

        if (emailIndex === -1) throw new Error('Could not find Email column');

        const allRecipients = [];
        for (let i = 1; i < rawData.length; i++) {
            const row = rawData[i];
            if (!row) continue;
            const email = row[emailIndex];
            const name = (nameIndex !== -1 && row[nameIndex]) ? row[nameIndex] : "";
            if (email && String(email).includes('@')) allRecipients.push({ email, name });
        }
        
        console.log(`Recipients Found: ${allRecipients.length}`);

        // Prepare Attachment
        let attachments = [];
        if (attachmentFile) {
            const fileContent = attachmentFile.buffer.toString("base64");
            attachments.push({
                content: fileContent,
                filename: attachmentFile.originalname,
                type: attachmentFile.mimetype,
                disposition: "attachment"
            });
        }

        let sentCount = 0;
        let failedCount = 0;
        const fromEmail = process.env.SENDGRID_FROM_EMAIL;
        const fromName = process.env.SENDGRID_FROM_NAME || "My Company";

        // --- PROCESSING ---
        // We MUST await this loop before res.json
        for (let i = 0; i < allRecipients.length; i += BATCH_SIZE) {
            const batch = allRecipients.slice(i, i + BATCH_SIZE);
            console.log(`Sending batch ${i} - ${i + BATCH_SIZE}...`);
            
            const batchPromises = batch.map(recipient => {
                const personalizedBody = messageBody.replace(/\{name\}/gi, recipient.name || 'Friend');
                const msg = {
                    to: recipient.email,
                    from: { email: fromEmail, name: fromName },
                    subject: messageSubject,
                    text: personalizedBody,
                    html: personalizedBody.replace(/\n/g, '<br>'),
                    attachments: attachments
                };
                return sgMail.send(msg)
                    .then(() => ({ success: true }))
                    .catch(err => {
                        console.error(`Failed to ${recipient.email}:`, err.response?.body || err.message);
                        return { success: false };
                    });
            });

            const results = await Promise.all(batchPromises);
            const success = results.filter(r => r.success).length;
            sentCount += success;
            failedCount += (results.length - success);

            if (i + BATCH_SIZE < allRecipients.length) await sleep(BATCH_DELAY);
        }

        console.log(`--- FINISHED: Sent ${sentCount}, Failed ${failedCount} ---`);

        // respond ONLY after work is done
        res.json({ success: true, count: sentCount, failed: failedCount });

    } catch (error) {
        console.error("ERROR:", error.message);
        res.status(500).json({ error: error.message });
    }
});

if (require.main === module) {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;