import fs from 'fs';
import path from 'path';
import handlebars from 'handlebars';
import puppeteer from 'puppeteer';
import dotenv from 'dotenv';

dotenv.config(); 

//Handlebars helpery
handlebars.registerHelper('ifNotEquals', function (this: any, a, b, options) {
  return a !== b ? options.fn(this) : options.inverse(this);
});

handlebars.registerHelper('ifEquals', function (this: any, a, b, options) {
  return a === b ? options.fn(this) : options.inverse(this);
});

handlebars.registerHelper('calcVat', function (price: string) {
  const p = parseFloat(price);
  if (isNaN(p)) return '0.00';
  return (p * 0.2).toFixed(2);
});

handlebars.registerHelper('calcTotal', function (price: string) {
  const p = parseFloat(price);
  if (isNaN(p)) return '0.00';
  return (p * 1.2).toFixed(2);
});

//Formát dátumu
handlebars.registerHelper('formatDate', function (date: string) {
  const d = new Date(date);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('sk-SK');
});

export async function generateInvoicePdf(data: any): Promise<Uint8Array> {
  const htmlPath = path.join(__dirname, '..', 'templates', 'invoice.html');
  const cssPath = path.join(__dirname, '..', 'templates', 'invoice.css');

  const html = fs.readFileSync(htmlPath, 'utf-8');
  const css = fs.readFileSync(cssPath, 'utf-8');

  // dodavatel udaje
  const supplier = {
    name: process.env.SUPPLIER_NAME || '',
    street: process.env.SUPPLIER_STREET || '',
    city: process.env.SUPPLIER_CITY || '',
    ico: process.env.SUPPLIER_ICO || '',
    dic: process.env.SUPPLIER_DIC || '',
    ic_dph: process.env.SUPPLIER_IC_DPH || '',
    iban: process.env.SUPPLIER_IBAN || '',
  };

  const template = handlebars.compile(html);
  const htmlWithStyles = template({
    ...data,
    styles: css,
    supplier, 
  });

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  await page.setContent(htmlWithStyles, { waitUntil: 'networkidle0' });

  const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
  await browser.close();

  return pdfBuffer;
}
