import express, { Request, Response } from 'express';
import cors from 'cors';
import PDFDocument from 'pdfkit';
import bodyParser from 'body-parser';
import { startEmailTracker } from './email-tracker';
import dotenv from 'dotenv';
import path from 'path';
import nodemailer from 'nodemailer';

dotenv.config();

const app = express();

const allowedOrigins = [
  'https://firmarenhosting.vercel.app',
  'https://firmarenhosting-msltt4rfs-andrejcernaks-projects.vercel.app',
  'http://localhost:3000',
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}));

app.use(bodyParser.json());

startEmailTracker();

// Pomocná funkcia na čistenie textu
const cleanText = (text: any): string =>
  text?.toString().normalize('NFC').replace(/\r\n/g, '\n').trim() ?? '';

// 📧 Odoslanie PDF e-mailom
async function sendPdfEmail(to: string, subject: string, buffer: Buffer, filename: string) {
  const transporter = nodemailer.createTransport({
    host: process.env.IMAP_HOST!,
    port: 465,
    secure: true,
    auth: {
      user: process.env.EMAIL_ADDRESS!,
      pass: process.env.EMAIL_PASSWORD!,
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
app.post('/generate-zfa', (req: Request, res: Response) => {
  const {
    email, price, isCompany, companyName, ico, dic, ic_dph,
    firstName, lastName, street, streetNumber, city, zipCode, country,
    zfaNumber, zfaDate, // ⬅ new from frontend
  } = req.body;

  const filename = `ZFA-${zfaNumber}.pdf`;
  const doc = new PDFDocument({ margin: 50 });
  const fontPath = path.join(__dirname, 'fonts', 'OpenSans-Regular.ttf');
  doc.font(fontPath);

  doc.fontSize(20).text('Zálohová faktúra', { align: 'center' }).moveDown(1);
  doc.font('Helvetica-Bold').fontSize(14).text('Zákazník:', { underline: true }).moveDown(0.5);
  doc.font(fontPath).fontSize(12);

  if (isCompany) {
    doc.text(`Firma: ${cleanText(companyName)}`);
    if (ico) doc.text(`IČO: ${cleanText(ico)}`);
    if (dic) doc.text(`DIČ: ${cleanText(dic)}`);
    if (ic_dph) doc.text(`IČ DPH: ${cleanText(ic_dph)}`);
  } else {
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

  const chunks: Buffer[] = [];
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
app.post('/generate-zuctovanie', (req: Request, res: Response) => {
  const {
    email, price, isCompany, companyName, ico, dic, ic_dph,
    firstName, lastName, street, city, zipCode, country,
    zfaNumber, zfaDate, invoiceNumber,
  } = req.body;

  const filename = `Faktura-${invoiceNumber}.pdf`;
  const doc = new PDFDocument({ margin: 50 });
  const fontPath = path.join(__dirname, 'fonts', 'OpenSans-Regular.ttf');
  doc.font(fontPath);

  doc.fontSize(20).text('Faktúra – daňový doklad', { align: 'center' }).moveDown(1);
  doc.font('Helvetica-Bold').fontSize(14).text('Zákazník:', { underline: true }).moveDown(0.5);
  doc.font(fontPath).fontSize(12);

  if (isCompany) {
    doc.text(`Firma: ${cleanText(companyName)}`);
    if (ico) doc.text(`IČO: ${cleanText(ico)}`);
    if (dic) doc.text(`DIČ: ${cleanText(dic)}`);
    if (ic_dph) doc.text(`IČ DPH: ${cleanText(ic_dph)}`);
  } else {
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

  const chunks: Buffer[] = [];
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
