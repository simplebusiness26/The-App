/* eslint-env jest */

// Encodes a polyline, for tests only.
//
// The app only ever DECODES -- utils/routing/model.js -- so there is no encoder
// in the source to reuse. Writing one here rather than pasting a captured
// Valhalla string means a test can state the coordinates it expects back in
// plain numbers, which is the only way the precision-6 assertion is readable.

function encodeValue(value,factor){
  let coordinate=Math.round(value*factor);
  coordinate<<=1;
  if(coordinate<0) coordinate=~coordinate;

  let output="";
  while(coordinate>=0x20){
    output+=String.fromCharCode((0x20 | (coordinate & 0x1f))+63);
    coordinate>>=5;
  }
  output+=String.fromCharCode(coordinate+63);
  return output;
}

function encode(points,precision){
  const factor=Math.pow(10,precision);
  let lastLatitude=0;
  let lastLongitude=0;
  let output="";

  for(const [latitude,longitude] of points){
    output+=encodeValue(latitude-lastLatitude,factor);
    output+=encodeValue(longitude-lastLongitude,factor);
    lastLatitude=latitude;
    lastLongitude=longitude;
  }

  return output;
}

// What Valhalla sends.
function encodeAtSix(points){
  return encode(points,6);
}

module.exports={encode,encodeAtSix};
