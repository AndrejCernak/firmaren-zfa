"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateInvoicePdf = generateInvoicePdf;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const handlebars_1 = __importDefault(require("handlebars"));
const puppeteer_1 = __importDefault(require("puppeteer"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
//Handlebars helpery
handlebars_1.default.registerHelper('ifNotEquals', function (a, b, options) {
    return a !== b ? options.fn(this) : options.inverse(this);
});
handlebars_1.default.registerHelper('ifEquals', function (a, b, options) {
    return a === b ? options.fn(this) : options.inverse(this);
});
handlebars_1.default.registerHelper('calcVat', function (price) {
    const p = parseFloat(price);
    if (isNaN(p))
        return '0.00';
    return (p * 0.2).toFixed(2);
});
handlebars_1.default.registerHelper('calcTotal', function (price) {
    const p = parseFloat(price);
    if (isNaN(p))
        return '0.00';
    return (p * 1.2).toFixed(2);
});
//Formát dátumu
handlebars_1.default.registerHelper('formatDate', function (date) {
    const d = new Date(date);
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString('sk-SK');
});
async function generateInvoicePdf(data) {
    const htmlPath = path_1.default.join(__dirname, 'templates', 'invoice.html');
    const cssPath = path_1.default.join(__dirname, 'templates', 'invoice.css');
    const html = fs_1.default.readFileSync(htmlPath, 'utf-8');
    const css = fs_1.default.readFileSync(cssPath, 'utf-8');
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
    const template = handlebars_1.default.compile(html);
    const htmlWithStyles = template({
        ...data,
        styles: css,
        supplier,
    });
    const browser = await puppeteer_1.default.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setContent(htmlWithStyles, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
    await browser.close();
    return pdfBuffer;
}
