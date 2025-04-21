const express = require('express');
const cors = require('cors');
const PDFDocument = require('pdfkit');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.post('/generate-zfa', (req, res) => {
  const { email, price, orderNumber } = req.body;

  const doc = new PDFDocument();
  let filename = `ZFA-${orderNumber || 'order'}.pdf`;
  res.setHeader('Content-disposition', `inline; filename="${filename}"`);
  res.setHeader('Content-type', 'application/pdf');

  doc.text(`Zálohová faktúra`, { align: 'center', fontSize: 20 });
  doc.moveDown();
  doc.text(`Objednávka: ${orderNumber || 'Bez čísla'}`);
  doc.text(`Email zákazníka: ${email}`);
  doc.text(`Suma: ${price} EUR`);
  doc.text(`Dátum: ${new Date().toLocaleDateString()}`);
  doc.end();

  doc.pipe(res);
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`PDF service running on port ${PORT}`));
