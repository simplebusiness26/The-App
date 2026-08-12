// Reading a Xplorer QR code, in one place.
//
// This was a private function inside app/scan.js. app/camera.js needs the same
// answer, and two copies of "is this one of ours" is how a code starts working
// on one screen and not the other.

export function extractQrCode(value){
  const raw=(value || "").trim();
  if(!raw) return "";

  try{
    const parsed=new URL(raw);
    const match=parsed.pathname.match(/\/qr\/([^/?#]+)/i);
    if(match?.[1]) return decodeURIComponent(match[1]);
  }catch{
    const match=raw.match(/(?:^|\/)qr\/([^/?#]+)/i);
    if(match?.[1]) return decodeURIComponent(match[1]);
  }

  // A bare code, as printed under the QR square for anybody typing it in.
  if(/^[a-f0-9]{20,80}$/i.test(raw)) return raw;
  return "";
}
