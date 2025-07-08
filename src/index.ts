import express, { Request, Response } from 'express';
import cors from 'cors';
import PDFDocument from 'pdfkit';
import bodyParser from 'body-parser';
import { startEmailTracker } from './email-tracker';
import dotenv from 'dotenv';
import path from 'path';
import nodemailer from 'nodemailer';
import { generateInvoicePdf } from './generateInvoicePdf';


dotenv.config();

const app = express();

const allowedOrigins = [
  'https://firmarenhosting.vercel.app',
  'https://firmarenhosting-w08yyjbxr-andrejcernaks-projects.vercel.app',
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
app.post('/generate-zuctovanie', async (req: Request, res: Response) => {
  const data = req.body;
  const filename = `Faktura-${data.invoiceNumber || 'bez-cisla'}.pdf`;

  try {
    const pdfBuffer = Buffer.from(await generateInvoicePdf(data));
    await sendPdfEmail(data.email, 'Vaša zúčtovacia faktúra', pdfBuffer, filename);

    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/pdf');
    res.send(pdfBuffer);
  } catch (err) {
    console.error('❌ Chyba pri generovaní faktúry:', err);
    res.status(500).json({ error: 'Failed to generate invoice PDF' });
  }
});



app.post('/send-registration-link', async (req: Request, res: Response) => {
  const { email, link } = req.body;

  if (!email || !link) {
    res.status(400).json({ error: 'Missing email or link.' });
    return;
  }

  try {
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

    await transporter.sendMail({
      from: `"Založenie firmy" <${process.env.EMAIL_ADDRESS}>`,
      to: email,
      subject: 'Odkaz na registračný formulár',
      text: `Dobrý deň,\n\nďakujeme za objednávku. Váš registračný formulár nájdete tu:\n\n${link}\n\nS pozdravom,\nTím firma.tbg.sk`,
    });

    console.log(`📨 Registračný link odoslaný na ${email}`);
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('❌ Chyba pri odosielaní emailu:', err);
    res.status(500).json({ error: 'Failed to send email' });
  }
});


const PORT = process.env.PORT ? parseInt(process.env.PORT) : 4000;
app.listen(PORT, () => console.log(`✅ PDF & Mail service running at http://localhost:${PORT}`));
