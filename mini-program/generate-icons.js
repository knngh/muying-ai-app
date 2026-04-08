const fs = require('fs');
const path = require('path');

const staticDir = path.join(__dirname, 'src', 'static');

const svgHome = `<svg width="81" height="81" viewBox="0 0 81 81" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M40.5 10L10 35H20V70H35V50H46V70H61V35H71L40.5 10Z" fill="#999999"/></svg>`;
const svgHomeActive = `<svg width="81" height="81" viewBox="0 0 81 81" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M40.5 10L10 35H20V70H35V50H46V70H61V35H71L40.5 10Z" fill="#ff6b9d"/></svg>`;

const svgBook = `<svg width="81" height="81" viewBox="0 0 81 81" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18 18C18 14.6863 20.6863 12 24 12H57C60.3137 12 63 14.6863 63 18V63C63 66.3137 60.3137 69 57 69H24C20.6863 69 18 66.3137 18 63V18Z" fill="#999999"/><path d="M28 24H53" stroke="white" stroke-width="4" stroke-linecap="round"/><path d="M28 34H53" stroke="white" stroke-width="4" stroke-linecap="round" opacity="0.9"/><path d="M28 44H45" stroke="white" stroke-width="4" stroke-linecap="round" opacity="0.82"/></svg>`;
const svgBookActive = `<svg width="81" height="81" viewBox="0 0 81 81" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18 18C18 14.6863 20.6863 12 24 12H57C60.3137 12 63 14.6863 63 18V63C63 66.3137 60.3137 69 57 69H24C20.6863 69 18 66.3137 18 63V18Z" fill="#ff6b9d"/><path d="M28 24H53" stroke="white" stroke-width="4" stroke-linecap="round"/><path d="M28 34H53" stroke="white" stroke-width="4" stroke-linecap="round" opacity="0.9"/><path d="M28 44H45" stroke="white" stroke-width="4" stroke-linecap="round" opacity="0.82"/></svg>`;

const svgChat = `<svg width="81" height="81" viewBox="0 0 81 81" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M40.5 15C22.5 15 10 27.5 10 40.5C10 48.5 14.5 55.5 21 59V75L35 65.5C36.5 65.8 38.5 66 40.5 66C58.5 66 71 53.5 71 40.5C71 27.5 58.5 15 40.5 15Z" fill="#999999"/></svg>`;
const svgChatActive = `<svg width="81" height="81" viewBox="0 0 81 81" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M40.5 15C22.5 15 10 27.5 10 40.5C10 48.5 14.5 55.5 21 59V75L35 65.5C36.5 65.8 38.5 66 40.5 66C58.5 66 71 53.5 71 40.5C71 27.5 58.5 15 40.5 15Z" fill="#ff6b9d"/></svg>`;

const svgUser = `<svg width="81" height="81" viewBox="0 0 81 81" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="40.5" cy="28" r="13" fill="#999999"/><path d="M15 70C15 55 25 48 40.5 48C56 48 66 55 66 70" stroke="#999999" stroke-width="8" stroke-linecap="round"/></svg>`;
const svgUserActive = `<svg width="81" height="81" viewBox="0 0 81 81" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="40.5" cy="28" r="13" fill="#ff6b9d"/><path d="M15 70C15 55 25 48 40.5 48C56 48 66 55 66 70" stroke="#ff6b9d" stroke-width="8" stroke-linecap="round"/></svg>`;

fs.writeFileSync(path.join(staticDir, 'tab-home.svg'), svgHome);
fs.writeFileSync(path.join(staticDir, 'tab-home-active.svg'), svgHomeActive);
fs.writeFileSync(path.join(staticDir, 'tab-book.svg'), svgBook);
fs.writeFileSync(path.join(staticDir, 'tab-book-active.svg'), svgBookActive);
fs.writeFileSync(path.join(staticDir, 'tab-chat.svg'), svgChat);
fs.writeFileSync(path.join(staticDir, 'tab-chat-active.svg'), svgChatActive);
fs.writeFileSync(path.join(staticDir, 'tab-user.svg'), svgUser);
fs.writeFileSync(path.join(staticDir, 'tab-user-active.svg'), svgUserActive);
console.log('SVG files created.');
