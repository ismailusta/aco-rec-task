import fs from 'fs';
import path from 'path';

const minimalPngBase64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mNk+M9Qz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC';

const target = path.join('samples', 'voucher.png');
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, Buffer.from(minimalPngBase64, 'base64'));

console.log('Created samples/voucher.png');
