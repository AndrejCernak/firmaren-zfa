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
dotenv_1.default.config();
const app = (0, express_1.default)();
// ✅ Allowed CORS origins
const allowedOrigins = [
    'https://firmarenhosting.vercel.app',
    'https://firmarenhosting-kxt07msp0-andrejcernaks-projects.vercel.app'
];
// ✅ Safe CORS middleware using `cors` package
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
// Funkcia na čistenie textu
const cleanText = (text) => text?.toString().normalize('NFC').replace(/\r\n/g, '\n').trim() ?? '';
app.post('/generate-zfa', (req, res) => {
    const { email, price, isCompany, companyName, ico, dic, ic_dph, firstName, lastName, street, streetNumber, city, zipCode, country, } = req.body;
    const doc = new pdfkit_1.default({ margin: 50 });
    const filename = `ZFA-faktura.pdf`;
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/pdf');
    // Font path
    const fontPath = path_1.default.join(__dirname, 'fonts', 'OpenSans-Regular.ttf');
    doc.font(fontPath);
    doc.fontSize(20).text(cleanText('Zálohová faktúra'), { align: 'center' }).moveDown(1);
    doc.font('Helvetica-Bold').fontSize(14).text(cleanText('Zákazník:'), { underline: true }).moveDown(0.5);
    doc.font(fontPath).fontSize(12);
    if (isCompany) {
        doc.text(`${cleanText('Firma')}: ${cleanText(companyName)}`);
        if (ico)
            doc.text(`IČO: ${cleanText(ico)}`);
        if (dic)
            doc.text(`DIČ: ${cleanText(dic)}`);
        if (ic_dph)
            doc.text(`IČ DPH: ${cleanText(ic_dph)}`);
    }
    else {
        doc.text(`${cleanText('Meno')}: ${cleanText(firstName)} ${cleanText(lastName)}`);
    }
    doc.moveDown(0.5);
    doc.text(`Email: ${cleanText(email)}`);
    doc.text(`Adresa: ${cleanText(street)} ${cleanText(streetNumber)}, ${cleanText(city)}, ${cleanText(zipCode)}, ${cleanText(country)}`);
    doc.moveDown(1);
    doc.font('Helvetica-Bold').text(cleanText('Suma na úhradu:'), { underline: true }).font(fontPath).text(`${cleanText(price)} EUR`);
    doc.moveDown(2);
    doc.fontSize(10).text(`${cleanText('Dátum vystavenia')}: ${new Date().toLocaleDateString('sk-SK')}`, { align: 'right' });
    doc.moveDown(3);
    doc.fontSize(12).text(cleanText('Ďakujeme za objednávku!'), { align: 'center' });
    doc.end();
    doc.pipe(res);
});
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 4000;
app.listen(PORT, () => console.log(`✅ PDF & Mail service running at http://localhost:${PORT}`));
