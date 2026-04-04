// Improved Subbot Stability

const net = require('net');

const TIMEOUT = 180000; // increased timeout
let reconnectionAttempts = 0;
const MAX_ATTEMPTS = 5;

function connectToServer() {
    const client = net.createConnection({ port: 8080, host: 'localhost' }, () => {
        console.log('Connected to server');
        reconnectionAttempts = 0; // reset attempts on successful connection
    });

    client.setTimeout(TIMEOUT);

    client.on('timeout', () => {
        console.log('Connection timed out, trying to reconnect...');
        client.destroy();
        handleReconnection();
    });

    client.on('error', (err) => {
        console.error('Connection error:', err);
        handleReconnection();
    });

    client.on('data', (data) => {
        // Process the incoming data
        console.log('Received:', data);
    });

    client.on('end', () => {
        console.log('Disconnected from server');
        handleReconnection();
    });
}

function handleReconnection() {
    if (reconnectionAttempts < MAX_ATTEMPTS) {
        reconnectionAttempts++;
        const backoffTime = Math.pow(2, reconnectionAttempts) * 1000; // exponential backoff
        console.log(`Attempting to reconnect in ${backoffTime / 1000} seconds...`);
        setTimeout(connectToServer, backoffTime);
    } else {
        console.error('Max reconnection attempts reached. Giving up.');
    }
}

function performHealthCheck() {
    // Implement health checks for the system
    console.log('Performing health check...');
    // If health check fails, consider triggering reconnection
}

setInterval(performHealthCheck, 300000); // health check every 5 minutes
connectToServer();