"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const body_parser_1 = __importDefault(require("body-parser"));
const email_tracker_1 = require("./email-tracker");
const dotenv_1 = __importDefault(require("dotenv"));
const nodemailer_1 = __importDefault(require("nodemailer"));
const generateInvoicePdf_1 = require("./generateInvoicePdf");
dotenv_1.default.config();
const app = (0, express_1.default)();
const allowedOrigins = [
    'https://firmarenhosting.vercel.app',
    'https://firmarenhosting-w08yyjbxr-andrejcernaks-projects.vercel.app',
    'http://localhost:3000',
];
app.use((0, cors_1.default)({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        }
        else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
}));
app.use(body_parser_1.default.json());
(0, email_tracker_1.startEmailTracker)();
// Pomocná funkcia na čistenie textu
const cleanText = (text) => text?.toString().normalize('NFC').replace(/\r\n/g, '\n').trim() ?? '';
// 📧 Odoslanie PDF e-mailom
async function sendPdfEmail(to, subject, buffer, filename) {
    const transporter = nodemailer_1.default.createTransport({
        host: process.env.IMAP_HOST,
        port: 465,
        secure: true,
        auth: {
            user: process.env.EMAIL_ADDRESS,
            pass: process.env.EMAIL_PASSWORD,
        },
        tls: { rejectUnauthorized: false },
    });
    console.log("🔵 Sending email to:", to);
    console.log("🔵 Using subject:", subject);
    console.log("🔵 Attachment size (bytes):", buffer.length);
    await transporter.sendMail({
        from: `"Založenie firmy" <${process.env.EMAIL_ADDRESS}>`,
        to,
        subject,
        text: 'V prílohe nájdete svoju faktúru.',
        attachments: [
            {
                filename,
                content: buffer,
            },
        ],
    });
    console.log(`📧 Faktúra odoslaná na ${to}`);
}
app.post('/generate-zuctovanie', async (req, res) => {
    const data = req.body;
    const filename = `Faktura-${data.invoiceNumber || 'bez-cisla'}.pdf`;
    try {
        const pdfBuffer = Buffer.from(await (0, generateInvoicePdf_1.generateInvoicePdf)(data));
        await sendPdfEmail(data.email, 'Vaša zúčtovacia faktúra', pdfBuffer, filename);
        res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
        res.setHeader('Content-Type', 'application/pdf');
        res.send(pdfBuffer);
    }
    catch (err) {
        console.error('❌ Chyba pri generovaní faktúry:', err);
        res.status(500).json({ error: 'Failed to generate invoice PDF' });
    }
});
app.post('/send-registration-link', async (req, res) => {
    const { email, link } = req.body;
    if (!email || !link) {
        res.status(400).json({ error: 'Missing email or link.' });
        return;
    }
    try {
        const transporter = nodemailer_1.default.createTransport({
            host: process.env.IMAP_HOST,
            port: 465,
            secure: true,
            auth: {
                user: process.env.EMAIL_ADDRESS,
                pass: process.env.EMAIL_PASSWORD,
            },
            tls: { rejectUnauthorized: false },
        });
        await transporter.sendMail({
            from: `"Založenie firmy" <${process.env.EMAIL_ADDRESS}>`,
            to: email,
            subject: 'Odkaz na registračný formulár',
            text: `Dobrý deň,\n\nďakujeme za objednávku. Váš registračný formulár nájdete tu:\n\n${link}\n\nS pozdravom,\nTím firma.tbg.sk`,
        });
        console.log(`📨 Registračný link odoslaný na ${email}`);
        res.status(200).json({ success: true });
    }
    catch (err) {
        console.error('❌ Chyba pri odosielaní emailu:', err);
        res.status(500).json({ error: 'Failed to send email' });
    }
});
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 4000;
app.listen(PORT, () => console.log(`✅ PDF & Mail service running at http://localhost:${PORT}`));
