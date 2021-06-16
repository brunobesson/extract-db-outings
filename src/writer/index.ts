import proj4 from 'proj4';

function trkpt(coord: number[]): string {
  const [lng, lat] = proj4('EPSG:3857', 'EPSG:4326', coord.slice(0, 2));
  let ele = '';
  if (coord.length === 3) {
    ele = `<ele>${coord[2]}</ele>`;
  }
  let time = '';
  if (coord.length === 4) {
    time = `<time>${new Date(coord[3] * 1000).toISOString()}</time>`;
  }
  return `<trkpt lat="${lat}" lon="${lng}>${ele}${time}</trkpt>`;
}

function trkseg(geom: number[][]): string {
  return `<trkseg>${geom.map((coord) => trkpt(coord)).join('')}</trkseg>`;
}

const writeGpx = function (geom: number[][] | number[][][]): string {
  const isMultiline = Array.isArray(geom[0][0]);
  let trksegs: string[];
  if (isMultiline) {
    trksegs = (geom as number[][][]).map((item) => trkseg(item));
  } else {
    trksegs = [trkseg(geom as number[][])];
  }
  return `<?xml version="1.0" encoding="UTF-8"?><gpx><trk>${trksegs.join('')}</trk></gpx>`;
};

export default writeGpx;
