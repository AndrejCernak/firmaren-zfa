import imaps, { ImapSimpleOptions, Message } from 'imap-simple';
import { simpleParser, ParsedMail } from 'mailparser';
import nodemailer from 'nodemailer';
import pool from './db';
import { downloadAndSendDocs } from './downloadAndSendDocs';
import dotenv from 'dotenv';

dotenv.config();

interface KeywordVariant {
  keyword: string;
  variant: number;
}

const imapConfig: ImapSimpleOptions = {
  imap: {
    user: process.env.EMAIL_ADDRESS!,
    password: process.env.EMAIL_PASSWORD!,
    host: process.env.IMAP_HOST!,
    port: parseInt(process.env.IMAP_PORT!),
    tls: true,
    tlsOptions: { rejectUnauthorized: false },
    authTimeout: 10000,
  },
};

const keywordVariants: KeywordVariant[] = [
  { keyword: "zaslanie dokumentov", variant: 1 },
  { keyword: "prijatie objednávky", variant: 2 },
  { keyword: "podanie na živnostenský register", variant: 3 },
  { keyword: "podanie na obchodný register", variant: 4 },
  { keyword: "firma zaregistrovaná", variant: 5 },
];

const responses: { [key: number]: string } = {
  2: "Vašu objednávku sme prijali a pripravujeme dokumenty.",
  3: "Vaše podanie na živnostenský register bolo spracované.",
  4: "Podanie na obchodný register bolo zrealizované.",
  5: "Vaša firma bola úspešne zaregistrovaná. Gratulujeme!",
};

async function checkInbox(): Promise<void> {
  try {
    const connection = await imaps.connect(imapConfig);
    await connection.openBox('INBOX');

    const searchCriteria = ['UNSEEN'];
    const fetchOptions = { bodies: [''], markSeen: true };
    const messages: Message[] = await connection.search(searchCriteria, fetchOptions);

    for (const item of messages) {
      const all = item.parts.find((part) => part.which === '');
      if (!all) continue;

      const parsed: ParsedMail = await simpleParser(all.body);
      const subject = parsed.subject || '';
      const body = parsed.text || '';
      const fullText = (subject + ' ' + body).toLowerCase();

      const match = fullText.match(/č\.\s*(\d{3,})/i);
      if (!match) {
        console.log("❌ No order number found.");
        continue;
      }

      const orderNumber = match[1];
      console.log("📦 Found order number:", orderNumber);

      const detected = keywordVariants.find((kv) => fullText.includes(kv.keyword));
      if (!detected) {
        console.log("❌ No matching keyword found.");
        continue;
      }

      const variant = detected.variant;
      console.log("🔍 Matched variant:", variant);

      const [rows]: any = await pool.query(
        "SELECT email FROM `Order` WHERE orderNumber = ?",
        [orderNumber]
      );

      if (rows.length === 0) {
        console.log("❌ No customer found for", orderNumber);
        continue;
      }

      const recipientEmail: string = rows[0].email;

      // ✅ VARIANT 1 – Handle document download
      if (variant === 1) {
        const fullLinkMatch = fullText.match(/https:\/\/www\.firmaren\.sk\/stats-of-click\?[^ \n]+/);
        if (!fullLinkMatch) {
          console.log("❌ Stats-of-click link not found.");
          continue;
        }

        const urlParamMatch = fullLinkMatch[0].match(/url=([^&\s]+)/);
        if (!urlParamMatch) {
          console.log("❌ Could not extract encoded url= from stats-of-click.");
          continue;
        }

        const decodedUrl = decodeURIComponent(urlParamMatch[1]);
        const docIdMatch = decodedUrl.match(/[?&]o=([a-zA-Z0-9]+)/);
        if (!docIdMatch) {
          console.log("❌ Document ID not found in decoded URL.");
          continue;
        }

        const docId = docIdMatch[1];
        console.log("📥 Found docId:", docId);

        await downloadAndSendDocs(docId, recipientEmail);

        continue; // IMPORTANT to prevent falling down to simple email sending
      }

      // ✅ Other variants (2–5) – Send simple info email
      const emailText = responses[variant];

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
        from: `"Firmaren Bot" <${process.env.EMAIL_ADDRESS}>`,
        to: recipientEmail,
        subject: `Info k objednávke č. ${orderNumber}`,
        text: emailText,
      });

      console.log(`✅ Info email sent for variant ${variant} to ${recipientEmail}`);
    }

    connection.end();
  } catch (err: any) {
    console.error("❌ Error:", err.message);
  }
}

export function startEmailTracker(): void {
  console.log("📬 Email tracker running...");
  setInterval(checkInbox, 30 * 1000);
}

