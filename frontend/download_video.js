const https = require('https');
const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)){
    fs.mkdirSync(publicDir);
}

const file = fs.createWriteStream(path.join(publicDir, 'burger.mp4'));
const url = "https://assets.mixkit.co/videos/preview/mixkit-burger-with-melted-cheese-and-bacon-41586-large.mp4";

console.log("Downloading video...");

https.get(url, function(response) {
  if (response.statusCode === 302 || response.statusCode === 301) {
    console.log("Redirecting to: " + response.headers.location);
    https.get(response.headers.location, function(redirectResponse) {
        redirectResponse.pipe(file);
        file.on('finish', function() {
            file.close();
            console.log("Download complete!");
        });
    });
  } else {
    response.pipe(file);
    file.on('finish', function() {
        file.close();
        console.log("Download complete!");
    });
  }
}).on('error', function(err) {
  fs.unlink(path.join(publicDir, 'burger.mp4'), () => {});
  console.error("Error downloading: ", err.message);
});
