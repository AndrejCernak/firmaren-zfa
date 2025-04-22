const express = require('express');
const cors = require('cors');
const PDFDocument = require('pdfkit');
const bodyParser = require('body-parser');
const { startEmailTracker } = require('./email-tracker'); // ✅ Add this

require('dotenv').config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ✅ Start email tracker
startEmailTracker(); // 📨 Starts the 30-second email check

// ✅ ZFA PDF generator route (unchanged)
app.post('/generate-zfa', (req, res) => {
  const { email, price } = req.body;

  const doc = new PDFDocument({ margin: 50 });
  let filename = `ZFA-faktura.pdf`;

  res.setHeader('Content-disposition', `inline; filename="${filename}"`);
  res.setHeader('Content-type', 'application/pdf');

  const cleanText = (text) => text?.toString().normalize('NFC').replace(/\r\n/g, '\n').trim();
  doc.font('Helvetica');

  doc.fontSize(20).text('Zálohová faktúra', { align: 'center' }).moveDown(0.5);
  doc.font('Helvetica-Bold').text('Zákazník:', { underline: true }).font('Helvetica').text(`Email: ${cleanText(email)}`).moveDown();
  doc.font('Helvetica-Bold').text('Suma na úhradu:', { underline: true }).font('Helvetica').text(`${cleanText(price)} EUR`).moveDown();
  doc.fontSize(10).text('Dátum vystavenia: ' + new Date().toLocaleDateString('sk-SK'), { align: 'right' }).moveDown(2).text('diky!', { align: 'center', fontSize: 12 });

  doc.end();
  doc.pipe(res);
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`✅ PDF & Mail service running at http://localhost:${PORT}`));
