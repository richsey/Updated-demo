import http from 'http';
const s = http.createServer();
s.listen(5002, () => console.log('listen 5002'));
