const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 3000;

// Carregar variáveis de ambiente do arquivo .env manualmente
const envPath = path.join(__dirname, '.env');
const envVars = {};
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
        const parts = line.split('=');
        if (parts.length >= 2 && !line.trim().startsWith('#')) {
            const key = parts[0].trim();
            const value = parts.slice(1).join('=').trim();
            envVars[key] = value;
        }
    });
    console.log('Variáveis de ambiente carregadas do .env');
}

const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'application/font-woff',
    '.woff2': 'font/woff2',
    '.ttf': 'application/font-ttf'
};

const server = http.createServer(async (request, response) => {
    // CORS Headers para permitir desenvolvimento local
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    response.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type,authorization');

    if (request.method === 'OPTIONS') {
        response.writeHead(204);
        response.end();
        return;
    }

    const parsedUrl = url.parse(request.url, true);
    const pathname = parsedUrl.pathname;

    console.log(`${request.method} ${pathname}`);

    // --- API ENDPOINTS ---

    // 1. Proxy para OpenAI
    if (pathname === '/api/openai/chat/completions' && request.method === 'POST') {
        try {
            const apiKey = envVars['OPENAI_API_KEY'];
            if (!apiKey) {
                throw new Error('OPENAI_API_KEY não configurada no backend (.env)');
            }

            // Ler body da requisição
            const buffers = [];
            for await (const chunk of request) {
                buffers.push(chunk);
            }
            const data = Buffer.concat(buffers).toString();
            
            // Fazer chamada para OpenAI
            const openAiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: data
            });

            const responseData = await openAiResponse.json();
            
            response.writeHead(openAiResponse.status, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify(responseData));
            return;

        } catch (error) {
            console.error('Erro no proxy OpenAI:', error);
            response.writeHead(500, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ error: error.message }));
            return;
        }
    }

    // 2. Proxy para Meta Ads (Exemplo Genérico)
    // O frontend pode enviar a URL relativa e parâmetros no body
    if (pathname === '/api/meta/proxy' && request.method === 'POST') {
        try {
            const appToken = envVars['FACEBOOK_APP_TOKEN'];
            if (!appToken) {
                throw new Error('FACEBOOK_APP_TOKEN não configurado no backend (.env)');
            }

            const buffers = [];
            for await (const chunk of request) {
                buffers.push(chunk);
            }
            const body = JSON.parse(Buffer.concat(buffers).toString());
            
            // Espera receber { endpoint: '/v19.0/me?...', method: 'GET', access_token: '...' (opcional) }
            const metaEndpoint = body.endpoint;
            if (!metaEndpoint) throw new Error('Endpoint não fornecido');

            // Token: Se o frontend enviar um (ex: Page Token), usa. 
            // Caso contrário, usa o Token Global (App Token) do .env.
            const tokenToUse = body.access_token || appToken;

            const separator = metaEndpoint.includes('?') ? '&' : '?';
            const targetUrl = `https://graph.facebook.com${metaEndpoint}${separator}access_token=${tokenToUse}`;
            
            const metaResponse = await fetch(targetUrl, {
                method: body.method || 'GET'
            });

            const metaData = await metaResponse.json();
            response.writeHead(metaResponse.status, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify(metaData));
            return;

        } catch (error) {
            console.error('Erro no proxy Meta:', error);
            response.writeHead(500, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ error: error.message }));
            return;
        }
    }


    // --- ARQUIVOS ESTÁTICOS ---
    
    // Remove query string para encontrar o arquivo
    let filePath = '.' + pathname;
    if (filePath === './') {
        filePath = './index.html';
    }

    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if(error.code == 'ENOENT') {
                // Se não achar arquivo, tenta index.html (para rotas de SPA se necessário)
                // ou apenas 404. Aqui vamos de 404.
                console.log(`404: ${filePath}`);
                response.writeHead(404, { 'Content-Type': 'text/html' });
                response.end('<h1>404 - Arquivo não encontrado</h1>', 'utf-8');
            }
            else {
                response.writeHead(500);
                response.end('Erro no servidor: '+error.code+' ..\n');
            }
        }
        else {
            response.writeHead(200, { 'Content-Type': contentType });
            response.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, () => {
    console.log(`\n=== SERVIDOR VIBECODE INICIADO ===`);
    console.log(`Local: http://localhost:${PORT}/`);
    console.log(`Backend seguro ativo: API Proxies prontos.`);
    console.log(`Pressione Ctrl+C para parar.\n`);
});
