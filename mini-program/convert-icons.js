const sharp = require('sharp');
const path = require('path');

async function convert() {
  const staticDir = path.join(__dirname, 'src', 'static');
  const files = ['tab-home', 'tab-home-active', 'tab-book', 'tab-book-active', 'tab-chat', 'tab-chat-active', 'tab-user', 'tab-user-active'];
  for (const file of files) {
    await sharp(path.join(staticDir, `${file}.svg`))
      .png()
      .toFile(path.join(staticDir, `${file}.png`));
  }
  console.log('PNG files created successfully.');
}

convert();
