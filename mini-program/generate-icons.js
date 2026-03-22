const fs = require('fs');

const svgHome = `<svg width="81" height="81" viewBox="0 0 81 81" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M40.5 10L10 35H20V70H35V50H46V70H61V35H71L40.5 10Z" fill="#999999"/></svg>`;
const svgHomeActive = `<svg width="81" height="81" viewBox="0 0 81 81" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M40.5 10L10 35H20V70H35V50H46V70H61V35H71L40.5 10Z" fill="#ff6b9d"/></svg>`;

const svgChat = `<svg width="81" height="81" viewBox="0 0 81 81" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M40.5 15C22.5 15 10 27.5 10 40.5C10 48.5 14.5 55.5 21 59V75L35 65.5C36.5 65.8 38.5 66 40.5 66C58.5 66 71 53.5 71 40.5C71 27.5 58.5 15 40.5 15Z" fill="#999999"/></svg>`;
const svgChatActive = `<svg width="81" height="81" viewBox="0 0 81 81" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M40.5 15C22.5 15 10 27.5 10 40.5C10 48.5 14.5 55.5 21 59V75L35 65.5C36.5 65.8 38.5 66 40.5 66C58.5 66 71 53.5 71 40.5C71 27.5 58.5 15 40.5 15Z" fill="#ff6b9d"/></svg>`;

const svgUser = `<svg width="81" height="81" viewBox="0 0 81 81" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="40.5" cy="28" r="13" fill="#999999"/><path d="M15 70C15 55 25 48 40.5 48C56 48 66 55 66 70" stroke="#999999" stroke-width="8" stroke-linecap="round"/></svg>`;
const svgUserActive = `<svg width="81" height="81" viewBox="0 0 81 81" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="40.5" cy="28" r="13" fill="#ff6b9d"/><path d="M15 70C15 55 25 48 40.5 48C56 48 66 55 66 70" stroke="#ff6b9d" stroke-width="8" stroke-linecap="round"/></svg>`;

fs.writeFileSync('/Users/zhugehao/muying-ai-app/mini-program/src/static/tab-home.svg', svgHome);
fs.writeFileSync('/Users/zhugehao/muying-ai-app/mini-program/src/static/tab-home-active.svg', svgHomeActive);
fs.writeFileSync('/Users/zhugehao/muying-ai-app/mini-program/src/static/tab-chat.svg', svgChat);
fs.writeFileSync('/Users/zhugehao/muying-ai-app/mini-program/src/static/tab-chat-active.svg', svgChatActive);
fs.writeFileSync('/Users/zhugehao/muying-ai-app/mini-program/src/static/tab-user.svg', svgUser);
fs.writeFileSync('/Users/zhugehao/muying-ai-app/mini-program/src/static/tab-user-active.svg', svgUserActive);
console.log('SVG files created.');
