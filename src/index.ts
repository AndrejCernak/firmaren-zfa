import express, { Request, Response } from 'express';
import cors from 'cors';
import PDFDocument from 'pdfkit';
import bodyParser from 'body-parser';
import { startEmailTracker } from './email-tracker';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

startEmailTracker();

app.post('/generate-zfa', (req: Request, res: Response) => {
  const { email, price } = req.body as { email: string; price: string | number };

  const doc = new PDFDocument({ margin: 50 });
  const filename = `ZFA-faktura.pdf`;

  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  res.setHeader('Content-Type', 'application/pdf');

  const cleanText = (text: any): string => 
    text?.toString().normalize('NFC').replace(/\r\n/g, '\n').trim() ?? '';

  doc.font('Helvetica');

doc.fontSize(20).text('Zálohová faktúra', { align: 'center' }).moveDown(0.5);
doc.font('Helvetica-Bold').text('Zákazník:', { underline: true }).font('Helvetica').text(`Email: ${cleanText(email)}`).moveDown();
doc.font('Helvetica-Bold').text('Suma na úhradu:', { underline: true }).font('Helvetica').text(`${cleanText(price)} EUR`).moveDown();

// Separate font size change before the text
doc.fontSize(10).text('Dátum vystavenia: ' + new Date().toLocaleDateString('sk-SK'), { align: 'right' });

doc.moveDown(2); // separate move down
doc.fontSize(12).text('diky!', { align: 'center' });

doc.end();
doc.pipe(res);

});

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 4000;
app.listen(PORT, () => console.log(`✅ PDF & Mail service running at http://localhost:${PORT}`));
