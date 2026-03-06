import mammoth from 'mammoth';
import fs from 'fs';

async function testDocx(path) {
    if (!fs.existsSync(path)) return console.log('File not found', path);
    const htmlResult = await mammoth.convertToHtml({ path });
    console.log("HTML:", htmlResult.value);

    const textResult = await mammoth.extractRawText({ path });
    console.log("TEXT:", textResult.value);
}

const files = fs.readdirSync('./uploads');
console.log('Uploads:', files);

if (files.length > 0) {
    testDocx('./uploads/' + files[0]);
}

