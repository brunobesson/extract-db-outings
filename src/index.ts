import { createReadStream, createWriteStream } from 'fs';
import readline from 'readline';
import parseWkt from './parser/index';
import writeGpx from './writer';

const readInterface = readline.createInterface({
  input: createReadStream('gps.txt'),
  output: undefined,
});
const out = createWriteStream('gps_out.txt');

readInterface.on('line', (line) => {
  const [id, activities, wkt] = line.split('|');

  const geom = parseWkt(wkt);
  if (!geom.length) {
    return;
  }

  out.write(`${activities.substring(1, activities.length - 1)}|${writeGpx(geom)}\n`);
});
