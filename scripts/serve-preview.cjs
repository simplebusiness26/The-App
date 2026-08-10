const http=require("http");
const fs=require("fs");
const path=require("path");

const host="0.0.0.0";
const port=Number(process.env.PORT || 5000);
const root=path.resolve(process.cwd(),"dist");
const indexFile=path.join(root,"index.html");

// Which commit is this preview actually serving?
//
// `serve-preview.cjs` serves a static `dist/`, so pulling new code changes
// nothing until `expo export` runs again. That produced a long and expensive
// debugging session: a screen was reported broken, fixed, verified in a real
// browser, and reported broken again -- with no way to tell whether the preview
// had ever run the new code.
//
// Read from .git rather than by spawning git, so this cannot fail or hang the
// server. Reported by /health alongside when dist was actually built.
function currentCommit(){
  try{
    const head=fs.readFileSync(path.resolve(process.cwd(),".git/HEAD"),"utf8").trim();
    if(!head.startsWith("ref: ")) return head.slice(0,7);

    const ref=head.slice(5).trim();
    const refFile=path.resolve(process.cwd(),".git",ref);
    if(fs.existsSync(refFile)) return fs.readFileSync(refFile,"utf8").trim().slice(0,7);

    const packed=fs.readFileSync(path.resolve(process.cwd(),".git/packed-refs"),"utf8");
    const line=packed.split("\n").find(row=>row.endsWith(` ${ref}`));
    return line ? line.slice(0,7) : "unknown";
  }catch{
    return "unknown";
  }
}

function buildInfo(){
  let builtAt=null;
  try{
    builtAt=fs.statSync(indexFile).mtime.toISOString();
  }catch{
    builtAt=null;
  }

  return {
    status:fs.existsSync(indexFile) ? "ready" : "building",
    commit:currentCommit(),
    builtAt
  };
}

const mimeTypes={
  ".html":"text/html; charset=utf-8",
  ".js":"text/javascript; charset=utf-8",
  ".css":"text/css; charset=utf-8",
  ".json":"application/json; charset=utf-8",
  ".png":"image/png",
  ".jpg":"image/jpeg",
  ".jpeg":"image/jpeg",
  ".gif":"image/gif",
  ".svg":"image/svg+xml",
  ".webp":"image/webp",
  ".ico":"image/x-icon",
  ".woff":"font/woff",
  ".woff2":"font/woff2",
  ".ttf":"font/ttf",
  ".map":"application/json; charset=utf-8"
};

const buildingPage=`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta http-equiv="refresh" content="4" />
  <title>Guestbook is building</title>
  <style>
    html,body{height:100%;margin:0;background:#18181b;color:#fff;font-family:Arial,sans-serif}
    body{display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box}
    main{width:100%;max-width:420px;text-align:center;background:#222226;border:1px solid #3b3b42;border-radius:20px;padding:28px;box-sizing:border-box}
    .spinner{width:42px;height:42px;margin:0 auto 20px;border:4px solid #494952;border-top-color:#9b87f5;border-radius:50%;animation:spin 1s linear infinite}
    h1{font-size:25px;margin:0 0 10px}
    p{color:#b9b9c1;line-height:1.5;margin:0}
    @keyframes spin{to{transform:rotate(360deg)}}
  </style>
</head>
<body>
  <main>
    <div class="spinner"></div>
    <h1>Guestbook is building</h1>
    <p>The new preview is being prepared. This page will refresh automatically.</p>
  </main>
</body>
</html>`;

function noCacheHeaders(contentType){
  return {
    "Content-Type":contentType,
    "Cache-Control":"no-store, no-cache, must-revalidate, proxy-revalidate",
    "Pragma":"no-cache",
    "Expires":"0"
  };
}

function sendBuildingPage(res){
  res.writeHead(200,noCacheHeaders("text/html; charset=utf-8"));
  res.end(buildingPage);
}

function sendFile(res,filePath){
  fs.readFile(filePath,(error,data)=>{
    if(error){
      if(!fs.existsSync(indexFile)){
        sendBuildingPage(res);
        return;
      }

      res.writeHead(500,noCacheHeaders("text/plain; charset=utf-8"));
      res.end("Guestbook preview could not read this file.");
      return;
    }

    const extension=path.extname(filePath).toLowerCase();
    res.writeHead(200,noCacheHeaders(mimeTypes[extension] || "application/octet-stream"));
    res.end(data);
  });
}

const server=http.createServer((req,res)=>{
  let pathname;

  try{
    pathname=decodeURIComponent(new URL(req.url,`http://${req.headers.host || "localhost"}`).pathname);
  }catch{
    res.writeHead(400,noCacheHeaders("text/plain; charset=utf-8"));
    res.end("Bad request");
    return;
  }

  if(pathname==="/health"){
    res.writeHead(200,noCacheHeaders("application/json; charset=utf-8"));
    res.end(JSON.stringify(buildInfo()));
    return;
  }

  if(!fs.existsSync(indexFile)){
    sendBuildingPage(res);
    return;
  }

  const requestedPath=path.resolve(root,`.${pathname}`);

  if(requestedPath!==root && !requestedPath.startsWith(`${root}${path.sep}`)){
    res.writeHead(403,noCacheHeaders("text/plain; charset=utf-8"));
    res.end("Forbidden");
    return;
  }

  fs.stat(requestedPath,(error,stats)=>{
    if(!error && stats.isFile()){
      sendFile(res,requestedPath);
      return;
    }

    if(!error && stats.isDirectory()){
      const directoryIndex=path.join(requestedPath,"index.html");
      if(fs.existsSync(directoryIndex)){
        sendFile(res,directoryIndex);
        return;
      }
    }

    // Expo Router web routes should load the app shell and resolve client-side.
    sendFile(res,indexFile);
  });
});

server.on("error",error=>{
  console.error("[Guestbook] Preview server failed:",error);
  process.exit(1);
});

server.listen(port,host,()=>{
  console.log(`[Guestbook] Preview port opened at http://${host}:${port}`);
  console.log("[Guestbook] A build page will remain available until dist/index.html is ready.");
});

function closeServer(){
  server.close(()=>process.exit(0));
  setTimeout(()=>process.exit(0),1500).unref();
}

process.on("SIGINT",closeServer);
process.on("SIGTERM",closeServer);
