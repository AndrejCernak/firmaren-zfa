import express, { Request, Response } from 'express';
import cors from 'cors';
import PDFDocument from 'pdfkit';
import bodyParser from 'body-parser';
import { startEmailTracker } from './email-tracker';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const app = express();

const allowedOrigins = [
  'https://firmarenhosting.vercel.app',
  'https://firmarenhosting-kxt07msp0-andrejcernaks-projects.vercel.app'
];

// ✅ CORS middleware
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log(`❌ CORS blocked: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}));

// ✅ Handle preflight
app.options('*', cors());

app.use(bodyParser.json());

startEmailTracker();

// Helper to sanitize input
const cleanText = (text: any): string =>
  text?.toString().normalize('NFC').replace(/\r\n/g, '\n').trim() ?? '';

app.post('/generate-zfa', (req: Request, res: Response) => {
  try {
    const {
      email, price, isCompany, companyName, ico, dic, ic_dph,
      firstName, lastName, street, streetNumber, city, zipCode, country,
    } = req.body;

    const doc = new PDFDocument({ margin: 50 });
    const filename = `ZFA-faktura.pdf`;

    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/pdf');

    // ✅ Correct font path from dist/ to src/fonts
    const fontPath = path.resolve(__dirname, '../src/fonts/OpenSans-Regular.ttf');
    doc.font(fontPath);

    doc.pipe(res); // ✅ Must come before doc.end()

    doc.fontSize(20).text(cleanText('Zálohová faktúra'), { align: 'center' }).moveDown(1);
    doc.font('Helvetica-Bold').fontSize(14).text(cleanText('Zákazník:'), { underline: true }).moveDown(0.5);
    doc.font(fontPath).fontSize(12);

    if (isCompany) {
      doc.text(`${cleanText('Firma')}: ${cleanText(companyName)}`);
      if (ico) doc.text(`IČO: ${cleanText(ico)}`);
      if (dic) doc.text(`DIČ: ${cleanText(dic)}`);
      if (ic_dph) doc.text(`IČ DPH: ${cleanText(ic_dph)}`);
    } else {
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
  } catch (err) {
    console.error('❌ PDF generation error:', err);
    res.status(500).send('Internal Server Error');
  }
});

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 8080;
app.listen(PORT, () => console.log(`✅ PDF & Mail service running at http://localhost:${PORT}`));
