const { execSync } = require('child_process');

const PORT = 3000;

function isPortInUse(port) {
    try {
        // Windows command to check for port usage
        const output = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`, { encoding: 'utf8' });
        return output.trim().length > 0;
    } catch (error) {
        // findstr returns non-zero exit code if no matches found
        return false;
    }
}

if (isPortInUse(PORT)) {
    console.error(`\x1b[31m%s\x1b[0m`, `[ERROR] Calctopus is already running on Port ${PORT}.`);
    console.error(`\x1b[33m%s\x1b[0m`, `Please close the previous terminal or window and try again.`);
    process.exit(1);
}

console.log(`\x1b[32m%s\x1b[0m`, `[CHECK PASS] Port ${PORT} is available. Starting service...`);
process.exit(0);
