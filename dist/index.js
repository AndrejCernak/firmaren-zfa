"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const pdfkit_1 = __importDefault(require("pdfkit"));
const body_parser_1 = __importDefault(require("body-parser"));
const email_tracker_1 = require("./email-tracker");
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const nodemailer_1 = __importDefault(require("nodemailer"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const allowedOrigins = [
    'https://firmarenhosting.vercel.app',
    'https://firmarenhosting-ndarl8x2e-andrejcernaks-projects.vercel.app',
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
        from: `"Firmaren" <${process.env.EMAIL_ADDRESS}>`,
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
// 🔹 Generovanie ZFA faktúry
app.post('/generate-zfa', (req, res) => {
    const { email, price, isCompany, companyName, ico, dic, ic_dph, firstName, lastName, street, streetNumber, city, zipCode, country, zfaNumber, zfaDate, // ⬅ new from frontend
     } = req.body;
    const filename = `ZFA-${zfaNumber}.pdf`;
    const doc = new pdfkit_1.default({ margin: 50 });
    const fontPath = path_1.default.join(__dirname, 'fonts', 'OpenSans-Regular.ttf');
    doc.font(fontPath);
    doc.fontSize(20).text('Zálohová faktúra', { align: 'center' }).moveDown(1);
    doc.font('Helvetica-Bold').fontSize(14).text('Zákazník:', { underline: true }).moveDown(0.5);
    doc.font(fontPath).fontSize(12);
    if (isCompany) {
        doc.text(`Firma: ${cleanText(companyName)}`);
        if (ico)
            doc.text(`IČO: ${cleanText(ico)}`);
        if (dic)
            doc.text(`DIČ: ${cleanText(dic)}`);
        if (ic_dph)
            doc.text(`IČ DPH: ${cleanText(ic_dph)}`);
    }
    else {
        doc.text(`Meno: ${cleanText(firstName)} ${cleanText(lastName)}`);
    }
    doc.moveDown(0.5);
    doc.text(`Email: ${cleanText(email)}`);
    doc.text(`Adresa: ${cleanText(street)}, ${cleanText(city)}, ${cleanText(zipCode)}, ${cleanText(country)}`);
    doc.text(`Číslo zálohovej faktúry: ${cleanText(zfaNumber)}`);
    doc.moveDown(1);
    doc.font('Helvetica-Bold').text('Suma na úhradu:', { underline: true }).font(fontPath).text(`${cleanText(price)} EUR`);
    doc.moveDown(1);
    doc.fontSize(10).text(`Dátum vystavenia: ${new Date(zfaDate).toLocaleDateString('sk-SK')}`, { align: 'right' });
    doc.moveDown(2);
    doc.fontSize(12).text('Ďakujeme za objednávku!', { align: 'center' });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', async () => {
        const buffer = Buffer.concat(chunks);
        await sendPdfEmail(email, 'Vaša zálohová faktúra', buffer, filename);
        res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
        res.setHeader('Content-Type', 'application/pdf');
        res.send(buffer);
    });
    doc.end();
});
// 🔹 Generovanie zúčtovacej faktúry
app.post('/generate-zuctovanie', (req, res) => {
    const { email, price, isCompany, companyName, ico, dic, ic_dph, firstName, lastName, street, city, zipCode, country, zfaNumber, zfaDate, invoiceNumber, } = req.body;
    const filename = `Faktura-${invoiceNumber}.pdf`;
    const doc = new pdfkit_1.default({ margin: 50 });
    const fontPath = path_1.default.join(__dirname, 'fonts', 'OpenSans-Regular.ttf');
    doc.font(fontPath);
    doc.fontSize(20).text('Faktúra – daňový doklad', { align: 'center' }).moveDown(1);
    doc.font('Helvetica-Bold').fontSize(14).text('Zákazník:', { underline: true }).moveDown(0.5);
    doc.font(fontPath).fontSize(12);
    if (isCompany) {
        doc.text(`Firma: ${cleanText(companyName)}`);
        if (ico)
            doc.text(`IČO: ${cleanText(ico)}`);
        if (dic)
            doc.text(`DIČ: ${cleanText(dic)}`);
        if (ic_dph)
            doc.text(`IČ DPH: ${cleanText(ic_dph)}`);
    }
    else {
        doc.text(`Meno: ${cleanText(firstName)} ${cleanText(lastName)}`);
    }
    doc.moveDown(0.5);
    doc.text(`Email: ${cleanText(email)}`);
    doc.text(`Adresa: ${cleanText(street)}, ${cleanText(zipCode)} ${cleanText(city)}, ${cleanText(country)}`);
    doc.moveDown(1);
    doc.font('Helvetica-Bold').text('Fakturované položky:', { underline: true }).moveDown(0.5);
    doc.font(fontPath);
    doc.text(`Založenie spoločnosti ................................................... ${cleanText(price)} €`);
    const parsedZfaDate = new Date(zfaDate);
    doc.text(`Záloha zaplatená na základe faktúry č. ${zfaNumber} dňa ${parsedZfaDate.toLocaleDateString('sk-SK')} .......... -${cleanText(price)} €`);
    doc.moveDown(1);
    doc.font('Helvetica-Bold').text('Spolu na úhradu: 0,00 €', { align: 'right' });
    doc.moveDown(2);
    doc.fontSize(10).text(`Dátum vystavenia: ${new Date().toLocaleDateString('sk-SK')}`, { align: 'right' });
    doc.moveDown(3);
    doc.font(fontPath).fontSize(12).text('Ďakujeme za využitie našich služieb.', { align: 'center' });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', async () => {
        const buffer = Buffer.concat(chunks);
        await sendPdfEmail(email, 'Vaša zúčtovacia faktúra', buffer, filename);
        res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
        res.setHeader('Content-Type', 'application/pdf');
        res.send(buffer);
    });
    doc.end();
});
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 4000;
app.listen(PORT, () => console.log(`✅ PDF & Mail service running at http://localhost:${PORT}`));
