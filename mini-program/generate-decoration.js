const fs = require('fs');

const svgHeader = `<svg width="240" height="240" viewBox="0 0 240 240" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M120 0C186.274 0 240 53.7258 240 120C240 186.274 186.274 240 120 240C53.7258 240 0 186.274 0 120C0 53.7258 53.7258 0 120 0Z" fill="url(#paint0_linear)"/>
<path d="M60 120C60 86.8629 86.8629 60 120 60C153.137 60 180 86.8629 180 120C180 153.137 153.137 180 120 180C86.8629 180 60 153.137 60 120Z" fill="url(#paint1_linear)"/>
<defs>
<linearGradient id="paint0_linear" x1="0" y1="0" x2="240" y2="240" gradientUnits="userSpaceOnUse">
<stop stop-color="#FFB6C1" stop-opacity="0.3"/>
<stop offset="1" stop-color="#FF6B9D" stop-opacity="0"/>
</linearGradient>
<linearGradient id="paint1_linear" x1="60" y1="60" x2="180" y2="180" gradientUnits="userSpaceOnUse">
<stop stop-color="#FFB6C1" stop-opacity="0.5"/>
<stop offset="1" stop-color="#FF6B9D" stop-opacity="0"/>
</linearGradient>
</defs>
</svg>`;

fs.writeFileSync('/Users/zhugehao/muying-ai-app/mini-program/src/static/header-decoration.svg', svgHeader);
