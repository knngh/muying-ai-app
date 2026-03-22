const sharp = require('sharp');
const fs = require('fs');

async function convert() {
  const files = ['tab-home', 'tab-home-active', 'tab-chat', 'tab-chat-active', 'tab-user', 'tab-user-active'];
  for (const file of files) {
    await sharp(`/Users/zhugehao/muying-ai-app/mini-program/src/static/${file}.svg`)
      .png()
      .toFile(`/Users/zhugehao/muying-ai-app/mini-program/src/static/${file}.png`);
  }
  console.log('PNG files created successfully.');
}

convert();
