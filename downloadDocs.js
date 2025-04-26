const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const axios = require('axios');


(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  // Povoliť JavaScript na stránke
  await page.setJavaScriptEnabled(true);

  // Otvorim url z linku v maili v puppeteer
  const url = 'https://www.firmaren.sk/objednavka/dokumenty?o=boug1qy2lp2cj5tqy10lstvohqq51tbr2xtw0pfgyo4clwy0mv&d=true'
  const response = await page.goto(url, { waitUntil: 'networkidle2' });

  // Počkám na načítanie stránky
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Nájdem všetky odkazy na stiahnutie dokumentov
  const links = await page.evaluate(() => {
    return Array.from(new Set(
      Array.from(document.querySelectorAll('a'))
        .filter(link => link.textContent.trim() === 'Stiahnuť')
        .map(link => link.href)
    ));
  });

  // Linky na stiahnutie dokumentov:> 
  //[
  //   'https://www.firmaren.sk/order/download/boug1qy2lp2cj5tqy10lstvohqq51tbr2xtw0pfgyo4clwy0mv?f=bfg-company-services_zakladatelska-listina.pdf',
  //   'https://www.firmaren.sk/order/download/boug1qy2lp2cj5tqy10lstvohqq51tbr2xtw0pfgyo4clwy0mv?f=bfg-company-services_vyhlasenie-zakladatela-spolocnosti-PO.pdf',
  //   'https://www.firmaren.sk/order/download/boug1qy2lp2cj5tqy10lstvohqq51tbr2xtw0pfgyo4clwy0mv?f=bfg-company-services_vyhlasenie-spravcu-vkladu-PO.pdf',
  //   'https://www.firmaren.sk/order/download/boug1qy2lp2cj5tqy10lstvohqq51tbr2xtw0pfgyo4clwy0mv?f=bfg-company-services_splnomocnenie-FO.pdf',
  //   'https://www.firmaren.sk/order/download/boug1qy2lp2cj5tqy10lstvohqq51tbr2xtw0pfgyo4clwy0mv?f=bfg-company-services_podpisovy-vzor-konatel-babicz-tomas_222644.pdf'
  // ]


  // Nájdem cookie JSESSIONID	
  const cookies = await page.cookies();
  const jsessionId = cookies.find(cookie => cookie.name === 'JSESSIONID')?.value;


  // Sťahujem dokumenty a ukladám ich do priečinka
  const downloadFolder = path.join('downloads');
  if (!fs.existsSync(downloadFolder)) {
    fs.mkdirSync(downloadFolder);
  }

  for (const link of links) {
    try {
      const response = await axios.get(link, {
        responseType: 'arraybuffer',
        headers: {
          Cookie: `JSESSIONID=${jsessionId}`,
        },
      });

      const fileName = link.split('?f=').pop();
      const filePath = path.join(downloadFolder, fileName);

      fs.writeFileSync(filePath, response.data);
      console.log(`Downloaded and saved: ${fileName}`);
    } catch (error) {
      console.error(`Failed to download ${link}:`, error.message);
    }
  }

  await browser.close();
})();