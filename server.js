const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3123;

// Servírování statických souborů
app.use(express.static('.'));

// Hlavní route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// API endpoint pro získání dat ryb
app.get('/api/fish', (req, res) => {
    res.sendFile(path.join(__dirname, 'ryby.json'));
});

// API endpoint pro finální data ryb s min/max velikostmi
app.get('/api/fish-final', (req, res) => {
    res.sendFile(path.join(__dirname, 'ryby_final.json'));
});

app.listen(PORT, () => {
    console.log(`🎣 Rybářská hra běží na http://localhost:${PORT}`);
    console.log('Otevřete prohlížeč a začněte rybařit!');
}); 