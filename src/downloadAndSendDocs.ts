import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

export async function downloadAndSendDocs(docId: string, recipientEmail: string): Promise<void> {
  console.log(`🚀 Starting document download for docId: ${docId}`);

  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
    const page = await browser.newPage();
  await page.setJavaScriptEnabled(true);

  const url = `https://www.firmaren.sk/objednavka/dokumenty?o=${docId}&d=true`;
  await page.goto(url, { waitUntil: 'networkidle2' });

  await new Promise((resolve) => setTimeout(resolve, 3000));

  const links: string[] = await page.evaluate(() => {
    return Array.from(new Set(
      Array.from(document.querySelectorAll('a'))
        .filter(link => link.textContent?.trim() === 'Stiahnuť')
        .map(link => (link as HTMLAnchorElement).href)
    ));
  });

  if (links.length === 0) {
    console.log("❌ No documents found to download.");
    await browser.close();
    return;
  }

  const cookies = await page.cookies();
  const jsessionId = cookies.find(cookie => cookie.name === 'JSESSIONID')?.value;

  if (!jsessionId) {
    console.log("❌ Could not find JSESSIONID cookie.");
    await browser.close();
    return;
  }

  const downloadFolder = path.join('downloads', docId);
  if (!fs.existsSync(downloadFolder)) {
    fs.mkdirSync(downloadFolder, { recursive: true });
  }

  const attachments: { filename: string; path: string }[] = [];

  for (const link of links) {
    try {
      const response = await axios.get(link, {
        responseType: 'arraybuffer',
        headers: {
          Cookie: `JSESSIONID=${jsessionId}`,
        },
      });

      const fileName = link.split('?f=').pop() || 'unknown.pdf';
      const filePath = path.join(downloadFolder, fileName);

      fs.writeFileSync(filePath, response.data);
      console.log(`✅ Downloaded and saved: ${fileName}`);

      attachments.push({
        filename: fileName,
        path: filePath,
      });
    } catch (error: any) {
      console.error(`❌ Failed to download ${link}:`, error.message);
    }
  }

  await browser.close();

  if (attachments.length > 0) {
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
      from: `"firma.tbg.sk Bot" <${process.env.EMAIL_ADDRESS}>`,
      to: recipientEmail,
      subject: `Vaše dokumenty k objednávke`,
      text: `Dobrý deň,\n\nv prílohe nájdete dokumenty k Vašej objednávke.\n\nS pozdravom,\nfirma.tbg.sk`,
      attachments: attachments,
    });

    console.log(`📩 Documents sent to ${recipientEmail}`);
  } else {
    console.log(`❌ No documents to send for ${recipientEmail}`);
  }
}
